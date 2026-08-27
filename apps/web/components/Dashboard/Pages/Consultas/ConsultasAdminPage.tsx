'use client'

/**
 * El tablón de consultas, atendido desde dentro de la escuela.
 *
 * Antes esta pantalla era un `<iframe>` a una aplicación de fuera que pedía
 * OTRA contraseña. Un profe que ya había entrado en la escuela se encontraba
 * con una pantalla de acceso y no podía contestar a nadie. Ahora la sirve la
 * escuela con la sesión que ya tienes: quien es del equipo entra y responde.
 *
 * La respuesta se escribe en texto plano a propósito. Las dos pantallas que la
 * enseñan al alumno (el tablón y "Mis consultas") la pintan respetando los
 * saltos de línea y sin interpretar ni una etiqueta, así que un editor de texto
 * enriquecido daría un resultado peor —y una vía de inyección que no hace falta
 * abrir—.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock, Loader2,
  MessageCircleQuestion, RefreshCw, Search, Send, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  CATEGORY_BY_ID, answerConsulta, catClasses, deleteConsultaAsAdmin,
  formatConsultaDate, htmlToText, listConsultasAsStaff,
  type ConsultaAdmin, type StatusFilter,
} from '@/lib/consultas/consultas'

const TABS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'resolved', label: 'Resueltas' },
  { id: 'all', label: 'Todas' },
]

const INPUT =
  'bg-[#F0F5FF] rounded-xl px-3 py-2 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors w-full'
const BTN =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[14px] font-bold transition-colors disabled:opacity-60'

function StatusPill({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#4da3ff]/12 text-[#025dc7]">
      <CheckCircle2 size={13} /> Respondida
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFBF2] text-[#8A6A2A]">
      <Clock size={13} /> Pendiente
    </span>
  )
}

export default function ConsultasAdminPage() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const accessToken = session?.data?.tokens?.access_token
  const orgId: number | undefined = org?.id
  // Borrar lo que ha escrito otra persona es moderación, y el rol de profe deja
  // fuera a propósito los permisos sobre la escuela: el backend le diría que no.
  // Mejor no enseñar un botón que va a fallar.
  const { isProfe } = useAdminStatus()
  const puedeBorrar = !isProfe

  const [tab, setTab] = useState<StatusFilter>('pending')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ConsultaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !accessToken) return
    setLoading(true)
    setError(null)
    try {
      // Se traen SIEMPRE todas y se filtra aquí: así los contadores de las
      // pestañas son de verdad y cambiar de pestaña no cuesta otro viaje.
      const data = await listConsultasAsStaff(orgId, accessToken)
      setItems(data)
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las consultas.')
    } finally {
      setLoading(false)
    }
  }, [orgId, accessToken])

  useEffect(() => { load() }, [load])

  const counts = useMemo(
    () => ({
      pending: items.filter((c) => !c.resolved).length,
      resolved: items.filter((c) => c.resolved).length,
      all: items.length,
    }),
    [items]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((c) => {
      if (tab === 'pending' && c.resolved) return false
      if (tab === 'resolved' && !c.resolved) return false
      if (!q) return true
      return [c.title, htmlToText(c.content), c.author_name, c.author_email]
        .some((campo) => (campo || '').toLowerCase().includes(q))
    })
  }, [items, tab, query])

  const selected = useMemo(
    () => items.find((c) => c.id === selectedId) || null,
    [items, selectedId]
  )

  // La ficha abierta se mantiene aunque se caiga del filtro. Al responder desde
  // "Pendientes" la consulta pasa a resuelta y desaparece de la lista de la
  // izquierda: si además se cerrara el detalle, el profe le daría a publicar y
  // se le quedaría la pantalla vacía sin llegar a ver su propia respuesta. Solo
  // se cierra si la consulta ya no existe (la ha borrado alguien).
  useEffect(() => {
    if (selectedId && !items.some((c) => c.id === selectedId)) setSelectedId(null)
  }, [items, selectedId])

  function abrir(c: ConsultaAdmin) {
    setSelectedId(c.id)
    setEditing(!c.respuesta_nawar)
    setDraft(c.respuesta_nawar ? htmlToText(c.respuesta_nawar) : '')
  }

  async function publicar() {
    if (!selected || !orgId) return
    const texto = draft.trim()
    if (!texto) {
      toast.error('La respuesta está vacía.')
      return
    }
    setSaving(true)
    try {
      const actualizada = await answerConsulta(orgId, selected.id, texto, accessToken)
      setItems((prev) => prev.map((c) => (c.id === actualizada.id ? actualizada : c)))
      setEditing(false)
      toast.success('Respuesta publicada. Se le avisa por correo.')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la respuesta.')
    } finally {
      setSaving(false)
    }
  }

  async function borrar() {
    if (!selected || !orgId) return
    if (!window.confirm('¿Borrar esta consulta? No se puede deshacer.')) return
    try {
      await deleteConsultaAsAdmin(orgId, selected.id, accessToken)
      setItems((prev) => prev.filter((c) => c.id !== selected.id))
      setSelectedId(null)
      toast.success('Consulta borrada')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar la consulta.')
    }
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] flex flex-col">
      {/* Cabecera */}
      <div className="px-4 sm:px-9 pt-6 sm:pt-8 pb-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircleQuestion size={22} className="text-[#025dc7] shrink-0" />
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Consultas</h1>
          </div>
          <button
            onClick={load}
            aria-label="Actualizar"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#025dc7] hover:bg-[#EAF3FF] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Lo que preguntan los alumnos. Al responder, la consulta se marca como resuelta y le llega un correo.
        </p>
      </div>

      {/* Pestañas + buscador */}
      <div className={`px-4 sm:px-9 pb-4 shrink-0 ${selectedId ? 'hidden lg:block' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-[#1D0084] text-white'
                  : 'bg-white text-gray-600 border border-[#DDE6F5] hover:bg-[#F0F5FF]'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 tabular-nums ${tab === t.id ? 'text-white/70' : 'text-gray-400'}`}>
                {counts[t.id]}
              </span>
            </button>
          ))}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1D0084]/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por texto, nombre o email"
              className={`${INPUT} pl-9`}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-9 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista + detalle. En móvil es una columna: la lista, y al tocar una
          consulta se ve la ficha con la flecha de volver. */}
      <div className="flex-1 min-h-0 px-4 sm:px-9 pb-6 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={`min-h-0 overflow-y-auto space-y-2 ${selectedId ? 'hidden lg:block' : ''}`}>
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!loading && visible.length === 0 && (
            <p className="text-[13px] text-[#9CA3AF] py-10 text-center">
              {query ? 'Ninguna consulta encaja con esa búsqueda.' : 'No hay consultas aquí.'}
            </p>
          )}
          {!loading &&
            visible.map((c) => {
              const cat = CATEGORY_BY_ID[c.category]
              const activa = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`w-full text-left rounded-2xl border bg-white p-3.5 transition-colors ${
                    activa ? 'border-[#4da3ff] ring-[3px] ring-[#4da3ff]/20' : 'border-[#DDE6F5] hover:border-[#4da3ff]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${catClasses(cat?.color)}`}>
                      {cat?.short || c.category || 'General'}
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {formatConsultaDate(c.created_at)}
                    </span>
                  </div>
                  <p className="font-semibold text-[14.5px] text-gray-900 mt-1.5 line-clamp-2 leading-snug">
                    {c.title || 'Sin título'}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-[12px] text-gray-500 truncate">
                      {c.author_name || 'Anónimo'}
                    </span>
                    {!c.resolved && <span className="w-2 h-2 rounded-full bg-[#E4B252] shrink-0" />}
                  </div>
                </button>
              )
            })}
        </div>

        <div className={`min-h-0 overflow-y-auto ${selectedId ? '' : 'hidden lg:block'}`}>
          {!selected ? (
            <div className="h-full hidden lg:flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-[#DDE6F5] bg-white/60 p-8">
              <MessageCircleQuestion size={28} className="text-[#DDE6F5]" />
              <p className="text-[13px] text-[#9CA3AF] mt-2">
                Elige una consulta para leerla y contestar.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden inline-flex items-center gap-1 text-[13px] font-semibold text-[#025dc7]"
                  >
                    <ArrowLeft size={16} /> Volver
                  </button>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${catClasses(
                      CATEGORY_BY_ID[selected.category]?.color
                    )}`}
                  >
                    {CATEGORY_BY_ID[selected.category]?.name || selected.category || 'General'}
                  </span>
                  <StatusPill resolved={selected.resolved} />
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Cerrar"
                  className="hidden lg:block text-gray-400 hover:text-gray-700 shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mt-3">
                {selected.title || 'Sin título'}
              </h2>
              <p className="text-[13px] text-gray-400 mt-1.5">
                {selected.author_name || 'Anónimo'}
                {selected.author_email ? (
                  <>
                    {' · '}
                    <a href={`mailto:${selected.author_email}`} className="text-[#025dc7] hover:underline">
                      {selected.author_email}
                    </a>
                  </>
                ) : null}
                {' · '}
                {formatConsultaDate(selected.created_at)}
              </p>

              <p className="text-[16px] text-gray-700 leading-relaxed mt-4 whitespace-pre-wrap">
                {htmlToText(selected.content)}
              </p>

              <div className="mt-6 border-t border-[#DDE6F5] pt-5">
                {selected.respuesta_nawar && !editing ? (
                  <>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">
                      Respuesta publicada
                    </p>
                    <div className="mt-2 p-4 rounded-2xl bg-[#F0F5FF] border border-[#DDE6F5]">
                      <p className="text-[15.5px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {htmlToText(selected.respuesta_nawar)}
                      </p>
                    </div>
                    {selected.resolved_by && (
                      <p className="text-[12px] text-[#9CA3AF] mt-2">
                        Respondida por {selected.resolved_by}
                        {selected.resolved_at ? ` · ${formatConsultaDate(selected.resolved_at)}` : ''}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        onClick={() => {
                          setEditing(true)
                          setDraft(htmlToText(selected.respuesta_nawar))
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#025dc7] hover:bg-[#F0F5FF]"
                      >
                        Editar respuesta
                      </button>
                      {puedeBorrar && (
                        <button
                          onClick={borrar}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} /> Borrar consulta
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="respuesta"
                      className="block text-[13px] font-semibold text-[#0a1656] tracking-[0.01em] mb-1.5"
                    >
                      Tu respuesta
                    </label>
                    <textarea
                      id="respuesta"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={7}
                      placeholder="Escribe la respuesta para el alumno…"
                      className={`${INPUT} resize-y leading-relaxed`}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button onClick={publicar} disabled={saving} className={BTN}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {selected.respuesta_nawar ? 'Guardar cambios' : 'Publicar respuesta y resolver'}
                      </button>
                      {selected.respuesta_nawar && (
                        <button
                          onClick={() => {
                            setEditing(false)
                            setDraft(htmlToText(selected.respuesta_nawar))
                          }}
                          className="px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-500 hover:bg-gray-100"
                        >
                          Cancelar
                        </button>
                      )}
                      {!selected.respuesta_nawar && puedeBorrar && (
                        <button
                          onClick={borrar}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} /> Borrar
                        </button>
                      )}
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mt-2 flex items-center gap-1">
                      <ChevronRight size={13} className="shrink-0" />
                      Al publicarla, el alumno recibe un correo con el enlace a su consulta.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
