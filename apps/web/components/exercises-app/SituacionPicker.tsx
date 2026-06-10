'use client'
import { useMemo } from 'react'
import { getSituaciones, CATEGORY_META } from '@/lib/exercises-app/situaciones'

// Single dropdown over the local "situaciones reales" catalog. Used by admins to
// attach a video+exercises situación to an Embed activity. Emits the situación id;
// the caller stores it as  embed_url = "nawar-video:<id>".
export default function SituacionPicker({
  situacionId,
  onChange,
}: {
  situacionId: string
  onChange: (situacionId: string) => void
}) {
  const situaciones = useMemo(() => getSituaciones(), [])

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">Situación (vídeo + ejercicios)</label>
      <select
        value={situacionId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
      >
        <option value="">Elige una situación…</option>
        {situaciones.map((s) => (
          <option key={s.id} value={s.id}>
            {CATEGORY_META[s.category].emoji} {s.title} ({s.level})
          </option>
        ))}
      </select>
    </div>
  )
}
