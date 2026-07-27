/**
 * Mapa de progreso por módulo/lección — LÓGICA PURA (sin red, sin React) para
 * poder testearla. Recibe los intentos y compleciones del servidor y deriva,
 * por lección: estado de cada sección, nota, dónde te quedaste y qué repasar.
 */

import { getModules, getLessonsForModule, getExtrasForModule } from './courseService'
import type { Lesson } from './types'
import type { LastAttempt } from './lastAttempts'
import type { LessonCompletion } from '@services/student/progress'

export const SECTION_LABEL: Record<string, string> = {
  resumen: 'Resumen',
  vocabulary: 'Vocabulario',
  flashcards: 'Flashcards',
  lezen: 'Lezen',
  luisteren: 'Luisteren',
}

export interface SectionProgress {
  id: string
  label: string
  done: boolean
  /** null cuando el registro no lleva nota (marcador hecha/no hecha). */
  pct: number | null
  score: number
  total: number
  fails: number
}

export interface LessonProgressRow {
  lessonId: string
  moduleId: string
  moduleOrder: number
  title: string
  isExtra: boolean
  completed: boolean
  started: boolean
  sections: SectionProgress[]
  /** Media de las secciones con nota (null si ninguna la lleva). */
  pct: number | null
  /** Primera sección aún no hecha — "te quedaste en…". */
  nextSection: SectionProgress | null
  /** Sección con fallos y peor nota — el mejor candidato a repasar. */
  worstFailing: SectionProgress | null
  /** Total de ejercicios fallados pendientes en la lección. */
  totalFails: number
}

export interface ModuleProgress {
  id: string
  order: number
  title: string
  emoji?: string
  lessons: LessonProgressRow[]
  totalLessons: number
  completed: number
  avg: number | null
}

/** Secciones "seguibles" de una lección (las que guardan intento). */
export function trackedSectionIds(lesson: Lesson): string[] {
  const out: string[] = []
  for (const b of lesson.blocks) {
    if (b.type === 'vocabulary') out.push('vocabulary', 'flashcards')
    else if (b.type === 'lezen') out.push('lezen')
    else if (b.type === 'dialogue') out.push('luisteren')
  }
  return out
}

export function buildLessonRow(
  lesson: Lesson,
  moduleId: string,
  moduleOrder: number,
  attempts: Record<string, LastAttempt>,
  completedSet: Set<string>,
  isExtra = false
): LessonProgressRow {
  const sections: SectionProgress[] = trackedSectionIds(lesson).map((sid) => {
    const a = attempts[`${lesson.id}-${sid}`]
    // Un intento a medias significa "la empezó", no "la hizo": ni cuenta como
    // sección hecha ni lleva nota (si no, 'te quedaste en...' se la saltaría).
    const partial = Boolean(a?.partial)
    const scored = Boolean(a && a.total > 0 && !partial)
    return {
      id: sid,
      label: SECTION_LABEL[sid] || sid,
      done: Boolean(a) && !partial,
      pct: scored ? Math.round((a!.score / a!.total) * 100) : null,
      score: scored ? a!.score : 0,
      total: scored ? a!.total : 0,
      fails: partial ? 0 : a?.failedLabels?.length ?? 0,
    }
  })

  const scored = sections.filter((s) => s.pct !== null)
  const failing = sections
    .filter((s) => s.fails > 0)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))

  return {
    lessonId: lesson.id,
    moduleId,
    moduleOrder,
    title: lesson.title,
    isExtra,
    completed: completedSet.has(lesson.id),
    started: sections.some((s) => s.done) || completedSet.has(lesson.id),
    sections,
    pct: scored.length
      ? Math.round(scored.reduce((acc, s) => acc + (s.pct as number), 0) / scored.length)
      : null,
    nextSection: sections.find((s) => !s.done) ?? null,
    worstFailing: failing[0] ?? null,
    totalFails: sections.reduce((acc, s) => acc + s.fails, 0),
  }
}

/** Mapa completo: todos los módulos con TODAS sus lecciones (también las no
 *  empezadas — así el alumno ve el camino entero). */
export function buildProgressMap(
  attempts: Record<string, LastAttempt>,
  completions: LessonCompletion[]
): ModuleProgress[] {
  const completedSet = new Set(completions.map((c) => c.lesson_id))
  return getModules().map((m) => {
    const rows = [
      ...getLessonsForModule(m.id).map((l) =>
        buildLessonRow(l, m.id, m.order, attempts, completedSet)
      ),
      ...getExtrasForModule(m.id).map((l) =>
        buildLessonRow(l, m.id, m.order, attempts, completedSet, true)
      ),
    ]
    const scored = rows.filter((r) => r.pct !== null)
    return {
      id: m.id,
      order: m.order,
      title: m.title,
      emoji: m.emoji,
      lessons: rows,
      totalLessons: rows.length,
      completed: rows.filter((r) => r.completed).length,
      avg: scored.length
        ? Math.round(scored.reduce((acc, r) => acc + (r.pct as number), 0) / scored.length)
        : null,
    }
  })
}

/** Todas las lecciones del camino: principales + extras. */
export function totalLessonsInCourse(): number {
  let n = 0
  for (const m of getModules()) {
    n += getLessonsForModule(m.id).length + getExtrasForModule(m.id).length
  }
  return n
}

/** % general del curso: media del avance de TODAS las lecciones (principales
 *  + extras). Una lección completada cuenta 100%; si no, cuenta la fracción de
 *  sus secciones seguibles ya hechas — así el avance parcial también suma. */
export function overallCourseProgress(
  attempts: Record<string, LastAttempt>,
  completions: LessonCompletion[]
): number {
  const completedSet = new Set(completions.map((c) => c.lesson_id))
  let sum = 0
  let count = 0
  for (const m of getModules()) {
    for (const l of [...getLessonsForModule(m.id), ...getExtrasForModule(m.id)]) {
      count++
      if (completedSet.has(l.id)) {
        sum += 1
        continue
      }
      const ids = trackedSectionIds(l)
      if (!ids.length) continue
      const done = ids.filter((sid) => {
        const a = attempts[`${l.id}-${sid}`]
        return a && !a.partial
      }).length
      sum += done / ids.length
    }
  }
  return count ? Math.round((sum / count) * 100) : 0
}

/** Secciones dominadas (nota ≥ 85%) en todo el curso. */
export function masteredSectionsCount(attempts: Record<string, LastAttempt>): number {
  let n = 0
  for (const key of Object.keys(attempts)) {
    const a = attempts[key]
    if (a.partial) continue
    if (a.total > 0 && Math.round((a.score / a.total) * 100) >= 85) n++
  }
  return n
}
