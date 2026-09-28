'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import type { NotaContacto, VolverALlamar } from '@services/stats/contactos'

/**
 * Panel de negocio: kanban de matrículas, ficha completa del cliente y tareas.
 * Lo que devuelve el servidor sale de `apps/api/src/services/panel/`.
 */

export type EtapaTablero = 'nuevo' | 'contactado' | 'revision' | 'propuesta' | 'alumno' | 'perdido'
export type Canal = '' | 'whatsapp' | 'llamada' | 'email' | 'instagram' | 'otro'

export const CANALES: { id: Canal; nombre: string }[] = [
  { id: 'whatsapp', nombre: 'WhatsApp' },
  { id: 'llamada', nombre: 'Llamada' },
  { id: 'email', nombre: 'Correo' },
  { id: 'instagram', nombre: 'Instagram' },
  { id: 'otro', nombre: 'Otro' },
]
export const NOMBRE_CANAL: Record<string, string> = Object.fromEntries(CANALES.map((c) => [c.id, c.nombre]))

export interface Tarjeta {
  email: string
  nombre: string
  telefono: string
  etapa: EtapaTablero
  canal: Canal
  motivo: string
  desde: string
  movido_por: string
  vio_precio: boolean
  vino_de: string
  que_hizo: string
  utm_campaign: string
  fuera_de_metricas: boolean
  /** Día que pidió plaza o llegó al pago: ordena las columnas (lo nuevo arriba). */
  llegada: string
  /** Fuera del tablero: quitada a mano o fuera de los números (prueba). */
  oculto: boolean
  tareas: number
  /** Notas del equipo sobre esta persona, y la última (para el aviso de la tarjeta). */
  notas: number
  ultima_nota: string
}

export interface Tablero {
  etapas: { id: EtapaTablero; nombre: string }[]
  tarjetas: Tarjeta[]
}

export interface Tarea {
  id: number
  titulo: string
  notas: string
  fecha: string
  prioridad: 'normal' | 'alta'
  estado: 'pendiente' | 'hecha'
  asignado_id: number
  asignado: string
  creado_por_id: number
  creado_por: string
  email: string
  created_at: string
  done_at: string
}

export interface MiembroEquipo {
  id: number
  nombre: string
  rol: string
  email: string
}

export interface ItemLinea {
  tipo: 'evento' | 'correo' | 'nota' | 'tarea'
  cuando: string
  texto: string
  kind?: string
  ok?: boolean
  autor?: string
  estado?: string
}

export interface FichaCliente {
  email: string
  nombre: string
  telefono: string
  etapa_contacto: string
  tablero: Tarjeta
  vio_precio: boolean
  vino_de: string
  utm: { source: string; medium: string; campaign: string }
  etiquetas: string[]
  fuera_de_metricas: boolean
  primer_contacto: { kind: string; que: string; when: string }
  paginas: { id: string; nombre: string; precio: boolean }[]
  pagos: { fecha: string; importe_cents: number; moneda: string; producto: string }[]
  total_pagado_cents: number
  correos: { asunto: string; ok: boolean; created_at: string }[]
  notas: NotaContacto[]
  volver_a_llamar: VolverALlamar | null
  tareas: Tarea[]
  /** Solo administradores. */
  systeme: { ok: boolean; motivo?: string; existe?: boolean; etiquetas: string[]; campos: { slug: string; valor: string }[] } | null
  linea: ItemLinea[]
}

type Resp<T> = { ok: boolean; datos?: T; error?: string }

