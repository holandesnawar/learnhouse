'use client'
import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgEvents } from '@services/organizations/orgs'
import { broadcastNotification } from '@services/notifications/broadcast'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  Clock,
  ExternalLink,
  CalendarDays,
  Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface LhEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string
  link?: string
  description?: string
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEKDAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function readEvents(org: any): LhEvent[] {
  const e = org?.config?.config?.customization?.events || org?.config?.config?.events
  return Array.isArray(e?.events) ? e.events : []
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return String(Date.now()) + Math.random().toString(36).slice(2, 8)
  }
}

export default function CalendarView({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus() as any
  const canEdit = !!isAdmin
  const [notifying, setNotifying] = useState<string | null>(null)
  // Al llegar desde el email (?evento=…) se resalta ese evento y se lleva la
  // vista hasta él.
  const [focusedEvent, setFocusedEvent] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = new URLSearchParams(window.location.search).get('evento')
    if (!id) return
    setFocusedEvent(id)
    const timer = setTimeout(() => {
      document.getElementById(`evento-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => clearTimeout(timer)
  }, [])

  // Avisar por email de una clase ya confirmada. Va a todos los alumnos de la
  // escuela y se manda en segundo plano, así que la respuesta es inmediata.
  const notifyEvent = async (ev: LhEvent) => {
    if (!org?.id || notifying) return
    const whenText = [
      `${WEEKDAYS_FULL[(dayjs(ev.date).day() + 6) % 7]} ${dayjs(ev.date).date()} de ${MONTHS[dayjs(ev.date).month()]}`,
      ev.time ? `· ${ev.time}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    if (!window.confirm(`Se enviará un email a TODOS los alumnos con:\n\n${ev.title}\n${whenText}\n\n¿Enviar?`)) return
    setNotifying(ev.id)
    // Con enlace de reunión el botón entra directo a la clase; sin él, lleva
    // al evento concreto del calendario (antes caía en la portada).
    const eventUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?evento=${encodeURIComponent(ev.id)}`
        : ''
    const res = await broadcastNotification(
      {
        org_id: org.id,
        kind: 'class',
        title: ev.title,
        when_text: whenText,
        url: ev.link || '',
        event_url: eventUrl,
      },
      accessToken
    )
    setNotifying(null)
    if (res) toast.success(`Aviso enviado a ${res.queued} alumnos.`)
    else toast.error('No se pudo enviar el aviso.')
  }

  const [events, setEvents] = useState<LhEvent[]>(() => readEvents(org))
  const [cursor, setCursor] = useState(() => dayjs().startOf('month'))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<LhEvent | null>(null)

  const eventsByDay = useMemo(() => {
    const map: Record<string, LhEvent[]> = {}
    for (const ev of events) {
      if (!ev?.date) continue
      ;(map[ev.date] ||= []).push(ev)
    }
    return map
  }, [events])

  const gridDays = useMemo(() => {
    const first = cursor.startOf('month')
    const offset = (first.day() + 6) % 7 // Monday-start
    const start = first.subtract(offset, 'day')
    return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  }, [cursor])

  const todayStr = dayjs().format('YYYY-MM-DD')
  const monthIndex = cursor.month()

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => e.date && e.date >= todayStr)
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
        .slice(0, 8),
    [events, todayStr]
  )

  const persist = async (next: LhEvent[]) => {
    setSaving(true)
    try {
      await updateOrgEvents(org.id, { events: next }, accessToken)
      setEvents(next)
    } catch {
      toast.error('No se pudo guardar el calendario')
      throw new Error('save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveEvent = async (ev: LhEvent) => {
    if (!ev.title.trim() || !ev.date) {
      toast.error('Pon al menos un título y una fecha')
      return
    }
    const exists = events.some((e) => e.id === ev.id)
    const next = exists ? events.map((e) => (e.id === ev.id ? ev : e)) : [...events, ev]
    try {
      await persist(next)
      setEditing(null)
      toast.success('Evento guardado')
    } catch {
      /* toast already shown */
    }
  }

  const deleteEvent = async (id: string) => {
    try {
      await persist(events.filter((e) => e.id !== id))
      setEditing(null)
    } catch {
      /* toast already shown */
    }
  }

  const openNew = (date?: string) =>
    setEditing({ id: newId(), title: '', date: date || todayStr, time: '', link: '', description: '' })

  return (
    <GeneralWrapperStyled>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 pb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={24} className="text-[#025dc7]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Eventos</h1>
        </div>
        {canEdit && (
          <button
            onClick={() => openNew()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Añadir evento
          </button>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">
          {MONTHS[monthIndex]} {cursor.year()}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((c) => c.subtract(1, 'month'))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCursor(dayjs().startOf('month'))} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
            Hoy
          </button>
          <button onClick={() => setCursor((c) => c.add(1, 'month'))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-white nice-shadow rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const dStr = day.format('YYYY-MM-DD')
            const inMonth = day.month() === monthIndex
            const isToday = dStr === todayStr
            const dayEvents = eventsByDay[dStr] || []
            return (
              <div
                key={dStr}
                onClick={canEdit ? () => openNew(dStr) : undefined}
                className={`min-h-[84px] border-b border-r border-gray-100 p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-gray-50/50'
                } ${canEdit ? 'cursor-pointer hover:bg-[#025dc7]/5' : ''}`}
              >
                <div className="flex justify-end">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                      isToday ? 'bg-[#025dc7] text-white font-bold' : inMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    {day.date()}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canEdit) setEditing(ev)
                        else if (ev.link) window.open(ev.link, '_blank')
                      }}
                      className="w-full text-left truncate rounded px-1.5 py-1 text-[11px] font-medium bg-[#025dc7]/10 text-[#025dc7] hover:bg-[#025dc7]/20"
                      title={ev.title}
                    >
                      {ev.time ? `${ev.time} ` : ''}{ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="block text-[10px] text-gray-400 px-1.5">+{dayEvents.length - 3} más</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming agenda */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Próximos eventos</h2>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30 text-center">
            <CalendarDays size={26} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No hay eventos próximos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((ev) => (
              <div
                key={ev.id}
                id={`evento-${ev.id}`}
                className={`bg-white nice-shadow rounded-lg p-4 flex items-start gap-4 transition-shadow ${
                  focusedEvent === ev.id ? 'ring-2 ring-[#4da3ff]' : ''
                }`}
              >
                <div className="shrink-0 w-12 text-center">
                  <div className="text-[11px] font-semibold text-[#025dc7] uppercase">{MONTHS[dayjs(ev.date).month()].slice(0, 3)}</div>
                  <div className="text-xl font-bold text-gray-900 leading-none">{dayjs(ev.date).date()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{ev.title}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>
                      {WEEKDAYS_FULL[(dayjs(ev.date).day() + 6) % 7]} {dayjs(ev.date).date()} de {MONTHS[dayjs(ev.date).month()]}
                    </span>
                    {ev.time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {ev.time}
                      </span>
                    )}
                  </div>
                  {ev.description && <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{ev.description}</p>}
                  {ev.link && (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#025dc7] hover:underline"
                    >
                      <ExternalLink size={14} /> Unirse / Abrir
                    </a>
                  )}
                </div>
                {canEdit && (
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => notifyEvent(ev)}
                      disabled={notifying === ev.id}
                      className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        notifying === ev.id
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-[#025dc7] hover:bg-[#F0F5FF]'
                      }`}
                      title="Avisar a los alumnos por email"
                    >
                      <Mail size={14} /> {notifying === ev.id ? 'Enviando…' : 'Avisar'}
                    </button>
                    <button onClick={() => setEditing(ev)} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Editar evento">
                      <Pencil size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editing && (
        <EventModal
          event={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={saveEvent}
          onDelete={events.some((e) => e.id === editing.id) ? () => deleteEvent(editing.id) : undefined}
        />
      )}
    </GeneralWrapperStyled>
  )
}

function EventModal({
  event,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  event: LhEvent
  saving: boolean
  onClose: () => void
  onSave: (e: LhEvent) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<LhEvent>(event)
  const set = (k: keyof LhEvent, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4" style={{ zIndex: 60 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl nice-shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{onDelete ? 'Editar evento' : 'Nuevo evento'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Clase semanal A0-A1" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30" />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input type="time" value={form.time || ''} onChange={(e) => set('time', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enlace (Zoom, Meet…)</label>
            <input value={form.link || ''} onChange={(e) => set('link', e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/30 resize-y" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button onClick={onDelete} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50">
              <Trash2 size={15} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
            <button onClick={() => onSave(form)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#1D0084] text-sm font-semibold hover:bg-[#6cb5ff] disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
