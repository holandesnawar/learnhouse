'use client'

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  getStudentProgress,
  getWeakWords,
  listLessonCompletions,
  type StudentProgress,
  type LessonCompletion,
  type WeakWord,
} from '@services/student/progress'
import { Flame, BookCheck, AlertCircle, Trophy } from 'lucide-react'

interface StatTileProps {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  accent: string
}

function StatTile({ label, value, hint, icon, accent }: StatTileProps) {
  return (
    <div className="bg-white nice-shadow rounded-2xl border border-[#DDE6F5] p-4 flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">{label}</p>
        <p className="text-[20px] font-bold text-gray-900 leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

export default function StudentProgressStats() {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [completions, setCompletions] = useState<LessonCompletion[]>([])
  const [weakWords, setWeakWords] = useState<WeakWord[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let active = true
    Promise.all([
      getStudentProgress(accessToken),
      listLessonCompletions(accessToken),
      getWeakWords(accessToken, 10),
    ]).then(([p, c, w]) => {
      if (!active) return
      setProgress(p)
      setCompletions(c)
      setWeakWords(w)
      setLoaded(true)
    })
    return () => { active = false }
  }, [accessToken])

  if (!loaded) return null

  const streak = progress?.current_streak ?? 0
  const longest = progress?.longest_streak ?? 0
  const completedCount = completions.length

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Tu progreso</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Racha"
          value={streak}
          hint={streak === 1 ? 'día seguido' : 'días seguidos'}
          icon={<Flame size={18} />}
          accent="#EA580C"
        />
        <StatTile
          label="Tu mejor racha"
          value={longest}
          hint={longest === 1 ? 'día' : 'días'}
          icon={<Trophy size={18} />}
          accent="#1D0084"
        />
        <StatTile
          label="Lecciones hechas"
          value={completedCount}
          icon={<BookCheck size={18} />}
          accent="#025dc7"
        />
        <StatTile
          label="Palabras flojas"
          value={weakWords.length}
          hint={weakWords.length > 0 ? 'revisa la lista' : 'aún sin fallos'}
          icon={<AlertCircle size={18} />}
          accent="#4da3ff"
        />
      </div>

      {weakWords.length > 0 && (
        <div className="bg-white nice-shadow rounded-2xl border border-[#DDE6F5] p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[14px] font-bold text-[#1D0084]">Repasa estas palabras</h3>
            <span className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wide">
              Top {weakWords.length}
            </span>
          </div>
          <ul className="space-y-2">
            {weakWords.map((w) => (
              <li key={w.label} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-gray-800 truncate min-w-0">{w.label}</span>
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] text-[#1D0084] font-semibold text-[11px] tabular-nums">
                  {w.fails} {w.fails === 1 ? 'fallo' : 'fallos'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
