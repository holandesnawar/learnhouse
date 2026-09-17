'use client'
import React from 'react'
import { CalendarClock, Users } from 'lucide-react'
import { useCourse } from '@components/Contexts/CourseContext'
import DripContentSettings from '@components/Pages/Courses/DripContentSettings'
import AccesoProfesSettings from '@components/Pages/Courses/AccesoProfesSettings'
import { useOrg } from '@components/Contexts/OrgContext'

/**
 * Pestaña "Goteo" del panel de admin del curso.
 *
 * El panel de goteo vivía SOLO colgado de la página pública del curso (visible
 * al admin entre el contenido del alumno), que es un sitio raro para
 * configurar el curso. Aquí se reutiliza tal cual, en su sitio: junto al resto
 * de ajustes del curso.
 */
export default function EditCourseDrip() {
  const course = useCourse() as any
  const org = useOrg() as any
  const courseStructure = course?.courseStructure

  return (
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-9">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2.5 mb-1.5">
          <CalendarClock size={20} className="text-[#025dc7]" />
          <h1 className="text-xl font-bold text-gray-900">Goteo de contenido</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Decide cuántos días después de matricularse se le abre cada módulo a
          cada alumno. El contador es individual: empieza el día que entra, no
          en una fecha fija del calendario. Déjalo en 0 para que un módulo esté
          disponible desde el primer día.
        </p>

        {courseStructure ? (
          <DripContentSettings course={courseStructure} defaultOpen />
        ) : (
          <div className="h-32 rounded-2xl bg-white border border-[#DDE6F5] animate-pulse" />
        )}

        {/* Va aquí y no en una pantalla aparte porque es la otra mitad de la
            misma decisión: el goteo dice CUÁNDO se abre cada módulo, y esto
            dice a quién se le aplica. Separarlas obliga a acordarse de las dos. */}
        <div className="flex items-center gap-2.5 mt-10 mb-1.5">
          <Users size={20} className="text-[#025dc7]" />
          <h2 className="text-xl font-bold text-gray-900">Qué ven los profes</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          El goteo de arriba decide cuándo se abre cada módulo. Esto decide si a los
          profes se les aplica igual que a los alumnos.
        </p>
        <AccesoProfesSettings orgId={org?.id} />
      </div>
    </div>
  )
}
