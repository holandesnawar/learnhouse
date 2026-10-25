'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import type { MisGrupos } from '@/lib/nawar/eventosGrupo'

/** Mis grupos de usuarios; al equipo, además, los de la escuela (25/10/2026). */
export async function getMisGrupos(accessToken: string | undefined): Promise<MisGrupos> {
  const vacio: MisGrupos = { grupos: [], equipo: false, todos: [] }
  if (!accessToken) return vacio
  const r = await fetch(`${getAPIUrl()}student/mis-grupos`, RequestBodyWithAuthHeader('GET', null, null, accessToken))
  if (!r.ok) throw new Error('No se han podido leer los grupos')
  return { ...vacio, ...(await r.json()) }
}
