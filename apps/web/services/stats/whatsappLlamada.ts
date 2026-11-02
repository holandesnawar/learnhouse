/**
 * Los tres WhatsApp de cada llamada (02/11/2026): los textos del equipo, el
 * PDF del método y qué se le ha mandado a cada cita. Servidor:
 * `services/contactos/whatsapp_llamada.py`.
 */

import { getAPIUrl } from '@services/config/config'
import type { Enviado, PasoWhatsApp } from '@/lib/nawar/recordatorioLlamada'

export interface MensajesLlamada {
  pasos: { id: PasoWhatsApp; numero: number; nombre: string; cuando: string; texto: string; de_fabrica: boolean }[]
  fabrica: Record<PasoWhatsApp, string>
  huecos: string[]
  horas_antes: number
  /** El enlace que va en el mensaje 2 (el del PDF subido o el pegado). */
  pdf: string
  pdf_subido: boolean
  pdf_nombre: string
  pdf_subido_en: string
  pdf_enlace: string
}

async function pedir<T>(url: string, metodo: string, cuerpo: unknown, token: string): Promise<{ ok: boolean; datos?: T; error?: string }> {
  try {
    const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData
    const res = await fetch(`${getAPIUrl()}contactos/${url}`, {
      method: metodo,
      headers: esForm ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store',
      body: cuerpo == null ? undefined : esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: typeof (datos as any)?.detail === 'string' ? (datos as any).detail : 'No se ha podido guardar' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getMensajesLlamada = (orgId: number, t: string) => pedir<MensajesLlamada>(`org/${orgId}/whatsapp-llamada`, 'GET', null, t)

export const guardarMensajesLlamada = (
  orgId: number,
  cambios: { textos?: Partial<Record<PasoWhatsApp, string>>; pdf_enlace?: string; horas_antes?: number },
  t: string
) => pedir<MensajesLlamada>(`org/${orgId}/whatsapp-llamada`, 'PUT', cambios, t)

export function subirPdfMetodo(orgId: number, archivo: File, t: string) {
  const f = new FormData()
  f.append('archivo', archivo, archivo.name)
  return pedir<MensajesLlamada>(`org/${orgId}/whatsapp-llamada/pdf`, 'POST', f, t)
}

export const quitarPdfMetodo = (orgId: number, t: string) => pedir<MensajesLlamada>(`org/${orgId}/whatsapp-llamada/pdf`, 'DELETE', null, t)

export const marcarWhatsApp = (orgId: number, datos: { cita_id: string; email: string; paso: PasoWhatsApp; inicio: string }, t: string) =>
  pedir<{ ok: boolean; paso: PasoWhatsApp; enviado: Enviado }>(`org/${orgId}/llamadas/whatsapp`, 'POST', datos, t)

export const desmarcarWhatsApp = (orgId: number, citaId: string, paso: PasoWhatsApp, t: string) =>
  pedir<{ ok: boolean }>(
    `org/${orgId}/llamadas/whatsapp?${new URLSearchParams({ cita_id: citaId, paso }).toString()}`,
    'DELETE',
    null,
    t
  )
