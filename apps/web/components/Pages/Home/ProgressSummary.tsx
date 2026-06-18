'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { getUriWithOrg } from '@services/config/config'
import { getOverallProgress } from '@/lib/exercises/exercises'
import { TrendingUp, GraduationCap, BookOpenCheck, ArrowRight, User } from 'lucide-react'

// Bloque "Así estás progresando" del Inicio: progreso general (lecciones),
// calificación promedio (ejercicios) y lecciones completadas.
export default function ProgressSummary({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const userUuid: string = session?.data?.user?.user_uuid || ''
  const { data: trailData } = useTrail(org?.id)

  const [ex, setEx] = useState<{ practiced: number; correct: number } | null>(null)
  useEffect(() => {
    if (!userUuid) return
    let active = true
    getOverallProgress(userUuid)
      .then((d) => active && setEx(d))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [userUuid])

  const runs: any[] = Array.isArray(trailData?.runs) ? trailData.runs : []
  let done = 0
  let total = 0
  runs.forEach((r) => {
    total += r?.course_total_steps || 0
    done += Array.isArray(r?.steps) ? r.steps.length : 0
  })
  const generalPct = total > 0 ? Math.round((done / total) * 100) : 0

  const practiced = ex?.practiced ?? 0
  const correct = ex?.correct ?? 0
  const gradePct = practiced > 0 ? Math.round((correct / practiced) * 100) : null

  return (
    <div className="mb-8 bg-white dark:bg-white/5 rounded-2xl border border-[#DDE6F5] dark:border-white/10 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-[#025dc7]" />
          </div>
          <div>
            <h2
              className="text-lg font-bold text-gray-900 dark:text-white leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              Así estás progresando
            </h2>
            <p className="text-sm text-gray-500 dark:text-white/65">Tu avance en la formación de un vistazo.</p>
          </div>
        </div>
        <Link
          href={getUriWithOrg(orgslug, '/account/general')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDE6F5] text-[#025dc7] text-[13px] font-semibold hover:bg-[#F0F5FF] transition-colors"
        >
          <User size={14} />
          <span className="hidden sm:inline">Ver tu perfil completo</span>
          <span className="sm:hidden">Perfil</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Progreso general */}
        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <TrendingUp size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Progreso general</span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[28px] font-bold text-[#1D0084] dark:text-white leading-none">{generalPct}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-[#4da3ff] rounded-full transition-all duration-500" style={{ width: `${generalPct}%` }} />
          </div>
        </div>

        {/* Calificación promedio (ejercicios) */}
        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <GraduationCap size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Calificación promedio</span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[28px] font-bold text-[#1D0084] dark:text-white leading-none">
              {gradePct === null ? '—' : `${gradePct}%`}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-gray-500 dark:text-white/60">
            {gradePct === null ? 'Aún sin ejercicios' : `${correct} de ${practiced} aciertos`}
          </p>
        </div>

        {/* Lecciones completadas */}
        <div className="rounded-xl bg-[#F0F5FF] dark:bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[#025dc7] mb-2">
            <BookOpenCheck size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Lecciones completadas</span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[28px] font-bold text-[#1D0084] dark:text-white leading-none">{done}</span>
            <span className="text-[15px] text-gray-400 dark:text-white/50 mb-0.5">/ {total}</span>
          </div>
          <p className="mt-2 text-[12px] text-gray-500 dark:text-white/60">
            {total > 0 && done >= total ? '¡Formación completada! 🎉' : 'Sigue así, vas muy bien'}
          </p>
        </div>
      </div>
    </div>
  )
}
