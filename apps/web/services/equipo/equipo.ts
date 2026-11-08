/**
 * La sala de profes (08/11/2026): el equipo, su tablero de tareas y el manual.
 * La API está en apps/api/src/routers/equipo.py y la explicación entera en
 * apps/api/src/services/equipo/equipo.py.
 */
import { getAPIUrl } from '@services/config/config'

export type EstadoTareaEquipo = 'por-hacer' | 'en-curso' | 'hecho'

export interface Miembro {
  id: number
  nombre: string
  rol: string
  avatar: string
}

export interface TareaEquipo {
  id: number
  titulo: string
  notas: string
  estado: EstadoTareaEquipo
  prioridad: 'normal' | 'alta'
  fecha: string
  asignado_id: number
  asignado: string
  course_uuid: string
  orden: number
  creado_por_id: number
  creado_por: string
  created_at: string
  updated_at: string
  done_at: string
}

export interface DocManual {
  id: number
  titulo: string
  seccion: string
  texto: string
  orden: number
  creado_por: string
  actualizado_por: string
  created_at: string
  updated_at: string
}

export interface SalaProfesDatos {
  yo: { id: number; admin: boolean }
  miembros: Miembro[]
  tareas: TareaEquipo[]
  manual: DocManual[]
}

const base = () => `${getAPIUrl()}equipo`

async function pedir<T>(url: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`
    throw new Error(detalle)
  }
  return datos as T
}

export const getSalaProfes = (orgId: number, token: string) => pedir<SalaProfesDatos>(`${base()}/org/${orgId}`, token)

export type CambioTarea = Partial<Pick<TareaEquipo, 'titulo' | 'notas' | 'estado' | 'prioridad' | 'fecha' | 'asignado_id' | 'course_uuid' | 'orden'>>

export const crearTareaEquipo = (orgId: number, datos: CambioTarea, token: string) =>
  pedir<TareaEquipo>(`${base()}/org/${orgId}/tareas`, token, 'POST', datos)
export const cambiarTareaEquipo = (orgId: number, id: number, datos: CambioTarea, token: string) =>
  pedir<TareaEquipo>(`${base()}/org/${orgId}/tareas/${id}`, token, 'PUT', datos)
export const borrarTareaEquipo = (orgId: number, id: number, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/org/${orgId}/tareas/${id}`, token, 'DELETE')

export type CambioDoc = Partial<Pick<DocManual, 'titulo' | 'seccion' | 'texto' | 'orden'>>

export const crearDoc = (orgId: number, datos: CambioDoc, token: string) => pedir<DocManual>(`${base()}/org/${orgId}/manual`, token, 'POST', datos)
export const cambiarDoc = (orgId: number, id: number, datos: CambioDoc, token: string) =>
  pedir<DocManual>(`${base()}/org/${orgId}/manual/${id}`, token, 'PUT', datos)
export const borrarDoc = (orgId: number, id: number, token: string) => pedir<{ ok: boolean }>(`${base()}/org/${orgId}/manual/${id}`, token, 'DELETE')
export const plantillaManual = (orgId: number, token: string) =>
  pedir<{ manual: DocManual[] }>(`${base()}/org/${orgId}/manual/plantilla`, token, 'POST', {})
