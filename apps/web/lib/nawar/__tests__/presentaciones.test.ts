import { describe, expect, test } from 'bun:test'
import { actividadDe, archivoDe, avisos, cuandoFue, destinosPara, instante, quienLaVe, textoNotas } from '../presentaciones'

const AHORA = new Date('2026-11-23T19:00:00Z') // 20:00 en Países Bajos

const p = (x: any) => ({ id: 'profe:a', de: 'equipo', nombre: 'A.pdf', por: '', at: '', tam: 0, en_pizarra: false, notas: null, publicada: null, ...x })

describe('las presentaciones de una clase', () => {
  test('las fechas del servidor sin zona son UTC', () => {
    expect(instante('2026-11-23 18:42:00')?.toISOString()).toBe('2026-11-23T18:42:00.000Z')
    expect(instante('2026-11-23T18:42:00+00:00')?.toISOString()).toBe('2026-11-23T18:42:00.000Z')
    expect(instante('')).toBeNull()
  })

  test('cuándo fue, en hora de Países Bajos', () => {
    expect(cuandoFue('2026-11-23T18:42:00+00:00', AHORA)).toBe('hoy a las 19:42')
    expect(cuandoFue('2026-11-22T10:00:00+00:00', AHORA)).toBe('ayer')
    expect(cuandoFue('2026-11-18T10:00:00+00:00', AHORA)).toBe('el 18 nov')
    expect(cuandoFue('2025-12-01T10:00:00+00:00', AHORA)).toBe('el 1 dic 2025')
    // Las 23:30 UTC ya son el día siguiente en Países Bajos.
    expect(cuandoFue('2026-11-22T23:30:00+00:00', AHORA)).toBe('hoy a las 00:30')
  })

  test('el texto de las notas', () => {
    expect(textoNotas(null)).toBe('Sin notas')
    expect(textoNotas({ at: '2026-11-23T18:42:00+00:00', por: 'Luna', paginas: 5 }, AHORA)).toBe('Con notas en 5 páginas · Luna, hoy a las 19:42')
    expect(textoNotas({ at: '', por: '', paginas: 1 }, AHORA)).toBe('Con notas en 1 página')
    // Lo guardado antes del cambio no dice en cuántas páginas.
    expect(textoNotas({ at: '2026-11-18T10:00:00+00:00', por: 'Paul', paginas: null }, AHORA)).toBe('Con notas · Paul, el 18 nov')
  })

  test('quién la ve y quién la subió', () => {
    expect(quienLaVe(p({ por: 'Rida', at: '2026-11-18T10:00:00+00:00' }) as any, AHORA)).toBe('Solo el equipo · la subió Rida el 18 nov')
    expect(quienLaVe(p({ id: 'clase:x', de: 'alumnos', at: '2026-11-18 09:00:00' }) as any, AHORA)).toBe('Los alumnos la ven antes de la clase · subida el 18 nov')
    expect(quienLaVe(p({ id: 'blanco', de: 'blanco' }) as any, AHORA)).toContain('Sin PDF')
  })

  test('a cuáles se pueden pasar las notas y qué hay que mirar', () => {
    const lista: any = {
      presentaciones: [p({ id: 'profe:buena', en_pizarra: true }), p({ id: 'profe:mala', notas: { at: '', por: 'Luna', paginas: 2 } }), p({ id: 'clase:activity_1', de: 'alumnos' })],
      sueltas: [{ id: 'profe:vieja' }],
    }
    expect(destinosPara('profe:mala', lista).map((x) => x.id)).toEqual(['profe:buena', 'clase:activity_1'])
    expect(avisos(lista).fuera.map((x) => x.id)).toEqual(['profe:mala'])
    expect(avisos(lista).sueltas).toBe(1)
    expect(actividadDe('clase:activity_1')).toBe('activity_1')
    expect(archivoDe('profe:mala')).toBe('mala')
    expect(archivoDe('clase:activity_1')).toBe('')
  })
})
