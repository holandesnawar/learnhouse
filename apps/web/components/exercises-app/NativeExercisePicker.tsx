'use client'
import { useMemo } from 'react'
import {
  getModules,
  getAllLessonsForModule,
  getLessonSections,
} from '@/lib/exercises-app/courseService'

// The exercise parts a lesson can have. Stored in the token as the 3rd segment.
//
// Los nombres son los que ve el alumno en la escuela, no los internos: la parte
// `vocabulary` se llama "Oefeningen" en pantalla, y llamarla aquí "Vocabulario"
// hacía que se colgara del capítulo una cosa creyendo que era otra.
export const EXERCISE_SECTIONS: { id: string; label: string }[] = [
  { id: 'resumen', label: 'Samenvatting (resumen)' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'vocabulary', label: 'Oefeningen (ejercicios)' },
  { id: 'lezen', label: 'Lezen (lectura)' },
  { id: 'luisteren', label: 'Luisteren (escucha)' },
  { id: 'spreken', label: 'Spreken (qué dices)' },
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
  // Con las extras dentro: tienen contenido y hasta ahora no había forma de
  // colgarlas de un capítulo.
  const lessons = useMemo(() => (moduleId ? getAllLessonsForModule(moduleId) : []), [moduleId])
  // Las partes que esta lección tiene de verdad. Las demás se ofrecen apagadas
  // y con el motivo escrito, en vez de dejar que se cuelgue una clase que el
  // alumno abrirá para encontrarse "esta lección no tiene esa parte todavía".
  const partesQueTiene = useMemo(
    () => new Set(moduleId && lessonId ? getLessonSections(moduleId, lessonId) : []),
    [moduleId, lessonId],
  )

  const selectClass =
    'w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Módulo</label>
        <select
          value={moduleId}
          onChange={(e) => onChange(e.target.value, '', '')}
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
          onChange={(e) => onChange(moduleId, e.target.value, '')}
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
          value={section || ''}
          onChange={(e) => onChange(moduleId, lessonId, e.target.value)}
          disabled={!lessonId}
          className={selectClass}
        >
          <option value="">{lessonId ? 'Elige una parte…' : 'Primero la lección'}</option>
          {EXERCISE_SECTIONS.map((s) => {
            const hay = partesQueTiene.has(s.id)
            return (
              <option key={s.id} value={s.id} disabled={!hay}>
                {s.label}{hay ? '' : ' — esta lección no la tiene'}
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}
