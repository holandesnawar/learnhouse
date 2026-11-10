/**
 * El Estudio (10/11/2026): la pizarra del negocio y el banco de ideas.
 * La API está en apps/api/src/routers/estudio.py y la explicación entera en
 * apps/api/src/services/estudio/estudio.py.
 */
import { getAPIUrl } from '@services/config/config'

export interface ItemEstudio {
  id: number
  tipo: 'nota' | 'idea'
  area: string
  titulo: string
  texto: string
  formato: string
  objetivo: string
  estado: 'idea' | 'en-curso' | 'hecho'
  /** Dónde se publicó y qué día: {instagram: "2026-11-10"}. */
  canales: Record<string, string>
  fijada: boolean
  fecha: string
  autor_id: number
  autor: string
  created_at: string
  updated_at: string
}

export interface Opcion {
  id: string
  nombre: string
}

export interface EstudioDatos {
  items: ItemEstudio[]
  admin: boolean
  yo: number
  areas: Opcion[]
  formatos: Opcion[]
  objetivos: Opcion[]
  canales: Opcion[]
  estados: string[]
}

export type CambioItem = Partial<Pick<ItemEstudio, 'tipo' | 'area' | 'titulo' | 'texto' | 'formato' | 'objetivo' | 'estado' | 'fijada' | 'fecha'>> & {
  /** true = publicado hoy; false = se quita. */
  canales?: Record<string, boolean | string>
}

const base = () => `${getAPIUrl()}estudio`

async function pedir<T>(url: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  return datos as T
}

export const getEstudio = (orgId: number, token: string) => pedir<EstudioDatos>(`${base()}/org/${orgId}`, token)
export const crearItem = (orgId: number, datos: CambioItem, token: string) => pedir<ItemEstudio>(`${base()}/org/${orgId}/items`, token, 'POST', datos)
export const crearVarias = (orgId: number, datos: { texto: string; area?: string; formato?: string; objetivo?: string }, token: string) =>
  pedir<{ items: ItemEstudio[] }>(`${base()}/org/${orgId}/items/varias`, token, 'POST', datos)
export const cambiarItem = (orgId: number, id: number, datos: CambioItem, token: string) =>
  pedir<ItemEstudio>(`${base()}/org/${orgId}/items/${id}`, token, 'PUT', datos)
export const borrarItem = (orgId: number, id: number, token: string) => pedir<{ ok: boolean }>(`${base()}/org/${orgId}/items/${id}`, token, 'DELETE')
