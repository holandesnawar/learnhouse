/**
 * El color de cada closer en el tablero de Matrículas (31/10/2026: "una mini
 * etiqueta con el nombre, Diego o Belén, de colores diferentes para ver en un
 * instante quién está con cada lead").
 *
 * Por su ORDEN en el equipo del panel (por id), no por su nombre: con un color
 * por nombre, dos closers podían salir del mismo color. Con el orden, los
 * primeros ocho nunca se repiten. Quien ya no está en el equipo (lleva
 * tarjetas viejas) sale por su nombre.
 */

export const COLORES_CLOSER = ['#025dc7', '#BE185D', '#15803D', '#7C3AED', '#B45309', '#0E7490', '#4338CA', '#9A5296']

export function colorCloser(id: number, equipo: { id: number }[], nombre = ''): string {
  const ids = Array.from(new Set(equipo.map((m) => m.id))).sort((a, b) => a - b)
  const i = ids.indexOf(id)
  if (i >= 0) return COLORES_CLOSER[i % COLORES_CLOSER.length]
  let h = 0
  for (const c of (nombre || String(id)).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES_CLOSER[h % COLORES_CLOSER.length]
}
