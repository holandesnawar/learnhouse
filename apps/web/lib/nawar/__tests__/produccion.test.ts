import { describe, expect, test } from 'bun:test'
import { estadoFecha, fechaCorta, FILTRO_VACIO, haceCuanto, hayFiltro, letraSobre, ordenEntre, pasaFiltro, porColumna, tamano } from '../produccion'

describe('los tableros de producción', () => {
  test('orden al soltar una tarjeta', () => {
    const l = [
      { id: 1, orden: 1 },
      { id: 2, orden: 2 },
    ]
    expect(ordenEntre([], 0)).toBe(1)
    expect(ordenEntre(l, 0)).toBe(0)
    expect(ordenEntre(l, 1)).toBe(1.5)
    expect(ordenEntre(l, 2)).toBe(3)
  })

  test('tarjetas por columna, en orden', () => {
    const r = porColumna(
      [
        { id: 1, columna_id: 10, orden: 2 },
        { id: 2, columna_id: 10, orden: 1 },
        { id: 3, columna_id: 11, orden: 1 },
      ],
      [{ id: 10 }, { id: 11 }, { id: 12 }]
    )
    expect(r[10].map((t) => t.id)).toEqual([2, 1])
    expect(r[12]).toEqual([])
  })

  test('filtros', () => {
    const t = { titulo: 'Les 1 – Woordenschat', etiquetas: [3], asignados: [{ id: 2 }], hecha_at: '' }
    expect(pasaFiltro(t, FILTRO_VACIO, 1)).toBe(true)
    expect(pasaFiltro(t, { ...FILTRO_VACIO, texto: 'woorden' }, 1)).toBe(true)
    expect(pasaFiltro(t, { ...FILTRO_VACIO, etiquetas: [4] }, 1)).toBe(false)
    expect(pasaFiltro(t, { ...FILTRO_VACIO, soloMias: true }, 1)).toBe(false)
    expect(pasaFiltro(t, { ...FILTRO_VACIO, soloMias: true }, 2)).toBe(true)
    expect(pasaFiltro({ ...t, hecha_at: 'x' }, { ...FILTRO_VACIO, sinHacer: true }, 2)).toBe(false)
    expect(hayFiltro(FILTRO_VACIO)).toBe(false)
  })

  test('fechas', () => {
    expect(estadoFecha('2026-11-10', '', '2026-11-19')).toBe('vencida')
    expect(estadoFecha('2026-11-19T10:00', '', '2026-11-19')).toBe('hoy')
    expect(estadoFecha('2026-11-21', '', '2026-11-19')).toBe('pronto')
    expect(estadoFecha('2026-12-21', '', '2026-11-19')).toBe('luego')
    expect(estadoFecha('2026-11-10', 'x', '2026-11-19')).toBe('hecha')
    expect(fechaCorta('2026-11-20T09:05', '2026-11-19')).toBe('20 nov · 09:05')
    expect(fechaCorta('2027-01-02', '2026-11-19')).toBe('2 ene 2027')
    const ahora = Date.parse('2026-11-19T12:00:00Z')
    expect(haceCuanto('2026-11-19T11:57:00Z', ahora)).toBe('hace 3 min')
    expect(haceCuanto('2026-10-15T12:00:00Z', ahora)).toBe('hace un mes')
  })

  test('letra y tamaños', () => {
    expect(letraSobre('#0b2da0')).toBe('#fff')
    expect(letraSobre('#F2CD6B')).toBe('#0B1033')
    expect(tamano(2048)).toBe('2 KB')
    expect(tamano(5 * 1024 * 1024)).toBe('5,0 MB')
  })
})
