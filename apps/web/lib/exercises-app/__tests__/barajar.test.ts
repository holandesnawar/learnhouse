import { describe, expect, test } from 'bun:test'
import { barajar, barajarSinCoincidir, barajarSinResolver } from '../barajar'

describe('barajar', () => {
  test('conserva todos los elementos y no toca la entrada', () => {
    const entrada = ['a', 'b', 'c', 'd']
    const salida = barajar(entrada)
    expect([...salida].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(entrada).toEqual(['a', 'b', 'c', 'd'])
  })

  test('la respuesta buena no se queda arriba casi siempre', () => {
    // Con cuatro opciones, la primera debería caer arriba ~1 de cada 4 veces.
    let arriba = 0
    for (let i = 0; i < 4000; i++) if (barajar(['ok', 'x', 'y', 'z'])[0] === 'ok') arriba++
    expect(arriba).toBeGreaterThan(800)
    expect(arriba).toBeLessThan(1200)
  })
})

describe('barajarSinCoincidir (Empareja)', () => {
  test('ninguna traducción queda al lado de su palabra', () => {
    const derecha = ['el queso', 'la carne', 'la verdura', 'la fruta']
    for (let i = 0; i < 500; i++) {
      const orden = barajarSinCoincidir(derecha)
      orden.forEach((x, j) => expect(x).not.toBe(derecha[j]))
    }
  })

  test('con un solo elemento no se cuelga', () => {
    expect(barajarSinCoincidir(['uno'])).toEqual(['uno'])
  })
})

describe('barajarSinResolver (ordenar frase, letras)', () => {
  test('nunca sale la frase ya montada', () => {
    const fichas = ['Ik', 'eet', 'brood']
    for (let i = 0; i < 500; i++) {
      const orden = barajarSinResolver(fichas, (o) => o.join(' ') === 'Ik eet brood')
      expect(orden.join(' ')).not.toBe('Ik eet brood')
    }
  })

  test('si todo orden es la solución, devuelve algo igualmente', () => {
    expect(barajarSinResolver(['a', 'a'], (o) => o.join('') === 'aa')).toEqual(['a', 'a'])
  })
})
