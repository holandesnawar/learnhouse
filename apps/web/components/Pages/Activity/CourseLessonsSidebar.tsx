'use client'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, FileText, Video, StickyNote, Backpack, ListTree, ChevronDown, X, Search, ChevronLeft } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
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

// Desktop: a dedicated, full-height course-player sidebar pinned to the left
// (Thinkific-style). It carries its own "Volver al curso" button, the course
// title + progress, a lesson search, and the modules as collapsible sections.
// The lesson content is pushed right by `lg:pl-[300px]` from the layout (only
// on lesson pages). Mobile keeps the full-screen panel (MobileCourseLessons).
export default function CourseLessonsSidebar(props: CourseLessonsProps) {
  const { course, currentActivityId, orgslug, trailData } = props
  const { run, total, done, pct, cleanCourseUuid } = useProgress(course, trailData)
  const cleanCurrent = currentActivityId?.replace('activity_', '')
  const chapters = course?.chapters ?? []
  const [search, setSearch] = useState('')

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

  const activeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [cleanCurrent])

  if (!course?.chapters) return null

  const courseHref = getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}`
  const q = search.trim().toLowerCase()

  function toggle(i: number) {
    setOpenIdx((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[300px] bg-[#1D0084] text-white z-30">
      {/* Volver al curso */}
      <Link
        href={courseHref}
        className="flex items-center gap-2 px-4 h-14 shrink-0 text-sm font-semibold text-white/85 hover:text-white border-b border-white/10 transition-colors"
      >
        <ChevronLeft size={18} className="shrink-0" />
        Volver al curso
      </Link>

      {/* Título + progreso */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2
          className="text-[15px] font-bold leading-tight line-clamp-2"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {course.name}
        </h2>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span>
            {done} / {total}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4da3ff] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Buscar lección */}
      <div className="px-3 py-2.5 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lección…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder:text-white/40 text-[13px] outline-none border border-transparent focus:bg-white/15 focus:border-[#4da3ff]/40 transition-colors"
          />
        </div>
      </div>

      {/* Módulos */}
      <div className="flex-1 overflow-y-auto pb-6">
        {chapters.map((chapter: any, index: number) => {
          const allActs = chapter.activities ?? []
          const acts = q
            ? allActs.filter((a: any) => (a.name || '').toLowerCase().includes(q))
            : allActs
          if (q && acts.length === 0) return null
          const isOpen = q ? true : openIdx.has(index)
          const doneCount = allActs.filter((a: any) =>
            run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)
          ).length
          return (
            <div key={chapter.id}>
              <button
                onClick={() => !q && toggle(index)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 transition-colors"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold flex items-center justify-center text-white/80">
                  {index + 1}
                </span>
                <span className="flex-1 text-[12px] font-bold uppercase tracking-wide text-white/75 truncate">
                  {chapter.name}
                </span>
                <span className="text-[10px] text-white/45 tabular-nums shrink-0">
                  {doneCount}/{allActs.length}
                </span>
                {!q && (
                  <ChevronDown
                    size={14}
                    className={`text-white/45 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </button>
              {isOpen &&
                acts.map((activity: any) => {
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
                        ref={isCurrent ? activeRef : undefined}
                        className={`group flex items-start gap-2.5 px-4 py-2.5 transition-colors ${
                          isCurrent
                            ? 'bg-white/10 border-l-2 border-[#4da3ff] pl-[14px]'
                            : 'border-l-2 border-transparent hover:bg-white/5'
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isComplete ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check size={12} className="text-white stroke-[3]" />
                            </div>
                          ) : (
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isCurrent ? 'border-[#4da3ff] text-[#4da3ff]' : 'border-white/25 text-white/40'
                              }`}
                            >
                              {getActivityTypeIcon(activity.activity_type)}
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-[13px] leading-snug line-clamp-2 ${
                            isCurrent ? 'font-semibold text-white' : 'text-white/75 group-hover:text-white'
                          }`}
                        >
                          {activity.name}
                        </span>
                      </div>
                    </Link>
                  )
                })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

// Mobile / tablet: a compact trigger that opens the lesson list FULL SCREEN
// with the same dark-blue design as the desktop sidebar.
// Uses createPortal so backdrop-blur on the sticky action bar can't trap it.
export function MobileCourseLessons(props: CourseLessonsProps) {
  const { course, currentActivityId, orgslug, trailData } = props
  const { run, total, done, pct, cleanCourseUuid } = useProgress(course, trailData)
  const cleanCurrent = currentActivityId?.replace('activity_', '')
  const chapters = course?.chapters ?? []
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const activeRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [cleanCurrent])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!course?.chapters) return null

  const courseHref = getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}`
  const q = search.trim().toLowerCase()

  function toggle(i: number) {
    setOpenIdx((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const panel = (
    <div className="fixed inset-0 z-[9999] bg-[#1D0084] text-white flex flex-col">
      {/* Volver al curso + cerrar */}
      <div className="flex items-center shrink-0 border-b border-white/10">
        <Link
          href={courseHref}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-4 h-14 flex-1 text-sm font-semibold text-white/90 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} className="shrink-0" />
          Volver al curso
        </Link>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      {/* Título + progreso */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2
          className="text-[15px] font-bold leading-tight line-clamp-2"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {course.name}
        </h2>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span>{done} / {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4da3ff] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Buscar lección */}
      <div className="px-3 py-2.5 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lección…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder:text-white/40 text-[13px] outline-none border border-transparent focus:bg-white/15 focus:border-[#4da3ff]/40 transition-colors"
          />
        </div>
      </div>

      {/* Módulos — idéntico al desktop sidebar */}
      <div className="flex-1 overflow-y-auto pb-6 overscroll-contain">
        {chapters.map((chapter: any, index: number) => {
          const allActs = chapter.activities ?? []
          const acts = q
            ? allActs.filter((a: any) => (a.name || '').toLowerCase().includes(q))
            : allActs
          if (q && acts.length === 0) return null
          const isOpen = q ? true : openIdx.has(index)
          const doneCount = allActs.filter((a: any) =>
            run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)
          ).length
          return (
            <div key={chapter.id}>
              <button
                onClick={() => !q && toggle(index)}
                className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-white/5 border-b border-white/5 transition-colors"
              >
                <span
                  className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                    index === currentChapterIdx ? 'bg-[#4da3ff] border-[#4da3ff]' : 'border-white/40'
                  }`}
                />
                <span className="flex-1 text-[14px] font-bold uppercase tracking-wide text-white/95 truncate">
                  {chapter.name}
                </span>
                <span className="text-[11px] text-white/55 tabular-nums shrink-0">
                  {doneCount}/{allActs.length}
                </span>
                {!q && (
                  <ChevronDown
                    size={16}
                    className={`text-white/55 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </button>
              {isOpen &&
                acts.map((activity: any) => {
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
                      onClick={() => setOpen(false)}
                    >
                      <div
                        ref={isCurrent ? activeRef : undefined}
                        className={`group flex items-start gap-2.5 px-4 py-2.5 transition-colors ${
                          isCurrent
                            ? 'bg-white/10 border-l-2 border-[#4da3ff] pl-[14px]'
                            : 'border-l-2 border-transparent hover:bg-white/5'
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isComplete ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check size={12} className="text-white stroke-[3]" />
                            </div>
                          ) : (
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isCurrent ? 'border-[#4da3ff] text-[#4da3ff]' : 'border-white/35 text-white/50'
                              }`}
                            >
                              {getActivityTypeIcon(activity.activity_type)}
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-[13.5px] leading-snug line-clamp-2 ${
                            isCurrent ? 'font-semibold text-white' : 'text-white/85 group-hover:text-white'
                          }`}
                        >
                          {activity.name}
                        </span>
                      </div>
                    </Link>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="lg:hidden">
      {/* Trigger — misma barra de progreso, botón Ver lecciones */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white nice-shadow rounded-lg text-left"
      >
        <ListTree size={18} className="text-[#025dc7] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Contenido del curso</span>
            <span className="text-[11px] text-gray-500 ml-2">{done} / {total}</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#025dc7] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#025dc7] uppercase tracking-wide">
          Ver
          <ChevronDown size={14} className="-rotate-90" />
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  )
}
