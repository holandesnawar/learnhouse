/**
 * Tiny local-storage memory of the most recent attempt at an exercise practice
 * (Vocabulario, Luisteren, etc.) so the student can see "last time you got X
 * and failed on Y" and re-practice just the failed items.
 */

export interface LastAttempt {
  score: number
  total: number
  failedLabels: string[]
  date: string
}

const PREFIX = 'nawar-last-attempt-'

const isClient = () => typeof window !== 'undefined' && !!window.localStorage

export function saveLastAttempt(sectionKey: string, attempt: LastAttempt): void {
  if (!isClient()) return
  try {
    localStorage.setItem(PREFIX + sectionKey, JSON.stringify(attempt))
  } catch {
    /* ignore storage errors */
  }
}

export function getLastAttempt(sectionKey: string): LastAttempt | null {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(PREFIX + sectionKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed?.score !== 'number' ||
      typeof parsed?.total !== 'number' ||
      !Array.isArray(parsed?.failedLabels)
    ) {
      return null
    }
    return parsed as LastAttempt
  } catch {
    return null
  }
}

export function clearLastAttempt(sectionKey: string): void {
  if (!isClient()) return
  try {
    localStorage.removeItem(PREFIX + sectionKey)
  } catch {
    /* ignore */
  }
}
