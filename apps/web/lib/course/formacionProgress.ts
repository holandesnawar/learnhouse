/**
 * Progreso de TODA la formación — lógica pura (sin red, sin React).
 *
 * A diferencia del mapa de la app de ejercicios, esto se construye sobre la
 * estructura REAL del curso (capítulos → clases del curso), que es lo que ve
 * el alumno y lo que lleva los candados del goteo. Así "Mi progreso" enseña el
 * camino entero (vídeos, guías y prácticas), y no solo lo que se practicó en
 * la app de ejercicios.
 *
 * Tres niveles:
 *   Módulo  = capítulo del curso            ("MODULE 1 - OVER JOU")
 *   Clase   = las secciones que comparten número  (1.x, 2.x, …)
 *   Sección = cada clase del curso           ("1.4 Lezen")
 */

import type { LastAttempt } from '@/lib/exercises-app/lastAttempts'

export interface ActivityLike {
  id: number
  activity_uuid: string
  name: string
  content?: any
  is_locked?: boolean
  unlock_date?: string | null
}

export interface ChapterLike {
  id?: number
  chapter_uuid?: string
  name: string
  activities?: ActivityLike[] | null
  is_locked?: boolean
  unlock_date?: string | null
}

export interface SectionRow {
  activityId: number
  activityUuid: string
  /** "1.4" cuando el nombre lo lleva delante; vacío si no. */
  code: string
  /** Nombre sin el número: "Lezen". */
  label: string
  done: boolean
  /** true si es una práctica que guarda nota (vocabulario, lezen, luisteren…). */
  isPractice: boolean
  /** null cuando no hay intento con nota. */
  pct: number | null
  score: number
  total: number
  fails: number
  failedLabels: string[]
}

export interface ClassRow {
  key: string
  /** Número de clase dentro del módulo ("1", "2"…) o vacío para las sueltas. */
  number: string
  title: string
  sections: SectionRow[]
  done: number
  total: number
  /** Media de las secciones con nota. */
  pct: number | null
  fails: number
  started: boolean
  completed: boolean
}

export interface ModuleRow {
  key: string
  title: string
  classes: ClassRow[]
  done: number
  total: number
  pct: number | null
  fails: number
  started: boolean
  completed: boolean
  unlockDate: string | null
}

/** Secciones de la app de ejercicios que guardan nota. */
const PRACTICE_SECTIONS = new Set(['vocabulary', 'flashcards', 'lezen', 'luisteren'])

/**
 * La "Clase semanal" (los directos) es un curso aparte, no la formación: no
 * cuenta para el progreso ni puede confundirse con ella al elegir el curso.
 */
export const WEEKLY_CLASS_COURSE_UUID = 'bfbcb42b-7dc3-4448-9df8-5d7b96135859'

export function isWeeklyClassCourse(uuid: unknown): boolean {
  return String(uuid || '').includes(WEEKLY_CLASS_COURSE_UUID)
}

/**
 * Clave del intento guardado para una clase del curso.
 * El ejercicio nativo viaja en el activity como "nawar:<módulo>/<lección>/<sección>"
 * y los intentos se guardan como "<lección>-<sección>".
 */
export function attemptKeyOf(activity: ActivityLike): string | null {
  const embed = activity?.content?.embed_url
  if (typeof embed !== 'string' || !embed) return null
  const token = embed.match(/^nawar:([^/]+)\/([^/]+)(?:\/([^/]+))?$/)
  if (token) {
    const lesson = token[2]
    const section = token[3]
    return section ? `${lesson}-${section}` : null
  }
  return null
}

/** ¿Es una práctica con nota? */
export function isPracticeActivity(activity: ActivityLike): boolean {
  const embed = activity?.content?.embed_url
  if (typeof embed !== 'string') return false
  const token = embed.match(/^nawar:[^/]+\/[^/]+\/([^/]+)$/)
  return Boolean(token && PRACTICE_SECTIONS.has(token[1]))
}

/**
 * "1.4 Lezen" → { number: "1", code: "1.4", label: "Lezen" }
 *
 * El número se busca en cualquier parte del nombre, no solo al principio:
 * "Les 1 — 1.4 Lezen" agrupa igual de bien que "1.4 Lezen". Si no hay número,
 * la clase se queda suelta y se muestra con su nombre entero.
 */
export function splitActivityName(name: string): { number: string; code: string; label: string } {
  const raw = (name || '').trim()
  const m = raw.match(/(?:^|\s)(\d+)\.(\d+)(?=\s|$|[-—.:)])/)
  if (!m) return { number: '', code: '', label: raw }
  const code = `${m[1]}.${m[2]}`
  const label = raw
    .replace(m[0], ' ')
    .replace(/^\s*[-—.:)]+\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { number: m[1], code, label: label || raw }
}

