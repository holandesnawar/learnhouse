/**
 * Panel → Correos (29/10/2026): qué pasa con el email marketing. Solo
 * administradores. La API está en apps/api/src/routers/correos.py y la
 * explicación entera en apps/api/src/services/correos/correos.py.
 */
import { getAPIUrl } from '@services/config/config'

export type Situacion = 'pago' | 'reservo' | 'baja' | 'no-encaja' | 'llamada' | 'comprador' | 'sin-comprar'
export type Grupo = 'sin_comprar' | 'compradores'

export interface PasoCorreo {
  id: string
  asunto: string
  grupo: Grupo
  cuando: string
  apagado: boolean
  /** «Te quedaste a un paso»: va al lado, no en la fila. */
  lateral: boolean
  enviados: number
  /** Lo tienen como próximo correo. */
  esperando: number
  /** Volvieron por su enlace e hicieron algo (desbloquear, comprar, pedir la llamada…). */
  volvieron: number
  reservaron_despues: number
  pagaron_despues: number
}

export interface Proximo {
  id: string
  asunto: string
  dia: string
}

export interface PersonaCorreos {
  email: string
  nombre: string
  via: string
  entro: string
  situacion: Situacion
  etiqueta: string
  recibidos: number
  ultimo: { id: string; asunto: string; cuando: string } | null
  proximo: Proximo | null
}

export interface Envio {
  email: string
  nombre: string
  asunto: string
  ok: boolean
  cuando: string
  campana: string
  correo: string
}

export interface PanelCorreos {
  campana: { activa: boolean; venta: boolean; desde: string; hasta: string; hoy: string }
  resumen: {
    entraron: number
    compraron: number
    activos: number
    terminaron: number
    reservaron: number
    pagaron: number
    bajas: number
    no_encajan: number
    enviados: number
    enviados_7d: number
    fallidos_7d: number
    por_situacion: Record<Situacion, number>
  }
  grupos: Record<Grupo, string>
  pasos: PasoCorreo[]
  personas: PersonaCorreos[]
  envios: Envio[]
}

export interface LineaPersona {
  cuando: string
  tipo: 'correo' | 'accion'
  texto: string
  ok: boolean
  campana: string
  correo: string
}

export interface DetallePersona {
  email: string
  nombre: string
  situacion: Situacion
  etiqueta: string
  en_campana: boolean
  proximo: Proximo | null
  linea: LineaPersona[]
}

type Resp<T> = { ok: true; datos: T; error?: undefined } | { ok: false; datos?: undefined; error: string }

async function pedir<T>(url: string, token: string): Promise<Resp<T>> {
  try {
    const res = await fetch(`${getAPIUrl()}correos/${url}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store',
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: typeof (datos as any)?.detail === 'string' ? (datos as any).detail : 'No se ha podido cargar' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getCorreos = (orgId: number, t: string) => pedir<PanelCorreos>(`org/${orgId}`, t)
export const getPersonaCorreos = (orgId: number, email: string, t: string) =>
  pedir<DetallePersona>(`org/${orgId}/persona?email=${encodeURIComponent(email)}`, t)
