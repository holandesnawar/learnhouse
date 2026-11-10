/**
 * La matemática del recorte de una grabación de la sala (10/11/2026).
 *
 * El recorte es VIRTUAL: la grabación no se toca; se guarda qué TROZOS se
 * enseñan (`[desde, hasta]` en segundos). El editor trabaja al revés, con los
 * CORTES (lo que se quita), que es lo que se marca y se deshace. Aquí están
 * las cuentas de los dos lados; el servidor tiene las mismas en
 * apps/api/src/services/salas/estudio_grabaciones.py.
 */

export type Trozo = [number, number]

/** Lo mínimo que dura un trozo que se enseña o un corte. */
export const MINIMO = 1

const r2 = (n: number) => Math.round(n * 100) / 100

/** Pares en orden, sin solapes, dentro de la duración y de 1 s o más. */
export function ordenar(pares: readonly (readonly number[])[] | null | undefined, dur = 0): Trozo[] {
  const limpios: Trozo[] = []
  for (const p of pares || []) {
    let a = Number(p?.[0])
    let b = Number(p?.[1])
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    a = Math.max(0, a)
    if (dur > 0) b = Math.min(dur, b)
    if (b - a >= MINIMO) limpios.push([a, b])
  }
  limpios.sort((x, y) => x[0] - y[0] || x[1] - y[1])
  const out: Trozo[] = []
  for (const [a, b] of limpios) {
    const ultimo = out[out.length - 1]
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b)
    else out.push([a, b])
  }
  return out.map(([a, b]) => [r2(a), r2(b)])
}

/** Los trozos que se ven. Con duración y nada válido, la grabación entera. */
export function limpiarTrozos(trozos: readonly (readonly number[])[] | null | undefined, dur = 0): Trozo[] {
  const out = ordenar(trozos, dur)
  if (!out.length && dur >= MINIMO) return [[0, r2(dur)]]
  return out
}

/** Lo contrario: de lo que se ve a lo que se quita, y al revés. */
export function complemento(pares: readonly (readonly number[])[], dur: number): Trozo[] {
  const orden = ordenar(pares, dur)
  const out: Trozo[] = []
  let desde = 0
  for (const [a, b] of orden) {
    if (a - desde >= MINIMO) out.push([r2(desde), r2(a)])
    desde = Math.max(desde, b)
  }
  if (dur - desde >= MINIMO) out.push([r2(desde), r2(dur)])
  return out
}

/** Los cortes (lo que se quita) que corresponden a unos trozos guardados. */
export const cortesDe = (trozos: readonly (readonly number[])[] | null | undefined, dur: number): Trozo[] =>
  trozos && trozos.length ? complemento(trozos, dur) : []

/** Los trozos que se ven con esos cortes. Si se corta todo, ninguno. */
export const trozosDe = (cortes: readonly (readonly number[])[], dur: number): Trozo[] => complemento(cortes, dur)

/** Añade un corte (se funde con los que toque). */
export function cortar(cortes: readonly (readonly number[])[], desde: number, hasta: number, dur: number): Trozo[] {
  const a = Math.min(desde, hasta)
  const b = Math.max(desde, hasta)
  return ordenar([...cortes, [a, b]], dur)
}

/** «Empieza aquí»: se quita todo lo de antes. */
export function empiezaEn(cortes: readonly (readonly number[])[], t: number, dur: number): Trozo[] {
  // El principio de antes se sustituye por el nuevo (si empezaba más tarde, vuelve a enseñarse).
  const sinPrincipio = ordenar(cortes, dur).filter(([a]) => a > 0)
  return t >= MINIMO ? cortar(sinPrincipio, 0, t, dur) : sinPrincipio
}

/** «Termina aquí»: se quita todo lo de después. */
export function terminaEn(cortes: readonly (readonly number[])[], t: number, dur: number): Trozo[] {
  const sinFinal = ordenar(cortes, dur).filter(([, b]) => b < dur - 0.01)
  return dur - t >= MINIMO ? cortar(sinFinal, t, dur, dur) : sinFinal
}

/** Deshace UN corte (el que contiene ese segundo, o el de ese índice). */
export const sinCorte = (cortes: readonly (readonly number[])[], indice: number): Trozo[] =>
  cortes.filter((_, i) => i !== indice).map(([a, b]) => [a, b] as Trozo)