function avg(values: number[]): number | null {
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Construye el árbol del curso con el estado de cada sección.
 *
 * @param chapters   capítulos del curso (con sus clases)
 * @param completedActivityIds  ids de las clases ya completadas (del trail)
 * @param attempts   últimos intentos por sección
 * @param includeLocked  false (por defecto) esconde los módulos que el goteo
 *                       todavía no ha abierto: el alumno no debe ver el
 *                       progreso de algo a lo que no puede entrar.
 */
export function buildFormacionProgress(
  chapters: ChapterLike[],
  completedActivityIds: Set<number>,
  attempts: Record<string, LastAttempt>,
  includeLocked = false
): ModuleRow[] {
  const out: ModuleRow[] = []

  for (const [ci, chapter] of (chapters || []).entries()) {
    if (!includeLocked && chapter?.is_locked) continue
    const activities = (chapter?.activities ?? []).filter(Boolean)
    if (!activities.length) continue

    // Agrupar por número de clase conservando el orden del curso.
    const groups = new Map<string, ClassRow>()
    for (const [ai, activity] of activities.entries()) {
      const { number, code, label } = splitActivityName(activity.name)
      // Las sueltas (sin "N.M") van cada una en su propia fila: son cosas como
      // "Bienvenid@" o "Guía de estudio", que no pertenecen a ninguna clase.
      const groupKey = number || `solo-${ai}`

      const key = attemptKeyOf(activity)
      const attempt = key ? attempts[key] : undefined
      const partial = Boolean(attempt?.partial)
      const scored = Boolean(attempt && attempt.total > 0 && !partial)

      const section: SectionRow = {
        activityId: activity.id,
        activityUuid: (activity.activity_uuid || '').replace('activity_', ''),
        code,
        label,
        done: completedActivityIds.has(activity.id),
        isPractice: isPracticeActivity(activity),
        pct: scored ? Math.round((attempt!.score / attempt!.total) * 100) : null,
        score: scored ? attempt!.score : 0,
        total: scored ? attempt!.total : 0,
        fails: partial ? 0 : attempt?.failedLabels?.length ?? 0,
        failedLabels: partial ? [] : attempt?.failedLabels ?? [],
      }

      const existing = groups.get(groupKey)
      if (existing) {
        existing.sections.push(section)
      } else {
        groups.set(groupKey, {
          key: `${ci}-${groupKey}`,
          number,
          title: number ? `Lección ${number}` : label,
          sections: [section],
          done: 0,
          total: 0,
          pct: null,
          fails: 0,
          started: false,
          completed: false,
        })
      }
    }

    const classes = [...groups.values()].map((c) => {
      const done = c.sections.filter((s) => s.done).length
      const scored = c.sections.filter((s) => s.pct !== null).map((s) => s.pct as number)
      return {
        ...c,
        done,
        total: c.sections.length,
        pct: avg(scored),
        fails: c.sections.reduce((acc, s) => acc + s.fails, 0),
        started: done > 0 || c.sections.some((s) => s.pct !== null),
        completed: done === c.sections.length,
      }
    })

    const doneCount = classes.reduce((acc, c) => acc + c.done, 0)
    const totalCount = classes.reduce((acc, c) => acc + c.total, 0)
    const scored = classes.filter((c) => c.pct !== null).map((c) => c.pct as number)

    out.push({
      key: chapter.chapter_uuid || `chapter-${ci}`,
      title: chapter.name,
      classes,
      done: doneCount,
      total: totalCount,
      pct: avg(scored),
      fails: classes.reduce((acc, c) => acc + c.fails, 0),
      started: doneCount > 0 || classes.some((c) => c.started),
      completed: totalCount > 0 && doneCount === totalCount,
      unlockDate: chapter.unlock_date ?? null,
    })
  }

  return out
}

/** Ids de clases completadas, sacados del trail del alumno para ese curso. */
export function completedActivityIds(run: any): Set<number> {
  const ids = new Set<number>()
  for (const step of run?.steps ?? []) {
    if (step?.complete === true && typeof step.activity_id === 'number') ids.add(step.activity_id)
  }
  return ids
}

/** El run del trail que corresponde a este curso. */
export function findRun(trailData: any, courseUuid: string): any {
  const clean = (courseUuid || '').replace('course_', '')
  return (
    (trailData?.runs ?? []).find(
      (r: any) => (r?.course?.course_uuid || '').replace('course_', '') === clean
    ) ?? null
  )
}

/** Resumen de arriba: hecho / total y nota media de toda la formación. */
export function summarize(modules: ModuleRow[]): {
  done: number
  total: number
  pct: number
  avgPct: number | null
  fails: number
} {
  const done = modules.reduce((acc, m) => acc + m.done, 0)
  const total = modules.reduce((acc, m) => acc + m.total, 0)
  const scored = modules.filter((m) => m.pct !== null).map((m) => m.pct as number)
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    avgPct: avg(scored),
    fails: modules.reduce((acc, m) => acc + m.fails, 0),
  }
}
