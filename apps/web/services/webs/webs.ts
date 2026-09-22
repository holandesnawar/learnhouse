'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/** Webs: enlaces cortos y redirecciones (en la escuela) y el inventario de páginas (en la web). */

export interface WebLink {
  id: number
  slug: string
  destination: string
  destino_final: string
  kind: 'enlace' | 'redireccion'
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  note: string
  clicks: number
  active: boolean
  created_at: string
  updated_at: string
}

export type WebLinkWrite = Omit<WebLink, 'id' | 'destino_final' | 'clicks' | 'created_at' | 'updated_at'>

export const WEB_URL = 'https://www.holandesnawar.com'

const base = () => `${getAPIUrl()}webs`

async function json<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error((d && (d.detail || d.message)) || `Error ${r.status}`)
  return d as T
}

export async function getEnlaces(orgId: number, accessToken: string): Promise<WebLink[] | null> {
  try {
    const r = await fetch(`${base()}/org/${orgId}/enlaces`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function crearEnlace(orgId: number, data: WebLinkWrite, accessToken: string): Promise<WebLink> {
  const r = await fetch(`${base()}/org/${orgId}/enlaces`, RequestBodyWithAuthHeader('POST', data, null, accessToken))
  return json<WebLink>(r)
}

export async function editarEnlace(orgId: number, id: number, data: WebLinkWrite, accessToken: string): Promise<WebLink> {
  const r = await fetch(`${base()}/org/${orgId}/enlaces/${id}`, RequestBodyWithAuthHeader('PUT', data, null, accessToken))
  return json<WebLink>(r)
}

export async function borrarEnlace(orgId: number, id: number, accessToken: string): Promise<void> {
  const r = await fetch(`${base()}/org/${orgId}/enlaces/${id}`, RequestBodyWithAuthHeader('DELETE', null, null, accessToken))
  await json(r)
}

export interface InventarioWeb {
  paginas: string[]
  redirecciones: { desde: string; hacia: string; status: number }[]
  generado: string
}

/** El inventario lo sirve la propia web (/api/paginas), sacado de su código en cada despliegue. */
export async function getInventarioWeb(): Promise<InventarioWeb | null> {
  try {
    const r = await fetch(`${WEB_URL}/api/paginas`, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
