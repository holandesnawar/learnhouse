/**
 * Los WhatsApp de cada llamada: el texto y cuándo toca cada uno.
 *
 * 15/10/2026: un recordatorio ("Hola nombre, soy Rida… tu llamada a las X,
 * aquí tu link"). 27/10: dos («Confirmar la cita» y «Recordatorio»), firmados
 * por quien los manda (`{yo}`).
 *
 * 02/11/2026 ("que desde el CRM sea más fácil el orden por el que se
 * envían"): TRES, en orden, iguales para todo el equipo (los textos viven en
 * la escuela, `services/contactos/whatsapp_llamada.py`):
 *
 *   1. Presentarte, en cuanto reserva: quién eres, «vi que tienes una llamada
 *      agendada mañana a las 18:00», qué se hace en ella y que es por Google
 *      Meet («unas horas antes te mando el enlace»).
 *   2. El método en PDF: «soy yo otra vez, te mando nuestro método». Mejor la
 *      víspera, y nunca antes de una hora después del primero.
 *   3. El enlace: «nuestra llamada es en 3 horas, te dejo el enlace». Desde
 *      unas horas antes (3 de serie, se cambia en los mensajes).
 *
 * Huecos: {nombre}, {yo}, {dia} (hoy, mañana, el lunes, el lunes 10 de
 * noviembre), {hora}, {falta} (en 3 horas, en una hora y media, en 40
 * minutos, mañana), {enlace}, {pdf} y el viejo {cuando} (de hoy, de mañana,
 * del jueves 16 de octubre). Una línea con {enlace} o {pdf} desaparece si no
 * lo hay.
 *
 * La hora va SIEMPRE en hora de Países Bajos, que es donde están la escuela y
 * casi todos los alumnos, aunque quien lo mande esté de viaje.
 */

export const ZONA_ESCUELA = 'Europe/Amsterdam'

export type PasoWhatsApp = 'presentacion' | 'recurso' | 'enlace'

export const PASOS_WHATSAPP: { id: PasoWhatsApp; numero: number; nombre: string }[] = [
  { id: 'presentacion', numero: 1, nombre: 'Presentarte' },
  { id: 'recurso', numero: 2, nombre: 'El método en PDF' },
  { id: 'enlace', numero: 3, nombre: 'El enlace de la llamada' },
]

export const HORAS_ANTES = 3

const HORA = 3600 * 1000

const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA_ESCUELA }) // AAAA-MM-DD

/** Días de calendario (en Países Bajos) de `ahora` a `d`: 0 hoy, 1 mañana… */
function diasHasta(d: Date, ahora: Date): number {
  return Math.round((Date.parse(dia(d)) - Date.parse(dia(ahora))) / (24 * HORA))
}

/** «de hoy», «de mañana» o «del jueves 16 de octubre». */
export function cuandoEs(inicio: Date, ahora: Date = new Date()): string {
  const manana = new Date(ahora.getTime() + 24 * HORA)
  if (dia(inicio) === dia(ahora)) return 'de hoy'
  if (dia(inicio) === dia(manana)) return 'de mañana'
  return `del ${inicio.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_ESCUELA }).replace(',', '')}`
}

/** «hoy», «mañana», «pasado mañana», «el lunes» (esta semana) o «el lunes 10
 *  de noviembre». Va sin preposición: «tienes una llamada agendada mañana». */
export function diaRelativo(d: Date, ahora: Date = new Date()): string {
  const n = diasHasta(d, ahora)
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n === 2) return 'pasado mañana'
  if (n > 2 && n < 7) return `el ${d.toLocaleDateString('es-ES', { weekday: 'long', timeZone: ZONA_ESCUELA })}`
  return `el ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_ESCUELA }).replace(',', '')}`
}

/** Cuánto falta, para «nuestra llamada es {falta}»: «en 3 horas», «en una
 *  hora y media», «en 40 minutos», «ahora mismo». Si es otro día y faltan 12
 *  horas o más, el día: «mañana», «el lunes». */
