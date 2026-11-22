/**
 * La analítica de las webs (Panel → Web → Analítica, 17/11/2026). Todo lo
 * calcula el servidor: apps/api/src/services/stats/analitica.py.
 */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export type Modelo = 'ficha' | 'primera' | 'ultima'

export interface FiltrosAnalitica {
  desde: string
  hasta: string
  modelo: Modelo
  canal: '' | 'ads' | 'organico'
  fuente: string
  campana: string
  anuncio: string
  bf_todo: boolean
  /** El país (22/11/2026): de la visita, por su zona horaria; de la persona, por el prefijo de su teléfono. */
  pais: string
  /** Comparar con el periodo de antes (mismo largo). */
  comparar: boolean
}

export interface Cifras {
  visitas: number | null
  leads: number
  reservaron: number
  vinieron: number
  no_vinieron: number
  pagaron: number
  /** Lo VENDIDO (22/11/2026): con plazos, el total del plan. */
  cents: number
  /** Lo que ya ha entrado y lo que falta. */
  cobrado_cents?: number
  por_cobrar_cents?: number
  pct_lead: number | null
  pct_reserva: number | null
  pct_vino: number | null
  pct_pago_llamada: number | null
  pct_pago: number | null
  /** Solo en el resumen (y en el de antes). */
  cents_por_visita?: number | null
  ventas_por_100_visitas?: number | null
}

export interface FilaCifras extends Cifras {
  valor: string
  nombre: string
  meta?: string
  gasto_cents?: number
  coste_lead_cents?: number | null
  coste_venta_cents?: number | null
  retorno?: number | null
  /** Por fuente (22/11/2026). `visitas_antes` es null si antes aún no se contaban. */
  cents_por_visita?: number | null
  visitas_antes?: number | null
  leads_antes?: number
}

export interface PuntoSerie {
  dia: string
  visitas: number
  leads: number
  leads_ads: number
  reservas: number
  ventas: number
}

export interface PaginaEntrada {
  pagina: string
  entraron: number
  rebotes: number
  pct_rebote: number | null
  /** Visitas que ya traen la zona horaria: de esas se sabe si dejaron sus datos. */
  medidas: number
  datos: number
  pct_datos: number | null
}

export interface PaginaVista {
  pagina: string
  sesiones: number
  entradas: number
  medidas: number
  datos: number
  pct_datos: number | null
  salidas: number
  pct_salida: number | null
}

export interface Tiempo {
  n: number
  mediana_dias: number | null
  media_dias: number | null
}

export interface QuienVisita {
  sesiones: number
  movil: number
  ordenador: number
  paginas_por_visita: number | null
  pct_rebote: number | null
  segundos: number | null
  medidas: number
  nuevos: number
  vuelven: number
  pct_vuelven: number | null
  dejaron_datos: number
  pct_datos: number | null
  paises: { pais: string; visitas: number; datos: number; pct: number | null; pct_datos: number | null }[]
  paises_personas: { pais: string; leads: number; reservaron: number; pagaron: number; cents: number }[]
  /** 7 días (lunes primero) × 12 franjas de dos horas, hora de Países Bajos. */
  calor: number[][]
  mejores: { dia: number; franja: number; n: number }[]
}

export interface PersonaAnalitica {
  email: string
  nombre: string
  entro: string
  canal: 'ads' | 'organico'
  fuente: string
  campana: string
  campana_nombre: string
  anuncio: string
  primera_pagina: string
  reservo: string
  vino: boolean
  no_vino: boolean
  pago: boolean
  /** Lo vendido a esa persona; `cobrado_cents`, lo que ha entrado. */
  cents: number
  cobrado_cents?: number
  pais?: string
}

export interface Analitica {
  desde: string
  hasta: string
  modelo: Modelo
  modelos: Record<Modelo, string>
  opciones: {
    paises?: string[]
    fuentes: string[]
    campanas: { valor: string; nombre: string }[]
    anuncios: { valor: string; nombre: string }[]
  }
  resumen: Cifras
  por_canal: FilaCifras[]
  por_fuente: FilaCifras[]
  por_campana: FilaCifras[]
  por_anuncio: FilaCifras[]
  paginas: { pagina: string; sesiones: number; entradas: number }[]
  donde_dejan: { marca: string; nombre: string; leads: number; reservaron: number; pagaron: number }[]
  dispositivos: { movil: number; ordenador: number }
  serie: PuntoSerie[]
  personas: PersonaAnalitica[]
  personas_total: number
  visitas_desde: string
  /** Lo del 22/11/2026. Opcional por si la pantalla llega antes que el servidor. */
  comparar?: boolean
  anterior?: { desde: string; hasta: string; resumen: Cifras; serie: PuntoSerie[]; visitas_comparables: boolean } | null
  ahora?: number | null
  paginas_detalle?: { entrada: PaginaEntrada[]; vistas: PaginaVista[]; salida: PaginaVista[]; blog: PaginaVista[] }
  tiempos?: { lead_reserva: Tiempo; reserva_pago: Tiempo; lead_pago: Tiempo }
  quien?: QuienVisita
  medido_desde?: string
  calendly: { conectado: boolean; error: string }
}

export async function getAnalitica(
  orgId: number,
  f: FiltrosAnalitica,
  accessToken: string,
): Promise<{ ok: boolean; datos?: Analitica; error?: string }> {
  const q = new URLSearchParams()
  q.set('desde', f.desde)
  q.set('hasta', f.hasta)
  q.set('modelo', f.modelo)
  if (f.canal) q.set('canal', f.canal)
  if (f.fuente) q.set('fuente', f.fuente)
  if (f.campana) q.set('campana', f.campana)
  if (f.anuncio) q.set('anuncio', f.anuncio)
  if (f.bf_todo) q.set('bf_todo', '1')
  if (f.pais) q.set('pais', f.pais)
  if (!f.comparar) q.set('comparar', '0')
  try {
    const res = await fetch(
      `${getAPIUrl()}stats/org/${orgId}/analitica?${q.toString()}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    )
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (datos as any)?.detail || 'No se han podido leer los datos' }
    return { ok: true, datos: datos as Analitica }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}
