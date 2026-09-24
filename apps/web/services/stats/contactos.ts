'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/**
 * Contactos: la ficha de cada persona que ha tratado con la escuela.
 * Lo que devuelve el servidor sale de `services/contactos/contactos.py`.
 */

export type EstadoContacto = 'lead' | 'matriculado-sin-pagar' | 'alumno'

export interface EventoContacto {
  kind: string
  /** En cristiano: "Descargó la guía de las bases". */
  que: string
  when: string
  source: string
  tag: string
  recorrido: string
  referrer: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  extra: Record<string, unknown>
}

export interface Contacto {
  email: string
  nombre: string
  telefono: string
  estado: EstadoContacto
  vio_precio: boolean
  vino_de: string
  camino: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  etiquetas: string[]
  primer_contacto: { kind: string; que: string; when: string }
  ultimo_contacto: { kind: string; que: string; when: string }
  n_eventos: number
  /** La etapa más avanzada a la que llegó. Una sola por persona. */
  etapa: EtapaContacto
  /** Cuándo se matriculó por primera vez (pidió plaza o llegó al pago). Vacío si nunca. */
  matricula_at: string
  /** La última solicitud de plaza (para marcarla atendida) y si ya lo está. */
  solicitud_id?: number | null
  atendida?: boolean
  /** Quitado de los números (prueba). Sigue pudiendo entrar a la escuela. */
  fuera_de_metricas?: boolean
}

export type EtapaContacto = 'lead' | 'pidio' | 'en-pago' | 'alumno'

/** Lo que hizo al matricularse, en una línea (para el closer y "Matrículas hechas"). */
export const ETAPA_MATRICULA: Record<EtapaContacto, string> = {
  lead: 'Dejó sus datos',
  pidio: 'Pidió plaza por el formulario (campaña de lanzamiento)',
  'en-pago': 'Llegó al pago y no pagó',
  alumno: 'Ya es alumno',
}

export const ETAPA_TEXTO: Record<EtapaContacto, string> = {
  lead: 'Lead',
  pidio: 'Pidió plaza',
  'en-pago': 'Llegó al pago',
  alumno: 'Alumno',
}

export interface ContactoDetalle extends Contacto {
  eventos: EventoContacto[]
  systeme: {
    ok: boolean
    existe?: boolean
    motivo?: string
    etiquetas: string[]
    campos: { slug: string; valor: string }[]
  }
}

