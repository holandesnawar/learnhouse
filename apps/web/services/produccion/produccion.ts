/**
 * Los tableros de producción de la formación (19/11/2026): como el Deck de
 * Nextcloud, dentro de la escuela. La API está en
 * apps/api/src/routers/produccion.py y la explicación entera en
 * apps/api/src/services/produccion/tableros.py.
 */
import { getAPIUrl } from '@services/config/config'

export interface Etiqueta {
  id: number
  curso_id: number
  nombre: string
  color: string
  orden: number
}

export interface TableroResumen {
  id: number
  curso_id: number
  titulo: string
  color: string
  orden: number
  archivado: boolean
  origen: string
  updated_at: string
  total: number
  hechas: number
  vencidas: number
}

export interface Curso {
  id: number
  nombre: string
  color: string
  plantilla: string
  orden: number
  archivado: boolean
  etiquetas: Etiqueta[]
  tableros: TableroResumen[]
}

export interface Miembro {
  id: number
  nombre: string
  rol: string
  avatar: string
}

export interface Asignado {
  id: number
  nombre: string
}

export interface Columna {
  id: number
  tablero_id: number
  titulo: string
  orden: number
}

export interface Tarjeta {
  id: number
  tablero_id: number
  columna_id: number
  titulo: string
  orden: number
  vence: string
  hecha_at: string
  archivada: boolean
  etiquetas: number[]
  asignados: Asignado[]
  n_enlaces: number
  n_adjuntos: number
  n_comentarios: number
  tiene_descripcion: boolean
  created_at: string
  updated_at: string
}

export interface Enlace {
  id: string
  titulo: string
  url: string
}

export interface Adjunto {
  id: string
  nombre: string
  ext: string
  tamano: number
  subido: string
  por: string
}

export interface Comentario {
  id: number
  user_id: number
  autor: string
  texto: string
  created_at: string
  editado_at: string
}

export interface TarjetaCompleta extends Tarjeta {
  descripcion: string
  enlaces: Enlace[]
  adjuntos: Adjunto[]
  creado_por: string
  creado_por_id: number
  actualizado_por: string
  origen: string
  comentarios?: Comentario[]
}

export interface TarjetaEnLista extends Tarjeta {
  tablero: string
  tablero_color: string
  curso: string
  curso_id: number
  mia?: boolean
  vencida?: boolean
}

export interface Todo {
  cursos: Curso[]
  miembros: Miembro[]
  yo: { id: number; admin: boolean }
}

export interface VistaTablero {
  tablero: TableroResumen
  columnas: Columna[]
  tarjetas: Tarjeta[]
  n_archivadas: number
}

export interface TableroNextcloud {
  id: number
  titulo: string
  color: string
  archivado: boolean
}

export interface ResultadoImportar {
  tableros: { id: number; titulo: string; tablero_id?: number; creado?: boolean; nuevas?: number; ya_estaban?: number; avisos?: string[]; error?: string }[]
}

const base = () => `${getAPIUrl()}produccion/org`

async function pedir<T>(url: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`
    throw new Error(detalle)
  }
  return datos as T
}

export const getTodo = (org: number, t: string) => pedir<Todo>(`${base()}/${org}`, t)
export const getProximas = (org: number, mias: boolean, t: string) => pedir<TarjetaEnLista[]>(`${base()}/${org}/proximas?mias=${mias}`, t)
export const buscarTarjetas = (org: number, q: string, t: string) => pedir<TarjetaEnLista[]>(`${base()}/${org}/buscar?q=${encodeURIComponent(q)}`, t)

export type CambioCurso = Partial<Pick<Curso, 'nombre' | 'color' | 'plantilla' | 'orden' | 'archivado'>>
export const crearCurso = (org: number, d: CambioCurso, t: string) => pedir<Curso>(`${base()}/${org}/cursos`, t, 'POST', d)
export const cambiarCurso = (org: number, id: number, d: CambioCurso, t: string) => pedir<Curso>(`${base()}/${org}/cursos/${id}`, t, 'PUT', d)
export const borrarCurso = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/cursos/${id}`, t, 'DELETE')

export const crearEtiqueta = (org: number, curso: number, d: { nombre: string; color?: string }, t: string) =>
  pedir<Etiqueta>(`${base()}/${org}/cursos/${curso}/etiquetas`, t, 'POST', d)
export const cambiarEtiqueta = (org: number, id: number, d: { nombre?: string; color?: string }, t: string) =>
  pedir<Etiqueta>(`${base()}/${org}/etiquetas/${id}`, t, 'PUT', d)
