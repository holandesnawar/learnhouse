import { notFound } from 'next/navigation'
import {
  getPreviousLesson,
  getNextLesson,
  getModuleAsync,
  getLessonAsync,
} from '@/lib/exercises-app/courseService'
import LessonViewer from '@components/exercises-app/LessonViewer'

// On-demand rendering: content comes from Supabase at runtime (with a local
// fallback baked in courseData.ts). No build-time prerender of Supabase data —
// supabase is null during the build so the local fallback is used.
export const dynamic = 'force-dynamic'

export default async function LessonPage({
  params,
}: {
  params: Promise<{ orgslug: string; moduleId: string; lessonId: string }>
}) {
  const { orgslug, moduleId, lessonId } = await params

  const [module, lesson] = await Promise.all([
    getModuleAsync(moduleId),
    getLessonAsync(moduleId, lessonId),
  ])
  if (!module) notFound()
  if (!lesson) notFound()

  const prevLesson = getPreviousLesson(moduleId, lessonId)
  const nextLesson = getNextLesson(moduleId, lessonId)

  return (
    <main className="min-h-screen">
      <LessonViewer
        lesson={lesson}
        module={module}
        prevLesson={prevLesson}
        nextLesson={nextLesson}
        orgslug={orgslug}
      />
    </main>
  )
}
