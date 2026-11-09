import { describe, expect, test } from 'bun:test'
import { agendaEquipo, horaDe, porSemanasDeAgenda, sinSemanaPorDelante, type SemanaEquipo } from '../salaProfes'
import { esDe } from '../clasesProfes'

const s = (o: Partial<SemanaEquipo>): SemanaEquipo => ({
  key: o.key || 'k', semanaId: 1, courseUuid: 'a', curso: 'Clase semanal', color: '#000', tema: 't', fecha: '', hora: '', profe: '',
  presentaciones: [], grabaciones: [], ejercicios: [], tieneTarea: false, enunciado: '', lista: null, porCorregir: 0, ...o,
})
const HOY = '2026-11-10' // martes
const clases = [
  { uuid: 'rood', profe: 'Paul' },
  { uuid: 'master', profe: '' },
  { uuid: 'spreek', profe: 'Tom' },
]

describe('calendario de la sala de profes', () => {
  test('la hora sale del recuadro', () => {
    expect(horaDe('Martes 19:00')).toBe('19:00')
    expect(horaDe('jueves a las 9.30 h')).toBe('09:30')
    expect(horaDe('Por confirmar')).toBe('')
  })

  test('solo lo que viene, por fecha y hora, con quién la da', () => {
    const r = agendaEquipo(
      clases,
      [
        s({ key: 'pasada', courseUuid: 'rood', fecha: '2026-11-03' }),
        s({ key: 'r1', courseUuid: 'rood', fecha: '2026-11-12', hora: 'Jueves 19:00' }),
        s({ key: 'm1', courseUuid: 'master', fecha: '2026-11-12', hora: 'Jueves 18:00', material: { notas: '', archivos: [], profe: 'Luna' } }),
        s({ key: 'lejos', courseUuid: 'rood', fecha: '2026-12-30' }),
        s({ key: 'suelta', courseUuid: 'rood', fecha: '2026-11-11', suelta: true }),
        s({ key: 'otra', courseUuid: 'no-es-mia', fecha: '2026-11-11' }),
      ],
      HOY,
      (p) => esDe(p, 'Paul Plaat')
    )
    expect(r.map((x) => x.semana.key)).toEqual(['m1', 'r1'])
    expect(r[0].profe).toBe('Luna')
    expect(r[0].mia).toBe(false)
    expect(r[1].mia).toBe(true)
  })

  test('por semanas', () => {
    const r = agendaEquipo(clases, [s({ key: 'a', courseUuid: 'rood', fecha: '2026-11-12' }), s({ key: 'b', courseUuid: 'rood', fecha: '2026-11-19' }), s({ key: 'c', courseUuid: 'rood', fecha: '2026-11-26' })], HOY, () => false)
    expect(porSemanasDeAgenda(r, HOY).map((g) => g.titulo)).toEqual(['Esta semana', 'La semana que viene', 'Semana del 23 nov'])
  })

  test('las clases sin semana por delante', () => {
    expect(sinSemanaPorDelante(clases, [s({ courseUuid: 'rood', fecha: '2026-11-12' }), s({ courseUuid: 'spreek', fecha: '2026-11-01' })], HOY).map((c) => c.uuid)).toEqual(['master', 'spreek'])
  })
})
