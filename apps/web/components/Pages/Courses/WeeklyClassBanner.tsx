'use client'

import React, { useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { updateOrgWeeklyClassBannerConfig } from '@services/settings/org'
import { CalendarDays, Clock, User, Timer, Radio, ListVideo, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { WEEKDAYS, nextBroadcastLabel } from '@/lib/course/weeklyClass'

const DEFAULTS = {
  title: 'Clases semanales',
  subtitle:
    'Cada semana nos vemos en directo para repasar la formación, resolver tus dudas y practicar hablando holandés. Si no puedes asistir, la clase queda grabada aquí para siempre.',
  live_url: '',
  next_day: 'Por confirmar',
  schedule: 'Por confirmar',
  teacher: 'Por confirmar',
  duration: 'Por confirmar',
}

// EXACTAMENTE el mismo fondo que la barra lateral (OrgSidebar): misma imagen de
// marca, misma capa azul y los mismos puntitos. Antes era un azul plano más
// oscuro y, al lado de la barra, cantaba que no eran la misma marca.
const NAWAR_BG: React.CSSProperties = {
  backgroundColor: '#0b2da0',
  backgroundImage:
    'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px), ' +
    'linear-gradient(rgba(9,30,150,0.45), rgba(9,30,150,0.45)), ' +
    "url('/fondo-barra.png')",
  backgroundSize: '22px 22px, cover, cover',
  backgroundPosition: '0 0, center, center',
  backgroundRepeat: 'repeat, no-repeat, no-repeat',
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-xl px-3.5 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 text-[#4da3ff] mb-1">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4da3ff]">{label}</span>
      </div>
      <p className="text-[15px] font-semibold text-white leading-snug break-words tracking-normal">{value || '—'}</p>
    </div>
  )
}

export default function WeeklyClassBanner() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const orgId = org?.id
  const stored = org?.config?.config?.weekly_class_banner || {}

  const [data, setData] = useState({
    title: stored.title ?? '',
    subtitle: stored.subtitle ?? '',
    live_url: stored.live_url ?? '',
    next_day: stored.next_day ?? '',
    // Día de la semana ('4' = jueves): con esto el banner calcula solo la fecha
    // de la próxima clase, sin tener que cambiarla cada semana.
    next_weekday: stored.next_weekday ?? '',
    // Fecha concreta (AAAA-MM-DD) para una clase suelta o un cambio puntual.
    next_date: stored.next_date ?? '',
    schedule: stored.schedule ?? '',
    teacher: stored.teacher ?? '',
    duration: stored.duration ?? '',
  })
  const [draft, setDraft] = useState(data)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const v = {
    title: data.title.trim() || DEFAULTS.title,
    subtitle: data.subtitle.trim() || DEFAULTS.subtitle,
    live_url: data.live_url.trim(),
    next_day: nextBroadcastLabel(
      data.next_weekday,
      data.next_date,
      data.next_day.trim() || DEFAULTS.next_day
    ),
    schedule: data.schedule.trim() || DEFAULTS.schedule,
    teacher: data.teacher.trim() || DEFAULTS.teacher,
    duration: data.duration.trim() || DEFAULTS.duration,
  }

  function startEdit() {
    setDraft(data)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateOrgWeeklyClassBannerConfig(String(orgId), draft, session?.data?.tokens?.access_token)
      setData(draft)
      setEditing(false)
      toast.success('Banner actualizado')
    } catch {
      toast.error('No se pudo guardar el banner')
    } finally {
      setSaving(false)
    }
  }

  function goToRecordings() {
    if (typeof document !== 'undefined') {
      document.getElementById('sesiones-grabadas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (editing) {
    const field = (
      key: keyof typeof draft,
      label: string,
      opts: { textarea?: boolean; placeholder?: string } = {}
    ) => (
      <div>
        <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">{label}</label>
        {opts.textarea ? (
          <textarea
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            rows={3}
            placeholder={opts.placeholder}
            className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7] resize-y"
          />
        ) : (
          <input
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            placeholder={opts.placeholder}
            className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7]"
          />
        )}
      </div>
    )
    return (
      <div className="w-full rounded-2xl bg-white nice-shadow border border-[#DDE6F5] p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#1D0084]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>
          Editar banner de clases semanales
        </h3>
        {field('title', 'Título')}
        {field('subtitle', 'Subtítulo', { textarea: true })}
        {field('live_url', 'Enlace del directo (Ir al directo)', { placeholder: 'https://… (Zoom, Meet, YouTube en directo)' })}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">
              Día de la semana
            </label>
            <select
              value={draft.next_weekday}
              onChange={(e) => setDraft({ ...draft, next_weekday: e.target.value })}
              className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7] bg-white"
            >
              <option value="">Sin día fijo</option>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#5A6480] uppercase tracking-wide mb-1">
              Fecha concreta (opcional)
            </label>
            <input
              type="date"
              value={draft.next_date}
              onChange={(e) => setDraft({ ...draft, next_date: e.target.value })}
              className="w-full text-[13px] rounded-lg border border-[#DDE6F5] px-3 py-2 text-gray-800 focus:outline-none focus:border-[#025dc7]"
            />
          </div>
        </div>
        <p className="text-[12px] text-[#5A6480] leading-relaxed">
          Con el día de la semana basta: el banner enseña solo la fecha de la
          próxima ({nextBroadcastLabel(draft.next_weekday, draft.next_date, '—')})
          y se actualiza cada semana. La fecha concreta manda por encima — úsala
          para una clase suelta o si un día cambia.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {field('schedule', 'Horario', { placeholder: '19:00 (CET)' })}
          {field('teacher', 'Profe(s)', { placeholder: 'Paul' })}
          {field('duration', 'Duración', { placeholder: '60 min' })}
          {field('next_day', 'Texto libre (si no usas fecha)', { placeholder: 'Por confirmar' })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#0a1656] text-[13px] font-semibold hover:bg-[#6cb5ff] transition-colors disabled:opacity-50"
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
    )
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden ring-1 ring-inset ring-black/10 shadow-xl text-white" style={NAWAR_BG}>
      {/* Botón editar (solo admin) */}
      <AuthenticatedClientElement ressourceType="courses" action="update" checkMethod="roles" orgId={orgId}>
        <button
          onClick={startEdit}
          title="Editar banner"
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil size={12} /> Editar
        </button>
      </AuthenticatedClientElement>

      <div className="flex flex-col lg:flex-row gap-6 p-6 sm:p-8">
        {/* Izquierda: título + subtítulo + botones */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h2
            className="text-[24px] sm:text-[30px] font-bold leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
          >
            {v.title}
          </h2>
          <p className="mt-2 text-[14px] sm:text-[15px] text-white/80 leading-relaxed tracking-normal max-w-xl">{v.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {v.live_url ? (
              <a
                href={v.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-white font-bold py-2.5 px-4 rounded-lg text-[14px] transition-colors"
              >
                <Radio size={16} strokeWidth={2.5} /> Ir al directo
              </a>
            ) : (
              <button
                onClick={() => toast('El enlace del directo aún no está configurado.')}
                className="inline-flex items-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-white font-bold py-2.5 px-4 rounded-lg text-[14px] transition-colors"
              >
                <Radio size={16} strokeWidth={2.5} /> Ir al directo
              </button>
            )}
            <button
              onClick={goToRecordings}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold py-2.5 px-4 rounded-lg text-[14px] transition-colors"
            >
              <ListVideo size={16} /> Clases anteriores
            </button>
          </div>
        </div>

        {/* Derecha: 4 bloques */}
        <div className="grid grid-cols-2 gap-2.5 lg:w-[340px] shrink-0 content-center">
          <InfoBlock icon={<CalendarDays size={14} />} label="Próxima emisión" value={v.next_day} />
          <InfoBlock icon={<Clock size={14} />} label="Horario" value={v.schedule} />
          <InfoBlock icon={<User size={14} />} label="Profe" value={v.teacher} />
          <InfoBlock icon={<Timer size={14} />} label="Duración" value={v.duration} />
        </div>
      </div>
    </div>
  )
}
