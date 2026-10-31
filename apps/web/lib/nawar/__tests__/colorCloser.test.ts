import { describe, expect, test } from 'bun:test'
import { COLORES_CLOSER, colorCloser } from '../colorCloser'

describe('colorCloser', () => {
  const equipo = [{ id: 9 }, { id: 1 }, { id: 5 }]

  test('cada closer del equipo, un color distinto y fijo (por id)', () => {
    const colores = equipo.map((m) => colorCloser(m.id, equipo))
    expect(new Set(colores).size).toBe(3)
    expect(colorCloser(1, equipo)).toBe(COLORES_CLOSER[0])
    expect(colorCloser(5, equipo)).toBe(COLORES_CLOSER[1])
    // El orden en que llega el equipo no cambia el color.
    expect(colorCloser(9, [...equipo].reverse())).toBe(colorCloser(9, equipo))
  })

  test('quien ya no está en el equipo sale por su nombre, siempre igual', () => {
    const a = colorCloser(42, equipo, 'Laura')
    expect(COLORES_CLOSER).toContain(a)
    expect(colorCloser(42, [], 'laura')).toBe(a)
  })
})
