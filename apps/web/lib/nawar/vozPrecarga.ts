/**
 * Audios de la voz de la escuela (/api/tts) pedidos por adelantado (19/11/2026).
 *
 * Nació en la «Lectura semanal» («tarda unos segundos al pulsar escuchar»):
 * la pantalla pide los audios mientras se lee y, al pulsar, suenan al
 * momento. Ahora vive aquí para usarlo también en las lecciones (flashcards
 * y vocabulario), donde se piden las 2-3 palabras siguientes.
 *
 * La caché va por la DIRECCIÓN entera de /api/tts, no por el texto: así un
 * mismo texto con otra voz (los diálogos mandan `voice`) o con otra etiqueta
 * de caché (`vt`) nunca se confunde con otro. Cada pantalla pasa la dirección
 * que ya usaba (`url`), y lo que no está pedido suena como siempre.
 *
 * Se pide de uno en uno, con prioridad baja, y se puede cortar (al salir de la
 * pantalla). Si algo falla, no pasa nada: se pide al pulsar, como antes.
 */

/** La dirección de la lectura semanal (la de siempre: texto recortado a 790). */
export const urlVoz = (texto: string) => `/api/tts?text=${encodeURIComponent(texto.slice(0, 790))}`

// dirección → objectURL del audio ya bajado
const listos = new Map<string, string>()
// dirección → petición en curso (dos pantallas pidiendo lo mismo, una sola)
const pidiendo = new Map<string, Promise<string | null>>()

/** El audio ya bajado de ese texto (o de esa dirección), o `undefined`. */
export function audioListo(texto: string, url: string = urlVoz(texto)): string | undefined {
  return listos.get(url)
}

/** Pide el audio y lo guarda; devuelve el objectURL o `null` si no se pudo. */
export function pedirAudio(texto: string, url: string = urlVoz(texto)): Promise<string | null> {
  const ya = listos.get(url)
  if (ya) return Promise.resolve(ya)
  const enCurso = pidiendo.get(url)
  if (enCurso) return enCurso
  const p = fetch(url, { priority: 'low' } as RequestInit)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => {
      if (!b || !b.size) return null
      const obj = URL.createObjectURL(b)
      listos.set(url, obj)
      return obj
    })
    .catch(() => null)
    .finally(() => pidiendo.delete(url))
  pidiendo.set(url, p)
  return p
}

/** Lo que se va a pedir: sin vacíos, sin repetir y como mucho `max`. */
export function colaDePrecarga(textos: (string | null | undefined)[], max = 60): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const t of textos) {
    if (!t || !t.trim() || vistos.has(t)) continue
    vistos.add(t)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** Los `cuantos` elementos que vienen a partir de `desde` (incluido). */
export function siguientes<T>(lista: T[], desde: number, cuantos: number): T[] {
  if (!Array.isArray(lista) || cuantos <= 0) return []
  const i = Math.max(0, desde)
  return lista.slice(i, i + cuantos)
}

export type OpcionesPrecarga = {
  /** La dirección de cada texto (de serie, la de la lectura semanal). */
  url?: (texto: string) => string
  /** Cuántos como mucho (de serie 60). */
  max?: number
  /** Espera antes de empezar, en ms (de serie 600: primero lo de la pantalla). */
  retraso?: number
}

/**
 * Pide los audios de uno en uno, en segundo plano. Devuelve la función que lo
 * corta (para el `useEffect`): lo que ya iba en camino termina y se guarda,
 * pero no se empieza nada más.
 */
export function precargarVoz(textos: string[], opciones: OpcionesPrecarga = {}): () => void {
  const { url = urlVoz, max = 60, retraso = 600 } = opciones
  let vivo = true
  const cola = colaDePrecarga(textos, max)
  const siguiente = async () => {
    while (vivo && cola.length) {
      const t = cola.shift() as string
      await pedirAudio(t, url(t))
    }
  }
  const id = setTimeout(siguiente, retraso)
  return () => {
    vivo = false
    clearTimeout(id)
  }
}

/** Solo para los tests: vacía la caché. */
export function _vaciarParaTests() {
  listos.clear()
  pidiendo.clear()
}
