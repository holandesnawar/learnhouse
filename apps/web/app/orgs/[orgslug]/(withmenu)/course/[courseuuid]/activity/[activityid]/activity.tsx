'use client'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { BookOpenCheck, CheckCircle, ChevronLeft, ChevronRight, MessageSquare, UserRoundPen, Edit2, Maximize2, Minimize2, Trophy, Sparkles, XCircle, Lock, RotateCcw, Infinity as InfinityIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { markActivityAsComplete, unmarkActivityAsComplete } from '@services/courses/activity'
import { usePathname, useRouter } from 'next/navigation'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media'
import { useOrg, useOrgMembership } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useEffect, useRef, useMemo, useCallback, useState, lazy, Suspense } from 'react'
import { getAssignmentFromActivityUUID, getFinalGrade, retryAssignmentSubmission, submitAssignmentForGrading } from '@services/courses/assignments'
import { AssignmentProvider } from '@components/Contexts/Assignments/AssignmentContext'
import { AssignmentsTaskProvider } from '@components/Contexts/Assignments/AssignmentsTaskContext'
import AssignmentSubmissionProvider, { useAssignmentSubmission } from '@components/Contexts/Assignments/AssignmentSubmissionContext'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTrail } from '@/hooks/queries/useTrail'
import { useCourseMeta } from '@/hooks/queries/useCourses'
import { useActivity } from '@/hooks/queries/useActivity'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { useMediaQuery, useWindowSize } from 'usehooks-ts'
import PaidCourseActivityDisclaimer from '@components/Objects/Courses/CourseActions/PaidCourseActivityDisclaimer'
import { useContributorStatus } from '../../../../../../../../hooks/useContributorStatus'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import ActivityChapterDropdown from '@components/Pages/Activity/ActivityChapterDropdown'
import ActivityShareDropdown from '@components/Pages/Activity/ActivityShareDropdown'
import CourseLessonsSidebar, { MobileCourseLessons } from '@components/Pages/Activity/CourseLessonsSidebar'
import LessonExtras from '@components/Pages/Activity/LessonExtras'
import ConsultaSearchBar from '@components/Pages/Activity/ConsultaSearchBar'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import CourseEndView from '@components/Pages/Activity/CourseEndView'
import { motion, AnimatePresence } from 'motion/react'
import MiniInfoTooltip from '@components/Objects/MiniInfoTooltip'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import UserAvatar from '@components/Objects/UserAvatar'
import { useTranslation } from 'react-i18next'
import { useAnalytics } from '@/hooks/useAnalytics'

const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false })

// Lazy load heavy components
const Canva = lazy(() => import('@components/Objects/Activities/DynamicCanva/DynamicCanva'))
const VideoActivity = lazy(() => import('@components/Objects/Activities/Video/Video'))
const DocumentPdfActivity = lazy(() => import('@components/Objects/Activities/DocumentPdf/DocumentPdf'))
const AssignmentStudentActivity = lazy(() => import('@components/Objects/Activities/Assignment/AssignmentStudentActivity'))
const AIActivityAsk = lazy(() => import('@components/Objects/Activities/AI/AIActivityAsk'))
const AISidePanelContentWrapper = lazy(() => import('@components/Objects/Activities/AI/AIActivityAsk').then(mod => ({ default: mod.AISidePanelContentWrapper })))
const AISidePanelInline = lazy(() => import('@components/Objects/Activities/AI/AIActivityAsk').then(mod => ({ default: mod.AISidePanelInline })))
const AIChatBotProvider = lazy(() => import('@components/Contexts/AI/AIChatBotContext'))
const ScormActivity = lazy(() => import('../../../../../../../../ee/components/Activities/ScormActivity'))
const MarkdownActivity = lazy(() => import('@components/Objects/Activities/Markdown/MarkdownActivity'))
const EmbedActivity = lazy(() => import('@components/Objects/Activities/Embed/EmbedActivity'))
const NativeExerciseActivity = lazy(() => import('@components/exercises-app/NativeExerciseActivity'))
const SituacionViewer = lazy(() => import('@components/exercises-app/SituacionViewer'))
import { getSituacion } from '@/lib/exercises-app/situaciones'

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="relative w-6 h-6">
      <div className="absolute top-0 left-0 w-full h-full border-2 border-gray-100 rounded-full"></div>
      <div className="absolute top-0 left-0 w-full h-full border-2 border-gray-400 rounded-full animate-spin border-t-transparent"></div>
    </div>
  </div>
);