export const borrarEtiqueta = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/etiquetas/${id}`, t, 'DELETE')

export type CambioTablero = Partial<Pick<TableroResumen, 'curso_id' | 'titulo' | 'color' | 'orden' | 'archivado'>>
export const crearTablero = (org: number, d: CambioTablero, t: string) => pedir<TableroResumen>(`${base()}/${org}/tableros`, t, 'POST', d)
export const getTablero = (org: number, id: number, t: string) => pedir<VistaTablero>(`${base()}/${org}/tableros/${id}`, t)
export const getArchivadas = (org: number, id: number, t: string) => pedir<Tarjeta[]>(`${base()}/${org}/tableros/${id}/archivadas`, t)
export const cambiarTablero = (org: number, id: number, d: CambioTablero, t: string) => pedir<TableroResumen>(`${base()}/${org}/tableros/${id}`, t, 'PUT', d)
export const duplicarTablero = (org: number, id: number, d: { titulo: string; curso_id: number; con_tarjetas: boolean }, t: string) =>
  pedir<TableroResumen>(`${base()}/${org}/tableros/${id}/duplicar`, t, 'POST', d)
export const borrarTablero = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/tableros/${id}`, t, 'DELETE')

export const crearColumna = (org: number, tablero: number, titulo: string, t: string) =>
  pedir<Columna>(`${base()}/${org}/tableros/${tablero}/columnas`, t, 'POST', { titulo })
export const cambiarColumna = (org: number, id: number, d: { titulo?: string; orden?: number }, t: string) =>
  pedir<Columna>(`${base()}/${org}/columnas/${id}`, t, 'PUT', d)
export const borrarColumna = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/columnas/${id}`, t, 'DELETE')

export const crearTarjeta = (org: number, tablero: number, columna_id: number, titulo: string, t: string) =>
  pedir<TarjetaCompleta>(`${base()}/${org}/tableros/${tablero}/tarjetas`, t, 'POST', { columna_id, titulo })
export const getTarjeta = (org: number, id: number, t: string) => pedir<TarjetaCompleta>(`${base()}/${org}/tarjetas/${id}`, t)

export interface CambioTarjeta {
  titulo?: string
  descripcion?: string
  vence?: string
  hecha?: boolean
  archivada?: boolean
  etiquetas?: number[]
  asignados?: (number | Asignado)[]
  enlaces?: { id?: string; titulo: string; url: string }[]
  columna_id?: number
  tablero_id?: number
  orden?: number
}
export const cambiarTarjeta = (org: number, id: number, d: CambioTarjeta, t: string) =>
  pedir<TarjetaCompleta>(`${base()}/${org}/tarjetas/${id}`, t, 'PUT', d)
export const borrarTarjeta = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/tarjetas/${id}`, t, 'DELETE')

export async function subirAdjunto(org: number, id: number, archivo: File, t: string): Promise<TarjetaCompleta> {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const res = await fetch(`${base()}/${org}/tarjetas/${id}/adjuntos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}` },
    credentials: 'include',
    body: fd,
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : `Error ${res.status}`)
  return datos as TarjetaCompleta
}

/** Abre un adjunto: se pide con la sesión (no hay enlace público). */
export async function abrirAdjunto(org: number, id: number, adjunto: string, t: string): Promise<string | null> {
  const res = await fetch(`${base()}/${org}/tarjetas/${id}/adjuntos/${adjunto}`, {
    headers: { Authorization: `Bearer ${t}` },
    credentials: 'include',
  })
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}
export const borrarAdjunto = (org: number, id: number, adjunto: string, t: string) =>
  pedir<TarjetaCompleta>(`${base()}/${org}/tarjetas/${id}/adjuntos/${adjunto}`, t, 'DELETE')

export const comentar = (org: number, id: number, texto: string, t: string) =>
  pedir<Comentario>(`${base()}/${org}/tarjetas/${id}/comentarios`, t, 'POST', { texto })
export const cambiarComentario = (org: number, id: number, texto: string, t: string) =>
  pedir<Comentario>(`${base()}/${org}/comentarios/${id}`, t, 'PUT', { texto })
export const borrarComentario = (org: number, id: number, t: string) => pedir<{ ok: boolean }>(`${base()}/${org}/comentarios/${id}`, t, 'DELETE')

export interface DatosNextcloud {
  url: string
  usuario: string
  clave: string
  curso_id?: number
  tableros?: number[]
  con_archivadas?: boolean
}
export const listarNextcloud = (org: number, d: DatosNextcloud, t: string) =>
  pedir<TableroNextcloud[]>(`${base()}/${org}/nextcloud/tableros`, t, 'POST', d)
export const importarNextcloud = (org: number, d: DatosNextcloud, t: string) =>
  pedir<ResultadoImportar>(`${base()}/${org}/nextcloud/importar`, t, 'POST', d)
