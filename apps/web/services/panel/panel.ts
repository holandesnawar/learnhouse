'use client'
import type { Templada, Temperatura } from '@services/stats/contactos'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import type { NotaContacto, VolverALlamar } from '@services/stats/contactos'

/**
 * Panel de negocio: kanban de matrículas, ficha completa del cliente y tareas.
 * Lo que devuelve el servidor sale de `apps/api/src/services/panel/`.
 */

export type EtapaTablero =
  | 'nuevo'
  | 'llamar'
  | 'no-contesta'
  | 'contactado'
  | 'agendado'
  | 'seguimiento'
  | 'pendiente-pago'
  | 'no-show'
  | 'descartado'
  | 'alumno'
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
  /** El correo; o «llamada:<id>» en las sueltas (de Llamadas, sin ficha). */
  id: string
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
  /** De dónde viene, corto: «Anuncio Meta», «Web · inicio», «Guía»… */
  origen?: string
  fuera_de_metricas: boolean
  /** Día que pidió plaza o llegó al pago: ordena las columnas (lo nuevo arriba). */
  llegada: string
  /** Fuera del tablero: quitada a mano o fuera de los números (prueba). */
  oculto: boolean
  tareas: number
  /** Notas del equipo sobre esta persona, y la última (para el aviso de la tarjeta). */
  notas: number
  ultima_nota: string
  /** Plaza reservada con señal: lo pagado y lo que le falta (sin acceso aún). */
  reserva?: { pagado_cents: number; total_cents: number; pendiente_cents: number } | null
  /** En Nuevo y Por llamar, si está pendiente en Llamadas: su fila (dónde se quedó, temperatura a mano). */
  llamada?: Templada | null
  /** Rojo (llamar ya), amarillo o verde, por cuándo llegó (o puesta a mano en Llamadas). */
  temperatura?: Temperatura
  /** De Llamadas sin ficha (apuntada a mano solo con el móvil): no se arrastra. */
  suelta?: boolean
  /** La fecha de volver a llamar, si la tiene. */
  volver_a_llamar?: VolverALlamar | null
  /** La llamada de Calendly que la tiene en Agendado (14/10): reservó después
   *  del último movimiento a mano. */
  cita?: { inicio: string; id: string; confirmada?: boolean; /** Cuántos de sus tres WhatsApp se le han mandado (02/11). */ whatsapp?: number } | null
  /** Leads (del embudo a la llamada) o Ventas (de la llamada al cobro), 22/10. */
  mesa?: 'leads' | 'ventas'
  /** El closer que lleva su llamada (0 = sin asignar). */
  closer_id?: number
  closer?: string
  /** Viene de Black Friday (29/10): compró el ebook o solo desbloqueó la oferta. */
  black_friday?: '' | 'ebook' | 'lista'
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

/** Black Friday en la ficha (services/panel/black_friday.py → resumen, 29/10):
 *  de dónde vino, si tiene el ebook y qué correos de systeme.io le han llegado
 *  (por el calendario de la campaña: abrir un correo no se puede saber). */
export interface BlackFridayFicha {
  estado: '' | 'ebook' | 'lista' | 'empezo-ebook'
  titulo: string
  desbloqueo: { cuando: string; via: string } | null
  ebook: { cuando: string; via: string } | null
  empezo_ebook: string
  /** «Compradores», «No compradores» o vacío (fuera, o sin campaña). */
  campana: string
  /** Si los correos aún no están encendidos, o entró antes de encenderlos. */
  aviso: string
  salida: { motivo: string; cuando: string } | null
  correos: { id: string; asunto: string; cuando: string; campana: string }[]
  proximo: { id: string; asunto: string; cuando: string } | null
  /** Los correos en los que pulsó el botón. */
  volvio_por: { id: string; asunto: string; cuando: string }[]
  paginas: { id: string; nombre: string }[]
  /** Dónde está con la llamada («Reservó su llamada», «Empezó el formulario…»). */
  llamada: string
}

/** El proceso de admisión de una persona (services/panel/cliente.py → proceso_admision). */
export interface ProcesoAdmision {
  terminado: boolean
  cuando: string
  apto: boolean | null
  motivo_fuera: string
  reservo: boolean
  video: '' | 'empezado' | 'visto'
  embudo: '' | 'admision'
  ultima: string
  /** Dónde se quedó, en una frase. */
  resumen: string
  respuestas: { pregunta: string; respuesta: string }[]
}

