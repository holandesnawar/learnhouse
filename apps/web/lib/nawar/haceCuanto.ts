/**
 * Una fecha del servidor, en milisegundos (16/11/2026).
 *
 * El servidor manda fechas de varias formas: `str(datetime.now())`
 * («2026-11-16 10:00:00.123456», con espacio, seis decimales y SIN zona, en
 * UTC) y `isoformat()` (con o sin «+00:00»). Dos trampas:
 *  - Sin zona, el navegador la lee como hora LOCAL: en Países Bajos salía
 *    una hora de más («hace 1 h» de un mensaje recién escrito).
 *  - Safari no entiende el espacio entre día y hora: salía vacía en el iPhone.
 * Aquí se pone la «T», se dejan tres decimales y, sin zona, se lee como UTC.
 * Devuelve NaN si no se entiende.
 */
export function msDeFecha(fecha: string | number | Date | null | undefined): number {
  if (fecha === null || fecha === undefined || fecha === '') return NaN
  if (fecha instanceof Date) return fecha.getTime()
  if (typeof fecha === 'number') return fecha
  let s = String(fecha).trim()
  // Solo el día: medianoche UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`)
  s = s.replace(/^(\d{4}-\d{2}-\d{2})[ T]/, '$1T')
  // Más de tres decimales: Safari viejo no los entiende.
  s = s.replace(/(T\d{2}:\d{2}:\d{2})\.(\d{3})\d+/, '$1.$2')
  // «+0000» → «+00:00».
  s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/([zZ]|[+-]\d{2}:\d{2})$/.test(s)) s = `${s}Z`
  return Date.parse(s)
}

/**
 * «hace 2 días», en español y sin depender de que dayjs cargue su idioma
 * (08/11/2026: en la comunidad salía «2 days ago»).
 */
export function haceCuanto(iso: string | null | undefined, ahora: number = Date.now()): string {
  if (!iso) return ''
  const t = msDeFecha(iso)
  if (Number.isNaN(t)) return ''
  const m = Math.max(0, Math.round((ahora - t) / 60000))
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
