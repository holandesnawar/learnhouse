// @ts-nocheck
/**
 * Tests de la lógica de progreso (sin red, sin React):
 *   bun test lib/exercises-app/__tests__/progress.test.ts
 * Verifican que "Mi progreso" y el Inicio derivan bien los datos del servidor:
 * días activos (incluida la racha), stats de la semana, y el mapa por lección
 * (dónde te quedaste, qué fallaste, qué repasar).
 */
import { describe, expect, test } from 'bun:test'
import { computeInsights } from '@services/student/insights'
import { buildProgressMap, buildLessonRow, trackedSectionIds } from '../progressMap'
import { getLesson } from '../courseService'

// Miércoles 2026-07-29 12:00 local — la semana va de lunes 27 a domingo 2.
const NOW = new Date('2026-07-29T12:00:00')

const att = (score, total, failed, date) => ({
  score, total, failedLabels: failed, date,
})

describe('computeInsights', () => {
  test('semana: lecciones, prácticas, aciertos y días activos', () => {
    const completions = [
      { lesson_id: 'les-1-voorstellen', module_id: 'over-jou', completed_at: '2026-07-27T10:00:00', time_seconds: 600 },
      { lesson_id: 'les-2-voornaamwoorden', module_id: 'over-jou', completed_at: '2026-07-20T10:00:00', time_seconds: 300 }, // semana pasada
    ]
    const attempts = {
      'les-1-voorstellen-lezen': att(7, 9, ['p1', 'p2'], '2026-07-28T09:00:00'),
      'les-1-voorstellen-luisteren': att(30, 36, ['x'], '2026-07-10T09:00:00'), // fuera de semana
    }
    const ins = computeInsights(null, completions, attempts, [], NOW)

    expect(ins.week.lessonsCompleted).toBe(1)
    expect(ins.week.lessonsPrevWeek).toBe(1)
    expect(ins.week.practices).toBe(1)
    expect(ins.week.correctPct).toBe(78) // 7/9
    expect(ins.week.timeSeconds).toBe(600)
    expect(ins.timeSecondsTotal).toBe(900)
    expect(ins.avgPct).toBe(Math.round(((7 + 30) / (9 + 36)) * 100))
    // días activos: lunes 27 (lección) + martes 28 (práctica)
    expect(ins.week.activeDays).toContain('2026-07-27')
    expect(ins.week.activeDays).toContain('2026-07-28')
  })

  test('la racha añade los días que ENTRASTE aunque no completaras nada', () => {
    const progress = {
      last_visit_date: '2026-07-29', current_streak: 3, longest_streak: 5,
      current_position: {}, onboarding_state: {}, theme: 'light', time_seconds_total: 0,
    }
    const ins = computeInsights(progress, [], {}, [], NOW)
    // racha de 3 acabando hoy (mié 29) → activos 27, 28 y 29
    expect(ins.week.activeDays).toEqual(['2026-07-27', '2026-07-28', '2026-07-29'])
  })

  test('la racha no arrastra días de la semana anterior a la tira', () => {
    const progress = {
      last_visit_date: '2026-07-28', current_streak: 10, longest_streak: 10,
      current_position: {}, onboarding_state: {}, theme: 'light', time_seconds_total: 0,
    }
    const ins = computeInsights(progress, [], {}, [], NOW)
    // solo los días de ESTA semana (desde el lunes 27)
    expect(ins.week.activeDays).toEqual(['2026-07-27', '2026-07-28'])
  })
})

describe('buildProgressMap / buildLessonRow', () => {
  const M1L1 = 'les-1-voorstellen'

  test('las secciones seguibles de la lección 1 son las esperadas', () => {
    const lesson = getLesson('over-jou', M1L1)
    expect(trackedSectionIds(lesson)).toEqual(['vocabulary', 'flashcards', 'lezen', 'luisteren'])
  })

  test('lección con fallos: nota, peor sección y fallos totales', () => {
    const attempts = {
      [`${M1L1}-vocabulary`]: att(20, 25, ['¿Cómo se dice...?', 'otro'], '2026-07-28'),
      [`${M1L1}-flashcards`]: att(0, 0, [], '2026-07-28'), // marcador sin nota
      [`${M1L1}-lezen`]: att(5, 9, ['a', 'b', 'c'], '2026-07-28'),
    }
    const row = buildLessonRow(getLesson('over-jou', M1L1), 'over-jou', 1, attempts, new Set())

    expect(row.started).toBe(true)
    expect(row.completed).toBe(false)
    expect(row.totalFails).toBe(5)
    // nota media SOLO de secciones con nota: (80 + 56) / 2 = 68
    expect(row.pct).toBe(68)
    // peor sección con fallos = lezen (56%)
    expect(row.worstFailing.id).toBe('lezen')
    // te quedaste en: primera sección no hecha = luisteren
    expect(row.nextSection.id).toBe('luisteren')
  })

  test('el repaso actualiza la vista: menos fallos → mejor nota y sin candidato', () => {
    // Después de repasar lezen y acertar todo: score sube a 9/9, sin fallos.
    const attempts = {
      [`${M1L1}-vocabulary`]: att(25, 25, [], '2026-07-28'),
      [`${M1L1}-flashcards`]: att(0, 0, [], '2026-07-28'),
      [`${M1L1}-lezen`]: att(9, 9, [], '2026-07-29'),
      [`${M1L1}-luisteren`]: att(36, 36, [], '2026-07-29'),
    }
    const completions = [{ lesson_id: M1L1, module_id: 'over-jou', completed_at: '2026-07-29', time_seconds: 0 }]
    const row = buildLessonRow(getLesson('over-jou', M1L1), 'over-jou', 1, attempts, new Set([M1L1]))

    expect(row.completed).toBe(true)
    expect(row.totalFails).toBe(0)
    expect(row.worstFailing).toBe(null)
    expect(row.nextSection).toBe(null)
    expect(row.pct).toBe(100)

    // y el mapa completo lo refleja
    const map = buildProgressMap(attempts, completions)
    const m1 = map.find((m) => m.id === 'over-jou')
    expect(m1.completed).toBe(1)
    const l1 = m1.lessons.find((l) => l.lessonId === M1L1)
    expect(l1.pct).toBe(100)
  })

  test('lección sin tocar: sin empezar, sin nota, siguiente = primera sección', () => {
    const row = buildLessonRow(getLesson('over-jou', 'les-2-voornaamwoorden'), 'over-jou', 1, {}, new Set())
    expect(row.started).toBe(false)
    expect(row.pct).toBe(null)
    expect(row.nextSection.id).toBe('vocabulary')
    expect(row.totalFails).toBe(0)
  })

  test('la fórmula del repaso: fallos resueltos suman a la nota original', () => {
    // La misma fórmula que aplican las secciones al guardar en modo repaso.
    const lastAttempt = { score: 5, total: 9, failedLabels: ['a', 'b', 'c', 'd'] }
    const reviewed = ['a', 'b', 'c'] // en el repaso salieron estos 3
    const wrongNow = new Set(['b']) // solo 'b' se volvió a fallar
    const stillFailed = lastAttempt.failedLabels.filter((l) =>
      reviewed.includes(l) ? wrongNow.has(l) : true
    )
    const resolved = lastAttempt.failedLabels.length - stillFailed.length
    expect(stillFailed).toEqual(['b', 'd']) // 'd' no se repasó → se conserva
    expect(resolved).toBe(2) // 'a' y 'c' resueltos
    expect(Math.min(lastAttempt.total, lastAttempt.score + resolved)).toBe(7) // 5 → 7 de 9
  })
})
