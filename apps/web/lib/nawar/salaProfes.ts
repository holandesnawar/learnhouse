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

import { diasEntre, sumarDias } from './semanasTrabajo'

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
    if (d <= 0 && d >= -7 && s.lista && !s.lista.pasada) {
      lista.push({ id: `l-${s.key}`, tipo: 'lista', texto: `Pasar lista de ${tema}`, detalle: de, urgente: d < 0, fecha: s.fecha, semana: s })
    }
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
