'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgFaq } from '@services/organizations/orgs'
import { ChevronDown, Plus, Pencil, Trash2, X, Check, Loader2, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'

interface FaqItem {
  id: string
  question: string
  answer: string
}

/**
 * El objeto `faq` de la organización lo comparten DOS secciones distintas:
 * estas consultas frecuentes (`items`) y las preguntas de cada curso
 * (`courses[uuid].items`, ver CourseFAQ). Hasta ahora las dos escribían en
 * `items`, así que cada una borraba la lista de la otra y las preguntas del
 * curso se veían aquí en blanco (usan `q`/`a` en vez de `question`/`answer`).
 */
export function readFaqRoot(org: any): any {
  return org?.config?.config?.customization?.faq || org?.config?.config?.faq || {}
}

/**
 * TODOS los sitios donde ha podido quedar guardado el FAQ. El backend escribe
 * en `customization.faq` cuando la configuración es v2 y en `faq` a secas
 * cuando no, así que una lista antigua puede haber quedado en el otro hueco y
 * no verse. Al rescatar se miran los dos.
 */
export function readFaqRoots(org: any): any[] {
  const cfg = org?.config?.config
  return [cfg?.customization?.faq, cfg?.faq].filter(Boolean)
}

/** Solo las consultas frecuentes; las del curso se quedan en su sitio. */
function readFaq(org: any): FaqItem[] {
  const roots = readFaqRoots(org)
  const raw =
    roots.map((r) => r?.items).find((it) => Array.isArray(it) && it.some((x: any) => x?.question)) ||
    readFaqRoot(org)?.items
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it: any) => it && (typeof it.question === 'string' || typeof it.answer === 'string'))
    .map((it: any, i: number) => ({
      id: it.id || `faq-${i}`,
      question: it.question || '',
      answer: it.answer || '',
    }))
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

  const queryClient = useQueryClient()
  const [items, setItems] = useState<FaqItem[]>(() => readFaq(org))
  const [open, setOpen] = useState<string | null>(null)
  // En el móvil este bloque va ARRIBA del listado de consultas, así que con 8
  // preguntas había que pasar media pantalla antes de llegar al contenido.
  // Se muestran 2 y el resto se despliega a petición (en escritorio, todas).
  const [showAll, setShowAll] = useState(false)
  const MOBILE_PREVIEW = 2
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<FaqItem | null>(null)

  // La organización llega del servidor DESPUÉS del primer render. Sin esto el
  // estado se quedaba con la lista vacía del arranque: la página parecía no
  // tener preguntas y, al añadir una, se guardaba esa sola encima de todas las
  // que ya había. Así es como desaparecieron.
  const orgItemsSignature = useMemo(() => JSON.stringify(readFaqRoot(org)?.items ?? null), [org])
  useEffect(() => {
    if (editing) return // no pisar lo que se está escribiendo
    setItems(readFaq(org))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgItemsSignature])

  // Hide the whole block for students when there's nothing to show.
  if (items.length === 0 && !canEdit) return null

  const persist = async (next: FaqItem[]) => {
    setSaving(true)
    try {
      // Conservar el resto del objeto (las preguntas de los cursos).
      const root = readFaqRoot(org)
      await updateOrgFaq(org.id, { ...root, items: next }, accessToken)
      setItems(next)
      if (org?.slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      }
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
          <div className="flex items-center justify-center shrink-0">
            <HelpCircle size={26} className="text-[#025dc7]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Consultas frecuentes</h2>
            <p className="text-[12px] text-gray-500">Dudas habituales, ya resueltas.</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing({ id: newId(), question: '', answer: '' })}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-semibold hover:bg-[#6cb5ff] transition-colors"
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
          {items.map((item, idx) => {
            const hiddenOnMobile = !showAll && idx >= MOBILE_PREVIEW
            const isOpen = open === item.id
            return (
              <div key={item.id} className={hiddenOnMobile ? 'hidden lg:block' : ''}>
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

          {/* Solo en móvil: el resto de preguntas se despliega a petición. */}
          {items.length > MOBILE_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="lg:hidden w-full px-5 py-3 text-[13.5px] font-semibold text-[#025dc7] hover:bg-[#F8FAFF] transition-colors flex items-center justify-center gap-1.5"
            >
              {showAll ? (
                <>Ver menos <ChevronDown size={16} className="rotate-180" /></>
              ) : (
                <>
                  Ver las {items.length - MOBILE_PREVIEW} preguntas restantes
                  <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
