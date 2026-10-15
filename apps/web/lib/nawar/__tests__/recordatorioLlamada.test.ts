import { describe, expect, test } from 'bun:test'
import { cuandoEs, enlaceWhatsApp, mensajeRecordatorio, PLANTILLA_RECORDATORIO } from '../recordatorioLlamada'

// Miércoles 15 de octubre de 2026, 10:00 en Países Bajos.
const AHORA = new Date('2026-10-15T08:00:00Z')

describe('cuandoEs', () => {
  test('hoy, mañana o el día con su nombre', () => {
    expect(cuandoEs(new Date('2026-10-15T16:00:00Z'), AHORA)).toBe('de hoy')
    expect(cuandoEs(new Date('2026-10-16T16:00:00Z'), AHORA)).toBe('de mañana')
    expect(cuandoEs(new Date('2026-10-20T16:00:00Z'), AHORA)).toBe('del martes 20 de octubre')
  })

  test('cuenta el día en Países Bajos, no en UTC', () => {
    // 23:30 UTC del 15 = 01:30 del 16 en Países Bajos: es mañana.
    expect(cuandoEs(new Date('2026-10-15T23:30:00Z'), AHORA)).toBe('de mañana')
  })
})

describe('mensajeRecordatorio', () => {
  test('el mensaje que pidió el usuario', () => {
    const m = mensajeRecordatorio(
      PLANTILLA_RECORDATORIO,
      { nombre: 'Ana Gil', inicio: '2026-10-16T16:00:00Z', enlace: 'https://meet.google.com/abc' },
      AHORA
    )
    expect(m).toBe(
      'Hola Ana, soy Rida de Holandés Nawar. Te escribo para recordarte tu llamada de mañana a las 18:00.\n\nAquí tienes el enlace para entrar: https://meet.google.com/abc'
    )
  })

  test('sin enlace, fuera la línea del enlace', () => {
    const m = mensajeRecordatorio(PLANTILLA_RECORDATORIO, { nombre: 'Ana', inicio: '2026-10-15T16:00:00Z' }, AHORA)
    expect(m).toBe('Hola Ana, soy Rida de Holandés Nawar. Te escribo para recordarte tu llamada de hoy a las 18:00.')
  })

  test('sin nombre no queda «Hola ,»', () => {
    const m = mensajeRecordatorio('Hola {nombre}, tu llamada {cuando}', { nombre: '', inicio: '2026-10-15T16:00:00Z' }, AHORA)
    expect(m).toBe('Hola, tu llamada de hoy')
  })
})

test('enlaceWhatsApp', () => {
  expect(enlaceWhatsApp('31612345678', 'Hola Ana')).toBe('https://wa.me/31612345678?text=Hola%20Ana')
  expect(enlaceWhatsApp('', 'Hola')).toBe('https://wa.me/?text=Hola')
})
