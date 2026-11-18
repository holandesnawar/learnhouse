/**
 * El día de la otra clase (el otro grupo) en la misma semana (06/11/2026):
 * al crear una semana para los dos grupos, si Groep blauw tiene clase el
 * lunes 2 nov, Groep rood la tiene el jueves 5 nov.
 *
 * Manda el día en que de verdad se ha dado esa clase (sus semanas, `dia`:
 * «jueves»); si aún no tiene ninguna, el día del recuadro (`weekday`, 0 =
 * domingo, como `getDay()`).
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10)
}

export function diaEnLaOtraClase(dia: string, h: { dia?: string; weekday?: string }): string {
  if (!dia || dia.length < 10) return ''
  const destino = h.dia
    ? DIAS.indexOf(h.dia.toLowerCase())
    : h.weekday !== '' && h.weekday !== undefined
      ? Number(h.weekday)
      : -1
  if (!Number.isInteger(destino) || destino < 0 || destino > 6) return dia
  const [a, m, d] = dia.split('-').map(Number)
  const lunesEs0 = (new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay() + 6) % 7
  return sumarDias(dia, (destino + 6) % 7 - lunesEs0)
}

/**
 * Si la clase del otro grupo es de ESTA semana (18/11/2026, usuario: "estamos
 * a miércoles, te vas al grupo del lunes y sale ver la clase del grupo rojo…
 * pero aún no hubo la clase del rojo: te sale la de la semana pasada, que no
 * tiene nada que ver"). Antes valía cualquiera a 6 días o menos, y el
 * miércoles de la semana pasada está a 5 días del lunes. Ahora: la misma
 * semana del calendario (lunes a domingo) o, si el tema es el mismo, a 6
 * días o menos (dos grupos que dan el tema en semanas seguidas). Pura.
 */
const DIA_MS = 86_400_000
const aDia = (f: string) => Date.parse(`${(f || '').slice(0, 10)}T12:00:00Z`)

export function esDeEstaSemana(fechaOtra: string, fecha: string, tema?: string, temaOtra?: string) {
  const a = aDia(fechaOtra)
  const b = aDia(fecha)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  const lunes = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DIA_MS
  if (lunes(a) === lunes(b)) return true
  const n = (x?: string) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return !!n(tema) && n(tema) === n(temaOtra) && Math.abs(a - b) <= 6 * DIA_MS
}
