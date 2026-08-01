/**
 * Cuándo es la próxima clase semanal, dicho como lo diría una persona.
 *
 * Vive aparte del banner para poder probarlo: es aritmética de fechas y ahí es
 * donde se cuelan los fallos tontos (el "hoy mismo", el cambio de mes).
 */

export const WEEKDAYS = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
]

/** "Jueves 7 de agosto" (sin la coma que mete el formato del navegador). */
export function humanDate(d: Date): string {
  const text = d
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * - Si hay una fecha concreta puesta a mano, manda esa (sirve para cambios).
 * - Si solo hay día de la semana, se calcula la siguiente vez que cae: así el
 *   banner se actualiza solo cada semana y nadie tiene que tocarlo.
 * - Si no hay ni una cosa ni otra, se queda el texto libre de siempre.
 */
export function nextBroadcastLabel(
  weekday: string,
  exactDate: string,
  fallback: string,
  today: Date = new Date()
): string {
  if (exactDate) {
    // Mediodía a propósito: evita que el huso horario mueva la fecha un día.
    const d = new Date(`${exactDate}T12:00:00`)
    if (!Number.isNaN(d.getTime())) return humanDate(d)
  }

  if (weekday !== '' && weekday !== undefined && weekday !== null) {
    const target = Number(weekday)
    if (Number.isInteger(target) && target >= 0 && target <= 6) {
      const d = new Date(today)
      d.setHours(12, 0, 0, 0)
      // 0 días = hoy mismo si hoy es ese día; si no, los que falten.
      d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7))
      return humanDate(d)
    }
  }

  return fallback
}
