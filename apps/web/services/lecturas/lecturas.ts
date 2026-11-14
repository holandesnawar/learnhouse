'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

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
