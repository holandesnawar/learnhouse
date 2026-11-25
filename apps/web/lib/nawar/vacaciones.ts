/**
 * Vacaciones en el calendario de los alumnos (25/11/2026). Usuario: «me
 * gustaría seleccionar fechas de vacaciones para el calendario de alumnos,
 * de x día a x día vacaciones».
 *
 * Son eventos del calendario de siempre (org_config `events`, sin servidor
 * nuevo) con `tipo: 'vacaciones'` y `hasta`: del `date` al `hasta`, los dos
 * incluidos. El calendario pinta esos días de otro color y los pone en
 * «Próximos eventos» mientras no hayan terminado. Funciones puras.
 */
import dayjs from 'dayjs'

export interface EventoConRango {
  date: string
  hasta?: string
  tipo?: string
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const esVacaciones = (ev: EventoConRango | null | undefined): boolean => !!ev && ev.tipo === 'vacaciones' && !!ev.date

/** El último día: `hasta` si es válido y no es antes del primero; si no, el primero. */
export function finDe(ev: EventoConRango): string {
  return ev.hasta && ev.hasta >= ev.date ? ev.hasta : ev.date
}

/** Si ese día cae dentro (los dos extremos incluidos). */
export const cubre = (ev: EventoConRango, dia: string): boolean => esVacaciones(ev) && dia >= ev.date && dia <= finDe(ev)

/** Todavía sale en «Próximos eventos»: no ha terminado. */
export const sigue = (ev: EventoConRango, hoy: string): boolean => (esVacaciones(ev) ? finDe(ev) : ev.date) >= hoy

/** Cuántos días son (los dos extremos incluidos). */
export const cuantosDias = (ev: EventoConRango): number => dayjs(finDe(ev)).diff(dayjs(ev.date), 'day') + 1

/** «del lunes 21 de diciembre al domingo 3 de enero» (un día: «el lunes 21 de diciembre»). */
export function textoRango(ev: EventoConRango): string {
  const a = dayjs(ev.date)
  const b = dayjs(finDe(ev))
  const largo = (d: dayjs.Dayjs) => `${DIAS[d.day()]} ${d.date()} de ${MESES[d.month()]}`
  return a.isSame(b, 'day') ? `el ${largo(a)}` : `del ${largo(a)} al ${largo(b)}`
}

/** «21 dic – 3 ene» */
export function rangoCorto(ev: EventoConRango): string {
  const a = dayjs(ev.date)
  const b = dayjs(finDe(ev))
  const c = (d: dayjs.Dayjs) => `${d.date()} ${MESES_CORTOS[d.month()]}`
  return a.isSame(b, 'day') ? c(a) : `${c(a)} – ${c(b)}`
}
