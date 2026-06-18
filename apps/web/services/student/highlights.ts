/**
 * Per-student lesson highlights / notes.
 * Thin wrapper around /api/v1/student/highlights* — every call is authenticated.
 */

import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export type HighlightColor = 'yellow' | 'pink' | 'blue' | 'green'

export interface LessonHighlight {
  id: number
  activity_uuid: string
  activity_name: string
  course_uuid: string
  color: HighlightColor
  quote: string
  note: string
  pm_from: number
  pm_to: number
  created_at: string
  updated_at: string
}

export interface CreateHighlightInput {
  activity_uuid: string
  activity_name?: string
  course_uuid?: string
  color: HighlightColor
  quote: string
  note?: string
  pm_from: number
  pm_to: number
}

async function ok<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback
  try {
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

export async function listHighlightsForActivity(
  activityUuid: string,
  accessToken: string | undefined
): Promise<LessonHighlight[]> {
  if (!accessToken || !activityUuid) return []
  try {
    const r = await fetch(
      `${getAPIUrl()}student/highlights?activity_uuid=${encodeURIComponent(activityUuid)}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    return ok<LessonHighlight[]>(r, [])
  } catch {
    return []
  }
}

export async function listAllHighlights(
  accessToken: string | undefined
): Promise<LessonHighlight[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${getAPIUrl()}student/highlights/all`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    return ok<LessonHighlight[]>(r, [])
  } catch {
    return []
  }
}

export async function createHighlight(
  input: CreateHighlightInput,
  accessToken: string | undefined
): Promise<LessonHighlight | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/highlights`,
      RequestBodyWithAuthHeader('POST', input, null, accessToken)
    )
    return ok<LessonHighlight | null>(r, null)
  } catch {
    return null
  }
}

export async function updateHighlight(
  id: number,
  patch: { color?: HighlightColor; note?: string },
  accessToken: string | undefined
): Promise<LessonHighlight | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}student/highlights/${id}`,
      RequestBodyWithAuthHeader('PUT', patch, null, accessToken)
    )
    return ok<LessonHighlight | null>(r, null)
  } catch {
    return null
  }
}

export async function deleteHighlight(
  id: number,
  accessToken: string | undefined
): Promise<boolean> {
  if (!accessToken) return false
  try {
    const r = await fetch(
      `${getAPIUrl()}student/highlights/${id}`,
      RequestBodyWithAuthHeader('DELETE', null, null, accessToken)
    )
    return r.ok
  } catch {
    return false
  }
}

export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; label: string }> = {
  yellow: { bg: '#FEF3C7', label: 'Amarillo' },
  pink: { bg: '#FBD5E0', label: 'Rosa' },
  blue: { bg: '#D6E4FF', label: 'Azul' },
  green: { bg: '#D5F0DD', label: 'Verde' },
}
