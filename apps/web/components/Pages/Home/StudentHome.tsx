'use client'
import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import TrailCourseCard from '@components/Pages/Trail/TrailCourseCard'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { useCourses } from '@/hooks/queries/useCourses'
import { BookOpen } from 'lucide-react'

export default function StudentHome({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { data: courses } = useCourses(orgslug)
  const { data: trailData } = useTrail(org?.id)

  const firstName: string =
    session?.data?.user?.first_name || session?.data?.user?.username || ''

  const runs: any[] = Array.isArray(trailData?.runs) ? trailData.runs : []
  const courseList: any[] = Array.isArray(courses) ? courses : []

  return (
    <GeneralWrapperStyled>
      {/* Welcome */}
      <div className="pt-2 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Hola{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-gray-500 mt-1">Continúa tu aprendizaje donde lo dejaste.</p>
      </div>

      {/* Continue / in-progress */}
      {runs.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Continúa donde lo dejaste</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run: any) => (
              <TrailCourseCard
                key={run.course.course_uuid}
                run={run}
                course={run.course}
                orgslug={orgslug}
              />
            ))}
          </div>
        </div>
      )}

      {/* All courses */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {runs.length > 0 ? 'Todos los cursos' : 'Tus cursos'}
        </h2>
        {courseList.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
            <div className="p-4 bg-white rounded-full nice-shadow mb-4">
              <BookOpen className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-md text-gray-400 text-center max-w-xs">
              Aún no hay cursos disponibles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {courseList.map((course: any) => (
              <div key={course.course_uuid} className="flex flex-col">
                <CourseThumbnail course={course} orgslug={orgslug} />
              </div>
            ))}
          </div>
        )}
      </div>
    </GeneralWrapperStyled>
  )
}
