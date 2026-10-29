/**
 * Salas en directo dentro de la escuela (Daily). La API está en
 * apps/api/src/routers/salas.py y la explicación entera en
 * apps/api/src/services/salas/salas.py.
 */
import { getAPIUrl } from '@services/config/config'

export interface EstadoSala {
  activo: boolean
  grabar: boolean
  curso: string
  /** Hay clave de Daily en Railway. */
  con_clave: boolean
  /** Quién está dentro ahora mismo. */
  presentes: string[]
  /** Administradores, moderadores y profes: entran como anfitrión. */
  equipo: boolean
  /** Solo administradores: encienden la sala y ven las grabaciones. */
  admin: boolean
}

export interface EntradaSala {
  url: string
  token: string
  nombre: string
  anfitrion: boolean
  grabando: boolean
  /** Si Daily no dejó grabar, por qué (su texto tal cual). */
  aviso: string
  curso: string
  /** El curso se graba (cuando entra el profe): se avisa también al alumno. */
  grabar: boolean
}

export interface Grabacion {
  id: string
  inicio: string
  duracion_seg: number
  estado: string
  personas: number
}

const base = (curso: string) => `${getAPIUrl()}salas/course/${encodeURIComponent(curso)}`

/** Pide a la API y, si falla, lanza el motivo que da el servidor tal cual. */
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

export const getSala = (curso: string, token: string) => pedir<EstadoSala>(base(curso), token)

export const entrarSala = (curso: string, token: string) =>
  pedir<EntradaSala>(`${base(curso)}/entrar`, token, 'POST', {})

export const guardarSala = (
  curso: string,
  cambios: { activo?: boolean; grabar?: boolean; grabadas?: boolean; etiqueta?: string },
  token: string
) => pedir<{ activo: boolean; grabar: boolean; grabadas?: boolean; etiqueta?: string }>(base(curso), token, 'PUT', cambios)

export const getGrabaciones = (curso: string, token: string) =>
  pedir<{ grabaciones: Grabacion[] }>(`${base(curso)}/grabaciones`, token)

export const enlaceGrabacion = (curso: string, id: string, token: string) =>
  pedir<{ url: string }>(`${base(curso)}/grabaciones/${encodeURIComponent(id)}/descarga`, token)

/** El recuadro de una clase en directo (día, hora, profe…), por curso. */
export const guardarRecuadro = (curso: string, recuadro: Record<string, string>, token: string) =>
  pedir<Record<string, string>>(`${base(curso)}/recuadro`, token, 'PUT', recuadro)

/** La dirección de la sala dentro de la escuela. */
export const rutaSala = (curso: string) => `/sala/${String(curso).replace(/^course_/, '')}`
