/**
 * Las semanas de las clases en directo, su tarea y el seguimiento (28/10/2026).
 * La API está en apps/api/src/routers/tareas.py y la explicación entera en
 * apps/api/src/services/tareas/tareas.py.
 */
import { getAPIUrl } from '@services/config/config'

export type TipoClase = 'presentacion' | 'grabacion' | 'ejercicios' | 'otra'
export type EstadoTarea = 'sin-tarea' | 'pendiente' | 'entregada' | 'corregida'

export interface ClaseSemana {
  activity_uuid: string
  nombre: string
  tipo: TipoClase
  hecha: boolean
}

export interface Semana {
  id: number
  course_uuid: string
  chapter_uuid: string
  tema: string
  /** Día de la clase (AAAA-MM-DD). */
  fecha: string
  fecha_limite: string
  /** Último día para entregar (el puesto o el domingo de esa semana). */
  limite: string
  enunciado: string
  tiene_tarea: boolean
  clases?: ClaseSemana[]
  tarea?: { estado: EstadoTarea; corregida_at: string; vista: boolean }
}

export interface SemanasClase {
  hoy: string
  actual: number | null
  proxima: number | null
  semanas: Semana[]
  equipo: boolean
  admin: boolean
}

export interface Entrega {
  id: number
  texto: string
  tiene_audio: boolean
  audio_seg: number
  entregada_at: string
  actualizada_at: string
  estado: 'entregada' | 'corregida'
  correccion_texto: string
  tiene_correccion_audio: boolean
  correccion_audio_seg: number
  corregida_por: string
  corregida_at: string
  vista_at: string
}

export interface TareaDetalle extends Semana {
  curso: string
  entrega: Entrega | null
  equipo: boolean
  admin: boolean
}

export interface MiSemana {
  clases: { course_uuid: string; curso: string; proxima: boolean; semana: Semana }[]
  corregidas: {
    tarea_id: number
    tema: string
    corregida_por: string
    corregida_at: string
    tiene_audio: boolean
    audio_seg: number
    entrega_id: number
  }[]
}

export interface FilaSeguimiento {
  user_id: number
  nombre: string
  email: string
  grupos: string[]
  /** null = esa semana no tiene presentación. */
  presentacion: boolean | null
  /** null = no se sabe (la clase no es en la sala de la escuela). */
  clase: boolean | null
  ejercicios: { hechos: number; total: number }
  tarea: EstadoTarea
  entrega_id: number | null
  seguidas: number
  sin_nada: number
}

export interface Seguimiento {
  curso: string
  course_uuid: string
  hoy: string
  semanas: { id: number; tema: string; fecha: string }[]
  actual?: number | null
  semana: Semana | null
  alumnos: FilaSeguimiento[]
  cifras: {
    alumnos: number
    presentacion: number
    con_presentacion: boolean
    clase: number
    sabe_clase: boolean
    ejercicios: number
    con_ejercicios: boolean
    entregadas: number
    por_corregir: number
    con_tarea: boolean
  } | null
  aviso: string
}

export interface PorCorregir {
  entrega: Entrega
  tarea_id: number
  tema: string
  enunciado: string
  fecha: string
  curso?: string
  course_uuid?: string
  user_id: number
  nombre: string
}

export interface CheckinToca {
  user_id: number
  nombre: string
  email: string
  telefono: string
  semana: number
  hito: number
  atrasado: boolean
  ultimo: { cuando: string; hito: number; autor: string; nota: string } | null
}

const base = () => `${getAPIUrl()}tareas`