async function pedir<T>(url: string, metodo: string, cuerpo: unknown, accessToken: string): Promise<Resp<T>> {
  try {
    const res = await fetch(`${getAPIUrl()}${url}`, RequestBodyWithAuthHeader(metodo, cuerpo, null, accessToken))
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (datos as any)?.detail || 'No se ha podido hacer' }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getTablero = (orgId: number, t: string) => pedir<Tablero>(`panel/org/${orgId}/tablero`, 'GET', null, t)

export const moverTarjeta = (
  orgId: number,
  cambio: { email: string; etapa: EtapaTablero; canal?: Canal; motivo?: string },
  t: string
) => pedir<{ ok: boolean }>(`panel/org/${orgId}/tablero`, 'PUT', cambio, t)

/** Quitar del tablero (o devolver) sin borrar nada. Solo administradores. */
export const ocultarTarjeta = (orgId: number, email: string, oculto: boolean, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/tablero/ocultar`, 'PUT', { email, oculto }, t)

export const getFichaCliente = (orgId: number, email: string, t: string) =>
  pedir<FichaCliente>(`panel/org/${orgId}/cliente?${new URLSearchParams({ email }).toString()}`, 'GET', null, t)

export const getEquipo = (orgId: number, t: string) =>
  pedir<{ equipo: MiembroEquipo[]; yo: number }>(`panel/org/${orgId}/equipo`, 'GET', null, t)

export const getTareas = (orgId: number, t: string, filtro: { email?: string; pendientes?: boolean } = {}) => {
  const q = new URLSearchParams()
  if (filtro.email) q.set('email', filtro.email)
  if (filtro.pendientes) q.set('pendientes', 'true')
  return pedir<{ tareas: Tarea[]; yo: number; es_admin: boolean }>(`panel/org/${orgId}/tareas?${q.toString()}`, 'GET', null, t)
}

export type TareaNueva = Partial<Pick<Tarea, 'titulo' | 'notas' | 'fecha' | 'prioridad' | 'asignado_id' | 'email' | 'estado'>>

export const crearTarea = (orgId: number, datos: TareaNueva, t: string) =>
  pedir<{ tarea: Tarea }>(`panel/org/${orgId}/tareas`, 'POST', datos, t)

export const cambiarTarea = (orgId: number, id: number, datos: TareaNueva, t: string) =>
  pedir<{ tarea: Tarea }>(`panel/org/${orgId}/tareas/${id}`, 'PATCH', datos, t)

export const borrarTarea = (orgId: number, id: number, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/tareas/${id}`, 'DELETE', null, t)

/** "hace 3 días", "hoy", "ayer". */
export function haceCuanto(cuando: string): string {
  if (!cuando) return ''
  const d = new Date(cuando.includes('T') && !/[zZ]|[+-]\d\d:?\d\d$/.test(cuando) ? `${cuando}Z` : cuando)
  if (Number.isNaN(d.getTime())) return ''
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`
}

export function fechaCorta(cuando: string): string {
  if (!cuando) return ''
  const d = new Date(cuando.length === 10 ? `${cuando}T12:00:00` : cuando)
  if (Number.isNaN(d.getTime())) return cuando
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export const euros = (cents: number) =>
  `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`

export interface Cliente {
  email: string
  nombre: string
  telefono: string
  total_cents: number
  pagos: number
  ultimo_pago: string
  primer_pago: string
  productos: string[]
  tiene_cuenta: boolean
  ultima_visita: string
  lecciones: number
}

export const getClientes = (orgId: number, t: string) =>
  pedir<{ clientes: Cliente[]; total_cents: number; n: number }>(`panel/org/${orgId}/clientes`, 'GET', null, t)

export interface Campana {
  id: number
  nombre: string
  plataforma: string
  utm_campaign: string
  inicio: string
  fin: string
  gasto_cents: number
  notas: string
  leads: number
  matriculas: number
  ventas: number
  ingresos_cents: number
  coste_por_lead_cents: number | null
  coste_por_venta_cents: number | null
  retorno: number | null
  personas: { email: string; nombre: string; etapa: string; when: string }[]
}

export interface PanelAds {
  campanas: Campana[]
  sin_apuntar: { utm_campaign: string; leads: number; ventas: number }[]
  total: { gasto_cents: number; leads: number; ventas: number; ingresos_cents: number; retorno: number | null }
  plataformas: Record<string, string>
}

export type CampanaNueva = { nombre?: string; plataforma?: string; utm_campaign?: string; inicio?: string; fin?: string; gasto?: number; notas?: string }

export const getAds = (orgId: number, t: string) => pedir<PanelAds>(`panel/org/${orgId}/ads`, 'GET', null, t)
export const crearCampana = (orgId: number, d: CampanaNueva, t: string) => pedir<{ ok: boolean }>(`panel/org/${orgId}/ads`, 'POST', d, t)
export const cambiarCampana = (orgId: number, id: number, d: CampanaNueva, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/ads/${id}`, 'PUT', d, t)
export const borrarCampana = (orgId: number, id: number, t: string) => pedir<{ ok: boolean }>(`panel/org/${orgId}/ads/${id}`, 'DELETE', null, t)
