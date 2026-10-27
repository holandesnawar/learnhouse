import { describe, expect, test } from 'bun:test'
import { cuandoEs, enlaceWhatsApp, mensajeRecordatorio, PLANTILLA_CONFIRMAR, PLANTILLA_RECORDATORIO, porConfirmar } from '../recordatorioLlamada'

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
      { nombre: 'Ana Gil', inicio: '2026-10-16T16:00:00Z', enlace: 'https://meet.google.com/abc', yo: 'Rida' },
      AHORA
    )
    expect(m).toBe(
      'Hola Ana, soy Rida, de Holandés Nawar. Te escribo para recordarte tu llamada de mañana a las 18:00.\n\nAquí tienes el enlace para entrar: https://meet.google.com/abc'
    )
  })

  test('sin enlace, fuera la línea del enlace', () => {
    const m = mensajeRecordatorio(PLANTILLA_RECORDATORIO, { nombre: 'Ana', inicio: '2026-10-15T16:00:00Z', yo: 'Diego Pérez' }, AHORA)
    expect(m).toBe('Hola Ana, soy Diego, de Holandés Nawar. Te escribo para recordarte tu llamada de hoy a las 18:00.')
  })

  test('sin nombre no queda «Hola ,»', () => {
    const m = mensajeRecordatorio('Hola {nombre}, tu llamada {cuando}', { nombre: '', inicio: '2026-10-15T16:00:00Z' }, AHORA)
    expect(m).toBe('Hola, tu llamada de hoy')
  })
})

describe('confirmar la cita', () => {
  test('pide que diga que sí, firmado por quien lo manda', () => {
    const m = mensajeRecordatorio(
      PLANTILLA_CONFIRMAR,
      { nombre: 'Ana', inicio: '2026-10-20T16:00:00Z', enlace: 'https://zoom.us/j/1', yo: 'Diego' },
      AHORA
    )
    expect(m).toBe(
      'Hola Ana, soy Diego, de Holandés Nawar. Ya tienes reservada tu llamada con nosotros del martes 20 de octubre a las 18:00.\n\nTe dejo aquí el enlace para entrar: https://zoom.us/j/1\n\n¿Me confirmas que te viene bien?'
    )
  })

  test('sin nombre en la cuenta, firma el equipo', () => {
    const m = mensajeRecordatorio(PLANTILLA_CONFIRMAR, { nombre: 'Ana', inicio: '2026-10-15T16:00:00Z' }, AHORA)
    expect(m.startsWith('Hola Ana, soy del equipo de Holandés Nawar. Ya tienes')).toBe(true)
  })
})

test('por confirmar: hoy y mañana, sin empezar, sin confirmar ni resultado', () => {
  const c = (id: string, inicio: string, mas: Record<string, unknown> = {}) => ({ id, inicio, estado: 'activa', ...mas })
  const lista = porConfirmar(
    [
      c('manana', '2026-10-16T16:00:00Z'),
      c('hoy', '2026-10-15T16:00:00Z'),
      c('ya-paso', '2026-10-15T07:00:00Z'),
      c('pasado-manana', '2026-10-17T16:00:00Z'),
      c('confirmada', '2026-10-15T17:00:00Z', { confirmada: { autor: 'Diego', cuando: '' } }),
      c('cancelada', '2026-10-15T18:00:00Z', { estado: 'cancelada' }),
      c('con-resultado', '2026-10-15T19:00:00Z', { resultado: { resultado: 'pagado' } }),
    ],
    AHORA
  )
  expect(lista.map((x) => x.id)).toEqual(['hoy', 'manana'])
})

test('enlaceWhatsApp', () => {
  expect(enlaceWhatsApp('31612345678', 'Hola Ana')).toBe('https://wa.me/31612345678?text=Hola%20Ana')
  expect(enlaceWhatsApp('', 'Hola')).toBe('https://wa.me/?text=Hola')
})
