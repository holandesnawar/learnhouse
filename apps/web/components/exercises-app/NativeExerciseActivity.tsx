'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  getModuleAsync,
  getLessonAsync,
  getNextLesson,
} from '@/lib/exercises-app/courseService'
import { getExerciseForVideoIndex } from '@/lib/exercises-app/exerciseMapping'
import type { Lesson, CourseModule } from '@/lib/exercises-app/types'
import LessonViewer from './LessonViewer'

// Renders a native Nawar exercise (LessonViewer) inside a LearnHouse course
// activity. Two ways to target the exercise:
//   - explicit: moduleId + lessonId (manual Embed activity, embed_url "nawar:m/l")
//   - automatic: videoIndex (the course video's position → Nth exercise lesson)
// Content is loaded client-side from Supabase (anon) with a local courseData fallback.
export default function NativeExerciseActivity({
  moduleId,
  lessonId,
  videoIndex,
  orgslug,
}: {
  moduleId?: string
  lessonId?: string
  videoIndex?: number
  orgslug: string
}) {
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState<CourseModule | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null)

  // Resolve the target ids: explicit props win, otherwise map from the video index.
  const auto = !(moduleId && lessonId)
  const target =
    moduleId && lessonId
      ? { moduleId, lessonId }
      : videoIndex != null
        ? getExerciseForVideoIndex(videoIndex)
        : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!target) {
        setLoading(false)
        return
      }
      setLoading(true)
      const [m, l] = await Promise.all([
        getModuleAsync(target.moduleId),
        getLessonAsync(target.moduleId, target.lessonId),
      ])
      if (cancelled) return
      setModule(m ?? null)
      setLesson(l ?? null)
      setNextLesson(getNextLesson(target.moduleId, target.lessonId) ?? null)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [target?.moduleId, target?.lessonId])

  // Automatic mode with no matching lesson → render nothing (e.g. a video that
  // sits beyond the last exercise). Manual mode shows a clear hint instead.
  if (!target) {
    if (auto) return null
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500">No se encontró el ejercicio configurado.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!module || !lesson) {
    if (auto) return null
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500">
          No se encontró el ejercicio (módulo «{target.moduleId}», lección «{target.lessonId}»).
        </p>
      </div>
    )
  }

  return (
    <LessonViewer
      lesson={lesson}
      module={module}
      nextLesson={nextLesson}
      orgslug={orgslug}
      inCourse
    />
  )
}
