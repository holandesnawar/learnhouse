'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  TrendingUp,
  Trophy,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Flame,
  Clock3,
  BookOpenCheck,
  Target,
  CheckCircle2,
  Cloud,
} from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'
import { getUriWithOrg } from '@services/config/config'
import { getStudentInsights, formatTime, type StudentInsights } from '@services/student/insights'

/* Umbrales: ≥85% dominado · <60% a repasar · resto en progreso. */
const MASTER = 85
const REVIEW = 60

const SECTION_LABEL: Record<string, string> = {
  vocabulary: 'Vocabulario',
  flashcards: 'Flashcards',
  lezen: 'Lezen',
  luisteren: 'Luisteren',
}

type SectionState = {
  id: string
  label: string
  done: boolean
  /** null cuando el registro no lleva nota (marcadores 0/0). */
  pct: number | null
  score: number
  total: number
}

type LessonRow = {
  lessonId: string
  moduleId: string
  moduleOrder: number
  moduleTitle: string
  title: string
  completed: boolean
  sections: SectionState[]
  /** Media de las secciones con nota (null si ninguna la lleva). */
  pct: number | null
}

function shortTitle(t: string): string {
  return t.replace(/^Les\s*\d+\s*[—-]\s*/i, '').replace(/\s*\|.*$/, '').trim() || t
}

/** Secciones "seguibles" de una lección (las que guardan intento en el servidor). */
function lessonSections(blocks: any[]): string[] {
  const out: string[] = []
  for (const b of blocks) {
    if (b.type === 'vocabulary') out.push('vocabulary', 'flashcards')
    else if (b.type === 'lezen') out.push('lezen')
    else if (b.type === 'dialogue') out.push('luisteren')
  }
  return out
}

