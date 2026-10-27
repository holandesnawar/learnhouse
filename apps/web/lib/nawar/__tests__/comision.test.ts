import { describe, expect, test } from 'bun:test'
import { aCaja, comisionCents, leerEuros, pctQueCuadra, textoPct } from '../comision'

describe('comisión del closer', () => {
  test('sobre el total, con el % elegido', () => {
    expect(comisionCents(49700, 15)).toBe(7455)
    expect(comisionCents(49700, 10)).toBe(4970)
    expect(comisionCents(43500, 15)).toBe(6525)
    expect(comisionCents(0, 15)).toBe(0)
  })

  test('el % se deduce si el importe cuadra', () => {
    expect(pctQueCuadra(49700, 4970, [10, 15])).toBe(10)
    expect(pctQueCuadra(49700, 7455, [10, 15])).toBe(15)
    expect(pctQueCuadra(49700, 6000, [10, 15])).toBeNull()
    expect(pctQueCuadra(0, 6000, [10, 15])).toBeNull()
  })

  test('caja de importe', () => {
    expect(aCaja(7455)).toBe('74,55')
    expect(aCaja(0)).toBe('')
    expect(leerEuros('74,55')).toBe(7455)
    expect(leerEuros('1.200,50')).toBe(120050)
    expect(leerEuros('65.25')).toBe(6525)
    expect(leerEuros('hola')).toBeNull()
    expect(textoPct(15)).toBe('15 %')
    expect(textoPct(12.5)).toBe('12,5 %')
  })
})
