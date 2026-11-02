'use client'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMetadata } from '@services/courses/courses'
import { useTrail } from '@/hooks/queries/useTrail'
import { useRouter } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import {
  getCourseBannerMediaDirectory,
  getCourseThumbnailMediaDirectory,
} from '@services/media/media'
import { ArrowRight, Backpack, BookOpen as Books, Check, File, StickyNote, Video, Square, Image as ImageIcon, Layers, Lock } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useMediaQuery } from 'usehooks-ts'
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions'
import CourseActionsMobile from '@components/Objects/Courses/CourseActions/CourseActionsMobile'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getActivityWithAuthHeader } from '@services/courses/activities'
import { useTranslation } from 'react-i18next'
import CommunityChannelsCards from '@components/Objects/Communities/CommunityChannelsCards'
import CourseFAQ from '@components/Pages/Activity/CourseFAQ'
import WeeklyClassBanner from '@components/Pages/Courses/WeeklyClassBanner'
import SalaEnDirecto from '@components/Pages/Courses/SalaEnDirecto'
import EtiquetaCurso from '@components/Pages/Courses/EtiquetaCurso'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import VideoPortada from '@components/Pages/Courses/VideoPortada'
import SemanasClase, { useSemanasClase } from '@components/Pages/Courses/SemanasClase'
import { CURSO_CLASE_SEMANAL_UUID, CURSO_FORMACION_UUID, ajustesDirecto, conGrabadas, esCursoEnDirecto, uuidDeCurso } from '@/lib/nawar/cursos'
import { sesionesVisibles } from '@/lib/course/weeklyClass'
import { getLessonIcon } from '@components/Pages/Activity/CourseLessonsSidebar'
import { useAnalytics } from '@/hooks/useAnalytics'

// Las clases en directo (la clase semanal y las que se crean como ella, p. ej.
// la clase semanal partida en dos grupos) son bibliotecas de sesiones, no un
// camino: sin el recuadro de empezar/dejar el curso ni el progreso por clase,
// y «Lecciones» pasa a «Sesiones grabadas». Cuál lo es lo decide
// `esCursoEnDirecto` (lib/nawar/cursos.ts) con la configuración de la escuela.

/** Los capítulos que se pintan: en una clase en directo, sin los meses que ya
 *  pasaron vacíos (ver `sesionesVisibles`) ni los que son semanas (28/10:
 *  esas salen arriba, en «Esta semana» y «Semanas anteriores»). */
function capitulosAVer(course: any, enDirecto: boolean, semanas: Set<string> = new Set()): any[] {
  const todos = course?.chapters ?? []
  return enDirecto ? sesionesVisibles(todos).filter((c: any) => !semanas.has(c.chapter_uuid)) : todos
}

