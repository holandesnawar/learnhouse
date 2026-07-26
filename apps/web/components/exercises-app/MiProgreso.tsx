'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Loader2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Flame,
  Clock3,
  BookOpenCheck,
  CheckCircle2,
  Cloud,
  RotateCcw,
  Play,
} from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { formatTime } from '@services/student/insights'
import { useStudentInsights } from '@/hooks/queries/useStudentInsights'
import {
  buildProgressMap,
  totalLessonsInCourse,
  type LessonProgressRow,
} from '@/lib/exercises-app/progressMap'

/* Umbrales: ≥85% dominado · <60% flojo. */
const MASTER = 85
const REVIEW = 60

function shortTitle(t: string): string {
  return t.replace(/^Les\s*\d+\s*[—-]\s*/i, '').replace(/\s*\|.*$/, '').trim() || t
}

function pctColor(pct: number): string {
  return pct >= MASTER ? 'text-emerald-600' : pct < REVIEW ? 'text-amber-600' : 'text-[#025dc7]'
}

export default function MiProgreso({ orgslug }: { orgslug: string }) {
  // Caché instantánea + refresco en segundo plano en CADA visita: siempre la
  // última versión de tus notas, sin spinner al navegar.
  const { data: insights, isFetched } = useStudentInsights()
  const loaded = isFetched && Boolean(insights)

  const modules = useMemo(
    () => (insights ? buildProgressMap(insights.attempts, insights.completions) : []),
    [insights]
  )

  const started = modules.some((m) => m.lessons.some((r) => r.started))
  const completedCount = insights?.completions.length ?? 0
  const totalLessons = useMemo(() => totalLessonsInCourse(), [])

  const lessonHref = (r: LessonProgressRow, section?: string, repaso?: boolean) => {
    const base = getUriWithOrg(orgslug, `/ejercicios/modulo/${r.moduleId}/leccion/${r.lessonId}`)
    if (!section) return base
    return `${base}?seccion=${section}${repaso ? '&repaso=1' : ''}`
  }

  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <TrendingUp size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mi progreso</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Tu camino, lección a lección: dónde te quedaste, qué fallaste y un botón para arreglarlo.
      </p>

      {!loaded || !insights ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : !started ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-10 text-center">
          <Sparkles size={28} className="text-[#4da3ff] mx-auto mb-3" />
          <p className="text-[16px] font-bold text-gray-900">Aún no has empezado</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Cuando practiques en Formación, aquí verás tu camino completo — desde cualquier dispositivo.</p>
          <Link href={getUriWithOrg(orgslug, '/ejercicios')} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-bold hover:bg-[#6cb5ff] transition-colors">
            Ir a ejercicios <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumen — datos reales del servidor */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1"><BookOpenCheck size={12} /> Lecciones</p>
              <p className="text-[26px] font-bold text-[#025dc7] leading-tight mt-0.5 tabular-nums">
                {completedCount}<span className="text-[15px] text-[#9CA3AF] font-semibold"> / {totalLessons}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Nota media</p>
              <p className="text-[26px] font-bold text-[#025dc7] leading-tight mt-0.5 tabular-nums">
                {insights.avgPct === null ? '—' : `${insights.avgPct}%`}
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1"><Flame size={12} /> Racha</p>
              <p className="text-[26px] font-bold text-orange-500 leading-tight mt-0.5 tabular-nums">
                {insights.progress?.current_streak ?? 0}
                <span className="text-[13px] text-[#9CA3AF] font-semibold"> {insights.progress?.current_streak === 1 ? 'día' : 'días'}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1"><Clock3 size={12} /> Tiempo</p>
              <p className="text-[26px] font-bold text-gray-900 leading-tight mt-0.5">
                {formatTime(insights.timeSecondsTotal)}
              </p>
            </div>
          </div>

          {/* Mapa por módulos — EL corazón de la página */}
          {modules.filter((m) => m.lessons.some((r) => r.started)).map((m) => (
            <div key={m.id} className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[14px] font-bold text-gray-900">
                  {m.emoji} Módulo {m.order} · {m.title}
                </p>
                <p className="text-[12px] font-semibold text-[#9CA3AF] tabular-nums shrink-0">
                  {m.completed}/{m.totalLessons}
                  {m.avg !== null && (
                    <span className={`ml-2 font-bold ${pctColor(m.avg)}`}>{m.avg}%</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                {m.lessons.map((r) => {
                  const showRepaso = r.totalFails > 0 && r.worstFailing
                  const showContinue = !r.completed && r.started && r.nextSection
                  return (
                    <div
                      key={r.lessonId}
                      className={`rounded-xl border px-3.5 py-2.5 ${
                        r.started ? 'border-[#DDE6F5] bg-white' : 'border-transparent bg-[#F8FAFF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {r.completed ? (
                          <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                        ) : r.started ? (
                          <div className="w-[17px] h-[17px] rounded-full border-2 border-[#4da3ff] shrink-0" />
                        ) : (
                          <div className="w-[17px] h-[17px] rounded-full border-2 border-[#DDE6F5] shrink-0" />
                        )}
                        <Link
                          href={lessonHref(r)}
                          className={`flex-1 min-w-0 text-[13.5px] font-semibold truncate hover:text-[#025dc7] ${
                            r.started ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {shortTitle(r.title)}
                        </Link>
                        {/* Dots por sección */}
                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                          {r.sections.map((s) => (
                            <div
                              key={s.id}
                              title={`${s.label}${s.pct !== null ? ` · ${s.pct}%` : s.done ? ' · hecha' : ' · pendiente'}`}
                              className={[
                                'w-2 h-2 rounded-full',
                                !s.done ? 'bg-[#DDE6F5]'
                                  : s.pct === null ? 'bg-[#4da3ff]'
                                  : s.pct >= MASTER ? 'bg-emerald-500'
                                  : s.pct < REVIEW ? 'bg-amber-500'
                                  : 'bg-[#4da3ff]',
                              ].join(' ')}
                            />
                          ))}
                        </div>
                        {r.pct !== null && (
                          <span className={`text-[12.5px] font-bold tabular-nums shrink-0 w-9 text-right ${pctColor(r.pct)}`}>
                            {r.pct}%
                          </span>
                        )}
                      </div>

                      {/* Estado + acción directa: qué fallaste o dónde te quedaste */}
                      {(showRepaso || showContinue) && (
                        <div className="mt-2 ml-[27px] flex flex-wrap items-center justify-between gap-2">
                          {showRepaso ? (
                            <>
                              <p className="text-[12px] text-amber-700 min-w-0">
                                Fallaste {r.totalFails} {r.totalFails === 1 ? 'ejercicio' : 'ejercicios'}
                                {' '}· {r.sections.filter((s) => s.fails > 0).map((s) => `${s.label} ${s.score}/${s.total}`).join(' · ')}
                              </p>
                              <Link
                                href={lessonHref(r, r.worstFailing!.id, true)}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-800 text-[12px] font-bold transition-colors"
                              >
                                <RotateCcw size={13} /> Repasar fallos
                              </Link>
                            </>
                          ) : (
                            <>
                              <p className="text-[12px] text-[#5A6480] min-w-0">
                                Te quedaste en: <span className="font-semibold text-[#025dc7]">{r.nextSection!.label}</span>
                                {' '}({r.sections.filter((s) => s.done).length}/{r.sections.length} secciones hechas)
                              </p>
                              <Link
                                href={lessonHref(r, r.nextSection!.id)}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF3FF] hover:bg-[#dbeafe] border border-[#BFDBFE] text-[#025dc7] text-[12px] font-bold transition-colors"
                              >
                                <Play size={13} /> Continuar
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Módulos aún sin empezar, plegados en una línea */}
          {modules.filter((m) => !m.lessons.some((r) => r.started)).length > 0 && (
            <div className="rounded-2xl border border-dashed border-[#DDE6F5] bg-white/60 p-4">
              <p className="text-[12px] text-[#9CA3AF]">
                Próximos módulos:{' '}
                {modules
                  .filter((m) => !m.lessons.some((r) => r.started))
                  .map((m) => `${m.emoji} ${m.title}`)
                  .join(' · ')}
              </p>
            </div>
          )}

          <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
            <Cloud size={12} /> Tu progreso se guarda en tu cuenta y se actualiza al momento cuando repasas.
          </p>
        </div>
      )}
    </GeneralWrapperStyled>
  )
}
