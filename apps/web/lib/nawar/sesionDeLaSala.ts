/**
 * De qué sesión es la pizarra que abre la sala (22/11/2026).
 *
 * Usuario: «no hay ninguna correlación entre lo que se ve en la semana vs lo
 * que se ve en la pizarra y salas». Antes, si HOY no había sesión creada, la
 * sala abría en silencio la pizarra de la próxima (o de la última): el profe
 * subía y escribía ahí sin saberlo, y luego nadie lo encontraba en la sesión
 * del día. Ahora la sala solo abre sola la de HOY; si no existe, lo dice y
 * deja crear la de hoy o elegir otra a sabiendas.
 */
export type SesionCorta = { id: number; fecha: string; tema?: string }

export function sesionParaLaSala<S extends SesionCorta>(semanas: S[], hoy: string): { deHoy: S | null; otra: S | null } {
  const conFecha = semanas.filter((s) => !!s.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const deHoy = conFecha.find((s) => s.fecha === hoy) || null
  // La otra que se ofrece: la próxima; si no hay, la última ya dada.
  const proxima = conFecha.find((s) => s.fecha > hoy) || null
  const ultima = [...conFecha].reverse().find((s) => s.fecha < hoy) || null
  return { deHoy, otra: proxima || ultima }
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «viernes 20 nov» (y «hoy, viernes 20 nov» si es hoy). */
export function diaDeSesion(fecha: string, hoy = ''): string {
  if (!fecha || fecha.length < 10) return ''
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`)
  const texto = `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
  return fecha.slice(0, 10) === hoy ? `hoy, ${texto}` : texto
}

/** «Spreek Club · viernes 20 nov»: lo que dice la pizarra de sí misma. */
export function rotuloDeSesion(curso: string, fecha: string, hoy = ''): string {
  return [curso.trim(), diaDeSesion(fecha, hoy)].filter(Boolean).join(' · ')
}
