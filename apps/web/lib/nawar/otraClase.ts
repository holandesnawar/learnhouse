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
