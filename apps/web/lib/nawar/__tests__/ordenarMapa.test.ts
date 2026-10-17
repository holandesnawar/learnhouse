import { describe, expect, test } from 'bun:test'
import { ordenarMapa, type Caja } from '../ordenarMapa'

const caja = (id: string, x = 0, y = 0): Caja => ({ id, x, y, w: 240, h: 100 })

describe('ordenarMapa', () => {
  test('la principal se queda y sus ramas salen a los dos lados', () => {
    const cajas = [caja('centro', 500, 300), caja('a', 0, 0), caja('b', 0, 100), caja('c', 0, 200), caja('d', 0, 300)]
    const uniones = ['a', 'b', 'c', 'd'].map((destino) => ({ origen: 'centro', destino }))
    const p = ordenarMapa(cajas, uniones)
    expect(p.centro).toEqual({ x: 500, y: 300 })
    // Por turnos y en el orden de arriba abajo: a y c a la derecha, b y d a la izquierda.
    expect(p.a.x).toBeGreaterThan(500 + 240)
    expect(p.c.x).toBe(p.a.x)
    expect(p.b.x + 240).toBeLessThan(500)
    expect(p.d.x).toBe(p.b.x)
    expect(p.a.y).toBeLessThan(p.c.y)
    // Sin pisarse.
    expect(p.c.y - p.a.y).toBeGreaterThanOrEqual(100)
  })

  test('los hijos crecen hacia fuera y el padre queda a su altura', () => {
    const cajas = [caja('r', 0, 0), caja('h', 0, 0), caja('n1', 0, 0), caja('n2', 0, 50)]
    const p = ordenarMapa(cajas, [
      { origen: 'r', destino: 'h' },
      { origen: 'h', destino: 'n1' },
      { origen: 'h', destino: 'n2' },
    ])
    expect(p.n1.x).toBeGreaterThan(p.h.x)
    expect(p.h.y + 50).toBe(Math.round((p.n1.y + p.n2.y + 100) / 2))
  })

  test('un círculo de flechas no rompe nada y lo suelto va debajo', () => {
    const cajas = [caja('a', 0, 0), caja('b', 300, 0), caja('suelta', 0, 0)]
    const p = ordenarMapa(cajas, [
      { origen: 'a', destino: 'b' },
      { origen: 'b', destino: 'a' },
    ])
    expect(Object.keys(p).sort()).toEqual(['a', 'b', 'suelta'])
    expect(p.suelta.y).toBeGreaterThan(p.a.y + 100)
  })

  test('sin tarjetas, nada', () => {
    expect(ordenarMapa([], [])).toEqual({})
  })
})
