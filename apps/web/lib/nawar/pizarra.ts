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
  // Las páginas del PDF que faltan van EN SU SITIO, por número (22/11/2026):
  // delante de la primera página del PDF con un número mayor y, si no hay,
  // detrás de la última página del PDF (las páginas en blanco del final se
  // quedan al final). Antes iban todas al final: al pasar las notas de una
  // presentación a otra, la página en blanco de notas quedaba en medio.
  for (let n = 1; n <= paginasPdf; n++) {
    if (vistas.has(n)) continue
    const nueva: PaginaPizarra = { origen: n, trazos: [] }
    let donde = paginas.findIndex((p) => p.origen != null && p.origen > n)
    if (donde < 0) {
      let ultima = -1
      paginas.forEach((p, k) => {
        if (p.origen != null) ultima = k
      })
      // Sin ninguna página del PDF todavía (venían de la pizarra en blanco): el PDF, delante.
      donde = ultima >= 0 ? ultima + 1 : 0
    }
    paginas.splice(donde, 0, nueva)
  }
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

/** Un rectángulo en coordenadas de 0 a 1 de la página. */
export interface Caja01 {
  x: number
  y: number
  w: number
  h: number
}

/** El hueco de una línea dibujada (con su grosor), de 0 a 1. */
export function cajaDeLinea(l: TrazoLinea, alto: number): Caja01 {
  let x0 = 1
  let y0 = 1
  let x1 = 0
  let y1 = 0
  for (let i = 0; i + 1 < l.p.length; i += 2) {
    x0 = Math.min(x0, l.p[i])
    x1 = Math.max(x1, l.p[i])
    y0 = Math.min(y0, l.p[i + 1])
    y1 = Math.max(y1, l.p[i + 1])
  }
  const mx = l.grosor / 2
  const my = alto > 0 ? l.grosor / 2 / alto : mx
  return { x: x0 - mx, y: y0 - my, w: x1 - x0 + mx * 2, h: y1 - y0 + my * 2 }
}

/**
 * Qué trazo hay en (x, y) para moverlo (16/11/2026): primero los textos (el de
 * más arriba), luego lo dibujado a lápiz y por último el rotulador, que va
 * debajo de todo. `cajaTexto` da el hueco de cada texto en 0-1 (lo mide la
 * pantalla con la letra de verdad); `margen`, cuánto se perdona alrededor.
 * Con `soloTextos`, las líneas no cuentan (la herramienta Texto). -1 = nada.
 */
export function trazoEnPunto(
  trazos: Trazo[],
  x: number,
  y: number,
  alto: number,
  cajaTexto: (t: TrazoTexto) => Caja01 | null,
  opciones: { margen?: number; radio?: number; soloTextos?: boolean } = {}
): number {
  const m = opciones.margen ?? 0.006
  const my = alto > 0 ? m / alto : m
  for (let i = trazos.length - 1; i >= 0; i--) {
    const t = trazos[i]
    if (t.t !== 'texto') continue
    const c = cajaTexto(t)
    if (c && x >= c.x - m && x <= c.x + c.w + m && y >= c.y - my && y <= c.y + c.h + my) return i
  }
  if (opciones.soloTextos) return -1
  const radio = opciones.radio ?? 0.012
  for (const tipo of ['lapiz', 'rotulador'] as const) {
    for (let i = trazos.length - 1; i >= 0; i--) {
      const t = trazos[i]
      if (t.t === tipo && tocaLinea(t, x, y, radio, alto)) return i
    }
  }
  return -1
}

/**
 * El trazo movido (dx, dy) en 0-1, sin salirse de la página: un texto, por su
 * esquina (como siempre, hasta 0,98); una línea, entera (ningún punto fuera).
 */
export function moverTrazo(t: Trazo, dx: number, dy: number): Trazo {
  if (t.t === 'texto') {
    return { ...t, x: r4(Math.max(0, Math.min(0.98, t.x + dx))), y: r4(Math.max(0, Math.min(0.98, t.y + dy))) }
  }
  let x0 = 1
  let x1 = 0
  let y0 = 1
  let y1 = 0
  for (let i = 0; i + 1 < t.p.length; i += 2) {
    x0 = Math.min(x0, t.p[i])
    x1 = Math.max(x1, t.p[i])
    y0 = Math.min(y0, t.p[i + 1])
    y1 = Math.max(y1, t.p[i + 1])
  }
  const ddx = Math.max(-x0, Math.min(1 - x1, dx))
  const ddy = Math.max(-y0, Math.min(1 - y1, dy))
  return { ...t, p: t.p.map((v, i) => r4(v + (i % 2 === 0 ? ddx : ddy))) }
}

