'use client'

import React from 'react'
import { Flame } from 'lucide-react'

interface Props {
  current: number
  longest: number
}

/** Discrete streak chip — shows the current consecutive-day count and the
 *  all-time best in a tooltip. Hidden when the streak is 0 to avoid
 *  surfacing an empty signal on first-time students.
 *
 *  Va en azul de marca, no en naranja: el naranja está reservado a las
 *  estrellas/valoraciones, y una pastilla naranja junto al azul Nawar
 *  abarata la pantalla entera. */
export default function StreakBadge({ current, longest }: Props) {
  if (!current || current < 1) return null
  return (
    <div
      title={`Racha actual: ${current} días · Tu mejor racha: ${longest} días`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] dark:bg-white/10 dark:border-white/15"
    >
      <Flame size={13} className="shrink-0 text-[#025dc7] dark:text-[#4da3ff]" />
      <span className="text-[13px] font-semibold tabular-nums text-[#1D0084] dark:text-white">
        {current}
      </span>
      <span className="text-[12px] text-[#5A6480] dark:text-white/70">
        día{current === 1 ? '' : 's'}
      </span>
    </div>
  )
}
