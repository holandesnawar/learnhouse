import { describe, expect, test } from 'bun:test'
import { coincide, filasDePresentaciones, listaDeSemana, paraRevisar, porSemanas, queVenLosAlumnos } from '../presentacionesEquipo'
import type { SemanaEquipo } from '../salaProfes'

const HOY = '2026-11-23' // lunes

const pres = (x: any) => ({ id: 'profe:a', de: 'equipo', nombre: 'Mijn huis.pdf', por: 'Rida', at: '2026-11-18T10:00:00+00:00', tam: 1, en_pizarra: false, notas: null, publicada: null, ...x })

function semana(x: Partial<SemanaEquipo> & { pizarra?: any }): SemanaEquipo {
  const { pizarra, ...resto } = x as any
  return {
    key: `k-${resto.semanaId || 1}`,
    semanaId: 1,
    courseUuid: 'rood',
    curso: 'Conversatieles · rood',
    color: '#DC2626',
    tema: 'Mijn huis',
    fecha: HOY,
    hora: 'Lunes 19:30',
    profe: 'Luna',
    presentaciones: [],
    grabaciones: [],
    ejercicios: [],
    tieneTarea: false,
    enunciado: '',
    lista: null,
    porCorregir: 0,
    material: { notas: '', archivos: [], pizarra: pizarra ?? { guardada_at: '', publicada_at: '', paginas: 0, presentaciones: [], sueltas: [], fuente: '', publicada: null } },
    ...resto,
  }
}

const CLASES = [
  { uuid: 'rood', profe: 'Luna' },
  { uuid: 'master', profe: 'Bas' },
]
const esLuna = (p: string) => p.toLowerCase().includes('luna')

