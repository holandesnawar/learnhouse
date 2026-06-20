'use client'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, FileText, Video, StickyNote, Backpack, ChevronDown, X, Search, ChevronLeft, PanelLeftClose, PanelLeftOpen, Lock, Layers, BookOpen, Headphones, NotebookText, Languages, MessagesSquare, ListChecks } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'

// Format an ISO unlock date for the "Se desbloquea el ..." note (Spanish).
function formatUnlockDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface CourseLessonsProps {
  course: any
  currentActivityId: string
  orgslug: string
  trailData?: any
}

// Icono de la lección según lo que toque, deducido del título (vídeo, flashcards,
// lezen, luisteren, samenvatting, vocabulario, situación…) con fallback al tipo.
// Siempre en azul claro de marca para que el listado quede limpio y profesional.
export function getLessonIcon(name: string, activityType?: string, colorClass = 'text-[#4da3ff]') {
  const n = (name || '').toLowerCase()
  const cls = `shrink-0 ${colorClass}`
  const sz = 18
  if (/v[ií]deo/.test(n)) return <Video size={sz} className={cls} />
  if (/flashcard/.test(n)) return <Layers size={sz} className={cls} />
  if (/lezen|lectura|leer|reading/.test(n)) return <BookOpen size={sz} className={cls} />
  if (/luister|escucha|audio|listening/.test(n)) return <Headphones size={sz} className={cls} />
  if (/samenvatting|resumen|summary/.test(n)) return <NotebookText size={sz} className={cls} />
  if (/woordenschat|vocabular|woorden/.test(n)) return <Languages size={sz} className={cls} />
  if (/situaci|situatie|gesprek|conversa|spreek|real/.test(n)) return <MessagesSquare size={sz} className={cls} />
  if (/ejercicio|oefening|quiz|test|examen/.test(n)) return <ListChecks size={sz} className={cls} />
  switch (activityType) {
    case 'TYPE_VIDEO':
      return <Video size={sz} className={cls} />
    case 'TYPE_DOCUMENT':
      return <FileText size={sz} className={cls} />
    case 'TYPE_ASSIGNMENT':
      return <Backpack size={sz} className={cls} />
    case 'TYPE_DYNAMIC':
      return <StickyNote size={sz} className={cls} />
    default:
      return <FileText size={sz} className={cls} />
  }
}

function isStepComplete(run: any, a: any) {
  return !!run?.steps?.find((s: any) => s.activity_id === a.id && s.complete === true)
}

// Desbloqueo secuencial: una lección se abre solo cuando la ANTERIOR está
// completada. La "Introducción" va siempre abierta y no bloquea lo que sigue.
// Los módulos con goteo (is_locked) cierran el paso a todo lo posterior.
// Una vez completada una lección, queda abierta para siempre (se navega libre
// hacia atrás). Devuelve el conjunto de IDs de actividad accesibles.
function buildUnlockedSet(course: any, run: any): Set<number> {
  const set = new Set<number>()
  let gateOpen = true // la primera lección siempre está abierta
  for (const ch of course?.chapters ?? []) {
    const intro = /introduc/i.test(ch?.name || '')
    const chLocked = !!ch?.is_locked
    for (const a of ch?.activities ?? []) {
      if (chLocked) { gateOpen = false; continue } // goteo: ni esta ni las siguientes
      if (intro) { set.add(a.id); continue }       // intro: abierta, no toca el paso
      if (gateOpen || isStepComplete(run, a)) set.add(a.id)
      if (!isStepComplete(run, a)) gateOpen = false // la 1ª incompleta cierra el resto
    }
  }
  return set
}