// A native Nawar exercise can be stored on an Embed activity in two ways:
//   1. the explicit token  "nawar:<moduleId>/<lessonId>[/<section>]"  (picker), or
//   2. a plain URL to the Nawar exercises app  ".../modulo/<m>/leccion/<l>"
// Both map to the same local module/lesson ids, so we render them natively
// (no external iframe → no banner, brand colours, course progress works).
// Anything else returns null and falls back to the regular iframe embed.
function parseNativeExercise(
  embedUrl: string
): { moduleId: string; lessonId: string; section?: string } | null {
  if (!embedUrl) return null;
  const token = embedUrl.match(/^nawar:([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  if (token) return { moduleId: token[1], lessonId: token[2], section: token[3] };
  const appUrl = embedUrl.match(/\/modulo\/([^/?#]+)\/leccion\/([^/?#]+)/);
  if (appUrl) return { moduleId: appUrl[1], lessonId: appUrl[2] };
  return null;
}

// A native Nawar "situación real" (video + exercises) embedded in a course:
//   embed_url = "nawar-video:<situacionId>"
function parseNativeVideo(embedUrl: string): { situacionId: string } | null {
  if (!embedUrl) return null;
  const m = embedUrl.match(/^nawar-video:(.+)$/);
  return m ? { situacionId: m[1] } : null;
}

// Secciones de la app de ejercicios que SÍ son "ejercicios" (hay que hacerlos
// para avanzar). El resumen (samenvatting) es contenido → se completa al abrirlo.
const NAWAR_EXERCISE_SECTIONS = new Set(['vocabulary', 'flashcards', 'lezen', 'luisteren']);

// ¿Esta actividad es un ejercicio (hay que completarlo) o contenido (basta verlo)?
// Contenido: vídeo, documento, texto/markdown y el resumen embebido.
// Ejercicio: Oefeningen/Flashcards/Lezen/Luisteren, situación real (vídeo+ejercicios) y assignments.
function isExerciseActivity(a: any): boolean {
  if (!a) return false;
  if (a.activity_type === 'TYPE_ASSIGNMENT') return true;
  if (a.activity_sub_type === 'SUBTYPE_DYNAMIC_EMBED') {
    const ne = parseNativeExercise(a.content?.embed_url || '');
    if (ne) return NAWAR_EXERCISE_SECTIONS.has(ne.section || '');
    if (parseNativeVideo(a.content?.embed_url || '')) return true;
    return false;
  }
  return false;
}


function ActivityContentSkeleton({ activityType }: { activityType?: string }) {
  const isVideo = activityType === 'TYPE_VIDEO' || activityType === 'TYPE_SCORM'
  const isDocument = activityType === 'TYPE_DOCUMENT'

  if (isVideo) {
    return (
      <div className="rounded-lg overflow-hidden relative bg-zinc-900 animate-pulse" style={{ minHeight: '420px' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <div className="ml-1 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[18px] border-l-white/25" />
          </div>
        </div>
      </div>
    )
  }

  if (isDocument) {
    return (
      <div className="bg-white nice-shadow rounded-lg p-3 sm:p-7 animate-pulse space-y-3" style={{ minHeight: '520px' }}>
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-[94%]" />
        <div className="h-4 bg-gray-100 rounded w-[88%]" />
        <div className="rounded bg-gray-100 h-[320px] mt-4" />
        <div className="h-4 bg-gray-100 rounded w-full mt-4" />
        <div className="h-4 bg-gray-100 rounded w-[91%]" />
        <div className="h-4 bg-gray-100 rounded w-[82%]" />
      </div>
    )
  }

  return (
    <div className="bg-white nice-shadow rounded-lg p-3 sm:p-7 animate-pulse space-y-4" style={{ minHeight: '420px' }}>
      <div className="h-7 bg-gray-100 rounded w-2/5 mb-2" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-[92%]" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-[86%]" />
      <div className="h-5 bg-gray-100 rounded w-1/3 mt-6" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-[96%]" />
      <div className="h-4 bg-gray-100 rounded w-[78%]" />
      <div className="h-5 bg-gray-100 rounded w-2/5 mt-4" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-[88%]" />
      <div className="h-4 bg-gray-100 rounded w-[72%]" />
    </div>
  )
}

interface ActivityClientProps {
  activityid: string
  courseuuid: string
  orgslug: string
  activity: any | null
  course: any | null
}

interface ActivityActionsProps {
  activity: any
  activityid: string
  course: any
  orgslug: string
  assignment: any
  showNavigation?: boolean
  trailData?: any
  canAdvance?: boolean
  lockMessage?: string
}

// Custom hook for activity position
function useActivityPosition(course: any, activityId: string) {
  return useMemo(() => {
    if (!course?.chapters) return { allActivities: [], currentIndex: -1 };

    let allActivities: any[] = [];
    let currentIndex = -1;

    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name
        });

        if (cleanActivityUuid === activityId.replace('activity_', '')) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    return { allActivities, currentIndex };
  }, [course, activityId]);
}

function ActivityActions({ activity, activityid, course, orgslug, assignment, showNavigation = true, trailData, canAdvance = true, lockMessage }: ActivityActionsProps) {

  const { t } = useTranslation();
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;


  return (
    <div className="flex space-x-2 items-center">
      {activity && activity.published == true && activity.content.paid_access != false && (
        <AuthenticatedClientElement checkMethod="authentication">
          {activity.activity_type != 'TYPE_ASSIGNMENT' && (
            <>
              <MarkStatus
                activity={activity}
                activityid={activityid}
                course={course}
                orgslug={orgslug}
                trailData={trailData}
              />
            </>
          )}
          {activity.activity_type == 'TYPE_ASSIGNMENT' && (
            <>
              <AssignmentSubmissionProvider assignment_uuid={assignment?.assignment_uuid}>
                <AssignmentTools
                  assignment={assignment}
                  activity={activity}
                  activityid={activityid}
                  course={course}
                  orgslug={orgslug}
                />
              </AssignmentSubmissionProvider>
            </>
          )}
          {showNavigation && (
            <NextActivityButton course={course} currentActivityId={activity.id} orgslug={orgslug} canAdvance={canAdvance} lockMessage={lockMessage} />
          )}
        </AuthenticatedClientElement>
      )}
    </div>
  );
}

function ActivityClient(props: ActivityClientProps) {
  const { t } = useTranslation()
  const activityid = props.activityid

  function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
  
    if (years > 0) return t('time.years_ago', { count: years });
    if (months > 0) return t('time.months_ago', { count: months });
    if (weeks > 0) return t('time.weeks_ago', { count: weeks });
    if (days > 0) return t('time.days_ago', { count: days });
    if (hours > 0) return t('time.hours_ago', { count: hours });
    if (minutes > 0) return t('time.minutes_ago', { count: minutes });
    return t('common.just_now');
  }

  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const org = useOrg() as any

  const { data: course, isLoading: courseLoading } = useCourseMeta(courseuuid)
  const { data: activity, isLoading: activityLoading } = useActivity(activityid)
  const session = useLHSession() as any;
  const pathname = usePathname()
  const access_token = session?.data?.tokens?.access_token;
  const [bgColor, setBgColor] = React.useState('bg-white nice-shadow')
  const [assignment, setAssignment] = React.useState(null) as any;
  const [markStatusButtonActive, setMarkStatusButtonActive] = React.useState(false);
  const [isFocusMode, setIsFocusMode] = React.useState(false);
  const isInitialRender = useRef(true);
  const { contributorStatus } = useContributorStatus(courseuuid);
  const { isAdmin } = useAdminStatus() as any;
  const canEditLesson = !!isAdmin || contributorStatus === 'ACTIVE';
  const router = useRouter();

  const { track } = useAnalytics()
  const activityStartTime = useRef(Date.now())

  // Track activity view on mount, time_on_activity on unmount
  const activityUuidForTracking = activity?.activity_uuid
  const courseUuidForTracking = course?.course_uuid
  const activityTypeForTracking = activity?.activity_type
  useEffect(() => {
    if (activityUuidForTracking && courseUuidForTracking) {
      activityStartTime.current = Date.now()
      track('activity_view', {
        activity_uuid: activityUuidForTracking,
        course_uuid: courseUuidForTracking,
        activity_type: activityTypeForTracking,
      })
    }
    return () => {
      if (activityUuidForTracking && courseUuidForTracking) {
        const seconds = Math.round((Date.now() - activityStartTime.current) / 1000)
        if (seconds > 0) {
          track('time_on_activity', {
            activity_uuid: activityUuidForTracking,
            course_uuid: courseUuidForTracking,
            seconds_spent: seconds,
          })
        }
      }
    }
  }, [activityid, activityUuidForTracking, courseUuidForTracking, activityTypeForTracking, track])

  const queryClient = useQueryClient()

  // Fetch trail data — shares cache key with course page trail query
  const { data: trailData } = useTrail(org?.id)

  // Memoize activity position calculation
  const { allActivities, currentIndex } = useActivityPosition(course, activityid);
  
  // Get previous and next activities
  const prevActivity = currentIndex > 0 ? allActivities[currentIndex - 1] : null;
  const nextActivity = currentIndex < allActivities.length - 1 ? allActivities[currentIndex + 1] : null;

  // Native Nawar exercise embeds keep the course action bar (Next + mark
  // complete) so course progress/trail still works; iframe embeds hide it.
  const nativeExercise =
    activity?.activity_sub_type === 'SUBTYPE_DYNAMIC_EMBED'
      ? parseNativeExercise(activity?.content?.embed_url || '')
      : null;
  const nativeVideo =
    activity?.activity_sub_type === 'SUBTYPE_DYNAMIC_EMBED'
      ? parseNativeVideo(activity?.content?.embed_url || '')
      : null;
  const isNativeExercise = !!nativeExercise || !!nativeVideo;

  // Auto-mark a native exercise activity complete when the student finishes it,
  // so progress saves without a manual click. Fires once per activity; marking
  // an already-complete activity is harmless.
  const nativeCompleteFired = useRef(false);
  useEffect(() => { nativeCompleteFired.current = false }, [activityid]);

  // ── Bloqueo por interacción (no "goteo"): el botón "Siguiente" solo avanza si
  // el alumno interactuó con la actividad. El módulo "Introducción" queda libre.
  const currentChapterForLock = (course?.chapters ?? []).find((c: any) =>
    (c.activities ?? []).some((a: any) => a.id === activity?.id)
  );
  const isIntroChapter = /introduc/i.test(currentChapterForLock?.name || '');

  // Registro de compleción para el % de progreso y los checks de la barra
  // (NO bloquea nada: acceso abierto y guiado).
  const videoUnlockFired = useRef(false);
  useEffect(() => {
    videoUnlockFired.current = false;
  }, [activityid]);

  const markCurrentComplete = useCallback(async () => {
    if (!access_token || !activity?.activity_uuid || !course?.course_uuid) return;
    try {
      await markActivityAsComplete(orgslug, course.course_uuid, activity.activity_uuid, access_token);
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org?.id) });
    } catch { /* best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access_token, activity?.activity_uuid, course?.course_uuid, orgslug, org?.id, queryClient]);

  const handleVideoPlay = useCallback(() => {}, []);

  // Al ver/llegar la posición del vídeo al ~85% lo marcamos como completado
  // (una sola vez) para el progreso. No condiciona el avance.
  const VIDEO_UNLOCK_FRACTION = 0.85;
  const handleVideoProgress = useCallback((fraction: number) => {
    if (!isFinite(fraction) || fraction <= 0) return;
    if (fraction >= VIDEO_UNLOCK_FRACTION && !videoUnlockFired.current) {
      videoUnlockFired.current = true;
      markCurrentComplete();
    }
  }, [markCurrentComplete]);

  // Contenido sin interacción (resumen, texto, documento) e Introducción →
  // marca de completado al abrir (best-effort) para el progreso.
  const requiresInteraction =
    !isIntroChapter &&
    (activity?.activity_type === 'TYPE_VIDEO' || isExerciseActivity(activity));

  useEffect(() => {
    if (!requiresInteraction && access_token && activity?.activity_uuid && course?.course_uuid) {
      const run = trailData?.runs?.find((r: any) => r.course_uuid === course.course_uuid);
      const already = !!run?.steps?.find((s: any) => s.activity_id === activity.id && s.complete === true);
      if (!already) markCurrentComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.activity_uuid, requiresInteraction]);

  // Acceso ABIERTO Y GUIADO: el botón "Siguiente" nunca bloquea.
  const canAdvanceCurrent = true;

  const handleNativeComplete = useCallback(async () => {
    if (nativeCompleteFired.current) return;
    if (!activity?.activity_uuid || !course?.course_uuid || !access_token) return;
    nativeCompleteFired.current = true;
    try {
      await markActivityAsComplete(orgslug, course.course_uuid, activity.activity_uuid, access_token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org?.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(course.course_uuid.replace('course_', '')) });
    } catch {
      nativeCompleteFired.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.activity_uuid, course?.course_uuid, access_token, orgslug, org?.id]);

  // Memoize activity content
  const activityContent = useMemo(() => {
    if (!activity || !activity.published || activity.content.paid_access === false) {
      return null;
    }

    switch (activity.activity_type) {
      case 'TYPE_DYNAMIC':
        if (activity.activity_sub_type === 'SUBTYPE_DYNAMIC_MARKDOWN') {
          return (
            <Suspense fallback={<LoadingFallback />}>
              <MarkdownActivity activity={activity} />
            </Suspense>
          );
        }
        if (activity.activity_sub_type === 'SUBTYPE_DYNAMIC_EMBED') {
          // Render natively when the embed points at a Nawar exercise (either the
          // "nawar:" token or a plain URL to the exercises app); otherwise iframe.
          const native = parseNativeExercise(activity.content?.embed_url || '');
          if (native) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <NativeExerciseActivity
                  moduleId={native.moduleId}
                  lessonId={native.lessonId}
                  section={native.section}
                  orgslug={orgslug}
                  onComplete={handleNativeComplete}
                  courseLocation={{
                    courseUuid: String(course?.course_uuid || '').replace('course_', ''),
                    activityUuid: String(activityid || '').replace('activity_', ''),
                  }}
                />
              </Suspense>
            );
          }
          // Native "situación real" (video + exercises) → render inline.
          const video = parseNativeVideo(activity.content?.embed_url || '');
          if (video) {
            const situacion = getSituacion(video.situacionId);
            if (situacion) {
              return (
                <Suspense fallback={<LoadingFallback />}>
                  <SituacionViewer
                    situacion={situacion}
                    orgslug={orgslug}
                    inCourse
                    onComplete={handleNativeComplete}
                    titleOverride={activity.content?.video_title}
                    contextOverride={activity.content?.video_desc}
                  />
                </Suspense>
              );
            }
          }
          return (
            <Suspense fallback={<LoadingFallback />}>
              <EmbedActivity activity={activity} />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Canva content={activity.content} activity={activity} hideTableOfContents />
          </Suspense>
        );
      case 'TYPE_VIDEO':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <VideoActivity course={course} activity={activity} onPlay={handleVideoPlay} onProgress={handleVideoProgress} />
          </Suspense>
        );
      case 'TYPE_DOCUMENT':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DocumentPdfActivity course={course} activity={activity} />
          </Suspense>
        );
      case 'TYPE_ASSIGNMENT':
        return assignment ? (
          <Suspense fallback={<LoadingFallback />}>
            {/* AssignmentSubmissionProvider wraps AssignmentProvider (instead
                of being nested inside it) so that BOTH providers mount in the
                same render cycle and kick off their SWR calls in parallel.
                Otherwise AssignmentSubmissionProvider would wait for
                AssignmentProvider's gated load before firing its own
                requests, adding an extra round-trip phase. */}
            <AssignmentSubmissionProvider assignment_uuid={assignment?.assignment_uuid}>
              <AssignmentProvider assignment_uuid={assignment?.assignment_uuid}>
                <AssignmentsTaskProvider>
                  <AssignmentStudentActivity />
                </AssignmentsTaskProvider>
              </AssignmentProvider>
            </AssignmentSubmissionProvider>
          </Suspense>
        ) : null;
      case 'TYPE_SCORM':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ScormActivity course={course} activity={activity} />
          </Suspense>
        );
      default:
        return null;
    }
  }, [activity, course, assignment, orgslug, handleNativeComplete, handleVideoPlay, handleVideoProgress]);

  // Navigate to an activity
  const navigateToActivity = (activity: any) => {
    if (!activity) return;
    
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${activity.cleanUuid}`);
  };

  // El "modo enfoque" antiguo (superposición a pantalla completa) se ha jubilado:
  // ahora "enfocarse" = ocultar la barra lateral del curso desde su propio icono.
  // Forzamos OFF y limpiamos el flag viejo para que nadie quede atrapado en la
  // superposición por un valor antiguo de localStorage.
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsFocusMode(false);
      localStorage.removeItem('globalFocusMode');
    }
  }, []);

  // Save focus mode to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('globalFocusMode', isFocusMode.toString());
      // Dispatch custom event for focus mode change
      window.dispatchEvent(new CustomEvent('focusModeChange', { 
        detail: { isFocusMode } 
      }));
      isInitialRender.current = false;
    }
  }, [isFocusMode]);

  function getChapterNameByActivityId(course: any, activity_id: any) {
    for (let i = 0; i < course.chapters.length; i++) {
      let chapter = course.chapters[i]
      for (let j = 0; j < chapter.activities.length; j++) {
        let activity = chapter.activities[j]
        if (activity.id === activity_id) {
          return `${t('courses.chapter')} ${i + 1} : ${chapter.name}`
        }
      }
    }
    return null // return null if no matching activity is found
  }

  async function getAssignmentUI() {
    const assignment = await getAssignmentFromActivityUUID(activity.activity_uuid, access_token)
    setAssignment(assignment.data)
  }

  useEffect(() => {
    if (!activity) return;
    if (activity.activity_type == 'TYPE_DYNAMIC' || activity.activity_type == 'TYPE_SCORM') {
      setBgColor(isFocusMode ? 'bg-white' : 'bg-white nice-shadow');
    }
    else if (activity.activity_type == 'TYPE_ASSIGNMENT') {
      setMarkStatusButtonActive(false);
      setBgColor(isFocusMode ? 'bg-white' : 'bg-white nice-shadow');
      getAssignmentUI();
    }
    else {
      setBgColor(isFocusMode ? 'bg-zinc-950' : 'bg-zinc-950 nice-shadow');
    }
  }
    , [activity, pathname, isFocusMode])

  if (courseLoading || !course) {
    return (
      <GeneralWrapperStyled>
        <div className="animate-pulse pt-6 space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 pb-1">
            <div className="h-3 bg-gray-200 rounded w-14" />
            <div className="h-3 bg-gray-200 rounded w-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-2" />
            <div className="h-3 bg-gray-200 rounded w-28" />
          </div>
          {/* Course header: thumbnail + name */}
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[34px] sm:w-[100px] sm:h-[57px] bg-gray-200 rounded-md shrink-0" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-10" />
              <div className="h-7 bg-gray-200 rounded w-52" />
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full w-full" />
          {/* Activity title row */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-28" />
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="flex items-center gap-2 pt-0.5">
              <div className="w-6 h-6 bg-gray-200 rounded-full shrink-0" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          </div>
          {/* Content box placeholder */}
          <div className="bg-white nice-shadow rounded-lg p-3 sm:p-7 animate-pulse space-y-4" style={{ minHeight: '420px' }}>
            <div className="h-7 bg-gray-100 rounded w-2/5 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-[92%]" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-[86%]" />
            <div className="h-5 bg-gray-100 rounded w-1/3 mt-6" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-[96%]" />
          </div>
        </div>
      </GeneralWrapperStyled>
    )
  }

  const activityNameFromCourse = allActivities[currentIndex]?.name ?? ''
  const chapterNameFromCourse = allActivities[currentIndex]?.chapterName ?? ''
  const displayName = activity?.name ?? activityNameFromCourse
  const displayActivityType = allActivities[currentIndex]?.activity_type

  if (activity?.is_locked) {
    const isAuthenticated = session?.status === 'authenticated'
    // Drip lock → show when it opens, with a softer "coming soon" tone.
    const dripDate: string | null = activity?.unlock_date || null
    const dripDateLabel = dripDate
      ? (() => {
          const d = new Date(dripDate)
          return isNaN(d.getTime())
            ? ''
            : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        })()
      : ''
    return (
      <GeneralWrapperStyled>
        <div className="max-w-2xl mx-auto my-16 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8 text-center">
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${dripDate ? 'bg-[#F0F5FF]' : 'bg-rose-50'}`}>
            <Lock className={dripDate ? 'text-[#4da3ff]' : 'text-rose-500'} size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {dripDate
              ? 'Este módulo aún no está disponible'
              : t('course.locked_title', 'This activity is locked')}
          </h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {dripDate
              ? (dripDateLabel
                  ? `Se desbloquea el ${dripDateLabel}. ¡Aprovecha para repasar lo anterior mientras tanto!`
                  : 'Se desbloqueará automáticamente más adelante. ¡Sigue con lo que ya tienes disponible!')
              : isAuthenticated
              ? t('course.locked_restricted', 'You need to be a member of the right user group to access this. Ask a course admin to add you.')
              : t('course.locked_auth_required', 'You need to sign in to access this activity.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {!isAuthenticated && (
              <Link
                href={getUriWithOrg(orgslug, '/login')}
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('auth.sign_in', 'Sign in')}
              </Link>
            )}
            <Link
              href={getUriWithOrg(orgslug, '') + `/course/${courseuuid}`}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              {t('course.back_to_course', 'Back to course')}
            </Link>
          </div>
        </div>
      </GeneralWrapperStyled>
    )
  }

  return (
    <>
      <CourseProvider courseuuid={course?.course_uuid} initialCourseStructure={course}>
        <Suspense fallback={<LoadingFallback />}>
          <AIChatBotProvider>
            <Suspense fallback={null}>
              <AISidePanelContentWrapper>
            {isFocusMode ? (
              <AnimatePresence>
                <motion.div
                  initial={isInitialRender.current ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-white"
                  style={{ zIndex: 'var(--z-overlay)' }}
                >
                  {/* Focus Mode Top Bar */}
                  <motion.div 
                    initial={isInitialRender.current ? false : { y: -100 }}
                    animate={{ y: 0 }}
                    exit={{ y: -100 }}
                    transition={{ duration: 0.3 }}
                    className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-gray-100"
                    style={{ zIndex: 'var(--z-modal-content)' }}
                  >
                    <div className="container mx-auto px-4 py-2">
                      <div className="flex items-center justify-between h-14">
                        {/* Progress Indicator - Moved to left */}
                        <motion.div 
                          initial={isInitialRender.current ? false : { opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center space-x-2"
                        >
                          <div className="relative w-8 h-8">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="#e5e7eb"
                                strokeWidth="3"
                                fill="none"
                              />
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="#10b981"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 14}
                                strokeDashoffset={2 * Math.PI * 14 * (1 - (trailData?.runs?.find((run: any) => run.course_uuid === course.course_uuid)?.steps?.filter((step: any) => step.complete)?.length || 0) / (course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 1))}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-800">
                                {Math.round(((trailData?.runs?.find((run: any) => run.course_uuid === course.course_uuid)?.steps?.filter((step: any) => step.complete)?.length || 0) / (course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 1)) * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {trailData?.runs?.find((run: any) => run.course_uuid === course.course_uuid)?.steps?.filter((step: any) => step.complete)?.length || 0} {t('common.of')} {course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 0}
                          </div>
                        </motion.div>
                        
                        {/* Center Course Info */}
                        <motion.div 
                          initial={isInitialRender.current ? false : { opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="flex items-center space-x-4"
                        >
                          <div className="flex">
                            <Link
                              href={getUriWithOrg(orgslug, '') + `/course/${courseuuid}`}
                            >
                              <img
                                className="w-[60px] h-[34px] rounded-md drop-shadow-md"
                                src={course.thumbnail_image
                                  ? getCourseThumbnailMediaDirectory(
                                      org?.org_uuid,
                                      course.course_uuid,
                                      course.thumbnail_image
                                    )
                                  : '/empty_thumbnail.png'
                                }
                                alt=""
                              />
                            </Link>
                          </div>
                          <div className="flex flex-col -space-y-1">
                            <p className="font-bold text-gray-700 text-sm">{t('search.course')} </p>
                            <h1 className="font-bold text-gray-950 text-lg first-letter:uppercase">
                              {course.name}
                            </h1>
                          </div>
                        </motion.div>

                        {/* Minimize and Chapters - Moved to right */}
                        <motion.div
                          initial={isInitialRender.current ? false : { opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center space-x-2"
                        >
                          <ActivityChapterDropdown
                            course={course}
                            currentActivityId={activity ? (activity.activity_uuid ? activity.activity_uuid.replace('activity_', '') : activityid.replace('activity_', '')) : activityid.replace('activity_', '')}
                            orgslug={orgslug}
                            trailData={trailData}
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsFocusMode(false)}
                            className="bg-white nice-shadow p-2 rounded-full cursor-pointer hover:bg-gray-50"
                            title={t('activities.exit_focus_mode')}
                          >
                            <Minimize2 size={16} className="text-gray-700" />
                          </motion.button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Focus Mode Content */}
                  <div className="pt-16 pb-20 h-full overflow-auto">
                    <div className="container mx-auto px-4">
                      {activity && activity.published == true && (
                        <>
                          {activity.content.paid_access == false ? (
                            <PaidCourseActivityDisclaimer course={course} />
                          ) : (
                            <motion.div
                              initial={isInitialRender.current ? false : { scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.3 }}
                              className={`${activity.activity_type === 'TYPE_SCORM' ? 'rounded-xl overflow-hidden' : 'p-7 rounded-lg'} ${bgColor} mt-4`}
                            >
                              {/* Activity Types */}
                              <div className={activity.activity_type === 'TYPE_SCORM' ? 'overflow-hidden' : ''}>
                                {activityContent}
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Focus Mode Bottom Bar */}
                  {activity && activity.published == true && activity.content.paid_access != false && (
                    <motion.div 
                      initial={isInitialRender.current ? false : { y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      transition={{ duration: 0.3 }}
                      className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100"
                      style={{ zIndex: 'var(--z-modal-content)' }}
                    >
                      <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between h-16">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigateToActivity(prevActivity)}
                              className={`flex items-center space-x-1.5 p-2 rounded-md transition-all duration-200 cursor-pointer ${
                                prevActivity
                                  ? 'text-gray-700'
                                  : 'opacity-50 text-gray-400 cursor-not-allowed'
                              }`}
                              disabled={!prevActivity}
                              title={prevActivity ? `${t('common.previous')}: ${prevActivity.name}` : t('activities.no_previous_activity')}
                            >
                              <ChevronLeft size={20} className="text-gray-800 shrink-0" />
                              <div className="flex flex-col items-start">
                                <span className="text-xs text-gray-500">{t('common.previous')}</span>
                                <span className="text-sm capitalize font-semibold text-left">
                                  {prevActivity ? prevActivity.name : t('activities.no_previous_activity')}
                                </span>
                              </div>
                            </button>
                          </div>
                          <div className="flex items-center space-x-2">
                            <ActivityActions
                              activity={activity}
                              activityid={activityid}
                              course={course}
                              orgslug={orgslug}
                              assignment={assignment}
                              showNavigation={false}
                              trailData={trailData}
                            />
                            <button
                              onClick={() => navigateToActivity(nextActivity)}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                                nextActivity
                                  ? 'bg-[#4da3ff] text-[#1D0084] hover:bg-[#6cb5ff] cursor-pointer'
                                  : 'opacity-40 bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                              disabled={!nextActivity}
                              title={nextActivity ? `${t('common.next')}: ${nextActivity.name}` : t('activities.no_next_activity')}
                            >
                              <span>{t('common.next')}</span>
                              <ChevronRight size={18} className="shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              <GeneralWrapperStyled>
                {/* Original non-focus mode UI */}
                {activityid === 'end' ? (
                  <CourseEndView 
                    courseName={course.name}
                    orgslug={orgslug}
                    courseUuid={course.course_uuid}
                    thumbnailImage={course.thumbnail_image}
                    course={course}
                    trailData={trailData}
                  />
                ) : (
                  <div className="space-y-3 pt-0 relative">
                    {/* Barra superior fija (estilo Thinkific): a la izquierda el título de la
                        lección, a la derecha el botón de marcar/desmarcar como completada.
                        Sustituye al antiguo encabezado que repetía el nombre del curso (ese ya
                        aparece en la barra lateral, evitando el título duplicado). */}
                    <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 backdrop-blur-md border-b border-[#DDE6F5]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 lg:[padding-left:var(--course-focus-pad,0px)] transition-[padding] duration-200">
                          {/* Móvil: icono que abre el listado de lecciones a pantalla completa */}
                          <MobileCourseLessons
                            course={course}
                            currentActivityId={activityid}
                            orgslug={orgslug}
                            trailData={trailData}
                          />
                          <h1 className="font-bold text-gray-950 text-base sm:text-lg first-letter:uppercase truncate">
                            {displayName}
                          </h1>
                        </div>
                        {activity && activity.activity_type !== 'TYPE_ASSIGNMENT' && activity.published == true && activity.content.paid_access != false && (
                          <div className="shrink-0">
                            <AuthenticatedClientElement checkMethod="authentication">
                              <MarkStatus
                                activity={activity}
                                activityid={activityid}
                                course={course}
                                orgslug={orgslug}
                                trailData={trailData}
                              />
                            </AuthenticatedClientElement>
                          </div>
                        )}
                      </div>
                    </div>


                      {activityLoading || !activity ? (
                        <ActivityContentSkeleton activityType={displayActivityType} />
                      ) : activity.published == false ? (
                        <div className="p-7 rounded-lg bg-gray-800">
                          <div className="text-white">
                            <h1 className="font-bold text-2xl">
                              {t('activities.not_published_yet')}
                            </h1>
                          </div>
                        </div>
                      ) : activity.published == true ? (
                        <>
                          {activity.content.paid_access == false ? (
                            <PaidCourseActivityDisclaimer course={course} />
                          ) : (
                            <div className="flex justify-center">
                              {/* Columna de contenido contenida y centrada (estilo Thinkific):
                                  no ocupa todo el ancho para que el vídeo/lección no abrume. */}
                              <div className="flex-1 min-w-0 w-full lg:max-w-4xl space-y-4">
                                <div className={`${
                                  activity.activity_type === 'TYPE_SCORM' || activity.activity_type === 'TYPE_VIDEO'
                                    ? 'rounded-2xl overflow-hidden border border-[#DDE6F5]'
                                    : 'p-3 sm:p-7 rounded-2xl border border-[#DDE6F5] bg-white'
                                } relative isolate`} style={{ zIndex: 'var(--z-base)' }}>
                                  {activityContent}
                                </div>
                                {/* Per-lesson description + tasks + Consultas (video lessons) */}
                                {activity.activity_type === 'TYPE_VIDEO' && (
                                  <LessonExtras
                                    activity={activity}
                                    activityid={activityid}
                                    orgslug={orgslug}
                                    canEdit={canEditLesson}
                                  />
                                )}
                                {/* Consultas en el resto de lecciones (flashcards/ejercicios/etc.) — siempre abajo */}
                                {activity.activity_type !== 'TYPE_VIDEO' && (
                                  <ConsultaSearchBar />
                                )}
                              </div>
                              {/* Barra lateral del curso — siempre presente (incluso en ejercicios/embeds);
                                  se puede ocultar desde su propio icono para enfocarse. */}
                              <CourseLessonsSidebar
                                course={course}
                                currentActivityId={activityid}
                                orgslug={orgslug}
                                trailData={trailData}
                              />
                            </div>
                          )}
                        </>
                      ) : null}

                      {/* Sticky action bar — hidden for iframe embeds (their page has its own nav),
                          but shown for native Nawar exercises so course completion + Next work. */}
                      {activity && activity.published == true && activity.content.paid_access != false && (activity.activity_sub_type !== 'SUBTYPE_DYNAMIC_EMBED' || isNativeExercise) && (
                        <div className="sticky bottom-3 sm:bottom-4 mt-4" style={{ zIndex: 'var(--z-interactive)' }}>
                          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#DDE6F5] px-3 sm:px-4 py-2.5">
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0">
                              <div className="order-1 sm:order-none">
                                <PreviousActivityButton
                                  course={course}
                                  currentActivityId={activity.id}
                                  orgslug={orgslug}
                                />
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-2 order-2 sm:order-none">
                                {activity.activity_type === 'TYPE_ASSIGNMENT' && (
                                  <ActivityActions
                                    activity={activity}
                                    activityid={activityid}
                                    course={course}
                                    orgslug={orgslug}
                                    assignment={assignment}
                                    showNavigation={false}
                                    trailData={trailData}
                                  />
                                )}
                                <NextActivityButton
                                  course={course}
                                  currentActivityId={activity.id}
                                  orgslug={orgslug}
                                  canAdvance={canAdvanceCurrent}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ height: '40px' }}></div>
                    </div>
                )}
              </GeneralWrapperStyled>
            )}
              </AISidePanelContentWrapper>
            </Suspense>
          </AIChatBotProvider>
        </Suspense>
      </CourseProvider>
    </>
  )
}

export function MarkStatus(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string,
  trailData: any
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const { isUserPartOfTheOrg } = useOrgMembership();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isLoading, setIsLoading] = React.useState(false);
  const [showMarkedTooltip, setShowMarkedTooltip] = React.useState(false);
  const [showUnmarkedTooltip, setShowUnmarkedTooltip] = React.useState(false);


  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const markedTooltipCount = localStorage.getItem('activity_marked_tooltip_count');
      const unmarkedTooltipCount = localStorage.getItem('activity_unmarked_tooltip_count');
      
      if (!markedTooltipCount || parseInt(markedTooltipCount) < 3) {
        setShowMarkedTooltip(true);
      }
      if (!unmarkedTooltipCount || parseInt(unmarkedTooltipCount) < 3) {
        setShowUnmarkedTooltip(true);
      }
    }
  }, []);

  const handleMarkedTooltipClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activity_marked_tooltip_count', '3');
      setShowMarkedTooltip(false);
    }
  };

  const handleUnmarkedTooltipClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activity_unmarked_tooltip_count', '3');
      setShowUnmarkedTooltip(false);
    }
  };

  const infoIcon = (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );

  const areAllActivitiesCompleted = () => {
    const run = props.trailData?.runs?.find(
      (run: any) => run.course_uuid === props.course.course_uuid
    );
    if (!run) return false;

    let totalActivities = 0;
    let completedActivities = 0;

    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        totalActivities++;
        const isCompleted = run.steps.find(
          (step: any) => step.activity_uuid === activity.activity_uuid && step.complete === true
        );
        if (isCompleted) {
          completedActivities++;
        }
      });
    });

    return completedActivities >= totalActivities - 1;
  };

  const findNextActivity = () => {
    const flat: any[] = [];
    let currentIndex = -1;
    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        flat.push(activity);
        if (activity.id === props.activity.id) {
          currentIndex = flat.length - 1;
        }
      });
    });
    return currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;
  };

  // Marcar como completada SIN navegar: es un toggle in situ (la navegación la
  // gestiona el botón "Siguiente"). Así marcar/desmarcar no te saca de la lección.
  async function markActivityAsCompleteFront() {
    try {
      setIsLoading(true);

      await markActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token
      );

      await queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org?.id) });
      const cleanCourseUuid = props.course.course_uuid.replace('course_', '');
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(cleanCourseUuid) });
    } catch (error) {
      console.error('Error marking activity as complete:', error);
      toast.error(t('activities.failed_mark_complete'));
    } finally {
      setIsLoading(false);
    }
  }

  async function unmarkActivityAsCompleteFront() {
    try {
      setIsLoading(true);
      
      await unmarkActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token
      );

      await queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org?.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(props.course.course_uuid.replace('course_', '')) });
    } catch (error) {
      toast.error(t('activities.failed_unmark_complete'));
    } finally {
      setIsLoading(false);
    }
  }

  const isActivityCompleted = () => {
    // Clean up course UUID by removing 'course_' prefix if it exists
    const cleanCourseUuid = props.course.course_uuid?.replace('course_', '');
    
    let run = props.trailData?.runs?.find(
      (run: any) => {
        const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
        return cleanRunCourseUuid === cleanCourseUuid;
      }
    );

    if (run) {
      // Find the step that matches the current activity
      return run.steps.find(
        (step: any) => step.activity_id === props.activity.id && step.complete === true
      );
    }
    return false;
  }

  // Don't render until we have trail data
  if (!props.trailData) {
    return null;
  }

  // Don't show progress tracking for non-members
  if (!isUserPartOfTheOrg) {
    return null;
  }

  const spinnerIcon = (
    <div className="animate-spin">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    </div>
  );
  const checkIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  return (
    <>
      {isActivityCompleted() ? (
        // Completada → botón fantasma como el de "Anterior": sin fondo verde, solo
        // texto/icono en azul oscuro de marca. Vuelve a hacer clic para desmarcar.
        <button
          type="button"
          onClick={!isLoading ? unmarkActivityAsCompleteFront : undefined}
          disabled={isLoading}
          title={t('activities.unmark_activity')}
          className={`rounded-lg px-3 sm:px-4 py-2.5 flex items-center gap-2 text-[#1D0084] border border-transparent transition-colors ${
            isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#F0F5FF] hover:cursor-pointer'
          }`}
        >
          {isLoading ? spinnerIcon : checkIcon}
          <span className="text-sm font-semibold whitespace-nowrap">{t('common.completed', 'Completada')}</span>
        </button>
      ) : null}
    </>
  )
}

