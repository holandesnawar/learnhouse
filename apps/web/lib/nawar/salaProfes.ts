/**
 * Las cuentas de la sala de profes (08/11/2026). Puras, con test
 * (`__tests__/salaProfes.test.ts`).
 *
 * - `loQueToca`: lo que el equipo tiene pendiente con las clases, sacado de lo
 *   que cada semana tiene dentro (presentación, grabación, lista) y de las
 *   tareas por corregir y los check-in. No se guarda nada.
 * - `porMeses`: el archivo de las clases, mes a mes, lo más nuevo arriba.
 * - `bloquesDeTexto`: el formato sencillo del manual (`## `, `### `, `- `,
 *   `1. `, `**negrita**`).
 * - `misTareas`: las tareas sin hacer de una persona (y las de todo el equipo).
 */

import { diasEntre, lunesDe, sumarDias } from './semanasTrabajo'

export type SemanaEquipo = {
  key: string
  semanaId: number
  courseUuid: string
  curso: string
  color: string
  tema: string
  fecha: string
  hora: string
  profe: string
  presentaciones: { activity_uuid: string; nombre: string }[]
  grabaciones: { activity_uuid: string; nombre: string }[]
  ejercicios: { activity_uuid: string; nombre: string }[]
  tieneTarea: boolean
  enunciado: string
  lista: { pasada: boolean; vinieron: number } | null
  porCorregir: number
  /** Una grabación de los meses de antes sin semana (06/11/2026). */
  suelta?: boolean
  /** La presentación completa y las notas para el profe (09/11/2026). */
  material?: {
    notas: string
    archivos: { id: string; tipo: 'archivo' | 'enlace'; nombre: string; url?: string; por: string; at: string }[]
    profe?: string
    mensaje?: { texto: string; por: string; at: string; leido_por: string; leido_at: string } | null
    /** La pizarra de clase (10/11/2026). */
    pizarra?: { guardada_at: string; publicada_at: string; paginas: number } | null
  }
}

export type Pendiente = {
  id: string
  tipo: 'presentacion' | 'lista' | 'grabacion' | 'corregir' | 'checkin'
  texto: string
  detalle: string
  urgente: boolean
  fecha: string
  semana?: SemanaEquipo
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «lunes 10 nov». */
export function diaLegible(fecha: string): string {
  if (!fecha || fecha.length < 10) return ''
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`)
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`
}

/** «hoy», «mañana», «ayer» o el día. */
export function cuando(fecha: string, hoy: string): string {
  const d = diasEntre(hoy, fecha)
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d === -1) return 'ayer'
  return `el ${diaLegible(fecha)}`
}

/**
 * Lo que toca con las clases:
 * - la presentación de las clases de los próximos 7 días que aún no la tienen
 *   (urgente si la clase es en 2 días o menos);
 * - pasar lista de las clases de los últimos 7 días que ya se dieron (desde el
 *   día de la clase) y no la tienen;
 * - la grabación de las clases de los últimos 14 días que no la tienen
 *   (urgente si ya han pasado más de 2 días);
 * - las tareas por corregir y los check-in, en una línea cada uno.
 * Lo urgente arriba; dentro, por fecha.
 */
