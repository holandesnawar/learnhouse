'use client'
import React, { useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgFaq } from '@services/organizations/orgs'
import { ChevronDown, Plus, Pencil, Trash2, X, Check, Loader2, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface FaqItem {
  id: string
  question: string
  answer: string
}

function readFaq(org: any): FaqItem[] {
  const f = org?.config?.config?.customization?.faq || org?.config?.config?.faq
  return Array.isArray(f?.items) ? f.items : []
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return String(Date.now()) + Math.random().toString(36).slice(2, 8)
  }
}

export default function ConsultasFaq() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus() as any
  const canEdit = !!isAdmin

  const [items, setItems] = useState<FaqItem[]>(() => readFaq(org))
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<FaqItem | null>(null)

  // Hide the whole block for students when there's nothing to show.
  if (items.length === 0 && !canEdit) return null

  const persist = async (next: FaqItem[]) => {
    setSaving(true)
    try {
      await updateOrgFaq(org.id, { items: next }, accessToken)
      setItems(next)
    } catch {
      toast.error('No se pudieron guardar las preguntas')
      throw new Error('save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveItem = async (item: FaqItem) => {
    if (!item.question.trim() || !item.answer.trim()) {
      toast.error('Escribe la pregunta y la respuesta')
      return
    }
    const exists = items.some((i) => i.id === item.id)
    const next = exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]
    try {
      await persist(next)
      setEditing(null)
      toast.success('Pregunta guardada')
    } catch {
      /* toast already shown */
    }
  }

  const deleteItem = async (id: string) => {
    try {
      await persist(items.filter((i) => i.id !== id))
      setEditing(null)
    } catch {
      /* toast already shown */
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white nice-shadow overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#EEF2FB]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
            <HelpCircle size={18} className="text-[#025dc7]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Preguntas frecuentes</h2>
            <p className="text-[12px] text-gray-500">Dudas habituales, ya resueltas.</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing({ id: newId(), question: '', answer: '' })}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4da3ff] text-[#0a1656] text-sm font-semibold hover:bg-[#6cb5ff] transition-colors"
          >
            <Plus size={15} /> Añadir
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          Aún no hay preguntas. Pulsa «Añadir» para crear la primera.
        </div>
      ) : (
        <div className="divide-y divide-[#EEF2FB]">
          {items.map((item) => {
            const isOpen = open === item.id
            return (
              <div key={item.id}>
                <div className="flex items-center">
                  <button
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    className="flex-1 flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-[#F8FAFF] transition-colors"
                  >
                    <span className="text-[14px] font-semibold text-gray-900">{item.question}</span>
                    <ChevronDown
                      size={18}
                      className={`text-[#025dc7] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setEditing(item)}
                      className="shrink-0 p-2 mr-2 text-gray-400 hover:text-[#1D0084]"
                      aria-label="Editar pregunta"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="px-5 pb-4 -mt-1">
                    <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">{item.answer}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <FaqModal
          item={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={saveItem}
          onDelete={items.some((i) => i.id === editing.id) ? () => deleteItem(editing.id) : undefined}
        />
      )}
    </div>
  )
}

function FaqModal({
  item,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  item: FaqItem
  saving: boolean
  onClose: () => void
  onSave: (i: FaqItem) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<FaqItem>(item)
  const set = (k: keyof FaqItem, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 60 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl nice-shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{onDelete ? 'Editar pregunta' : 'Nueva pregunta'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta *</label>
            <input
              value={form.question}
              onChange={(e) => set('question', e.target.value)}
              placeholder="¿Cómo entrego una consulta?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Respuesta *</label>
            <textarea
              value={form.answer}
              onChange={(e) => set('answer', e.target.value)}
              rows={5}
              placeholder="Escribe aquí la respuesta…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30 resize-y"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button
              onClick={onDelete}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={15} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#0a1656] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
