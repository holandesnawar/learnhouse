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
  /** De qué presentación salió (22/11/2026) y cómo se llamaba. */
  fuente?: string
  nombre?: string
  /** La misma presentación SIN lo escrito (25/11/2026, Spreek Club): el alumno elige. */
  limpia?: { paginas: number } | null
}

/** Las notas de una presentación: cuándo, quién y en cuántas páginas (null = no se sabe). */
export interface NotasDe {
  at: string
  por: string
  paginas: number | null
}

/**
 * Una presentación de la clase (22/11/2026). `id`: `profe:<id>` (un PDF del
 * equipo), `clase:<activity_uuid>` (el que ven los alumnos antes de la clase)
 * o `blanco` (la pizarra en blanco). Cada una guarda sus propias notas.
 */
export interface Presentacion {
  id: string
  de: 'equipo' | 'alumnos' | 'blanco'
  nombre: string
  por: string
  at: string
  tam: number
  /** Es la que se abre al pulsar «Pizarra». */
  en_pizarra: boolean
  notas: NotasDe | null
  /** De ella salió la versión que ven los alumnos después de la clase. */
  publicada: { at: string; por: string; paginas: number } | null
}

/** Notas de un documento que ya no está en la clase. */
export interface NotasSueltas {
  id: string
  nombre: string
  at: string
  por: string
  paginas: number | null
}

export interface ListaPresentaciones {
  presentaciones: Presentacion[]
  sueltas: NotasSueltas[]
  /** El id de la de la pizarra ('' si la clase no tiene ningún PDF). */
  fuente: string
  publicada: Publicada | null
}

export const PIZARRA_EN_BLANCO = 'blanco'

