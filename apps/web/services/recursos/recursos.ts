'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { mediaSrc } from '@services/messages/direct'

/** Recursos: carpetas con archivos y enlaces para los alumnos. */

export interface RecursoItem {
  id: number
  kind: 'link' | 'file'
  title: string
  url: string
  file_name: string
  size: number
  position: number
  created_at: string
}

export interface Carpeta {
  id: number
  name: string
  description: string
  position: number
  created_at: string
  items: RecursoItem[]
}

const base = () => `${getAPIUrl()}recursos`

/** La URL con la que se abre un item: los archivos del volumen vienen relativos. */
export function abrirUrl(item: RecursoItem): string {
  return item.kind === 'file' ? mediaSrc(item.url) : item.url
}

export function tamano(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Para pintar el icono: Drive, YouTube, PDF… por la URL o el nombre. */
export function tipoDe(item: RecursoItem): 'drive' | 'youtube' | 'pdf' | 'imagen' | 'audio' | 'enlace' | 'archivo' {
  const u = (item.url || '').toLowerCase()
  const n = (item.file_name || item.url || '').toLowerCase()
  if (item.kind === 'link') {
    if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'drive'
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
    return 'enlace'
  }
  if (/\.pdf$/.test(n)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(n)) return 'imagen'
  if (/\.(mp3|m4a|wav|ogg|webm)$/.test(n)) return 'audio'
  return 'archivo'
}

export async function getRecursos(accessToken: string): Promise<Carpeta[]> {
  try {
    const r = await fetch(`${base()}/`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return []
    const d = await r.json()
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

export async function getRecursosAdmin(orgId: number, accessToken: string): Promise<Carpeta[] | null> {
  try {
    const r = await fetch(`${base()}/org/${orgId}`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function json<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error((d && (d.detail || d.message)) || `Error ${r.status}`)
  return d as T
}

export async function crearCarpeta(orgId: number, name: string, description: string, accessToken: string): Promise<Carpeta> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas`, RequestBodyWithAuthHeader('POST', { name, description }, null, accessToken))
  return json<Carpeta>(r)
}

export async function editarCarpeta(orgId: number, id: number, name: string, description: string, accessToken: string): Promise<Carpeta> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas/${id}`, RequestBodyWithAuthHeader('PUT', { name, description }, null, accessToken))
  return json<Carpeta>(r)
}

export async function borrarCarpeta(orgId: number, id: number, accessToken: string): Promise<void> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas/${id}`, RequestBodyWithAuthHeader('DELETE', null, null, accessToken))
  await json(r)
}

export async function ordenarCarpetas(orgId: number, ids: number[], accessToken: string): Promise<void> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas/orden`, RequestBodyWithAuthHeader('PUT', { ids }, null, accessToken))
  await json(r)
}

export async function anadirEnlace(orgId: number, folderId: number, title: string, url: string, accessToken: string): Promise<RecursoItem> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas/${folderId}/enlace`, RequestBodyWithAuthHeader('POST', { title, url }, null, accessToken))
  return json<RecursoItem>(r)
}

export async function subirArchivo(orgId: number, folderId: number, file: File, title: string, accessToken: string): Promise<RecursoItem> {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  const r = await fetch(`${base()}/org/${orgId}/carpetas/${folderId}/archivo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  return json<RecursoItem>(r)
}

export async function borrarItem(orgId: number, id: number, accessToken: string): Promise<void> {
  const r = await fetch(`${base()}/org/${orgId}/items/${id}`, RequestBodyWithAuthHeader('DELETE', null, null, accessToken))
  await json(r)
}

export async function ordenarItems(orgId: number, folderId: number, ids: number[], accessToken: string): Promise<void> {
  const r = await fetch(`${base()}/org/${orgId}/carpetas/${folderId}/orden`, RequestBodyWithAuthHeader('PUT', { ids }, null, accessToken))
  await json(r)
}
