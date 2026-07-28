'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, HelpCircle, Pencil, Plus, Trash2, X, Check, Loader2 } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgFaq } from '@services/organizations/orgs'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { readFaqRoot } from '@components/Pages/Consultas/ConsultasFaq'

interface FAQ {
  q: string
  a: string
}

// Per-course default FAQ blocks. Keyed by course_uuid. Only the courses we want
// to "introduce" with a FAQ get one. Admins can override the items live (stored
// in the org config at customization.faq); these are the fallback defaults.
const COURSE_FAQS: Record<string, { intro?: string; items: FAQ[] }> = {
  'bfbcb42b-7dc3-4448-9df8-5d7b96135859': {
    intro:
      'Cada semana nos vemos en directo para repasar la formación, resolver tus dudas y practicar hablando holandés. Si no puedes asistir, la clase queda grabada aquí para siempre.',
    items: [
      {
        q: '¿Cuándo es la clase en directo?',
        a: 'La clase es semanal. Te avisamos por email cada lunes con el día y la hora exactos, y también aparece en la sección de Eventos de la plataforma.',
      },
      {
        q: '¿Y si no puedo asistir?',
        a: 'Sin problema. Todas las clases se graban y aparecen aquí abajo. Tendrás acceso a ellas para siempre.',
      },
      {
        q: '¿Dónde se hace?',
        a: 'En directo por videollamada. El enlace lo recibes por email un par de horas antes y también aparece en el evento de Eventos.',
      },
      {
        q: '¿Qué pasa en cada clase?',
        a: 'Repasamos lecciones de la formación, resolvemos vuestras dudas en directo y practicamos hablando en holandés. Tú decides el ritmo: trae tus preguntas o disfruta del repaso.',
      },
      {
        q: '¿Puedo enviar mi duda antes para que la resolvamos en directo?',
        a: 'Sí. Abre una consulta desde cualquier lección o desde "Consultas" en el menú. Las preguntas más votadas las cubrimos en la siguiente clase.',
      },
      {
        q: '¿Hay material para descargar?',
        a: 'Cuando una clase tiene fichas o ejercicios, te los dejamos enlazados desde la actividad del curso. Puedes volver cuando quieras.',
      },
    ],
  },
}

interface CourseFAQProps {
  courseUuid: string
  /** Compact = sidebar variant: smaller header, tighter paddings. */
  compact?: boolean
}

export default function CourseFAQ({ courseUuid, compact = false }: CourseFAQProps) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isAdmin } = (useAdminStatus() as any) || {}
  const accessToken = session?.data?.tokens?.access_token

  // course.course_uuid comes as "course_<uuid>" from the API while the URL form
  // is the bare uuid. Normalise so callers don't have to.
  const key = (courseUuid || '').replace(/^course_/, '')
  const hardcoded = COURSE_FAQS[key]

  // Las preguntas de cada curso viven en su propio hueco dentro del objeto faq
  // de la organización. Antes compartían `items` con las consultas frecuentes,
  // así que cada sección borraba la lista de la otra.
  const queryClient = useQueryClient()
  const faqRoot = readFaqRoot(org)
  const [editing, setEditing] = useState(false)
  const editingRef = React.useRef(false)
  editingRef.current = editing

  const savedItems = useMemo(() => {
    const own = faqRoot?.courses?.[key]?.items
    if (Array.isArray(own) && own.length) return own as FAQ[]
    // Rescate: lo que se guardó cuando ambas secciones compartían `items`
    // (se reconoce porque usa q/a) sigue ahí y se recupera tal cual.
    const legacy = Array.isArray(faqRoot?.items)
      ? (faqRoot.items as any[]).filter((i) => i && typeof i.q === 'string')
      : []
    return legacy as FAQ[]
  }, [faqRoot, key])

  const [items, setItems] = useState<FAQ[]>(savedItems.length ? savedItems : hardcoded?.items ?? [])

  // La organización llega después del primer render: sin esto la lista se
  // quedaba con lo que hubiera al arrancar (normalmente nada).
  const savedSignature = useMemo(() => JSON.stringify(savedItems), [savedItems])
  useEffect(() => {
    if (editingRef.current) return
    if (savedItems.length) setItems(savedItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature])
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<FAQ[]>([])

  // FAQ only on designated courses.
  if (!hardcoded) return null

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(items)))
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const cleaned = draft.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q || f.a)
      // Se escribe SOLO en el hueco de este curso; el resto del objeto (las
      // consultas frecuentes y los demás cursos) se conserva.
      await updateOrgFaq(
        org.id,
        { ...faqRoot, courses: { ...(faqRoot?.courses || {}), [key]: { items: cleaned } } },
        accessToken
      )
      setItems(cleaned)
      setEditing(false)
      if (org?.slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      }
      toast.success('Preguntas frecuentes guardadas')
    } catch {
      toast.error('No se pudieron guardar las preguntas')
    } finally {
      setSaving(false)
    }
  }

  // ── Compact (sidebar) variant ──
  if (compact) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <HelpCircle size={22} className="text-[#025dc7] shrink-0" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            Preguntas frecuentes
          </h2>
        </div>
        <div className="bg-white rounded-2xl nice-shadow border border-[#DDE6F5] overflow-hidden divide-y divide-[#DDE6F5]">
          {items.map((faq, i) => {
            const open = openIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-[#F0F5FF]/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15.5px] font-bold text-gray-900 leading-snug">{faq.q}</p>
                  {open && (
                    <p className="text-[15px] text-gray-600 leading-relaxed mt-2.5 whitespace-pre-line">{faq.a}</p>
                  )}
                </div>
                <ChevronDown size={18} className={`shrink-0 mt-1 text-[#025dc7] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Full variant (course page) — admin-editable ──
  return (
    <div className="my-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <HelpCircle size={22} className="text-[#025dc7]" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
            Preguntas frecuentes
          </h2>
        </div>
        {isAdmin && !editing && (
          <button
            onClick={startEdit}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={13} /> Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-white nice-shadow rounded-2xl border border-[#DDE6F5] p-4 sm:p-5 space-y-4">
          {draft.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={faq.q}
                  onChange={(e) => setDraft((d) => d.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))}
                  placeholder="Pregunta…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#025dc7]/30"
                />
                <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-rose-500">
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea
                value={faq.a}
                onChange={(e) => setDraft((d) => d.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))}
                placeholder="Respuesta…"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30 resize-none"
              />
            </div>
          ))}
          <button
            onClick={() => setDraft((d) => [...d, { q: '', a: '' }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            <Plus size={15} /> Añadir pregunta
          </button>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#0a1656] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            </button>
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              <X size={15} /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl nice-shadow overflow-hidden border border-[#DDE6F5] divide-y divide-[#DDE6F5]">
          {items.map((faq, i) => {
            const open = openIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-[#F0F5FF]/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] sm:text-[15px] font-bold text-gray-900 leading-snug">{faq.q}</p>
                  {open && (
                    <p className="text-[13px] sm:text-[14px] text-gray-600 leading-relaxed mt-2 whitespace-pre-line">{faq.a}</p>
                  )}
                </div>
                <ChevronDown size={18} className={`shrink-0 mt-1 text-[#025dc7] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