export interface FichaCliente {
  email: string
  nombre: string
  telefono: string
  etapa_contacto: string
  tablero: Tarjeta
  vio_precio: boolean
  /** Por qué ha visto el precio, en una frase (vacío si no lo ha visto). */
  precio_por?: string
  vino_de: string
  /** «Ads» u «Orgánico» (`canal_de` en pipeline.py): `detalle` dice por dónde
   *  («Meta · VSL A», «Setter · Laura», «Instagram · historias») y `antes`, si
   *  llegó por un anuncio, por dónde había llegado antes sin él. */
  canal?: { canal: 'ads' | 'organico'; detalle: string; antes: string }
  /** `correo`: el asunto si el último enlace era el botón de un correo (29/10). */
  utm: { source: string; medium: string; campaign: string; content?: string; content_meta?: string; term?: string; placement?: string; correo?: string }
  etiquetas: string[]
  fuera_de_metricas: boolean
  primer_contacto: { kind: string; que: string; when: string }
  paginas: { id: string; nombre: string; precio: boolean }[]
  /** Lo que contestó en las preguntas de admisión (o de /agendar) y dónde se
   *  quedó. null si nunca empezó el proceso. */
  admision?: ProcesoAdmision | null
  /** Si pasó por la campaña de Black Friday (null si no). */
  black_friday?: BlackFridayFicha | null
  pagos: { fecha: string; importe_cents: number; moneda: string; producto: string }[]
  total_pagado_cents: number
  correos: { asunto: string; ok: boolean; created_at: string }[]
  notas: NotaContacto[]
  volver_a_llamar: VolverALlamar | null
  tareas: Tarea[]
  /** Sus llamadas de Calendly, pasadas y próximas, con lo que pasó. */
  llamadas: import('@services/stats/contactos').Cita[]
  /** Por dónde va en la formación (null si no tiene cuenta). */
  avance?: AvanceAlumno | null
  /** Su fila en Llamadas templadas, si la tiene. */
  templada?: Templada | null
  /** Plaza reservada con señal (la abierta, o la última si no hay ninguna abierta). */
  reserva?: import('@services/stats/contactos').Reserva | null
  /** Su plan de pagos propio en 3 plazos (el vivo, o el último). */
  plan_pagos?: import('@services/stats/contactos').PlanPagos | null
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
  // nombre y teléfono: por si, al ir a Seguimiento, entra nueva en Llamadas.
  cambio: { email: string; etapa: EtapaTablero; canal?: Canal; motivo?: string; nombre?: string; telefono?: string },
  t: string
) => pedir<{ ok: boolean }>(`panel/org/${orgId}/tablero`, 'PUT', cambio, t)

/** Le pone (o le quita, con 0) el closer que lleva su llamada. `mesa`: desde
 *  qué mesa se asigna (en Leads aún no hay llamada y el correo lo dice). */
export const asignarCloser = (orgId: number, email: string, closerId: number, t: string, mesa: 'leads' | 'ventas' | '' = '') =>
  pedir<{ ok: boolean; closer_id: number; closer: string; avisado?: boolean }>(
    `panel/org/${orgId}/tablero/asignar`,
    'PUT',
    { email, closer_id: closerId, mesa },
    t
  )

/** Quién reparte las llamadas (0 = nadie: avisa a los administradores) y el equipo. */
export const getReparto = (orgId: number, t: string) =>
  pedir<{ repartidor_id: number; calendly?: Record<string, string>; equipo: MiembroEquipo[]; yo: number }>(
    `panel/org/${orgId}/reparto`,
    'GET',
    null,
    t
  )

