/**
 * La pizarra de clase (10/11/2026). La API está en
 * apps/api/src/routers/pizarra.py y la explicación en
 * apps/api/src/services/tareas/pizarra.py.
 */
import { getAPIUrl } from '@services/config/config'
import type { DocPizarra } from '@/lib/nawar/pizarra'

export interface FuentePizarra {
  id: string
  de: 'profe' | 'alumnos'
  nombre: string
}

export interface Publicada {
  at: string
  por: string
  paginas: number
  tam: number
}

export interface Pizarra {
  semana: { id: number; tema: string; fecha: string; course_uuid: string; curso: string }
  fuentes: FuentePizarra[]
  fuente: string
  anotaciones: DocPizarra | null
  guardada_at: string
  guardada_por: string
  publicada: Publicada | null
  admin: boolean
}

export interface ConNotas {
  semana_id: number
  at: string
  paginas: number
  por: string
}

const base = () => `${getAPIUrl()}pizarra`

async function pedir<T>(url: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData
  const res = await fetch(url, {
    method: metodo,
    headers: esForm ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: cuerpo === undefined ? undefined : esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  return datos as T
}

export const getPizarra = (semanaId: number, token: string) => pedir<Pizarra>(`${base()}/semana/${semanaId}`, token)

/** El PDF sobre el que se escribe, entero (va con la sesión). */
export async function bajarFuente(semanaId: number, fuente: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`${base()}/semana/${semanaId}/fuente/${encodeURIComponent(fuente)}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) {
    const datos = await res.json().catch(() => null)
    throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  }
  return res.arrayBuffer()
}

export const guardarNotas = (semanaId: number, fuente: string, doc: DocPizarra, token: string) =>
  pedir<{ guardada_at: string; guardada_por: string }>(`${base()}/semana/${semanaId}/notas`, token, 'PUT', { fuente, doc })

export function publicarPizarra(semanaId: number, pdf: Blob, paginas: number, token: string) {
  const f = new FormData()
  f.append('pdf', pdf, 'clase.pdf')
  f.append('paginas', String(paginas))
  return pedir<Publicada>(`${base()}/semana/${semanaId}/publicar`, token, 'POST', f)
}

export const quitarPublicada = (semanaId: number, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/semana/${semanaId}/publicada`, token, 'DELETE')

const curso = (uuid: string) => encodeURIComponent(String(uuid || '').replace(/^course_/, ''))

/** Qué semanas de esa clase tienen ya la presentación con notas. */
export const getConNotas = (courseUuid: string, token: string) =>
  pedir<{ semanas: ConNotas[] }>(`${base()}/course/${curso(courseUuid)}`, token)

/** La presentación con notas, como dirección que se puede abrir (va con la sesión). */
export async function urlPdfConNotas(semanaId: number, token: string): Promise<string> {
  const res = await fetch(`${base()}/semana/${semanaId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) {
    const datos = await res.json().catch(() => null)
    throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  }
  return URL.createObjectURL(await res.blob())
}
