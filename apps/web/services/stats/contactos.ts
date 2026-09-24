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
}

export type EtapaContacto = 'lead' | 'pidio' | 'en-pago' | 'alumno'

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
