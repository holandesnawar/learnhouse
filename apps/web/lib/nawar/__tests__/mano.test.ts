import { describe, expect, test } from 'bun:test'
import { conMano, haceCuantoMano, manosLevantadas, sinMano, tieneMano } from '../mano'

describe('levantar la mano', () => {
  test('poner y quitar la mano del nombre', () => {
    expect(conMano('Ana')).toBe('✋ Ana')
    expect(conMano('✋ Ana')).toBe('✋ Ana')
    expect(sinMano('✋ ✋ Ana')).toBe('Ana')
    expect(sinMano('Ana')).toBe('Ana')
    expect(tieneMano(' ✋ Ana')).toBe(true)
    expect(tieneMano('Ana ✋')).toBe(false)
  })

  test('las manos, en el orden en que se levantaron', () => {
    const manos = manosLevantadas(
      {
        local: { session_id: 'yo', user_name: 'Paul', local: true },
        a: { session_id: 'a', user_name: '✋ Luis' },
        b: { session_id: 'b', user_name: '✋ Ana' },
        c: { session_id: 'c', user_name: 'Marta' },
      },
      { a: 200, b: 100 },
      500
    )
    expect(manos.map((m) => m.nombre)).toEqual(['Ana', 'Luis'])
  })

  test('quien ya la tenía al entrar cuenta desde ahora', () => {
    const manos = manosLevantadas([{ session_id: 'x', user_name: '✋ Eva' }], {}, 900)
    expect(manos[0].desde).toBe(900)
  })

  test('hace cuánto', () => {
    expect(haceCuantoMano(0, 10_000)).toBe('ahora')
    expect(haceCuantoMano(0, 70_000)).toBe('hace 1 min')
    expect(haceCuantoMano(0, 180_000)).toBe('hace 3 min')
  })
})
