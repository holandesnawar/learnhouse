'use client'
// Native access to the Nawar exercises content stored in Supabase, via its
// REST API (no extra dependency). The Supabase URL/anon key come from the
// runtime config (getConfig), since NEXT_PUBLIC_* vars are injected at runtime
// in this deployment, not inlined at build time. Per-student progress is saved
// in a `student_progress` table keyed by the LearnHouse user uuid.
import { getConfig } from '@services/config/config'

const supaUrl = () => getConfig('NEXT_PUBLIC_SUPABASE_URL', '')
const supaKey = () => getConfig('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

export function isExercisesEnabled(): boolean {
  return Boolean(supaUrl() && supaKey())
}

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
  module_id?: string
  title: string
}

// Real Supabase columns: word_nl, translation_es, article, audio_url, sort_order
export interface ExVocab {
  id: string
  lesson_id: string
  sort_order?: number
  word_nl: string
  translation_es: string
  article?: string | null
  audio_url?: string | null
}

export interface ItemProgress {
  item_id: string
  correct: boolean
  attempts: number
}

async function rest(path: string, init?: RequestInit) {
  const SUPABASE_URL = supaUrl()
  const SUPABASE_ANON = supaKey()
  if (!SUPABASE_URL || !SUPABASE_ANON) return null
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

// vocabulary_items is the table the app actually reads (modules/lessons may be
// local-only / not anon-readable). Pull all vocab, group by lesson, and use the
// lesson with the most words (a "full" lesson). Look up its title best-effort.
export async function getFirstVocabLesson(): Promise<{ lesson: ExLesson; vocab: ExVocab[] } | null> {
  const all: ExVocab[] = (await rest(`vocabulary_items?select=*&limit=3000`)) || []
  if (all.length === 0) return null
  const byLesson: Record<string, ExVocab[]> = {}
  for (const v of all) {
    if (!v?.lesson_id) continue
    ;(byLesson[v.lesson_id] ||= []).push(v)
  }
  const lessonId = Object.keys(byLesson).sort((a, b) => byLesson[b].length - byLesson[a].length)[0]
  if (!lessonId) return null
  const vocab = byLesson[lessonId].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  let lesson: ExLesson = { id: lessonId, title: 'Vocabulario' }
  try {
    const rows: any[] = (await rest(`lessons?id=eq.${encodeURIComponent(lessonId)}&select=*`)) || []
    if (rows[0]) {
      lesson = { id: lessonId, module_id: rows[0].module_id, title: rows[0].title_nl || rows[0].title_es || 'Vocabulario' }
    }
  } catch {
    // lessons table not readable — keep the default title
  }
  return { lesson, vocab }
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
  if (!userUuid || !isExercisesEnabled()) return empty
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

