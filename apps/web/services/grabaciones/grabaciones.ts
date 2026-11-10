/**
 * Las grabaciones de la sala: por día, recortadas y publicadas en su semana
 * (10/11/2026). La API está en apps/api/src/routers/grabaciones.py y la
 * explicación entera en apps/api/src/services/salas/estudio_grabaciones.py.
 */
import { getAPIUrl } from '@services/config/config'
import type { Parte, Trozo } from '@/lib/nawar/recorte'

export type { Parte, Trozo }

/** Lo publicado en una semana, tal como lo da la semana (`grabacion_sala`). */
export interface GrabacionSala {
  partes: Parte[]
  titulo: string
  /** Lo que dura lo que se ve. */
  segundos: number
  /** Si quien pregunta ya la vio. */
  vista: boolean
  /** Solo al equipo. */
  publicada_at?: string
  por?: string
  /** Solo al equipo: cuántos alumnos la han visto. */
  vistas?: number
}

/** Una grabación de Daily de un día (si la sala cortó, hay varias). */
export interface ParteGrabada {
  id: string
  inicio: string
  /** Hora de Países Bajos, «19:00». */
  hora: string
  dur: number
  estado: string
  /** Terminada y con duración: ya se puede publicar. */
  lista: boolean
  personas: number
  /** Si está publicada, con qué recorte. */
  trozos: Trozo[] | null
}

export interface DiaGrabado {
  dia: string
  partes: ParteGrabada[]
  dur: number
  semana: { id: number; tema: string; fecha: string } | null
  publicada: { semana_id: number; tema: string; fecha: string; segundos: number } | null
}

export interface SemanaDelEstudio {
  id: number
  tema: string
  fecha: string
  grabacion_sala: GrabacionSala | null
  /** Ya tiene una grabación subida a mano como clase del curso. */
  subida: boolean
}

export interface Estudio {
  curso: string
  course_uuid: string
  dias: DiaGrabado[]
  semanas: SemanaDelEstudio[]
  aviso: string
}

const base = () => `${getAPIUrl()}grabaciones`
const sin = (uuid: string) => encodeURIComponent(String(uuid || '').replace(/^course_/, ''))

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

export const getEstudio = (courseUuid: string, token: string) => pedir<Estudio>(`${base()}/course/${sin(courseUuid)}`, token)

/**
 * La dirección del vídeo de una grabación (va con la sesión; la escuela
 * redirige a un enlace fresco de Daily). `intento` > 0 pide uno nuevo: el
 * reproductor lo usa cuando el que tenía dejó de servir.
 */
export const urlVideoSala = (courseUuid: string, grabacionId: string, intento = 0) =>
  `${base()}/video/${encodeURIComponent(grabacionId)}?course=${sin(courseUuid)}${intento ? `&fresco=${intento}` : ''}`

export const publicarGrabacion = (
  semanaId: number,
  datos: { partes: { id: string; trozos: Trozo[] }[]; titulo?: string },
  token: string
) => pedir<GrabacionSala>(`${base()}/semana/${semanaId}`, token, 'PUT', datos)

export const quitarGrabacion = (semanaId: number, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/semana/${semanaId}`, token, 'DELETE')

export const marcarVista = (semanaId: number, token: string) =>
  pedir<{ ok: boolean; vista: boolean }>(`${base()}/semana/${semanaId}/vista`, token, 'POST')
