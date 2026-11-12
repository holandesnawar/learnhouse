/**
 * La pizarra de clase (10/11/2026): lo que el profe escribe encima de la
 * presentación. Aquí solo la parte que no necesita pantalla (con test); el
 * dibujo está en `components/Pages/Pizarra/`. La explicación entera, en
 * `apps/api/src/services/tareas/pizarra.py`.
 *
 * Todo va en coordenadas de 0 a 1 de la página (x sobre el ancho, y sobre el
 * alto) y los tamaños como fracción del ANCHO: así lo escrito en un portátil
 * se ve igual en un proyector, en el móvil y en el PDF que se guarda.
 */

export type Herramienta = 'mover' | 'lapiz' | 'rotulador' | 'texto' | 'borrador' | 'mano'
export type EstiloTexto = 'texto' | 'titulo' | 'nota'

export interface TrazoLinea {
  t: 'lapiz' | 'rotulador'
  color: string
  /** Grosor como fracción del ancho de la página. */
  grosor: number
  /** x, y, x, y… de 0 a 1. */
  p: number[]
}

export interface TrazoTexto {
  t: 'texto'
  x: number
  y: number
  texto: string
  color: string
  /** Tamaño de la letra como fracción del ancho de la página. */
  tam: number
  estilo: EstiloTexto
}

export type Trazo = TrazoLinea | TrazoTexto

export interface PaginaPizarra {
  /** Página del PDF (desde 1) o null si es una página en blanco para notas. */
  origen: number | null
  /** No sale en la versión de los alumnos. */
  oculta?: boolean
  titulo?: string
  trazos: Trazo[]
}

export interface DocPizarra {
  v: 1
  paginas: PaginaPizarra[]
}

/** Los colores de la escuela para escribir (el primero, el de serie). */
export const COLORES = ['#0b2da0', '#0a1656', '#D92D20', '#16A34A', '#F59E0B'] as const
export const COLORES_ROTULADOR = ['#4da3ff', '#FDE047', '#86EFAC', '#FDA4AF'] as const
export const GROSORES = { fino: 0.0022, medio: 0.0042, grueso: 0.008 } as const
export const GROSOR_ROTULADOR = 0.022
export const TAMANOS = { pequeno: 0.018, normal: 0.026, grande: 0.04 } as const

export function docInicial(paginasPdf: number): DocPizarra {
  return { v: 1, paginas: Array.from({ length: Math.max(0, paginasPdf) }, (_, i) => ({ origen: i + 1, trazos: [] })) }
}

/**
 * Lo guardado, ajustado al PDF de ahora: si el PDF tiene más páginas que
 * cuando se escribió (se subió otra versión), las nuevas se añaden al final;
 * las que ya no existen se quitan salvo que tengan algo escrito (pasan a ser
 * páginas en blanco, para no perder las notas).
 */
export function ajustarAlPdf(doc: DocPizarra | null | undefined, paginasPdf: number): DocPizarra {
  if (!doc || !Array.isArray(doc.paginas) || doc.paginas.length === 0) return docInicial(paginasPdf)
  const vistas = new Set<number>()
  const paginas: PaginaPizarra[] = []
  for (const pg of doc.paginas) {
    const trazos = Array.isArray(pg.trazos) ? pg.trazos.filter(esTrazo) : []
    if (pg.origen == null) {
      paginas.push({ ...pg, origen: null, trazos })
    } else if (pg.origen >= 1 && pg.origen <= paginasPdf && !vistas.has(pg.origen)) {
      vistas.add(pg.origen)
      paginas.push({ ...pg, trazos })
    } else if (trazos.length) {
      paginas.push({ origen: null, titulo: pg.titulo, oculta: pg.oculta, trazos })
    }
  }
  for (let n = 1; n <= paginasPdf; n++) if (!vistas.has(n)) paginas.push({ origen: n, trazos: [] })
  return { v: 1, paginas }
}

function esTrazo(t: any): t is Trazo {
  if (!t || typeof t !== 'object') return false
  if (t.t === 'texto') return typeof t.texto === 'string' && isFinite(t.x) && isFinite(t.y)
  return (t.t === 'lapiz' || t.t === 'rotulador') && Array.isArray(t.p) && t.p.length >= 2
}

/** Las páginas que verán los alumnos, en su orden. */
export function paraLosAlumnos(doc: DocPizarra): PaginaPizarra[] {
  return doc.paginas.filter((p) => !p.oculta)
}

export function hayAlgoEscrito(doc: DocPizarra): boolean {
  return doc.paginas.some((p) => p.trazos.length > 0 || p.origen == null || p.oculta)
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Quita los puntos que no aportan (más cerca que `min` del anterior) y
 * redondea: un trazo largo pasa de miles de números a unos cientos sin que
 * se note. Conserva siempre el primero y el último.
 */
export function simplificar(p: number[], min = 0.0015): number[] {
  if (p.length <= 4) return p.map(r4)
  const out = [r4(p[0]), r4(p[1])]
  let ux = p[0]
  let uy = p[1]
  for (let i = 2; i < p.length - 2; i += 2) {
    const dx = p[i] - ux
    const dy = p[i + 1] - uy
    if (dx * dx + dy * dy >= min * min) {
      out.push(r4(p[i]), r4(p[i + 1]))
      ux = p[i]
      uy = p[i + 1]
    }
  }
  out.push(r4(p[p.length - 2]), r4(p[p.length - 1]))
  return out
}

/** Distancia de un punto a un segmento, en las unidades que se le den. */
export function distanciaASegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * ¿El borrador (en x, y de 0 a 1) toca esta línea? `alto` es alto/ancho de la
 * página: las cuentas se hacen en unidades de ancho para que el radio sea
 * redondo y no un óvalo.
 */
export function tocaLinea(l: TrazoLinea, x: number, y: number, radio: number, alto: number): boolean {
  const px = x
  const py = y * alto
  const margen = radio + l.grosor / 2
  if (l.p.length === 2) return Math.hypot(px - l.p[0], py - l.p[1] * alto) <= margen
  for (let i = 0; i + 3 < l.p.length; i += 2) {
    if (distanciaASegmento(px, py, l.p[i], l.p[i + 1] * alto, l.p[i + 2], l.p[i + 3] * alto) <= margen) return true
  }
  return false
}

/** Las líneas de un texto: las que escribió el profe con Intro. */
export function lineasDe(texto: string): string[] {
  return (texto || '').replace(/\r/g, '').split('\n')
}

export const INTERLINEADO = 1.32

/** «Guardado hace un momento», «a las 18:42»… para la barra de arriba. */
export function horaCorta(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