export default function MiProgreso({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const [insights, setInsights] = useState<StudentInsights | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let active = true
    getStudentInsights(accessToken).then((d) => {
      if (!active) return
      setInsights(d)
      setLoaded(true)
    })
    return () => { active = false }
  }, [accessToken])

  const rows: LessonRow[] = useMemo(() => {
    if (!insights) return []
    const completedSet = new Set(insights.completions.map((c) => c.lesson_id))
    const out: LessonRow[] = []
    for (const m of getModules()) {
      for (const l of getLessonsForModule(m.id)) {
        const secIds = lessonSections(l.blocks || [])
        const sections: SectionState[] = secIds.map((s) => {
          const a = insights.attempts[`${l.id}-${s}`]
          const scored = Boolean(a && a.total > 0)
          return {
            id: s,
            label: SECTION_LABEL[s] || s,
            done: Boolean(a),
            pct: scored ? Math.round((a!.score / a!.total) * 100) : null,
            score: a?.score ?? 0,
            total: a?.total ?? 0,
          }
        })
        const scored = sections.filter((s) => s.pct !== null)
        const touched = sections.some((s) => s.done) || completedSet.has(l.id)
        if (!touched) continue
        out.push({
          lessonId: l.id,
          moduleId: m.id,
          moduleOrder: m.order,
          moduleTitle: m.title,
          title: l.title,
          completed: completedSet.has(l.id),
          sections,
          pct: scored.length
            ? Math.round(scored.reduce((a, s) => a + (s.pct as number), 0) / scored.length)
            : null,
        })
      }
    }
    return out
  }, [insights])

  const stats = useMemo(() => {
    const scored = rows.filter((r) => r.pct !== null)
    const review = scored.filter((r) => (r.pct as number) < REVIEW).sort((a, b) => (a.pct as number) - (b.pct as number))
    const mastered = scored.filter((r) => (r.pct as number) >= MASTER).sort((a, b) => (b.pct as number) - (a.pct as number))
    let totalLessons = 0
    for (const m of getModules()) totalLessons += getLessonsForModule(m.id).length
    return { review, mastered, totalLessons }
  }, [rows])

  const mods = useMemo(() => {
    const byModule: Record<string, LessonRow[]> = {}
    for (const r of rows) (byModule[r.moduleId] ||= []).push(r)
    return getModules()
      .filter((m) => byModule[m.id]?.length)
      .map((m) => {
        const list = byModule[m.id]
        const scored = list.filter((r) => r.pct !== null)
        return {
          id: m.id,
          order: m.order,
          title: m.title,
          emoji: m.emoji,
          lessons: list,
          totalLessons: getLessonsForModule(m.id).length,
          completed: list.filter((r) => r.completed).length,
          avg: scored.length
            ? Math.round(scored.reduce((a, r) => a + (r.pct as number), 0) / scored.length)
            : null,
        }
      })
  }, [rows])

  const lessonHref = (r: { moduleId: string; lessonId: string }) =>
    getUriWithOrg(orgslug, `/ejercicios/modulo/${r.moduleId}/leccion/${r.lessonId}`)

  const completedCount = insights?.completions.length ?? 0
  const weakWords = insights?.weakWords ?? []

  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <TrendingUp size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mi progreso</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Tu camino completo: lo que has terminado, lo que dominas y lo que te conviene repasar.
      </p>

      {!loaded || !insights ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-10 text-center">
          <Sparkles size={28} className="text-[#4da3ff] mx-auto mb-3" />
          <p className="text-[16px] font-bold text-gray-900">Aún no has hecho ejercicios</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Cuando practiques en Formación, aquí verás tu progreso — desde cualquier dispositivo.</p>
          <Link href={getUriWithOrg(orgslug, '/ejercicios')} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-bold hover:bg-[#6cb5ff] transition-colors">
            Ir a ejercicios <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1"><BookOpenCheck size={12} /> Lecciones</p>
              <p className="text-[26px] font-bold text-[#025dc7] leading-tight mt-0.5 tabular-nums">
                {completedCount}<span className="text-[15px] text-[#9CA3AF] font-semibold"> / {stats.totalLessons}</span>
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
                <span className="text-[13px] text-[#9CA3AF] font-semibold"> días</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1"><Clock3 size={12} /> Tiempo</p>
              <p className="text-[26px] font-bold text-gray-900 leading-tight mt-0.5">
                {formatTime(insights.timeSecondsTotal)}
              </p>
            </div>
          </div>

          {/* Te conviene repasar */}
          {(stats.review.length > 0 || weakWords.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                <p className="text-[14px] font-bold text-gray-900">Te conviene repasar</p>
              </div>

              {weakWords.length > 0 && (
                <div className="mb-3">
                  <p className="text-[12px] text-gray-500 mb-1.5 flex items-center gap-1"><Target size={12} /> Las palabras que más fallas:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {weakWords.slice(0, 10).map((w) => (
                      <span key={w.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-amber-200 text-[12px] font-semibold text-amber-800">
                        {w.label} <span className="text-[10px] text-amber-500">×{w.fails}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {stats.review.length > 0 && (
                <div className="space-y-2">
                  {stats.review.slice(0, 6).map((r) => (
                    <Link key={r.lessonId} href={lessonHref(r)} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-[#DDE6F5] px-4 py-2.5 hover:border-amber-300 transition-colors group">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 truncate">{shortTitle(r.title)}</p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          Módulo {r.moduleOrder}
                          {r.sections.filter((s) => s.pct !== null && s.pct < REVIEW).map((s) => ` · ${s.label} ${s.score}/${s.total}`).join('')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[12px] font-bold text-amber-600 tabular-nums">{r.pct}%</span>
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#025dc7] group-hover:gap-1.5 transition-all">Repasar <ArrowRight size={14} /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mapa por módulos */}
          {mods.map((m) => (
            <div key={m.id} className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[14px] font-bold text-gray-900">
                  {m.emoji} Módulo {m.order} · {m.title}
                </p>
                <p className="text-[12px] font-semibold text-[#9CA3AF] tabular-nums">
                  {m.completed}/{m.totalLessons} lecciones
                  {m.avg !== null && (
                    <span className={`ml-2 font-bold ${m.avg >= MASTER ? 'text-emerald-600' : m.avg < REVIEW ? 'text-amber-600' : 'text-[#025dc7]'}`}>{m.avg}%</span>
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                {m.lessons.map((r) => (
                  <Link key={r.lessonId} href={lessonHref(r)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#F0F5FF] transition-colors group">
                    {r.completed ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#DDE6F5] shrink-0" />
                    )}
                    <p className="flex-1 min-w-0 text-[13.5px] font-semibold text-gray-900 truncate group-hover:text-[#025dc7]">
                      {shortTitle(r.title)}
                    </p>
                    {/* Dots por sección */}
                    <div className="flex items-center gap-1 shrink-0">
                      {r.sections.map((s) => (
                        <div
                          key={s.id}
                          title={`${s.label}${s.pct !== null ? ` · ${s.pct}%` : s.done ? ' · hecha' : ' · pendiente'}`}
                          className={[
                            'w-2 h-2 rounded-full',
                            !s.done
                              ? 'bg-[#DDE6F5]'
                              : s.pct === null
                                ? 'bg-[#4da3ff]'
                                : s.pct >= MASTER
                                  ? 'bg-emerald-500'
                                  : s.pct < REVIEW
                                    ? 'bg-amber-500'
                                    : 'bg-[#4da3ff]',
                          ].join(' ')}
                        />
                      ))}
                    </div>
                    {r.pct !== null && (
                      <span className={`text-[12px] font-bold tabular-nums shrink-0 w-9 text-right ${r.pct >= MASTER ? 'text-emerald-600' : r.pct < REVIEW ? 'text-amber-600' : 'text-[#025dc7]'}`}>
                        {r.pct}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Dominado */}
          {stats.mastered.length > 0 && (
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={18} className="text-emerald-600" />
                <p className="text-[14px] font-bold text-gray-900">Lo que dominas</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.mastered.slice(0, 12).map((r) => (
                  <span key={r.lessonId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[12px] font-semibold text-emerald-700">
                    {shortTitle(r.title)} · {r.pct}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
            <Cloud size={12} /> Tu progreso se guarda en tu cuenta: lo verás igual en cualquier dispositivo.
          </p>
        </div>
      )}
    </GeneralWrapperStyled>
  )
}
