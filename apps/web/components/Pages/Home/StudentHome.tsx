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
import UpcomingEvents from '@components/Pages/Home/UpcomingEvents'
import { getUriWithOrg } from '@services/config/config'
import CommunityChannelsCards from '@components/Objects/Communities/CommunityChannelsCards'
import StreakBadge from '@components/Pages/Home/StreakBadge'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { registerVisit, type StudentVisit } from '@services/student/progress'
import { useStudentInsights } from '@/hooks/queries/useStudentInsights'
import { isWeeklyClassCourse } from '@/lib/course/formacionProgress'
import SafeArea from '@components/Objects/StyledElements/Error/SafeArea'
import StudentOnboarding from '@components/Pages/Home/StudentOnboarding'

// Las tarjetas que dependen del temario (courseData, ~350KB de fuente) se
// cargan en un chunk aparte: el Inicio pinta antes y el temario llega detrás.
const WeekStrip = dynamic(() => import('@components/Pages/Home/StudentPulse').then((m) => m.WeekStrip), { ssr: false })
const ContinueCard = dynamic(() => import('@components/Pages/Home/StudentPulse').then((m) => m.ContinueCard), { ssr: false })
const WeekCard = dynamic(() => import('@components/Pages/Home/StudentPulse').then((m) => m.WeekCard), { ssr: false })
const RepasoCard = dynamic(() => import('@components/Pages/Home/StudentPulse').then((m) => m.RepasoCard), { ssr: false })
const FormacionCard = dynamic(() => import('@components/Pages/Home/StudentPulse').then((m) => m.FormacionCard), { ssr: false })
import Link from 'next/link'
import { BookOpen, HelpCircle, ArrowRight } from 'lucide-react'

/** Hueco gris del tamaño final de una tarjeta: evita que la página salte. */
function HomeSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[#DDE6F5] dark:border-white/10 bg-white/60 dark:bg-white/5 animate-pulse ${className}`}
    />
  )
}

