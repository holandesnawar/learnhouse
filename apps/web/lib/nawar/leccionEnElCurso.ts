/**
 * Dirección corta de una lección dentro de la formación, para los QR del
 * Werkboek (12/10/2026).
 *
 * Un QR impreso no se puede cambiar, así que no puede llevar el identificador
 * de la clase en la base de datos: si un día se rehace una clase en el panel,
 * cambia, y todos los cuadernos impresos llevarían a una página que no existe.
 * El QR lleva lo que no cambia, el nombre de la lección de `courseData.ts`
 * (`/leccion/les-1-voorstellen/flashcards`), y la escuela busca en el curso la
 * clase que la pinta: su `embed_url` es `nawar:<módulo>/<lección>/<parte>`.
 *
 * Antes el QR iba a `/ejercicios/modulo/…/leccion/…`, la app de ejercicios
 * suelta («Repasar», escondida del menú desde septiembre): ahí el alumno no
 * está en su formación y lo que hace no le cuenta en el progreso.
 */

/** Cómo se llama cada parte en la dirección → cómo se llama en el curso. */
const PARTES: Record<string, string> = {
  resumen: 'resumen',
  samenvatting: 'resumen',
  teoria: 'resumen',
  flashcards: 'flashcards',
  vocabulario: 'flashcards',
  oefeningen: 'vocabulary',
  oefening: 'vocabulary',
  ejercicios: 'vocabulary',
  vocabulary: 'vocabulary',
  lezen: 'lezen',
  lectura: 'lezen',
  luisteren: 'luisteren',
  dialogo: 'luisteren',
  escuchar: 'luisteren',
  spreken: 'spreken',
  hablar: 'spreken',
}

/** Sin parte en la dirección: las flashcards, que es lo que el papel no da (el sonido). */
export const PARTE_POR_DEFECTO = 'flashcards'

export function parteDelCurso(parte: string | undefined | null): string | null {
  if (!parte) return null
  const limpia = parte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
  return PARTES[limpia] ?? null
}

function leer(embedUrl: string): { leccion: string; parte: string | null } | null {
  const token = embedUrl.match(/^nawar:([^/]+)\/([^/]+)(?:\/([^/]+))?$/)
  if (token) return { leccion: token[2], parte: token[3] ?? null }
  const app = embedUrl.match(/\/modulo\/([^/?#]+)\/leccion\/([^/?#]+)/)
  if (app) return { leccion: app[2], parte: null }
  return null
}

/**
 * La clase del curso que abre esa lección por esa parte, sin el prefijo
 * `activity_` (como va en la dirección). Si la lección no tiene esa parte,
 * la primera clase de la lección; si la lección no está en el curso, `null`.
 */
export function claseDeLaLeccion(
  curso: any,
  leccion: string,
  parte?: string | null
): string | null {
  const buscada = parteDelCurso(parte) ?? PARTE_POR_DEFECTO
  const deLaLeccion: { uuid: string; parte: string | null }[] = []
  for (const capitulo of curso?.chapters ?? []) {
    for (const clase of capitulo?.activities ?? []) {
      const nativa = leer(clase?.content?.embed_url || '')
      if (!nativa || nativa.leccion !== leccion || !clase?.activity_uuid) continue
      deLaLeccion.push({
        uuid: String(clase.activity_uuid).replace('activity_', ''),
        parte: nativa.parte,
      })
    }
  }
  if (!deLaLeccion.length) return null
  return (deLaLeccion.find((c) => c.parte === buscada) ?? deLaLeccion[0]).uuid
}
