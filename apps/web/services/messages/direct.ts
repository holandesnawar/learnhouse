'use client'
import { getAPIUrl, getBackendUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/**
 * Mensajes directos entre el alumno y el equipo de la escuela.
 *
 * El alumno tiene una sola conversación (no elige destinatario); el equipo ve
 * la bandeja entera, un hilo por alumno.
 */

export interface DirectMessage {
  id: number
  body: string
  /** Ruta de la nota de voz servida por el backend, o cadena vacía. */
  audio_url: string
  audio_seconds: number
  created_at: string
  author_id: number | null
  author_name: string
  /** Foto de quien escribe (o el logo de la escuela). Ruta relativa. */
  author_avatar: string
  /** Cargo del equipo ("Director Académico"), si lo tiene puesto. */
  author_title: string
  from_staff: boolean
}

export interface DirectThread {
  id: number
  student_id: number
  student_name: string
  student_avatar: string
  last_message_at: string
  last_message_preview: string
  unread: number
  /** Con quién es la conversación, visto desde quien mira. */
  title: string
  /** Foto de esa persona (o el logo de la escuela). */
  title_avatar: string
  /** Cargo de esa persona ("Director Académico"). */
  title_role: string
  /** Vacío = conversación con todo el equipo. */
  staff_id: number | null
  staff_name: string
}

export interface DirectoryEntry {
  user_id: number
  name: string
  email: string
  avatar: string
  role: string
  thread_id: number | null
}

export interface DirectThreadDetail {
  thread: DirectThread
  messages: DirectMessage[]
  is_staff: boolean
}

const base = () => `${getAPIUrl()}messages`

/**
 * Las rutas (audio, fotos) vienen relativas al backend; aquí se completan.
 * Sirve igual para las notas de voz y para los avatares.
 */
export function mediaSrc(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  // getBackendUrl() ya termina en "/" (así lo exige la configuración).
  return `${getBackendUrl()}${url.replace(/^\//, '')}`
}

/** Nombre antiguo, para no tocar quien ya lo usaba. */
export const audioSrc = mediaSrc

export async function getThreads(accessToken: string | undefined): Promise<DirectThread[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(`${base()}/threads`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function getMyThread(
  accessToken: string | undefined
): Promise<DirectThreadDetail | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(`${base()}/thread`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function getThread(
  threadId: number,
  accessToken: string | undefined
): Promise<DirectThreadDetail | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${base()}/thread/${threadId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function getUnreadMessages(accessToken: string | undefined): Promise<number> {
  if (!accessToken) return 0
  try {
    const r = await fetch(`${base()}/unread`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return 0
    const data = await r.json()
    return Number(data?.unread || 0)
  } catch {
    return 0
  }
}

/**
 * Manda texto y/o una nota de voz. Va como multipart (por el audio), así que
 * NO se pone Content-Type a mano: el navegador tiene que poner el suyo con el
 * separador que toca.
 */
export async function sendDirectMessage(
  params: {
    threadId?: number | null
    body?: string
    audio?: Blob | null
    audioSeconds?: number
    /** Manda además un correo al alumno avisando (sin contar el mensaje). */
    notify?: boolean
  },
  accessToken: string | undefined
): Promise<DirectMessage | null> {
  if (!accessToken) return null
  const form = new FormData()
  if (params.threadId) form.append('thread_id', String(params.threadId))
  form.append('body', params.body || '')
  form.append('audio_seconds', String(Math.round(params.audioSeconds || 0)))
  if (params.notify) form.append('notify', 'true')
  if (params.audio) form.append('audio', params.audio, 'nota.webm')

  try {
    const r = await fetch(`${base()}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      body: form,
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function markThreadRead(
  threadId: number,
  accessToken: string | undefined
): Promise<void> {
  if (!accessToken) return
  try {
    await fetch(
      `${base()}/thread/${threadId}/read`,
      RequestBodyWithAuthHeader('POST', {}, null, accessToken)
    )
  } catch {
    /* best-effort */
  }
}

/** Texto de bienvenida automático (solo administradores). */
export async function updateDirectWelcome(
  orgId: number,
  message: string,
  accessToken: string | undefined
): Promise<boolean> {
  if (!accessToken) return false
  try {
    const r = await fetch(
      `${getAPIUrl()}orgs/${orgId}/config/direct_welcome`,
      RequestBodyWithAuthHeader('PUT', { message }, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

/** A quién puedo escribir: el alumno ve al equipo; el equipo ve a los alumnos. */
export async function getDirectory(
  q: string,
  accessToken: string | undefined,
  scope: 'auto' | 'team' = 'auto'
): Promise<DirectoryEntry[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${base()}/directory?q=${encodeURIComponent(q)}&scope=${scope}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Abre (o recupera) la conversación con esa persona. */
export async function openThreadWith(
  peerId: number,
  accessToken: string | undefined
): Promise<DirectThreadDetail | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${base()}/open/${peerId}`,
      RequestBodyWithAuthHeader('POST', {}, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/** Cargos del equipo: { "12": "Director Académico" }. Solo administradores. */
export async function updateStaffTitles(
  orgId: number,
  titles: Record<string, string>,
  accessToken: string | undefined
): Promise<boolean> {
  if (!accessToken) return false
  try {
    const r = await fetch(
      `${getAPIUrl()}orgs/${orgId}/config/staff_titles`,
      RequestBodyWithAuthHeader('PUT', { titles }, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}
