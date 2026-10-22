'use client'
/**
 * Student insights — aggregates the real server-side progress signals
 * (lesson completions, exercise attempts, weak words, streak) into the
 * numbers the Home and Progreso pages show. One fetch, everything derived
 * client-side; no extra backend endpoints needed.
 */

import {
  getStudentProgress,
  listLessonCompletions,
  getWeakWords,
  type StudentProgress,
  type LessonCompletion,
  type WeakWord,
} from './progress'
import { getAllAttempts, PARTIAL_FLAG, type LastAttempt } from '@/lib/exercises-app/lastAttempts'

export interface WeekStats {
  /** ISO dates (YYYY-MM-DD) with at least one practice or completion, current week. */
  activeDays: string[]
  lessonsCompleted: number
  practices: number
  /** % de aciertos de los intentos puntuados de esta semana (null si no hay). */
  correctPct: number | null
  /** Lecciones completadas la semana pasada (para comparar suavemente). */
  lessonsPrevWeek: number
  /** Segundos invertidos esta semana (suma de lesson_completion de la semana). */
  timeSeconds: number
}

export interface StudentInsights {
  progress: StudentProgress | null
  completions: LessonCompletion[]
  /** Map section_key → last attempt (section_key = `${lessonId}-${sectionId}`). */
  attempts: Record<string, LastAttempt>
  weakWords: WeakWord[]
  week: WeekStats
  /** Nota media global sobre los intentos con puntuación (null si no hay). */
  avgPct: number | null
  /** Total de segundos invertidos (suma de todas las lecciones completadas). */
  timeSecondsTotal: number
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Monday 00:00 (local) of the week containing `now`. */
export function startOfWeek(now: Date): Date {
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Raw payload of GET /student/insights (todo en un viaje). */
interface ApiInsights {
  progress: StudentProgress
  completions: LessonCompletion[]
  attempts: Array<{
    section_key: string
    score: number
    total: number
    failed_labels: string[]
    date: string
  }>
  weak_words: WeakWord[]
}

/** Fetch everything from the combined endpoint; null → caller falls back. */
async function fetchCombined(
  accessToken: string
): Promise<[StudentProgress | null, LessonCompletion[], Record<string, LastAttempt>, WeakWord[]] | null> {
  try {
    const { getAPIUrl } = await import('@services/config/config')
    const { RequestBodyWithAuthHeader } = await import('@services/utils/ts/requests')
    const r = await fetch(
      `${getAPIUrl()}student/insights`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    const data = (await r.json()) as ApiInsights
    if (!data || !data.progress) return null
    const attempts: Record<string, LastAttempt> = {}
    for (const a of data.attempts || []) {
      if (!a?.section_key) continue
      const labels = Array.isArray(a.failed_labels) ? a.failed_labels : []
      attempts[a.section_key] = {
        score: a.score ?? 0,
        total: a.total ?? 0,
        failedLabels: labels.filter((l) => l !== PARTIAL_FLAG),
        date: a.date || '',
        partial: labels.includes(PARTIAL_FLAG),
      }
    }
    return [data.progress, data.completions || [], attempts, data.weak_words || []]
  } catch {
    return null
  }
}

/**
 * Cálculo puro de los insights (testeable sin red): recibe los datos crudos
 * del servidor y deriva la semana actual, la media global y el tiempo total.
 */
export function computeInsights(
  progress: StudentProgress | null,
  completions: LessonCompletion[],
  attempts: Record<string, LastAttempt>,
  weakWords: WeakWord[],
  now: Date = new Date()
): StudentInsights {
  const monday = startOfWeek(now)
  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)

  const activeDays = new Set<string>()
  let lessonsCompleted = 0
  let lessonsPrevWeek = 0
  let weekTime = 0
  let timeSecondsTotal = 0

  for (const c of completions) {
    timeSecondsTotal += c.time_seconds || 0
    const d = parseDate(c.completed_at)
    if (!d) continue
    if (d >= monday) {
      lessonsCompleted++
      weekTime += c.time_seconds || 0
      activeDays.add(isoDay(d))
    } else if (d >= prevMonday) {
      lessonsPrevWeek++
    }
  }

  let practices = 0
  let weekScore = 0
  let weekTotal = 0
  let allScore = 0
  let allTotal = 0
  for (const key of Object.keys(attempts)) {
    const a = attempts[key]
    // Una sección a medias cuenta como práctica del día (el alumno estuvo
    // trabajando), pero su marcador NO entra en las notas: sería una nota
    // sobre ejercicios que todavía no ha hecho.
    const scored = a.total > 0 && !a.partial
    if (scored) {
      allScore += a.score
      allTotal += a.total
    }
    const d = parseDate(a.date)
    if (!d || d < monday) continue
    practices++
    activeDays.add(isoDay(d))
    if (scored) {
      weekScore += a.score
      weekTotal += a.total
    }
  }

  // Los días de la RACHA también son días activos: si la racha es de N días y
  // la última visita fue el día X, los días [X-N+1 .. X] el alumno entró a la
  // app — aunque ese día no completara nada. Así la tira semanal refleja de
  // verdad "los días que entraste".
  const lastVisit = parseDate(progress?.last_visit_date)
  const streak = progress?.current_streak ?? 0
  if (lastVisit && streak > 0) {
    for (let i = 0; i < streak; i++) {
      const d = new Date(lastVisit)
      d.setDate(lastVisit.getDate() - i)
      if (d >= monday) activeDays.add(isoDay(d))
    }
  }

  return {
    progress,
    completions,
    attempts,
    weakWords,
    week: {
      activeDays: Array.from(activeDays).sort(),
      lessonsCompleted,
      practices,
      correctPct: weekTotal > 0 ? Math.round((weekScore / weekTotal) * 100) : null,
      lessonsPrevWeek,
      timeSeconds: weekTime,
    },
    avgPct: allTotal > 0 ? Math.round((allScore / allTotal) * 100) : null,
    timeSecondsTotal,
  }
}

/**
 * Las fechas en que el alumno terminó cada clase de sus cursos (una por clase),
 * sacadas del recorrido (`trail_step`), que el Inicio ya tiene en `runs`.
 *
 * Por qué hace falta (22/10/2026): «Esta semana» contaba las lecciones con
 * `lesson_completion`, que dentro de la formación NO se escribe nunca — cada
 * parte de una lección (Samenvatting, Flashcards, Lezen…) es su propia clase del
 * curso y el visor solo apunta la lección entera si se hacen todas sin salir.
 * Así que a quien había estudiado toda la semana le salía «0 lecciones
 * terminadas». Lo que sí se apunta, clase a clase y con fecha, es esto.
 *
 * La fecha la escribe el servidor con `datetime.now()` en UTC y sin zona
 * ("2026-10-03 14:22:11.123456"): se lee como UTC para que una clase hecha a
 * las 00:30 del lunes en Países Bajos no caiga en la semana anterior.
 */
export function fechasDeClases(runs: any[] | null | undefined): Date[] {
  const primera = new Map<string, Date>()
  for (const run of runs ?? []) {
    for (const step of run?.steps ?? []) {
      if (step?.complete !== true || step?.activity_id == null) continue
      const crudo = String(step.creation_date || '').trim().replace(' ', 'T').slice(0, 19)
      if (!crudo) continue
      const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(crudo) ? crudo : `${crudo}Z`)
      if (isNaN(d.getTime())) continue
      const clave = `${run?.course_id ?? ''}:${step.activity_id}`
      const antes = primera.get(clave)
      if (!antes || d < antes) primera.set(clave, d)
    }
  }
  return Array.from(primera.values())
}

/**
 * «Esta semana» contada por las clases terminadas del curso. Las clases son lo
 * que el alumno ve como «lecciones» en la formación (el buscador del curso dice
 * «Buscar lección»), así que la tarjeta sigue diciendo «lecciones terminadas».
 * Sin ninguna clase hecha nunca (alguien que solo usa la app de repaso), se
 * queda la cuenta de antes.
 */
export function semanaConClases(week: WeekStats, clases: Date[], now: Date = new Date()): WeekStats {
  if (!clases.length) return week
  const monday = startOfWeek(now)
  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const dias = new Set(week.activeDays)
  let estaSemana = 0
  let semanaPasada = 0
  for (const d of clases) {
    if (d >= monday) {
      estaSemana++
      dias.add(isoDay(d))
    } else if (d >= prevMonday) {
      semanaPasada++
    }
  }
  return {
    ...week,
    activeDays: Array.from(dias).sort(),
    lessonsCompleted: estaSemana,
    lessonsPrevWeek: semanaPasada,
  }
}

export async function getStudentInsights(
  accessToken: string | undefined
): Promise<StudentInsights> {
  // Un solo viaje al servidor; si el endpoint combinado aún no está desplegado
  // (deploy en curso), caemos a las cuatro llamadas clásicas en paralelo.
  const combined = accessToken ? await fetchCombined(accessToken) : null
  const [progress, completions, attempts, weakWords] =
    combined ??
    (await Promise.all([
      getStudentProgress(accessToken),
      listLessonCompletions(accessToken),
      getAllAttempts(accessToken),
      getWeakWords(accessToken, 12),
    ]))
  return computeInsights(progress, completions, attempts, weakWords)
}

/** "1 h 20 min" / "35 min" / "—" */
export function formatTime(seconds: number): string {
  if (!seconds || seconds < 60) return seconds > 0 ? '1 min' : '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}
