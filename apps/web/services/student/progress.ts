/**
 * Per-student progress + streak + lesson completions + weak words.
 * Thin wrapper around /api/v1/student/* — every call is authenticated.
 */

import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface StudentProgress {
  last_visit_date: string
  current_streak: number
  longest_streak: number
  current_position: Record<string, any>
  onboarding_state: Record<string, any>
  theme: 'light' | 'dark' | 'system'
  time_seconds_total: number
}

export interface StudentVisit {
  last_visit_date: string
  current_streak: number
  longest_streak: number
}

export interface LessonCompletion {
  lesson_id: string
  module_id: string
  completed_at: string
  time_seconds: number
}

export interface WeakWord {
  label: string
  fails: number
}

export interface StudentProgressPatch {
  current_position?: Record<string, any>
  onboarding_state?: Record<string, any>
  theme?: 'light' | 'dark' | 'system'
  time_seconds_total?: number
}

async function ok<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback
  try {
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

export async function getStudentProgress(
  accessToken: string | undefined
): Promise<StudentProgress | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/me`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    return ok<StudentProgress | null>(r, null)
  } catch {
    return null
  }
}

export async function patchStudentProgress(
  data: StudentProgressPatch,
  accessToken: string | undefined
): Promise<StudentProgress | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/me`,
      RequestBodyWithAuthHeader('PUT', data, null, accessToken)
    )
    return ok<StudentProgress | null>(r, null)
  } catch {
    return null
  }
}

/** Ping the API so it bumps last_visit_date + recomputes streak. Safe to call
 *  on every Home mount; the server is idempotent within the same day. */
export async function registerVisit(
  accessToken: string | undefined
): Promise<StudentVisit | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/visit`,
      RequestBodyWithAuthHeader('POST', {}, null, accessToken)
    )
    return ok<StudentVisit | null>(r, null)
  } catch {
    return null
  }
}

export async function listLessonCompletions(
  accessToken: string | undefined
): Promise<LessonCompletion[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${getAPIUrl()}student/lesson-completions`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    return ok<LessonCompletion[]>(r, [])
  } catch {
    return []
  }
}

export async function markLessonCompletedRemote(
  lessonId: string,
  payload: { module_id?: string; time_seconds?: number },
  accessToken: string | undefined
): Promise<LessonCompletion | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/lesson-completions/${encodeURIComponent(lessonId)}`,
      RequestBodyWithAuthHeader('PUT', payload, null, accessToken)
    )
    return ok<LessonCompletion | null>(r, null)
  } catch {
    return null
  }
}

export async function getWeakWords(
  accessToken: string | undefined,
  limit = 20
): Promise<WeakWord[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${getAPIUrl()}student/weak-words?limit=${limit}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    return ok<WeakWord[]>(r, [])
  } catch {
    return []
  }
}
