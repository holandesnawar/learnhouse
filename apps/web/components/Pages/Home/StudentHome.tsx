'use client'
import React, { useEffect, useState } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import TrailCourseCard from '@components/Pages/Trail/TrailCourseCard'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { useCourses } from '@/hooks/queries/useCourses'
import TuSemana from '@components/Pages/Home/TuSemana'
import UpcomingEvents from '@components/Pages/Home/UpcomingEvents'
import { ProximaClase, FeedComunidad } from '@components/Pages/Home/FeedInicio'
import { getUriWithOrg } from '@services/config/config'
import CommunityChannelsCards from '@components/Objects/Communities/CommunityChannelsCards'
import StreakBadge from '@components/Pages/Home/StreakBadge'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { registerVisit, type StudentVisit } from '@services/student/progress'
import { useStudentInsights } from '@/hooks/queries/useStudentInsights'
import { fechasDeClases, semanaConClases } from '@services/student/insights'
import { isWeeklyClassCourse } from '@/lib/course/formacionProgress'
import { CURSO_CLASE_SEMANAL_UUID, conGrabadas } from '@/lib/nawar/cursos'
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

  const firstName: string =
    session?.data?.user?.first_name || session?.data?.user?.username || ''

  // La "Clase semanal" (directos) no es un curso de la formación: se ve en su
  // propia sección del menú, no en "Tus cursos" ni en "Continúa donde lo dejaste".
  const isHidden = (uuid: unknown) => isWeeklyClassCourse(uuid, org?.config?.config)
  const runs: any[] = (Array.isArray(trailData?.runs) ? trailData.runs : []).filter(
    (r: any) => !isHidden(r?.course?.course_uuid)
  )
  const courseList: any[] = (Array.isArray(courses) ? courses : []).filter(
    (c: any) => !isHidden(c?.course_uuid)
  )
  // Su clase en directo (la que le toca por su grupo), para decirle dónde están
  // las grabaciones. Antes se buscaba la clase semanal en `courseList`, que ya
  // viene SIN las clases en directo: nunca salía.
  // Solo una que tenga grabaciones (27/10): Spreekclub y Masterclass no las enseñan.
  const directo: any = (Array.isArray(courses) ? courses : []).find(
    (c: any) => isHidden(c?.course_uuid) && conGrabadas(org?.config?.config, c?.course_uuid)
  )
  const claseEnDirecto = directo
    ? {
        uuid: String(directo.course_uuid || '').replace(/^course_/, ''),
        nombre: String(directo.course_uuid || '').includes(CURSO_CLASE_SEMANAL_UUID)
          ? 'Clase semanal'
          : String(directo.name || 'Clase en directo'),
      }
    : null

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
  const { data: insightsCrudos } = useStudentInsights()
  // «Esta semana» y la tira de días cuentan las clases del curso que el alumno
  // ha terminado (con su fecha, del recorrido), no `lesson_completion`, que en
  // la formación no se escribe nunca: ver `semanaConClases`.
  const insights = insightsCrudos
    ? { ...insightsCrudos, week: semanaConClases(insightsCrudos.week, fechasDeClases(runs)) }
    : insightsCrudos

  // Rediseño (rama diseno, 07/11/2026): el Inicio es un feed, como Circle.
  // A la izquierda lo que toca hoy (la clase, seguir, la comunidad); a la
  // derecha lo de un vistazo (tu semana, el repaso, los eventos). La lista de
  // cursos y los canales salen de aquí: están siempre en la barra.
  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="pb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            Hola{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-[14.5px] text-[#5B6382] mt-1">Esto es lo que toca hoy.</p>
        </div>
        {visit && (
          <div className="pt-1 shrink-0">
            <StreakBadge current={visit.current_streak} longest={visit.longest_streak} />
          </div>
        )}
      </div>

      <SafeArea nombre="Empieza aquí" fallback={null}>
        <StudentOnboarding orgslug={orgslug} modo="panel" />
      </SafeArea>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="min-w-0 space-y-6">
          {trailReady && runs.length === 0 && coursesReady && formacion && (
            <ArranqueFormacion course={formacion} orgslug={orgslug} grabaciones={null} />
          )}
          <SafeArea nombre="Tu clase" fallback={null}>
            <ProximaClase orgslug={orgslug} />
          </SafeArea>
          {insights ? (
            <SafeArea nombre="Continúa donde lo dejaste">
              <ContinueCard orgslug={orgslug} insights={insights} runs={runs} />
            </SafeArea>
          ) : (
            <HomeSkeleton className="h-[188px]" />
          )}
          <SafeArea nombre="Comunidad" fallback={null}>
            <FeedComunidad orgslug={orgslug} />
          </SafeArea>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          {insights ? (
            <>
              <SafeArea nombre="Tu semana" fallback={null}>
                <div className="rounded-2xl border border-[#E4E8F2] bg-white p-4">
                  <p className="text-[13px] font-semibold text-[#0B1033] mb-2">Tu semana</p>
                  <WeekStrip activeDays={insights.week.activeDays} />
                </div>
              </SafeArea>
              <SafeArea nombre="Esta semana">
                <WeekCard insights={insights} />
              </SafeArea>
              <SafeArea nombre="Tu repaso de hoy">
                <RepasoCard orgslug={orgslug} insights={insights} />
              </SafeArea>
            </>
          ) : (
            <HomeSkeleton className="h-[164px]" />
          )}
          <SafeArea nombre="Próximos eventos" fallback={null}>
            <UpcomingEvents orgslug={orgslug} />
          </SafeArea>
          <Link
            href={getUriWithOrg(orgslug, '/consultas')}
            className="flex items-center gap-3 rounded-2xl border border-[#E4E8F2] bg-white p-4 hover:border-[#C9D4EC]"
          >
            <HelpCircle size={22} className="text-[#025dc7] shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-[#0B1033]">¿Tienes una duda?</span>
              <span className="block text-[12.5px] text-[#6B7393]">Pregúntala en Consultas y te respondemos.</span>
            </span>
            <ArrowRight size={16} className="text-[#9AA1BC]" />
          </Link>
        </aside>
      </div>
    </div>
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
  grabaciones,
}: {
  course: any
  orgslug: string
  grabaciones: { uuid: string; nombre: string } | null
}) {
  const uuid = String(course?.course_uuid || '').replace('course_', '')
  return (
    // Sin el rótulo "Empieza por aquí": eso ya lo dice el bloque de primeros
    // pasos que tiene justo encima, y dos "empieza aquí" seguidos en la misma
    // pantalla se anulan el uno al otro. Aquí el título es el nombre del curso.
    //
    // Y en horizontal, no apilado: era una tarjeta de media pantalla de alto en
    // el móvil para decir una sola cosa. El texto a un lado, el botón al otro.
    <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5 nice-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2
            className="text-[19px] sm:text-[22px] font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            {course?.name || 'Tu formación'}
          </h2>
          <p className="mt-1 text-[13.5px] text-[#5A6480] leading-relaxed">
            Tu camino de principio a fin. Ve en orden y sin prisa: la escuela te
            guarda por dónde vas.
          </p>
        </div>
        <Link
          href={getUriWithOrg(orgslug, `/course/${uuid}`)}
          className="shrink-0 inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold px-5 py-3 rounded-xl transition-colors text-[15px]"
        >
          Empezar
          <ArrowRight size={16} strokeWidth={2.5} />
        </Link>
      </div>
      {grabaciones && (
        <p className="mt-3 text-[12.5px] text-[#9CA3AF] leading-relaxed">
          {/* Antes esto llevaba a `/courses`, el índice genérico: el alumno
              buscaba una grabación y aterrizaba en una lista de cursos donde
              tenía que adivinar cuál. Va directo a Clase semanal, que es donde
              están las grabaciones. */}
          Las grabaciones de las clases semanales están en{' '}
          <Link
            href={getUriWithOrg(orgslug, `/course/${grabaciones.uuid}`)}
            className="text-[#025dc7] hover:underline font-medium"
          >
            {grabaciones.nombre}
          </Link>
          , para repasar cuando te venga bien.
        </p>
      )}
    </div>
  )
}