export async function getContactos(
  orgId: number,
  q: string,
  accessToken: string
): Promise<{ total: number; mostrados: number; contactos: Contacto[] } | null> {
  try {
    const params = new URLSearchParams({ q, limit: '500' })
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}?${params.toString()}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getContactoDetalle(
  orgId: number,
  email: string,
  accessToken: string
): Promise<ContactoDetalle | null> {
  try {
    const params = new URLSearchParams({ email })
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/detalle?${params.toString()}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export const ESTADO_TEXTO: Record<EstadoContacto, string> = {
  lead: 'Lead',
  'matriculado-sin-pagar': 'Matriculado sin pagar',
  alumno: 'Alumno',
}

/**
 * Una llamada pedida: quien terminó la cualificación de /agendar. Sale de
 * `services/contactos/llamadas.py`. `solicitud_id` + `contacted_at` son la
 * misma marca de "atendida" que usa Matrículas nuevas.
 */
export interface Llamada {
  id: number
  /** false = dejó sus datos y se fue a mitad del formulario. */
  terminado: boolean
  name: string
  email: string
  phone: string
  created_at: string
  apto: boolean
  puntuacion: number
  /** Por qué se quedó fuera (línea roja de la web). Vacío si encaja. */
  motivo_fuera: string
  /** Cuándo reservó hora en el calendario de /agendar. Vacío si no. */
  reservada_at: string
  /** Los que no terminaron: la última pregunta que contestaron. */
  ultima_pregunta?: string
  respuestas: { pregunta: string; respuesta: string; puntos: number }[]
  sin_respuestas: boolean
  vio_precio: boolean
  vino_de: string
  camino: string
  utm_campaign: string
  solicitud_id: number | null
  contacted_at: string
}

export async function getLlamadas(orgId: number, accessToken: string): Promise<Llamada[] | null> {
  try {
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/llamadas`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.llamadas) ? data.llamadas : []
  } catch {
    return null
  }
}

/** Marca como atendida una llamada que no tiene solicitud (las que no
 *  terminaron el formulario). La marca va en el propio evento. */
export async function marcarLlamada(
  orgId: number,
  eventId: number,
  atendida: boolean,
  accessToken: string | undefined
): Promise<boolean> {
  if (!orgId || !accessToken) return false
  try {
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/llamadas/${eventId}`,
      RequestBodyWithAuthHeader('PUT', { atendida }, null, accessToken)
    )
    return res.ok
  } catch {
    return false
  }
}

/** Una cita reservada en Calendly (services/contactos/agenda.py). */
export interface Cita {
  inicio: string
  fin: string
  titulo: string
  nombre: string
  email: string
  telefono: string
  enlace: string
  cancelar_url: string
  cambiar_url: string
}

export interface Agenda {
  configurado: boolean
  citas: Cita[]
  error?: string
}

export async function getAgenda(orgId: number, accessToken: string, forzar = false): Promise<Agenda | null> {
  try {
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/agenda${forzar ? '?forzar=true' : ''}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Crea un enlace de pago personal: el checkout de la escuela ya rellenado. */
export async function crearEnlacePago(
  orgId: number,
  datos: { email: string; first_name: string; last_name?: string; phone?: string },
  accessToken: string
): Promise<{ url?: string; dias?: number; error?: string }> {
  try {
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/enlace-pago`,
      RequestBodyWithAuthHeader('POST', datos, null, accessToken)
    )
    const cuerpo = await res.json().catch(() => ({}))
    if (!res.ok) return { error: cuerpo?.detail || 'No se ha podido crear el enlace' }
    return cuerpo
  } catch {
    return { error: 'No se ha podido crear el enlace' }
  }
}

/**
 * Borra el rastro de una persona que era una prueba (o un lead que no vale):
 * eventos, solicitudes y matrículas sin pagar. No toca pagos, cuentas ni el
 * CRM. Solo administradores.
 */
export async function borrarContacto(
  orgId: number,
  email: string,
  accessToken: string
): Promise<{ ok: boolean; quedan?: { pagadas: number; cuenta: boolean }; error?: string }> {
  try {
    const params = new URLSearchParams({ email })
    const res = await fetch(
      `${getAPIUrl()}contactos/org/${orgId}/contacto?${params.toString()}`,
      RequestBodyWithAuthHeader('DELETE', null, null, accessToken)
    )
    const cuerpo = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: cuerpo?.detail || 'No se ha podido borrar' }
    return { ok: true, quedan: cuerpo?.quedan }
  } catch {
    return { ok: false, error: 'No se ha podido borrar' }
  }
}

/** El texto que se enseña tras borrar, diciendo qué NO se ha tocado. */
export function avisoTrasBorrar(quedan?: { pagadas: number; cuenta: boolean }): string {
  if (!quedan || (!quedan.pagadas && !quedan.cuenta)) return 'Borrado'
  const partes = []
  if (quedan.pagadas) partes.push(quedan.pagadas === 1 ? 'un pago' : `${quedan.pagadas} pagos`)
  if (quedan.cuenta) partes.push('una cuenta en la escuela')
  return `Borrado. Tiene ${partes.join(' y ')}: eso no se borra desde aquí, así que sigue saliendo como alumno.`
}

// ── Seguimiento: notas y "volver a llamar" ────────────────────────────────

export interface NotaContacto {
  id: number
  texto: string
  autor: string
  autor_id: number
  created_at: string
}

export interface VolverALlamar {
  fecha: string
  motivo: string
  autor?: string
}

async function pedir<T>(url: string, metodo: string, cuerpo: unknown, accessToken: string): Promise<{ ok: boolean; datos?: T; error?: string }> {
  try {
    const res = await fetch(`${getAPIUrl()}${url}`, RequestBodyWithAuthHeader(metodo, cuerpo, null, accessToken))
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (datos as any)?.detail || 'No se ha podido guardar' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export async function getSeguimiento(orgId: number, email: string, accessToken: string) {
  return pedir<{ notas: NotaContacto[]; volver_a_llamar: VolverALlamar | null }>(
    `contactos/org/${orgId}/seguimiento?${new URLSearchParams({ email }).toString()}`,
    'GET',
    null,
    accessToken
  )
}

export async function anadirNota(orgId: number, email: string, texto: string, accessToken: string) {
  return pedir<NotaContacto>(`contactos/org/${orgId}/notas`, 'POST', { email, texto }, accessToken)
}

export async function borrarNota(orgId: number, notaId: number, accessToken: string) {
  return pedir<{ ok: boolean }>(`contactos/org/${orgId}/notas/${notaId}`, 'DELETE', null, accessToken)
}

export async function ponerRecordatorio(orgId: number, email: string, fecha: string, motivo: string, accessToken: string) {
  return pedir<{ volver_a_llamar: VolverALlamar | null }>(
    `contactos/org/${orgId}/recordatorio`,
    'PUT',
    { email, fecha, motivo },
    accessToken
  )
}

export async function getRecordatorios(orgId: number, accessToken: string): Promise<Record<string, VolverALlamar>> {
  const r = await pedir<{ recordatorios: Record<string, VolverALlamar> }>(
    `contactos/org/${orgId}/recordatorios`,
    'GET',
    null,
    accessToken
  )
  return r.datos?.recordatorios ?? {}
}

// ── Guion de llamada ──────────────────────────────────────────────────────

export async function getGuion(orgId: number, accessToken: string) {
  return pedir<{ texto: string; de_fabrica: boolean }>(`contactos/org/${orgId}/guion`, 'GET', null, accessToken)
}

export async function guardarGuion(orgId: number, texto: string, accessToken: string) {
  return pedir<{ texto: string; de_fabrica: boolean }>(`contactos/org/${orgId}/guion`, 'PUT', { texto }, accessToken)
}

/** "AAAA-MM-DD" de hoy en la hora del que mira. */
export function hoyISO(dias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "hoy", "mañana", "ayer" o "jue 26 sep". */
export function cuandoLlamar(fecha: string): string {
  if (!fecha) return ''
  if (fecha === hoyISO()) return 'hoy'
  if (fecha === hoyISO(1)) return 'mañana'
  if (fecha === hoyISO(-1)) return 'ayer'
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Quitar de las métricas (pruebas): sigue pudiendo entrar a la escuela ──

export async function quitarDeMetricas(orgId: number, email: string, accessToken: string) {
  return pedir<{ ok: boolean }>(`contactos/org/${orgId}/metricas/excluir`, 'POST', { email, motivo: 'prueba' }, accessToken)
}

export async function volverAContar(orgId: number, email: string, accessToken: string) {
  return pedir<{ ok: boolean }>(
    `contactos/org/${orgId}/metricas/excluir?${new URLSearchParams({ email }).toString()}`,
    'DELETE',
    null,
    accessToken
  )
}

// ── Resumen de seguimiento: fechas, notas por persona y últimas notas ─────

export interface NotaReciente {
  id: number
  email: string
  texto: string
  autor: string
  created_at: string
}

export interface ResumenSeguimiento {
  recordatorios: Record<string, VolverALlamar>
  notas_por_email: Record<string, number>
  ultimas_notas: NotaReciente[]
}

export async function getResumenSeguimiento(orgId: number, accessToken: string): Promise<ResumenSeguimiento> {
  const r = await pedir<ResumenSeguimiento>(`contactos/org/${orgId}/seguimiento-resumen`, 'GET', null, accessToken)
  return r.datos ?? { recordatorios: {}, notas_por_email: {}, ultimas_notas: [] }
}

// ── Números de /agendar ───────────────────────────────────────────────────

export interface PasoAgendar {
  empezaron: number
  terminaron: number
  encajan: number
  no_encajan: number
  reservaron: number
}

export async function getEmbudoAgendar(orgId: number, accessToken: string) {
  const r = await pedir<{ '7d': PasoAgendar; '30d': PasoAgendar; total: PasoAgendar }>(
    `contactos/org/${orgId}/agendar-embudo`,
    'GET',
    null,
    accessToken
  )
  return r.datos ?? null
}
