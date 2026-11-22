/**
 * Las presentaciones de una clase (22/11/2026): los textos de la lista, sin
 * pantalla. La explicación, en apps/api/src/services/tareas/pizarra.py.
 */
import type { ListaPresentaciones, NotasDe, Presentacion } from '@services/pizarra/pizarra'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Una fecha del servidor (con o sin zona; sin zona = UTC) como instante. */
export function instante(texto: string): Date | null {
  if (!texto) return null
  let t = texto.trim().replace(' ', 'T')
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(t)) t += 'Z'
  const f = new Date(t)
  return isNaN(f.getTime()) ? null : f
}

const ZONA = 'Europe/Amsterdam'
const dia = (f: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(f)
const hora = (f: Date) => new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(f)

/** «hoy a las 19:42», «ayer», «el 20 nov» (hora de Países Bajos). */
export function cuandoFue(texto: string, ahora: Date = new Date()): string {
  const f = instante(texto)
  if (!f) return ''
  const d = dia(f)
  if (d === dia(ahora)) return `hoy a las ${hora(f)}`
  if (d === dia(new Date(ahora.getTime() - 86400000))) return 'ayer'
  const [a, m, n] = d.split('-').map(Number)
  const esteAnio = a === Number(dia(ahora).slice(0, 4))
  return `el ${n} ${MESES[m - 1]}${esteAnio ? '' : ` ${a}`}`
}

/** «Con notas en 5 páginas · Luna, hoy a las 19:42». */
export function textoNotas(n: NotasDe | null | undefined, ahora: Date = new Date()): string {
  if (!n) return 'Sin notas'
  const donde = n.paginas == null ? 'Con notas' : n.paginas === 0 ? 'Con páginas añadidas o escondidas' : `Con notas en ${n.paginas} ${n.paginas === 1 ? 'página' : 'páginas'}`
  const quien = [n.por, cuandoFue(n.at, ahora)].filter(Boolean).join(', ')
  return quien ? `${donde} · ${quien}` : donde
}

/** La línea gris: quién la ve y quién la subió. */
export function quienLaVe(p: Presentacion, ahora: Date = new Date()): string {
  if (p.de === 'blanco') return 'Sin PDF: para apuntar sobre páginas en blanco'
  const ve = p.de === 'alumnos' ? 'Los alumnos la ven antes de la clase' : 'Solo el equipo'
  const cuando = cuandoFue(p.at, ahora)
  const subida = p.por ? `la subió ${p.por}${cuando ? ` ${cuando}` : ''}` : cuando ? `subida ${cuando}` : ''
  return [ve, subida].filter(Boolean).join(' · ')
}

/** A cuáles se pueden pasar las notas de `id`: todas menos ella misma. */
export function destinosPara(id: string, lista: Pick<ListaPresentaciones, 'presentaciones'>): Presentacion[] {
  return lista.presentaciones.filter((p) => p.id !== id)
}

/** El PDF que los alumnos ven antes de la clase (su clase del curso). */
export const actividadDe = (id: string): string => (id.startsWith('clase:') ? id.slice(6) : '')

/** El archivo del material del equipo. */
export const archivoDe = (id: string): string => (id.startsWith('profe:') ? id.slice(6) : '')

/**
 * Lo que hay que mirar en una clase (para los avisos): notas en una
 * presentación que NO es la de la pizarra, y notas de un documento que ya no
 * está.
 */
export function avisos(lista: ListaPresentaciones): { fuera: Presentacion[]; sueltas: number } {
  return { fuera: lista.presentaciones.filter((p) => p.notas && !p.en_pizarra && p.de !== 'blanco'), sueltas: lista.sueltas.length }
}

/** Cuándo se escribió por última vez en alguna presentación de la clase ('' si nunca). */
export function ultimaNota(lista: Pick<ListaPresentaciones, 'presentaciones'>): string {
  return lista.presentaciones.reduce((m, x) => (x.notas && x.notas.at > m ? x.notas.at : m), '')
}

/**
 * La presentación con notas que los alumnos NO tienen todavía (la clase ya se
 * dio, o es hoy): nunca se guardó para ellos, o se escribió después de
 * guardar. Devuelve la que tiene lo último escrito, para abrir su pizarra.
 * Es el caso «se quedó en la pizarra sin guardar».
 */
export function sinGuardarParaAlumnos(lista: ListaPresentaciones, fechaClase: string, hoy: string): Presentacion | null {
  if (!fechaClase || fechaClase > hoy) return null
  const escrita = ultimaNota(lista)
  if (!escrita) return null
  if (lista.publicada && escrita <= lista.publicada.at) return null
  return lista.presentaciones.find((x) => x.notas && x.notas.at === escrita) || null
}

/** En una línea: qué ven ahora los alumnos de esa clase. */
export function queVenLosAlumnos(lista: ListaPresentaciones, fechaClase: string, hoy: string, ahora: Date = new Date()): string {
  const antes = lista.presentaciones.find((x) => x.de === 'alumnos')
  const pub = lista.publicada
  const yaFue = !!fechaClase && fechaClase <= hoy
  if (pub && yaFue) return `la versión de la clase, con lo escrito en la pizarra (guardada ${cuandoFue(pub.at, ahora) || 'en la pizarra'})`
  if (pub) return antes ? 'la de antes de la clase; el día de la clase pasarán a ver la versión guardada desde la pizarra' : 'nada hasta el día de la clase; ese día verán la versión guardada desde la pizarra'
  if (antes) return `la de antes de la clase («${antes.nombre}»)`
  return 'ninguna presentación todavía'
}
