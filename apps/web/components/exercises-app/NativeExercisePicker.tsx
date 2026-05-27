'use client'
import { useMemo } from 'react'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'

// Two dependent dropdowns (module → lesson) over the local Nawar catalog, used
// by admins to attach a native exercise to an Embed activity. Emits the chosen
// moduleId/lessonId; the caller stores them as `embed_url = "nawar:<m>/<l>"`.
export default function NativeExercisePicker({
  moduleId,
  lessonId,
  onChange,
}: {
  moduleId: string
  lessonId: string
  onChange: (moduleId: string, lessonId: string) => void
}) {
  const modules = useMemo(() => getModules(), [])
  const lessons = useMemo(() => (moduleId ? getLessonsForModule(moduleId) : []), [moduleId])

  const selectClass =
    'w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Módulo</label>
        <select
          value={moduleId}
          onChange={(e) => onChange(e.target.value, '')}
          className={selectClass}
        >
          <option value="">Elige un módulo…</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.emoji ? `${m.emoji} ` : ''}{m.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Lección</label>
        <select
          value={lessonId}
          onChange={(e) => onChange(moduleId, e.target.value)}
          disabled={!moduleId}
          className={selectClass}
        >
          <option value="">{moduleId ? 'Elige una lección…' : 'Primero elige un módulo'}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
