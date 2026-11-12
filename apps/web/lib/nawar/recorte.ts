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

// ── El editor: TODAS las partes en una sola línea (12/11/2026) ─────────────
//
// Usuario: "no veo el clip entero, solo 30 segundos". El editor abría la
// primera parte (31 s) y había que adivinar que la clase estaba en otra. Ahora
// trabaja con UNA línea de tiempo: las partes seguidas, cada una con su
// duración de la grabación (sin cortar). Los cortes se marcan sobre esa línea
// («global»), y una parte fuera es un corte que la cubre entera. Al publicar
// se reparten por parte, que es lo que guarda el servidor (no cambia).

/** Una parte en la línea: lo que dura su grabación. */
export interface Tramo {
  id: string
  dur: number
}

/** El segundo de la línea en que empieza cada parte. */
export function inicios(tramos: readonly Tramo[]): number[] {
  const out: number[] = []
  let n = 0
  for (const p of tramos) {
    out.push(r2(n))
    n += Math.max(0, p.dur || 0)
  }
  return out
}

/** Lo que mide la línea entera. */
export const totalDe = (tramos: readonly Tramo[]): number => r2(tramos.reduce((n, p) => n + Math.max(0, p.dur || 0), 0))

/**
 * De un segundo de la línea a (parte, segundo de esa grabación). En la raya
 * entre dos partes cae al principio de la siguiente; al final de todo, al
 * final de la última.
 */
export function deGlobal(tramos: readonly Tramo[], g: number): { parte: number; real: number } {
  if (!tramos.length) return { parte: 0, real: 0 }
  let antes = 0
  const t = Math.max(0, g || 0)
  for (let i = 0; i < tramos.length; i++) {
    const d = Math.max(0, tramos[i].dur || 0)
    if (t < antes + d || i === tramos.length - 1) return { parte: i, real: r2(Math.min(d, Math.max(0, t - antes))) }
    antes += d
  }
  return { parte: 0, real: 0 }
}

/** Al revés: el segundo `real` de la parte `i` en la línea. */
export const aGlobal = (tramos: readonly Tramo[], parte: number, real: number): number =>
  r2((inicios(tramos)[parte] ?? 0) + Math.max(0, real || 0))

/**
 * Los cortes de la línea a partir de lo guardado por parte: los trozos que se
 * enseñan de cada una (`null` = no tiene recorte) y si está fuera entera.
 */
export function cortesGlobales(
  tramos: readonly Tramo[],
  trozosPorParte: readonly (readonly (readonly number[])[] | null | undefined)[],
  fuera: readonly boolean[]
): Trozo[] {
  const ini = inicios(tramos)
  const todos: Trozo[] = []
  tramos.forEach((p, i) => {
    if (fuera[i]) {
      todos.push([ini[i], ini[i] + p.dur])
      return
    }
    for (const [a, b] of cortesDe(trozosPorParte[i], p.dur)) todos.push([ini[i] + a, ini[i] + b])
  })
  return ordenar(todos, totalDe(tramos))
}

/** Los cortes de la línea que caen en la parte `i`, en segundos de su grabación. */
export function cortesDeLaParte(cortes: readonly (readonly number[])[], tramos: readonly Tramo[], i: number): Trozo[] {
  const p = tramos[i]
  if (!p) return []
  const a0 = inicios(tramos)[i]
  const b0 = a0 + p.dur
  const out: Trozo[] = []
  for (const [a, b] of cortes) {
    const desde = Math.max(a, a0)
    const hasta = Math.min(b, b0)
    if (hasta > desde) out.push([desde - a0, hasta - a0])
  }
  return ordenar(out, p.dur)
}

/** ¿Se ve algo de la parte `i`? (Si está cortada entera, es como dejarla fuera.) */
export const seVeLaParte = (cortes: readonly (readonly number[])[], tramos: readonly Tramo[], i: number): boolean =>
  !!tramos[i] && trozosDe(cortesDeLaParte(cortes, tramos, i), tramos[i].dur).length > 0

/** Lo que se publica: cada parte que se ve, con sus trozos. Las cortadas enteras no van. */
export function trozosPorParte(cortes: readonly (readonly number[])[], tramos: readonly Tramo[]): { id: string; trozos: Trozo[] }[] {
  return tramos
    .map((p, i) => ({ id: p.id, trozos: trozosDe(cortesDeLaParte(cortes, tramos, i), p.dur) }))
    .filter((p) => p.trozos.length > 0)
}

/** Volver a enseñar de `desde` a `hasta` (lo contrario de cortar). */
export function descortar(cortes: readonly (readonly number[])[], desde: number, hasta: number, dur: number): Trozo[] {
  const a = Math.min(desde, hasta)
  const b = Math.max(desde, hasta)
  return complemento(ordenar([...complemento(cortes, dur), [a, b]], dur), dur)
}

/** Las partes que un corte de la línea se lleva enteras. */
export function partesEnteras(tramos: readonly Tramo[], corte: readonly number[]): number[] {
  const ini = inicios(tramos)
  const [a, b] = [Number(corte[0]), Number(corte[1])]
  return tramos.map((p, i) => (p.dur > 0 && a <= ini[i] + 0.5 && b >= ini[i] + p.dur - 0.5 ? i : -1)).filter((i) => i >= 0)
}

/** La hora del reloj: «17:25» + 13 min → «17:38». Sin hora válida, «». */
export function horaEn(hora: string | null | undefined, segundos: number): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || ''))
  if (!m) return ''
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.floor(Math.max(0, segundos || 0) / 60)
  const h = Math.floor(total / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** La parte con la grabación más larga (donde suele estar la clase). */
export function parteMasLarga(tramos: readonly Tramo[]): number {
  let mejor = 0
  tramos.forEach((p, i) => {
    if ((p.dur || 0) > (tramos[mejor]?.dur || 0)) mejor = i
  })
  return mejor
}

// ── Para pintar ────────────────────────────────────────────────────────────

/** 75 → «1:15»; 3725 → «1:02:05». Con `conHoras`, siempre con hora: 750 → «0:12:30». */
export function reloj(seg: number, conHoras = false): string {
  const s = Math.max(0, Math.floor(seg || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h || conHoras ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
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
