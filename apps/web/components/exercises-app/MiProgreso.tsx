'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, RotateCcw } from 'lucide-react'
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
import { getLesson } from '@/lib/exercises-app/courseService'

/* Umbrales: ≥85% dominado · <60% flojo. */
const MASTER = 85
const REVIEW = 60

/**
 * Color de una nota. Solo dos señales de color —verde para "dominado" y un
 * ámbar apagado para "flojo"—; el resto va en azul de marca. El ámbar
 * saturado de antes, junto al azul, hacía que la pantalla pareciera un
 * cupón de descuento.
 */
function pctColor(pct: number): string {
  return pct >= MASTER ? 'text-emerald-600' : pct < REVIEW ? 'text-[#9A6B1F]' : 'text-[#0b2da0]'
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-[#EEF1F7] overflow-hidden">
      <div
        className="h-full bg-[#0b2da0] rounded-full transition-all duration-500"
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
      (c: any) => !isWeeklyClassCourse(c?.course_uuid, org?.config?.config)
    )
    if (!list.length) return undefined
    const started = list.find((c) => findRun(trailData, c.course_uuid))
    return (started ?? list[0])?.course_uuid?.replace('course_', '')
  }, [courses, trailData, org])

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

  // Abiertos de serie: todos los módulos (08/11, «que salga todo abierto»).
  const [openModules, setOpenModules] = useState<Set<string> | null>(null)
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set())

  const defaultOpen = useMemo(() => {
    return new Set(modules.map((m) => m.key))
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

  // Por dónde seguir: la primera parte sin hacer del módulo en curso.
  const seguir = useMemo(() => {
    const m = modules.find((x) => x.started && !x.completed) ?? modules.find((x) => !x.completed)
    if (!m) return null
    const c = m.classes.find((x) => !x.completed) ?? m.classes[0]
    const sec = c?.sections.find((x) => !x.done) ?? c?.sections[0]
    return c && sec ? { modulo: m, clase: c, seccion: sec } : null
  }, [modules])

  // Lo que más conviene repasar: las partes con fallos, las peores primero.
  const repasar = useMemo(
    () =>
      modules
        .flatMap((m) => m.classes.flatMap((c) => c.sections.filter((x) => x.fails > 0).map((x) => ({ m, c, s: x }))))
        .sort((a, b) => (a.s.pct ?? 100) - (b.s.pct ?? 100) || b.s.fails - a.s.fails)
        .slice(0, 3),
    [modules]
  )

  const racha = insights?.progress?.current_streak ?? 0

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight" style={POPPINS}>
        Mi progreso
      </h1>
      <p className="mt-1 text-[14.5px] text-[#5B6382]">Tu formación, módulo a módulo: lo que llevas hecho y lo que te conviene repasar.</p>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-[170px] rounded-2xl bg-white border border-[#E4E8F2] animate-pulse" />
          <div className="h-[260px] rounded-2xl bg-white border border-[#E4E8F2] animate-pulse" />
        </div>
      ) : modules.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#E4E8F2] bg-white p-10 text-center">
          <p className="text-[16px] font-semibold text-[#0B1033]">Todavía no hay nada que enseñarte</p>
          <p className="text-[13.5px] text-[#6B7393] mt-1 max-w-sm mx-auto">
            Cuando se abra tu primer módulo, aquí verás tu camino completo, clase a clase.
          </p>
          <Link
            href={getUriWithOrg(orgslug, '/')}
            className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690]"
          >
            Ir al inicio <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Dónde vas */}
          <section className="rounded-2xl border border-[#E4E8F2] bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
            <Anillo pct={totals.pct} />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-[#0b2da0] uppercase tracking-[0.08em]">Formación A0-A1</p>
              <p className="mt-1 text-[20px] sm:text-[22px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                {totals.done} de {totals.total} clases hechas
              </p>
              {seguir ? (
                <p className="mt-1 text-[14px] text-[#5B6382] truncate">
                  Vas por <b className="font-semibold text-[#2B3150]">{nombreModulo(seguir.modulo.title)}</b> · {seguir.clase.title}
                </p>
              ) : (
                <p className="mt-1 text-[14px] text-[#13703D] font-medium">Has terminado todo lo que tienes abierto.</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-[#5B6382]">
                <span>
                  Nota media <b className="font-semibold text-[#0B1033] tabular-nums">{totals.avgPct === null ? '—' : `${totals.avgPct}%`}</b>
                </span>
                <span>
                  Racha <b className="font-semibold text-[#0B1033] tabular-nums">{racha} {racha === 1 ? 'día' : 'días'}</b>
                </span>
                <span>
                  Por repasar <b className="font-semibold text-[#0B1033] tabular-nums">{totals.fails > 0 ? `${totals.fails} ${totals.fails === 1 ? 'fallo' : 'fallos'}` : 'nada'}</b>
                </span>
              </div>
            </div>
            {seguir ? (
              <Link
                href={activityHref(seguir.seccion)}
                className="shrink-0 self-start sm:self-center inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690]"
              >
                Seguir <ArrowRight size={16} />
              </Link>
            ) : null}
          </section>

          {/* Te conviene repasar */}
          {repasar.length ? (
            <section>
              <h2 className="text-[17px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
                Te conviene repasar
              </h2>
              <div className="rounded-2xl border border-[#E4E8F2] bg-white divide-y divide-[#EEF1F7]">
                {repasar.map(({ c, s: x }) => (
                  <Link key={x.activityId} href={activityHref(x)} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-[#F7F9FD]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-medium text-[#0B1033] truncate">
                        {c.title} · {x.label}
                      </span>
                      <span className="block text-[12.5px] text-[#8A91AD] truncate">
                        Fallaste {x.fails}
                        {x.failedLabels.length ? `: ${x.failedLabels.slice(0, 4).join(', ')}${x.failedLabels.length > 4 ? '…' : ''}` : ''}
                      </span>
                    </span>
                    {x.pct !== null ? <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${pctColor(x.pct)}`}>{x.score}/{x.total}</span> : null}
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0b2da0]">
                      <RotateCcw size={14} /> Repasar
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Módulos → clases → partes */}
          <section>
            <h2 className="text-[17px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
              Tus módulos
            </h2>
            <div className="rounded-2xl border border-[#E4E8F2] bg-white divide-y divide-[#EEF1F7] overflow-hidden">
              {modules.map((m, i) => {
                const open = moduleOpen.has(m.key)
                const { num, nombre } = partesModulo(m.title)
                return (
                  <div key={m.key}>
                    <button onClick={() => toggleModule(m.key)} className="w-full text-left px-5 py-4 flex items-center gap-3.5">
                      {m.completed ? (
                        <span className="w-7 h-7 rounded-full border-2 border-[#16A34A] text-[#16A34A] flex items-center justify-center shrink-0">
                          <Check size={15} strokeWidth={3.2} />
                        </span>
                      ) : (
                        <span
                          className={`w-7 h-7 rounded-full border-2 grid place-items-center shrink-0 text-[13px] font-bold tabular-nums leading-none ${
                            m.started ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-[#D5DBE8] text-[#8A91AD]'
                          }`}
                        >
                          {/* «text-box» quita el aire de arriba y abajo de la letra: así el número queda en el centro de verdad. */}
                          <span style={{ textBox: 'trim-both cap alphabetic' } as CSSProperties}>{num ?? i}</span>
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold text-[#0B1033] truncate">{nombre}</span>
                        <span className="mt-1.5 flex items-center gap-3">
                          <span className="flex-1 max-w-[260px]">
                            <Bar done={m.done} total={m.total} />
                          </span>
                          <span className="text-[12.5px] text-[#8A91AD] tabular-nums">
                            {m.done} de {m.total}
                          </span>
                        </span>
                      </span>
                      {m.pct !== null ? <span className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${pctColor(m.pct)}`}>{m.pct}%</span> : null}
                      <ChevronDown size={18} className={`shrink-0 text-[#A3AAC2] transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="-mt-1.5 pb-2">
                        {m.classes.map((c: ClassRow) => {
                          const cOpen = openClasses.has(c.key)
                          return (
                            <div key={c.key}>
                              <button onClick={() => toggleClass(c.key)} className="w-full text-left pl-[62px] pr-5 py-2 flex items-center gap-3">
                                <Circulo hecho={c.completed} empezado={c.started} />
                                <span className={`flex-1 min-w-0 text-[14px] font-medium truncate ${c.started ? 'text-[#0B1033]' : 'text-[#8A91AD]'}`}>
                                  {c.title}
                                  {nombreLeccion(c) ? <span className={`font-normal ${c.started ? 'text-[#5B6382]' : 'text-[#A3AAC2]'}`}> · {nombreLeccion(c)}</span> : null}
                                </span>
                                {c.fails > 0 && (
                                  <span className="shrink-0 text-[12px] font-medium text-[#8A6A2A]">
                                    {c.fails} {c.fails === 1 ? 'fallo' : 'fallos'}
                                  </span>
                                )}
                                <span className="shrink-0 text-[12.5px] text-[#8A91AD] tabular-nums">
                                  {c.done}/{c.total}
                                </span>
                                <ChevronDown size={15} className={`shrink-0 text-[#C2C8D8] transition-transform ${cOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {cOpen && (
                                <div className="pl-[92px] pr-5 pb-2">
                                  {c.sections.map((x) => (
                                    <Link key={x.activityId} href={activityHref(x)} className="group flex items-center gap-3 py-1.5">
                                      <Circulo hecho={x.done} pequeno />
                                      <span className="flex-1 min-w-0 text-[13.5px] text-[#2B3150] group-hover:text-[#0b2da0] truncate">
                                        {x.code ? <span className="text-[#8A91AD] mr-1.5 tabular-nums">{x.code}</span> : null}
                                        {x.label}
                                      </span>
                                      {x.pct !== null ? (
                                        <span className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${pctColor(x.pct)}`}>
                                          {x.score}/{x.total}
                                        </span>
                                      ) : null}
                                    </Link>
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
            </div>
            <p className="mt-3 text-[12.5px] text-[#8A91AD]">Solo salen los módulos que ya tienes abiertos.</p>
          </section>
        </div>
      )}
    </div>
  )
}

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

/** «MODULE 1 - Over jou» → número 1 y «Over jou». */
function partesModulo(t: string): { num: number | null; nombre: string } {
  const m = String(t || '').match(/^\s*(?:module|m[oó]dulo)\s*(\d+)\s*[-–:·.]?\s*(.*)$/i)
  const bonito = (x: string) => (x && x === x.toUpperCase() ? x.charAt(0) + x.slice(1).toLowerCase() : x)
  if (!m) return { num: null, nombre: bonito(String(t || '').trim()) }
  return { num: Number(m[1]), nombre: bonito(m[2].trim()) || `Módulo ${m[1]}` }
}

/** «Les 1 — Jezelf voorstellen» → «Jezelf voorstellen»: el nombre de la lección, sacado de la escuela. */
function nombreLeccion(c: ClassRow): string {
  if (!c.leccion) return ''
  const l = getLesson(c.leccion.moduleId, c.leccion.lessonId)
  return l ? String(l.title || '').replace(/^\s*les\s*\d+\s*[-–—:.]\s*/i, '').trim() : ''
}

function nombreModulo(t: string): string {
  const { num, nombre } = partesModulo(t)
  return num ? `Módulo ${num} · ${nombre}` : nombre
}

function Circulo({ hecho, empezado = false, pequeno = false }: { hecho: boolean; empezado?: boolean; pequeno?: boolean }) {
  const t = pequeno ? 'w-[17px] h-[17px]' : 'w-[21px] h-[21px]'
  return hecho ? (
    <span className={`${t} rounded-full border-2 border-[#16A34A] text-[#16A34A] flex items-center justify-center shrink-0`}>
      <Check size={pequeno ? 10 : 12} strokeWidth={3.4} />
    </span>
  ) : (
    <span className={`${t} rounded-full border-2 shrink-0 ${empezado ? 'border-[#0b2da0]' : 'border-[#C9CFDE]'}`} />
  )
}

function Anillo({ pct }: { pct: number }) {
  const r = 42
  const largo = 2 * Math.PI * r
  return (
    <div className="relative w-[104px] h-[104px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF1F7" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#0b2da0" strokeWidth="8" strokeLinecap="round" strokeDasharray={largo} strokeDashoffset={largo * (1 - Math.min(100, Math.max(0, pct)) / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-[#0B1033] tabular-nums" style={POPPINS}>
        {pct}%
      </span>
    </div>
  )
}
