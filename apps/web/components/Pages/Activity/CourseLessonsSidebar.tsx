'use client'
import React from 'react'
import Link from 'next/link'
import { Check, FileText, Video, StickyNote, Backpack, ListTree } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { useAIChatBot } from '@components/Contexts/AI/AIChatBotContext'

interface CourseLessonsSidebarProps {
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

export default function CourseLessonsSidebar({
  course,
  currentActivityId,
  orgslug,
  trailData,
}: CourseLessonsSidebarProps) {
  const { t } = useTranslation()
  const aiChatBotState = useAIChatBot() as any

  // The AI side panel lives in this same right column. When it's open we step
  // aside so it gets the full width instead of squeezing two panels together.
  if (aiChatBotState?.isSidePanelOpen) return null
  if (!course?.chapters) return null

  const cleanCourseUuid = course.course_uuid?.replace('course_', '')
  const cleanCurrent = currentActivityId?.replace('activity_', '')

  const run = trailData?.runs?.find((r: any) => {
    const c = r.course?.course_uuid?.replace('course_', '')
    return c === cleanCourseUuid
  })

  let total = 0
  let done = 0
  course.chapters.forEach((ch: any) =>
    ch.activities.forEach((a: any) => {
      total++
      if (run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)) done++
    })
  )
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <aside className="hidden lg:block w-[300px] shrink-0">
      <div className="sticky top-24">
        <div className="bg-white nice-shadow rounded-lg overflow-hidden">
          {/* Header + progress */}
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

          {/* Lessons */}
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto py-1">
            {course.chapters.map((chapter: any, index: number) => (
              <div key={chapter.id} className="mb-1">
                <div className="px-4 py-1.5 flex items-center gap-1.5 bg-gray-50/70 border-y border-gray-100">
                  <div className="bg-gray-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-xs font-semibold text-gray-600 truncate">{chapter.name}</span>
                </div>
                <div className="py-0.5">
                  {chapter.activities.map((activity: any) => {
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
                              <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
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
                              isCurrent
                                ? 'font-semibold text-[#025dc7]'
                                : 'text-gray-700 group-hover:text-gray-900'
                            }`}
                          >
                            {activity.name}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
