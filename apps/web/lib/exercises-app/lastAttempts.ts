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

interface ApiAttemptWithKey extends ApiAttempt {
  section_key: string
}

/**
 * Fetch every saved attempt for the current student and return a map keyed by
 * section_key. Used by the lesson list to render per-section completion dots
 * without making one request per lesson.
 */
export async function getAllAttempts(
  accessToken: string | undefined
): Promise<Record<string, LastAttempt>> {
  if (!accessToken) return {}
  try {
    const result = await fetch(
      `${getAPIUrl()}exercise-attempts/all`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!result.ok) return {}
    const data: ApiAttemptWithKey[] = await result.json()
    if (!Array.isArray(data)) return {}
    const out: Record<string, LastAttempt> = {}
    for (const row of data) {
      const local = toLocal(row)
      if (row?.section_key && local) {
        out[row.section_key] = local
      }
    }
    return out
  } catch {
    return {}
  }
}

/** Listeners que quieren enterarse de cada guardado (p. ej. invalidar la
 *  caché de insights para que "Mi progreso" muestre siempre la última nota). */
type AttemptSavedListener = () => void
const attemptListeners = new Set<AttemptSavedListener>()
export function onAttemptSaved(fn: AttemptSavedListener): () => void {
  attemptListeners.add(fn)
  return () => attemptListeners.delete(fn)
}
function notifyAttemptSaved() {
  attemptListeners.forEach((fn) => {
    try { fn() } catch { /* listener errors never break saving */ }
  })
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
    notifyAttemptSaved()
  } catch {
    /* swallow network errors — the UI is best-effort here */
  }
}
