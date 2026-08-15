'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Flame,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Trophy,
  Cloud,
} from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { useStudentInsights } from '@/hooks/queries/useStudentInsights'
import { useCourses, useCourseFull } from '@/hooks/queries/useCourses'
import { useTrail } from '@/hooks/queries/useTrail'
import {
  buildFormacionProgress,
  completedActivityIds,
  findRun,
  isWeeklyClassCourse,
  summarize,
  type ClassRow,
  type ModuleRow,
  type SectionRow,
} from '@/lib/course/formacionProgress'

/* Umbrales: ≥85% dominado · <60% flojo. */
const MASTER = 85
const REVIEW = 60

function pctColor(pct: number): string {
  return pct >= MASTER ? 'text-emerald-600' : pct < REVIEW ? 'text-amber-600' : 'text-[#025dc7]'
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-[#F0F5FF] overflow-hidden">
      <div
        className="h-full bg-[#4da3ff] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function MiProgreso({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const { data: insights, isFetched: insightsFetched } = useStudentInsights()
  const { data: courses } = useCourses(orgslug)
  const { data: trailData } = useTrail(org?.id)

  // La formación: el curso que el alumno tiene empezado; si no, el primero.
  // La clase semanal queda fuera — es otro curso, no el camino A0-A1.
  const courseUuid: string | undefined = useMemo(() => {
    const list: any[] = (Array.isArray(courses) ? courses : []).filter(
      (c: any) => !isWeeklyClassCourse(c?.course_uuid)
    )
    if (!list.length) return undefined
    const started = list.find((c) => findRun(trailData, c.course_uuid))
    return (started ?? list[0])?.course_uuid?.replace('course_', '')
  }, [courses, trailData])

  const { data: course, isFetched: courseFetched } = useCourseFull(courseUuid)

  const modules: ModuleRow[] = useMemo(() => {
    if (!course?.chapters) return []
    const run = findRun(trailData, course.course_uuid || courseUuid || '')
    return buildFormacionProgress(
      course.chapters,
      completedActivityIds(run),
      insights?.attempts ?? {}
    )
  }, [course, trailData, courseUuid, insights])

  const totals = useMemo(() => summarize(modules), [modules])

  // Abierto por defecto: el primer módulo empezado y sin terminar (donde vas).
  const [openModules, setOpenModules] = useState<Set<string> | null>(null)
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set())

  const defaultOpen = useMemo(() => {
    const current = modules.find((m) => m.started && !m.completed) ?? modules[0]
    return new Set(current ? [current.key] : [])
  }, [modules])

  const moduleOpen = openModules ?? defaultOpen

  const toggleModule = (key: string) => {
    const next = new Set(moduleOpen)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpenModules(next)
  }
  const toggleClass = (key: string) => {
    setOpenClasses((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activityHref = (s: SectionRow) =>
    getUriWithOrg(orgslug, '') + `/course/${courseUuid}/activity/${s.activityUuid}`

  // Mientras no haya datos, esqueleto: `isLoading` de react-query es falso
  // durante el render del servidor y volvería a colarse la vista vacía.
  const loading = !insightsFetched || !courseFetched

  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <TrendingUp size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mi progreso</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Tu formación entera: abre un módulo, abre una clase y mira qué hiciste y qué fallaste.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-10 text-center">
          <Sparkles size={28} className="text-[#4da3ff] mx-auto mb-3" />
          <p className="text-[16px] font-bold text-gray-900">Todavía no hay nada que enseñarte</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1 max-w-sm mx-auto">
            Cuando se abra tu primer módulo, aquí verás tu camino completo, clase a clase.
          </p>
          <Link
            href={getUriWithOrg(orgslug, '/')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-bold hover:bg-[#6cb5ff] transition-colors"
          >
            Ir a la formación <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Formación</p>
              <p className="text-[26px] font-bold text-[#025dc7] leading-tight mt-0.5 tabular-nums">
                {totals.pct}
                <span className="text-[15px] text-[#9CA3AF] font-semibold">%</span>
              </p>
              <div className="mt-1.5">
                <Bar done={totals.done} total={totals.total} />
              </div>
              <p className="mt-1 text-[11px] text-[#9CA3AF] font-semibold tabular-nums">
                {totals.done}/{totals.total} clases
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Nota media</p>
              <p className="text-[26px] font-bold text-[#025dc7] leading-tight mt-0.5 tabular-nums">
                {totals.avgPct === null ? '—' : `${totals.avgPct}%`}
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1">
                <Flame size={12} /> Racha
              </p>
              <p className="text-[26px] font-bold text-orange-500 leading-tight mt-0.5 tabular-nums">
                {insights?.progress?.current_streak ?? 0}
                <span className="text-[13px] text-[#9CA3AF] font-semibold">
                  {' '}
                  {insights?.progress?.current_streak === 1 ? 'día' : 'días'}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1">
                <Trophy size={12} /> Por repasar
              </p>
              <p
                className={`text-[26px] font-bold leading-tight mt-0.5 tabular-nums ${
                  totals.fails > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {totals.fails}
                <span className="text-[13px] text-[#9CA3AF] font-semibold"> fallos</span>
              </p>
            </div>
          </div>

          {/* Módulos → clases → secciones */}
          {modules.map((m) => {
            const open = moduleOpen.has(m.key)
            return (
              <div key={m.key} className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
                <button
                  onClick={() => toggleModule(m.key)}
                  className="w-full text-left px-4 sm:px-5 py-4 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors"
                >
                  <ChevronRight
                    size={18}
                    className={`shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] sm:text-[15px] font-bold text-gray-900 truncate">{m.title}</p>
                    <div className="mt-1.5 max-w-xs">
                      <Bar done={m.done} total={m.total} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-semibold text-[#9CA3AF] tabular-nums">
                      {m.done}/{m.total}
                    </p>
                    {m.pct !== null && (
                      <p className={`text-[13px] font-bold tabular-nums ${pctColor(m.pct)}`}>{m.pct}%</p>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-[#DDE6F5] divide-y divide-[#EEF3FB]">
                    {m.classes.map((c: ClassRow) => {
                      const cOpen = openClasses.has(c.key)
                      return (
                        <div key={c.key}>
                          <button
                            onClick={() => toggleClass(c.key)}
                            className="w-full text-left px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors"
                          >
                            {c.completed ? (
                              <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                            ) : (
                              <div
                                className={`w-[17px] h-[17px] rounded-full border-2 shrink-0 ${
                                  c.started ? 'border-[#4da3ff]' : 'border-[#DDE6F5]'
                                }`}
                              />
                            )}
                            <span
                              className={`flex-1 min-w-0 text-[13.5px] font-semibold truncate ${
                                c.started ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {c.title}
                            </span>
                            {c.fails > 0 && (
                              <span className="shrink-0 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                {c.fails} {c.fails === 1 ? 'fallo' : 'fallos'}
                              </span>
                            )}
                            <span className="shrink-0 text-[12px] font-semibold text-[#9CA3AF] tabular-nums">
                              {c.done}/{c.total}
                            </span>
                            <ChevronRight
                              size={15}
                              className={`shrink-0 text-[#C6D2E6] transition-transform ${cOpen ? 'rotate-90' : ''}`}
                            />
                          </button>

                          {cOpen && (
                            <div className="px-4 sm:px-5 pb-3 space-y-1.5 bg-[#FBFDFF]">
                              {c.sections.map((s) => (
                                <div
                                  key={s.activityId}
                                  className="rounded-xl border border-[#E7EEF9] bg-white px-3 py-2.5"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {s.done ? (
                                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                    ) : (
                                      <div className="w-[15px] h-[15px] rounded-full border-2 border-[#DDE6F5] shrink-0" />
                                    )}
                                    <Link
                                      href={activityHref(s)}
                                      className="flex-1 min-w-0 text-[13px] font-semibold text-gray-800 hover:text-[#025dc7] truncate"
                                    >
                                      {s.code && (
                                        <span className="text-[#9CA3AF] font-bold mr-1.5 tabular-nums">
                                          {s.code}
                                        </span>
                                      )}
                                      {s.label}
                                    </Link>
                                    {s.pct !== null && (
                                      <span
                                        className={`shrink-0 text-[12.5px] font-bold tabular-nums ${pctColor(s.pct)}`}
                                      >
                                        {s.score}/{s.total}
                                      </span>
                                    )}
                                  </div>

                                  {s.fails > 0 && (
                                    <div className="mt-2 ml-[25px] flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-[12px] text-amber-700 min-w-0">
                                        Fallaste {s.fails}
                                        {s.failedLabels.length > 0 && (
                                          <span className="text-[#8a6a2a]">
                                            : {s.failedLabels.slice(0, 4).join(', ')}
                                            {s.failedLabels.length > 4 && '…'}
                                          </span>
                                        )}
                                      </p>
                                      <Link
                                        href={activityHref(s)}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-800 text-[12px] font-bold transition-colors"
                                      >
                                        <RotateCcw size={13} /> Repetir práctica
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
            <Cloud size={12} /> Solo se ven los módulos que ya tienes abiertos. Tu progreso se
            guarda en tu cuenta y se actualiza al momento.
          </p>
        </div>
      )}
    </GeneralWrapperStyled>
  )
}
