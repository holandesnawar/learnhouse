import { describe, expect, it } from 'bun:test'
import {
  attemptKeyOf,
  buildFormacionProgress,
  completedActivityIds,
  findRun,
  isPracticeActivity,
  splitActivityName,
  summarize,
  type ChapterLike,
} from '../formacionProgress'

const nawar = (token: string) => ({ embed_url: token })

function chapters(): ChapterLike[] {
  return [
    {
      chapter_uuid: 'ch_1',
      name: 'MODULE 1 - OVER JOU',
      activities: [
        { id: 1, activity_uuid: 'activity_a1', name: '1.1 Samenvatting', content: nawar('nawar:m1/les1/resumen') },
        { id: 2, activity_uuid: 'activity_a2', name: '1.3 Oefening', content: nawar('nawar:m1/les1/vocabulary') },
        { id: 3, activity_uuid: 'activity_a3', name: '1.4 Lezen', content: nawar('nawar:m1/les1/lezen') },
        { id: 4, activity_uuid: 'activity_a4', name: '2.4 Lezen', content: nawar('nawar:m1/les2/lezen') },
      ],
    },
    {
      chapter_uuid: 'ch_2',
      name: 'MODULE 2 - FAMILIE',
      is_locked: true,
      unlock_date: '2026-09-01',
      activities: [{ id: 9, activity_uuid: 'activity_a9', name: '1.4 Lezen' }],
    },
  ]
}

const attempts = {
  'les1-vocabulary': { score: 6, total: 10, failedLabels: ['de tafel', 'het huis'], date: '2026-08-10' },
  'les1-lezen': { score: 9, total: 9, failedLabels: [], date: '2026-08-11' },
  // Intento a medias: ni nota ni fallos.
  'les2-lezen': { score: 2, total: 9, failedLabels: ['x'], date: '2026-08-12', partial: true },
}

describe('splitActivityName', () => {
  it('separa el número de la sección del nombre', () => {
    expect(splitActivityName('1.4 Lezen')).toEqual({ number: '1', code: '1.4', label: 'Lezen' })
    expect(splitActivityName('  2.10 — Luisteren')).toEqual({ number: '2', code: '2.10', label: 'Luisteren' })
  })

  it('deja las clases sueltas sin número', () => {
    expect(splitActivityName('Guía de estudio')).toEqual({ number: '', code: '', label: 'Guía de estudio' })
  })

  it('encuentra el número aunque no vaya al principio del nombre', () => {
    expect(splitActivityName('Les 1 — 1.4 Lezen')).toEqual({ number: '1', code: '1.4', label: 'Les 1 — Lezen' })
    expect(splitActivityName('Oefening 2.3')).toEqual({ number: '2', code: '2.3', label: 'Oefening' })
  })

  it('no confunde un decimal suelto dentro de una palabra', () => {
    expect(splitActivityName('Nivel A1.1 introducción').code).toBe('')
  })
})

describe('attemptKeyOf / isPracticeActivity', () => {
  it('saca la clave del intento del token nawar', () => {
    expect(attemptKeyOf({ id: 1, activity_uuid: '', name: '', content: nawar('nawar:m1/les1/lezen') })).toBe('les1-lezen')
  })

  it('devuelve null cuando no hay sección o no es un ejercicio nativo', () => {
    expect(attemptKeyOf({ id: 1, activity_uuid: '', name: '', content: nawar('nawar:m1/les1') })).toBeNull()
    expect(attemptKeyOf({ id: 1, activity_uuid: '', name: '', content: {} })).toBeNull()
    expect(attemptKeyOf({ id: 1, activity_uuid: '', name: '' })).toBeNull()
  })

  it('solo marca como práctica las secciones que guardan nota', () => {
    expect(isPracticeActivity({ id: 1, activity_uuid: '', name: '', content: nawar('nawar:m/l/lezen') })).toBe(true)
    expect(isPracticeActivity({ id: 1, activity_uuid: '', name: '', content: nawar('nawar:m/l/resumen') })).toBe(false)
  })
})