export interface Pizarra {
  semana: { id: number; tema: string; fecha: string; course_uuid: string; curso: string }
  fuentes: FuentePizarra[]
  /** La que se ha abierto (la pedida o la de la pizarra). */
  fuente: string
  /** Si en la abierta se puede escribir (unas notas sueltas, no). */
  escribible: boolean
  /** La de la pizarra ('' si la clase no tiene ningún PDF). */
  en_pizarra: string
  presentaciones: Presentacion[]
  sueltas: NotasSueltas[]
  anotaciones: DocPizarra | null
  guardada_at: string
  guardada_por: string
  /** Con qué versión de las notas se abrió: se manda de vuelta al guardar. */
  revision?: string
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

export async function getPizarra(semanaId: number, token: string, fuente?: string): Promise<Pizarra> {
  const p = await pedir<Pizarra>(`${base()}/semana/${semanaId}${fuente ? `?fuente=${encodeURIComponent(fuente)}` : ''}`, token)
  // Siempre con su forma, también si contesta una escuela a medio desplegar.
  return {
    ...p,
    fuentes: p.fuentes || [],
    presentaciones: p.presentaciones || [],
    sueltas: p.sueltas || [],
    en_pizarra: p.en_pizarra ?? p.fuente ?? '',
    escribible: p.escribible !== false,
  }
}

/** La lista de una pizarra ya leída. */
export const listaDe = (p: Pizarra): ListaPresentaciones => ({ presentaciones: p.presentaciones, sueltas: p.sueltas, fuente: p.en_pizarra, publicada: p.publicada })

/** Marca cuál es la de la pizarra: la que se abre al pulsar «Pizarra». */
export const ponerEnPizarra = (semanaId: number, fuente: string, token: string) =>
  pedir<ListaPresentaciones>(`${base()}/semana/${semanaId}/en-pizarra`, token, 'PUT', { fuente })

/** Pasa las notas de una presentación a otra (si la otra ya tiene, se juntan). */
export const pasarNotas = (semanaId: number, de: string, a: string, token: string) =>
  pedir<ListaPresentaciones & { pasadas: boolean }>(`${base()}/semana/${semanaId}/notas/pasar`, token, 'POST', { de, a })

/** Otra sesión de la misma clase (para pasarle una presentación). */
export interface OtraSesion {
  id: number
  tema: string
  fecha: string
}

/** Las demás sesiones de la misma clase, la más cercana primero. */
export const getSesiones = (semanaId: number, token: string) => pedir<{ sesiones: OtraSesion[] }>(`${base()}/semana/${semanaId}/sesiones`, token)

/**
 * Pasa una presentación del equipo, con lo escrito encima, a otra sesión de la
 * misma clase («se subió en la sesión que no era»). Devuelve cómo queda ESTA.
 */
export const pasarASesion = (semanaId: number, fuente: string, a: number, token: string) =>
  pedir<ListaPresentaciones & { pasada: { archivo: boolean; notas: boolean; en_pizarra: boolean }; a: OtraSesion }>(
    `${base()}/semana/${semanaId}/pasar-a-sesion`,
    token,
    'POST',
    { fuente, a }
  )

export const borrarNotas = (semanaId: number, fuente: string, token: string) =>
  pedir<ListaPresentaciones>(`${base()}/semana/${semanaId}/notas?fuente=${encodeURIComponent(fuente)}`, token, 'DELETE')

/** Baja el PDF original de una presentación con su nombre. */
export async function descargarFuente(semanaId: number, fuente: string, nombre: string, token: string) {
  const datos = await bajarFuente(semanaId, fuente, token)
  const url = URL.createObjectURL(new Blob([datos], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = /\.pdf$/i.test(nombre) ? nombre : `${nombre || 'Presentación'}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

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

/** Otra pizarra abierta (otra pestaña, otro ordenador) guardó en esa presentación después. */
export class OtraPizarra extends Error {
  por: string
  at: string
  constructor(por: string, at: string) {
    super('Alguien ha escrito en esta presentación desde otra pizarra abierta.')
    this.name = 'OtraPizarra'
    this.por = por
    this.at = at
  }
}

export interface AlGuardar {
  /** La revisión que esta pizarra tenía de la presentación ('' si la abrió sin notas). */
  base: string
  /** Un identificador al azar de ESTA pizarra abierta. */
  sesion: string
  /** Avisado del choque, guardar encima igualmente. */
  forzar?: boolean
}

/**
 * Guarda lo escrito en UNA presentación. Si otra pizarra abierta guardó en
 * ella después de lo que tiene esta, no pisa: lanza `OtraPizarra` (con quién
 * y cuándo) para que la pantalla avise y deje elegir.
 */
export async function guardarNotas(semanaId: number, fuente: string, doc: DocPizarra, token: string, control?: AlGuardar) {
  const res = await fetch(`${base()}/semana/${semanaId}/notas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(control ? { fuente, doc, base: control.base, sesion: control.sesion, forzar: !!control.forzar } : { fuente, doc }),
  })
  const datos = await res.json().catch(() => null)
  if (res.status === 409 && datos && datos.codigo === 'otra_pizarra') throw new OtraPizarra(String(datos.por || ''), String(datos.at || ''))
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  return datos as { guardada_at: string; guardada_por: string; paginas?: number; revision?: string }
}

/** El nombre con el que el EQUIPO ve la presentación de los alumnos (el alumno no lo ve). */
export const nombrarPresentacion = (semanaId: number, fuente: string, nombre: string, token: string) =>
  pedir<ListaPresentaciones>(`${base()}/semana/${semanaId}/nombre`, token, 'PUT', { fuente, nombre })

export function publicarPizarra(semanaId: number, pdf: Blob, paginas: number, token: string, fuente = '', limpia?: { pdf: Blob; paginas: number }) {
  const f = new FormData()
  f.append('pdf', pdf, 'clase.pdf')
  f.append('paginas', String(paginas))
  f.append('fuente', fuente)
  if (limpia) {
    f.append('limpia', limpia.pdf, 'sin-notas.pdf')
    f.append('paginas_limpia', String(limpia.paginas))
  }
  return pedir<Publicada>(`${base()}/semana/${semanaId}/publicar`, token, 'POST', f)
}

export const quitarPublicada = (semanaId: number, token: string) =>
  pedir<{ ok: boolean }>(`${base()}/semana/${semanaId}/publicada`, token, 'DELETE')

const curso = (uuid: string) => encodeURIComponent(String(uuid || '').replace(/^course_/, ''))

/** Qué semanas de esa clase tienen ya la presentación con notas. */
export const getConNotas = (courseUuid: string, token: string) =>
  pedir<{ semanas: ConNotas[] }>(`${base()}/course/${curso(courseUuid)}`, token)

/** La presentación con notas (o, con `limpia`, la misma sin notas), como dirección que se puede abrir (va con la sesión). */
export async function urlPdfConNotas(semanaId: number, token: string, limpia = false): Promise<string> {
  const res = await fetch(`${base()}/semana/${semanaId}/pdf${limpia ? '?limpia=1' : ''}`, {
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

// ── La presentación en su propia página (22/11/2026) ───────────────────────

/** De qué clase es una semana (quien ve la clase). */
export interface ClaseDeSemana {
  id: number
  tema: string
  fecha: string
  course_uuid: string
  curso: string
  equipo: boolean
}

export const getClaseDeSemana = (semanaId: number, token: string) => pedir<ClaseDeSemana>(`${base()}/semana/${semanaId}/clase`, token)

async function comoDireccion(url: string, token: string): Promise<string> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', cache: 'no-store' })
  if (!res.ok) {
    const datos = await res.json().catch(() => null)
    throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  }
  return URL.createObjectURL(await res.blob())
}

/** El PDF que los alumnos ven antes de la clase, como dirección que se puede abrir. */
export const urlPdfAntes = (semanaId: number, token: string, actividad = '') =>
  comoDireccion(`${base()}/semana/${semanaId}/antes${actividad ? `?actividad=${encodeURIComponent(actividad)}` : ''}`, token)

/** Una presentación de la clase (equipo), como dirección que se puede abrir. */
export const urlPdfFuente = (semanaId: number, fuente: string, token: string) =>
  comoDireccion(`${base()}/semana/${semanaId}/fuente/${encodeURIComponent(fuente)}`, token)
