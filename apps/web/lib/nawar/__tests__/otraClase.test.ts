import { describe, expect, test } from 'bun:test'
import { diaEnLaOtraClase } from '../otraClase'

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
