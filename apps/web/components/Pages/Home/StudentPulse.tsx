'use client'
/**
 * StudentPulse — the progress-aware heart of the student Home:
 *   · WeekStrip     — L→D dots for the days with real activity
 *   · ContinueCard  — where you left off, with per-section progress + next step
 *   · WeekCard      — what you did this week (real server data)
 *   · RepasoCard    — the words you keep failing, one tap away from review
 *   · FormacionCard — overall: % of the formación, nota media, tiempo total
 * All fed by one StudentInsights fetch done in StudentHome.
 */

import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { type StudentInsights, formatTime, startOfWeek } from '@services/student/insights'
import {
  getLesson,
  getNextLesson,
  getModule,
  getModules,
  getLessonsForModule,
} from '@/lib/exercises-app/courseService'
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CalendarCheck2,
  Clock3,
  Dumbbell,
  Flame,
  GraduationCap,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

/* ── helpers ──────────────────────────────────────────────────────────── */

const SECTION_LABEL: Record<string, string> = {
  resumen: 'Resumen',
  vocabulary: 'Vocabulario',
  flashcards: 'Flashcards',
  lezen: 'Lezen',
  luisteren: 'Luisteren',
}

/** Tracked sections of a lesson (the ones that write attempt records). */
function trackedSections(moduleId: string, lessonId: string): string[] {
  const lesson = getLesson(moduleId, lessonId)
  if (!lesson) return []
  const out: string[] = []
  for (const b of lesson.blocks) {
    if (b.type === 'vocabulary') out.push('vocabulary', 'flashcards')
    else if (b.type === 'lezen') out.push('lezen')
    else if (b.type === 'dialogue') out.push('luisteren')
  }
  return out
}

function totalCourseLessons(): number {
  let n = 0
  for (const m of getModules()) n += getLessonsForModule(m.id).length
  return n
}

/* ── WeekStrip — the 7 day dots in the hero ───────────────────────────── */

