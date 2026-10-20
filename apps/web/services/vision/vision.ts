/**
 * Visión (17/10/2026): el mapa del negocio y el centro de campañas. Solo
 * administradores (la API lo comprueba en cada ruta). Ver
 * apps/api/src/routers/vision.py y apps/api/src/services/vision/.
 */
import { getAPIUrl } from '@services/config/config'

export type TipoNodo = 'vertical' | 'campana' | 'anuncio' | 'contenido' | 'embudo' | 'tarea' | 'nota' | 'metrica'
export type EstadoNodo = 'idea' | 'pendiente' | 'en-curso' | 'hecho' | 'bloqueado'
export type Semaforo = 'verde' | 'ambar' | 'rojo' | null

export const TIPOS: { id: TipoNodo; nombre: string; color: string; que: string }[] = [
  { id: 'vertical', nombre: 'Vertical', color: '#1D0084', que: 'Una parte del negocio: Marketing, Legal…' },
  { id: 'campana', nombre: 'Campaña', color: '#025dc7', que: 'Con sus datos, métricas y su propio mapa' },
  { id: 'anuncio', nombre: 'Anuncio / creativo', color: '#7C3AED', que: 'Un anuncio, un vídeo UGC…' },
  { id: 'contenido', nombre: 'Contenido', color: '#0E7490', que: 'Reel, vídeo de YouTube, clase gratuita' },
  { id: 'embudo', nombre: 'Paso del embudo', color: '#0891B2', que: 'Una página, un formulario, la llamada' },
  { id: 'tarea', nombre: 'Tarea', color: '#B45309', que: 'Algo que hacer, con responsable y fecha' },
  { id: 'nota', nombre: 'Nota', color: '#6B7280', que: 'Una idea o algo que no quieres olvidar' },
  { id: 'metrica', nombre: 'Métrica', color: '#15803D', que: 'Una cifra de una campaña, siempre al día' },
]
export const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t])) as Record<TipoNodo, (typeof TIPOS)[number]>

export const ESTADOS: { id: EstadoNodo; nombre: string; tono: 'gris' | 'azul' | 'verde' | 'rojo' | 'ambar' }[] = [
  { id: 'idea', nombre: 'Idea', tono: 'gris' },
  { id: 'pendiente', nombre: 'Pendiente', tono: 'ambar' },
  { id: 'en-curso', nombre: 'En curso', tono: 'azul' },
  { id: 'hecho', nombre: 'Hecho', tono: 'verde' },
  { id: 'bloqueado', nombre: 'Bloqueado', tono: 'rojo' },
]
export const ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.id, e])) as Record<EstadoNodo, (typeof ESTADOS)[number]>

export interface Enlace {
  titulo: string
  url: string
}
export interface Tarea {
  texto: string
  hecho: boolean
}
export interface Archivo {
  id: string
  nombre: string
  ext: string
  tamano: number
  subido: string
}

export interface NodoVision {
  id: number
  mapa_id: number
  tipo: TipoNodo
  titulo: string
  estado: EstadoNodo
  urgente: boolean
  importante: boolean
  etiquetas: string[]
  responsable: string
  inicio: string
  fin: string
  vence: string
  x: number
  y: number
  color: string
  cuerpo: string
  enlaces: Enlace[]
  checklist: Tarea[]
  hechas: number
  archivos: Archivo[]
  submapa_id: number | null
  utm_campaign: string
  metrica: { campana_id?: number; clave?: string }
  updated_at: string
}

export interface FlechaVision {
  id: number
  origen: number
  destino: number
  etiqueta: string
}

export interface Cifras {
  gasto_ads_cents: number
  otros_gastos_cents: number
  coste_cents: number
  impresiones: number
  clics: number
  leads: number
  agendadas: number
  presentadas: number
  ventas: number
  ingresos_cents: number
  devoluciones_cents: number
  klarna_cents: number
  ventas_netas_cents: number
  closer_cents: number
  ingreso_neto_cents: number
  ctr: number | null
  cpc: number | null
  coste_lead: number | null
  coste_agendada: number | null
  paso_agendar: number | null
  asistencia: number | null
  cierre: number | null
  cac: number | null
  roas: number | null
  neto_por_alumno: number | null
  margen: number
  cac_maximo: number
}

