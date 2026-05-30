'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  getModuleAsync,
  getLessonAsync,
  getNextLesson,
} from '@/lib/exercises-app/courseService'
import type { Lesson, CourseModule } from '@/lib/exercises-app/types'
import LessonViewer from './LessonViewer'

// Renders a native Nawar exercise (LessonViewer) inside a LearnHouse course
// activity. The activity stores its target as embed_url:
//   "nawar:<moduleId>/<lessonId>"            → whole lesson (lands on vocabulary)
//   "nawar:<moduleId>/<lessonId>/<section>"  → only that part (woordenschat, lezen, …)
// Content is loaded client-side from Supabase (anon) with a local courseData fallback.
export default function NativeExerciseActivity({
  moduleId,
  lessonId,
  section,
  orgslug,
  onComplete,
}: {
  moduleId: string
  lessonId: string
  section?: string
  orgslug: string
  onComplete?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState<CourseModule | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [m, l] = await Promise.all([
        getModuleAsync(moduleId),
        getLessonAsync(moduleId, lessonId),
      ])
      if (cancelled) return
      setModule(m ?? null)
      setLesson(l ?? null)
      setNextLesson(getNextLesson(moduleId, lessonId) ?? null)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [moduleId, lessonId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!module || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500">
          No se encontró el ejercicio (módulo «{moduleId}», lección «{lessonId}»).
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
      forcedSection={section}
      onComplete={onComplete}
    />
  )
}
