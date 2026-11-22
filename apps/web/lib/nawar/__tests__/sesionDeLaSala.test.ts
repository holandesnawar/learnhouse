import { describe, expect, test } from 'bun:test'
import { diaDeSesion, rotuloDeSesion, sesionParaLaSala } from '../sesionDeLaSala'

const S = (id: number, fecha: string) => ({ id, fecha, tema: `t${id}` })

describe('la sesión de la pizarra de la sala', () => {
  test('si hoy hay sesión, es esa', () => {
    const r = sesionParaLaSala([S(1, '2026-11-13'), S(2, '2026-11-20'), S(3, '2026-11-27')], '2026-11-20')
    expect(r.deHoy?.id).toBe(2)
  })
  test('si hoy no hay, no se elige ninguna sola: se ofrece la próxima', () => {
    const r = sesionParaLaSala([S(1, '2026-11-13'), S(3, '2026-11-27'), S(4, '2026-12-04')], '2026-11-20')
    expect(r.deHoy).toBeNull()
    expect(r.otra?.id).toBe(3)
  })
  test('sin ninguna por delante, se ofrece la última dada', () => {
    const r = sesionParaLaSala([S(1, '2026-11-06'), S(2, '2026-11-13')], '2026-11-20')
    expect(r.deHoy).toBeNull()
    expect(r.otra?.id).toBe(2)
  })
  test('sin sesiones, nada', () => {
    expect(sesionParaLaSala([], '2026-11-20')).toEqual({ deHoy: null, otra: null })
  })
  test('el rótulo dice la clase y el día', () => {
    expect(diaDeSesion('2026-11-20')).toBe('viernes 20 nov')
    expect(diaDeSesion('2026-11-20', '2026-11-20')).toBe('hoy, viernes 20 nov')
    expect(rotuloDeSesion('Spreek Club', '2026-11-20')).toBe('Spreek Club · viernes 20 nov')
    expect(rotuloDeSesion('', '2026-11-20')).toBe('viernes 20 nov')
  })
})
