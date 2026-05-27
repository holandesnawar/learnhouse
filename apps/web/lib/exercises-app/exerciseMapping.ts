import { MODULES, LESSONS } from './courseData'

// Ordered, non-extra lessons flattened across modules (module order, then
// lesson order). Used to map a course video's position to its matching exercise
// when exercises are wired automatically (video N → Nth lesson, "1 a 1 por orden").
function orderedLessons(): { moduleId: string; lessonId: string }[] {
  const mods = MODULES.slice().sort((a, b) => a.order - b.order)
  const result: { moduleId: string; lessonId: string }[] = []
  for (const m of mods) {
    const lessons = LESSONS.filter((l) => l.moduleId === m.id && !l.isExtra).sort(
      (a, b) => a.order - b.order
    )
    for (const l of lessons) result.push({ moduleId: m.id, lessonId: l.id })
  }
  return result
}

export function getExerciseForVideoIndex(
  index: number
): { moduleId: string; lessonId: string } | null {
  if (index == null || index < 0) return null
  return orderedLessons()[index] ?? null
}
