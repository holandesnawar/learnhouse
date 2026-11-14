/** Consultas que pasan por la escuela (14/11/2026).
 *  De dónde sale: apps/api/src/services/consultas/admin.py */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/** Avisa a la escuela de una consulta recién creada: correo a los administradores. */
export function avisarConsultaNueva(orgId: number, consultaId: string, token: string): void {
  fetch(`${getAPIUrl()}consultas/org/${orgId}/nueva/${encodeURIComponent(consultaId)}`, RequestBodyWithAuthHeader('POST', null, null, token)).catch(() => {})
}

export interface UltimaRespondida {
  id: string
  title: string
  category: string
  author_name: string
  respuesta: string
  respondida_at: string
}

export async function getUltimaRespondida(orgId: number, token: string): Promise<UltimaRespondida | null> {
  try {
    const r = await fetch(`${getAPIUrl()}consultas/org/${orgId}/ultima-respondida`, RequestBodyWithAuthHeader('GET', null, null, token))
    if (!r.ok) return null
    const d = await r.json()
    return d?.consulta || null
  } catch {
    return null
  }
}
