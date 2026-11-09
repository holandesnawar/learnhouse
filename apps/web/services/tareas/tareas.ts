/**
 * Las semanas de las clases en directo, su tarea y el seguimiento (28/10/2026).
 * La API está en apps/api/src/routers/tareas.py y la explicación entera en
 * apps/api/src/services/tareas/tareas.py.
 */
import { getAPIUrl } from '@services/config/config'

export type TipoClase = 'presentacion' | 'grabacion' | 'ejercicios' | 'otra'
export type EstadoTarea = 'sin-tarea' | 'pendiente' | 'entregada' | 'corregida' | 'antes-de-entrar'

export interface ClaseSemana {
  activity_uuid: string
  nombre: string
  tipo: TipoClase
  hecha: boolean
  /** Una grabación de los meses de antes colocada en su semana (06/11/2026). */
  suelta?: boolean
  fecha?: string
  tema?: string
  profe?: string
}

/** Una grabación de los meses de antes sin semana: sale como una clase más. */
export interface ClaseArchivo extends ClaseSemana {
  fecha: string
  tema: string
  profe: string
}

/** La otra clase con el mismo nombre (el otro grupo), para el equipo. */
export interface Hermana {
  id: number
  org_id: number
  course_uuid: string
  nombre: string
  /** «jueves»: el día en que más se da. */
  dia: string
  weekday: string
}

export interface VideoGrabacion {
  tipo: 'bunny' | 'youtube' | 'vimeo' | 'archivo'
  url: string
}

export interface MiraTambien {
  clases: {
    course_uuid: string
    dia: string
    profe: string
    grabaciones: { tema: string; fecha: string; activity_uuid: string; nombre: string; video: VideoGrabacion }[]
  }[]
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
  /** Las casillas de la campana (05/11/2026): avisar a los alumnos de la clase. */
  avisar_presentacion?: boolean
  avisar_grabacion?: boolean
  /** false = la clase aún no ha llegado: el alumno solo ve la presentación. */
  abierta?: boolean
  /** Cuántas clases se le abrirán al alumno el día de la clase (ejercicios…). */
  ocultas?: number
  clases?: ClaseSemana[]
  tarea?: { estado: EstadoTarea; corregida_at: string; vista: boolean }
  /** Solo al equipo: si ya se pasó la lista y cuántos vinieron (07/11/2026). */
  lista?: { pasada: boolean; vinieron: number }
  /** «¿Vienes a la clase?» de quien pregunta: true, false o sin contestar. */
  voy?: boolean | null
  /** Esa semana va a la clase del otro grupo (08/11/2026, solo al alumno). */
  cambio?: { semana_id: number; course_uuid: string; curso: string; fecha: string; dia: string } | null
  /** Solo al equipo: cuántos dijeron que vienen y cuántos que no. */
  confirmaciones?: { si: number; no: number }
  /** Solo al equipo (09/11/2026): la presentación completa y las notas para el profe. */
  material_profe?: MaterialProfe
}

export interface ArchivoProfe {
  id: string
  tipo: 'archivo' | 'enlace'
  nombre: string
  url?: string
  tam?: number
  por: string
  at: string
}

export interface MensajeProfe {
  texto: string
  por: string
  at: string
  leido_por: string
  leido_at: string
}

export interface MaterialProfe {
  notas: string
  archivos: ArchivoProfe[]
  /** Quién da ESA semana (por encima del «La da» de la clase). Solo lo pone un administrador. */
  profe?: string
  /** El mensaje del administrador para el profe de esa semana. */
  mensaje?: MensajeProfe | null
}

export interface SemanasClase {
  hoy: string
  actual: number | null
  proxima: number | null
  semanas: Semana[]
  /** Las grabaciones de antes que no tienen semana (06/11/2026). */
  archivo?: ClaseArchivo[]
  /** Solo al equipo: la otra clase con el mismo nombre. */
  hermanas?: Hermana[]
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
  /** null = esa semana aún no tiene grabación (06/11/2026). */
  grabacion?: boolean | null
  /** null = no se sabe (ni lista pasada ni sala de la escuela). */
  clase: boolean | null
  /** De dónde sale «clase»: la lista del profe o la sala de Daily (07/11/2026). */
  clase_origen?: 'lista' | 'sala' | ''
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
    grabacion?: number
    con_grabacion?: boolean
    clase: number
    sabe_clase: boolean
    ejercicios: number
    con_ejercicios: boolean
    entregadas: number
    por_corregir: number
    con_tarea: boolean
  } | null
  aviso: string
  lista_pasada?: boolean
  lista_por?: string[]
}

/** La lista de una clase, para marcar quién vino (07/11/2026). */
export interface ListaClase {
  semana: { id: number; tema: string; fecha: string }
  /** Solo el día de la clase o después. */
  se_puede: boolean
  alumnos: {
    user_id: number
    nombre: string
    fue: boolean | null
    en_sala: boolean | null
    voy?: boolean | null
    /** Viene esta semana de la otra clase («martes 10 nov»). */
    viene_de?: string
    /** Esta semana va a la clase del otro grupo. */
    va_a_otra?: boolean
  }[]
  pasada: boolean
  por: string
  at: string
  vinieron: number
  sala_conocida: boolean
}

export const confirmarVoy = (semanaId: number, va: boolean | null, token: string) =>
  pedir<{ voy: boolean | null; si: number; no: number }>(`${base()}/semana/${semanaId}/voy`, token, 'PUT', { va })

export const getLista = (semanaId: number, token: string) => pedir<ListaClase>(`${base()}/semana/${semanaId}/lista`, token)
export const pasarLista = (semanaId: number, marcas: Record<string, boolean | null>, token: string) =>
  pedir<ListaClase>(`${base()}/semana/${semanaId}/lista`, token, 'PUT', { marcas })

