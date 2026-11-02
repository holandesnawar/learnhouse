import { describe, expect, test } from 'bun:test'
import {
  cuandoEs,
  diaRelativo,
  enlaceWhatsApp,
  estadoPasos,
  faltaPara,
  mensajeRecordatorio,
  porConfirmar,
  porEnviar,
} from '../recordatorioLlamada'

// Miércoles 15 de octubre de 2026, 10:00 en Países Bajos.
const AHORA = new Date('2026-10-15T08:00:00Z')

// Los de fábrica de la escuela (services/contactos/whatsapp_llamada.py).
const PRESENTACION =
  'Hola {nombre}, soy {yo}, de Holandés Nawar 😊\n\nVi que tienes una llamada agendada con nosotros {dia} a las {hora}. En ella vamos a conocer tu situación.\n\nLa llamada es por Google Meet. Unas horas antes te mando por aquí el enlace para entrar.'
const RECURSO =
  'Hola {nombre}, soy {yo} otra vez 👋\n\nTe quería mandar nuestro método en PDF, para que le eches un vistazo antes de la llamada:\n\n{pdf}\n\nAsí {dia} vamos directos a lo que más te interesa.'
const ENLACE = '¡Hola {nombre}! Nuestra llamada es {falta}, a las {hora}.\n\nTe dejo por aquí el enlace para entrar: {enlace}\n\nNos vemos ahí 🙌'

describe('el día, como se dice', () => {
  test('hoy, mañana, pasado mañana, el jueves, el martes 27 de octubre', () => {
    expect(diaRelativo(new Date('2026-10-15T16:00:00Z'), AHORA)).toBe('hoy')
    expect(diaRelativo(new Date('2026-10-16T16:00:00Z'), AHORA)).toBe('mañana')
    expect(diaRelativo(new Date('2026-10-17T16:00:00Z'), AHORA)).toBe('pasado mañana')
    expect(diaRelativo(new Date('2026-10-19T16:00:00Z'), AHORA)).toBe('el lunes')
    expect(diaRelativo(new Date('2026-10-27T16:00:00Z'), AHORA)).toBe('el martes 27 de octubre')
  })

  test('cuenta el día en Países Bajos, no en UTC', () => {
    // 23:30 UTC del 15 = 01:30 del 16 en Países Bajos: es mañana.
    expect(diaRelativo(new Date('2026-10-15T23:30:00Z'), AHORA)).toBe('mañana')
    expect(cuandoEs(new Date('2026-10-15T23:30:00Z'), AHORA)).toBe('de mañana')
  })

  test('cuánto falta', () => {
    expect(faltaPara(new Date('2026-10-15T11:00:00Z'), AHORA)).toBe('en 3 horas')
    expect(faltaPara(new Date('2026-10-15T09:30:00Z'), AHORA)).toBe('en una hora y media')
    expect(faltaPara(new Date('2026-10-15T09:00:00Z'), AHORA)).toBe('en una hora')
    expect(faltaPara(new Date('2026-10-15T10:35:00Z'), AHORA)).toBe('en 2 horas y media')
    expect(faltaPara(new Date('2026-10-15T08:38:00Z'), AHORA)).toBe('en 40 minutos')
    expect(faltaPara(new Date('2026-10-15T08:01:00Z'), AHORA)).toBe('ahora mismo')
    // Otro día y lejos: el día.
    expect(faltaPara(new Date('2026-10-16T16:00:00Z'), AHORA)).toBe('mañana')
  })
})

describe('los tres mensajes', () => {
  const ana = { nombre: 'Ana Gil', inicio: '2026-10-16T16:00:00Z', enlace: 'https://meet.google.com/abc-defg-hij', yo: 'Diego Sosa' }

  test('1: «vi que tienes una llamada agendada mañana»', () => {
    expect(mensajeRecordatorio(PRESENTACION, ana, AHORA)).toBe(
      'Hola Ana, soy Diego, de Holandés Nawar 😊\n\nVi que tienes una llamada agendada con nosotros mañana a las 18:00. En ella vamos a conocer tu situación.\n\nLa llamada es por Google Meet. Unas horas antes te mando por aquí el enlace para entrar.'
    )
    // Una el lunes que viene.
    const lunes = mensajeRecordatorio(PRESENTACION, { ...ana, inicio: '2026-10-19T09:00:00Z' }, AHORA)
    expect(lunes).toContain('agendada con nosotros el lunes a las 11:00')
  })

  test('2: el método en PDF, y sin PDF no queda la línea vacía', () => {
    const m = mensajeRecordatorio(RECURSO, { ...ana, pdf: 'https://app.x/metodo.pdf' }, AHORA)
    expect(m).toBe(
      'Hola Ana, soy Diego otra vez 👋\n\nTe quería mandar nuestro método en PDF, para que le eches un vistazo antes de la llamada:\n\nhttps://app.x/metodo.pdf\n\nAsí mañana vamos directos a lo que más te interesa.'
    )
    expect(mensajeRecordatorio(RECURSO, ana, AHORA)).not.toContain('{pdf}')
  })

  test('3: «nuestra llamada es en 3 horas» con el enlace de Meet', () => {
    const tresHorasAntes = new Date('2026-10-16T13:00:00Z')
    expect(mensajeRecordatorio(ENLACE, ana, tresHorasAntes)).toBe(
      '¡Hola Ana! Nuestra llamada es en 3 horas, a las 18:00.\n\nTe dejo por aquí el enlace para entrar: https://meet.google.com/abc-defg-hij\n\nNos vemos ahí 🙌'
    )
  })

  test('sin nombre de la persona ni del que lo manda', () => {
    expect(mensajeRecordatorio(ENLACE, { nombre: '', inicio: ana.inicio, enlace: ana.enlace }, AHORA).startsWith('¡Hola! Nuestra')).toBe(true)
    expect(mensajeRecordatorio(PRESENTACION, { nombre: 'Ana', inicio: ana.inicio }, AHORA).startsWith('Hola Ana, soy del equipo de Holandés Nawar')).toBe(true)
    expect(mensajeRecordatorio(RECURSO, { nombre: 'Ana', inicio: ana.inicio }, AHORA)).toContain('soy del equipo de Holandés Nawar otra vez')
    expect(mensajeRecordatorio('Hola {nombre}, tu llamada {cuando}', { nombre: '', inicio: '2026-10-15T16:00:00Z' }, AHORA)).toBe(
      'Hola, tu llamada de hoy'
    )
  })
})

