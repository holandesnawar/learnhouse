'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface UnreadCount {
  community_uuid: string
  unread: number
  mentions: number
}

export interface PollResults {
  discussion_uuid: string
  counts: number[]
  total: number
  my_vote: number | null
}

const base = () => `${getAPIUrl()}community-engagement`

/** Mensajes sin leer por canal (y cuántos te mencionan). */
export async function getUnread(accessToken: string | undefined): Promise<UnreadCount[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(`${base()}/unread`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** { community_uuid: fecha de última lectura } */
export async function getReadStates(
  accessToken: string | undefined
): Promise<Record<string, string>> {
  if (!accessToken) return {}
  try {
    const r = await fetch(`${base()}/read-states`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return {}
    return (await r.json()) || {}
  } catch {
    return {}
  }
}

export async function markChannelRead(
  communityUuid: string,
  accessToken: string | undefined
): Promise<void> {
  if (!accessToken) return
  try {
    await fetch(
      `${base()}/read/${encodeURIComponent(communityUuid)}`,
      RequestBodyWithAuthHeader('PUT', null, null, accessToken)
    )
  } catch {
    /* el progreso de lectura es best-effort */
  }
}

export interface NotificationItem {
  id: string
  /** mention | pinned | announcement | module */
  kind: string
  title: string
  excerpt: string
  /** Ruta dentro de la escuela, o dirección completa. */
  url: string
  date: string
  is_new: boolean
}

export interface NotificationFeed {
  items: NotificationItem[]
  unseen: number
}

/** Lo que enciende la campana: menciones, fijados, avisos y módulos nuevos. */
export async function getNotifications(
  accessToken: string | undefined
): Promise<NotificationFeed> {
  if (!accessToken) return { items: [], unseen: 0 }
  try {
    const r = await fetch(
      `${base()}/notifications`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return { items: [], unseen: 0 }
    const data = await r.json()
    return { items: Array.isArray(data?.items) ? data.items : [], unseen: data?.unseen || 0 }
  } catch {
    return { items: [], unseen: 0 }
  }
}

/** Quita una notificación de la campana (la papelera de cada línea). */
export async function dismissNotification(
  id: string,
  accessToken: string | undefined
): Promise<boolean> {
  if (!accessToken) return false
  try {
    const r = await fetch(
      `${base()}/notifications/dismiss`,
      RequestBodyWithAuthHeader('POST', { id }, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

/** Apaga el punto rojo. No marca los canales como leídos. */
export async function markNotificationsSeen(accessToken: string | undefined): Promise<void> {
  if (!accessToken) return
  try {
    await fetch(
      `${base()}/notifications/seen`,
      RequestBodyWithAuthHeader('PUT', null, null, accessToken)
    )
  } catch {
    /* best-effort */
  }
}

export async function votePoll(
  discussionUuid: string,
  optionIndex: number,
  accessToken: string | undefined
): Promise<PollResults | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${base()}/polls/${encodeURIComponent(discussionUuid)}/vote`,
      RequestBodyWithAuthHeader('POST', { option_index: optionIndex }, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function getPollResults(
  discussionUuid: string,
  accessToken: string | undefined
): Promise<PollResults | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${base()}/polls/${encodeURIComponent(discussionUuid)}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/** Encuesta guardada dentro del contenido del mensaje. */
export interface PollSpec {
  question: string
  options: string[]
}

export function readPoll(content: string | null | undefined): PollSpec | null {
  if (!content) return null
  try {
    const doc = JSON.parse(content)
    const poll = doc?.poll
    if (poll && typeof poll.question === 'string' && Array.isArray(poll.options) && poll.options.length >= 2) {
      return { question: poll.question, options: poll.options.map((o: any) => String(o)) }
    }
  } catch {
    /* no es una encuesta */
  }
  return null
}
