/**
 * Piezas puras del Inicio del alumno (16/11/2026).
 *
 *  - «Me gusta» de una publicación: es la reacción ❤️ del tablón (la misma que
 *    sale en el canal), así que darla en el Inicio se ve también allí.
 *  - Lo destacado y lo último salen de UNA sola lectura de los tablones, y lo
 *    destacado no se repite en la lista de abajo.
 *  - «Tu siguiente paso»: a dónde lleva el botón.
 */

export const EMOJI_ME_GUSTA = '❤️'

type Reaccion = { emoji: string; count: number; has_reacted: boolean }
type ConReacciones = { reactions?: Reaccion[] | null; upvote_count?: number | null }

/** Cuántos «me gusta» enseñar (reacciones + votos, como antes) y si es mío. */
export function meGusta(d: ConReacciones): { total: number; mio: boolean } {
  const rs = d.reactions || []
  const total = rs.reduce((n, r) => n + (r.count || 0), 0) + (d.upvote_count || 0)
  const mio = rs.some((r) => r.emoji === EMOJI_ME_GUSTA && r.has_reacted)
  return { total, mio }
}

/** Las reacciones tras dar (o quitar) el ❤️, para pintarlo antes de que conteste el servidor. */
export function conMeGusta(reacciones: Reaccion[] | null | undefined, dar: boolean): Reaccion[] {
  const rs = (reacciones || []).map((r) => ({ ...r }))
  const i = rs.findIndex((r) => r.emoji === EMOJI_ME_GUSTA)
  if (dar) {
    if (i < 0) return [...rs, { emoji: EMOJI_ME_GUSTA, count: 1, has_reacted: true }]
    if (rs[i].has_reacted) return rs
    rs[i] = { ...rs[i], count: rs[i].count + 1, has_reacted: true }
    return rs
  }
  if (i < 0 || !rs[i].has_reacted) return rs
  const count = rs[i].count - 1
  return count > 0 ? rs.map((r, j) => (j === i ? { ...r, count, has_reacted: false } : r)) : rs.filter((_, j) => j !== i)
}

type Publicacion = ConReacciones & {
  discussion_uuid: string
  creation_date?: string | null
  is_pinned?: boolean | null
}

/**
 * Reparte las publicaciones de los tablones: arriba las destacadas (lo fijado
 * y lo que más gustó en 14 días) y abajo lo último, SIN las destacadas.
 */
export function repartirFeed<T extends Publicacion>(
  todas: T[],
  ahora: number = Date.now(),
  cuantasDestacadas = 2,
  cuantasUltimas = 12
): { destacadas: T[]; ultimas: T[] } {
  const hace = new Date(ahora - 14 * 864e5).toISOString()
  const puntos = (d: T) => (d.is_pinned ? 1000 : 0) + meGusta(d).total
  const destacadas = todas
    .filter((d) => d.is_pinned || (d.creation_date || '') >= hace)
    .sort((a, b) => puntos(b) - puntos(a))
    .slice(0, cuantasDestacadas)
  const fuera = new Set(destacadas.map((d) => d.discussion_uuid))
  const ultimas = todas
    .filter((d) => !fuera.has(d.discussion_uuid))
    .sort((a, b) => (b.creation_date || '').localeCompare(a.creation_date || ''))
    .slice(0, cuantasUltimas)
  return { destacadas, ultimas }
}

/**
 * A dónde lleva «Continúa donde lo dejaste» / «Tu siguiente paso».
 *
 * Si terminó la lección y sabemos cuál es la siguiente, a ESA lección dentro
 * de la formación (`/leccion/<id>/samenvatting`: la escuela busca su clase y,
 * si no tiene resumen, abre la primera). Antes iba a la portada del curso y el
 * botón no cuadraba con el título de la tarjeta.
 */
export function rutaContinuar(o: {
  terminada: boolean
  siguiente?: { id: string; moduleId: string } | null
  leccionId?: string
  moduloId?: string
  courseUuid?: string
  activityUuid?: string
  cursoEnMarcha?: string
}): { ruta: string; formacion: boolean } {
  const { terminada, siguiente, courseUuid, activityUuid, cursoEnMarcha } = o
  if (!terminada && courseUuid && activityUuid) {
    return { ruta: `/course/${courseUuid}/activity/${activityUuid}`, formacion: true }
  }
  if (terminada && siguiente && (courseUuid || cursoEnMarcha)) {
    return { ruta: `/leccion/${encodeURIComponent(siguiente.id)}/samenvatting`, formacion: true }
  }
  if (courseUuid || cursoEnMarcha) {
    return { ruta: `/course/${courseUuid || cursoEnMarcha}`, formacion: true }
  }
  const destino = siguiente ?? (o.leccionId && o.moduloId ? { id: o.leccionId, moduleId: o.moduloId } : null)
  if (destino) return { ruta: `/ejercicios/modulo/${destino.moduleId}/leccion/${destino.id}`, formacion: false }
  return { ruta: '/ejercicios', formacion: false }
}
