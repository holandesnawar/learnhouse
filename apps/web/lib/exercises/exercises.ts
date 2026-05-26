'use client'
// Native access to the Nawar exercises content stored in Supabase, via its
// REST API (no extra dependency). Reads NEXT_PUBLIC_SUPABASE_URL/ANON_KEY,
// set in Railway. Per-student progress is saved in a `student_progress`
// table keyed by the LearnHouse user uuid.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const exercisesEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON)

export interface ExModule {
  id: string
  title: string
  subtitle?: string
  description?: string
  sort_order?: number
  emoji?: string
  level?: string
  color?: string
}

export interface ExLesson {
  id: string
  module_id: string
  title: string
  subtitle?: string
  sort_order?: number
}

export interface ExVocab {
  id: string
  lesson_id: string
  sort_order?: number
  dutch: string
  spanish: string
  article?: string | null
  emoji?: string | null
  audio_url?: string | null
  example_nl?: string | null
  example_es?: string | null
}

export interface ItemProgress {
  item_id: string
  correct: boolean
  attempts: number
}

async function rest(path: string, init?: RequestInit) {
  if (!exercisesEnabled) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function getModules(): Promise<ExModule[]> {
  return (await rest(`modules?order=sort_order.asc`)) || []
}

export async function getLessons(moduleId: string): Promise<ExLesson[]> {
  return (await rest(`lessons?module_id=eq.${encodeURIComponent(moduleId)}&order=sort_order.asc`)) || []
}

export async function getVocabulary(lessonId: string): Promise<ExVocab[]> {
  return (await rest(`vocabulary_items?lesson_id=eq.${encodeURIComponent(lessonId)}&order=sort_order.asc`)) || []
}

export async function getLessonProgress(userUuid: string, lessonId: string): Promise<ItemProgress[]> {
  if (!userUuid) return []
  const rows = await rest(
    `student_progress?user_uuid=eq.${encodeURIComponent(userUuid)}&lesson_id=eq.${encodeURIComponent(lessonId)}&select=item_id,correct,attempts`
  )
  return rows || []
}

export async function saveItemResult(
  userUuid: string,
  lessonId: string,
  itemId: string,
  correct: boolean,
  itemType: string = 'vocab'
): Promise<void> {
  if (!userUuid) return
  await rest(`student_progress?on_conflict=user_uuid,lesson_id,item_id,item_type`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_uuid: userUuid,
      lesson_id: lessonId,
      item_id: itemId,
      item_type: itemType,
      correct,
      updated_at: new Date().toISOString(),
    }),
  })
}

export interface WeekProgress {
  practiced: number
  correct: number
  toReview: number
}

// Progress made since the start of the current week (Monday).
export async function getWeekProgress(userUuid: string): Promise<WeekProgress> {
  const empty = { practiced: 0, correct: 0, toReview: 0 }
  if (!userUuid || !exercisesEnabled) return empty
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  try {
    const rows: { correct: boolean }[] =
      (await rest(
        `student_progress?user_uuid=eq.${encodeURIComponent(userUuid)}&updated_at=gte.${monday.toISOString()}&select=correct`
      )) || []
    const correct = rows.filter((r) => r.correct).length
    return { practiced: rows.length, correct, toReview: rows.length - correct }
  } catch {
    return empty
  }
}

