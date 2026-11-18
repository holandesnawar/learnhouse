import { describe, expect, test } from 'bun:test'
import { diaEnLaOtraClase, esDeEstaSemana } from '../otraClase'

describe('diaEnLaOtraClase', () => {
  test('el jueves de la misma semana', () => {
    expect(diaEnLaOtraClase('2026-11-02', { dia: 'jueves' })).toBe('2026-11-05')
    // Del jueves al lunes: hacia atrás, la misma semana.
    expect(diaEnLaOtraClase('2026-11-05', { dia: 'lunes' })).toBe('2026-11-02')
    // El domingo es el último día de la semana.
    expect(diaEnLaOtraClase('2026-11-02', { dia: 'domingo' })).toBe('2026-11-08')
  })
  test('sin semanas, el día del recuadro; y si no hay nada, el mismo día', () => {
    expect(diaEnLaOtraClase('2026-11-02', { dia: '', weekday: '4' })).toBe('2026-11-05')
    expect(diaEnLaOtraClase('2026-11-02', { dia: '', weekday: '' })).toBe('2026-11-02')
    expect(diaEnLaOtraClase('', { dia: 'jueves' })).toBe('')
  })
})

describe('esDeEstaSemana', () => {
  test('la clase del otro grupo de la semana pasada no vale (miércoles 11 → lunes 16)', () => {
    expect(esDeEstaSemana('2026-11-11', '2026-11-16', 'Het weer', 'Mijn huis')).toBe(false)
    expect(esDeEstaSemana('2026-11-11', '2026-11-16')).toBe(false)
  })
  test('la de esta semana sí (lunes 16 y miércoles 18)', () => {
    expect(esDeEstaSemana('2026-11-18', '2026-11-16')).toBe(true)
    expect(esDeEstaSemana('2026-11-16', '2026-11-22')).toBe(true)
  })
  test('con el mismo tema, aunque caiga en la semana de al lado', () => {
    expect(esDeEstaSemana('2026-11-13', '2026-11-16', 'Mijn huis', 'Mijn Huis')).toBe(true)
    expect(esDeEstaSemana('2026-11-02', '2026-11-16', 'Mijn huis', 'Mijn huis')).toBe(false)
  })
})