describe('la pestaña Presentaciones de la sala de profesores', () => {
  test('cada clase sale con sus presentaciones, por fecha, y dice si es mía', () => {
    const semanas = [
      semana({ semanaId: 2, courseUuid: 'master', curso: 'Masterclass', fecha: '2026-11-26', hora: 'Jueves 20:00', profe: 'Bas', tema: 'De tijd' }),
      semana({ semanaId: 1, pizarra: { presentaciones: [pres({ en_pizarra: true })], sueltas: [], fuente: 'profe:a', publicada: null } }),
      // Fuera de las fechas y una grabación suelta: no salen.
      semana({ semanaId: 3, fecha: '2026-09-01' }),
      semana({ semanaId: 0, suelta: true }),
    ]
    const filas = filasDePresentaciones(CLASES, semanas, HOY, esLuna)
    expect(filas.map((f) => f.semana.semanaId)).toEqual([1, 2])
    expect(filas[0].mia).toBe(true)
    expect(filas[0].conPdf).toBe(true)
    expect(filas[0].hora).toBe('19:30')
    expect(filas[1].mia).toBe(false)
    expect(filas[1].conPdf).toBe(false)
  })

  test('si la escuela aún no manda el resumen, se monta con lo que hay', () => {
    const s = semana({ presentaciones: [{ activity_uuid: 'activity_1', nombre: 'Presentación' }] })
    s.material = { notas: '', archivos: [{ id: 'x', tipo: 'archivo', nombre: 'Dossier.pdf', por: 'Rida', at: '' }, { id: 'y', tipo: 'archivo', nombre: 'Audio.mp3', por: '', at: '' }], pizarra: null }
    const l = listaDeSemana(s)
    expect(l.presentaciones.map((x) => x.id)).toEqual(['profe:x', 'clase:activity_1'])
    expect(l.presentaciones[0].en_pizarra).toBe(true)
  })

  test('para revisar: sin presentación, notas sin guardar, sueltas y notas fuera de la pizarra', () => {
    const notas = { at: '2026-11-16T19:42:00+00:00', por: 'Luna', paginas: 3 }
    const semanas = [
      // Jueves: sin presentación (a 3 días: no es urgente). Mañana: urgente.
      semana({ semanaId: 2, courseUuid: 'master', curso: 'Masterclass', fecha: '2026-11-26', profe: 'Bas' }),
      semana({ semanaId: 5, courseUuid: 'master', curso: 'Masterclass', fecha: '2026-11-24', profe: 'Bas' }),
      // Dentro de 10 días sin presentación: aún no se avisa.
      semana({ semanaId: 6, courseUuid: 'master', curso: 'Masterclass', fecha: '2026-12-03', profe: 'Bas' }),
      // La semana pasada: se escribió y no se guardó para los alumnos.
      semana({ semanaId: 3, fecha: '2026-11-16', pizarra: { presentaciones: [pres({ en_pizarra: true, notas })], sueltas: [], fuente: 'profe:a', publicada: null } }),
      // Hoy: notas en la que no es la de la pizarra, y unas sueltas.
      semana({
        semanaId: 4,
        pizarra: {
          presentaciones: [pres({ en_pizarra: true }), pres({ id: 'profe:b', nombre: 'equivocada.pdf', notas })],
          sueltas: [{ id: 'profe:z', nombre: 'vieja.pdf', at: '', por: 'Paul', paginas: 2 }],
          fuente: 'profe:a',
          publicada: null,
        },
      }),
      // Hace un mes con notas sin guardar: ya no se avisa.
      semana({ semanaId: 7, fecha: '2026-10-28', pizarra: { presentaciones: [pres({ en_pizarra: true, notas })], sueltas: [], fuente: 'profe:a', publicada: null } }),
    ]
    const r = paraRevisar(filasDePresentaciones(CLASES, semanas, HOY, esLuna), HOY)
    expect(r.map((x) => `${x.tipo}:${x.fila.semana.semanaId}:${x.urgente ? 'u' : ''}`)).toEqual([
      'sin-presentacion:5:u',
      'sin-guardar:3:',
      'sueltas:4:',
      'fuera:4:',
      'sin-presentacion:2:',
    ])
    expect(r[0].texto).toBe('Masterclass del martes 24 nov: sin presentación')
    expect(r[1].texto).toBe('Conversatieles · rood del lunes 16 nov: notas sin guardar para los alumnos')
    expect(r[1].ir).toBe('pizarra')
    expect(r[3].texto).toContain('«equivocada.pdf» tiene notas y no es la que abre la pizarra')
  })

  test('si se guardó para los alumnos y luego se escribió más, también se avisa; si no, no', () => {
    const base = { presentaciones: [pres({ en_pizarra: true, notas: { at: '2026-11-16T19:42:00+00:00', por: 'Luna', paginas: 3 } })], sueltas: [], fuente: 'profe:a' }
    const antes = semana({ semanaId: 3, fecha: '2026-11-16', pizarra: { ...base, publicada: { at: '2026-11-16T19:00:00+00:00', por: 'Luna', paginas: 9, tam: 1 } } })
    const despues = semana({ semanaId: 4, fecha: '2026-11-16', pizarra: { ...base, publicada: { at: '2026-11-16T20:05:00+00:00', por: 'Luna', paginas: 9, tam: 1 } } })
    const r = paraRevisar(filasDePresentaciones(CLASES, [antes, despues], HOY, esLuna), HOY)
    expect(r.map((x) => x.fila.semana.semanaId)).toEqual([3])
    expect(r[0].texto).toContain('se escribió después de guardar para los alumnos')
  })

  test('qué ven los alumnos', () => {
    const [sin, antes, version] = filasDePresentaciones(
      CLASES,
      [
        semana({ semanaId: 1 }),
        semana({ semanaId: 2, pizarra: { presentaciones: [pres({ id: 'clase:a', de: 'alumnos', en_pizarra: true })], sueltas: [], fuente: 'clase:a', publicada: null } }),
        semana({ semanaId: 3, pizarra: { presentaciones: [pres({ en_pizarra: true })], sueltas: [], fuente: 'profe:a', publicada: { at: 'x', por: 'Luna', paginas: 9, tam: 1 } } }),
      ],
      HOY,
      esLuna
    )
    expect(queVenLosAlumnos(sin, HOY).texto).toBe('Alumnos: nada todavía')
    expect(queVenLosAlumnos(antes, HOY).texto).toBe('Alumnos: la de antes de la clase')
    expect(queVenLosAlumnos(version, HOY).texto).toBe('Alumnos: la versión de la clase')
  })

  test('por semanas: esta, las que vienen y detrás las anteriores', () => {
    const filas = filasDePresentaciones(
      CLASES,
      [semana({ semanaId: 1, fecha: '2026-11-16' }), semana({ semanaId: 2, fecha: '2026-11-09' }), semana({ semanaId: 3 }), semana({ semanaId: 4, fecha: '2026-11-30' }), semana({ semanaId: 5, fecha: '2026-12-08' })],
      HOY,
      esLuna
    )
    const g = porSemanas(filas, HOY)
    expect(g.map((x) => x.titulo)).toEqual(['Esta semana · 23 a 29 nov', 'La semana que viene · 30 nov a 6 dic', 'Semana del 7 dic', 'La semana pasada · 16 a 22 nov', 'Semana del 9 nov'])
    expect(g.map((x) => x.pasada)).toEqual([false, false, false, true, true])
  })

  test('buscar por tema, clase, profe o nombre del archivo, sin tildes', () => {
    const [f] = filasDePresentaciones(CLASES, [semana({ tema: 'Mijn huis', pizarra: { presentaciones: [pres({ nombre: 'Dossier · versión Luna.pdf' })], sueltas: [], fuente: '', publicada: null } })], HOY, esLuna)
    expect(coincide(f, '')).toBe(true)
    expect(coincide(f, 'HUIS')).toBe(true)
    expect(coincide(f, 'version')).toBe(true)
    expect(coincide(f, 'luna')).toBe(true)
    expect(coincide(f, 'rood')).toBe(true)
    expect(coincide(f, 'masterclass')).toBe(false)
  })
})