/** «Tu grupo esta semana»: por dónde va, qué falla, sus consultas (07/11/2026). */
export interface GrupoClase {
  alumnos: number
  mayoria: { modulo: string; n: number; clase: string } | null
  detras: { nombre: string; modulo: string; clase?: string }[]
  delante: { nombre: string; modulo: string }[]
  fallos: { palabra: string; alumnos: number }[]
  nuevos: { nombre: string; entro: string }[]
  sin_entrar: { nombre: string; dias: number | null }[]
  consultas: { titulo: string; texto: string; nombre: string; fecha: string; respondida: boolean }[]
  aviso_consultas: string
  hoy: string
}

export const getGrupo = (orgId: number, courseUuid: string, token: string) =>
  pedir<GrupoClase>(`${base()}/org/${orgId}/grupo?course_uuid=${encodeURIComponent(courseUuid)}`, token)

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

export const getMiraTambien = (courseUuid: string, token: string) =>
  pedir<MiraTambien>(`${base()}/course/${curso(courseUuid)}/mira-tambien`, token)

/** El vídeo subido de una grabación de la otra clase (va con la sesión). */
export const urlVideoHermana = (courseUuid: string, activityUuid: string) =>
  `${base()}/course/${curso(courseUuid)}/mira-tambien/${encodeURIComponent(activityUuid)}/video`

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
  avisar_presentacion?: boolean
  avisar_grabacion?: boolean
}

export const crearSemana = (courseUuid: string, datos: DatosSemana, token: string) =>
  pedir<{ ok: boolean; semana: Semana }>(`${base()}/course/${curso(courseUuid)}/semanas`, token, 'POST', datos)

export const editarSemana = (id: number, datos: DatosSemana, token: string) =>
  pedir<{ ok: boolean; semana: Semana }>(`${base()}/semana/${id}`, token, 'PUT', datos)

export const borrarSemana = (id: number, token: string) =>
  pedir<{ ok: boolean; entregas_borradas: number }>(`${base()}/semana/${id}`, token, 'DELETE')

// ── El material del profe (09/11/2026) ──────────────────────────────────────

export const guardarNotasProfe = (semanaId: number, notas: string, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/notas`, token, 'PUT', { notas })

export const quienProfe = (semanaId: number, profe: string, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/quien`, token, 'PUT', { profe })

export const mensajeProfe = (semanaId: number, mensaje: string, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/mensaje`, token, 'PUT', { mensaje })

export const mensajeLeido = (semanaId: number, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/mensaje/leido`, token, 'POST')

export const enlaceProfe = (semanaId: number, nombre: string, url: string, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/enlace`, token, 'POST', { nombre, url })

export function subirArchivoProfe(semanaId: number, archivo: File, token: string) {
  const f = new FormData()
  f.append('archivo', archivo, archivo.name)
  return pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/archivo`, token, 'POST', f)
}

export const quitarProfe = (semanaId: number, id: string, token: string) =>
  pedir<MaterialProfe>(`${base()}/semana/${semanaId}/profe/${encodeURIComponent(id)}`, token, 'DELETE')

/** Abre un archivo del material del profe (va con la sesión: no es público). */
export async function abrirArchivoProfe(semanaId: number, a: ArchivoProfe, token: string) {
  if (a.tipo === 'enlace' && a.url) {
    window.open(a.url, '_blank', 'noopener')
    return
  }
  // La pestaña se abre YA (con el clic), si no el navegador la bloquea.
  const ventana = window.open('', '_blank')
  try {
    const res = await fetch(`${base()}/semana/${semanaId}/profe/${encodeURIComponent(a.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(res.status === 404 ? 'Ese archivo ya no está' : `Error ${res.status}`)
    const url = URL.createObjectURL(await res.blob())
    const pdf = /\.pdf$/i.test(a.nombre)
    if (pdf && ventana) ventana.location.href = url
    else {
      ventana?.close()
      const link = document.createElement('a')
      link.href = url
      link.download = a.nombre
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    ventana?.close()
    throw e
  }
}

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

// ── Avisar a la clase (06/11/2026) ─────────────────────────────────────────

export interface Destinatarios {
  filtros: { id: string; nombre: string; alumnos: { user_id: number; nombre: string }[] }[]
  avisos: { id: string; titulo: string; texto: string; filtro: string; at: string; por: string; campana: boolean; correos: number; alumnos: number }[]
}

export const getDestinatarios = (semanaId: number, token: string) =>
  pedir<Destinatarios>(`${base()}/semana/${semanaId}/destinatarios`, token)

export const avisarClase = (
  semanaId: number,
  datos: { filtro: string; titulo: string; texto: string; campana: boolean; correo: boolean; prueba?: boolean },
  token: string
) => pedir<{ ok: boolean; prueba?: boolean; a?: string; alumnos?: number; correos?: number }>(`${base()}/semana/${semanaId}/avisar`, token, 'POST', datos)

export interface ResumenClase {
  course_uuid: string
  nombre: string
  semana: { id: number; tema: string; fecha: string; limite: string; tiene_tarea: boolean }
  cifras: NonNullable<Seguimiento['cifras']>
}

export const getResumenClases = (orgId: number, token: string) =>
  pedir<{ clases: ResumenClase[] }>(`${base()}/org/${orgId}/resumen-clases`, token)

/** «lunes 3 nov» a partir de AAAA-MM-DD (sin desfases de zona: es un día, no un instante). */
export function diaCorto(dia: string): string {
  if (!dia || dia.length < 10) return dia || ''
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d, 12))
  return f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '').replace(',', '')
}
