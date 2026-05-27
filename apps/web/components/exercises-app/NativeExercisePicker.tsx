'use client'
import { useMemo } from 'react'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'

// The exercise parts a lesson can have. Stored in the token as the 3rd segment.
export const EXERCISE_SECTIONS: { id: string; label: string }[] = [
  { id: 'vocabulary', label: 'Vocabulario (woordenschat)' },
  { id: 'lezen', label: 'Lezen (lectura)' },
  { id: 'luisteren', label: 'Luisteren (escucha)' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'resumen', label: 'Resumen' },
]

// Three dependent dropdowns (module → lesson → part) over the local Nawar
// catalog, used by admins to attach a single exercise part to an Embed activity.
// Emits moduleId/lessonId/section; the caller stores them as
// `embed_url = "nawar:<m>/<l>/<section>"`.
export default function NativeExercisePicker({
  moduleId,
  lessonId,
  section,
  onChange,
}: {
  moduleId: string
  lessonId: string
  section: string
  onChange: (moduleId: string, lessonId: string, section: string) => void
}) {
  const modules = useMemo(() => getModules(), [])
  const lessons = useMemo(() => (moduleId ? getLessonsForModule(moduleId) : []), [moduleId])

  const selectClass =
    'w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Módulo</label>
        <select
          value={moduleId}
          onChange={(e) => onChange(e.target.value, '', section || 'vocabulary')}
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
          onChange={(e) => onChange(moduleId, e.target.value, section || 'vocabulary')}
          disabled={!moduleId}
          className={selectClass}
        >
          <option value="">{moduleId ? 'Elige una lección…' : 'Primero el módulo'}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Parte</label>
        <select
          value={section || 'vocabulary'}
          onChange={(e) => onChange(moduleId, lessonId, e.target.value)}
          disabled={!lessonId}
          className={selectClass}
        >
          {EXERCISE_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
