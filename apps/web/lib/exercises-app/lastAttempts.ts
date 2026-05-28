/**
 * Per-user memory of the most recent attempt at an exercise practice. Backed
 * by the API (so it follows the student across devices) — falls back to
 * silent no-op when the user is not signed in.
 */

import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface LastAttempt {
  score: number
  total: number
  failedLabels: string[]
  date: string
}

interface ApiAttempt {
  score: number
  total: number
  failed_labels: string[]
  date: string
}

function toLocal(a: ApiAttempt | null | undefined): LastAttempt | null {
  if (!a || typeof a.score !== 'number' || typeof a.total !== 'number') {
    return null
  }
  return {
    score: a.score,
    total: a.total,
    failedLabels: Array.isArray(a.failed_labels) ? a.failed_labels : [],
    date: a.date || '',
  }
}

export async function getLastAttempt(
  sectionKey: string,
  accessToken: string | undefined
): Promise<LastAttempt | null> {
  if (!accessToken) return null
  try {
    const result = await fetch(
      `${getAPIUrl()}exercise-attempts/${encodeURIComponent(sectionKey)}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!result.ok) return null
    const data: ApiAttempt | null = await result.json()
    return toLocal(data)
  } catch {
    return null
  }
}

export async function saveLastAttempt(
  sectionKey: string,
  attempt: Omit<LastAttempt, 'date'>,
  accessToken: string | undefined
): Promise<void> {
  if (!accessToken) return
  try {
    await fetch(
      `${getAPIUrl()}exercise-attempts/${encodeURIComponent(sectionKey)}`,
      RequestBodyWithAuthHeader(
        'PUT',
        {
          score: attempt.score,
          total: attempt.total,
          failed_labels: attempt.failedLabels,
        },
        null,
        accessToken
      )
    )
  } catch {
    /* swallow network errors — the UI is best-effort here */
  }
}
