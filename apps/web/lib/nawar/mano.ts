/**
 * Levantar la mano en la sala (17/11/2026).
 *
 * Daily Prebuilt no tiene «levantar la mano». La sala lo hace con lo que sí
 * deja: un botón propio en su barra (`customTrayButtons`), el nombre de quien
 * la levanta con «✋ » delante (así lo ven TODOS en su recuadro y en la lista
 * de gente, también los alumnos) y un mensaje de la llamada para que el
 * equipo vea el orden y pueda bajarla.
 *
 * Aquí, solo las cuentas puras (con test).
 */

export const MANO = '✋'

/** ¿Este nombre lleva la mano levantada? */
export function tieneMano(nombre: string | null | undefined): boolean {
  return String(nombre || '').trimStart().startsWith(MANO)
}

/** El nombre sin la mano (quita también manos repetidas). */
export function sinMano(nombre: string | null | undefined): string {
  let n = String(nombre || '').trim()
  while (n.startsWith(MANO)) n = n.slice(MANO.length).trim()
  return n
}

/** El nombre con la mano delante (una sola vez). */
export function conMano(nombre: string | null | undefined): string {
  const base = sinMano(nombre)
  return base ? `${MANO} ${base}` : MANO
}

export type ManoLevantada = { id: string; nombre: string; desde: number }

type Participante = { session_id?: string; user_name?: string; local?: boolean }

/**
 * Las manos levantadas, en el orden en que se levantaron. Manda el nombre
 * de cada participante (es lo que ve todo el mundo); `desde` guarda cuándo
 * se supo de cada una (por el mensaje o al verla por primera vez).
 */
export function manosLevantadas(
  participantes: Record<string, Participante> | Participante[] | null | undefined,
  desde: Record<string, number>,
  ahora: number
): ManoLevantada[] {
  const lista = Array.isArray(participantes) ? participantes : Object.values(participantes || {})
  const manos: ManoLevantada[] = []
  for (const p of lista) {
    if (!p || !p.session_id || !tieneMano(p.user_name)) continue
    manos.push({ id: p.session_id, nombre: sinMano(p.user_name) || 'Alguien', desde: desde[p.session_id] ?? ahora })
  }
  return manos.sort((a, b) => a.desde - b.desde || a.nombre.localeCompare(b.nombre))
}

/** «hace 2 min» para la lista del profe. */
export function haceCuantoMano(desde: number, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - desde) / 1000))
  if (s < 45) return 'ahora'
  const m = Math.round(s / 60)
  return m <= 1 ? 'hace 1 min' : `hace ${m} min`
}