export function faltaPara(inicio: Date, ahora: Date = new Date()): string {
  const min = (inicio.getTime() - ahora.getTime()) / 60000
  if (min <= 2) return 'ahora mismo'
  if (min < 55) return `en ${Math.max(5, Math.round(min / 5) * 5)} minutos`
  if (min >= 12 * 60 && dia(inicio) !== dia(ahora)) return diaRelativo(inicio, ahora)
  const h = Math.round(min / 30) / 2
  const enteras = Math.floor(h)
  const media = h !== enteras
  if (enteras === 1) return media ? 'en una hora y media' : 'en una hora'
  return media ? `en ${enteras} horas y media` : `en ${enteras} horas`
}

export function horaEscuela(inicio: Date): string {
  return inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_ESCUELA })
}

export function mensajeRecordatorio(
  plantilla: string,
  datos: { nombre: string; inicio: string; enlace?: string; yo?: string; pdf?: string },
  ahora: Date = new Date()
): string {
  const inicio = new Date(datos.inicio)
  const vale = !Number.isNaN(inicio.getTime())
  const nombre = (datos.nombre || '').trim().split(/\s+/)[0] || ''
  const yo = (datos.yo || '').trim().split(/\s+/)[0] || ''
  const enlace = (datos.enlace || '').trim()
  const pdf = (datos.pdf || '').trim()
  const lineas = (plantilla || '')
    .split('\n')
    // Sin enlace (o sin PDF), fuera la línea que lo lleva: no queda «el enlace: » colgando.
    .filter((l) => (enlace || !l.includes('{enlace}')) && (pdf || !l.includes('{pdf}')))
  let texto = lineas
    .join('\n')
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{cuando\}/g, vale ? cuandoEs(inicio, ahora) : '')
    .replace(/\{dia\}/g, vale ? diaRelativo(inicio, ahora) : '')
    .replace(/\{falta\}/g, vale ? faltaPara(inicio, ahora) : '')
    .replace(/\{hora\}/g, vale ? horaEscuela(inicio) : '')
    .replace(/\{enlace\}/g, enlace)
    .replace(/\{pdf\}/g, pdf)
  // Sin nombre en su cuenta, firma el equipo.
  texto = yo
    ? texto.replace(/\{yo\}/g, yo)
    : texto
        .replace(/soy \{yo\},? de /g, 'soy del equipo de ')
        .replace(/soy \{yo\}/g, 'soy del equipo de Holandés Nawar')
        .replace(/\{yo\}/g, 'el equipo de Holandés Nawar')
  return texto
    .replace(/Hola ([,!])/g, 'Hola$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** El enlace de WhatsApp con el mensaje escrito. Sin número, WhatsApp deja
 *  elegir a quién mandarlo. */
export function enlaceWhatsApp(numero: string, texto: string): string {
  const t = encodeURIComponent(texto)
  return numero ? `https://wa.me/${numero}?text=${t}` : `https://wa.me/?text=${t}`
}

// ── El orden: qué toca ahora ────────────────────────────────────────────────

export interface Enviado {
  autor: string
  cuando: string
}

export interface EstadoPaso {
  id: PasoWhatsApp
  numero: number
  nombre: string
  /** enviado · toca (ya es su momento) · luego (aún no). */
  estado: 'enviado' | 'toca' | 'luego'
  /** Desde cuándo toca; null = desde ya (o, en el 2, después del 1). */
  desde: Date | null
  enviado?: Enviado
}

/**
 * En qué va cada uno de los tres WhatsApp de una cita y cuál toca ahora
 * (`siguiente`, el que la pantalla resalta). Función pura, con test.
 *
 * - 1, desde ya.
 * - 2, una hora después del 1 y no antes de la víspera (24 h antes); si eso
 *   cae ya dentro de la ventana del 3, a la vez que el 3. Sin el 1 mandado,
 *   «después del 1».
 * - 3, desde `horasAntes` horas antes de la llamada.
 * - Siguiente: el 3 si ya es su momento y no se ha mandado (el enlace es lo
 *   que más importa); si no, el primero que toca; si no, el primero que
 *   falta (para decir cuándo).
 */
export function estadoPasos(
  cita: { inicio: string; whatsapp?: Partial<Record<PasoWhatsApp, Enviado>> | null },
  ahora: Date = new Date(),
  horasAntes: number = HORAS_ANTES
): { pasos: EstadoPaso[]; siguiente: EstadoPaso | null } {
  const enviados = cita.whatsapp || {}
  const inicio = new Date(cita.inicio).getTime()
  const desdeEnlace = new Date(inicio - horasAntes * HORA)
  const primero = enviados.presentacion ? new Date(enviados.presentacion.cuando).getTime() : NaN
  const desdeRecurso = Number.isNaN(primero)
    ? null
    : new Date(Math.min(Math.max(primero + HORA, inicio - 24 * HORA), desdeEnlace.getTime()))

  const pasos: EstadoPaso[] = PASOS_WHATSAPP.map((p) => {
    const desde = p.id === 'presentacion' ? null : p.id === 'recurso' ? desdeRecurso : desdeEnlace
    const enviado = enviados[p.id]
    let estado: EstadoPaso['estado'] = 'luego'
    if (enviado) estado = 'enviado'
    else if (p.id === 'presentacion') estado = 'toca'
    else if (desde && ahora.getTime() >= desde.getTime()) estado = 'toca'
    return { ...p, desde, estado, ...(enviado ? { enviado } : {}) }
  })
  const [, , tercero] = pasos
  const siguiente =
    (tercero.estado === 'toca' ? tercero : null) ||
    pasos.find((p) => p.estado === 'toca') ||
    pasos.find((p) => p.estado !== 'enviado') ||
    null
  return { pasos, siguiente }
}

/** «hoy a partir de las 15:00», «mañana a partir de las 18:00», «el lunes a
 *  partir de las 10:00». */
export function aPartirDe(desde: Date, ahora: Date = new Date()): string {
  return `${diaRelativo(desde, ahora)} a partir de las ${horaEscuela(desde)}`
}

/**
 * «Por confirmar» (27/10): las llamadas de hoy y de mañana (en Países Bajos)
 * que aún no han empezado y que nadie ha marcado como confirmadas.
 */
export function porConfirmar<
  T extends { inicio: string; estado: string; resultado?: unknown; confirmada?: unknown },
>(citas: T[], ahora: Date = new Date()): T[] {
  const hoy = dia(ahora)
  const manana = dia(new Date(ahora.getTime() + 24 * HORA))
  return (citas || [])
    .filter((c) => {
      const inicio = new Date(c.inicio)
      if (Number.isNaN(inicio.getTime()) || c.estado !== 'activa' || c.resultado || c.confirmada) return false
      return inicio.getTime() > ahora.getTime() && (dia(inicio) === hoy || dia(inicio) === manana)
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}

/**
 * La lista de trabajo de arriba de Llamadas (02/11): las llamadas que aún no
 * han empezado y a las que les toca un WhatsApp ahora, más las de hoy y
 * mañana sin confirmar (para llamarlas si no contestan). Primero las que
 * tienen el enlace pendiente (la llamada es en pocas horas); luego, por hora.
 */
export function porEnviar<
  T extends {
    inicio: string
    estado: string
    resultado?: unknown
    confirmada?: unknown
    whatsapp?: Partial<Record<PasoWhatsApp, Enviado>> | null
  },
>(citas: T[], ahora: Date = new Date(), horasAntes: number = HORAS_ANTES): T[] {
  const sinConfirmar = new Set(porConfirmar(citas, ahora))
  const filas = (citas || []).filter((c) => {
    const inicio = new Date(c.inicio)
    if (Number.isNaN(inicio.getTime()) || c.estado !== 'activa' || c.resultado || inicio.getTime() <= ahora.getTime()) return false
    return estadoPasos(c, ahora, horasAntes).siguiente?.estado === 'toca' || sinConfirmar.has(c)
  })
  const urgente = (c: T) => {
    const s = estadoPasos(c, ahora, horasAntes).siguiente
    return s?.id === 'enlace' && s.estado === 'toca' ? 0 : 1
  }
  return filas.sort((a, b) => urgente(a) - urgente(b) || a.inicio.localeCompare(b.inicio))
}