/** Pide a la API y, si falla, lanza el motivo que da el servidor tal cual. */
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
  if (!res.ok) {
    const detalle = datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`
    throw new Error(detalle)
  }
  return datos as T
}

const curso = (uuid: string) => encodeURIComponent(String(uuid || '').replace(/^course_/, ''))

export const getSemanas = (courseUuid: string, token: string) =>
  pedir<SemanasClase>(`${base()}/course/${curso(courseUuid)}/semanas`, token)

export const getMiSemana = (orgId: number, token: string) => pedir<MiSemana>(`${base()}/mi-semana?org_id=${orgId}`, token)

export const getTarea = (id: number | string, token: string) => pedir<TareaDetalle>(`${base()}/tarea/${id}`, token)

export function entregarTarea(
  id: number,
  datos: { texto: string; audio?: Blob | null; audioSeg?: number; quitarAudio?: boolean },
  token: string
) {
  const f = new FormData()
  f.append('texto', datos.texto || '')
  f.append('audio_seg', String(datos.audioSeg || 0))
  f.append('quitar_audio', datos.quitarAudio ? 'true' : 'false')
  if (datos.audio) f.append('audio', datos.audio, nombreAudio(datos.audio))
  return pedir<{ ok: boolean; entrega: Entrega }>(`${base()}/tarea/${id}/entrega`, token, 'POST', f)
}

export const marcarVista = (id: number, token: string) => pedir<{ ok: boolean }>(`${base()}/tarea/${id}/vista`, token, 'POST', {})

/** La extensión según lo que grabó el navegador (Safari graba mp4, Chrome webm). */
function nombreAudio(b: Blob): string {
  const t = (b.type || '').toLowerCase()
  if (t.includes('mp4') || t.includes('aac')) return 'nota.m4a'
  if (t.includes('ogg')) return 'nota.ogg'
  if (t.includes('mpeg')) return 'nota.mp3'
  return 'nota.webm'
}

/** La nota de voz de una entrega, como dirección local para <audio> (va con la sesión: no es pública). */
export async function audioEntrega(entregaId: number, cual: 'alumno' | 'correccion', token: string): Promise<string> {
  const res = await fetch(`${base()}/audio/${entregaId}/${cual}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(res.status === 404 ? 'No hay nota de voz' : `Error ${res.status}`)
  return URL.createObjectURL(await res.blob())
}

// ── Semanas (administradores) ───────────────────────────────────────────────

export interface DatosSemana {
  chapter_uuid?: string
  tema?: string
  fecha?: string
  enunciado?: string
  fecha_limite?: string
}

export const crearSemana = (courseUuid: string, datos: DatosSemana, token: string) =>
  pedir<{ ok: boolean; semana: Semana }>(`${base()}/course/${curso(courseUuid)}/semanas`, token, 'POST', datos)

export const editarSemana = (id: number, datos: DatosSemana, token: string) =>
  pedir<{ ok: boolean; semana: Semana }>(`${base()}/semana/${id}`, token, 'PUT', datos)

export const borrarSemana = (id: number, token: string) =>
  pedir<{ ok: boolean; entregas_borradas: number }>(`${base()}/semana/${id}`, token, 'DELETE')

// ── El equipo ───────────────────────────────────────────────────────────────

export const getClasesEnDirecto = (orgId: number, token: string) =>
  pedir<{ clases: { uuid: string; nombre: string }[]; admin: boolean }>(`${base()}/org/${orgId}/clases`, token)

export const getSeguimiento = (orgId: number, courseUuid: string, semanaId: number | null, token: string) =>
  pedir<Seguimiento>(
    `${base()}/org/${orgId}/seguimiento?course_uuid=${curso(courseUuid)}${semanaId ? `&semana_id=${semanaId}` : ''}`,
    token
  )

export const getPorCorregir = (orgId: number, token: string) =>
  pedir<{ entregas: PorCorregir[] }>(`${base()}/org/${orgId}/por-corregir`, token)

export const getEntrega = (entregaId: number, token: string) => pedir<PorCorregir>(`${base()}/entrega/${entregaId}`, token)

export function corregirEntrega(entregaId: number, datos: { texto: string; audio?: Blob | null; audioSeg?: number }, token: string) {
  const f = new FormData()
  f.append('texto', datos.texto || '')
  f.append('audio_seg', String(datos.audioSeg || 0))
  if (datos.audio) f.append('audio', datos.audio, nombreAudio(datos.audio))
  return pedir<{ ok: boolean; entrega: Entrega }>(`${base()}/entrega/${entregaId}/correccion`, token, 'POST', f)
}

export const reabrirEntrega = (entregaId: number, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/entrega/${entregaId}/correccion`, token, 'DELETE')

export const getCheckins = (orgId: number, token: string) =>
  pedir<{ hitos: number[]; toca: CheckinToca[] }>(`${base()}/org/${orgId}/checkins`, token)

export const marcarCheckin = (orgId: number, datos: { user_id: number; hito: number; nota: string }, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/org/${orgId}/checkins`, token, 'POST', datos)

/** «lunes 3 nov» a partir de AAAA-MM-DD (sin desfases de zona: es un día, no un instante). */
export function diaCorto(dia: string): string {
  if (!dia || dia.length < 10) return dia || ''
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d, 12))
  return f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '').replace(',', '')
}