export interface MapaVision {
  mapa: { id: number; nombre: string; nodo_padre_id: number | null; vista: { x?: number; y?: number; zoom?: number } }
  nodos: NodoVision[]
  flechas: FlechaVision[]
  migas: { mapa_id: number; nombre: string }[]
  cifras: Record<string, { cifras: Cifras; semaforo: Record<string, Semaforo> }>
}

export interface MetricaInfo {
  nombre: string
  unidad: 'eur' | 'pct' | 'x' | 'n'
  mejor: 'alto' | 'bajo' | null
}

export interface Dato {
  id: number
  nodo_id: number
  fecha: string
  periodo: 'dia' | 'semana'
  gasto_cents: number
  impresiones: number
  clics: number
  leads: number | null
  agendadas: number | null
  presentadas: number | null
  ventas: number | null
  ingresos_cents: number | null
  devoluciones_cents: number
  otros_gastos_cents: number
  otros_concepto: string
  otros_categoria: string
  nota: string
}

export type Metodo = 'unico' | 'klarna' | 'plazos' | 'otro'
export const METODOS: { id: Metodo; nombre: string }[] = [
  { id: 'unico', nombre: 'Pago único' },
  { id: 'klarna', nombre: 'Klarna' },
  { id: 'plazos', nombre: 'Plazos propios' },
  { id: 'otro', nombre: 'Otro' },
]

export interface Pago {
  id: number
  nodo_id: number
  alumno: string
  email: string
  importe_cents: number
  metodo: Metodo
  fecha: string
  con_llamada: boolean
  nota: string
}

export interface Semana {
  semana: string
  gasto_ads_cents?: number
  otros_gastos_cents?: number
  impresiones?: number
  clics?: number
  leads?: number
  agendadas?: number
  presentadas?: number
  ventas?: number
  ingresos_cents?: number
  devoluciones_cents?: number
}

export type Fuente = 'a-mano' | 'escuela' | 'anuncios' | 'escuela+a-mano' | ''

export interface Campana {
  id: number
  titulo: string
  estado: EstadoNodo
  urgente: boolean
  importante: boolean
  utm_campaign: string
  mapa_id: number
  submapa_id: number | null
  ruta: string
  inicio: string
  fin: string
  cifras: Cifras
  semaforo: Record<string, Semaforo>
  fuentes: Record<string, Fuente>
  semanas: Semana[]
  ventas_detalle: { email: string; importe_cents: number; fecha: string; metodo: Metodo; con_llamada: boolean; origen: string }[]
  datos: Dato[]
  pagos: Pago[]
  avisos: string[]
}

export interface Ajustes {
  precio_cents: number
  plazos: { cuotas: number; cuota_cents: number }
  closer: { desde: string; pct: number }[]
  klarna_pct: number
  klarna_fijo_cents: number
  profe_semanal_cents: number
  profe_desde: string
  umbrales: Record<string, { verde: number; rojo: number }>
}

export interface Negocio {
  ingresos_cents: number
  devoluciones_cents: number
  klarna_cents: number
  ventas_netas_cents: number
  closer_cents: number
  ingreso_neto_cents: number
  ventas: number
  profe_semanas: number
  profe_desde: string
  profe_cents: number
  gastos_cents: number
  resultado_cents: number
  margen_pct: number | null
  coste_por_alumno_cents: number | null
  gastos_por_categoria: Record<string, number>
  avisos: string[]
}

export interface Tablero {
  campanas: Campana[]
  ajustes: Ajustes
  metricas: Record<string, MetricaInfo>
  avisos: string[]
  semanas: Semana[]
  negocio: Negocio
}

type Respuesta<T> = { ok: boolean; datos?: T; error?: string }

/** El motivo que da la API, siempre como texto (un 422 trae una lista de objetos). */
function motivo(datos: unknown, defecto: string): string {
  const d = (datos as any)?.detail
  if (typeof d === 'string' && d) return d
  if (Array.isArray(d)) return 'Algún dato no es válido'
  return defecto
}

