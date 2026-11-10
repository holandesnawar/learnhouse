/**
 * Cómo se pinta lo escrito en la pizarra de clase. UNA sola función para la
 * pantalla y para el PDF que se guarda: así lo que el profe ve mientras da la
 * clase es exactamente lo que luego ven los alumnos.
 */
import { INTERLINEADO, lineasDe, type Trazo, type TrazoLinea, type TrazoTexto } from '@/lib/nawar/pizarra'

export interface Letras {
  texto: string
  titulo: string
}

/** La letra de la escuela (Inter y Poppins), con el nombre que le pone Next. */
export function letrasDeLaEscuela(): Letras {
  const raiz = getComputedStyle(document.documentElement)
  const inter = raiz.getPropertyValue('--font-inter').trim()
  const poppins = raiz.getPropertyValue('--font-poppins').trim()
  const resto = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  return { texto: inter ? `${inter}, ${resto}` : resto, titulo: poppins ? `${poppins}, ${resto}` : resto }
}

export function letraDe(t: Pick<TrazoTexto, 'estilo' | 'tam'>, ancho: number, l: Letras): { font: string; px: number } {
  const px = Math.max(6, t.tam * ancho)
  if (t.estilo === 'titulo') return { font: `700 ${px}px ${l.titulo}`, px }
  return { font: `${t.estilo === 'nota' ? 500 : 600} ${px}px ${l.texto}`, px }
}

export interface Caja {
  x: number
  y: number
  w: number
  h: number
}

/** El hueco que ocupa un texto, en píxeles del lienzo (con su relleno si es una nota). */
export function cajaDeTexto(ctx: CanvasRenderingContext2D, t: TrazoTexto, ancho: number, alto: number, l: Letras): Caja {
  const { font, px } = letraDe(t, ancho, l)
  ctx.save()
  ctx.font = font
  const lineas = lineasDe(t.texto)
  const w = Math.max(px * 0.6, ...lineas.map((s) => ctx.measureText(s || ' ').width))
  ctx.restore()
  const h = lineas.length * px * INTERLINEADO
  const m = t.estilo === 'nota' ? px * 0.55 : 0
  return { x: t.x * ancho - m, y: t.y * alto - m, w: w + m * 2 + (t.estilo === 'nota' ? px * 0.25 : 0), h: h + m * 2 }
}

function pintarLinea(ctx: CanvasRenderingContext2D, t: TrazoLinea, ancho: number, alto: number) {
  const p = t.p
  if (p.length < 2) return
  ctx.save()
  ctx.strokeStyle = t.color
  ctx.fillStyle = t.color
  ctx.lineWidth = Math.max(1, t.grosor * ancho)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = t.t === 'rotulador' ? 0.38 : 1
  if (p.length === 2) {
    ctx.beginPath()
    ctx.arc(p[0] * ancho, p[1] * alto, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.beginPath()
  ctx.moveTo(p[0] * ancho, p[1] * alto)
  // Curvas por los puntos medios: la línea sale suave aunque los puntos sean pocos.
  for (let i = 2; i + 3 < p.length; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * ancho
    const my = ((p[i + 1] + p[i + 3]) / 2) * alto
    ctx.quadraticCurveTo(p[i] * ancho, p[i + 1] * alto, mx, my)
  }
  ctx.lineTo(p[p.length - 2] * ancho, p[p.length - 1] * alto)
  ctx.stroke()
  ctx.restore()
}

function pintarTexto(ctx: CanvasRenderingContext2D, t: TrazoTexto, ancho: number, alto: number, l: Letras) {
  const { font, px } = letraDe(t, ancho, l)
  ctx.save()
  if (t.estilo === 'nota') {
    const c = cajaDeTexto(ctx, t, ancho, alto, l)
    const r = px * 0.3
    ctx.fillStyle = '#F0F5FF'
    ctx.beginPath()
    ctx.roundRect(c.x, c.y, c.w, c.h, r)
    ctx.fill()
    ctx.fillStyle = t.color
    ctx.beginPath()
    ctx.roundRect(c.x, c.y, Math.max(2, px * 0.14), c.h, [r, 0, 0, r])
    ctx.fill()
  }
  ctx.font = font
  ctx.fillStyle = t.estilo === 'nota' ? '#0a1656' : t.color
  ctx.textBaseline = 'top'
  const dx = t.estilo === 'nota' ? px * 0.25 : 0
  // La línea de la letra, centrada en su renglón (como en la caja de escribir).
  const dy = (px * INTERLINEADO - px) / 2
  lineasDe(t.texto).forEach((s, i) => ctx.fillText(s, t.x * ancho + dx, t.y * alto + i * px * INTERLINEADO + dy))
  ctx.restore()
}

/** Pinta todos los trazos (menos `salvo`, el texto que se está escribiendo). */
export function pintarTrazos(ctx: CanvasRenderingContext2D, trazos: Trazo[], ancho: number, alto: number, l: Letras, salvo = -1) {
  // El rotulador, debajo: si no, taparía lo escrito a lápiz encima.
  trazos.forEach((t, i) => {
    if (i !== salvo && t.t === 'rotulador') pintarLinea(ctx, t, ancho, alto)
  })
  trazos.forEach((t, i) => {
    if (i === salvo) return
    if (t.t === 'lapiz') pintarLinea(ctx, t, ancho, alto)
    else if (t.t === 'texto') pintarTexto(ctx, t, ancho, alto, l)
  })
}

/** Una página en blanco para notas, con la cabecera de la escuela. */
export function pintarEnBlanco(ctx: CanvasRenderingContext2D, ancho: number, alto: number, titulo: string, tema: string, l: Letras) {
  ctx.save()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, ancho, alto)
  const m = ancho * 0.05
  ctx.fillStyle = '#0b2da0'
  ctx.fillRect(m, m * 0.9, ancho * 0.045, Math.max(2, ancho * 0.004))
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#0a1656'
  ctx.font = `700 ${ancho * 0.03}px ${l.titulo}`
  ctx.fillText(titulo || 'Notas de la clase', m, m * 1.15)
  if (tema) {
    ctx.fillStyle = '#5B6B8C'
    ctx.font = `500 ${ancho * 0.015}px ${l.texto}`
    ctx.textAlign = 'right'
    ctx.fillText(tema, ancho - m, m * 1.3)
  }
  ctx.strokeStyle = '#DDE6F5'
  ctx.lineWidth = Math.max(1, ancho * 0.0012)
  ctx.beginPath()
  ctx.moveTo(m, m * 2.15)
  ctx.lineTo(ancho - m, m * 2.15)
  ctx.stroke()
  ctx.restore()
}
