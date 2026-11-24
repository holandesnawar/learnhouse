/** El vídeo de bienvenida (24/11/2026). Servidor:
 *  apps/api/src/services/student_progress/bienvenida.py */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface Bienvenida {
  /** Le sale la tarjeta en el Inicio (alumno nuevo que aún no lo ha visto). */
  toca: boolean
  visto: boolean
  /** La dirección del reproductor de Bunny. */
  url: string
  titulo: string
}

const NADA: Bienvenida = { toca: false, visto: false, url: '', titulo: '' }

export async function getBienvenida(token: string): Promise<Bienvenida> {
  try {
    const r = await fetch(`${getAPIUrl()}student/bienvenida`, RequestBodyWithAuthHeader('GET', null, null, token))
    if (!r.ok) return NADA
    return { ...NADA, ...(await r.json()) }
  } catch {
    return NADA
  }
}

export async function marcarBienvenidaVista(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${getAPIUrl()}student/bienvenida/visto`, RequestBodyWithAuthHeader('POST', null, null, token))
    return r.ok
  } catch {
    return false
  }
}
