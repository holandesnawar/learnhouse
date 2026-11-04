import { describe, expect, test } from 'bun:test'
import { columnaDe, cuandoCae, esDe, ordenar, preparacion } from '../clasesProfes'

// Miércoles 4 de noviembre de 2026: su semana va del lunes 2 al domingo 8.
const HOY = '2026-11-04'

describe('columnaDe', () => {
  test('la semana de hoy, de lunes a domingo, aunque la clase ya haya pasado', () => {
    expect(columnaDe('2026-11-02', HOY)).toBe('esta')
    expect(columnaDe('2026-11-04', HOY)).toBe('esta')
    expect(columnaDe('2026-11-08', HOY)).toBe('esta')
  })
  test('la semana que viene y más adelante', () => {
    expect(columnaDe('2026-11-09', HOY)).toBe('proxima')
    expect(columnaDe('2026-11-15', HOY)).toBe('proxima')
    expect(columnaDe('2026-11-16', HOY)).toBe('luego')
  })
  test('antes del lunes, ya dadas; sin día, más adelante', () => {
    expect(columnaDe('2026-11-01', HOY)).toBe('dadas')
    expect(columnaDe('2026-10-26', HOY)).toBe('dadas')
    expect(columnaDe('', HOY)).toBe('luego')
  })
})

describe('cuandoCae', () => {
  test('cerca, con palabras; lejos, nada', () => {
    expect(cuandoCae(HOY, HOY)).toBe('Hoy')
    expect(cuandoCae('2026-11-05', HOY)).toBe('Mañana')
    expect(cuandoCae('2026-11-03', HOY)).toBe('Ayer')
    expect(cuandoCae('2026-11-07', HOY)).toBe('En 3 días')
    expect(cuandoCae('2026-11-02', HOY)).toBe('Hace 2 días')
    expect(cuandoCae('2026-11-20', HOY)).toBe('')
  })
})

describe('preparacion', () => {
  test('antes de la clase: presentación y tarea, sin grabación todavía', () => {
    const p = preparacion({ fecha: '2026-11-09', presentaciones: 1, grabaciones: 0, tieneTarea: true, porCorregir: 0 }, HOY)
    expect(p.pasos.map((x) => x.id)).toEqual(['presentacion', 'tarea'])
    expect(p.hechos).toBe(2)
    expect(p.falta).toBe('')
  })
  test('sin presentación, es lo primero que falta', () => {
    const p = preparacion({ fecha: '2026-11-09', presentaciones: 0, grabaciones: 0, tieneTarea: false, porCorregir: 0 }, HOY)
    expect(p.falta).toBe('Falta la presentación')
    expect(p.total).toBe(1)
  })
  test('pasada la clase, pide la grabación y avisa de lo que hay por corregir', () => {
    const p = preparacion({ fecha: '2026-11-02', presentaciones: 1, grabaciones: 0, tieneTarea: true, porCorregir: 3 }, HOY)
    expect(p.pasos.map((x) => x.id)).toEqual(['presentacion', 'tarea', 'grabacion', 'correcciones'])
    expect(p.falta).toBe('Falta subir la grabación')
    expect(p.pasos[3].texto).toBe('3 tareas por corregir')
  })
  test('el mismo día de la clase aún no pide la grabación', () => {
    const p = preparacion({ fecha: HOY, presentaciones: 1, grabaciones: 0, tieneTarea: false, porCorregir: 0 }, HOY)
    expect(p.pasos.map((x) => x.id)).toEqual(['presentacion'])
  })
})

describe('esDe', () => {
  test('el nombre de pila en el profe del recuadro, sin mayúsculas ni tildes', () => {
    expect(esDe('Paul', 'Paul Plaat')).toBe(true)
    expect(esDe('Paul y Luna', 'luna')).toBe(true)
    expect(esDe('Bas Wanders', 'Bás')).toBe(true)
    expect(esDe('Paul', 'Pau')).toBe(false)
    expect(esDe('', 'Paul')).toBe(false)
    expect(esDe('Paul', '')).toBe(false)
  })
})

describe('ordenar', () => {
  test('lo que viene antes arriba; en las dadas, la última arriba', () => {
    const l = [{ fecha: '2026-11-06' }, { fecha: '2026-11-03' }, { fecha: '' }]
    expect(ordenar(l, 'esta').map((x) => x.fecha)).toEqual(['2026-11-03', '2026-11-06', ''])
    expect(ordenar(l, 'dadas').map((x) => x.fecha)).toEqual(['2026-11-06', '2026-11-03', ''])
  })
})