export const guardarReparto = (orgId: number, repartidorId: number, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/reparto`, 'PUT', { repartidor_id: repartidorId }, t)

/** El correo de Calendly de cada closer (31/10, Calendly Teams): {id: correo}.
 *  Con eso la escuela sabe a quién le dio Calendly cada llamada. */
export const guardarCorreosCalendly = (orgId: number, calendly: Record<string, string>, t: string) =>
  pedir<{ ok: boolean; calendly: Record<string, string> }>(`panel/org/${orgId}/reparto`, 'PUT', { calendly }, t)

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
  /** Por dónde va en la formación (sin el reparto por módulo). */
  avance: Omit<AvanceAlumno, 'modulos'> | null
  /** Si paga en 3 plazos: cuántos lleva y si alguno no entró. */
  plazos?: Pick<
    import('@services/stats/contactos').PlanPagos,
    'estado' | 'estado_nombre' | 'cuotas' | 'cuotas_pagadas' | 'total_cents' | 'pendiente_cents' | 'proximo_cobro' | 'fallo'
  > | null
  /** La comisión del closer de esta venta (27/10, solo administradores). */
  comision?: ComisionVenta | null
}

/** ¿Pagada la comisión del closer? Ver apps/api/src/services/panel/comisiones.py. */
export interface ComisionVenta {
  pagada: { importe_cents: number; cuando: string; por: string; nota?: string } | null
  /** Sobre qué se calcula: el TOTAL de la venta (con plazos, el del plan). */
  base_cents: number
  /** Su % del día del primer pago (Visión → Ajustes). */
  pct: number
  /** Lo que le toca, aproximado: ese % sobre el total de la venta. */
  estimada_cents: number
  /** Pasó por una llamada: solo esas cuentan como pendientes. */
  con_llamada: boolean
  closer: string
}

export interface ComisionesCloser {
  closer: string
  pendientes: number
  pendiente_cents: number
  pagadas: number
  pagado_cents: number
  emails: string[]
}

/**
 * Avance en la formación, contado por CLASES del curso (cada sección de una
 * lección es una clase). Ver apps/api/src/services/panel/avance.py.
 */
export interface AvanceAlumno {
  hechas: number
  total: number
  pct: number
  /** La última que terminó (por fecha). */
  ultima: { modulo: string; clase: string; fecha: string } | null
  /** La primera que le falta, en el orden del curso. */
  siguiente: { modulo: string; clase: string } | null
  modulos: { nombre: string; hechas: number; total: number }[]
}

export const getClientes = (orgId: number, t: string) =>
  pedir<{ clientes: Cliente[]; total_cents: number; n: number; comisiones?: ComisionesCloser[]; porcentajes_comision?: number[] }>(
    `panel/org/${orgId}/clientes`,
    'GET',
    null,
    t
  )

export const marcarComision = (orgId: number, email: string, importe_cents: number, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/comisiones`, 'POST', { email, importe_cents }, t)

export const marcarComisiones = (orgId: number, emails: string[], t: string) =>
  pedir<{ ok: boolean; marcadas: number }>(`panel/org/${orgId}/comisiones/todas`, 'POST', { emails }, t)

export const quitarComision = (orgId: number, email: string, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/comisiones?email=${encodeURIComponent(email)}`, 'DELETE', null, t)

/** Un alumno en Panel → Alumnos → Progreso. Ver apps/api/src/services/panel/alumnos.py. */
export interface AlumnoProgreso {
  user_id: number
  nombre: string
  email: string
  alta: string
  /** ISO en UTC con hora ("…T18:05:00Z") o solo el día ("2026-10-04"). */
  ultima_entrada: string
  /** Dónde se quedó: la última clase que abrió o terminó. */
  donde: { modulo: string; clase: string; cuando: string; como: 'abrio' | 'termino' | 'repaso' } | null
  siguiente: { modulo: string; clase: string } | null
  hechas: number
  total: number
  pct: number
  modulos: { nombre: string; hechas: number; total: number }[]
  dias_que_entro: number
  entradas_7d: number
  racha: number
  estado: { id: 'activo' | 'enfriando' | 'descolgado' | 'sin-empezar' | 'nunca'; texto: string; dias: number | null }
  /** La clase a la que lleva "Seguir donde lo dejé" en el recordatorio. */
  seguir_uuid: string
  ultimo_recordatorio: { sent_at: string; tipo: string; por: string } | null
  /** Entró desde el 10/10/2026: la formación se le abre por avance. */
  por_avance: boolean
  /** Solo si va por avance: cada módulo con su candado. Ver apps/api/src/services/courses/avance_modulos.py. */
  aperturas: AperturaModulo[]
}

export interface AperturaModulo {
  uuid: string
  nombre: string
  numero: number | null
  abierto: boolean
  /** entrada = desde el primer día; avance = lo abrió su avance; mano = lo abrió el equipo. */
  como: 'entrada' | 'avance' | 'mano' | 'empezado' | null
  /** Cuándo se abrió (o se abrirá, si ya solo falta tiempo). ISO con Z. */
  abre: string | null
  /** La primera fecha en que podría abrirse, si aún no ha llegado. */
  fecha_minima: string | null
  /** Por qué sigue cerrado ("Se abre cuando termine el módulo 2: le faltan 3 clases."). */
  motivo: string | null
  hechas: number
  necesarias: number
  total: number
}

export const abrirModulo = (orgId: number, userId: number, chapterUuid: string, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/alumnos/${userId}/modulos/${encodeURIComponent(chapterUuid)}/abrir`, 'POST', {}, t)

