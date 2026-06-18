'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getStudentProgress } from '@services/student/progress'
import { getUriWithOrg } from '@services/config/config'
import { ArrowRight, Dumbbell } from 'lucide-react'

interface Props {
  orgslug: string
}

const SECTION_LABEL: Record<string, string> = {
  vocabulary: 'Vocabulario',
  flashcards: 'Flashcards',
  lezen: 'Lezen',
  luisteren: 'Luisteren',
  resumen: 'Resumen',
}

/** "Sigue donde lo dejaste" — lands on the last ejercicios lesson (and section)
 *  the student was browsing. Hidden when there's no position stored. */
export default function ContinueWhereLeftOff({ orgslug }: Props) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const [position, setPosition] = useState<Record<string, any> | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      setLoaded(true)
      return
    }
    let active = true
    getStudentProgress(accessToken).then((p) => {
      if (!active) return
      const pos = (p?.current_position ?? null) as Record<string, any> | null
      setPosition(pos && pos.lesson_id ? pos : null)
      setLoaded(true)
    })
    return () => { active = false }
  }, [accessToken])

  if (!loaded || !position) return null

  const moduleId = position.module_id as string | undefined
  const lessonId = position.lesson_id as string | undefined
  const lessonTitle = (position.lesson_title as string | undefined) || 'tu última lección'
  const sectionId = position.section_id as string | undefined
  if (!moduleId || !lessonId) return null

  const href = getUriWithOrg(orgslug, `/ejercicios/modulo/${moduleId}/leccion/${lessonId}`)
  const sectionLabel = sectionId ? SECTION_LABEL[sectionId] : null

  return (
    <Link
      href={href}
      className="block mb-6 group rounded-2xl bg-white dark:bg-white/5 nice-shadow border border-[#DDE6F5] dark:border-white/10 hover:border-[#4da3ff]/60 transition-colors overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-10 h-10 rounded-xl text-[#1D0084] flex items-center justify-center shrink-0">
          <Dumbbell size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[#9CA3AF] dark:text-white/55 uppercase tracking-wide">Continúa donde lo dejaste</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight truncate">
            {lessonTitle}
          </p>
          {sectionLabel && (
            <p className="text-[12px] text-[#025dc7] font-semibold mt-0.5">{sectionLabel}</p>
          )}
        </div>
        <ArrowRight
          size={18}
          className="text-[#9CA3AF] group-hover:text-[#1D0084] group-hover:translate-x-0.5 transition-all shrink-0"
        />
      </div>
    </Link>
  )
}