/** Los segundos que se ven. Sin trozos, la duración entera. */
export function duracionVisible(trozos: readonly (readonly number[])[] | null | undefined, dur = 0): number {
  if (!trozos || !trozos.length) return dur || 0
  return r2(trozos.reduce((n, [a, b]) => n + (b - a), 0))
}

/** De un segundo de lo que se ve al segundo de la grabación. */
export function aReal(trozos: readonly (readonly number[])[] | null | undefined, visible: number): number {
  let v = Math.max(0, visible || 0)
  if (!trozos || !trozos.length) return v
  for (const [a, b] of trozos) {
    if (v <= b - a) return r2(a + v)
    v -= b - a
  }
  return trozos[trozos.length - 1][1]
}

/** Al revés. Un segundo cortado cae al principio del trozo siguiente. */
export function aVisible(trozos: readonly (readonly number[])[] | null | undefined, real: number): number {
  const r = Math.max(0, real || 0)
  if (!trozos || !trozos.length) return r
  let antes = 0
  for (const [a, b] of trozos) {
    if (r < a) return r2(antes)
    if (r <= b) return r2(antes + (r - a))
    antes += b - a
  }
  return r2(antes)
}

/**
 * Dónde tiene que estar el vídeo si ahora está en `real`: el mismo sitio si se
 * ve; el principio del trozo siguiente si cae en un corte; `null` si ya no
 * queda nada que ver (se acabó esa parte).
 */
export function dondeSeguir(trozos: readonly (readonly number[])[] | null | undefined, real: number): number | null {
  if (!trozos || !trozos.length) return real
  for (const [a, b] of trozos) {
    if (real < a) return a
    // Un pelín antes del final ya cuenta como acabado: si no, el vídeo se
    // queda clavado en el último fotograma del trozo.
    if (real < b - 0.05) return real
  }
  return null
}

/** ¿Ese segundo está dentro de un corte? Devuelve su índice o -1. */
export const corteEn = (cortes: readonly (readonly number[])[], t: number): number =>
  cortes.findIndex(([a, b]) => t >= a && t < b)

// ── Varias partes (la sala cortó y volvió a grabar) ────────────────────────

export interface Parte {
  id: string
  dur: number
  trozos: Trozo[]
}

/** Lo que dura lo que se ve, sumando las partes. */
export const duracionDePartes = (partes: readonly Parte[]): number =>
  r2(partes.reduce((n, p) => n + duracionVisible(p.trozos, p.dur), 0))

/** De un segundo de TODO lo que se ve a (parte, segundo de esa grabación). */
export function aParte(partes: readonly Parte[], visible: number): { parte: number; real: number } {
  let v = Math.max(0, visible || 0)
  for (let i = 0; i < partes.length; i++) {
    const d = duracionVisible(partes[i].trozos, partes[i].dur)
    if (v < d || i === partes.length - 1) return { parte: i, real: aReal(partes[i].trozos, Math.min(v, d)) }
    v -= d
  }
  return { parte: 0, real: 0 }
}

/** Al revés: dónde cae en todo lo que se ve el segundo `real` de la parte `i`. */
export function deParte(partes: readonly Parte[], parte: number, real: number): number {
  let antes = 0
  for (let i = 0; i < parte && i < partes.length; i++) antes += duracionVisible(partes[i].trozos, partes[i].dur)
  const p = partes[parte]
  return r2(antes + (p ? aVisible(p.trozos, real) : 0))
}

// ── Para pintar ────────────────────────────────────────────────────────────

/** 75 → «1:15»; 3725 → «1:02:05». */
export function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(seg || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 3480 → «58 min»; 4500 → «1 h 15 min»; 40 → «40 s». */
export function duracionCorta(seg: number): string {
  const s = Math.max(0, Math.round(seg || 0))
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const PASOS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

/** Cada cuántos segundos va una marca de la regla para que quepan (≥ `minPx` entre marcas). */
export function pasoDeRegla(pxPorSegundo: number, minPx = 70): number {
  for (const p of PASOS) if (p * pxPorSegundo >= minPx) return p
  return PASOS[PASOS.length - 1]
}
