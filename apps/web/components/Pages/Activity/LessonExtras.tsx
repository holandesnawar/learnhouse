'use client'
import React, { useState } from 'react'
import { Pencil, Plus, X, Check, Loader2 } from 'lucide-react'
import { updateActivity } from '@services/courses/activities'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import toast from 'react-hot-toast'
import ConsultaSearchBar from './ConsultaSearchBar'

interface LessonExtrasProps {
  activity: any
  activityid: string
  orgslug: string
  canEdit: boolean
}

// Per-lesson description + tasks shown below the lesson content, editable by
// course admins. Stored inside the activity's content JSON (no schema change).
export default function LessonExtras({ activity, activityid, orgslug, canEdit }: LessonExtrasProps) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const initialDescription: string = activity?.content?.description ?? ''
  const initialTasks: string[] = Array.isArray(activity?.content?.tasks) ? activity.content.tasks : []

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState(initialDescription)
  const [tasks, setTasks] = useState<string[]>(initialTasks)

  const hasContent = initialDescription.trim().length > 0 || initialTasks.length > 0

  const save = async () => {
    setSaving(true)
    try {
      const cleanTasks = tasks.map((t) => t.trim()).filter(Boolean)
      await updateActivity(
        { content: { ...activity.content, description: description.trim(), tasks: cleanTasks } },
        activity.activity_uuid,
        accessToken
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.activity.detail(activityid) })
      setEditing(false)
      toast.success('Guardado')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white nice-shadow rounded-2xl p-4 sm:p-6 space-y-4">
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Escribe una descripción para esta lección…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#025dc7]/30 resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Tareas</label>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={task}
                    onChange={(e) => setTasks((prev) => prev.map((t, idx) => (idx === i ? e.target.value : t)))}
                    placeholder={`Tarea ${i + 1}`}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-2 text-gray-400 hover:text-rose-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTasks((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1.5 text-sm text-[#025dc7] font-medium hover:underline"
              >
                <Plus size={14} /> Añadir tarea
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setDescription(initialDescription)
                setTasks(initialTasks)
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              {initialDescription.trim() && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{initialDescription}</p>
              )}
              {initialTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Tareas de esta lección</h3>
                  <ul className="space-y-1.5">
                    {initialTasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!hasContent && canEdit && (
                <p className="text-sm text-gray-400">Aún no hay descripción ni tareas. Pulsa "Editar" para añadirlas.</p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                <Pencil size={13} /> Editar
              </button>
            )}
          </div>
        </>
      )}
      </div>
      <ConsultaSearchBar />
    </div>
  )
}