const CourseClient = (props: any) => {
  const { t } = useTranslation()
  const [learnings, setLearnings] = useState<any>([])
  const [expandedChapters, setExpandedChapters] = useState<{[key: string]: boolean}>({})
  const [activeThumbnailType, setActiveThumbnailType] = useState<'image' | 'video'>('image')
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const initialCourse = props.course
  const serverError = props.serverError
  const org = useOrg() as any
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const queryClient = useQueryClient()

  const { data: clientCourseData, error: courseError, isLoading: courseLoading } = useQuery({
    queryKey: queryKeys.courses.meta(courseuuid),
    queryFn: () => getCourseMetadata(courseuuid, {}, access_token, { slim: true }),
    enabled: !!courseuuid && !serverError,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const course = initialCourse || clientCourseData;
  const enDirecto = esCursoEnDirecto(course?.course_uuid, org?.config?.config)
  const { isAdmin: esAdministrador, isStaff: esDelEquipo } = useAdminStatus()
  // Spreekclub y Masterclass, sin clases grabadas (27/10): ni la sección ni
  // «Clases anteriores». Lo cambia el administrador en esta misma página.
  const grabadas = !enDirecto || conGrabadas(org?.config?.config, course?.course_uuid)
  // Las semanas de la clase (presentación, ejercicios, tarea): sus capítulos
  // no se repiten en «Sesiones grabadas».
  const { data: datosSemanas } = useSemanasClase(course?.course_uuid, enDirecto)
  const capitulosDeSemanas = new Set((datosSemanas?.semanas ?? []).map((s) => s.chapter_uuid))

  const { track } = useAnalytics()

  // Track course view
  const courseId = course?.id
  const courseUuidForTracking = course?.course_uuid
  useEffect(() => {
    if (courseId && courseUuidForTracking) {
      track('course_view', {
        course_uuid: courseUuidForTracking,
      })
    }
  }, [courseId, courseUuidForTracking, track])

  // Fetch trail data — shared cache with useTrail hook used elsewhere
  const { data: trailData } = useTrail(org?.id);

  // Must be before any early returns (React rules of hooks)
  useEffect(() => {
    if (!course) return

    getLearningTags(course)

    if (course?.chapters) {
      const totalActivities = course.chapters.reduce((sum: number, chapter: any) => sum + (chapter.activities?.length || 0), 0)
      const defaultExpanded: {[key: string]: boolean} = {}
      capitulosAVer(course, enDirecto, capitulosDeSemanas).forEach((chapter: any, idx: number) => {
        defaultExpanded[chapter.chapter_uuid] = idx === 0 ? true : totalActivities <= 5
      })
      setExpandedChapters(defaultExpanded)
    }
  }, [course, enDirecto])

  // Show loading state if fetching course data client-side
  if (!initialCourse && !serverError && courseLoading) {
    return (
      <GeneralWrapperStyled>
        <div className="animate-pulse">
          {/* Breadcrumb placeholder */}
          <div className="pb-4 flex items-center gap-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-3 bg-gray-200 rounded w-2" />
            <div className="h-3 bg-gray-200 rounded w-32" />
          </div>

          {/* Course title + share row */}
          <div className="pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="h-9 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-200 rounded-lg w-24" />
          </div>

          {/* Main content: left 3/4 + right 1/4 sidebar */}
          <div className="flex flex-col md:flex-row gap-8 pt-2">
            {/* Left column */}
            <div className="w-full md:w-3/4 space-y-4">
              {/* Thumbnail */}
              <div className="bg-gray-200 rounded-lg w-full h-[180px] md:h-[340px]" />
              {/* About text block */}
              <div className="space-y-2 py-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
                <div className="h-3 bg-gray-200 rounded w-4/6" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full md:w-1/4 space-y-4">
              {/* Actions box */}
              <div className="bg-gray-200 rounded-lg h-40" />
              {/* Authors box */}
              <div className="bg-gray-200 rounded-lg h-24" />
            </div>
          </div>

          {/* Chapter list */}
          <div className="w-full my-5 mb-10">
            <div className="h-7 bg-gray-200 rounded w-40 mb-5" />
            <div className="bg-white shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden">
              {Array.from({ length: 3 }).map((_, chIdx) => (
                <div key={chIdx}>
                  {/* Chapter header */}
                  <div className="flex items-center gap-3 py-4 px-4 bg-neutral-50 outline outline-1 outline-neutral-200/40">
                    <div className="h-5 w-5 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="h-5 bg-gray-200 rounded w-5 flex-shrink-0" />
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                  </div>
                  {/* Activity rows — only expand first chapter */}
                  {chIdx === 0 && Array.from({ length: 3 }).map((_, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-3 px-4 py-4 border-t border-neutral-100">
                      <div className="h-4 w-4 bg-gray-200 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 rounded w-20" />
                      </div>
                      <div className="h-4 w-4 bg-gray-200 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GeneralWrapperStyled>
    )
  }

  // Determine the active error (server-side or client-side)
  const activeError = serverError || courseError

  // Show error if course fetch failed
  if (!course && activeError) {
    return (
      <GeneralWrapperStyled>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {t('course.accessDenied', 'Unable to access this course')}
          </h2>
          <p className="text-gray-500 mb-4">
            {activeError?.status === 403
              ? t('course.noPermission', 'You do not have permission to view this course.')
              : t('course.loadError', 'This course could not be found or there was an error loading it.')}
          </p>
          <Link href={getUriWithOrg(orgslug, '/courses')} className="text-blue-600 hover:underline">
            {t('course.backToCourses', 'Back to Courses')}
          </Link>
        </div>
      </GeneralWrapperStyled>
    )
  }

  function getLearningTags(courseData: any) {
    if (!courseData?.learnings) {
      setLearnings([])
      return
    }

    try {
      // Try to parse as JSON (new format)
      const parsedLearnings = JSON.parse(courseData.learnings)
      if (Array.isArray(parsedLearnings)) {
        // New format: array of learning items with text and emoji
        setLearnings(parsedLearnings)
        return
      }
    } catch (e) {
      // Not valid JSON, continue to legacy format handling
    }

    // Legacy format: comma-separated string (changed from pipe-separated)
    const learningItems = courseData.learnings.split(',').map((text: string) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      text: text.trim(), // Trim whitespace that might be present after commas
      emoji: '📝' // Default emoji for legacy items
    }))

    setLearnings(learningItems)
  }

  const getActivityTypeLabel = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return t('activities.video')
      case 'TYPE_DOCUMENT':
        return t('activities.document')
      case 'TYPE_DYNAMIC':
        return t('activities.page')
      case 'TYPE_ASSIGNMENT':
        return t('activities.assignment')
      default:
        return t('activities.learning_material')
    }
  }

  const getActivityTypeBadgeColor = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DOCUMENT':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DYNAMIC':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_ASSIGNMENT':
        return 'bg-neutral-100 text-neutral-500'
      default:
        return 'bg-neutral-100 text-neutral-500'
    }
  }

  const isActivityDone = (activity: any) => {
    if (!course?.course_uuid || !trailData?.runs || !Array.isArray(trailData.runs)) {
      return false
    }
    const cleanCourseUuid = course.course_uuid.replace('course_', '')
    const run = trailData.runs.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '')
      return cleanRunCourseUuid === cleanCourseUuid
    })
    if (!run || !Array.isArray(run.steps)) return false
    return !!run.steps.find((step: any) => step.activity_id == activity.id)
  }

  const isActivityCurrent = (activity: any) => {
    if (!activity?.activity_uuid) return false
    const activity_uuid = activity.activity_uuid.replace('activity_', '')
    return props.current_activity === activity_uuid
  }

  const handleActivityMouseEnter = (activity: any) => {
    if (!activity?.activity_uuid) return
    const cleanUuid = activity.activity_uuid.replace('activity_', '')
    queryClient.prefetchQuery({
      queryKey: queryKeys.activity.detail(cleanUuid),
      queryFn: () => getActivityWithAuthHeader(cleanUuid, {}, access_token),
      staleTime: 60_000,
    })
  }

  // Generate JSON-LD structured data for SEO
  const generateJsonLd = () => {
    if (!course || !org) return null
    const seo = course.seo || {}

    // Check if JSON-LD is enabled (defaults to true if not set)
    if (seo.enable_jsonld === false) return null

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: seo.title || course.name,
      description: seo.description || course.description || '',
      provider: {
        '@type': 'Organization',
        name: org.name,
        ...(org.description && { description: org.description }),
      },
      ...(course.thumbnail_image && {
        image: getCourseThumbnailMediaDirectory(
          org?.org_uuid,
          course?.course_uuid,
          course?.thumbnail_image
        ),
      }),
      ...(course.creation_date && { dateCreated: course.creation_date }),
      ...(course.update_date && { dateModified: course.update_date }),
    }

    return jsonLd
  }

  const jsonLd = generateJsonLd()

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {!course || !org ? null : (
        <>
          <GeneralWrapperStyled>
            {/* Cabecera estándar de la escuela: icono azul + título en negro,
                igual que Mi progreso, Mis notas o Eventos. Antes el título del
                curso iba suelto y era la única pantalla sin icono. */}
            <div className="flex items-center gap-2 pb-2 pt-2">
              {enDirecto ? (
                <Video size={24} className="text-[#025dc7] shrink-0" />
              ) : (
                <Books size={24} className="text-[#025dc7] shrink-0" />
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{course.name}</h1>
              {/* El equipo: cuál de las copias es (Groep rood…), 29/10; también los profes desde el 02/11. */}
              {enDirecto && esDelEquipo ? (
                <EtiquetaCurso texto={ajustesDirecto(org?.config?.config, course.course_uuid).etiqueta} />
              ) : null}
            </div>

            {/* La sala en directo dentro de la escuela (Daily): en cualquier
                curso que no sea la formación. El alumno solo la ve encendida;
                el administrador, siempre, para encenderla. En una clase en
                directo va debajo del recuadro (más abajo). */}
            {uuidDeCurso(course) !== CURSO_FORMACION_UUID && !enDirecto && (
              <div className="pt-2">
                <SalaEnDirecto courseUuid={uuidDeCurso(course)} soloAjustes={enDirecto} />
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-start gap-8 pt-2">
              <div className="w-full md:w-3/4 space-y-4">
                {(() => {
                  const showVideo = course.thumbnail_type === 'video' || (course.thumbnail_type === 'both' && activeThumbnailType === 'video');
                  const showImage = course.thumbnail_type === 'image' || (course.thumbnail_type === 'both' && activeThumbnailType === 'image') || !course.thumbnail_type;

                  const videoPortada = course.thumbnail_video
                    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course?.course_uuid, course?.thumbnail_video)
                    : ''

                  // Clase en directo: la portada del curso y, debajo, la franja
                  // con la próxima clase y el botón de entrar. Con VÍDEO de
                  // portada, el vídeo en bucle; si no, la foto entera, sin
                  // recortar. Sin portada, solo la franja. Los ajustes de la
                  // sala (solo administradores) van debajo: lo primero que se
                  // ve es lo que le importa al alumno.
                  // El vídeo gana también con «foto y vídeo» (28/10): subir un
                  // vídeo a un curso que ya tenía foto lo deja así, y la clase
                  // semanal seguía enseñando la foto vieja. Para volver a la
                  // foto, «Solo imagen» en el tipo de portada del curso.
                  if (enDirecto) {
                    const conVideo = course.thumbnail_type !== 'image' && !!videoPortada
                    const foto = course.extra_metadata?.banner_image
                      ? getCourseBannerMediaDirectory(org?.org_uuid, course.course_uuid, course.extra_metadata.banner_image)
                      : course.thumbnail_image
                        ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
                        : ''
                    return (
                      <div className="space-y-4">
                        {conVideo ? (
                          <VideoPortada src={videoPortada} />
                        ) : foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={foto}
                            alt=""
                            fetchPriority="high"
                            className="block w-full h-auto max-h-[460px] object-cover rounded-2xl ring-1 ring-inset ring-black/10 shadow-xl bg-[#F0F5FF]"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                        <WeeklyClassBanner courseUuid={uuidDeCurso(course)} grabadas={grabadas} />
                        <SalaEnDirecto courseUuid={uuidDeCurso(course)} soloAjustes />
                      </div>
                    );
                  }

                  if (showVideo && videoPortada) {
                    return (
                      <VideoPortada src={videoPortada}>
                        {course.thumbnail_type === 'both' && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ImageIcon size={12} className="mr-1" />
                                {t('courses.image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <Video size={12} className="mr-1" />
                                {t('activities.video')}
                              </button>
                            </div>
                          </div>
                        )}
                      </VideoPortada>
                    );
                  } else if (showImage && (course.extra_metadata?.banner_image || course.thumbnail_image)) {
                    // Prefer the banner_image (uploaded separately for the
                    // hero slot) over the thumbnail_image. Falls back to the
                    // thumbnail so existing courses without a banner keep
                    // rendering exactly as before.
                    const heroFile = course.extra_metadata?.banner_image || course.thumbnail_image;
                    const heroUrl = course.extra_metadata?.banner_image
                      ? getCourseBannerMediaDirectory(org?.org_uuid, course.course_uuid, heroFile)
                      : getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, heroFile);
                    return (
                      <div className="relative inset-0 ring-1 ring-inset ring-black/10 rounded-2xl shadow-xl w-full h-[180px] md:h-[340px] bg-cover bg-center overflow-hidden"
                        style={{ backgroundImage: `url(${heroUrl})` }}
                      >
                        {/* Hidden img with fetchpriority="high" so the browser fetches this LCP image immediately */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getCourseThumbnailMediaDirectory(org?.org_uuid, course?.course_uuid, course?.thumbnail_image)}
                          alt=""
                          aria-hidden="true"
                          fetchPriority="high"
                          className="absolute w-0 h-0 opacity-0 pointer-events-none"
                        />
                        {course.thumbnail_type === 'both' && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ImageIcon size={12} className="mr-1" />
                                {t('courses.image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <Video size={12} className="mr-1" />
                                {t('activities.video')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div
                        className="inset-0 ring-1 ring-inset ring-black/10 rounded-2xl shadow-xl relative w-full h-[180px] md:h-[340px] bg-cover bg-center overflow-hidden"
                        style={{
                          backgroundImage: `url('/empty_thumbnail.png')`,
                          backgroundSize: 'auto',
                        }}
                      ></div>
                    );
                  }
                })()}

                {/* Las semanas: «Esta semana» con su presentación, grabación,
                    ejercicios y tarea (28/10). */}
                {enDirecto ? (
                  <SemanasClase courseUuid={course.course_uuid} courseuuid={courseuuid} orgslug={orgslug} curso={course} />
                ) : null}

                {/* La descripción no sale en las clases en directo nuevas (Spreekclub,
                    Masterclass, 27/10): LearnHouse obliga a escribirla al crear el
                    curso, pero ahí presenta el recuadro. La clase semanal de
                    siempre sigue como estaba. */}
                {course.about && course.about.trim() && (!enDirecto || uuidDeCurso(course) === CURSO_CLASE_SEMANAL_UUID) && (
                  <div className="course_metadata_left">
                    <p className="whitespace-pre-line break-words w-full leading-relaxed tracking-normal text-pretty hyphens-auto">{course.about}</p>
                  </div>
                )}
              </div>

              <div className={`course_metadata_right w-full md:w-1/4 ${enDirecto ? 'md:self-start md:sticky md:top-6' : 'space-y-4'}`}>
                {enDirecto ? (
                  // Session-library courses: no enrolment/progress — surface the
                  // community channel cards in the right rail, stacked one per row.
                  // The FAQ moves down next to "Sesiones grabadas".
                  <CommunityChannelsCards orgslug={orgslug} title="Comunidades" singleColumn />
                ) : (
                  <CoursesActions courseuuid={courseuuid} orgslug={orgslug} course={course} trailData={trailData} />
                )}
              </div>
            </div>

            {(() => {
              const displayLearnings = learnings.filter((l: any) => {
                const text = typeof l === 'string' ? l : l?.text
                return text && text.trim() !== '' && text !== 'null'
              })
              if (displayLearnings.length === 0) return null
              return (
                <div className="w-full">
                  <h2 className="py-5 text-xl md:text-2xl font-bold">{t('courses.what_you_will_learn')}</h2>
                  <div className="bg-white shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden px-5 py-5 space-y-2">
                    {displayLearnings.map((learning: any) => {
                      const learningText = typeof learning === 'string' ? learning : learning.text
                      const learningEmoji = typeof learning === 'string' ? null : learning.emoji
                      const learningId = typeof learning === 'string' ? learning : learning.id || learning.text
                      return (
                        <div
                          key={learningId}
                          className="flex space-x-2 items-center font-semibold text-gray-500"
                        >
                          <div className="px-2 py-2 rounded-full">
                            {learningEmoji ? (
                              <span>{learningEmoji}</span>
                            ) : (
                              <Check className="text-gray-400" size={15} />
                            )}
                          </div>
                          <p>{learningText}</p>
                          {learning.link && (
                            <a
                              href={learning.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-sm"
                            >
                              <span className="sr-only">Link to {learningText}</span>
                              <ArrowRight size={14} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {grabadas ? (
            <div id="sesiones-grabadas" className="w-full mt-10 mb-12 scroll-mt-24">
              <h2 className="pb-5 text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2.5" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
                {enDirecto ? (
                  <>
                    <Video size={22} className="text-[#025dc7]" />
                    Sesiones grabadas
                  </>
                ) : (
                  t('courses.course_lessons')
                )}
              </h2>
              <div className="bg-white nice-shadow rounded-2xl overflow-hidden border border-[#DDE6F5] divide-y divide-[#DDE6F5]">
                {capitulosAVer(course, enDirecto, capitulosDeSemanas).map((chapter: any, idx: number) => {
                  const isExpanded = expandedChapters[chapter.chapter_uuid] ?? (idx === 0); // Default to expanded for first chapter
                  return (
                    <div key={chapter.chapter_uuid || `chapter-${chapter.name}`} className="">
                      <div
                        className="flex items-start py-4 px-5 bg-[#F8FAFF] cursor-pointer hover:bg-[#F0F5FF] transition-colors"
                        onClick={() => setExpandedChapters(prev => ({
                          ...prev,
                          [chapter.chapter_uuid]: !isExpanded
                        }))}
                      >
                        {/* Cerrado: un candado en lugar de la flecha. No hay
                            nada que desplegar, así que la flecha mentía. */}
                        <div className="flex flex-col justify-center mr-3 pt-1 text-[#025dc7]">
                          {chapter.is_locked ? (
                            <Lock size={18} className="text-gray-400" />
                          ) : (
                            <svg
                              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                        {/* Title and badge column */}
                        <div className="flex flex-col items-start w-full">
                          <div className="flex items-center flex-wrap mb-1 w-full min-w-0">
                            <h3 className={`text-lg font-bold leading-tight truncate min-w-0 sm:text-base md:text-lg ${chapter.is_locked ? 'text-gray-400' : 'text-gray-900'}`} style={{lineHeight: '1.2', fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")'}}>{chapter.name}</h3>

                          </div>
                          {!chapter.is_locked && (
                            <div className="flex items-center space-x-1 text-sm text-neutral-400 font-normal">
                              <Layers size={16} className="mr-1" />
                              <span>{chapter.activities.length} {t('activities.activities')}</span>
                            </div>
                          )}
                          {/* Cerrado por el goteo: cuándo o qué falta para que se abra. */}
                          {chapter.is_locked && (chapter.unlock_reason || chapter.unlock_date) ? (
                            <p className="text-[13px] text-[#5A6480] leading-snug">
                              {chapter.unlock_reason
                                ? chapter.unlock_reason
                                : `Se abre el ${new Date(chapter.unlock_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.`}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className={`transition-all duration-200 ${isExpanded ? 'block' : 'hidden'}`}>
                        <div className="divide-y divide-[#EEF2FB]">
                          {chapter.activities.map((activity: any) => {
                            const locked = !!activity.is_locked
                            const RowInner = (
                              <div className="flex items-center gap-3">
                                {/* Icono según el tipo de lección (delante), igual que el sidebar */}
                                <div className="shrink-0">
                                  {locked ? (
                                    <Lock size={16} className="stroke-[2] text-rose-400" />
                                  ) : (
                                    getLessonIcon(activity.name, activity.activity_type, 'text-[#025dc7]')
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`font-semibold transition-colors ${locked ? 'text-neutral-400' : 'text-neutral-700 group-hover:text-neutral-900'}`}>{activity.name}</p>
                                    {locked && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold">
                                        <Lock size={10} />
                                        {t('course.locked', 'Locked')}
                                      </span>
                                    )}
                                    {!locked && isActivityCurrent(activity) && (
                                      <div className="flex items-center space-x-1 text-[#025dc7] bg-[#025dc7]/10 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        <span>{t('activities.current')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Check verde de completada (detrás), o flecha si no */}
                                {!locked && isActivityDone(activity) ? (
                                  <Check size={18} className="shrink-0 text-emerald-500 stroke-[3]" />
                                ) : (
                                  <ArrowRight size={14} className={`shrink-0 transition-colors ${locked ? 'text-neutral-200' : 'text-neutral-300 group-hover:text-neutral-400'}`} />
                                )}
                              </div>
                            )

                            if (locked) {
                              return (
                                <div
                                  key={activity.activity_uuid}
                                  className="block activity-container px-5 py-3.5 cursor-not-allowed select-none"
                                  title={t('course.activity_locked_hint', 'Sign in or join the right user group to unlock this.')}
                                >
                                  {RowInner}
                                </div>
                              )
                            }

                            return (
                              <Link
                                key={activity.activity_uuid}
                                href={
                                  getUriWithOrg(orgslug, '') +
                                  `/course/${courseuuid}/activity/${activity.activity_uuid.replace('activity_', '')}`
                                }
                                rel="noopener noreferrer"
                                prefetch={false}
                                className="block group activity-container transition-all duration-200 px-5 py-3.5 hover:bg-[#F8FAFF]"
                                onMouseEnter={() => handleActivityMouseEnter(activity)}
                              >
                                {RowInner}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            ) : null}

            {enDirecto ? (
              // Session courses: communities are in the right rail, so here we
              // surface the FAQ (its own heading matches "Sesiones grabadas").
              <div className="mt-8">
                <CourseFAQ
                  courseUuid={course.course_uuid}
                  enDirecto={enDirecto}
                  conSala={ajustesDirecto(org?.config?.config, course.course_uuid).activo}
                  conGrabadas={grabadas}
                />
              </div>
            ) : (
              /* Community channels — quick access to the chats */
              <div className="mt-8">
                <CommunityChannelsCards orgslug={orgslug} />
              </div>
            )}
          </GeneralWrapperStyled>

          {/* Mobile Actions Box — hidden for session-library courses, where
              the FAQ on the right rail (rendered above the chapters on
              mobile) already conveys everything the student needs. */}
          {isMobile && !enDirecto && (
            <CourseActionsMobile courseuuid={courseuuid} orgslug={orgslug} course={course} trailData={trailData} />
          )}
        </>
      )}
    </>
  )
}

export default CourseClient