describe('buildFormacionProgress', () => {
  it('agrupa las secciones por clase y esconde los módulos bloqueados', () => {
    const mods = buildFormacionProgress(chapters(), new Set([1, 2]), attempts as any)

    expect(mods).toHaveLength(1) // el módulo 2 está bloqueado por el goteo
    expect(mods[0].title).toBe('MODULE 1 - OVER JOU')
    expect(mods[0].classes.map((c) => c.title)).toEqual(['Clase 1', 'Clase 2'])
    expect(mods[0].classes[0].sections.map((s) => s.code)).toEqual(['1.1', '1.3', '1.4'])
  })

  it('enseña el módulo bloqueado si se pide expresamente', () => {
    const mods = buildFormacionProgress(chapters(), new Set(), attempts as any, true)
    expect(mods).toHaveLength(2)
    expect(mods[1].unlockDate).toBe('2026-09-01')
  })

  it('marca lo hecho, la nota y los fallos de cada sección', () => {
    const mods = buildFormacionProgress(chapters(), new Set([1, 2]), attempts as any)
    const clase1 = mods[0].classes[0]

    expect(clase1.done).toBe(2)
    expect(clase1.total).toBe(3)
    expect(clase1.completed).toBe(false)

    const oefening = clase1.sections.find((s) => s.code === '1.3')!
    expect(oefening.done).toBe(true)
    expect(oefening.pct).toBe(60)
    expect(oefening.fails).toBe(2)
    expect(oefening.failedLabels).toEqual(['de tafel', 'het huis'])
    expect(oefening.isPractice).toBe(true)

    // 1.4 tiene nota pero NO está completada en el curso: son cosas distintas.
    const lezen = clase1.sections.find((s) => s.code === '1.4')!
    expect(lezen.pct).toBe(100)
    expect(lezen.done).toBe(false)

    // Media de la clase = solo las secciones con nota (60 y 100).
    expect(clase1.pct).toBe(80)
    expect(clase1.fails).toBe(2)
  })

  it('un intento a medias no cuenta como nota ni como fallo', () => {
    const mods = buildFormacionProgress(chapters(), new Set(), attempts as any)
    const clase2 = mods[0].classes[1]
    expect(clase2.sections[0].pct).toBeNull()
    expect(clase2.sections[0].fails).toBe(0)
    expect(clase2.started).toBe(false)
  })

  it('las clases sueltas (sin número) van cada una por su cuenta', () => {
    const mods = buildFormacionProgress(
      [
        {
          chapter_uuid: 'ch_0',
          name: 'INTRODUCCIÓN',
          activities: [
            { id: 20, activity_uuid: 'a20', name: 'Bienvenid@' },
            { id: 21, activity_uuid: 'a21', name: 'Guía de estudio' },
          ],
        },
      ],
      new Set([20]),
      {}
    )
    expect(mods[0].classes.map((c) => c.title)).toEqual(['Bienvenid@', 'Guía de estudio'])
    expect(mods[0].done).toBe(1)
    expect(mods[0].total).toBe(2)
  })

  it('se salta los capítulos vacíos', () => {
    const mods = buildFormacionProgress([{ name: 'Vacío', activities: [] }], new Set(), {})
    expect(mods).toEqual([])
  })

  it('quita el prefijo activity_ del uuid para poder enlazar', () => {
    const mods = buildFormacionProgress(chapters(), new Set(), {})
    expect(mods[0].classes[0].sections[0].activityUuid).toBe('a1')
  })
})

describe('trail', () => {
  it('coge las completadas del run correcto', () => {
    const trail = {
      runs: [
        { course: { course_uuid: 'course_otro' }, steps: [{ activity_id: 99, complete: true }] },
        {
          course: { course_uuid: 'course_abc' },
          steps: [
            { activity_id: 1, complete: true },
            { activity_id: 2, complete: false },
          ],
        },
      ],
    }
    const run = findRun(trail, 'abc')
    expect(completedActivityIds(run)).toEqual(new Set([1]))
    expect(findRun(trail, 'no-existe')).toBeNull()
    expect(completedActivityIds(null)).toEqual(new Set())
  })
})

describe('summarize', () => {
  it('suma el avance de todos los módulos visibles', () => {
    const mods = buildFormacionProgress(chapters(), new Set([1, 2]), attempts as any)
    expect(summarize(mods)).toEqual({ done: 2, total: 4, pct: 50, avgPct: 80, fails: 2 })
  })

  it('no divide por cero sin módulos', () => {
    expect(summarize([])).toEqual({ done: 0, total: 0, pct: 0, avgPct: null, fails: 0 })
  })
})
