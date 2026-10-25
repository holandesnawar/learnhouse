/**
 * Eventos y avisos por grupo (25/10/2026: la beta y el programa nuevo).
 *
 * El calendario vive en la configuración de la escuela y lo lee el navegador:
 * cada evento puede llevar `grupos` (ids de grupos de usuarios). Sin grupos,
 * es para todos. Con grupos, solo lo ven los de esos grupos y el equipo.
 * Mientras no se sabe en qué grupos está la persona, los eventos de grupo NO
 * se enseñan: mejor un momento sin verlos que enseñárselos a quien no toca.
 */

export type MisGrupos = { grupos: number[]; equipo: boolean; todos: { id: number; nombre: string }[] }

export function eventoParaMi(ev: { grupos?: number[] } | null | undefined, yo: MisGrupos | null | undefined): boolean {
  const del = Array.isArray(ev?.grupos) ? ev!.grupos! : []
  if (!del.length) return true
  if (!yo) return false
  return yo.equipo || del.some((g) => yo.grupos.includes(g))
}

/** «Para todos» o «Solo Beta, Programa nuevo», con los nombres que se sepan. */
export function paraQuien(ev: { grupos?: number[] } | null | undefined, todos: { id: number; nombre: string }[] = []): string {
  const del = Array.isArray(ev?.grupos) ? ev!.grupos! : []
  if (!del.length) return 'Para todos'
  const nombres = del.map((g) => todos.find((t) => t.id === g)?.nombre).filter(Boolean)
  return nombres.length ? `Solo ${nombres.join(', ')}` : 'Solo un grupo'
}