export default function StudentHome({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const { data: courses } = useCourses(orgslug)
  const { data: trailData } = useTrail(org?.id)
  // OJO con `isLoading` de react-query: es falso mientras la consulta está
  // deshabilitada y también en el primer render (la petición arranca en un
  // efecto, después de pintar). Por eso, aunque ya lo guardábamos, seguía
  // colándose un fotograma con la vista ANTIGUA de cursos al recargar.
  // La regla buena es más simple: mientras no haya datos, esqueleto.
  const trailReady = trailData !== undefined
  const coursesReady = courses !== undefined
  const { isAdmin } = useAdminStatus() as any

  const firstName: string =
    session?.data?.user?.first_name || session?.data?.user?.username || ''

  // La "Clase semanal" (directos) no es un curso de la formación: se ve en su
  // propia sección del menú, no en "Tus cursos" ni en "Continúa donde lo dejaste".
  const isHidden = isWeeklyClassCourse
  const runs: any[] = (Array.isArray(trailData?.runs) ? trailData.runs : []).filter(
    (r: any) => !isHidden(r?.course?.course_uuid)
  )
  const courseList: any[] = (Array.isArray(courses) ? courses : []).filter(
    (c: any) => !isHidden(c?.course_uuid)
  )

  // Cuál de los cursos es LA formación, para poder llevar al alumno nuevo
  // directo a ella en vez de ponerle a elegir.
  //
  // Normalmente `courseList` ya trae solo la formación, porque las clases
  // semanales se filtran por su identificador. Pero ese identificador está
  // escrito a mano, así que si algún día no cuadra se cuela un curso de más;
  // por eso hay un segundo filtro por el nombre y, si aun así queda ambiguo,
  // se vuelve a la rejilla de siempre en vez de adivinar.
  const formacion: any =
    courseList.length === 1
      ? courseList[0]
      : courseList.find((c: any) => !/(clase|grabaci|directo|sesi[óo]n)/i.test(String(c?.name || ''))) ?? null

  // Register today's visit so the streak counter advances. Idempotent within
  // the same day, fire-and-forget — never blocks the page.
  const [visit, setVisit] = useState<StudentVisit | null>(null)
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!accessToken) return
    let active = true
    registerVisit(accessToken).then((v) => {
      if (!active) return
      setVisit(v)
      // La visita de hoy acaba de subir la racha → refresca los insights para
      // que la tira semanal marque HOY con su check al instante.
      queryClient.invalidateQueries({ queryKey: ['student', 'insights'] })
    })
    return () => { active = false }
  }, [accessToken, queryClient])

  // One cached fetch with the real progress signals (completions, attempts,
  // weak words, streak) — feeds every progress-aware card below. Cached via
  // react-query: al volver al Inicio los datos aparecen al instante.
  const { data: insights } = useStudentInsights()

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
        <div className="pt-1 shrink-0 flex flex-col items-end gap-2">
          {visit && (
            <StreakBadge current={visit.current_streak} longest={visit.longest_streak} />
          )}
          {insights && (
            <SafeArea nombre="Tu semana" fallback={null}>
              <WeekStrip activeDays={insights.week.activeDays} />
            </SafeArea>
          )}
        </div>
      </div>

      {/* Primeros pasos, fijos en el Inicio.
          Vuelven a la página en vez de flotar encima de ella: en el móvil el
          panel flotante tapaba el final del Inicio justo al alumno que acaba
          de entrar. Se tacha solo y desaparece entero al completarlo. */}
      <SafeArea nombre="Empieza aquí" fallback={null}>
        <StudentOnboarding orgslug={orgslug} modo="panel" />
      </SafeArea>

      {/* "Sigue donde lo dejaste" — big primary card with section progress.
          Mientras llegan los datos se reserva el hueco con un esqueleto: si no,
          el Inicio se pintaba entero, luego aparecían las tarjetas y todo
          saltaba hacia abajo, con pinta de estar cargando dos veces. */}
      {insights ? (
        <SafeArea nombre="Continúa donde lo dejaste">
          <ContinueCard orgslug={orgslug} insights={insights} runs={runs} />
        </SafeArea>
      ) : (
        <HomeSkeleton className="mb-8 h-[188px]" />
      )}

      {/* Esta semana + Tu repaso de hoy */}
      {insights ? (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SafeArea nombre="Esta semana">
            <WeekCard insights={insights} />
          </SafeArea>
          <SafeArea nombre="Tu repaso de hoy">
            <RepasoCard orgslug={orgslug} insights={insights} />
          </SafeArea>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HomeSkeleton className="h-[164px]" />
          <HomeSkeleton className="h-[164px]" />
        </div>
      )}

      {/* Así estás progresando — real, server-side numbers */}
      {insights ? (
        <SafeArea nombre="Así estás progresando">
          <FormacionCard orgslug={orgslug} insights={insights} runs={runs} />
        </SafeArea>
      ) : (
        <HomeSkeleton className="mb-8 h-[168px]" />
      )}

      {/* Tus cursos. Ojo: `runs` llega vacío mientras el camino del alumno
          está cargando, y sin esta guarda se pintaba PRIMERO la rejilla de
          "cursos por empezar" (la vista antigua, con la foto del curso) y un
          instante después se cambiaba por la tarjeta con tu progreso. Eso era
          lo que parecía que el Inicio cargaba dos veces. */}
      {!trailReady && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <HomeSkeleton className="h-[232px]" />
          </div>
        </div>
      )}

      {/* Courses in progress */}
      {trailReady && runs.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
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
      {trailReady && runs.length === 0 && !coursesReady && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <HomeSkeleton className="h-[232px]" />
          </div>
        </div>
      )}

      {/* ── El alumno que entra por primera vez ──
          Aquí NO se le enseña una rejilla con los cursos para que elija.
          Acaba de pagar la formación: ponerle al lado las grabaciones de las
          clases semanales convierte en una decisión algo que no lo es, y la
          primera pantalla de un curso de pago no puede empezar con una duda.

          Se le enseña la formación, grande y con un solo botón. Las
          grabaciones siguen a un clic en «Cursos», pero como material, no
          como alternativa. */}
      {trailReady && runs.length === 0 && coursesReady && (
        <div className="mb-6">
          {formacion ? (
            <ArranqueFormacion course={formacion} orgslug={orgslug} hayGrabaciones={courseList.length > 1} />
          ) : courseList.length === 0 ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
              <div className="flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                  <BookOpen className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                </div>
                <p className="text-md text-gray-400 text-center max-w-xs">
                  Aún no hay cursos disponibles.
                </p>
              </div>
            </>
          ) : (
            // Red de seguridad: si no se reconoce cuál es la formación, se
            // vuelve a la rejilla de siempre en vez de dejar el hueco vacío.
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tus cursos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {courseList.map((course: any) => (
                  <div key={course.course_uuid} className="flex flex-col">
                    <CourseThumbnail course={course} orgslug={orgslug} hideMeta />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Community channels — quick access to the chats */}
      <SafeArea nombre="Comunidad" fallback={null}>
        <CommunityChannelsCards orgslug={orgslug} />
      </SafeArea>

      {/* Upcoming events */}
      <SafeArea nombre="Próximos eventos" fallback={null}>
        <UpcomingEvents orgslug={orgslug} />
      </SafeArea>

      {/* Weekly roadmap */}
      <SafeArea nombre="Plan de la semana" fallback={null}>
        <RoadmapSection canEdit={!!isAdmin} />
      </SafeArea>

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
        <div className="shrink-0 flex items-center justify-start">
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

/**
 * Lo primero que ve el alumno el día que entra.
 *
 * Ocupa el sitio donde luego irá «Continúa donde lo dejaste», y hace lo mismo
 * que hará esa tarjeta cuando haya progreso: enseñar UNA cosa y un botón. La
 * rejilla de cursos que había antes convertía la primera pantalla en una
 * elección entre la formación y las grabaciones de las clases, y para alguien
 * que acaba de pagar la formación eso no es una elección: es una duda.
 *
 * Las grabaciones no desaparecen. Se mencionan debajo, en pequeño y como
 * material de repaso, que es lo que son.
 */
function ArranqueFormacion({
  course,
  orgslug,
  hayGrabaciones,
}: {
  course: any
  orgslug: string
  hayGrabaciones: boolean
}) {
  const uuid = String(course?.course_uuid || '').replace('course_', '')
  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-7 nice-shadow">
      <p className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-[0.08em]">
        Empieza por aquí
      </p>
      <h2
        className="mt-1.5 text-[22px] sm:text-[26px] font-bold text-gray-900 leading-tight"
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        {course?.name || 'Tu formación'}
      </h2>
      <p className="mt-2 text-[14.5px] text-[#5A6480] leading-relaxed max-w-xl">
        Este es tu camino de principio a fin. Ve en orden, sin prisa: cada lección
        se apoya en la anterior y la escuela te va guardando por dónde vas.
      </p>
      <Link
        href={getUriWithOrg(orgslug, `/course/${uuid}`)}
        className="mt-5 inline-flex items-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold px-6 py-3.5 rounded-xl transition-colors text-[15px]"
      >
        Empezar la formación
        <ArrowRight size={16} strokeWidth={2.5} />
      </Link>
      {hayGrabaciones && (
        <p className="mt-4 text-[13px] text-[#9CA3AF] leading-relaxed">
          Las grabaciones de las clases semanales están en{' '}
          <Link href={getUriWithOrg(orgslug, '/courses')} className="text-[#025dc7] hover:underline font-medium">
            Cursos
          </Link>
          , para repasar cuando te venga bien.
        </p>
      )}
    </div>
  )
}
