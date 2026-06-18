'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getWeekProgress, type WeekProgress } from '@/lib/exercises/exercises'
import { Dumbbell, ArrowRight, Check, RotateCcw } from 'lucide-react'

export default function ExerciseProgressCard({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const userUuid: string = session?.data?.user?.user_uuid || ''
  const [data, setData] = useState<WeekProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!userUuid) return
    getWeekProgress(userUuid)
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userUuid])

  // Nothing practiced yet → invite to start.
  const practiced = data?.practiced ?? 0

  return (
    <div className="mb-10 bg-white dark:bg-white/5 dark:border dark:border-white/10 nice-shadow rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <Dumbbell size={20} className="text-[#025dc7]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tu práctica esta semana</h2>
            <p className="text-sm text-gray-500 dark:text-white/65">
              {practiced === 0 ? 'Aún no has practicado esta semana.' : `${practiced} palabras practicadas`}
            </p>
          </div>
        </div>
        <Link
          href={getUriWithOrg(orgslug, '/ejercicios')}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-semibold hover:bg-[#6cb5ff]"
        >
          Practicar <ArrowRight size={15} />
        </Link>
      </div>

      {practiced > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <span className="text-sm text-emerald-800">
              <strong>{data?.correct ?? 0}</strong> bien
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
            <RotateCcw size={16} className="text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              <strong>{data?.toReview ?? 0}</strong> para repasar
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
