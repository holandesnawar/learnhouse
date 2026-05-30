'use client'
import React, { useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateOrgRoadmap } from '@services/organizations/orgs'
import { CalendarCheck, Pencil, Plus, X, Check, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Week {
  title: string
  tasks: string[]
}
interface Roadmap {
  weeks: Week[]
  current: number
}

function readRoadmap(org: any): Roadmap {
  const r = org?.config?.config?.customization?.roadmap || org?.config?.config?.roadmap
  const weeks = Array.isArray(r?.weeks) ? r.weeks : []
  const current = typeof r?.current === 'number' ? r.current : 0
  return { weeks, current }
}

export default function RoadmapSection({ canEdit }: { canEdit: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [roadmap, setRoadmap] = useState<Roadmap>(() => readRoadmap(org))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Roadmap>(roadmap)

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(roadmap)))
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const cleaned: Roadmap = {
        weeks: draft.weeks
          .map((w) => ({ title: w.title.trim(), tasks: w.tasks.map((t) => t.trim()).filter(Boolean) }))
          .filter((w) => w.title || w.tasks.length > 0),
        current: draft.current,
      }
      if (cleaned.current >= cleaned.weeks.length) cleaned.current = Math.max(0, cleaned.weeks.length - 1)
      await updateOrgRoadmap(org.id, cleaned, accessToken)
      setRoadmap(cleaned)
      setEditing(false)
      toast.success('Hoja de ruta guardada')
    } catch {
      toast.error('No se pudo guardar la hoja de ruta')
    } finally {
      setSaving(false)
    }
  }

  const currentWeek = roadmap.weeks[roadmap.current]
  const hasRoadmap = roadmap.weeks.length > 0

  // Nothing to show and can't edit → render nothing.
  if (!hasRoadmap && !canEdit) return null

  if (editing) {
    return (
      <div className="mb-10 bg-white nice-shadow rounded-2xl p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">Editar hoja de ruta</h2>
        <div className="space-y-5">
          {draft.weeks.map((week, wi) => (
            <div key={wi} className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={week.title}
                  onChange={(e) => setDraft((d) => ({ ...d, weeks: d.weeks.map((w, i) => (i === wi ? { ...w, title: e.target.value } : w)) }))}
                  placeholder={`Semana ${wi + 1}`}
                  className="flex-1 min-w-[150px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#025dc7]/30"
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                  <input type="radio" name="current-week" checked={draft.current === wi} onChange={() => setDraft((d) => ({ ...d, current: wi }))} />
                  Esta semana
                </label>
                <button onClick={() => setDraft((d) => ({ ...d, weeks: d.weeks.filter((_, i) => i !== wi) }))} className="p-2 text-gray-400 hover:text-rose-500">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-2 pl-1">
                {week.tasks.map((task, ti) => (
                  <div key={ti} className="flex items-center gap-2">
                    <input
                      value={task}
                      onChange={(e) => setDraft((d) => ({ ...d, weeks: d.weeks.map((w, i) => (i === wi ? { ...w, tasks: w.tasks.map((t, j) => (j === ti ? e.target.value : t)) } : w)) }))}
                      placeholder={`Tarea ${ti + 1}`}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30"
                    />
                    <button onClick={() => setDraft((d) => ({ ...d, weeks: d.weeks.map((w, i) => (i === wi ? { ...w, tasks: w.tasks.filter((_, j) => j !== ti) } : w)) }))} className="p-2 text-gray-400 hover:text-rose-500">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setDraft((d) => ({ ...d, weeks: d.weeks.map((w, i) => (i === wi ? { ...w, tasks: [...w.tasks, ''] } : w)) }))} className="inline-flex items-center gap-1.5 text-sm text-[#025dc7] font-medium hover:underline">
                  <Plus size={14} /> Añadir tarea
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setDraft((d) => ({ ...d, weeks: [...d.weeks, { title: '', tasks: [''] }] }))} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
            <Plus size={15} /> Añadir semana
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#0a1656] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-10 space-y-6">
      {/* Esta semana te toca */}
      {currentWeek && (
        <div className="bg-white nice-shadow rounded-2xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#025dc7]/10 flex items-center justify-center shrink-0">
                <CalendarCheck size={20} className="text-[#025dc7]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Esta semana te toca</h2>
                <p className="text-sm text-[#025dc7] font-semibold">{currentWeek.title}</p>
              </div>
            </div>
            {canEdit && (
              <button onClick={startEdit} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                <Pencil size={13} /> Editar
              </button>
            )}
          </div>
          {currentWeek.tasks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {currentWeek.tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Hoja de ruta completa */}
      {roadmap.weeks.length > 1 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Hoja de ruta</h2>
          <div className="space-y-3">
            {roadmap.weeks.map((week, wi) => (
              <div
                key={wi}
                className={`rounded-lg border p-4 ${
                  wi === roadmap.current ? 'border-[#025dc7] bg-[#025dc7]/5' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{week.title || `Semana ${wi + 1}`}</h3>
                  {wi === roadmap.current && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#025dc7] rounded-full px-2 py-0.5">Esta semana</span>
                  )}
                </div>
                {week.tasks.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {week.tasks.map((task, ti) => (
                      <li key={ti} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-0.5 w-3.5 h-3.5 rounded border-2 border-gray-300 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for admins */}
      {!hasRoadmap && canEdit && (
        <button
          onClick={startEdit}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <Plus size={16} /> Crear hoja de ruta semanal
        </button>
      )}
    </div>
  )
}
