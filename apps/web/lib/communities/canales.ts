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

/** El canal general; si no hay ninguno con ese nombre, no se elige otro. */
export const canalGeneral = <T extends CanalMinimo>(canales: T[]) => canalQueSeLlama(canales, 'general')
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
