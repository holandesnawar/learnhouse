'use client'

import React from 'react'
import { Flame } from 'lucide-react'

interface Props {
  current: number
  longest: number
}

/** Discrete streak chip — shows the current consecutive-day count and the
 *  all-time best in a tooltip. Hidden when the streak is 0 to avoid
 *  surfacing an empty signal on first-time students. */
export default function StreakBadge({ current, longest }: Props) {
  if (!current || current < 1) return null
  return (
    <div
      title={`Racha actual: ${current} días · Tu mejor racha: ${longest} días`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-[#9A3412]"
    >
      <Flame size={14} className="shrink-0" />
      <span className="text-[13px] font-bold tabular-nums">{current}</span>
      <span className="text-[12px] font-semibold">día{current === 1 ? '' : 's'}</span>
    </div>
  )
}
