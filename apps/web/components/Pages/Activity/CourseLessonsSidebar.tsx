'use client'
import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Check, FileText, Video, StickyNote, Backpack, ListTree, ChevronDown } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'

interface CourseLessonsProps {
  course: any
  currentActivityId: string
  orgslug: string
  trailData?: any
}

function getActivityTypeIcon(activityType: string) {
  switch (activityType) {
    case 'TYPE_VIDEO':
      return <Video size={11} />
    case 'TYPE_DOCUMENT':
      return <FileText size={11} />
    case 'TYPE_DYNAMIC':
      return <StickyNote size={11} />
    case 'TYPE_ASSIGNMENT':
      return <Backpack size={11} />
    default:
      return <FileText size={11} />
  }
}

function useProgress(course: any, trailData: any) {
  const cleanCourseUuid = course?.course_uuid?.replace('course_', '')
  const run = trailData?.runs?.find((r: any) => {
    const c = r.course?.course_uuid?.replace('course_', '')
    return c === cleanCourseUuid
  })
  let total = 0
  let done = 0
  course?.chapters?.forEach((ch: any) =>
    (ch?.activities ?? []).forEach((a: any) => {
      total++
      if (run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)) done++
    })
  )
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { run, total, done, pct, cleanCourseUuid }
}

function LessonsList({ course, currentActivityId, orgslug, trailData }: CourseLessonsProps) {
  const { run, cleanCourseUuid } = useProgress(course, trailData)
  const cleanCurrent = currentActivityId?.replace('activity_', '')
  const chapters = course.chapters ?? []

  // The chapter holding the current activity opens by default; the rest start
  // collapsed so the list doesn't force endless scrolling.
  const currentChapterIdx = useMemo(
    () =>
      chapters.findIndex((ch: any) =>
        (ch?.activities ?? []).some(
          (a: any) => a.activity_uuid?.replace('activity_', '') === cleanCurrent
        )
      ),
    [chapters, cleanCurrent]
  )
  const [openIdx, setOpenIdx] = useState<Set<number>>(
    () => new Set([currentChapterIdx >= 0 ? currentChapterIdx : 0])
  )
  useEffect(() => {
    if (currentChapterIdx >= 0) {
      setOpenIdx((prev) => new Set(prev).add(currentChapterIdx))
    }
  }, [currentChapterIdx])

  function toggle(i: number) {
    setOpenIdx((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="py-1">
      {chapters.map((chapter: any, index: number) => {
        const acts = chapter.activities ?? []
        const isOpen = openIdx.has(index)
        const doneCount = acts.filter((a: any) =>
          run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)
        ).length
        return (
        <div key={chapter.id} className="mb-1">
          <button
            onClick={() => toggle(index)}
            className="w-full px-4 py-2 flex items-center gap-1.5 bg-gray-50/70 border-y border-gray-100 text-left hover:bg-gray-100/70 transition-colors"
          >
            <div className="bg-gray-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
              {index + 1}
            </div>
            <span className="text-xs font-semibold text-gray-600 truncate flex-1">{chapter.name}</span>
            <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{doneCount}/{acts.length}</span>
            <ChevronDown
              size={14}
              className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {isOpen && (
          <div className="py-0.5">
            {acts.map((activity: any) => {
              const cleanUuid = activity.activity_uuid?.replace('activity_', '')
              const isCurrent = cleanUuid === cleanCurrent
              const isComplete = run?.steps?.find(
                (s: any) => s.activity_id === activity.id && s.complete === true
              )
              return (
                <Link
                  key={activity.id}
                  href={getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${cleanUuid}`}
                  prefetch={false}
                >
                  <div
                    className={`group flex items-center gap-2.5 px-4 py-2 transition-colors ${
                      isCurrent
                        ? 'bg-[#025dc7]/5 border-l-2 border-[#025dc7] pl-[14px]'
                        : 'border-l-2 border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="shrink-0">
                      {isComplete ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
                          <Check size={12} className="text-white stroke-[3]" />
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isCurrent ? 'border-[#025dc7] text-[#025dc7]' : 'border-gray-200 text-gray-300'
                          }`}
                        >
                          {getActivityTypeIcon(activity.activity_type)}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[13px] leading-snug line-clamp-2 ${
                        isCurrent ? 'font-semibold text-[#025dc7]' : 'text-gray-700 group-hover:text-gray-900'
                      }`}
                    >
                      {activity.name}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

function ProgressHeader({ done, total, pct }: { done: number; total: number; pct: number }) {
  const { t } = useTranslation()
  return (
    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
      <div className="flex items-center gap-2 text-gray-900">
        <ListTree size={16} className="text-[#025dc7]" />
        <h3 className="text-sm font-semibold">{t('courses.course_content')}</h3>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
          <span>
            {done} / {total}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#025dc7] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Desktop: sticky right-hand column
export default function CourseLessonsSidebar(props: CourseLessonsProps) {
  const { course, trailData } = props
  const { total, done, pct } = useProgress(course, trailData)
  if (!course?.chapters) return null

  return (
    <aside className="hidden lg:block w-[300px] shrink-0">
      <div className="sticky top-24">
        <div className="bg-white nice-shadow rounded-lg overflow-hidden">
          <ProgressHeader done={done} total={total} pct={pct} />
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            <LessonsList {...props} />
          </div>
        </div>
      </div>
    </aside>
  )
}

// Mobile / tablet: collapsible accordion shown inline in the content column
export function MobileCourseLessons(props: CourseLessonsProps) {
  const { t } = useTranslation()
  const { course, trailData } = props
  const { total, done, pct } = useProgress(course, trailData)
  const [open, setOpen] = useState(false)
  if (!course?.chapters) return null

  return (
    <div className="lg:hidden bg-white nice-shadow rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <ListTree size={18} className="text-[#025dc7] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{t('courses.course_content')}</h3>
            <span className="text-[11px] text-gray-500 ml-2">
              {done} / {total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#025dc7] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-gray-100 max-h-[60vh] overflow-y-auto">
          <LessonsList {...props} />
        </div>
      )}
    </div>
  )
}
