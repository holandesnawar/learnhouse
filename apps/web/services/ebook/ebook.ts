/**
 * El ebook de Black Friday a 1 € y su campaña de correos (28/10/2026).
 * La API está en apps/api/src/routers/ebook.py y la explicación entera en
 * apps/api/src/services/ebook/ebook.py.
 */
import { getAPIUrl } from '@services/config/config'

export type Destino = 'admision' | 'landing' | 'descarga'

export interface CorreoCampana {
  id: string
  dia?: number
  fecha?: string
  asunto: string
  texto: string
  boton: string
  destino: Destino
  apagado: boolean
}

export interface EbookBF {
  activo: boolean
  campana: boolean
  desde: string
  hasta: string
  precio_cents: number
  entrega: { asunto: string; texto: string; boton: string; destino: Destino }
  correos: CorreoCampana[]
  pdf: string
  pdf_nombre: string
  pdf_subido_en: string
  pdf_listo: boolean
  nombre_ebook: string
  huecos: string[]
  bf_url: string
  numeros: {
    compradores: number
    en_campana: number
    reservaron: number
    pagaron: number
    bajas: number
    por_correo: Record<string, number>
    ultimos: { email: string; nombre: string; creado: string; estado: string }[]
  }
}

type Resp<T> = { ok: true; datos: T; error?: undefined } | { ok: false; datos?: undefined; error: string }

async function pedir<T>(url: string, metodo: string, cuerpo: unknown, token: string): Promise<Resp<T>> {
  try {
    const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData
    const res = await fetch(`${getAPIUrl()}ebook/${url}`, {
      method: metodo,
      headers: esForm ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store',
      body: cuerpo == null ? undefined : esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: typeof (datos as any)?.detail === 'string' ? (datos as any).detail : 'No se ha podido hacer' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getEbook = (orgId: number, t: string) => pedir<EbookBF>(`org/${orgId}`, 'GET', null, t)

export const guardarEbook = (
  orgId: number,
  datos: Partial<Pick<EbookBF, 'activo' | 'campana' | 'desde' | 'hasta' | 'entrega' | 'correos'>>,
  t: string
) => pedir<EbookBF>(`org/${orgId}`, 'PUT', datos, t)

export function subirPdfEbook(orgId: number, archivo: File, t: string) {
  const f = new FormData()
  f.append('archivo', archivo, archivo.name)
  return pedir<EbookBF>(`org/${orgId}/pdf`, 'POST', f, t)
}

export const vistaEbook = (orgId: number, cual: string, aMi: boolean, t: string) =>
  pedir<{ asunto: string; html: string }>(`org/${orgId}/vista`, 'POST', { cual, a_mi: aMi }, t)
