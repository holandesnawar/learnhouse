'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, TrendingUp, Trophy, RefreshCw, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'
import { getProgress } from '@/lib/exercises-app/progress'
import { getUriWithOrg } from '@services/config/config'

type Row = {
  lessonId: string
  moduleId: string
  moduleOrder: number
  moduleTitle: string
  title: string
  score: number
  total: number
  pct: number
  status: string
}

type ModAgg = {
  id: string
  order: number
  title: string
  attempted: number
  totalLessons: number
  avg: number
}

// Umbrales: ≥85% dominado · <60% a repasar · resto en progreso.
const MASTER = 85
const REVIEW = 60

export default function MiProgreso({ orgslug }: { orgslug: string }) {
  const [mounted, setMounted] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [mods, setMods] = useState<ModAgg[]>([])

  useEffect(() => {
    const p = getProgress()
    const modules = getModules()
    const rs: Row[] = []
    const ma: ModAgg[] = []
    for (const m of modules) {
      const lessons = getLessonsForModule(m.id)
      const pcts: number[] = []
      let attempted = 0
      for (const l of lessons) {
        const lp = p.lessons[l.id]
        if (!lp || lp.status === 'pending') continue
        const total = lp.total ?? 0
        const score = lp.score ?? 0
        const pct = total > 0 ? Math.round((score / total) * 100) : 0
        rs.push({
          lessonId: l.id, moduleId: m.id, moduleOrder: m.order, moduleTitle: m.title,
          title: l.title, score, total, pct, status: lp.status,
        })
        if (total > 0) { pcts.push(pct); attempted++ }
      }
      if (attempted > 0) {
        ma.push({
          id: m.id, order: m.order, title: m.title,
          attempted, totalLessons: lessons.length,
          avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
        })
      }
    }
    setRows(rs)
    setMods(ma)
    setMounted(true)
  }, [])

  const stats = useMemo(() => {
    const done = rows.filter((r) => r.total > 0)
    const avg = done.length ? Math.round(done.reduce((a, r) => a + r.pct, 0) / done.length) : 0
    const review = done.filter((r) => r.pct < REVIEW).sort((a, b) => a.pct - b.pct)
    const mastered = done.filter((r) => r.pct >= MASTER).sort((a, b) => b.pct - a.pct)
    return { doneCount: done.length, avg, review, mastered }
  }, [rows])

  const moduleHref = (id: string) => getUriWithOrg(orgslug, `/ejercicios/modulo/${id}`)
  const shortTitle = (t: string) => t.replace(/^Les\s*\d+\s*[—-]\s*/i, '').replace(/\s*\|.*$/, '').trim() || t

  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <TrendingUp size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mi progreso</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Mira cómo vas en tus ejercicios: lo que dominas y lo que conviene repasar.
      </p>

      {!mounted ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : stats.doneCount === 0 ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-10 text-center">
          <Sparkles size={28} className="text-[#4da3ff] mx-auto mb-3" />
          <p className="text-[16px] font-bold text-gray-900">Aún no has hecho ejercicios</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Cuando completes lecciones en Formación, aquí verás tu progreso.</p>
          <Link href={getUriWithOrg(orgslug, '/ejercicios')} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-bold hover:bg-[#6cb5ff] transition-colors">
            Ir a ejercicios <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Nota media</p>
              <p className="text-[28px] font-bold text-[#025dc7] leading-tight mt-0.5">{stats.avg}%</p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Dominadas</p>
              <p className="text-[28px] font-bold text-emerald-600 leading-tight mt-0.5">{stats.mastered.length}</p>
            </div>
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Para repasar</p>
              <p className="text-[28px] font-bold text-amber-600 leading-tight mt-0.5">{stats.review.length}</p>
            </div>
          </div>

          {/* Por módulo */}
          <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Por módulo</p>
            <div className="space-y-3">
              {mods.map((m) => (
                <Link key={m.id} href={moduleHref(m.id)} className="block group">
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="font-semibold text-gray-900 group-hover:text-[#025dc7]">Módulo {m.order} · {m.title}</span>
                    <span className={`font-bold tabular-nums ${m.avg >= MASTER ? 'text-emerald-600' : m.avg < REVIEW ? 'text-amber-600' : 'text-[#025dc7]'}`}>{m.avg}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${m.avg >= MASTER ? 'bg-emerald-500' : m.avg < REVIEW ? 'bg-amber-500' : 'bg-[#4da3ff]'}`} style={{ width: `${m.avg}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* A repasar */}
          {stats.review.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                <p className="text-[14px] font-bold text-gray-900">Te conviene repasar</p>
              </div>
              <div className="space-y-2">
                {stats.review.slice(0, 6).map((r) => (
                  <Link key={r.lessonId} href={moduleHref(r.moduleId)} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-[#DDE6F5] px-4 py-2.5 hover:border-amber-300 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{shortTitle(r.title)}</p>
                      <p className="text-[11px] text-[#9CA3AF]">Módulo {r.moduleOrder} · {r.score}/{r.total} aciertos</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] font-bold text-amber-600 tabular-nums">{r.pct}%</span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#025dc7] group-hover:gap-1.5 transition-all">Repasar <ArrowRight size={14} /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

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
            <RefreshCw size={12} /> Tu progreso se guarda en este dispositivo y se actualiza al hacer ejercicios.
          </p>
        </div>
      )}
    </GeneralWrapperStyled>
  )
}