function NextActivityButton({ course, currentActivityId, orgslug, canAdvance = true, lockMessage, isAdmin = false, showWatchedAck = false, onWatchedAck }: { course: any, currentActivityId: string, orgslug: string, canAdvance?: boolean, lockMessage?: string, isAdmin?: boolean, showWatchedAck?: boolean, onWatchedAck?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const queryClient = useQueryClient();
  const [showHint, setShowHint] = useState(false);

  const findNextActivity = () => {
    let allActivities: any[] = [];
    let currentIndex = -1;

    // Flatten all activities from all chapters
    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name
        });
        if (activity.id === currentActivityId) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    return currentIndex < allActivities.length - 1 ? allActivities[currentIndex + 1] : null;
  };

  const nextActivity = findNextActivity();
  const isLast = !nextActivity;

  const goNext = () => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(
      getUriWithOrg(orgslug, '') +
        `/course/${cleanCourseUuid}/activity/${isLast ? 'end' : nextActivity.cleanUuid}`
    );
  };

  // "Siguiente" da la lección por vista: es el gesto natural de terminarla.
  // Antes había que acordarse de pulsar un botón verde aparte, así que el
  // progreso dependía de que el alumno lo recordara. Si falla la llamada no se
  // bloquea la navegación: el progreso es best-effort, avanzar no.
  const markCurrentDone = async () => {
    if (!access_token || !course?.course_uuid) return;
    const current = (course.chapters ?? [])
      .flatMap((c: any) => c.activities ?? [])
      .find((a: any) => a.id === currentActivityId);
    if (!current?.activity_uuid) return;
    try {
      await markActivityAsComplete(orgslug, course.course_uuid, current.activity_uuid, access_token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org?.id) });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.courses.meta(course.course_uuid.replace('course_', '')),
      });
    } catch {
      /* el progreso no puede impedir avanzar */
    }
  };

  const handleClick = () => {
    if (!canAdvance) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 4000);
      return;
    }
    markCurrentDone();
    goNext();
  };

  return (
    <div className="relative w-full sm:w-[230px]">
      {showHint && !canAdvance && (
        <div className="absolute bottom-full right-0 mb-2 w-max max-w-[230px] rounded-lg bg-gray-900 text-white text-[12px] font-medium px-3 py-2 shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <Lock size={13} className="shrink-0" />
          <span>{lockMessage || 'Completa esta actividad antes de continuar.'}</span>
        </div>
      )}
      <div
        onClick={handleClick}
        className={`w-full rounded-lg px-3 sm:px-4 nice-shadow flex flex-col p-2 sm:p-2.5 text-[#1D0084] hover:cursor-pointer transition-colors ${
          canAdvance ? 'bg-[#4da3ff] hover:bg-[#6cb5ff]' : 'bg-[#4da3ff]/45'
        }`}
      >
        <span className="text-[10px] font-bold text-[#1D0084]/60 mb-1 uppercase">
          {isLast ? 'Finalizar' : t('common.next')}
        </span>
        <div className="flex items-center space-x-1 min-w-0">
          <span className="text-xs sm:text-sm font-semibold truncate min-w-0">
            {isLast ? 'Completar curso' : nextActivity.name}
          </span>
          {isLast ? <Trophy size={16} className="shrink-0" /> : <ChevronRight size={17} className="shrink-0" />}
        </div>
      </div>
      {/* Escape para el alumno: "Ya lo he visto" (solo si el reproductor no
          reportó progreso y tras la espera). Requiere su clic. */}
      {showWatchedAck && !canAdvance && (
        <button
          onClick={() => onWatchedAck?.()}
          className="mt-1.5 w-full text-[11px] font-semibold text-[#025dc7] hover:text-[#1D0084] underline underline-offset-2 transition-colors"
        >
          Ya lo he visto
        </button>
      )}
      {/* Solo admin: saltarse el bloqueo de esta actividad al revisar. */}
      {isAdmin && !canAdvance && (
        <button
          onClick={goNext}
          className="mt-1.5 w-full text-[11px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 hover:bg-amber-100 transition-colors"
        >
          Saltar (admin) →
        </button>
      )}
    </div>
  );
}

