'use client'

import React, { useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { updateOrgCommunityPanelConfig } from '@services/settings/org'
import { Sparkles, ShieldCheck, Lightbulb, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULTS = {
  welcome: 'Bienvenido/a a la comunidad. Este es nuestro espacio para aprender juntos.',
  rules: 'Sé respetuoso/a con los demás.\nNada de spam ni autopromoción.\nUsa el canal adecuado para cada tema.',
  tips: 'Preséntate en el canal de bienvenida.\nPregunta sin miedo: estamos para ayudarte.\nComparte tus avances y celebra los de los demás.',
}

function toLines(text: string): string[] {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean)
}

interface Props {
  org_id: number
}

export default function CommunityInfoPanel({ org_id }: Props) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const stored = org?.config?.config?.community_panel || {}

  const [panel, setPanel] = useState({
    welcome: stored.welcome ?? '',
    rules: stored.rules ?? '',
    tips: stored.tips ?? '',
  })
  const [draft, setDraft] = useState(panel)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const showWelcome = panel.welcome.trim() || DEFAULTS.welcome
  const ruleLines = toLines(panel.rules.trim() ? panel.rules : DEFAULTS.rules)
  const tipLines = toLines(panel.tips.trim() ? panel.tips : DEFAULTS.tips)

  function startEdit() {
    setDraft(panel)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateOrgCommunityPanelConfig(
        String(org_id),
        draft,
        session?.data?.tokens?.access_token
      )
      setPanel(draft)
      setEditing(false)
      toast.success('Panel actualizado')
    } catch {
      toast.error('No se pudo guardar el panel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="w-full min-w-0">
      <div className="lg:sticky lg:top-24 bg-white nice-shadow rounded-2xl border border-[#DDE6F5] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#DDE6F5]">
          <div className="flex items-center gap-2 text-[#1D0084]">
            <Sparkles size={16} className="text-[#025dc7]" />
            <h3
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              Sobre la comunidad
            </h3>
          </div>
          {!editing && (
            <AuthenticatedClientElement
              ressourceType="communities"
              action="create"
              checkMethod="roles"
              orgId={org_id}
            >
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5A6480] hover:text-[#1D0084] transition-colors"
                title="Editar panel"
              >
                <Pencil size={13} /> Editar
              </button>
            </AuthenticatedClientElement>
          )}
        </div>

        {editing ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">Bienvenida</label>
              <textarea
                value={draft.welcome}
                onChange={(e) => setDraft({ ...draft, welcome: e.target.value })}
                rows={2}
                placeholder={DEFAULTS.welcome}
                className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7] resize-y"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">Reglas (una por línea)</label>
              <textarea
                value={draft.rules}
                onChange={(e) => setDraft({ ...draft, rules: e.target.value })}
                rows={4}
                placeholder={DEFAULTS.rules}
                className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7] resize-y"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">Consejos (uno por línea)</label>
              <textarea
                value={draft.tips}
                onChange={(e) => setDraft({ ...draft, tips: e.target.value })}
                rows={4}
                placeholder={DEFAULTS.tips}
                className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7] resize-y"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[13px] font-semibold hover:bg-[#6cb5ff] transition-colors disabled:opacity-50"
              >
                <Check size={14} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:text-[#1D0084] transition-colors"
              >
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <p className="text-[13px] text-gray-700 leading-relaxed">{showWelcome}</p>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShieldCheck size={14} className="text-[#025dc7]" />
                <h4 className="text-[12px] font-bold text-[#1D0084] uppercase tracking-wide">Reglas</h4>
              </div>
              <ul className="space-y-1">
                {ruleLines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-gray-700 leading-snug">
                    <span className="text-[#025dc7] mt-px shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={14} className="text-[#F58220]" />
                <h4 className="text-[12px] font-bold text-[#1D0084] uppercase tracking-wide">Consejos</h4>
              </div>
              <ul className="space-y-1">
                {tipLines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-gray-700 leading-snug">
                    <span className="text-[#F58220] mt-px shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
