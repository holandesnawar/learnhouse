/**
 * Prepara una foto antes de subirla y sube con un tope de tiempo.
 *
 * Por qué (08/11/2026): una alumna con Chrome en el iPhone mandaba fotos de
 * sus ejercicios en Mensajes y la rueda giraba para siempre. Dos cosas:
 *  1. Una foto del móvil pesa 3-8 MB; con mala cobertura la subida se queda
 *     colgada y `fetch` no tiene tope de tiempo: nunca termina, nunca falla.
 *  2. Si la foto llega en HEIC (el formato del iPhone), el servidor solo
 *     acepta jpg/png/gif/webp y la rechaza.
 * Aquí la foto se reduce a 1600 px como mucho y se pasa a JPEG (pesa unos
 * 300-500 KB y se lee igual de bien), y la subida se corta a los 90 s con un
 * aviso claro. Si algo falla al reducirla, se manda la original tal cual.
 */

const LADO_MAXIMO = 1600
const CALIDAD = 0.82
const TOPE_SUBIDA_MS = 90_000

/** Formatos que el servidor acepta tal cual. */
const ACEPTADOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function esImagen(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

function cargar(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('no se pudo leer la foto'))
    }
    img.src = url
  })
}

/** Nombre de la foto con la extensión .jpg. */
export function nombreJpg(nombre: string): string {
  const base = (nombre || 'foto').replace(/\.[^./]+$/, '') || 'foto'
  return `${base}.jpg`
}

/** Medidas para que el lado más largo no pase de `max`. */
export function medidas(ancho: number, alto: number, max = LADO_MAXIMO) {
  const lado = Math.max(ancho, alto)
  if (!lado || lado <= max) return { ancho, alto }
  const f = max / lado
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) }
}

/**
 * Devuelve la foto lista para subir. Los GIF (pueden ir animados) y lo que no
 * es una foto se devuelven tal cual. Una foto pequeña y ya aceptada, también.
 */
export async function prepararFoto(file: File): Promise<File> {
  if (!esImagen(file)) return file
  if (file.type === 'image/gif') return conExtension(file)
  const yaVale = ACEPTADOS.includes(file.type) && file.size <= 900 * 1024
  try {
    const img = await cargar(file)
    const { ancho, alto } = medidas(img.naturalWidth, img.naturalHeight)
    if (yaVale && ancho === img.naturalWidth) return conExtension(file)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) return file
    // Fondo blanco: un PNG con transparencia saldría negro en JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)
    const blob: Blob | null = await new Promise((r) =>
      lienzo.toBlob(r, 'image/jpeg', CALIDAD)
    )
    if (!blob || !blob.size) return file
    // Si por lo que sea pesa más que la original aceptada, se manda la original.
    if (yaVale && blob.size >= file.size) return conExtension(file)
    return new File([blob], nombreJpg(file.name), { type: 'image/jpeg' })
  } catch {
    return conExtension(file)
  }
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * El servidor mira la extensión del nombre. Algunos móviles mandan la foto
 * como «image» o «IMG_1234» sin extensión: se le pone la de su tipo.
 */
export function conExtension(file: File): File {
  const ext = EXTENSION[file.type]
  if (!ext || /\.(jpe?g|png|gif|webp)$/i.test(file.name)) return file
  const base = (file.name || 'foto').replace(/\.[^./]+$/, '') || 'foto'
  return new File([file], `${base}.${ext}`, { type: file.type })
}

/**
 * `fetch` con tope de tiempo. Si se pasa, falla con un mensaje en español en
 * lugar de dejar la rueda girando.
 */
export async function subirConTope(
  url: string,
  init: RequestInit,
  tope = TOPE_SUBIDA_MS
): Promise<Response> {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), tope)
  try {
    return await fetch(url, { ...init, signal: control.signal })
  } catch (e: any) {
    if (control.signal.aborted) {
      throw new Error(
        'La foto está tardando demasiado en subir. Prueba otra vez, mejor con wifi.'
      )
    }
    throw new Error(
      'No se pudo subir: parece que se cortó la conexión. Prueba otra vez.'
    )
  } finally {
    clearTimeout(reloj)
  }
}
