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

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

/** "SEPTIEMBRE - 2026" → { anio: 2026, mes: 9 }. null si el nombre no es un mes con su año. */
export function mesDelCapitulo(nombre: string | null | undefined): { anio: number; mes: number } | null {
  const texto = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const m = texto.match(/([a-z]+)\s*[-–—·/,]?\s*(\d{4})/)
  if (!m || !MESES[m[1]]) return null
  return { anio: Number(m[2]), mes: MESES[m[1]] }
}

/**
 * Las sesiones grabadas de la clase semanal van en un capítulo por mes
 * ("SEPTIEMBRE - 2026"). Un mes que ya ha pasado y se quedó SIN ninguna
 * grabación no se enseña (usuario, 11/10/2026: "quita septiembre, ya
 * pasó"): es una caja vacía que dice "0 actividades". El capítulo sigue en
 * el editor del curso; solo deja de verse aquí. El mes en curso, los que
 * vienen y cualquier capítulo que no sea un mes se enseñan siempre.
 */
export function sesionesVisibles<T extends { name?: string | null; activities?: unknown[] | null }>(
  capitulos: T[],
  hoy: Date = new Date()
): T[] {
  const ahora = hoy.getFullYear() * 12 + hoy.getMonth() + 1
  return capitulos.filter((c) => {
    if ((c.activities?.length || 0) > 0) return true
    const mes = mesDelCapitulo(c.name)
    return !mes || mes.anio * 12 + mes.mes >= ahora
  })
}
