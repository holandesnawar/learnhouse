/**
 * La pestaña «Presentaciones» de la sala de profesores (22/11/2026).
 *
 * Usuario: «nadie sabemos dónde están las presentaciones ni cuál está en
 * pizarra». Aquí se ve, de un vistazo y para todas las clases: qué
 * presentación tiene cada una, cuál abre la pizarra, si tiene notas y qué ven
 * los alumnos. Arriba, lo que hay que revisar.
 *
 * Todo sale del resumen que ya viene con cada semana (`material.pizarra`,
 * `PZ.lista` en apps/api/src/services/tareas/pizarra.py): sin llamadas nuevas.
 * Funciones puras, sin pantalla.
 */
import type { ListaPresentaciones, Presentacion } from '@services/pizarra/pizarra'
import { avisos } from './presentaciones'
import { diaLegible, horaDe, quienDa, type SemanaEquipo } from './salaProfes'
import { diasEntre, lunesDe, sumarDias } from './semanasTrabajo'

export type FilaPresentaciones = {
  semana: SemanaEquipo
  /** Quién la da (la semana o el «La da» de la clase) y si es quien mira. */
  profe: string
  mia: boolean
  hora: string
  /** Sus presentaciones (la de la pizarra, primero) y las notas sueltas. */
  lista: ListaPresentaciones
  /** Si tiene algún PDF (la pizarra en blanco no cuenta). */
  conPdf: boolean
}

export type Revisar = {
  id: string
  tipo: 'sin-presentacion' | 'sin-guardar' | 'sueltas' | 'fuera'
  /** rojo: la clase está al caer y no tiene nada; ámbar: lo demás. */
  urgente: boolean
  texto: string
  boton: string
  /** A dónde lleva: la ficha de la clase (en Presentaciones) o su pizarra. */
  ir: 'ficha' | 'pizarra'
  fila: FilaPresentaciones
}

const VACIA: ListaPresentaciones = { presentaciones: [], sueltas: [], fuente: '', publicada: null }

/**
 * Las presentaciones de una clase, con lo que trae su semana. Si la escuela
 * contesta todavía sin el resumen (a medio desplegar), se monta con lo que hay:
 * los PDF del equipo y el de los alumnos, sin saber de notas.
 */
export function listaDeSemana(s: SemanaEquipo): ListaPresentaciones {
  const p = s.material?.pizarra
  if (p && Array.isArray(p.presentaciones)) {
    return { presentaciones: p.presentaciones, sueltas: p.sueltas || [], fuente: p.fuente || '', publicada: p.publicada || null }
  }
  const filas: Presentacion[] = []
  for (const a of s.material?.archivos || []) {
    if (a.tipo === 'archivo' && /\.pdf$/i.test(a.nombre || ''))
      filas.push({ id: `profe:${a.id}`, de: 'equipo', nombre: a.nombre, por: a.por || '', at: a.at || '', tam: 0, en_pizarra: false, notas: null, publicada: null })
  }
  for (const c of s.presentaciones || []) {
    filas.push({ id: `clase:${c.activity_uuid}`, de: 'alumnos', nombre: 'Presentación de los alumnos', por: '', at: '', tam: 0, en_pizarra: false, notas: null, publicada: null })
  }
  if (filas.length) filas[0] = { ...filas[0], en_pizarra: true }
  return { ...VACIA, presentaciones: filas, fuente: filas[0]?.id || '' }
}

/**
 * Las clases de la pestaña: de `atras` días antes de hoy a `adelante` días
 * después, cada una con sus presentaciones. Por fecha y hora.
 */
export function filasDePresentaciones<C extends { uuid: string; profe: string }>(
  clases: C[],
  semanas: SemanaEquipo[],
  hoy: string,
  esMia: (profe: string) => boolean,
  atras = 28,
  adelante = 21
): FilaPresentaciones[] {
  const desde = sumarDias(hoy, -atras)
  const hasta = sumarDias(hoy, adelante)
  const profeDe: Record<string, string> = {}
  for (const c of clases) profeDe[c.uuid] = c.profe
  return semanas
    .filter((s) => !s.suelta && s.semanaId && s.fecha && s.fecha >= desde && s.fecha <= hasta && s.courseUuid in profeDe)
    .map((s) => {
      const profe = quienDa(s, profeDe[s.courseUuid] || '')
      const lista = listaDeSemana(s)
      return { semana: s, profe, mia: !!profe && esMia(profe), hora: horaDe(s.hora), lista, conPdf: lista.presentaciones.some((x) => x.de !== 'blanco') }
    })
    .sort((a, b) => a.semana.fecha.localeCompare(b.semana.fecha) || (a.hora || '99').localeCompare(b.hora || '99') || a.semana.curso.localeCompare(b.semana.curso))
}

/** «Masterclass del jueves 26 nov». */
export function nombreDeClase(f: FilaPresentaciones): string {
  return `${f.semana.curso} del ${diaLegible(f.semana.fecha)}`
}

/** Cuándo se escribió por última vez en alguna presentación de la clase ('' si nunca). */
export function ultimaNota(lista: ListaPresentaciones): string {
  return lista.presentaciones.reduce((m, x) => (x.notas && x.notas.at > m ? x.notas.at : m), '')
}

