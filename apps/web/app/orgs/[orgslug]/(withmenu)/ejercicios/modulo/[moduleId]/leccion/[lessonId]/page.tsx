'use client'
// Página 100% cliente: el contenido del curso vive en courseData.ts y ya viaja
// en el bundle del navegador. Antes era `force-dynamic` en el servidor — cada
// clic desde "Mi progreso" o la lista de lecciones costaba un viaje completo a
// Railway + serializar la lección entera. Ahora la navegación es instantánea.

import { notFound, useParams } from 'next/navigation'
import {
  getPreviousLesson,
  getNextLesson,
  getModule,
  getLesson,
} from '@/lib/exercises-app/courseService'
import LessonViewer from '@components/exercises-app/LessonViewer'

export default function LessonPage() {
  const params = useParams() as { orgslug: string; moduleId: string; lessonId: string }
  const { orgslug, moduleId, lessonId } = params

  const module = getModule(moduleId)
  const lesson = getLesson(moduleId, lessonId)
  if (!module || !lesson) notFound()

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
