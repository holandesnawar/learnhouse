'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/**
 * Aviso por email a todos los alumnos de la academia. Solo administradores.
 * El servidor encola el envío y responde al instante con a cuántos va.
 */
export async function broadcastNotification(
  payload: {
    org_id: number
    kind: 'announcement' | 'class'
    title: string
    body?: string
    when_text?: string
    url?: string
    /** Enlace al evento en la plataforma (respaldo del botón del email). */
    event_url?: string
  },
  accessToken: string | undefined
): Promise<{ queued: number } | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}notifications/broadcast`,
      RequestBodyWithAuthHeader('POST', payload, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