function PreviousActivityButton({ course, currentActivityId, orgslug }: { course: any, currentActivityId: string, orgslug: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const findPreviousActivity = () => {
    let allActivities: any[] = [];
    let currentIndex = -1;

    // Flatten all activities from all chapters
    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name
        });

        // Check if this is the current activity
        if (activity.id === currentActivityId) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    // Get previous activity
    return currentIndex > 0 ? allActivities[currentIndex - 1] : null;
  };

  const previousActivity = findPreviousActivity();

  if (!previousActivity) return null;

  const navigateToActivity = () => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${previousActivity.cleanUuid}`);
  };

  return (
    <div
      onClick={navigateToActivity}
      className="w-full sm:w-[230px] bg-transparent rounded-lg px-3 sm:px-4 flex flex-col p-2 sm:p-2.5 text-gray-900 hover:cursor-pointer hover:bg-gray-50 transition-colors border border-gray-300"
    >
      <span className="text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('common.previous')}</span>
      <div className="flex items-center space-x-1 min-w-0">
        <ChevronLeft size={17} className="shrink-0" />
        <span className="text-xs sm:text-sm font-semibold truncate min-w-0">{previousActivity.name}</span>
      </div>
    </div>
  );
}

function AssignmentTools(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string
  assignment: any
}) {
  const { t } = useTranslation();
  const submission = useAssignmentSubmission() as any
  const session = useLHSession() as any;
  const queryClient = useQueryClient();
  const [gradeData, setGradeData] = React.useState<any>(null);
  const [isGradeModalOpen, setIsGradeModalOpen] = React.useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  // Ensures the auto-open-on-mount logic only fires once per page view,
  // so the modal doesn't pop back open every time gradeData refreshes.
  const hasAutoOpenedRef = React.useRef(false);

  const submitForGradingUI = async () => {
    if (props.assignment) {
      const res = await submitAssignmentForGrading(
        props.assignment?.assignment_uuid,
        session.data?.tokens?.access_token
      )
      if (res.success) {
        toast.success(t('assignments.assignment_submitted_success'))
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.submission(props.assignment?.assignment_uuid) })
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.taskSubmission(props.assignment?.assignment_uuid) })
      }
      else {
        toast.error(t('assignments.failed_submit_assignment'))
      }
    }
  }

  const [isRetrying, setIsRetrying] = React.useState(false);
  const retrySubmissionUI = async () => {
    if (!props.assignment || isRetrying) return;
    setIsRetrying(true);
    try {
      const res = await retryAssignmentSubmission(
        props.assignment?.assignment_uuid,
        session.data?.tokens?.access_token
      );
      if (res.success) {
        toast.success(t('assignments.retry_assignment_success'));
        // Pull the fresh per-task batch + the user submission so the task
        // editors snap back to an empty state without a hard reload.
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.submission(props.assignment?.assignment_uuid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.taskSubmission(props.assignment?.assignment_uuid) });
        setGradeData(null);
        setIsGradeModalOpen(false);
        // Re-arm the auto-open on this fresh attempt so the next graded
        // result still pops the celebration / detail modal.
        hasAutoOpenedRef.current = false;
      } else {
        toast.error(t('assignments.retry_assignment_failed'));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const getGradingBasedOnMethod = async () => {
    const res = await getFinalGrade(
      session.data?.user?.id,
      props.assignment?.assignment_uuid,
      session.data?.tokens?.access_token
    );
    if (res.success) {
      // The backend returns a rich grade object: display_grade, points_summary,
      // percentage_display, passed, overall_feedback, etc. We just render it —
      // no client-side math.
      setGradeData(res.data);
    }
  };

  useEffect(() => {
    if ( submission && submission.length > 0 && submission[0].submission_status === 'GRADED') {
      getGradingBasedOnMethod();
    }
  }
    , [submission, props.assignment])

  // Auto-open the grade details modal when the student lands on a GRADED
  // assignment that was auto-graded. We only do this once per mount so it
  // doesn't reopen every time SWR re-hydrates the grade data in the
  // background.
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (!gradeData) return;
    if (!submission || submission.length === 0) return;
    if (submission[0].submission_status !== 'GRADED') return;
    if (!props.assignment?.auto_grading) return;
    hasAutoOpenedRef.current = true;
    setIsGradeModalOpen(true);
  }, [gradeData, submission, props.assignment]);

  // No submission yet, OR the row exists in PENDING / NOT_SUBMITTED because
  // the student previously hit "Try again" and the retry endpoint reset the
  // row in place. In both cases the next action is the same: submit for
  // grading. The submit endpoint upserts on PENDING so a fresh submission
  // here reuses the existing row and preserves the attempt counter.
  const isAwaitingSubmission =
    !submission ||
    submission.length === 0 ||
    submission[0].submission_status === 'PENDING' ||
    submission[0].submission_status === 'NOT_SUBMITTED';
  const attemptNumber = submission?.[0]?.attempt_number ?? 1;
  const isRetryAttempt = isAwaitingSubmission && submission?.length > 0 && attemptNumber > 1;

  if (isAwaitingSubmission) {
    return (
      <ConfirmationModal
        confirmationButtonText={t('assignments.submit_assignment')}
        confirmationMessage={t('assignments.submit_assignment_confirm')}
        dialogTitle={t('assignments.submit_assignment_title')}
        dialogTrigger={
          <div className="bg-cyan-800 rounded-md px-4 nice-shadow flex flex-col p-2.5 text-white hover:cursor-pointer transition delay-150 duration-300 ease-in-out">
            <span className="text-[10px] font-bold mb-1 uppercase">
              {isRetryAttempt
                ? t('assignments.attempt_count', { current: attemptNumber })
                : t('common.status')}
            </span>
            <div className="flex items-center space-x-2">
              <BookOpenCheck size={17} />
              <span className="text-xs font-bold">{t('assignments.submit_for_grading')}</span>
            </div>
          </div>
        }
        functionToExecute={submitForGradingUI}
        status="info"
      />
    )
  }

  if (submission[0].submission_status === 'SUBMITTED') {
    return (
      <div className="bg-amber-800 rounded-md px-4 nice-shadow flex flex-col p-2.5 text-white transition delay-150 duration-300 ease-in-out">
        <span className="text-[10px] font-bold mb-1 uppercase">{t('common.status')}</span>
        <div className="flex items-center space-x-2">
          <UserRoundPen size={17} />
          <span className="text-xs font-bold">{t('assignments.grading_in_progress')}</span>
        </div>
      </div>
    )
  }

  if (submission[0].submission_status === 'GRADED') {
    // Fallback string if the server response hasn't hydrated yet or is old.
    const displayGrade = gradeData?.display_grade
      ?? (gradeData ? `${gradeData.grade}/${gradeData.max_grade}` : '...');
    const pointsSummary = gradeData?.points_summary;
    const percentageDisplay = gradeData?.percentage_display;
    const passed = gradeData?.passed;
    const feedback = gradeData?.overall_feedback;
    const tasks = gradeData?.tasks as any[] | undefined;
    const isPassing = passed !== false;
    const pillBg = isPassing ? 'bg-teal-600' : 'bg-rose-600';
    const pillChip = isPassing ? 'bg-white text-teal-800' : 'bg-white text-rose-700';

    // Retry availability mirrors the backend's eligibility check: teacher
    // opted in (allow_retries) and attempt counter hasn't reached the cap
    // (max_retries=0 means unlimited). We compute it client-side too so the
    // "Try again" button is only rendered when it would actually succeed.
    const allowRetries = !!props.assignment?.allow_retries;
    const maxRetries = Number(props.assignment?.max_retries || 0);
    const currentAttempt = Number(submission?.[0]?.attempt_number || 1);
    const attemptsRemaining = maxRetries
      ? Math.max(0, maxRetries - currentAttempt)
      : null;
    const canRetry = allowRetries && (maxRetries === 0 || currentAttempt < maxRetries);

    return (
      <>
        {/* Compact pill — same footprint and alignment as the Next button */}
        <button
          type="button"
          onClick={() => setIsGradeModalOpen(true)}
          className={`${pillBg} rounded-md px-3 sm:px-4 nice-shadow flex flex-col items-start text-left p-2 sm:p-2.5 text-white hover:cursor-pointer transition delay-150 duration-300 ease-in-out`}
        >
          <span className="text-[10px] font-bold mb-1 uppercase text-white/90 flex items-center gap-1.5">
            <span>{t('common.status')}</span>
            {allowRetries && currentAttempt > 1 && (
              <span className="bg-white/20 text-white px-1.5 py-px rounded-full text-[9px] font-bold tracking-normal normal-case">
                {maxRetries
                  ? t('assignments.attempt_count_bounded', {
                      current: currentAttempt,
                      max: maxRetries,
                    })
                  : t('assignments.attempt_count', { current: currentAttempt })}
              </span>
            )}
          </span>
          <div className="flex items-center space-x-1.5">
            <CheckCircle size={15} className="shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{t('assignments.graded')}</span>
            <span className={`${pillChip} px-1.5 py-0.5 rounded-md text-[11px] font-bold`}>
              {displayGrade}
            </span>
            <ChevronRight size={15} className="shrink-0" />
          </div>
        </button>

        {/* Confetti for passing students — fires once each time the modal
            opens because react-confetti with recycle={false} plays through
            and the conditional remount restarts it. */}
        {isGradeModalOpen && isPassing && gradeData && (
          <div className="fixed inset-0 pointer-events-none z-[300]">
            <ReactConfetti
              width={windowWidth}
              height={windowHeight}
              numberOfPieces={220}
              recycle={false}
              gravity={0.18}
              tweenDuration={6000}
              colors={['#10b981', '#14b8a6', '#06b6d4', '#fbbf24', '#f59e0b', '#ec4899']}
            />
          </div>
        )}

        {/* Detail modal — opens on click and auto-opens once when the
            assignment is auto-graded so students see their result right
            away. */}
        <Modal
          isDialogOpen={isGradeModalOpen}
          onOpenChange={(open: boolean) => setIsGradeModalOpen(open)}
          minWidth="sm"
          noPadding
          dialogContent={
            <div className="flex flex-col">
              {/* Hero */}
              <div className={`relative px-6 pt-8 pb-7 overflow-hidden ${
                isPassing
                  ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50'
                  : 'bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50'
              }`}>
                {/* Decorative blobs */}
                <div className={`absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-40 ${
                  isPassing ? 'bg-emerald-300' : 'bg-rose-300'
                }`} />
                <div className={`absolute -bottom-16 -left-12 w-44 h-44 rounded-full blur-3xl opacity-40 ${
                  isPassing ? 'bg-cyan-300' : 'bg-amber-300'
                }`} />

                <div className="relative flex flex-col items-center text-center space-y-3">
                  <div className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center nice-shadow bg-white`}>
                    {isPassing ? (
                      <Trophy size={34} className="text-emerald-600" strokeWidth={2.2} />
                    ) : (
                      <XCircle size={36} className="text-rose-600" strokeWidth={2.2} />
                    )}
                    {isPassing && (
                      <>
                        <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-500 drop-shadow" />
                        <Sparkles size={12} className="absolute -bottom-1 -left-1 text-amber-400 drop-shadow" />
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                      isPassing ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {isPassing
                        ? t('dashboard.assignments.submissions.preview.passing')
                        : t('dashboard.assignments.submissions.preview.not_passing')}
                    </p>
                    <h2 className="text-5xl font-black text-gray-900 tracking-tight leading-none">
                      {displayGrade}
                    </h2>
                    {(pointsSummary || percentageDisplay) && (
                      <p className="text-sm text-gray-500 font-medium pt-1">
                        {[percentageDisplay, pointsSummary].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pt-5 pb-6 space-y-5">
                {tasks && tasks.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {t('assignments.task_breakdown')}
                    </p>
                    <div className="space-y-1.5">
                      {tasks.map((tb: any) => {
                        const pct = Math.max(0, Math.min(100, tb.percentage || 0));
                        const passedTask = tb.submitted && pct >= 60;
                        return (
                          <div
                            key={tb.assignment_task_uuid}
                            className="relative overflow-hidden rounded-lg bg-gray-50 px-3 py-2.5"
                          >
                            {tb.submitted && (
                              <div
                                className={`absolute inset-y-0 left-0 transition-all ${
                                  passedTask ? 'bg-emerald-100/70' : 'bg-rose-100/70'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            )}
                            <div className="relative flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-700 truncate" title={tb.description || `Task ${tb.index}`}>
                                <span className="font-bold text-gray-400 mr-1.5">{tb.index}.</span>
                                {tb.description || `Task ${tb.index}`}
                              </span>
                              <span className={`text-xs font-bold flex-none ${
                                !tb.submitted
                                  ? 'text-gray-400'
                                  : passedTask
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                              }`}>
                                {tb.submitted ? tb.percentage_display : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {feedback && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <MessageSquare size={11} />
                      <span>{t('dashboard.assignments.submissions.feedback.label')}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {feedback}
                      </p>
                    </div>
                  </div>
                )}

                {!tasks?.length && !feedback && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {t('assignments.no_grade_details')}
                  </p>
                )}

                {allowRetries && (
                  <div className="pt-2">
                    {canRetry ? (
                      <div className="rounded-xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-rose-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-white nice-shadow flex items-center justify-center text-fuchsia-600 shrink-0">
                            <RotateCcw size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">
                              {t('assignments.retry_assignment_title')}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 leading-snug">
                              {t('assignments.retry_assignment_confirm')}
                            </p>
                            <p className="text-[11px] text-fuchsia-700 mt-2 font-semibold flex items-center gap-1.5">
                              {maxRetries === 0 ? (
                                <>
                                  <InfinityIcon size={11} />
                                  <span>
                                    {t('assignments.attempt_count', { current: currentAttempt })}
                                  </span>
                                </>
                              ) : attemptsRemaining === 1 ? (
                                <span>{t('assignments.retry_assignment_last')}</span>
                              ) : (
                                <span>
                                  {t('assignments.retry_assignment_remaining', {
                                    remaining: attemptsRemaining,
                                    plural: attemptsRemaining === 1 ? '' : 's',
                                  })}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <ConfirmationModal
                          confirmationButtonText={t('assignments.retry_assignment')}
                          confirmationMessage={t('assignments.retry_assignment_confirm')}
                          dialogTitle={t('assignments.retry_assignment_title')}
                          dialogTrigger={
                            <button
                              type="button"
                              disabled={isRetrying}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                            >
                              <RotateCcw size={14} />
                              {t('assignments.retry_assignment')}
                            </button>
                          }
                          functionToExecute={retrySubmissionUI}
                          status="warning"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center gap-2">
                          <RotateCcw size={14} className="text-gray-400 shrink-0" />
                          <p className="text-xs text-gray-500 font-medium">
                            {t('assignments.retry_no_attempts_left')} ·{' '}
                            {t('assignments.attempt_count_bounded', {
                              current: currentAttempt,
                              max: maxRetries,
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          }
        />
      </>
    )
  }

  // Default return in case none of the conditions are met
  return null
}

export default ActivityClient
