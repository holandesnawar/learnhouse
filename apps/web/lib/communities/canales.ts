/**
 * Encontrar un canal por lo que es (13/11/2026): el general de alumnos, para
 * escribir desde el Inicio, y el de victorias, para compartir una insignia.
 * Por el nombre, sin mayúsculas ni tildes ni el emoji de delante: los canales
 * se crean y se renombran en el panel, no hay un id fijo.
 */

export interface CanalMinimo {
  community_uuid: string
  name: string
  kind?: string
}

function limpio(nombre: string): string {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function canalQueSeLlama<T extends CanalMinimo>(canales: T[], trozo: string): T | null {
  const t = limpio(trozo)
  return (canales || []).find((c) => limpio(c.name).includes(t)) || null
}

/**
 * El canal general de alumnos: el que se llama «General» o, si no hay, el de
 * «Alumnos» (en la escuela es «Comunidad Alumnos», 14/11/2026: el Inicio no lo
 * encontraba y seguía siendo un botón). Nunca victorias, presentaciones ni el
 * del Spreekclub.
 */
export function canalGeneral<T extends CanalMinimo>(canales: T[]): T | null {
  const fuera = (c: T) => /victoria|presenta|spreek|spreken|esencial/.test(limpio(c.name))
  const validos = (canales || []).filter((c) => !fuera(c))
  return canalQueSeLlama(validos, 'general') || canalQueSeLlama(validos, 'alumnos') || null
}
export const canalVictorias = <T extends CanalMinimo>(canales: T[]) => canalQueSeLlama(canales, 'victoria')

/** El texto de la caja, como lo guarda la comunidad (título + documento). */
export function comoPublicacion(texto: string, titulo?: string): { title: string; content: string } {
  const limpioTexto = String(texto || '').trim()
  const primera = limpioTexto.split('\n').find((l) => l.trim()) || ''
  const doc = {
    type: 'doc',
    content: limpioTexto.split('\n').map((linea) => ({
      type: 'paragraph',
      content: linea.trim() ? [{ type: 'text', text: linea }] : [],
    })),
  }
  return { title: (titulo || primera).trim().slice(0, 100), content: JSON.stringify(doc) }
}