/**
 * Lo que hay que mirar, lo urgente primero:
 * - clases de hoy a 7 días SIN ninguna presentación (urgente a 2 días o menos);
 * - clases ya dadas (de ayer a 14 días atrás) con notas en la pizarra que los
 *   alumnos no tienen: nunca se guardó para ellos, o se escribió después;
 * - notas de una presentación que ya no está en la clase;
 * - notas en una presentación que NO es la de la pizarra (el caso del profe
 *   que escribió en la que no era).
 * Los dos últimos, de 14 días atrás en adelante.
 */
export function paraRevisar(filas: FilaPresentaciones[], hoy: string): Revisar[] {
  const out: Revisar[] = []
  for (const f of filas) {
    const d = diasEntre(hoy, f.semana.fecha) // > 0: por venir
    const quien = nombreDeClase(f)
    if (d >= 0 && d <= 7 && !f.conPdf) {
      out.push({ id: `sp-${f.semana.key}`, tipo: 'sin-presentacion', urgente: d <= 2, texto: `${quien}: sin presentación`, boton: 'Subirla', ir: 'ficha', fila: f })
    }
    if (d < -14) continue
    const escrita = ultimaNota(f.lista)
    const pub = f.lista.publicada
    if (d < 0 && escrita && (!pub || escrita > pub.at)) {
      out.push({
        id: `sg-${f.semana.key}`,
        tipo: 'sin-guardar',
        urgente: false,
        texto: pub ? `${quien}: se escribió después de guardar para los alumnos` : `${quien}: notas sin guardar para los alumnos`,
        boton: 'Abrir la pizarra',
        ir: 'pizarra',
        fila: f,
      })
    }
    const a = avisos(f.lista)
    if (a.sueltas) {
      out.push({
        id: `su-${f.semana.key}`,
        tipo: 'sueltas',
        urgente: false,
        texto: `${quien}: hay notas de una presentación que ya no está`,
        boton: 'Verlas',
        ir: 'ficha',
        fila: f,
      })
    }
    for (const x of a.fuera) {
      out.push({
        id: `fu-${f.semana.key}-${x.id}`,
        tipo: 'fuera',
        urgente: false,
        texto: `${quien}: «${x.nombre}» tiene notas y no es la que abre la pizarra`,
        boton: 'Verlo',
        ir: 'ficha',
        fila: f,
      })
    }
  }
  // Lo urgente arriba; luego lo que cae antes.
  return out.sort((x, y) => Number(y.urgente) - Number(x.urgente) || x.fila.semana.fecha.localeCompare(y.fila.semana.fecha))
}

/** Qué ven ahora los alumnos de esa clase, en corto. */
export function queVenLosAlumnos(f: FilaPresentaciones, hoy: string): { texto: string; color: string } {
  const pub = f.lista.publicada
  const antes = f.lista.presentaciones.some((x) => x.de === 'alumnos')
  if (pub && f.semana.fecha <= hoy) return { texto: 'Alumnos: la versión de la clase', color: '#16A34A' }
  if (pub) return { texto: 'Alumnos: verán la versión de la clase desde ese día', color: '#16A34A' }
  if (antes) return { texto: 'Alumnos: la de antes de la clase', color: '' }
  return { texto: 'Alumnos: nada todavía', color: '' }
}

export type GrupoPresentaciones = { clave: string; titulo: string; pasada: boolean; items: FilaPresentaciones[] }

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corto = (f: string) => `${Number(f.slice(8, 10))} ${MES[Number(f.slice(5, 7)) - 1]}`

/**
 * Por semanas: esta, las que vienen (en orden) y, detrás, las anteriores (la
 * más reciente primero). Cada una con sus días: «Esta semana · 23 a 29 nov».
 */
export function porSemanas(filas: FilaPresentaciones[], hoy: string): GrupoPresentaciones[] {
  const lunesHoy = lunesDe(hoy)
  const grupos: Record<string, FilaPresentaciones[]> = {}
  for (const f of filas) (grupos[lunesDe(f.semana.fecha)] = grupos[lunesDe(f.semana.fecha)] || []).push(f)
  const todos = Object.keys(grupos).map((lunes) => {
    const d = diasEntre(lunesHoy, lunes)
    const nombre = d === 0 ? 'Esta semana' : d === 7 ? 'La semana que viene' : d === -7 ? 'La semana pasada' : `Semana del ${corto(lunes)}`
    const domingo = sumarDias(lunes, 6)
    const dias = lunes.slice(5, 7) === domingo.slice(5, 7) ? `${Number(lunes.slice(8, 10))} a ${corto(domingo)}` : `${corto(lunes)} a ${corto(domingo)}`
    const titulo = Math.abs(d) <= 7 ? `${nombre} · ${dias}` : nombre
    return { clave: lunes, titulo, pasada: d < 0, items: grupos[lunes] }
  })
  const delante = todos.filter((g) => !g.pasada).sort((a, b) => a.clave.localeCompare(b.clave))
  const detras = todos.filter((g) => g.pasada).sort((a, b) => b.clave.localeCompare(a.clave))
  return [...delante, ...detras]
}

const plano = (t: string) =>
  (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Buscar por el tema, la clase, quién la da o el nombre de una presentación. */
export function coincide(f: FilaPresentaciones, texto: string): boolean {
  const q = plano(texto).trim()
  if (!q) return true
  const donde = [f.semana.tema, f.semana.curso, f.profe, ...f.lista.presentaciones.map((x) => x.nombre), ...f.lista.sueltas.map((x) => x.nombre)]
  return donde.some((x) => plano(x).includes(q))
}
