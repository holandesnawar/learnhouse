/**
 * Las cuentas de los tableros de producción (19/11/2026), sin pantalla, con
 * test (`__tests__/produccion.test.ts`).
 */

export interface ConOrden {
  id: number
  orden: number
}

/** El orden para dejar algo en la posición `indice` de una lista ya ordenada
 * (sin contar el propio elemento): a medio camino entre sus vecinos. */
export function ordenEntre(lista: ConOrden[], indice: number): number {
  const antes = lista[indice - 1]
  const despues = lista[indice]
  if (!antes && !despues) return 1
  if (!antes) return despues.orden - 1
  if (!despues) return antes.orden + 1
  return (antes.orden + despues.orden) / 2
}

/** Las tarjetas de cada columna, ordenadas. */
export function porColumna<T extends { columna_id: number; orden: number; id: number }>(tarjetas: T[], columnas: { id: number }[]): Record<number, T[]> {
  const salida: Record<number, T[]> = {}
  for (const c of columnas) salida[c.id] = []
  for (const t of tarjetas) (salida[t.columna_id] ||= []).push(t)
  for (const k of Object.keys(salida)) salida[Number(k)].sort((a, b) => a.orden - b.orden || a.id - b.id)
  return salida
}

export interface Filtro {
  texto: string
  etiquetas: number[]
  personas: number[]
  soloMias: boolean
  sinHacer: boolean
}

export const FILTRO_VACIO: Filtro = { texto: '', etiquetas: [], personas: [], soloMias: false, sinHacer: false }

function sinAcentos(t: string): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function pasaFiltro(
  t: { titulo: string; etiquetas: number[]; asignados: { id: number }[]; hecha_at: string },
  f: Filtro,
  yo: number
): boolean {
  if (f.texto.trim() && !sinAcentos(t.titulo).includes(sinAcentos(f.texto.trim()))) return false
  if (f.etiquetas.length && !f.etiquetas.some((e) => t.etiquetas.includes(e))) return false
  if (f.personas.length && !f.personas.some((p) => t.asignados.some((a) => a.id === p))) return false
  if (f.soloMias && !t.asignados.some((a) => a.id === yo)) return false
  if (f.sinHacer && t.hecha_at) return false
  return true
}

export function hayFiltro(f: Filtro): boolean {
  return !!(f.texto.trim() || f.etiquetas.length || f.personas.length || f.soloMias || f.sinHacer)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** Cómo va la fecha de una tarjeta: hecha, vencida, hoy, pronto (3 días) o más adelante. */
export function estadoFecha(vence: string, hechaAt: string, hoy: string): 'hecha' | 'vencida' | 'hoy' | 'pronto' | 'luego' | '' {
  if (!vence) return hechaAt ? 'hecha' : ''
  if (hechaAt) return 'hecha'
  const d = vence.slice(0, 10)
  if (d < hoy) return 'vencida'
  if (d === hoy) return 'hoy'
  const dias = (Date.parse(d) - Date.parse(hoy)) / 86400000
  return dias <= 3 ? 'pronto' : 'luego'
}

/** «20 nov», «20 nov · 10:00», con el año si no es el de hoy. */
export function fechaCorta(vence: string, hoy: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(vence || '')
  if (!m) return ''
  const dia = `${Number(m[3])} ${MESES[Number(m[2]) - 1]}${m[1] !== hoy.slice(0, 4) ? ` ${m[1]}` : ''}`
  return m[4] ? `${dia} · ${m[4]}:${m[5]}` : dia
}

/** «hace 3 min», «hace 2 días», «hace un mes». */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const t = Date.parse(iso || '')
  if (!isFinite(t)) return ''
  const s = Math.max(0, (ahora - t) / 1000)
  if (s < 60) return 'ahora mismo'
  const min = Math.floor(s / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return h === 1 ? 'hace una hora' : `hace ${h} horas`
  const d = Math.floor(h / 24)
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`
  const meses = Math.floor(d / 30)
  if (meses < 12) return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
  const a = Math.floor(meses / 12)
  return a === 1 ? 'hace un año' : `hace ${a} años`
}

/** Letra legible sobre un color de fondo. */
export function letraSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#0B1033' : '#fff'
}

export const COLORES = ['#0b2da0', '#0082C9', '#15803D', '#C2410C', '#7C3AED', '#DB2777', '#CA8A04', '#0891B2', '#DC2626', '#4B5563']

/** Bytes en algo legible. */
export function tamano(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
