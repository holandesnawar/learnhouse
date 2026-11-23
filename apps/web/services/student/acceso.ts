/** Si el acceso del alumno está en pausa por una cuota sin pagar.
 *  De dónde sale: apps/api/src/services/payments/pausa.py (la regla de los
 *  plazos sin pagar, que nace APAGADA: entonces contesta siempre «no»). */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface Acceso {
  pausado: boolean
  /** AAAA-MM-DD: desde cuándo está en pausa. */
  desde?: string
  debe_cents?: number
  moneda?: string
  numero?: number
  cuotas?: number
  /** La página de Stripe de esa factura, para pagarla. */
  pagar_url?: string
}

export async function getAcceso(token: string): Promise<Acceso> {
  try {
    const r = await fetch(`${getAPIUrl()}student/acceso`, RequestBodyWithAuthHeader('GET', null, null, token))
    if (!r.ok) return { pausado: false }
    return (await r.json()) as Acceso
  } catch {
    // Ante cualquier fallo, como si no hubiera pausa: el servidor manda igual.
    return { pausado: false }
  }
}

/** «Ya he pagado»: la escuela le pregunta a Stripe por su plan. */
export async function comprobarMiPago(token: string): Promise<{ ok: boolean; acceso?: Acceso; error?: string }> {
  try {
    const r = await fetch(`${getAPIUrl()}student/acceso/comprobar`, RequestBodyWithAuthHeader('POST', null, null, token))
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, error: typeof d?.detail === 'string' ? d.detail : 'No hemos podido comprobarlo ahora mismo.' }
    return { ok: true, acceso: d as Acceso }
  } catch {
    return { ok: false, error: 'No se ha podido conectar. Prueba en unos minutos.' }
  }
}

/** Rutas que quedan en pausa: la formación y las clases. Lo demás (Inicio,
 *  comunidad, mensajes, consultas, recursos, cuenta) se sigue abriendo. */
const EN_PAUSA = ['course', 'leccion', 'ejercicios', 'clases', 'sala', 'presentacion', 'tarea', 'mis-notas']

export function rutaEnPausa(partes: string[]): boolean {
  return partes.some((p) => EN_PAUSA.includes(p))
}

export function eurosDe(cents: number | undefined): string {
  const n = (cents || 0) / 100
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}\u00a0€`
}
