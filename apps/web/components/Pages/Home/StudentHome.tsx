'use client'
import React, { useEffect, useState } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import TrailCourseCard from '@components/Pages/Trail/TrailCourseCard'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { useCourses } from '@/hooks/queries/useCourses'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import RoadmapSection from '@components/Pages/Home/RoadmapSection'
import ExerciseProgressCard from '@components/Pages/Home/ExerciseProgressCard'
import UpcomingEvents from '@components/Pages/Home/UpcomingEvents'
import { getUriWithOrg } from '@services/config/config'
import CommunityChannelsCards from '@components/Objects/Communities/CommunityChannelsCards'
import StreakBadge from '@components/Pages/Home/StreakBadge'
import ContinueWhereLeftOff from '@components/Pages/Home/ContinueWhereLeftOff'
import ProgressSummary from '@components/Pages/Home/ProgressSummary'
import { registerVisit, type StudentVisit } from '@services/student/progress'
import Link from 'next/link'
import { BookOpen, HelpCircle, ArrowRight } from 'lucide-react'

export default function StudentHome({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const { data: courses } = useCourses(orgslug)
  const { data: trailData } = useTrail(org?.id)
  const { isAdmin } = useAdminStatus() as any

  const firstName: string =
    session?.data?.user?.first_name || session?.data?.user?.username || ''

  // La "Clase semanal" (directos) no es un curso de la formación: se ve en su
  // propia sección del menú, no en "Tus cursos" ni en "Continúa donde lo dejaste".
  const HIDDEN_COURSE_UUID = 'bfbcb42b-7dc3-4448-9df8-5d7b96135859'
  const isHidden = (uuid: any) => String(uuid || '').includes(HIDDEN_COURSE_UUID)
  const runs: any[] = (Array.isArray(trailData?.runs) ? trailData.runs : []).filter(
    (r: any) => !isHidden(r?.course?.course_uuid)
  )
  const courseList: any[] = (Array.isArray(courses) ? courses : []).filter(
    (c: any) => !isHidden(c?.course_uuid)
  )

  // Register today's visit so the streak counter advances. Idempotent within
  // the same day, fire-and-forget — never blocks the page.
  const [visit, setVisit] = useState<StudentVisit | null>(null)
  useEffect(() => {
    if (!accessToken) return
    let active = true
    registerVisit(accessToken).then((v) => {
      if (active) setVisit(v)
    })
    return () => { active = false }
  }, [accessToken])

  return (
    <GeneralWrapperStyled>
      {/* Welcome */}
      <div className="pt-2 pb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Hola{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-gray-500 dark:text-white/70 mt-1">Continúa tu aprendizaje donde lo dejaste.</p>
        </div>
        {visit && (
          <div className="pt-1 shrink-0">
            <StreakBadge current={visit.current_streak} longest={visit.longest_streak} />
          </div>
        )}
      </div>

      {/* Bloque de progreso "Así estás progresando" */}
      <ProgressSummary orgslug={orgslug} />

      {/* Onboarding del alumno → ahora es un widget flotante "Primeros pasos"
          (StudentOnboarding), montado en el layout. Ya no ocupa el Inicio. */}

      {/* "Sigue donde lo dejaste" — only shows when there's a saved position */}
      <ContinueWhereLeftOff orgslug={orgslug} />

      {/* Continue / in-progress */}
      {runs.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Continúa donde lo dejaste</h2>
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

      {/* Courses — only shown to learners who haven't started yet, so they
          can begin. Once a course is in progress, "Continúa donde lo dejaste"
          covers it and we don't repeat the (currently single) course list. */}
      {runs.length === 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
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
      )}

      {/* Community channels — quick access to the chats */}
      <CommunityChannelsCards orgslug={orgslug} />

      {/* Upcoming events */}
      <UpcomingEvents orgslug={orgslug} />

      {/* Weekly roadmap */}
      <RoadmapSection canEdit={!!isAdmin} />

      {/* Weekly exercise progress */}
      <ExerciseProgressCard orgslug={orgslug} />

      {/* Consultas — moved to the bottom (a quiet helper, not the headline) */}
      <div
        className="mt-2 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 text-white overflow-hidden"
        style={{
          backgroundColor: '#1D0084',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
            'radial-gradient(circle 420px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
            'radial-gradient(circle 360px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
          backgroundSize: '28px 28px, auto, auto',
          backgroundRepeat: 'repeat, no-repeat, no-repeat',
        }}
      >
        <div className="shrink-0 flex items-center justify-center">
          <HelpCircle size={30} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold">¿Tienes dudas?</h2>
          <p className="text-sm text-white/70">Crea tu consulta y te ayudamos a resolverla.</p>
        </div>
        <Link
          href={getUriWithOrg(orgslug, '/consultas')}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] font-bold text-sm transition-colors"
        >
          Ir a Consultas <ArrowRight size={16} />
        </Link>
      </div>
    </GeneralWrapperStyled>
  )
}
