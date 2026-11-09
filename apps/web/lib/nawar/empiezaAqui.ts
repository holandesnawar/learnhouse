/**
 * «Empieza aquí» (rediseño, rama diseno, 07/11/2026): el primer bloque de la
 * barra, como en las comunidades de Circle. Lleva la página de bienvenida y
 * los canales que son para quien acaba de llegar (bienvenida, preséntate,
 * noticias, normas). Se reconocen por el nombre, sin acentos ni emoji.
 */

// En este orden salen en la barra.
const PALABRAS = ['esencial', 'empieza', 'bienvenid', 'normas', 'presenta', 'noticia', 'anuncio']

export function normal(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function esCanalDeInicio(nombre: string): boolean {
  const n = normal(nombre)
  return PALABRAS.some((p) => n.includes(p))
}

/** Orden en la barra: lo esencial, preséntate, noticias. */
export function ordenDeInicio(nombre: string): number {
  const n = normal(nombre)
  const i = PALABRAS.findIndex((p) => n.includes(p))
  return i === -1 ? 99 : i
}

/** El canal con lo que hay que leer al llegar (sale en «Bienvenida», no en el feed). */
export function esCanalEsencial(nombre: string): boolean {
  const n = normal(nombre)
  return ['esencial', 'empieza', 'bienvenid', 'normas'].some((p) => n.includes(p))
}

export function esCanalDePresentarse(nombre: string): boolean {
  return normal(nombre).includes('presenta')
}
