import { describe, expect, test } from 'bun:test'
import { haceCuanto, msDeFecha } from '../haceCuanto'

const utc = Date.UTC(2026, 10, 16, 10, 0, 0)

describe('msDeFecha', () => {
  test('sin zona = UTC (no hora local)', () => {
    expect(msDeFecha('2026-11-16T10:00:00')).toBe(utc)
  })
  test('con espacio y seis decimales (str(datetime.now()), lo que Safari no entendía)', () => {
    expect(msDeFecha('2026-11-16 10:00:00.123456')).toBe(utc + 123)
  })
  test('con zona, se respeta', () => {
    expect(msDeFecha('2026-11-16T11:00:00+01:00')).toBe(utc)
    expect(msDeFecha('2026-11-16T10:00:00Z')).toBe(utc)
    expect(msDeFecha('2026-11-16T10:00:00.000+0000')).toBe(utc)
    expect(msDeFecha('2026-11-16 10:00:00.5+00:00')).toBe(utc + 500)
  })
  test('solo el día', () => {
    expect(msDeFecha('2026-11-16')).toBe(Date.UTC(2026, 10, 16))
  })
  test('lo que no se entiende, NaN', () => {
    expect(Number.isNaN(msDeFecha(''))).toBe(true)
    expect(Number.isNaN(msDeFecha(null))).toBe(true)
    expect(Number.isNaN(msDeFecha('mañana'))).toBe(true)
  })
})

describe('haceCuanto', () => {
  test('un mensaje de hace 10 minutos sin zona no sale «hace 1 h»', () => {
    expect(haceCuanto('2026-11-16 10:00:00.123456', utc + 10 * 60_000)).toBe('hace 10 min')
  })
  test('horas y días', () => {
    expect(haceCuanto('2026-11-16T10:00:00', utc + 3 * 3600_000)).toBe('hace 3 h')
    expect(haceCuanto('2026-11-16T10:00:00', utc + 2 * 86400_000)).toBe('hace 2 días')
    expect(haceCuanto('2026-11-16T10:00:00', utc + 20_000)).toBe('ahora')
  })
})
