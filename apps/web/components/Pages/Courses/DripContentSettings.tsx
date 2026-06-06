'use client'
import React, { useState } from 'react'
import { CalendarClock, ChevronDown } from 'lucide-react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateOrgDripConfig } from '@services/settings/org'
import toast from 'react-hot-toast'

// Admin-only panel (shown on the course overview) to configure "drip content":
// how many days after each student's enrollment a module/chapter unlocks.
// Saved to org config (config.drip_content) via PUT /orgs/{id}/config/drip_content.
export default function DripContentSettings({ course }: { course: any }) {
  const { isAdmin } = useAdminStatus() as any
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const stored = org?.config?.config?.drip_content || {}
  const chapters: any[] = course?.chapters || []

  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState<boolean>(!!stored.enabled)
  const [offsets, setOffsets] = useState<{ [k: string]: number }>(() => {
    const init: { [k: string]: number } = {}
    chapters.forEach((c) => {
      init[c.chapter_uuid] = Number(stored?.chapters?.[c.chapter_uuid] ?? 0)
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  if (!isAdmin || chapters.length === 0) return null

  const setDay = (uuid: string, v: string) => {
    const n = Math.max(0, parseInt(v || '0', 10) || 0)
    setOffsets((prev) => ({ ...prev, [uuid]: n }))
  }

  // Quick start: one module per week (0, 7, 14, …). Admin can then tweak each
  // value (e.g. leave the first two at 0, add a 2-week gap for a review week).
  const autofill = () => {
    const next: { [k: string]: number } = {}
    chapters.forEach((c, i) => {
      next[c.chapter_uuid] = i * 7
    })
    setOffsets(next)
  }

  const save = async () => {
    if (!org?.id || !access_token) return
    setSaving(true)
    try {
      await updateOrgDripConfig(String(org.id), { enabled, chapters: offsets }, access_token)
      toast.success('Calendario de goteo guardado. Recarga para ver los cambios.')
    } catch {
      toast.error('No se pudo guardar el calendario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#DDE6F5] bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#F0F5FF]/50 transition-colors"
      >
        <CalendarClock size={18} className="text-[#4da3ff] shrink-0" />
        <span className="font-semibold text-[#1D0084] text-sm">
          Goteo de contenido <span className="text-gray-400 font-normal">(solo admins)</span>
        </span>
        <span
          className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {enabled ? 'Activado' : 'Desactivado'}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-[13.5px] font-medium text-[#1D0084] cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#4da3ff]"
            />
            Activar desbloqueo por fecha (días desde la matrícula de cada alumno)
          </label>

          <p className="text-[12px] text-gray-500 leading-relaxed">
            Pon <b>0</b> en los módulos que quieras abiertos desde el primer día. Cada número son los
            días que tardan en desbloquearse tras la matrícula. Ejemplo (12 semanas): 0, 0, 14, 21, 35,
            42, 49, 56, 63, 70.
          </p>

          <button
            onClick={autofill}
            className="text-[12px] font-semibold text-[#4da3ff] hover:text-[#1D0084] transition-colors"
          >
            Autorrellenar: 1 módulo por semana (0, 7, 14…)
          </button>

          <div className="space-y-1.5">
            {chapters.map((c, i) => (
              <div key={c.chapter_uuid} className="flex items-center gap-2">
                <span className="text-[13px] text-gray-700 flex-1 truncate">
                  <span className="text-gray-400 font-semibold mr-1">{i + 1}.</span>
                  {c.name}
                </span>
                <input
                  type="number"
                  min={0}
                  value={offsets[c.chapter_uuid] ?? 0}
                  onChange={(e) => setDay(c.chapter_uuid, e.target.value)}
                  className="w-20 bg-[#F0F5FF] rounded-lg px-2.5 py-1.5 text-[13px] text-[#1D0084] border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] transition-colors text-right"
                />
                <span className="text-[12px] text-gray-400 w-8">días</span>
              </div>
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-[#4da3ff] hover:bg-[#6cb5ff] disabled:opacity-60 text-[#0a1656] font-bold text-[14px] rounded-lg px-4 py-2.5 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar calendario'}
          </button>
        </div>
      )}
    </div>
  )
}