export function loQueToca(semanas: SemanaEquipo[], hoy: string, porCorregir: number, checkins: number): Pendiente[] {
  const lista: Pendiente[] = []
  for (const s of semanas) {
    if (!s.fecha || s.suelta) continue
    const d = diasEntre(hoy, s.fecha)
    const de = `${s.curso} · ${cuando(s.fecha, hoy)}`
    const tema = s.tema ? `«${s.tema}»` : 'la clase'
    if (d >= 0 && d <= 7 && !s.presentaciones.length) {
      lista.push({ id: `p-${s.key}`, tipo: 'presentacion', texto: `Subir la presentación de ${tema}`, detalle: de, urgente: d <= 2, fecha: s.fecha, semana: s })
    }
    // Pasar lista ya no es una tarea (09/11/2026): la sala cuenta sola quién
    // entra. La lista queda para corregir a mano si hace falta.
    if (d < 0 && d >= -14 && !s.grabaciones.length) {
      lista.push({ id: `g-${s.key}`, tipo: 'grabacion', texto: `Subir la grabación de ${tema}`, detalle: de, urgente: d < -2, fecha: s.fecha, semana: s })
    }
  }
  if (porCorregir > 0) {
    lista.push({
      id: 'corregir',
      tipo: 'corregir',
      texto: porCorregir === 1 ? 'Corregir 1 tarea entregada' : `Corregir ${porCorregir} tareas entregadas`,
      detalle: 'En Seguimiento → Por corregir',
      urgente: porCorregir >= 5,
      fecha: hoy,
    })
  }
  if (checkins > 0) {
    lista.push({
      id: 'checkin',
      tipo: 'checkin',
      texto: checkins === 1 ? '1 check-in con un alumno' : `${checkins} check-in con alumnos`,
      detalle: 'Semanas 4, 8 y 12 de su camino · en Seguimiento',
      urgente: false,
      fecha: hoy,
    })
  }
  return lista.sort((a, b) => Number(b.urgente) - Number(a.urgente) || a.fecha.localeCompare(b.fecha))
}

/** La próxima clase: la primera de hoy en adelante. */
export function proximaClase(semanas: SemanaEquipo[], hoy: string): SemanaEquipo | null {
  return semanas.filter((s) => !s.suelta && s.fecha && s.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null
}

/** La semana en curso de cada clase: la de esta semana (lunes a domingo). */
export function semanaDeCadaClase(semanas: SemanaEquipo[], hoy: string, lunes: string): SemanaEquipo[] {
  const domingo = sumarDias(lunes, 6)
  const por: Record<string, SemanaEquipo> = {}
  for (const s of semanas) {
    if (s.suelta || !s.fecha || s.fecha < lunes || s.fecha > domingo) continue
    if (!por[s.courseUuid] || s.fecha < por[s.courseUuid].fecha) por[s.courseUuid] = s
  }
  return Object.values(por).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** El archivo, mes a mes: «noviembre 2026» con lo de ese mes, lo más nuevo arriba. */
export function porMeses<T extends { fecha: string }>(items: T[]): { clave: string; titulo: string; items: T[] }[] {
  const grupos: Record<string, T[]> = {}
  for (const it of items) {
    const clave = it.fecha && it.fecha.length >= 7 ? it.fecha.slice(0, 7) : 'sin-fecha'
    ;(grupos[clave] = grupos[clave] || []).push(it)
  }
  return Object.keys(grupos)
    .sort((a, b) => (a === 'sin-fecha' ? 1 : b === 'sin-fecha' ? -1 : b.localeCompare(a)))
    .map((clave) => ({
      clave,
      titulo: clave === 'sin-fecha' ? 'Sin fecha' : `${MESES[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`,
      items: grupos[clave].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    }))
}

export type Bloque =
  | { tipo: 'h2' | 'h3' | 'p'; texto: string }
  | { tipo: 'ul' | 'ol'; items: string[] }

/** El formato del manual: `## ` título, `### ` subtítulo, `- ` punto, `1. ` paso. */
export function bloquesDeTexto(texto: string): Bloque[] {
  const bloques: Bloque[] = []
  for (const linea of String(texto || '').split('\n')) {
    const l = linea.trim()
    if (!l) continue
    const ultimo = bloques[bloques.length - 1]
    if (l.startsWith('### ')) bloques.push({ tipo: 'h3', texto: l.slice(4) })
    else if (l.startsWith('## ')) bloques.push({ tipo: 'h2', texto: l.slice(3) })
    else if (/^[-•*] /.test(l)) {
      if (ultimo && ultimo.tipo === 'ul') ultimo.items.push(l.slice(2))
      else bloques.push({ tipo: 'ul', items: [l.slice(2)] })
    } else if (/^\d+[.)] /.test(l)) {
      const t = l.replace(/^\d+[.)] /, '')
      if (ultimo && ultimo.tipo === 'ol') ultimo.items.push(t)
      else bloques.push({ tipo: 'ol', items: [t] })
    } else bloques.push({ tipo: 'p', texto: l })
  }
  return bloques
}

