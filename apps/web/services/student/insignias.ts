/** Las insignias de la formación: una por módulo superado.
 *  De dónde salen: apps/api/src/services/insignias/insignias.py */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface Insignia {
  /** `insignia:<capítulo>`: la misma clave con la que se quita de la campana. */
  id: string
  numero: number
  nombre: string
  hechas: number
  total: number
  necesarias: number
  conseguida: boolean
  /** ISO con Z: cuándo llegó al 80 % del módulo. */
  cuando: string | null
}

export interface MisInsignias {
  insignias: Insignia[]
  /** Conseguidas hace poco, sin quitar ni compartir. */
  nuevas: Insignia[]
}

export async function getInsignias(token: string): Promise<MisInsignias> {
  try {
    const r = await fetch(`${getAPIUrl()}student/insignias`, RequestBodyWithAuthHeader('GET', null, null, token))
    if (!r.ok) return { insignias: [], nuevas: [] }
    const d = await r.json()
    return { insignias: d.insignias || [], nuevas: d.nuevas || [] }
  } catch {
    return { insignias: [], nuevas: [] }
  }
}

export function textoParaCompartir(i: Insignia): { titulo: string; texto: string } {
  return {
    titulo: `Módulo ${i.numero} superado${i.nombre ? `: ${i.nombre}` : ''}`,
    texto: `He terminado el módulo ${i.numero}${i.nombre ? ` (${i.nombre})` : ''} de la formación.`,
  }
}