export const quitarAperturaModulo = (orgId: number, userId: number, chapterUuid: string, t: string) =>
  pedir<{ ok: boolean }>(`panel/org/${orgId}/alumnos/${userId}/modulos/${encodeURIComponent(chapterUuid)}/abrir`, 'DELETE', null, t)

export type TipoRecordatorio = 'tres_dias' | 'semana'
export interface PlantillasRecordatorio {
  tres_dias: { asunto: string; texto: string }
  semana: { asunto: string; texto: string }
  botones: { seguir: string; victoria: string; consulta: string }
  /** A dónde llevan: una ruta de la escuela ("/community/…") o una dirección entera. */
  enlaces: { victoria: string; consulta: string }
}

export const getPlantillasRecordatorio = (orgId: number, t: string) =>
  pedir<{ plantillas: PlantillasRecordatorio; de_fabrica: PlantillasRecordatorio }>(`panel/org/${orgId}/recordatorio/plantillas`, 'GET', null, t)

export const guardarPlantillasRecordatorio = (orgId: number, datos: PlantillasRecordatorio, t: string) =>
  pedir<{ plantillas: PlantillasRecordatorio; de_fabrica: PlantillasRecordatorio }>(`panel/org/${orgId}/recordatorio/plantillas`, 'PUT', datos, t)

export const vistaRecordatorio = (orgId: number, userId: number, datos: { tipo: TipoRecordatorio; asunto: string; texto: string }, t: string) =>
  pedir<{ para: string; asunto: string; html: string }>(`panel/org/${orgId}/recordatorio/${userId}/vista`, 'POST', datos, t)

export interface RecordatorioAuto {
  activo: boolean
  cambiado_en: string
  por: string
  dias: number
  le_tocaria_hoy: { user_id: number; nombre: string; email: string; ultima_entrada: string; dias: number | null }[]
  testers: { grupo: string; cuentas: number }
}

export const getRecordatorioAuto = (orgId: number, t: string) =>
  pedir<RecordatorioAuto>(`panel/org/${orgId}/recordatorio-auto`, 'GET', null, t)

export const guardarRecordatorioAuto = (orgId: number, activo: boolean, t: string) =>
  pedir<{ activo: boolean }>(`panel/org/${orgId}/recordatorio-auto`, 'PUT', { activo }, t)

export const vistaRecordatorioAuto = (orgId: number, datos: { asunto: string; texto: string; a_mi?: boolean }, t: string) =>
  pedir<{ para: string; asunto: string; html: string }>(`panel/org/${orgId}/recordatorio-auto/vista`, 'POST', datos, t)

/** El correo de Rida al reservar una llamada (apps/api/src/services/contactos/correo_reserva.py). */
export interface CorreoReserva {
  activo: boolean
  asunto: string
  texto: string
  cambiado_en: string
  por: string
  de_fabrica: { asunto: string; texto: string }
  huecos: string[]
  conexion: { conectado: boolean; motivo: string; plan?: boolean; alcance?: 'organization' | 'user' }
  ultimo_aviso: { at: string; ok: boolean; que: string } | null
  enviados: number
}

export const getCorreoReserva = (orgId: number, t: string) =>
  pedir<CorreoReserva>(`panel/org/${orgId}/correo-reserva`, 'GET', null, t)

export const guardarCorreoReserva = (orgId: number, datos: { activo?: boolean; asunto?: string; texto?: string }, t: string) =>
  pedir<CorreoReserva>(`panel/org/${orgId}/correo-reserva`, 'PUT', datos, t)

export const vistaCorreoReserva = (orgId: number, datos: { asunto: string; texto: string; a_mi?: boolean }, t: string) =>
  pedir<{ para: string; asunto: string; html: string }>(`panel/org/${orgId}/correo-reserva/vista`, 'POST', datos, t)

export const conectarCorreoReserva = (orgId: number, t: string) =>
  pedir<CorreoReserva>(`panel/org/${orgId}/correo-reserva/conectar`, 'POST', {}, t)

export const enviarRecordatorio = (
  orgId: number,
  userId: number,
  datos: { tipo: TipoRecordatorio; asunto: string; texto: string; a_mi?: boolean },
  t: string
) => pedir<{ ok: boolean; para: string; asunto: string; prueba: boolean }>(`panel/org/${orgId}/recordatorio/${userId}`, 'POST', datos, t)