// ── Cambiar lo que ya está escrito (18/11/2026: «agrandar o achicar un
// texto como en Canva, una vez escrito y clicado» y «cambiar el color no
// funciona»). Todo devuelve un trazo nuevo: el viejo queda para Deshacer.

/** Los límites del tamaño: un texto ni minúsculo ni más grande que media página. */
export const TAM_TEXTO = { min: 0.01, max: 0.16 } as const
export const GROSOR_LINEA = { min: 0.0012, max: 0.045 } as const

const entre = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

/** El mismo trazo con otro color. */
export function recolorear(t: Trazo, color: string): Trazo {
  return { ...t, color }
}

/**
 * El trazo más grande o más pequeño alrededor del punto (ax, ay), en 0-1 de
 * la página, como al estirar una esquina en Canva: ese punto (la esquina de
 * enfrente) no se mueve. Un texto cambia el tamaño de la letra; un dibujo,
 * sus puntos y su grosor. Si el tamaño llega al límite, se para ahí.
 */
export function escalarTrazo(t: Trazo, s: number, ax: number, ay: number): Trazo {
  if (!isFinite(s) || s <= 0) return t
  if (t.t === 'texto') {
    const tam = entre(t.tam * s, TAM_TEXTO.min, TAM_TEXTO.max)
    const k = tam / t.tam
    return { ...t, tam: r4(tam), x: r4(entre(ax + (t.x - ax) * k, 0, 0.98)), y: r4(entre(ay + (t.y - ay) * k, 0, 0.98)) }
  }
  // Como mucho, del tamaño de la página entera.
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0
  for (let i = 0; i + 1 < t.p.length; i += 2) {
    x0 = Math.min(x0, t.p[i])
    x1 = Math.max(x1, t.p[i])
    y0 = Math.min(y0, t.p[i + 1])
    y1 = Math.max(y1, t.p[i + 1])
  }
  const lado = Math.max(x1 - x0, y1 - y0)
  if (lado > 0 && lado * s > 1) s = 1 / lado
  const grosor = r4(entre(t.grosor * s, GROSOR_LINEA.min, GROSOR_LINEA.max))
  const p = t.p.map((v, i) => r4(i % 2 === 0 ? ax + (v - ax) * s : ay + (v - ay) * s))
  // Si se ha salido de la página, se mete dentro sin cambiar la forma.
  return moverTrazo({ ...t, grosor, p }, 0, 0)
}

/**
 * Cuánto se estira al arrastrar una esquina: la distancia del punto fijo (ax,
 * ay) al dedo, entre la que había hasta la esquina (cx, cy). Las cuentas, en
 * unidades del ancho (`alto` = alto / ancho de la página), para que una
 * página vertical no estire más hacia abajo que hacia el lado.
 */
export function factorEscala(ax: number, ay: number, cx: number, cy: number, px: number, py: number, alto: number): number {
  const antes = Math.hypot(cx - ax, (cy - ay) * alto)
  if (antes < 1e-6) return 1
  // Solo cuenta lo que se aleja en la dirección de la esquina (como Canva).
  const ux = (cx - ax) / antes
  const uy = ((cy - ay) * alto) / antes
  const ahora = (px - ax) * ux + (py - ay) * alto * uy
  return entre(ahora / antes, 0.05, 20)
}

/** Un poco más grande o más pequeño (los botones − y +), desde su esquina de arriba. */
export function cambiarTamano(t: Trazo, factor: number): Trazo {
  if (t.t === 'texto') return escalarTrazo(t, factor, t.x, t.y)
  return { ...t, grosor: r4(entre(t.grosor * factor, GROSOR_LINEA.min, GROSOR_LINEA.max)) }
}

/** Una copia un poco más abajo y a la derecha (como «Duplicar» en Canva). */
export function duplicarTrazo(t: Trazo, d = 0.025): Trazo {
  return moverTrazo(t.t === 'texto' ? { ...t } : { ...t, p: t.p.slice() }, d, d)
}

/** Las cuatro esquinas de una caja, y la de enfrente de cada una. */
export type Esquina = 'no' | 'ne' | 'so' | 'se'
export function esquinas(c: Caja01): Record<Esquina, { x: number; y: number; fija: { x: number; y: number } }> {
  const no = { x: c.x, y: c.y }
  const ne = { x: c.x + c.w, y: c.y }
  const so = { x: c.x, y: c.y + c.h }
  const se = { x: c.x + c.w, y: c.y + c.h }
  return { no: { ...no, fija: se }, ne: { ...ne, fija: so }, so: { ...so, fija: ne }, se: { ...se, fija: no } }
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