/** Trozos de una línea: lo que va entre `**` en negrita. */
export function trozosNegrita(texto: string): { t: string; negrita: boolean }[] {
  return String(texto || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((t) => (t.startsWith('**') && t.endsWith('**') && t.length > 4 ? { t: t.slice(2, -2), negrita: true } : { t, negrita: false }))
}

type ConEstado = { estado: string; asignado_id: number; fecha: string; prioridad: string; orden: number }

/** Las tareas sin hacer de esta persona (y las de todo el equipo): primero
 *  las que vencen antes; las sin fecha, al final. */
export function misTareas<T extends ConEstado>(tareas: T[], yo: number): T[] {
  return tareas
    .filter((t) => t.estado !== 'hecho' && (!t.asignado_id || t.asignado_id === yo))
    .sort(
      (a, b) =>
        (a.fecha || '9999').localeCompare(b.fecha || '9999') ||
        Number(b.prioridad === 'alta') - Number(a.prioridad === 'alta') ||
        a.orden - b.orden
    )
}

export function vencida(t: { fecha: string; estado: string }, hoy: string): boolean {
  return !!t.fecha && t.fecha < hoy && t.estado !== 'hecho'
}

export type ClaseDeLaSemana<C> = { clase: C; esta: SemanaEquipo | null; proxima: SemanaEquipo | null }

/**
 * «Mis clases» (08/11/2026, segunda vuelta: "el profe su única tarea es
 * preparar la clase y darla… si le toca esa semana x grupo y x clase, que solo
 * vea eso"): cada clase con su semana de ESTA semana (lunes a domingo) y la de
 * la que viene, o nada si aún no está creada. Primero las que tienen clase esta
 * semana, por día; luego las demás.
 */
export function porClase<C extends { uuid: string; nombre: string }>(
  clases: C[],
  semanas: SemanaEquipo[],
  lunes: string
): ClaseDeLaSemana<C>[] {
  const domingo = sumarDias(lunes, 6)
  const lunes2 = sumarDias(lunes, 7)
  const domingo2 = sumarDias(lunes, 13)
  const en = (c: C, desde: string, hasta: string) =>
    semanas
      .filter((s) => !s.suelta && s.courseUuid === c.uuid && s.fecha && s.fecha >= desde && s.fecha <= hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null
  return clases
    .map((clase) => ({ clase, esta: en(clase, lunes, domingo), proxima: en(clase, lunes2, domingo2) }))
    .sort(
      (a, b) =>
        Number(!a.esta) - Number(!b.esta) ||
        (a.esta?.fecha || '').localeCompare(b.esta?.fecha || '') ||
        a.clase.nombre.localeCompare(b.clase.nombre)
    )
}

/**
 * Para preparar cada clase (09/11/2026, "la siguiente clase no está bien del
 * todo"): antes se miraba la semana del CALENDARIO (lunes a domingo), así que
 * el domingo la clase del martes salía como «la semana que viene» y la de
 * esta semana, ya dada, seguía arriba. Ahora:
 * - `siguiente`: la primera clase de hoy en adelante (la que hay que preparar);
 * - `despues`: la que va detrás;
 * - `anterior`: la última ya dada en los últimos 10 días, con lo que le falta
 *   (pasar lista, la grabación, corregir) en `pendiente`.
 * Las clases con la próxima más cerca, arriba.
 */
export type Pendiente_ = 'lista' | 'grabacion' | 'corregir'

export type ClaseParaPreparar<C> = {
  clase: C
  siguiente: SemanaEquipo | null
  despues: SemanaEquipo | null
  anterior: SemanaEquipo | null
  pendiente: Pendiente_[]
}

export function paraPreparar<C extends { uuid: string; nombre: string }>(
  clases: C[],
  semanas: SemanaEquipo[],
  hoy: string
): ClaseParaPreparar<C>[] {
  const hace10 = sumarDias(hoy, -10)
  return clases
    .map((clase) => {
      const suyas = semanas
        .filter((s) => !s.suelta && s.courseUuid === clase.uuid && s.fecha)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      const i = suyas.findIndex((s) => s.fecha >= hoy)
      const siguiente = i >= 0 ? suyas[i] : null
      const despues = i >= 0 ? suyas[i + 1] || null : null
      const pasadas = suyas.filter((s) => s.fecha < hoy && s.fecha >= hace10)
      const anterior = pasadas.length ? pasadas[pasadas.length - 1] : null
      const pendiente: Pendiente_[] = []
      if (anterior) {
        if (!anterior.grabaciones.length) pendiente.push('grabacion')
        if (anterior.porCorregir > 0) pendiente.push('corregir')
      }
      return { clase, siguiente, despues, anterior, pendiente }
    })
    .sort(
      (a, b) =>
        Number(!a.siguiente) - Number(!b.siguiente) ||
        (a.siguiente?.fecha || '').localeCompare(b.siguiente?.fecha || '') ||
        a.clase.nombre.localeCompare(b.clase.nombre)
    )
}

/**
 * Quién da una semana (09/11/2026, "cada profe debe ver la clase que tiene
 * asignada… en masterclass también su parte"): el profe puesto en ESA semana
 * y, si no hay, el «La da» de la clase.
 */
export function quienDa(semana: SemanaEquipo | null | undefined, profeDeLaClase: string): string {
  return (semana?.material?.profe || '').trim() || profeDeLaClase || ''
}

/**
 * Las tarjetas que son de esta persona: la próxima clase o la de después la
 * da ella (por la semana o por la clase). Lo de los demás no sale.
 */
export function lasMias<C extends { profe: string }>(
  filas: ClaseParaPreparar<C>[],
  esDeEsta: (profe: string) => boolean
): ClaseParaPreparar<C>[] {
  return filas.filter(
    (f) =>
      esDeEsta(quienDa(f.siguiente, f.clase.profe)) ||
      esDeEsta(quienDa(f.despues, f.clase.profe)) ||
      (!f.siguiente && esDeEsta(f.clase.profe))
  )
}

/**
 * La hora de una clase sacada del recuadro («Martes 19:00», «19.30 h»): «19:00».
 * Sin hora, "".
 */
export function horaDe(texto: string): string {
  const m = String(texto || '').match(/\b([01]?\d|2[0-3])\s*[:.h]\s*([0-5]\d)\b/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

export type ClaseEnAgenda = { semana: SemanaEquipo; profe: string; mia: boolean; hora: string }

/**
 * El calendario de la sala de profes (10/11/2026, "un calendario para que los
 * profes vean las clases siguientes, con quién da cada una"): las semanas ya
 * creadas de hoy a `dias` días, por fecha y hora, con quién la da (la semana
 * o el «La da» de la clase) y si es de quien mira.
 */
export function agendaEquipo<C extends { uuid: string; profe: string }>(
  clases: C[],
  semanas: SemanaEquipo[],
  hoy: string,
  esMia: (profe: string) => boolean,
  dias = 28
): ClaseEnAgenda[] {
  const hasta = sumarDias(hoy, dias)
  const profeDe: Record<string, string> = {}
  for (const c of clases) profeDe[c.uuid] = c.profe
  return semanas
    .filter((s) => !s.suelta && s.fecha && s.fecha >= hoy && s.fecha <= hasta && s.courseUuid in profeDe)
    .map((s) => {
      const profe = quienDa(s, profeDe[s.courseUuid] || '')
      return { semana: s, profe, mia: !!profe && esMia(profe), hora: horaDe(s.hora) }
    })
    .sort((a, b) => a.semana.fecha.localeCompare(b.semana.fecha) || (a.hora || '99').localeCompare(b.hora || '99') || a.semana.curso.localeCompare(b.semana.curso))
}

/** El calendario por semanas: «Esta semana», «La semana que viene», «Semana del 23 nov». */
export function porSemanasDeAgenda(items: ClaseEnAgenda[], hoy: string): { clave: string; titulo: string; items: ClaseEnAgenda[] }[] {
  const lunesHoy = lunesDe(hoy)
  const grupos: Record<string, ClaseEnAgenda[]> = {}
  for (const it of items) (grupos[lunesDe(it.semana.fecha)] = grupos[lunesDe(it.semana.fecha)] || []).push(it)
  return Object.keys(grupos)
    .sort()
    .map((lunes) => {
      const d = diasEntre(lunesHoy, lunes)
      const titulo = d <= 0 ? 'Esta semana' : d === 7 ? 'La semana que viene' : `Semana del ${diaLegible(lunes).replace(/^\S+ /, '')}`
      return { clave: lunes, titulo, items: grupos[lunes] }
    })
}

/** Las clases sin ninguna semana creada de hoy en adelante: no salen en el calendario. */
export function sinSemanaPorDelante<C extends { uuid: string }>(clases: C[], semanas: SemanaEquipo[], hoy: string): C[] {
  return clases.filter((c) => !semanas.some((s) => !s.suelta && s.courseUuid === c.uuid && s.fecha && s.fecha >= hoy))
}


// ── La misma semana en los dos grupos (10/11/2026) ──────────────────────────
//
// Cada grupo (Groep rood, Groep blauw) es una clase, y cada semana existe una
// vez por grupo. Para quien lo ve todo (el administrador) eso eran dos «Mijn
// huis» seguidos. Aquí se emparejan para enseñarlas como UNA con sus dos días.
// El servidor hace lo mismo para «Guardar también en el otro grupo»
// (apps/api/src/services/tareas/gemelas.py).

const sinTildes = (t: string) =>
  (t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** «Clase semanal · Groep rood» y «Clase semanal · Groep blauw» son la misma clase. */
export const familiaDe = (curso: string) => sinTildes((curso || '').split(' · ')[0])

/** La etiqueta del grupo («Groep rood»), o el nombre entero si no la lleva. */
export const grupoDe = (curso: string) => (curso || '').split(' · ').slice(1).join(' · ') || curso

function mismoTema(a: string, b: string): boolean {
  const x = sinTildes(a)
  const y = sinTildes(b)
  if (!x || !y) return false
  if (x === y) return true
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x]
  return corto.length >= 4 && largo.includes(corto)
}

/** La misma semana en la clase del otro grupo: mismo tema a 6 días o menos; si no, la única de esa semana del calendario. */
export function gemelaDe(s: SemanaEquipo, semanas: SemanaEquipo[]): SemanaEquipo | null {
  if (s.suelta || !s.fecha) return null
  const cerca = semanas.filter(
    (o) => !o.suelta && o.courseUuid !== s.courseUuid && familiaDe(o.curso) === familiaDe(s.curso) && Math.abs(diasEntre(s.fecha, o.fecha)) <= 6
  )
  const conTema = cerca.filter((o) => mismoTema(s.tema, o.tema)).sort((a, b) => Math.abs(diasEntre(s.fecha, a.fecha)) - Math.abs(diasEntre(s.fecha, b.fecha)))
  if (conTema.length) return conTema[0]
  const misma = cerca.filter((o) => lunesDe(o.fecha) === lunesDe(s.fecha))
  return misma.length === 1 ? misma[0] : null
}

export type ClaseConGemela = ClaseEnAgenda & { gemela?: SemanaEquipo }

/**
 * La agenda sin repetir: de cada pareja de semanas gemelas se queda la
 * primera y lleva la otra dentro (`gemela`), para pintarlas en una sola línea.
 */
export function sinRepetirGemelas(items: ClaseEnAgenda[], semanas: SemanaEquipo[]): ClaseConGemela[] {
  const dentro = new Set<string>()
  const out: ClaseConGemela[] = []
  for (const it of items) {
    if (dentro.has(it.semana.key)) continue
    const g = gemelaDe(it.semana, semanas)
    if (g && !dentro.has(g.key) && !out.some((o) => o.semana.key === g.key)) {
      dentro.add(g.key)
      out.push({ ...it, gemela: g })
    } else out.push(it)
  }
  return out
}