export const getAlumnosProgreso = (orgId: number, t: string) =>
  pedir<{ alumnos: AlumnoProgreso[]; total_clases: number }>(`panel/org/${orgId}/alumnos`, 'GET', null, t)

/** El camino de 16 semanas de cada alumno (apps/api/src/services/panel/camino.py). */
export type EstadoCamino = 'en-curso' | 'ultimas' | 'terminado' | 'sin-empezar' | 'sin-fecha'

export interface AlumnoCamino {
  user_id: number
  nombre: string
  email: string
  grupos: string[]
  /** El día que entró (AAAA-MM-DD, hora de Países Bajos). */
  entro: string
  semana: number
  /** Último día de la semana 16. */
  termina: string
  estado: EstadoCamino
  dias_quedan: number | null
  /** Clases en directo a las que fue (sala de la escuela, 10 min o más). */
  clases_directo: number
  clases_por_curso: { curso: string; n: number }[]
}

export const getCamino = (orgId: number, t: string) =>
  pedir<{
    semanas: number
    hoy: string
    alumnos: AlumnoCamino[]
    cursos: { uuid: string; nombre: string }[]
    minimo_min: number
    aviso: string
  }>(`panel/org/${orgId}/camino`, 'GET', null, t)

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

/** Un anuncio concreto (utm_content): el nombre que manda Meta, congelado al
 *  publicar, y el que se le ha puesto en la escuela (vacío si ninguno). */
export interface AnuncioVisto {
  meta: string
  nombre: string
  leads: number
  ventas: number
  primero: string
  ultimo: string
}

export interface PanelAds {
  campanas: Campana[]
  anuncios: AnuncioVisto[]
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
export const nombrarAnuncio = (orgId: number, meta: string, nombre: string, t: string) =>
  pedir<{ ok: boolean; nombre: string }>(`panel/org/${orgId}/ads/nombre`, 'PUT', { meta, nombre }, t)

// ── Tandas y grupos (25/10/2026, apps/api/src/services/panel/tandas.py) ──

export interface AccesoRecurso {
  nombre: string
  uuid: string
  grupos: string[]
  /** «Todo el mundo», «Solo Beta», «Todos los que han entrado»… */
  texto: string
  /** Algo raro, p. ej. con grupo pero marcado como público. */
  aviso: string
}

export interface GrupoTanda {
  id: number
  nombre: string
  personas: number
  alumnos: number
  es_programa: boolean
  es_beta: boolean
  es_tanda: boolean
}

/** Un alumno que ha entrado desde el día del cambio. */
export interface AlumnoNuevo {
  id: number
  nombre: string
  email: string
  /** Cuándo pagó (ISO, UTC). */
  entro: string
  /** '' = por decidir (venía de antes del cambio: «Por pagar», señal o enlace). */
  programa: '' | 'nuevo' | 'beta' | 'los dos'
  /** Por qué podría ser de la beta («Estaba en «Por pagar» desde el 20/10…»). */
  motivo: string
  /** El botón que se marca: la beta si hay motivo. Decide el equipo. */
  sugerencia?: 'nuevo' | 'beta'
}

export interface Tandas {
  activo: boolean
  desde: string
  programa_id: number
  tanda: string
  tanda_de_hoy: string
  grupos: GrupoTanda[]
  alumnos: number
  alumnos_sin_grupo: number
  nuevos: AlumnoNuevo[]
  por_decidir: number
  cursos: AccesoRecurso[]
  canales: AccesoRecurso[]
}

export const getTandas = (orgId: number, t: string) => pedir<Tandas>(`panel/org/${orgId}/tandas`, 'GET', null, t)

export const guardarTandas = (orgId: number, cambios: { activo?: boolean; desde?: string; tanda?: string }, t: string) =>
  pedir<Tandas>(`panel/org/${orgId}/tandas`, 'PUT', cambios, t)

export const meterEnBeta = (orgId: number, t: string) =>
  pedir<{ ok: boolean; grupo: string; entran: number; total: number }>(`panel/org/${orgId}/tandas/beta`, 'POST', {}, t)

export const getPorDecidir = (orgId: number, t: string) =>
  pedir<{ n: number; alumnos: { id: number; nombre: string; entro: string }[] }>(`panel/org/${orgId}/tandas/por-decidir`, 'GET', null, t)

export const decidirPrograma = (orgId: number, userId: number, a: 'nuevo' | 'beta', t: string) =>
  pedir<{ ok: boolean; programa: string; grupos: string[] }>(`panel/org/${orgId}/tandas/decidir`, 'POST', { user_id: userId, a }, t)
