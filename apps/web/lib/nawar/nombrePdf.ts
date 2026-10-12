/**
 * El nombre del archivo al descargar una clase de PDF (12/10/2026).
 *
 * En el curso las clases se numeran por lección DENTRO de su módulo: el
 * Werkboek de la lección 2 se llama «2.7 Werkboek» en el módulo 1 y también
 * en el módulo 2. En la barra se distinguen porque cada uno cuelga de su
 * módulo, pero en la carpeta de descargas no: quien bajaba los dos acababa
 * con «2.7 Werkboek.pdf» y «2.7 Werkboek (1).pdf».
 *
 * El nombre de la clase no se toca (va a juego con «2.1 Samenvatting» y
 * compañía); solo el del archivo lleva el módulo y la lección:
 * «Werkboek - Módulo 1 - Lección 2.pdf».
 */

const PROHIBIDOS = /[\\/:*?"<>|·]+/g

function limpiar(texto: string): string {
  return texto.replace(PROHIBIDOS, '-').replace(/\s+/g, ' ').trim()
}

/** «MODULE 1 - OVER JOU» / «Módulo 3» → 1 / 3. */
export function numeroDeModulo(capitulo: string | undefined | null): number | null {
  const m = (capitulo || '').match(/m[oó]dul[eo]\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

export function nombreParaDescargar(
  clase: string | undefined | null,
  capitulo?: string | undefined | null
): string {
  const nombre = limpiar(clase || '') || 'documento'
  const modulo = numeroDeModulo(capitulo)
  let base = nombre
  // Si la clase ya dice su módulo («Cuaderno · Módulo 1»), no se repite.
  if (modulo !== null && numeroDeModulo(nombre) === null) {
    const leccion = nombre.match(/^(\d+)\.\d+\s+(.+)$/)
    base = leccion
      ? `${leccion[2]} - Módulo ${modulo} - Lección ${leccion[1]}`
      : `${nombre} - Módulo ${modulo}`
  }
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`
}

/** El capítulo del curso en el que está esa clase. */
export function capituloDeLaClase(curso: any, activityUuid: string | undefined): string | null {
  if (!activityUuid) return null
  for (const capitulo of curso?.chapters ?? []) {
    if ((capitulo?.activities ?? []).some((a: any) => a?.activity_uuid === activityUuid)) {
      return capitulo?.name ?? null
    }
  }
  return null
}