// Una fila de lección. Si está desbloqueada (o es la actual) navega; si no,
// al pulsarla muestra un aviso y NO navega (sin candado por lección, solo
// atenuada — los candados se reservan para el goteo de módulos).
function LessonItem({
  activity, href, isCurrent, isComplete, unlocked, hintShown, onLockedClick, onNavigate, activeRef,
}: {
  activity: any; href: string; isCurrent: boolean; isComplete: boolean; unlocked: boolean
  hintShown: boolean; onLockedClick: () => void; onNavigate?: () => void
  activeRef?: React.RefObject<HTMLDivElement | null>
}) {
  const accessible = unlocked || isCurrent
  const inner = (
    <div
      ref={isCurrent ? (activeRef as any) : undefined}
      className={`group flex items-center gap-2.5 px-4 py-2.5 transition-colors ${
        isCurrent
          ? 'bg-white/10 border-l-2 border-[#4da3ff] pl-[14px]'
          : accessible
            ? 'border-l-2 border-transparent hover:bg-white/5'
            : 'border-l-2 border-transparent cursor-default'
      }`}
    >
      {getLessonIcon(activity.name, activity.activity_type, accessible ? 'text-[#4da3ff]' : 'text-white/25')}
      <span
        className={`flex-1 min-w-0 text-[14.5px] leading-snug line-clamp-2 ${
          isCurrent ? 'text-white' : accessible ? 'text-white/85 group-hover:text-white' : 'text-white/35'
        }`}
      >
        {activity.name}
      </span>
      {isComplete && <Check size={16} className="shrink-0 text-emerald-400 stroke-[3]" />}
    </div>
  )
  return (
    <div>
      {accessible ? (
        <Link href={href} prefetch={false} onClick={onNavigate}>{inner}</Link>
      ) : (
        <button type="button" onClick={onLockedClick} className="w-full text-left">{inner}</button>
      )}
      {hintShown && !accessible && (
        <div className="px-4 pb-2 -mt-0.5 flex items-center gap-1.5 text-[11px] text-[#4da3ff]">
          <Lock size={12} className="shrink-0" />
          <span>Debes completar la lección actual antes de continuar.</span>
        </div>
      )}
    </div>
  )
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
  const { run, pct, cleanCourseUuid } = useProgress(course, trailData)
  const cleanCurrent = currentActivityId?.replace('activity_', '')
  const chapters = course?.chapters ?? []
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const unlockedSet = useMemo(() => buildUnlockedSet(course, run), [course, run])
  const [lockedHintId, setLockedHintId] = useState<number | null>(null)
  const flashLockedHint = (id: number) => {
    setLockedHintId(id)
    setTimeout(() => setLockedHintId((c) => (c === id ? null : c)), 4000)
  }

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

  // Focus mode: collapsing hides the sidebar and makes the lesson full-width
  // through the --course-sidebar-w CSS var the layout reads. Remembered across
  // lessons so the student's choice sticks.
  useEffect(() => {
    try {
      if (localStorage.getItem('nawar_course_sidebar_collapsed') === '1') setCollapsed(true)
    } catch {
      /* localStorage unavailable */
    }
  }, [])
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--course-sidebar-w', collapsed ? '0px' : '340px')
    // Hueco que la barra superior de la lección reserva a su izquierda para no
    // quedar tapada por el icono flotante de "salir de modo enfoque".
    root.style.setProperty('--course-focus-pad', collapsed ? '38px' : '0px')
    try {
      localStorage.setItem('nawar_course_sidebar_collapsed', collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
    return () => {
      root.style.removeProperty('--course-sidebar-w')
      root.style.removeProperty('--course-focus-pad')
    }
  }, [collapsed])

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

  // Focus mode ON → only a small floating button to bring the panel back.
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Salir del modo enfoque"
        aria-label="Salir del modo enfoque"
        className="hidden lg:flex fixed left-4 top-4 z-40 items-center justify-center text-[#4da3ff] hover:text-[#6cb5ff] transition-colors"
      >
        <PanelLeftOpen size={22} />
      </button>
    )
  }

  return (
    <aside
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[340px] text-white z-30"
      style={{
        // Mismo fondo exacto que la barra lateral de la plataforma (OrgSidebar).
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
      {/* Volver + botón modo enfoque (a la derecha, misma fila) */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/10">
        <Link
          href={courseHref}
          className="flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} className="shrink-0" />
          Volver
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          title="Modo enfoque"
          aria-label="Modo enfoque"
          className="group shrink-0 -mr-1 h-8 px-1.5 flex items-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="overflow-hidden w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 group-hover:mr-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200">
            Modo enfoque
          </span>
          <PanelLeftClose size={18} className="shrink-0" />
        </button>
      </div>

      {/* Título del curso + progreso (% grande y bold a la izquierda) */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2
          className="text-[14px] font-bold leading-tight line-clamp-2 text-white/90"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {course.name}
        </h2>
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold text-white leading-none">{pct}%</span>
          <span className="text-[11px] text-white/55">completado</span>
        </div>
        <div className="mt-2 h-1.5 bg-white/15 rounded-full overflow-hidden">
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
          const locked = !!chapter.is_locked
          return (
            <div key={chapter.id}>
              <button
                onClick={() => !q && !locked && toggle(index)}
                className={`w-full flex items-center gap-2.5 px-4 py-3.5 text-left border-b border-white/5 transition-colors ${
                  locked ? 'cursor-default' : 'hover:bg-white/5'
                }`}
              >
                {/* Módulo: candado si está bloqueado; círculo (relleno azul en el actual) si no */}
                {locked ? (
                  <Lock size={15} className="shrink-0 text-white/45" />
                ) : (
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                      index === currentChapterIdx
                        ? 'bg-[#4da3ff] border-[#4da3ff]'
                        : 'border-white/40'
                    }`}
                  />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[15px] font-bold uppercase tracking-wide truncate ${locked ? 'text-white/55' : 'text-white'}`}>
                    {chapter.name}
                  </span>
                  {locked && chapter.unlock_date && (
                    <span className="block normal-case font-normal tracking-normal text-[11px] text-[#4da3ff] mt-0.5">
                      Se desbloquea el {formatUnlockDate(chapter.unlock_date)}
                    </span>
                  )}
                </span>
                {!locked && (
                  <>
                    <span className="text-[11px] text-white/55 tabular-nums shrink-0">
                      {doneCount}/{allActs.length}
                    </span>
                    {!q && (
                      <ChevronDown
                        size={16}
                        className={`text-white/55 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </>
                )}
              </button>
              {isOpen && !locked &&
                acts.map((activity: any) => {
                  const cleanUuid = activity.activity_uuid?.replace('activity_', '')
                  const isCurrent = cleanUuid === cleanCurrent
                  const isComplete = !!run?.steps?.find(
                    (s: any) => s.activity_id === activity.id && s.complete === true
                  )
                  return (
                    <LessonItem
                      key={activity.id}
                      activity={activity}
                      href={getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${cleanUuid}`}
                      isCurrent={isCurrent}
                      isComplete={isComplete}
                      unlocked={unlockedSet.has(activity.id)}
                      hintShown={lockedHintId === activity.id}
                      onLockedClick={() => flashLockedHint(activity.id)}
                      activeRef={activeRef}
                    />
                  )
                })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

// Mobile / tablet: tapping the icon opens the lesson list FULL SCREEN with the
// exact same dark-blue design as the desktop sidebar (gradient background, big
// bold %, search, collapsible modules, locks/drip). Rendered via createPortal
// to document.body so the sticky top bar's backdrop-blur can't trap it.
export function MobileCourseLessons(props: CourseLessonsProps) {
  const { course, currentActivityId, orgslug, trailData } = props
  const { run, pct, cleanCourseUuid } = useProgress(course, trailData)
  const cleanCurrent = currentActivityId?.replace('activity_', '')
  const chapters = course?.chapters ?? []
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const activeRef = useRef<HTMLDivElement | null>(null)
  const unlockedSet = useMemo(() => buildUnlockedSet(course, run), [course, run])
  const [lockedHintId, setLockedHintId] = useState<number | null>(null)
  const flashLockedHint = (id: number) => {
    setLockedHintId(id)
    setTimeout(() => setLockedHintId((c) => (c === id ? null : c)), 4000)
  }

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
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    activeRef.current?.scrollIntoView({ block: 'nearest' })
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
    <div
      className="fixed inset-0 z-[9999] text-white flex flex-col"
      style={{
        // Mismo fondo exacto que el sidebar de escritorio.
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
      {/* Volver al curso + cerrar */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/10">
        <Link
          href={courseHref}
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} className="shrink-0" />
          Volver al curso
        </Link>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="-mr-1 w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      {/* Título del curso + progreso (% grande y bold) */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2
          className="text-[14px] font-bold leading-tight line-clamp-2 text-white/90"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {course.name}
        </h2>
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold text-white leading-none">{pct}%</span>
          <span className="text-[11px] text-white/55">completado</span>
        </div>
        <div className="mt-2 h-1.5 bg-white/15 rounded-full overflow-hidden">
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

      {/* Módulos — idéntico al sidebar de escritorio */}
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
          const locked = !!chapter.is_locked
          return (
            <div key={chapter.id}>
              <button
                onClick={() => !q && !locked && toggle(index)}
                className={`w-full flex items-center gap-2.5 px-4 py-3.5 text-left border-b border-white/5 transition-colors ${
                  locked ? 'cursor-default' : 'hover:bg-white/5'
                }`}
              >
                {locked ? (
                  <Lock size={15} className="shrink-0 text-white/45" />
                ) : (
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                      index === currentChapterIdx ? 'bg-[#4da3ff] border-[#4da3ff]' : 'border-white/40'
                    }`}
                  />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[15px] font-bold uppercase tracking-wide truncate ${locked ? 'text-white/55' : 'text-white'}`}>
                    {chapter.name}
                  </span>
                  {locked && chapter.unlock_date && (
                    <span className="block normal-case font-normal tracking-normal text-[11px] text-[#4da3ff] mt-0.5">
                      Se desbloquea el {formatUnlockDate(chapter.unlock_date)}
                    </span>
                  )}
                </span>
                {!locked && (
                  <>
                    <span className="text-[11px] text-white/55 tabular-nums shrink-0">
                      {doneCount}/{allActs.length}
                    </span>
                    {!q && (
                      <ChevronDown
                        size={16}
                        className={`text-white/55 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </>
                )}
              </button>
              {isOpen && !locked &&
                acts.map((activity: any) => {
                  const cleanUuid = activity.activity_uuid?.replace('activity_', '')
                  const isCurrent = cleanUuid === cleanCurrent
                  const isComplete = !!run?.steps?.find(
                    (s: any) => s.activity_id === activity.id && s.complete === true
                  )
                  return (
                    <LessonItem
                      key={activity.id}
                      activity={activity}
                      href={getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${cleanUuid}`}
                      isCurrent={isCurrent}
                      isComplete={isComplete}
                      unlocked={unlockedSet.has(activity.id)}
                      hintShown={lockedHintId === activity.id}
                      onLockedClick={() => flashLockedHint(activity.id)}
                      onNavigate={() => setOpen(false)}
                      activeRef={activeRef}
                    />
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
      {/* Icono: abre el listado de lecciones a pantalla completa */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Elegir lección"
        title="Elegir lección"
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-gray-500 hover:text-[#1D0084] hover:bg-[#F0F5FF] transition-colors"
      >
        <PanelLeftOpen size={20} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  )
}