describe('el orden: qué toca ahora', () => {
  // Llamada el lunes 19 a las 18:00 (16:00 UTC).
  const INICIO = '2026-10-19T16:00:00Z'

  test('recién reservada: toca el 1; el 2 después del 1; el 3 tres horas antes', () => {
    const { pasos, siguiente } = estadoPasos({ inicio: INICIO }, AHORA)
    expect(pasos.map((p) => p.estado)).toEqual(['toca', 'luego', 'luego'])
    expect(siguiente?.id).toBe('presentacion')
    expect(pasos[1].desde).toBeNull()
    expect(pasos[2].desde?.toISOString()).toBe('2026-10-19T13:00:00.000Z')
  })

  test('con el 1 mandado, el 2 espera a la víspera', () => {
    const c = { inicio: INICIO, whatsapp: { presentacion: { autor: 'Diego', cuando: '2026-10-15T08:00:00Z' } } }
    const { pasos, siguiente } = estadoPasos(c, AHORA)
    expect(pasos.map((p) => p.estado)).toEqual(['enviado', 'luego', 'luego'])
    expect(siguiente?.id).toBe('recurso')
    expect(pasos[1].desde?.toISOString()).toBe('2026-10-18T16:00:00.000Z')
    // La víspera ya toca.
    expect(estadoPasos(c, new Date('2026-10-18T17:00:00Z')).siguiente?.id).toBe('recurso')
    expect(estadoPasos(c, new Date('2026-10-18T17:00:00Z')).siguiente?.estado).toBe('toca')
  })

  test('para mañana: el 2, a las 24 h o una hora después del 1, lo que llegue más tarde', () => {
    const uno = { presentacion: { autor: 'Diego', cuando: '2026-10-15T08:00:00Z' } }
    // Mañana a las 18:00: el 2, hoy a las 18:00.
    expect(estadoPasos({ inicio: '2026-10-16T16:00:00Z', whatsapp: uno }, AHORA).pasos[1].desde?.toISOString()).toBe('2026-10-15T16:00:00.000Z')
    // Mañana a las 9:00: la víspera ya pasó, el 2 una hora después del 1.
    expect(estadoPasos({ inicio: '2026-10-16T07:00:00Z', whatsapp: uno }, AHORA).pasos[1].desde?.toISOString()).toBe('2026-10-15T09:00:00.000Z')
  })

  test('a tres horas, el enlace va primero aunque falte el 2', () => {
    const c = { inicio: INICIO, whatsapp: { presentacion: { autor: 'Diego', cuando: '2026-10-15T08:00:00Z' } } }
    const { pasos, siguiente } = estadoPasos(c, new Date('2026-10-19T13:30:00Z'))
    expect(siguiente?.id).toBe('enlace')
    expect(pasos.map((p) => p.estado)).toEqual(['enviado', 'toca', 'toca'])
  })

  test('reservada para dentro de dos horas: el 2 puede ir ya, a la vez que el 3', () => {
    const c = { inicio: '2026-10-15T10:00:00Z', whatsapp: { presentacion: { autor: 'Diego', cuando: '2026-10-15T08:00:00Z' } } }
    const { pasos } = estadoPasos(c, new Date('2026-10-15T08:05:00Z'))
    expect(pasos[1].estado).toBe('toca')
    expect(pasos[2].estado).toBe('toca')
  })

  test('los tres mandados: nada que hacer', () => {
    const e = { autor: 'Diego', cuando: '2026-10-15T08:00:00Z' }
    expect(estadoPasos({ inicio: INICIO, whatsapp: { presentacion: e, recurso: e, enlace: e } }, AHORA).siguiente).toBeNull()
  })
})

test('la lista de arriba de Llamadas: primero el enlace pendiente', () => {
  const e = { autor: 'Diego', cuando: '2026-10-14T08:00:00Z' }
  const c = (id: string, inicio: string, mas: Record<string, unknown> = {}) => ({ id, inicio, estado: 'activa', ...mas })
  const lista = porEnviar(
    [
      c('nueva-lunes', '2026-10-19T16:00:00Z'),
      c('al-dia-lunes', '2026-10-19T17:00:00Z', { whatsapp: { presentacion: e } }),
      c('enlace-ya', '2026-10-15T10:30:00Z', { whatsapp: { presentacion: e, recurso: e } }),
      c('todo-mandado-manana', '2026-10-16T16:00:00Z', { whatsapp: { presentacion: e, recurso: e, enlace: e } }),
      c('ya-paso', '2026-10-15T07:00:00Z'),
      c('cancelada', '2026-10-15T18:00:00Z', { estado: 'cancelada' }),
    ],
    AHORA
  )
  // La de mañana con todo mandado sale igual: está sin confirmar (para llamarla si no contesta).
  expect(lista.map((x) => x.id)).toEqual(['enlace-ya', 'todo-mandado-manana', 'nueva-lunes'])
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
