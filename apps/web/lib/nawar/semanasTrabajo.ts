/**
 * Las cuentas del tablero y de las semanas de Visión (20/10/2026): qué semana
 * es, en qué semanas cae una tarjeta, si va atrasada y quién se encarga.
 * Puras, con test (`__tests__/semanasTrabajo.test.ts`).
 *
 * Fechas siempre como "AAAA-MM-DD" (las de la tarjeta), sin horas: así no
 * baila nada con la zona horaria. Las cuentas se hacen al mediodía UTC.
 */

const DIA = 86_400_000

function aFecha(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`)
}
function aIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(iso: string, dias: number): string {
  return aIso(new Date(aFecha(iso).getTime() + dias * DIA))
}

/** El lunes de la semana de ese día. */
export function lunesDe(iso: string): string {
  const d = aFecha(iso)
  const desdeLunes = (d.getUTCDay() + 6) % 7
  return sumarDias(iso, -desdeLunes)
}

/** Días entre dos fechas (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / DIA)
}

/** El número de semana del año (ISO 8601), el que sale en los calendarios. */
export function numeroSemana(iso: string): number {
  const lunes = aFecha(lunesDe(iso))
  // La semana es del año de su jueves; la 1 es la que tiene el 4 de enero.
  const anio = new Date(lunes.getTime() + 3 * DIA).getUTCFullYear()
  const lunesSemana1 = aFecha(lunesDe(`${anio}-01-04`))
  return 1 + Math.round((lunes.getTime() - lunesSemana1.getTime()) / (7 * DIA))
}

export interface ConFechas {
  inicio: string
  fin: string
  vence: string
  estado: string
}

/**
 * De cuándo a cuándo va una tarjeta. Empieza en `inicio` (o, si no hay, en la
 * fecha límite) y acaba en `fin` (o en la fecha límite). Sin ninguna fecha,
 * null: va a «Sin fecha».
 */
export function rangoDe(t: ConFechas): { desde: string; hasta: string } | null {
  const desde = t.inicio || t.vence || t.fin
  const hasta = t.fin || t.vence || t.inicio
  if (!desde || !hasta) return null
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
}

/** El día en que tiene que estar: la fecha límite, o el fin. */
export function limiteDe(t: ConFechas): string {
  return t.vence || t.fin || ''
}

/** Sin hacer y con la fecha límite ya pasada. */
export function atrasada(t: ConFechas, hoy: string): boolean {
  const l = limiteDe(t)
  return t.estado !== 'hecho' && Boolean(l) && l < hoy
}

/** Si una tarjeta cae (aunque sea un día) en la semana de ese lunes. */
export function caeEnSemana(t: ConFechas, lunes: string): boolean {
  const r = rangoDe(t)
  if (!r) return false
  return r.desde <= sumarDias(lunes, 6) && r.hasta >= lunes
}

/** Los lunes de `cuantas` semanas seguidas desde la de `desde`. */
export function lunesSeguidos(desde: string, cuantas: number): string[] {
  const primero = lunesDe(desde)
  return Array.from({ length: Math.max(0, cuantas) }, (_, i) => sumarDias(primero, i * 7))
}

/**
 * Para la lista por semanas (móvil): cada tarjeta en la semana de su fecha
 * límite (o de su fin). Las atrasadas aparte, arriba; lo que no tiene fecha,
 * aparte, abajo. Lo hecho va en la semana en que se terminó (su `fin`, que se
 * pone solo al pasarla a Hecho).
 */
export function agruparPorSemana<T extends ConFechas>(
  tarjetas: T[],
  hoy: string
): { atrasadas: T[]; semanas: { lunes: string; tarjetas: T[] }[]; sinFecha: T[] } {
  const atrasadas: T[] = []
  const sinFecha: T[] = []
  const porLunes = new Map<string, T[]>()
  for (const t of tarjetas) {
    if (atrasada(t, hoy)) {
      atrasadas.push(t)
      continue
    }
    const dia = t.estado === 'hecho' ? t.fin || t.vence || t.inicio : limiteDe(t) || t.inicio
    if (!dia) {
      sinFecha.push(t)
      continue
    }
    const l = lunesDe(dia)
    porLunes.set(l, [...(porLunes.get(l) ?? []), t])
  }
  const semanas = Array.from(porLunes.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([lunes, ts]) => ({ lunes, tarjetas: ts }))
  return { atrasadas, semanas, sinFecha }
}

/** "Rida, Laura" → ["Rida", "Laura"] (igual que el servidor). */
export function personasDe(texto: string): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const p of String(texto || '').split(/[,;]/)) {
    const nombre = p.split(/\s+/).filter(Boolean).join(' ').slice(0, 40)
    if (nombre && !vistos.has(nombre.toLowerCase())) {
      vistos.add(nombre.toLowerCase())
      salida.push(nombre)
    }
  }
  return salida
}

/** Al revés: sin pasar de las 120 letras que caben. */
export function juntarPersonas(nombres: string[], largo = 120): string {
  let texto = ''
  for (const n of nombres) {
    const siguiente = texto ? `${texto}, ${n}` : n
    if (siguiente.length > largo) break
    texto = siguiente
  }
  return texto
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?'
}

/** Un color fijo por persona (el mismo nombre, siempre el mismo), apagado. */
const COLORES_PERSONA = ['#025dc7', '#7C3AED', '#0E7490', '#B45309', '#15803D', '#BE185D', '#4338CA', '#9A5296']
export function colorPersona(nombre: string): string {
  let h = 0
  for (const c of nombre.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES_PERSONA[h % COLORES_PERSONA.length]
}
