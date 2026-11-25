import { describe, expect, test } from 'bun:test'
import { cubre, cuantosDias, esVacaciones, finDe, rangoCorto, sigue, textoRango } from '../vacaciones'

const V = { date: '2026-12-21', hasta: '2027-01-03', tipo: 'vacaciones' }

describe('vacaciones en el calendario', () => {
  test('cubre los dos extremos y nada más', () => {
    expect(cubre(V, '2026-12-21')).toBe(true)
    expect(cubre(V, '2027-01-03')).toBe(true)
    expect(cubre(V, '2026-12-20')).toBe(false)
    expect(cubre(V, '2027-01-04')).toBe(false)
    expect(cubre({ date: '2026-12-21' }, '2026-12-21')).toBe(false)
  })
  test('sigue saliendo mientras no termina', () => {
    expect(sigue(V, '2026-12-30')).toBe(true)
    expect(sigue(V, '2027-01-04')).toBe(false)
    expect(sigue({ date: '2026-12-01' }, '2026-12-02')).toBe(false)
  })
  test('un hasta anterior al inicio cuenta como un solo día', () => {
    expect(finDe({ date: '2026-12-21', hasta: '2026-12-01', tipo: 'vacaciones' })).toBe('2026-12-21')
    expect(esVacaciones({ date: '2026-12-21', tipo: 'vacaciones' })).toBe(true)
  })
  test('textos', () => {
    expect(cuantosDias(V)).toBe(14)
    expect(textoRango(V)).toBe('del lunes 21 de diciembre al domingo 3 de enero')
    expect(rangoCorto(V)).toBe('21 dic – 3 ene')
    expect(textoRango({ date: '2026-12-25', tipo: 'vacaciones' })).toBe('el viernes 25 de diciembre')
  })
})
