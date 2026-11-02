'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { CalendarDays, User, Timer, Radio, ListVideo, Pencil, Check, X, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { WEEKDAYS, nextBroadcastLabel } from '@/lib/course/weeklyClass'
import { CURSO_CLASE_SEMANAL_UUID, ajustesDirecto } from '@/lib/nawar/cursos'
import { getSala, guardarRecuadro, rutaSala } from '@services/salas/salas'

// Cada clase en directo tiene su recuadro (27/10/2026: la clase semanal se
// parte en dos grupos, cada uno con su día y su profe). Se guarda por curso en
// org_config `salas[curso].banner`. La clase semanal de siempre lee el
// recuadro viejo de toda la escuela (`weekly_class_banner`) mientras no se
// guarde el suyo, así que no cambia nada hasta que se edite.
const POR_CONFIRMAR = 'Por confirmar'

/**
 * Debajo de la portada del curso, sin marco: cuándo es la próxima clase y con
 * quién, y un botón grande para entrar. Nació en la Masterclass (27/10/2026,
 * "quitar ese bloque y ponerlo en línea… que se vea claro un botón para
 * entrar") y el 28/10 pasó a TODAS las clases en directo, la clase semanal de
 * siempre incluida ("cambiar el banner antiguo por el nuevo"). El recuadro
 * viejo (subtítulo y cuatro bloques en una tarjeta) se quitó.
 */
export default function WeeklyClassBanner({
  courseUuid,
  grabadas = true,
}: {
  courseUuid: string
  /** La página enseña las clases grabadas: si no, fuera «Clases anteriores» (27/10). */
  grabadas?: boolean
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isStaff } = useAdminStatus()
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const ajustes = ajustesDirecto(org?.config?.config, curso)
  const esLaDeSiempre = curso === CURSO_CLASE_SEMANAL_UUID
  const stored: any = ajustes.banner || (esLaDeSiempre ? org?.config?.config?.weekly_class_banner : null) || {}
  // Con la sala encendida, «Ir a la clase» lleva a la sala de la escuela, no
  // al enlace de Zoom. Y se enseña quién hay dentro.
  const [dentro, setDentro] = useState<string[]>([])

  useEffect(() => {
    if (!ajustes.activo || !token || !curso) return
    let vivo = true
    const leer = () =>
      getSala(curso, token)
        .then((s) => vivo && setDentro(s.presentes || []))
        .catch(() => {})
    leer()
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') leer()
    }, 30000)
    return () => {
      vivo = false
      window.clearInterval(t)
    }
  }, [ajustes.activo, token, curso])

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

  const liveUrl = data.live_url.trim()
  const proxima = nextBroadcastLabel(data.next_weekday, data.next_date, data.next_day.trim() || POR_CONFIRMAR)

  function startEdit() {
    setDraft(data)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await guardarRecuadro(curso, draft, token)
      setData(draft)
      setEditing(false)
      toast.success('Recuadro actualizado')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el recuadro')
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
        <label className="block text-[11px] font-semibold text-[#5A6480] uppercase tracking-wide mb-1">{label}</label>
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
          Editar el recuadro de esta clase
        </h3>
        {/* El título ya no vive aquí: es el nombre del curso, que se cambia
            en los ajustes del curso. Tener dos sitios para lo mismo acababa
            siempre en dos títulos distintos, uno encima del otro. Tampoco el
            subtítulo: la franja no lo enseña (la clase semanal enseña la
            descripción del curso debajo). */}
        {ajustes.activo ? (
          <p className="text-[12px] text-[#5A6480] leading-relaxed">
            «Ir a la clase» lleva a la sala de la escuela (está encendida), así que no hace falta enlace de Zoom.
          </p>
        ) : (
          field('live_url', 'Enlace del directo (Ir a la clase)', { placeholder: 'https://… (Zoom, Meet, YouTube en directo)' })
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#5A6480] uppercase tracking-wide mb-1">
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
            <label className="block text-[11px] font-semibold text-[#5A6480] uppercase tracking-wide mb-1">
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

  // El mismo «Ir a la clase» en las dos formas: a la sala si está encendida,
  // si no al enlace de Zoom, y si no hay nada, un aviso.
  function botonEntrar(className: string, texto: string) {
    const contenido = (
      <>
        <Radio size={17} strokeWidth={2.5} /> {texto}
      </>
    )
    if (ajustes.activo) {
      return (
        <Link href={rutaSala(curso)} className={className}>
          {contenido}
        </Link>
      )
    }
    if (liveUrl) {
      return (
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={className}>
          {contenido}
        </a>
      )
    }
    return (
      <button onClick={() => toast('El enlace del directo aún no está configurado.')} className={className}>
        {contenido}
      </button>
    )
  }

  // Sin recuadro ni dos columnas (27/10, segunda vuelta: "quitar el marco
  // y ponerlo en línea"): debajo de la portada, como debajo de un vídeo de
  // YouTube, una línea con cuándo, otra con quién, y el botón. Solo lo que
  // se ha rellenado: «Con Por confirmar» no dice nada. Letra gruesa (27/10,
  // "esta letra tan fina no me convence"): la fecha en negrita, no semibold.
  const hora = data.schedule.trim()
  const cuando = hora ? `${proxima} · ${hora}` : proxima
  const profe = data.teacher.trim()
  const duracion = data.duration.trim()
  const enDirecto = ajustes.activo && dentro.length > 0
  return (
    <div className="w-full pt-1">
      {enDirecto ? (
        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#15803D]">
          <Circle size={8} className="fill-[#16A34A] text-[#16A34A]" /> En directo ahora
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#025dc7]">
          <CalendarDays size={13} /> Próxima emisión
        </p>
      )}
      <p
        className="mt-1 text-[23px] sm:text-[28px] font-bold tracking-[-0.01em] text-gray-900 leading-tight break-words first-letter:uppercase"
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        {cuando}
      </p>
      {(profe || duracion || enDirecto) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] font-medium text-[#1F2937]">
          {profe && (
            <span className="inline-flex items-center gap-1.5">
              <User size={16} className="text-[#025dc7]" /> Con {profe}
            </span>
          )}
          {duracion && (
            <span className="inline-flex items-center gap-1.5">
              <Timer size={16} className="text-[#025dc7]" /> {duracion}
            </span>
          )}
          {enDirecto && (
            <span className="min-w-0 truncate">
              {dentro.length === 1 ? '1 persona en la sala' : `${dentro.length} personas en la sala`}
            </span>
          )}
        </p>
      )}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        {botonEntrar(
          'inline-flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-3.5 px-8 rounded-lg text-[15px] transition-colors',
          enDirecto ? 'Entrar ahora' : 'Entrar a la clase'
        )}
        <div className="flex items-center justify-center sm:justify-start gap-4">
          {grabadas ? (
            <button
              onClick={goToRecordings}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#025dc7] hover:text-[#1D0084] transition-colors"
            >
              <ListVideo size={15} /> Clases anteriores
            </button>
          ) : null}
          {/* El recuadro (día, hora, profe) lo cambia el equipo, también los profes (02/11/2026). */}
          {isStaff ? (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5A6480] hover:text-[#025dc7] transition-colors"
            >
              <Pencil size={13} /> Editar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
