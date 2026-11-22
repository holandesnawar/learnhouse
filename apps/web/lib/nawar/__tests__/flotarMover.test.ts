import { describe, expect, test } from 'bun:test'
import { consejoBalance, siguienteTipo, textoBalance } from '../flotarMover'

describe('flotar y mover', () => {
  test('la etiqueta da la vuelta', () => {
    expect(siguienteTipo('')).toBe('flotar')
    expect(siguienteTipo(undefined)).toBe('flotar')
    expect(siguienteTipo('flotar')).toBe('mover')
    expect(siguienteTipo('mover')).toBe('')
  })
  test('el texto de la semana', () => {
    expect(textoBalance({ hechas: { flotar: 6, mover: 4 }, flotar_pct: 60, mover_pct: 40 })).toBe(
      'Esta semana: 6 flotar · 4 mover (60/40)'
    )
    expect(textoBalance({ hechas: { flotar: 0, mover: 0 }, flotar_pct: 0, mover_pct: 0 })).toMatch(/aún no/)
  })
  test('el consejo', () => {
    expect(consejoBalance({ hechas: { flotar: 1, mover: 0 }, mover_pct: 0 })).toBe('')
    expect(consejoBalance({ hechas: { flotar: 8, mover: 2 }, mover_pct: 20 })).toMatch(/fuegos/)
    expect(consejoBalance({ hechas: { flotar: 5, mover: 5 }, mover_pct: 50 })).toBe('Buen equilibrio.')
  })
})
