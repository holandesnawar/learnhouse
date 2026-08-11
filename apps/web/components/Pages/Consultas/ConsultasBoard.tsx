'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, X, Loader2, CheckCircle2, Clock, Pencil, Trash2, MessageCircleQuestion, Search,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import {
  CONSULTA_CATEGORIES, CATEGORY_BY_ID, listConsultas, getConsulta, createConsulta,
  updateMyConsulta, deleteMyConsulta, isMyConsulta, htmlToText,
  catClasses, TEAM_LOGO,
  type Consulta, type StatusFilter,
} from '@/lib/consultas/consultas'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'resolved', label: 'Resueltas' },
]

interface FormState {
  open: boolean
  editingId: string | null
  category: string
  title: string
  content: string
  name: string
  email: string
}

const EMPTY_FORM: FormState = {
  open: false, editingId: null, category: '', title: '', content: '', name: '', email: '',
}

interface ConsultasBoardProps {
  /** Pre-fill the search box and pre-filter the feed on mount. */
  initialQuery?: string
  /** UUID of a consulta to open in the detail modal on mount. */
  initialOpenId?: string
  /** Open the "Nueva consulta" modal on mount (used by ?new=1 deep-link). */
  startNew?: boolean
}

export default function ConsultasBoard({
  initialQuery = '',
  initialOpenId = '',
  startNew = false,
}: ConsultasBoardProps = {}) {
  // Read the deep-link params CLIENT-SIDE from the real browser URL. The server
  // `searchParams` prop can arrive empty because the tenancy middleware rewrites
  // /consultas internally and drops the query string — but the browser URL still
  // carries ?id=/?q=/?new=, and useSearchParams reads that. Props are kept as a
  // fallback.
  const searchParams = useSearchParams()
  const effOpenId = initialOpenId || searchParams.get('id') || ''
  const effQuery = initialQuery || searchParams.get('q') || ''
  const effStartNew = startNew || searchParams.get('new') === '1'

  const session = useLHSession() as any
  const user = session?.data?.user
  const org = useOrg() as any
  // Hardcoded Nawar avatar for the team reply, so the answer always carries
  // the brand mark regardless of whatever org logo is currently uploaded.
  const teamLogo = TEAM_LOGO
  const sessionName = useMemo(
    () => [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.username || '',
    [user?.first_name, user?.last_name, user?.username]
  )
  const sessionEmail = user?.email || ''

  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<string>('')
  const [query, setQuery] = useState<string>(effQuery)

  const [selected, setSelected] = useState<Consulta | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listConsultas({ category: category || undefined, status })
      setConsultas(data)
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las consultas.')
    } finally {
      setLoading(false)
    }
  }, [category, status])

  useEffect(() => { loadFeed() }, [loadFeed])

  // Open the "Nueva consulta" modal automatically when arriving via ?new=1.
  // We do this once on mount; subsequent state changes don't trigger it.
  useEffect(() => {
    if (effStartNew) {
      setFormError(null)
      setForm({
        ...EMPTY_FORM,
        open: true,
        name: sessionName,
        email: sessionEmail,
        title: effQuery,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open the detail modal for ?id=... Fetch the consulta DIRECTLY by id (not
  // from the feed) so the deep-link from a lesson ALWAYS opens it — regardless
  // of feed timing, filters, or whether the id comes back as text or number.
  useEffect(() => {
    if (!effOpenId) return
    let cancelled = false
    // Open immediately if it's already in the loaded feed…
    const inFeed = consultas.find((c) => String(c.id) === String(effOpenId))
    if (inFeed) {
      setSelected(inFeed)
      return
    }
    // …otherwise fetch it straight from the source.
    getConsulta(effOpenId).then((c) => {
      if (!cancelled && c) setSelected(c)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effOpenId, consultas.length])

  // Filter the loaded feed by the user's typed query. Matches against title,
  // content, AND the team's answer so anything mentioning the term surfaces.
  const visibleConsultas = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return consultas
    return consultas.filter((c) => {
      const blob = [c.title, c.content, c.respuesta_nawar ?? '']
        .map((s) => (s ? htmlToText(s).toLowerCase() : ''))
        .join(' ')
      return blob.includes(q)
    })
  }, [consultas, query])

  function openNew() {
    setFormError(null)
    setForm({ ...EMPTY_FORM, open: true, name: sessionName, email: sessionEmail })
  }

  function openEdit(c: Consulta) {
    setFormError(null)
    setForm({
      open: true, editingId: c.id, category: c.category,
      title: c.title, content: htmlToText(c.content),
      name: sessionName, email: sessionEmail,
    })
    setSelected(null)
  }

  async function submitForm() {
    setFormError(null)
    const title = form.title.trim()
    const content = form.content.trim()
    if (!form.category || !title || !content) {
      setFormError('Elige categoría, escribe un título y los detalles.')
      return
    }
    if (!form.editingId && (!form.name.trim() || !form.email.trim())) {
      setFormError('Necesitamos tu nombre y email para avisarte de la respuesta.')
      return
    }
    setSubmitting(true)
    try {
      if (form.editingId) {
        await updateMyConsulta(form.editingId, { title, content, category: form.category })
      } else {
        await createConsulta({
          title, content, category: form.category,
          author_name: form.name.trim(), author_email: form.email.trim(),
        })
      }
      setForm(EMPTY_FORM)
      await loadFeed()
    } catch (e: any) {
      setFormError(e?.message || 'No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: Consulta) {
    if (!confirm('¿Borrar tu consulta? Esta acción no se puede deshacer.')) return
    try {
      await deleteMyConsulta(c.id)
      setSelected(null)
      await loadFeed()
    } catch (e: any) {
      alert(e?.message || 'No se pudo borrar.')
    }
  }

  return (
    <div>
      {/* Search bar — matches the lesson search bar visually so deep-linking
          from a lesson feels seamless. Filters the feed client-side over
          title + content + the team's answer. */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en consultas…"
          className="w-full pl-10 pr-3 py-3 rounded-xl bg-white text-[#1D0084] placeholder:text-[#5A6480] outline-none border border-[#cdddf5] shadow-sm hover:border-[#4da3ff]/60 focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#DDE6F5] shadow-sm">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setStatus(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                status === p.id ? 'bg-[#4da3ff] text-[#1D0084]' : 'text-[#5A6480] hover:text-[#025dc7]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] text-sm font-bold transition-colors"
        >
          <Plus size={17} /> Nueva consulta
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !category ? 'bg-[#4da3ff] text-[#1D0084] border-[#4da3ff]' : 'bg-white text-[#5A6480] border-[#DDE6F5] hover:border-[#4da3ff]'
          }`}
        >
          Todas
        </button>
        {CONSULTA_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id === category ? '' : c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              category === c.id ? `${catClasses(c.color)} ring-1 ring-current` : 'bg-white text-[#5A6480] border-[#DDE6F5] hover:border-[#4da3ff]'
            }`}
          >
            {c.short}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#5A6480]">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadFeed} className="mt-3 text-sm font-semibold text-[#025dc7] hover:underline">
            Reintentar
          </button>
        </div>
      ) : visibleConsultas.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircleQuestion className="mx-auto text-[#9CA3AF]" size={36} />
          <p className="text-gray-900 font-bold mt-3">
            {query.trim()
              ? `Ninguna consulta menciona "${query.trim()}"`
              : 'Aún no hay consultas aquí'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {query.trim()
              ? 'Crea la tuya y te avisamos por email cuando la respondamos.'
              : 'Sé el primero en preguntar — te respondemos en menos de 24 h.'}
          </p>
          {query.trim() && (
            <button
              onClick={() => {
                setFormError(null)
                setForm({
                  ...EMPTY_FORM,
                  open: true,
                  name: sessionName,
                  email: sessionEmail,
                  title: query.trim(),
                })
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] text-sm font-bold transition-colors"
            >
              <Plus size={15} /> Crear consulta sobre "{query.trim()}"
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleConsultas.map((c) => {
            const cat = CATEGORY_BY_ID[c.category]
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full text-left p-4 sm:p-5 rounded-2xl bg-white nice-shadow border border-transparent hover:border-[#4da3ff]/40 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${catClasses(cat?.color)}`}>
                    {cat?.name || c.category || 'General'}
                  </span>
                  {c.resolved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4da3ff]/12 text-[#025dc7]">
                      <CheckCircle2 size={12} /> Respondida
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                      <Clock size={12} /> Pendiente
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-bold text-gray-900 leading-snug">{c.title}</p>
                <p className="text-[13px] text-gray-500 leading-snug mt-1 line-clamp-2">{htmlToText(c.content)}</p>
                <p className="text-[12px] text-gray-400 mt-2">
                  {c.author_name || 'Anónimo'} · {formatDate(c.created_at)}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Overlay onClose={() => setSelected(null)}>
          <DetailView
            consulta={selected}
            teamLogo={teamLogo}
            onEdit={() => openEdit(selected)}
            onDelete={() => handleDelete(selected)}
            onClose={() => setSelected(null)}
          />
        </Overlay>
      )}

      {/* Create / edit modal */}
      {form.open && (
        <Overlay onClose={() => !submitting && setForm(EMPTY_FORM)}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl nice-shadow max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE6F5] sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-lg text-gray-900">
                {form.editingId ? 'Editar consulta' : 'Abre una nueva consulta'}
              </h2>
              <button onClick={() => !submitting && setForm(EMPTY_FORM)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!form.editingId && (
                <p className="text-[13px] text-[#5A6480] -mt-1">
                  Solemos responder en menos de 24&nbsp;h. Te llegará un email con el aviso.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]"
                >
                  <option value="">Elige una categoría…</option>
                  {CONSULTA_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
                <input
                  type="text"
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Resume tu duda en una frase"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Detalles</label>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Cuéntanos con detalle qué necesitas…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff] resize-y"
                />
              </div>

              {!form.editingId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tu nombre</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tu email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Para avisarte de la respuesta"
                      className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#4da3ff] focus:ring-1 focus:ring-[#4da3ff]"
                    />
                  </div>
                </div>
              )}

              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="px-5 py-4 border-t border-[#DDE6F5] flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => !submitting && setForm(EMPTY_FORM)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[#5A6480] hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] text-sm font-bold disabled:opacity-60"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {form.editingId ? 'Guardar cambios' : 'Publicar consulta'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  )
}

function DetailView({
  consulta, teamLogo, onEdit, onDelete, onClose,
}: {
  consulta: Consulta
  teamLogo: string
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const cat = CATEGORY_BY_ID[consulta.category]
  const own = isMyConsulta(consulta.id)
  const answer = htmlToText(consulta.respuesta_nawar)
  return (
    <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl nice-shadow max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between px-6 py-4 border-b border-[#DDE6F5] sticky top-0 bg-white rounded-t-2xl z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${catClasses(cat?.color)}`}>
            {cat?.name || consulta.category || 'General'}
          </span>
          {consulta.resolved ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#4da3ff]/12 text-[#025dc7]">
              <CheckCircle2 size={13} /> Respondida
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
              <Clock size={13} /> Pendiente
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0 ml-2">
          <X size={22} />
        </button>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 leading-snug">{consulta.title}</h2>
        <p className="text-[13px] text-gray-400 mt-1.5">
          {consulta.author_name || 'Anónimo'} · {formatDate(consulta.created_at)}
        </p>
        <p className="text-[17px] text-gray-700 leading-relaxed mt-4 whitespace-pre-wrap">
          {htmlToText(consulta.content)}
        </p>

        {answer && (
          <div className="mt-7 flex gap-3 items-start">
            <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-[#1D0084]">
              {teamLogo ? (
                // Sin borde alrededor: el logo ya trae su propia forma y el
                // anillo claro lo hacía parecer descolocado dentro del círculo.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogo}
                  alt="Team Nawar"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
                  N
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="font-bold text-gray-900 text-[15px]">Team Nawar</span>
                <CheckCircle2 size={15} className="text-[#025dc7]" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-md bg-[#F0F5FF] border border-[#DDE6F5]">
                <p className="text-[16px] text-gray-800 leading-relaxed whitespace-pre-wrap">{answer}</p>
              </div>
            </div>
          </div>
        )}

        {own && !consulta.resolved && (
          <div className="flex gap-2 mt-6">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#025dc7] hover:bg-[#F0F5FF]"
            >
              <Pencil size={15} /> Editar
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Borrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
