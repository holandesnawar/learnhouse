/**
 * Reseñas en vídeo de los alumnos (10/11/2026). La API está en
 * apps/api/src/routers/resenas.py y la explicación entera en
 * apps/api/src/services/resenas/resenas.py.
 *
 * - El alumno: `getMiResena`, `mandarResena` (con progreso de la subida) y
 *   `miVideo`.
 * - El panel (solo administradores): el resto.
 *
 * Los vídeos son privados: se piden con la sesión y se pintan desde una
 * dirección local del navegador (como las notas de voz de las tareas).
 */
import { getAPIUrl } from '@services/config/config'
import type { EstadoResena } from '@/lib/nawar/resenas'

export type { EstadoResena }

export interface Resena {
  id: number
  user_id: number
  nombre: string
  estado: EstadoResena
  tiene_video: boolean
  video_seg: number
  video_bytes: number
  video_mime: string
  texto: string
  permiso: boolean
  permiso_texto: string
  permiso_at: string
  usos: string[]
  mensaje: string
  invitada_at: string
  grabada_at: string
  regalo: string
  regalo_dado_at: string
  plazo: { hasta: string; quedan: number | null }
}

/** Lo que además ve el administrador. */
export interface ResenaPanel extends Resena {
  invitada_por: string
  revisada_at: string
  revisada_por: string
  nota: string
  /** La invitación para WhatsApp, ya escrita. */
  whatsapp: string
}

export interface Uso {
  id: string
  nombre: string
}

export interface MiResena {
  resena: Resena | null
  preguntas: string[]
  consejos: string[]
  permiso_texto: string
  usos: Uso[]
  plazo_dias: number
  max_mb: number
}

export interface CifrasResenas {
  invitadas: number
  por_revisar: number
  aprobadas: number
  descartadas: number
  regalos_por_dar: number
  total: number
}

export interface ResenasPanelDatos {
  resenas: ResenaPanel[]
  cifras: CifrasResenas
  tope: number
  plazo_dias: number
  /** El regalo y el mensaje que se proponen al invitar. */
  regalo: string
  mensaje: string
  enlace: string
  usos: Uso[]
}

export interface AlumnoInvitable {
  user_id: number
  nombre: string
  email: string
  entro: string
  dias: number | null
  hechas: number
  total: number
  pct: number
  /** '' si no tiene reseña; si no, su estado. */
  resena: EstadoResena | ''
}

const base = () => `${getAPIUrl()}resenas`

function motivo(datos: any, status: number): string {
  if (datos && typeof datos.detail === 'string') return datos.detail
  if (status === 413) return 'El vídeo pesa demasiado. Grábalo más corto.'
  return `Error ${status}`
}

async function pedir<T>(url: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(motivo(datos, res.status))
  return datos as T
}

async function comoBlob(url: string, token: string): Promise<Blob> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', cache: 'no-store' })
  if (!res.ok) {
    const datos = await res.json().catch(() => null)
    throw new Error(motivo(datos, res.status))
  }
  return res.blob()
}

// ── El alumno ───────────────────────────────────────────────────────────────

export const getMiResena = (token: string) => pedir<MiResena>(`${base()}/mia`, token)

/** Mi propio vídeo, como dirección local del navegador (hay que soltarla con `URL.revokeObjectURL`). */
export async function miVideo(token: string): Promise<string> {
  return URL.createObjectURL(await comoBlob(`${base()}/mia/video`, token))
}

/**
 * Manda el vídeo. Va con XMLHttpRequest y no con fetch porque fetch no dice
 * cuánto lleva subido, y un vídeo de 60 MB por el móvil tarda: sin la barra
 * parece que se ha quedado colgado. `alAvanzar` recibe de 0 a 100.
 */
export function mandarResena(
  datos: { video: Blob; nombre: string; texto: string; usos: string[]; segundos: number },
  token: string,
  alAvanzar?: (pct: number) => void
): { promesa: Promise<MiResena>; cancelar: () => void } {
  const xhr = new XMLHttpRequest()
  const promesa = new Promise<MiResena>((resolver, rechazar) => {
    const f = new FormData()
    f.append('video', datos.video, datos.nombre)
    f.append('texto', datos.texto || '')
    f.append('permiso', 'true')
    f.append('usos', datos.usos.join(','))
    f.append('segundos', String(Math.round(datos.segundos || 0)))
    xhr.open('POST', `${base()}/mia`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && alAvanzar) alAvanzar(Math.min(99, Math.round((e.loaded * 100) / e.total)))
    }
    xhr.onload = () => {
      let cuerpo: any = null
      try {
        cuerpo = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && cuerpo) {
        alAvanzar?.(100)
        resolver(cuerpo as MiResena)
      } else rechazar(new Error(motivo(cuerpo, xhr.status)))
    }
    xhr.onerror = () => rechazar(new Error('Se cortó la conexión mientras se subía. Prueba otra vez, mejor con wifi.'))
    xhr.onabort = () => rechazar(new Error('Subida cancelada'))
    xhr.send(f)
  })
  return { promesa, cancelar: () => xhr.abort() }
}

// ── El panel (administradores) ──────────────────────────────────────────────

export const getResenas = (orgId: number, token: string) => pedir<ResenasPanelDatos>(`${base()}/org/${orgId}`, token)

export const getInvitables = (orgId: number, token: string) =>
  pedir<{ alumnos: AlumnoInvitable[]; tope: number }>(`${base()}/org/${orgId}/alumnos`, token)

export const invitarAlumnos = (orgId: number, datos: { user_ids: number[]; mensaje: string; regalo: string }, token: string) =>
  pedir<ResenasPanelDatos & { nuevas: number; repetidas: number }>(`${base()}/org/${orgId}/invitar`, token, 'POST', datos)

/** `pendiente` la devuelve a «por revisar» (o a «invitada» si no hay vídeo). */
export const revisarResena = (orgId: number, id: number, estado: 'aprobada' | 'descartada' | 'pendiente', token: string) =>
  pedir<ResenaPanel>(`${base()}/org/${orgId}/${id}/estado`, token, 'PUT', { estado })

export const cambiarResena = (orgId: number, id: number, datos: { nota?: string; regalo?: string; regalo_dado?: boolean }, token: string) =>
  pedir<ResenaPanel>(`${base()}/org/${orgId}/${id}`, token, 'PUT', datos)

export const borrarResena = (orgId: number, id: number, token: string) => pedir<{ ok: boolean }>(`${base()}/org/${orgId}/${id}`, token, 'DELETE')

/** El vídeo de una reseña, como dirección local del navegador. */
export async function videoResena(orgId: number, id: number, token: string): Promise<string> {
  return URL.createObjectURL(await comoBlob(`${base()}/org/${orgId}/${id}/video`, token))
}

/** Baja el vídeo al ordenador con su nombre («Resena-Marta.mp4»). */
export async function bajarVideo(orgId: number, id: number, nombre: string, token: string): Promise<void> {
  const blob = await comoBlob(`${base()}/org/${orgId}/${id}/video?bajar=1`, token)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
