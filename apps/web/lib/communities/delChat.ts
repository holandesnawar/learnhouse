/**
 * Mensajes del chat que se ven en un tablón (09/11/2026): el canal de las
 * presentaciones pasó de chat a tablón sin tocar un solo mensaje
 * (apps/api/src/services/communities/presentaciones_posts.py). El chat guarda
 * cosas dentro del contenido que el tablón no conocía:
 *
 * - `threadParent`: la respuesta en hilo a otro mensaje. En el tablón no es
 *   una publicación suelta: sale debajo de su presentación.
 * - El título del mensaje es su primera línea (lo pone el chat al mandarlo),
 *   así que el cuerpo la repetía: `sinTituloRepetido` la quita.
 * - `attachments`: fotos, notas de voz y archivos, igual que en el tablón.
 */
import type { ChatAttachment } from '@services/communities/discussions'

export function docDe(content: string | null | undefined): any {
  if (!content) return null
  try {
    const d = JSON.parse(content)
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

/** El mensaje al que responde (sin nada si no es una respuesta en hilo). */
export function hiloDe(content: string | null | undefined): string {
  const p = docDe(content)?.threadParent
  return typeof p === 'string' ? p : ''
}

export function adjuntosDe(content: string | null | undefined): ChatAttachment[] {
  const a = docDe(content)?.attachments
  return Array.isArray(a) ? a.filter((x: any) => x && typeof x.url === 'string') : []
}

const plano = (t: string) => (t || '').replace(/\s+/g, ' ').trim()

/** El cuerpo sin la primera línea si es el mismo título (mensajes del chat). */
export function sinTituloRepetido(titulo: string, cuerpo: string): string {
  const t = plano(titulo)
  if (!t || !cuerpo) return cuerpo
  const lineas = cuerpo.split('\n')
  const primera = plano(lineas[0])
  if (primera === t || (t.length >= 90 && primera.startsWith(t))) return lineas.slice(1).join('\n').trim()
  return cuerpo
}

/** Lo mismo para el documento de tiptap: quita el primer párrafo si es el título. */
export function docSinTitulo(doc: any, titulo: string): any {
  if (!doc || !Array.isArray(doc.content) || !doc.content.length) return doc
  const textoDe = (n: any): string =>
    n?.type === 'text' ? n.text || '' : Array.isArray(n?.content) ? n.content.map(textoDe).join('') : ''
  const primero = plano(textoDe(doc.content[0]))
  const t = plano(titulo)
  if (t && (primero === t || (t.length >= 90 && primero.startsWith(t)))) return { ...doc, content: doc.content.slice(1) }
  return doc
}
