/**
 * El mensaje de WhatsApp para recordarle a alguien su llamada (15/10/2026).
 *
 * Pedido del usuario: "Hola nombre, soy Rida de Holandés Nawar, te escribo
 * para recordarte tu llamada a las X, aquí tu link para acceder a la llamada".
 * El texto se puede cambiar (cada uno el suyo, en su navegador) con los huecos
 * {nombre}, {cuando}, {hora} y {enlace}. La línea del enlace desaparece sola
 * si la cita no tiene enlace (una llamada de teléfono, por ejemplo).
 *
 * La hora va SIEMPRE en hora de Países Bajos, que es donde están la escuela y
 * casi todos los alumnos, aunque quien lo mande esté de viaje.
 *
 * 27/10/2026, el seteo a mano ("mucha gente no se presenta"): dos mensajes,
 * «Confirmar la cita» (en cuanto reserva, pidiendo que diga que sí) y
 * «Recordatorio» (el mismo día). Firman con el nombre de quien lo manda
 * (`{yo}`, el de su cuenta), no con «Rida» fijo: los manda el closer.
 */

export const ZONA_ESCUELA = 'Europe/Amsterdam'

export const PLANTILLA_CONFIRMAR =
  'Hola {nombre}, soy {yo}, de Holandés Nawar. Ya tienes reservada tu llamada con nosotros {cuando} a las {hora}.\n\nTe dejo aquí el enlace para entrar: {enlace}\n\n¿Me confirmas que te viene bien?'

export const PLANTILLA_RECORDATORIO =
  'Hola {nombre}, soy {yo}, de Holandés Nawar. Te escribo para recordarte tu llamada {cuando} a las {hora}.\n\nAquí tienes el enlace para entrar: {enlace}'

export type TipoMensaje = 'confirmar' | 'recordatorio'

export const MENSAJES: { id: TipoMensaje; nombre: string; cuando: string; plantilla: string }[] = [
  { id: 'confirmar', nombre: 'Confirmar la cita', cuando: 'En cuanto reserva', plantilla: PLANTILLA_CONFIRMAR },
  { id: 'recordatorio', nombre: 'Recordatorio', cuando: 'El mismo día', plantilla: PLANTILLA_RECORDATORIO },
]

const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA_ESCUELA }) // AAAA-MM-DD

/** «de hoy», «de mañana» o «del jueves 16 de octubre». */
export function cuandoEs(inicio: Date, ahora: Date = new Date()): string {
  const manana = new Date(ahora.getTime() + 24 * 3600 * 1000)
  if (dia(inicio) === dia(ahora)) return 'de hoy'
  if (dia(inicio) === dia(manana)) return 'de mañana'
  return `del ${inicio.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_ESCUELA }).replace(',', '')}`
}

export function horaEscuela(inicio: Date): string {
  return inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_ESCUELA })
}

export function mensajeRecordatorio(
  plantilla: string,
  datos: { nombre: string; inicio: string; enlace?: string; yo?: string },
  ahora: Date = new Date()
): string {
  const inicio = new Date(datos.inicio)
  const nombre = (datos.nombre || '').trim().split(/\s+/)[0] || ''
  const yo = (datos.yo || '').trim().split(/\s+/)[0] || ''
  const enlace = (datos.enlace || '').trim()
  const lineas = (plantilla || PLANTILLA_RECORDATORIO)
    .split('\n')
    // Sin enlace, fuera la línea que lo lleva (y no queda «el enlace: » colgando).
    .filter((l) => enlace || !l.includes('{enlace}'))
  const texto = lineas
    .join('\n')
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{cuando\}/g, Number.isNaN(inicio.getTime()) ? '' : cuandoEs(inicio, ahora))
    .replace(/\{hora\}/g, Number.isNaN(inicio.getTime()) ? '' : horaEscuela(inicio))
    .replace(/\{enlace\}/g, enlace)
    // Sin nombre en su cuenta: «soy del equipo de Holandés Nawar».
    .replace(/soy \{yo\},? de /g, yo ? `soy ${yo}, de ` : 'soy del equipo de ')
    .replace(/\{yo\}/g, yo || 'el equipo de Holandés Nawar')
  return texto
    .replace(/Hola ,/g, 'Hola,')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** El enlace de WhatsApp con el mensaje escrito. Sin número, WhatsApp deja
 *  elegir a quién mandarlo. */
export function enlaceWhatsApp(numero: string, texto: string): string {
  const t = encodeURIComponent(texto)
  return numero ? `https://wa.me/${numero}?text=${t}` : `https://wa.me/?text=${t}`
}

/**
 * «Por confirmar» (27/10): las llamadas de hoy y de mañana (en Países Bajos)
 * que aún no han empezado y que nadie ha marcado como confirmadas. Es la lista
 * de trabajo del closer: escribirles y, si no contestan, llamarles.
 */
export function porConfirmar<
  T extends { inicio: string; estado: string; resultado?: unknown; confirmada?: unknown },
>(citas: T[], ahora: Date = new Date()): T[] {
  const hoy = dia(ahora)
  const manana = dia(new Date(ahora.getTime() + 24 * 3600 * 1000))
  return (citas || [])
    .filter((c) => {
      const inicio = new Date(c.inicio)
      if (Number.isNaN(inicio.getTime()) || c.estado !== 'activa' || c.resultado || c.confirmada) return false
      return inicio.getTime() > ahora.getTime() && (dia(inicio) === hoy || dia(inicio) === manana)
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}
