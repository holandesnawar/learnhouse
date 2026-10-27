'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import type { PlanPagos } from './contactos'

/**
 * KPIs de ventas y Pagos a plazos (20/10/2026). Lo calcula el servidor:
 * apps/api/src/services/stats/kpis.py y services/payments/plazos.py
 * (`listar_planes`).
 */

export interface PasoEmbudoWeb {
  clave: string
  nombre: string
  n: number
  /** % respecto al paso anterior (null en el primero o si el anterior es 0). */
  pct_anterior: number | null
  pct_total: number | null
}

export interface EmbudoWeb {
  nombre: string
  canales: { todos: PasoEmbudoWeb[]; ads: PasoEmbudoWeb[]; organico: PasoEmbudoWeb[] }
}

export interface PasoEmbudoVentas {
  clave: string
  nombre: string
  n: number
  /** Sobre cuántos se calcula el %. */
  sobre: number | null
  pct: number | null
}

export interface Kpis {
  desde: string
  hasta: string
  dias: number
  entradas: { n: number; ads: number; organico: number; por_dia: number }
  reservas: { n: number; por_dia: number }
  embudo_web: Record<'anuncio' | 'web' | 'admision' | 'todos', EmbudoWeb>
  embudo_ventas: { pasos: PasoEmbudoVentas[] }
  llamadas: {
    agendadas: number
    canceladas: number
    futuras: number
    hechas: number
    presentadas: number
    no_vino: number
    sin_apuntar: number
    pagadas_sin_apuntar: number
    resultados: Record<string, number>
    personas_presentadas: number
    personas_cerradas: number
    van_a_pagar_sin_pagar: number
    pct_asistencia: number | null
    pct_no_show: number | null
    pct_cierre: number | null
    /** ¿Sirve confirmar? (27/10): no-show de las confirmadas antes contra las que no. */
    confirmacion?: {
      desde: string
      confirmadas: number
      si: NoShow
      no: NoShow
    }
  }
  /** Al closer solo le llega `n` (sin el dinero ni el reparto). */
  ventas: {
    n: number
    cobrado_cents?: number
    ticket_medio_cents?: number | null
    con_llamada?: number
    tipos?: { unico: number; plazos: number; otro: number }
  }
  /** La versión del closer (25/10/2026): sin lo cobrado. */
  para_closer?: boolean
  serie: {
    dia: string
    visitas: number
    datos: number
    entradas: number
    entradas_ads: number
    reservas: number
    llamadas: number
    presentadas: number
    no_vino: number
    ventas: number
  }[]
  calendly: { conectado: boolean; error: string; corto: boolean }
  /** Desde cuándo se cuentan las visitas de la web. */
  visitas_desde: string
}

export type PlanEnLista = PlanPagos & {
  email: string
  nombre: string
  telefono: string
  /** Stripe tiene puesto el calendario que corta la suscripción al último pago. */
  calendario: boolean
  fuera_de_metricas: boolean
}

export interface ListaPlazos {
  planes: PlanEnLista[]
  totales: {
    vivos: number
    fallidos: number
    completados: number
    cancelados: number
    pendiente_cents: number
    cobrado_cents: number
    sin_calendario: number
  }
  /** Solo al comprobar con Stripe: lo que hizo (números). */
  resultado?: { revisados: number; al_dia: number; fallidos: number; completados: number; errores: number }
}

async function pedir<T>(url: string, metodo: string, accessToken: string): Promise<{ ok: boolean; datos?: T; error?: string }> {
  try {
    const res = await fetch(`${getAPIUrl()}${url}`, RequestBodyWithAuthHeader(metodo, null, null, accessToken))
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (datos as any)?.detail || 'No se han podido leer los datos' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getKpis = (orgId: number, dias: number, accessToken: string) =>
  pedir<Kpis>(`stats/org/${orgId}/kpis?dias=${dias}`, 'GET', accessToken)

export const getPlazos = (orgId: number, accessToken: string) =>
  pedir<ListaPlazos>(`stats/org/${orgId}/plazos`, 'GET', accessToken)

export const comprobarTodosLosPlazos = (orgId: number, accessToken: string) =>
  pedir<ListaPlazos>(`stats/org/${orgId}/plazos/comprobar`, 'POST', accessToken)

export interface NoShow {
  con_resultado: number
  no_vino: number
  pct_no_show: number | null
}