async function pedir<T>(ruta: string, metodo: string, cuerpo: unknown, token: string): Promise<Respuesta<T>> {
  try {
    // A mano y no con RequestBodyWithAuthHeader: ese no manda el cuerpo en
    // los PATCH, y aquí se cambian las tarjetas y las flechas con PATCH.
    const res = await fetch(`${getAPIUrl()}vision/${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store',
      body: metodo === 'GET' || cuerpo === null || cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: motivo(datos, 'No se ha podido guardar') }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const getMapa = (org: number, mapaId: number | null, t: string) =>
  pedir<MapaVision>(mapaId ? `org/${org}/mapa/${mapaId}` : `org/${org}/mapa`, 'GET', null, t)
export const guardarVista = (org: number, mapaId: number, vista: { x: number; y: number; zoom: number }, t: string) =>
  pedir<{ ok: boolean }>(`org/${org}/mapa/${mapaId}/vista`, 'PUT', vista, t)
export const getUrgente = (org: number, t: string) => pedir<{ nodos: (NodoVision & { ruta: string })[] }>(`org/${org}/urgente`, 'GET', null, t)

export const crearNodo = (org: number, datos: { mapa_id: number; tipo: TipoNodo; titulo?: string; x: number; y: number }, t: string) =>
  pedir<NodoVision>(`org/${org}/nodos`, 'POST', datos, t)
export const cambiarNodo = (org: number, id: number, datos: Partial<NodoVision>, t: string) =>
  pedir<NodoVision>(`org/${org}/nodos/${id}`, 'PATCH', datos, t)
export const moverNodos = (org: number, posiciones: { id: number; x: number; y: number }[], t: string) =>
  pedir<{ ok: boolean }>(`org/${org}/nodos/posiciones`, 'PUT', posiciones, t)
export const borrarNodo = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`org/${org}/nodos/${id}`, 'DELETE', null, t)
export const abrirSubmapa = (org: number, id: number, t: string) =>
  pedir<{ mapa_id: number }>(`org/${org}/nodos/${id}/submapa`, 'POST', null, t)

export const crearFlecha = (org: number, datos: { mapa_id: number; origen: number; destino: number }, t: string) =>
  pedir<FlechaVision>(`org/${org}/flechas`, 'POST', datos, t)
export const cambiarFlecha = (org: number, id: number, etiqueta: string, t: string) =>
  pedir<FlechaVision>(`org/${org}/flechas/${id}`, 'PATCH', { etiqueta }, t)
export const borrarFlecha = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`org/${org}/flechas/${id}`, 'DELETE', null, t)

export async function subirArchivo(org: number, nodoId: number, archivo: File, t: string): Promise<Respuesta<NodoVision>> {
  const form = new FormData()
  form.append('archivo', archivo)
  try {
    const res = await fetch(`${getAPIUrl()}vision/org/${org}/nodos/${nodoId}/archivos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: form,
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: motivo(datos, 'No se ha podido subir') }
    return { ok: true, datos: datos as NodoVision }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

/** Abre un archivo pidiéndolo con la sesión: no hay enlace público. */
export async function abrirArchivo(org: number, nodoId: number, archivoId: string, t: string): Promise<string | null> {
  try {
    const res = await fetch(`${getAPIUrl()}vision/org/${org}/nodos/${nodoId}/archivos/${archivoId}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

export const borrarArchivo = (org: number, nodoId: number, archivoId: string, t: string) =>
  pedir<NodoVision>(`org/${org}/nodos/${nodoId}/archivos/${archivoId}`, 'DELETE', null, t)

/** Una tarjeta del mapa vista en el tablero de trabajo: con su área y sin el texto de dentro. */
export type TarjetaTrabajo = Omit<NodoVision, 'cuerpo'> & {
  area_id: number | null
  /** La tarjeta del mapa de Inicio de la que cuelga (Marketing, Ventas…). Vacío = Inicio. */
  area: string
  /** El camino entero: «Campañas › Clase gratis 02nov». */
  ruta: string
  personas: string[]
}

export interface Trabajo {
  tarjetas: TarjetaTrabajo[]
  areas: { id: number; titulo: string }[]
  /** Los nombres ya usados como encargados y los del equipo del panel. */
  personas: string[]
  inicio_id: number
  hoy: string
}

export const getTrabajo = (org: number, t: string) => pedir<Trabajo>(`org/${org}/trabajo`, 'GET', null, t)
export const crearTarea = (
  org: number,
  datos: { titulo: string; area_id: number | null; estado: EstadoNodo; responsable?: string; vence?: string; tipo?: TipoNodo },
  t: string
) => pedir<NodoVision>(`org/${org}/trabajo`, 'POST', datos, t)
export const getNodo = (org: number, id: number, t: string) => pedir<NodoVision>(`org/${org}/nodos/${id}`, 'GET', null, t)

export const getTablero = (org: number, t: string) => pedir<Tablero>(`org/${org}/campanas`, 'GET', null, t)
export const getCampana = (org: number, id: number, t: string) =>
  pedir<Campana & { ajustes: Ajustes; metricas: Record<string, MetricaInfo>; avisos_escuela: string[] }>(`org/${org}/campanas/${id}`, 'GET', null, t)
export const guardarDato = (org: number, nodoId: number, datos: Partial<Dato>, t: string, id?: number) =>
  pedir<Dato>(id ? `org/${org}/campanas/${nodoId}/datos/${id}` : `org/${org}/campanas/${nodoId}/datos`, id ? 'PUT' : 'POST', datos, t)
export const borrarDato = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`org/${org}/campanas/datos/${id}`, 'DELETE', null, t)
export const guardarPago = (org: number, nodoId: number, datos: Partial<Pago>, t: string, id?: number) =>
  pedir<Pago>(id ? `org/${org}/campanas/${nodoId}/pagos/${id}` : `org/${org}/campanas/${nodoId}/pagos`, id ? 'PUT' : 'POST', datos, t)
export const borrarPago = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`org/${org}/campanas/pagos/${id}`, 'DELETE', null, t)

/** Plantilla: una campaña de clase gratuita (grabada) con todo su embudo, con fechas desde el día que empieza. */
export const crearClaseGratuita = (
  org: number,
  datos: { mapa_id: number; fecha: string; titulo?: string; utm_campaign?: string },
  t: string
) =>
  pedir<{ ok: boolean; campana_id: number; mapa_id: number; submapa_id: number; utm_campaign: string }>(
    `org/${org}/plantillas/clase-gratuita`,
    'POST',
    datos,
    t
  )

const MESES_UTM = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** El mismo que pone el servidor si no se escribe otro: clase-gratis-06nov. */
export const utmDeClase = (fecha: string) => {
  const [, m, d] = (fecha || '').split('-').map(Number)
  return m && d ? `clase-gratis-${String(d).padStart(2, '0')}${MESES_UTM[m - 1]}` : ''
}

export const getAjustes = (org: number, t: string) =>
  pedir<{ ajustes: Ajustes; de_fabrica: Ajustes; metricas: Record<string, MetricaInfo> }>(`org/${org}/ajustes`, 'GET', null, t)
export const guardarAjustes = (org: number, ajustes: Ajustes, t: string) => pedir<Ajustes>(`org/${org}/ajustes`, 'PUT', ajustes, t)

// ── formato ─────────────────────────────────────────────────────────────────

export const euros = (cents: number | null | undefined, decimales = false) =>
  cents === null || cents === undefined
    ? '—'
    : `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: decimales ? 2 : 0, maximumFractionDigits: decimales ? 2 : 0 })} €`

/** Una cifra con su unidad, para enseñarla. */
export function valorDe(clave: string, cifras: Partial<Cifras> | undefined, metricas?: Record<string, MetricaInfo>): string {
  const v = (cifras as any)?.[clave]
  if (v === null || v === undefined) return '—'
  const unidad = metricas?.[clave]?.unidad ?? (clave.endsWith('_cents') ? 'eur' : 'n')
  if (unidad === 'eur') return euros(v, v !== 0 && Math.abs(v) < 1000)
  if (unidad === 'pct') return `${String(v).replace('.', ',')} %`
  if (unidad === 'x') return `${String(v).replace('.', ',')}×`
  return Number(v).toLocaleString('es-ES')
}

export const COLOR_SEMAFORO: Record<'verde' | 'ambar' | 'rojo', string> = {
  verde: '#16A34A',
  ambar: '#D97706',
  rojo: '#DC2626',
}

export const fechaCorta = (iso: string) => {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