export function WeekStrip({ activeDays }: { activeDays: string[] }) {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const monday = startOfWeek(new Date())
  const todayIso = new Date().toISOString().slice(0, 10)
  const set = new Set(activeDays)

  return (
    <div className="flex items-center gap-1.5">
      {days.map((label, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const iso = d.toISOString().slice(0, 10)
        const active = set.has(iso)
        const isToday = iso === todayIso
        return (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-gray-400 dark:text-white/40">{label}</span>
            <div
              className={[
                'w-4 h-4 rounded-full transition-colors',
                active ? 'bg-[#4da3ff]' : 'bg-[#DDE6F5] dark:bg-white/15',
                isToday ? 'ring-2 ring-[#4da3ff]/40' : '',
              ].join(' ')}
              title={iso}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── ContinueCard — where you left off, upgraded ──────────────────────── */

export function ContinueCard({
  orgslug,
  insights,
}: {
  orgslug: string
  insights: StudentInsights
}) {
  const pos = (insights.progress?.current_position ?? null) as Record<string, any> | null
  const moduleId: string | undefined = pos?.module_id
  const lessonId: string | undefined = pos?.lesson_id
  if (!moduleId || !lessonId) return null

  const lesson = getLesson(moduleId, lessonId)
  const mod = getModule(moduleId)
  const lessonTitle = lesson?.title || pos?.lesson_title || 'tu última lección'
  const sectionId: string | undefined = pos?.section_id

  const sections = trackedSections(moduleId, lessonId)
  const doneSections = sections.filter((s) => Boolean(insights.attempts[`${lessonId}-${s}`]))
  const allDone = sections.length > 0 && doneSections.length === sections.length

  // When the lesson is finished, the useful CTA is the NEXT lesson of the path.
  const next = allDone ? getNextLesson(moduleId, lessonId) : undefined
  const target = next ?? lesson
  const targetModule = next ? next.moduleId : moduleId
  const href = target
    ? getUriWithOrg(orgslug, `/ejercicios/modulo/${targetModule}/leccion/${target.id}`)
    : getUriWithOrg(orgslug, '/ejercicios')

  const pct = sections.length > 0 ? Math.round((doneSections.length / sections.length) * 100) : 0

  return (
    <Link
      href={href}
      className="block mb-6 group rounded-2xl overflow-hidden nice-shadow border border-[#DDE6F5] dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#4da3ff]/70 transition-colors"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-[#025dc7] uppercase tracking-wider flex items-center gap-1.5">
            <Play size={12} strokeWidth={3} />
            {allDone && next ? 'Tu siguiente paso' : 'Continúa donde lo dejaste'}
          </p>
          {mod && (
            <span className="text-[11px] font-semibold text-gray-400 dark:text-white/50 shrink-0">
              {mod.emoji} {mod.title}
            </span>
          )}
        </div>

        <p
          className="mt-1.5 text-[18px] sm:text-[20px] font-bold text-gray-900 dark:text-white leading-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
        >
          {allDone && next ? next.title : lessonTitle}
        </p>

        {!allDone && sectionId && SECTION_LABEL[sectionId] && (
          <p className="text-[13px] text-[#025dc7] font-semibold mt-0.5">
            Estabas en: {SECTION_LABEL[sectionId]}
          </p>
        )}
        {allDone && next && (
          <p className="text-[13px] text-emerald-600 font-semibold mt-0.5">
            ¡Terminaste “{lessonTitle.replace(/^Les\s*\d+\s*[—-]\s*/i, '')}”! Esta es la siguiente.
          </p>
        )}

        {/* Section progress of the current lesson */}
        {!allDone && sections.length > 0 && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-white/50 mb-1">
              <span>
                {doneSections.length} de {sections.length} secciones hechas
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#F0F5FF] dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[#4da3ff] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Mismo botón de marca que "Continuar donde lo dejaste" en Formación */}
        <div className="mt-4 w-full py-3 px-3 rounded-lg nice-shadow font-semibold text-sm leading-tight text-center transition-colors flex items-center justify-center gap-2 bg-[#4da3ff] text-[#1D0084] group-hover:bg-[#6cb5ff]">
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>{allDone && next ? 'Empezar la siguiente lección' : 'Seguir con la lección'}</span>
        </div>
      </div>
    </Link>
  )
}

/* ── WeekCard — what you did this week ────────────────────────────────── */

export function WeekCard({ insights }: { insights: StudentInsights }) {
  const w = insights.week
  const hasActivity = w.lessonsCompleted > 0 || w.practices > 0

  const delta = w.lessonsCompleted - w.lessonsPrevWeek
  const deltaMsg =
    !hasActivity || w.lessonsPrevWeek === 0
      ? null
      : delta > 0
        ? `¡${delta} ${delta === 1 ? 'lección' : 'lecciones'} más que la semana pasada!`
        : delta === 0
          ? 'Mismo ritmo que la semana pasada. 👌'
          : null // nunca regañamos

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-[#DDE6F5] dark:border-white/10 nice-shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck2 size={18} className="text-[#025dc7]" />
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Esta semana</h2>
      </div>

      {!hasActivity ? (
        <p className="text-[13px] text-gray-500 dark:text-white/60 leading-relaxed">
          Todavía no has practicado esta semana. Un ratito hoy y tu racha sigue viva. 🔥
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 px-3 py-2.5">
              <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-none tabular-nums">
                {w.lessonsCompleted}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-white/60 mt-1">
                {w.lessonsCompleted === 1 ? 'lección terminada' : 'lecciones terminadas'}
              </p>
            </div>
            <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 px-3 py-2.5">
              <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-none tabular-nums">
                {w.practices}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-white/60 mt-1">
                {w.practices === 1 ? 'práctica hecha' : 'prácticas hechas'}
              </p>
            </div>
            <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 px-3 py-2.5">
              <p className="text-[20px] font-bold text-emerald-600 leading-none tabular-nums">
                {w.correctPct === null ? '—' : `${w.correctPct}%`}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-white/60 mt-1">de aciertos</p>
            </div>
            <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 px-3 py-2.5">
              <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-none tabular-nums">
                {w.activeDays.length}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-white/60 mt-1">
                {w.activeDays.length === 1 ? 'día activo' : 'días activos'}
              </p>
            </div>
          </div>
          {w.timeSeconds > 0 && (
            <p className="mt-3 text-[12px] text-gray-500 dark:text-white/60 flex items-center gap-1.5">
              <Clock3 size={13} className="text-[#025dc7]" />
              {formatTime(w.timeSeconds)} de neerlandés esta semana
            </p>
          )}
          {deltaMsg && (
            <p className="mt-2 text-[12px] font-semibold text-emerald-600 flex items-center gap-1.5">
              <TrendingUp size={13} /> {deltaMsg}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* ── RepasoCard — the words you keep failing ──────────────────────────── */

export function RepasoCard({
  orgslug,
  insights,
}: {
  orgslug: string
  insights: StudentInsights
}) {
  const words = insights.weakWords.slice(0, 6)

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-[#DDE6F5] dark:border-white/10 nice-shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target size={18} className="text-[#025dc7]" />
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Tu repaso de hoy</h2>
      </div>

      {words.length === 0 ? (
        <p className="text-[13px] text-gray-500 dark:text-white/60 leading-relaxed">
          <Sparkles size={13} className="inline mr-1 text-[#4da3ff]" />
          Sin palabras pendientes de repaso. Cuando falles alguna en los ejercicios, aparecerá aquí.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-gray-500 dark:text-white/60 mb-2.5">
            Las palabras que más se te resisten:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {words.map((w) => (
              <span
                key={w.label}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[12px] font-semibold text-amber-800 dark:text-amber-300"
              >
                {w.label}
                <span className="text-[10px] text-amber-500">×{w.fails}</span>
              </span>
            ))}
          </div>
          <Link
            href={getUriWithOrg(orgslug, '/ejercicios/progreso')}
            className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#025dc7] hover:text-[#1D0084] transition-colors"
          >
            <RotateCcw size={14} /> Ver qué lecciones repasar <ArrowRight size={14} />
          </Link>
        </>
      )}
    </div>
  )
}

/* ── FormacionCard — overall progress, real numbers ───────────────────── */

export function FormacionCard({
  orgslug,
  insights,
}: {
  orgslug: string
  insights: StudentInsights
}) {
  const total = totalCourseLessons()
  const done = insights.completions.length
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const streak = insights.progress?.current_streak ?? 0

  return (
    <div className="mb-8 bg-white dark:bg-white/5 rounded-2xl border border-[#DDE6F5] dark:border-white/10 nice-shadow p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <TrendingUp size={22} className="text-[#025dc7]" />
        <h2
          className="text-lg font-bold text-gray-900 dark:text-white leading-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
        >
          Así estás progresando
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <BookOpenCheck size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Formación</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-none">
            {pct}%
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#4da3ff] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/60">
            {done} de {total} lecciones
          </p>
        </div>

        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <GraduationCap size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Nota media</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-none">
            {insights.avgPct === null ? '—' : `${insights.avgPct}%`}
          </p>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/60">
            {insights.avgPct === null ? 'Aún sin ejercicios' : 'de aciertos en tus ejercicios'}
          </p>
        </div>

        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <Flame size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Racha</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-none">
            {streak}
          </p>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/60">
            {streak === 1 ? 'día seguido' : 'días seguidos'}
          </p>
        </div>

        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <Clock3 size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Tiempo total</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-none">
            {formatTime(insights.timeSecondsTotal)}
          </p>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/60">de estudio registrado</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={getUriWithOrg(orgslug, '/ejercicios/progreso')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDE6F5] dark:border-white/15 text-[#025dc7] text-[13px] font-semibold hover:bg-[#F0F5FF] dark:hover:bg-white/10 transition-colors"
        >
          <Dumbbell size={14} /> Ver mi progreso completo <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
