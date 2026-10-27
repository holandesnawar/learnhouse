/**
 * La comisión del closer de una venta (27/10/2026), en Panel → Clientes.
 * Se calcula sobre el TOTAL de la venta (con plazos, el total del plan) y el
 * administrador elige el % al marcarla: el importe se ajusta solo. Se guarda
 * el importe, no el %, así que el % se deduce si cuadra con uno de ellos.
 * Ver apps/api/src/services/panel/comisiones.py.
 */

/** Lo que le toca con ese %, en céntimos. */
export function comisionCents(baseCents: number, pct: number): number {
  return Math.round((Math.max(0, baseCents || 0) * (pct || 0)) / 100)
}

/** El % con el que sale ese importe exacto, o null si se escribió a mano. */
export function pctQueCuadra(baseCents: number, importeCents: number, pcts: number[]): number | null {
  if (!baseCents || !importeCents) return null
  return pcts.find((p) => comisionCents(baseCents, p) === importeCents) ?? null
}

/** «15 %», «12,5 %». */
export function textoPct(pct: number): string {
  return `${String(Math.round(pct * 10) / 10).replace('.', ',')} %`
}

/** Céntimos a lo que se escribe en la caja: 7455 → «74,55». */
export function aCaja(cents: number): string {
  return cents ? (cents / 100).toFixed(2).replace('.', ',') : ''
}

/** Lo escrito en la caja a céntimos: «65,25», «1.200,50» o «65.25» (con
 * coma, los puntos son de miles). null si no es un importe. */
export function leerEuros(texto: string): number | null {
  const limpio = (texto || '0').trim()
  const numero = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio
  const cents = Math.round(parseFloat(numero) * 100)
  return Number.isFinite(cents) && cents >= 0 ? cents : null
}
