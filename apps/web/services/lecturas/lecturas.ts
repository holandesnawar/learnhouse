'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import type { EjercicioLectura } from '@lib/nawar/ejerciciosLectura'

/** La lectura semanal (servidor: `services/lecturas/lecturas.py`). */

export interface Palabra {
  nl: string
  es: string
  ejemplo: string
}

export interface Lectura {
  id: string
  /** El lunes de su semana (AAAA-MM-DD). */
  semana: string
  titulo: string
  titulo_es?: string
  hoja?: { url: string; name: string; size: number }
  texto?: string
  traduccion?: string
  palabras?: Palabra[]
  video?: string
  comunidad?: string
  /** Ejercicios sobre el texto, que se hacen en la escuela. */
  ejercicios?: EjercicioLectura[]
  creada?: string
  por?: string
}

export interface MisLecturas {
  actual: Lectura | null
  archivo: Lectura[]
  /** Las de semanas que aún no han llegado: solo el equipo. */
  proximas: Lectura[]
  equipo: boolean
  org_id: number
}

const base = () => `${getAPIUrl()}lecturas`

async function json<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error((d && (d.detail || d.message)) || `Error ${r.status}`)
  return d as T
}

export async function getLecturas(accessToken: string): Promise<MisLecturas | null> {
  try {
    const r = await fetch(`${base()}/`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export type DatosLectura = Partial<Omit<Lectura, 'palabras' | 'hoja' | 'id'>> & { palabras?: string | Palabra[] }

export async function crearLectura(orgId: number, datos: DatosLectura, accessToken: string): Promise<Lectura> {
  return json(await fetch(`${base()}/org/${orgId}`, RequestBodyWithAuthHeader('POST', datos, null, accessToken)))
}

export async function editarLectura(orgId: number, id: string, datos: DatosLectura, accessToken: string): Promise<Lectura> {
  return json(await fetch(`${base()}/org/${orgId}/${id}`, RequestBodyWithAuthHeader('PUT', datos, null, accessToken)))
}

export async function borrarLectura(orgId: number, id: string, accessToken: string): Promise<void> {
  await json(await fetch(`${base()}/org/${orgId}/${id}`, RequestBodyWithAuthHeader('DELETE', null, null, accessToken)))
}

export async function subirHoja(orgId: number, id: string, file: File, accessToken: string): Promise<Lectura> {
  const form = new FormData()
  form.append('file', file)
  return json(
    await fetch(`${base()}/org/${orgId}/${id}/hoja`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
  )
}

export async function quitarHoja(orgId: number, id: string, accessToken: string): Promise<Lectura> {
  return json(await fetch(`${base()}/org/${orgId}/${id}/hoja`, RequestBodyWithAuthHeader('DELETE', null, null, accessToken)))
}

/** El id de un vídeo de YouTube, para verlo dentro de la escuela. */
export function youtubeId(url: string): string {
  const u = (url || '').trim()
  const m =
    u.match(/youtu\.be\/([\w-]{6,})/i) ||
    u.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([\w-]{6,})/i)
  return m ? m[1] : ''
}

/** La dirección para ver el vídeo DENTRO de la página: YouTube, Bunny
 *  (iframe.mediadelivery.net/embed/… o player.mediadelivery.net/play/…) o
 *  Vimeo. Vacía si es otra web (NOS…): entonces sale el botón «Ver el vídeo». */
export function videoIncrustado(url: string): string {
  const u = (url || '').trim()
  const yt = youtubeId(u)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0`
  const bunny = u.match(/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i)
  if (bunny) return `https://iframe.mediadelivery.net/embed/${bunny[1]}/${bunny[2]}?autoplay=false&responsive=true&preload=true`
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return ''
}

/** «Semana del 9 nov». */
export function semanaTexto(semana: string): string {
  const d = new Date(`${semana}T12:00:00`)
  if (isNaN(d.getTime())) return ''
  return `Semana del ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}`
}

/** El texto en párrafos (línea en blanco entre uno y otro) y, si alguno es
 *  muy largo para el audio (800 letras), partido por frases. */
export function parrafos(texto: string, tope = 700): string[] {
  const salida: string[] = []
  for (const p of (texto || '').split(/\n\s*\n/)) {
    const limpio = p.replace(/\s*\n\s*/g, ' ').trim()
    if (!limpio) continue
    if (limpio.length <= tope) {
      salida.push(limpio)
      continue
    }
    let trozo = ''
    for (const f of limpio.split(/(?<=[.!?])\s+/)) {
      if (trozo && (trozo + ' ' + f).length > tope) {
        salida.push(trozo)
        trozo = f
      } else trozo = trozo ? `${trozo} ${f}` : f
    }
    if (trozo) salida.push(trozo)
  }
  return salida
}

/** Lo que sacó el alumno en los ejercicios (se guarda en la escuela, lo ve el equipo). */
export async function guardarResultado(
  lecturaId: string,
  r: { aciertos: number; total: number; fallos: number[] },
  accessToken: string
): Promise<void> {
  try {
    await fetch(`${base()}/${lecturaId}/resultado`, RequestBodyWithAuthHeader('POST', r, null, accessToken))
  } catch {
    /* sin red: el resultado se queda en el navegador */
  }
}

export interface HechoLectura {
  user_id: number
  nombre: string
  aciertos: number
  total: number
  mejor?: number
  fallos?: number[]
  veces?: number
  ultima?: string
}

export interface ResultadosLectura {
  id: string
  hechos: HechoLectura[]
  sin_hacer: { user_id: number; nombre: string }[]
  media_pct: number | null
  mas_fallados: { numero: number; veces: number; pregunta: string; correcta: string }[]
  alumnos: number
}

export async function getResultados(orgId: number, accessToken: string): Promise<ResultadosLectura[]> {
  const d = await json<{ lecturas: ResultadosLectura[] }>(
    await fetch(`${base()}/org/${orgId}/resultados`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
  )
  return d.lecturas || []
}
