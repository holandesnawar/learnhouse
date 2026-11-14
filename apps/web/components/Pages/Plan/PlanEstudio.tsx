'use client'
/**
 * El plan de estudio del alumno (14/11/2026): para qué quiere el neerlandés y
 * qué días se propone estudiar. Servidor: apps/api/src/services/plan/plan.py.
 *
 * - `VentanaPlan`: las dos preguntas, en una ventana.
 * - `PlanEnInicio`: la tarjeta fija del Inicio. Sin rellenar, pide hacerlo (y
 *   abre la ventana sola UNA vez a quien ya estaba en la escuela); rellenado,
 *   enseña el objetivo y cómo va la semana.
 * - `usePlan`: lo mismo para «Empieza aquí».
 *
 * El objetivo es semanal («3 días esta semana»), no una racha diaria.
 */
import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, Loader2, Target } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { DIAS_CORTOS, diasEnTexto, getPlan, guardarPlan, type MiPlan } from '@services/student/plan'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const VISTA = 'nawar.plan.ventana'
const HORAS = ['07:00', '08:00', '09:00', '12:00', '13:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

export function usePlan() {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const q = useQuery<MiPlan | null>({
    queryKey: ['student', 'plan'],
    queryFn: () => getPlan(token),
    enabled: !!token,
    staleTime: 60_000,
  })
  return { ...q, token }
}

export function VentanaPlan({ inicial, onCerrar }: { inicial: MiPlan; onCerrar: () => void }) {
  const { token } = usePlan()
  const qc = useQueryClient()
  const p = inicial.plan
  const [objetivo, setObjetivo] = useState(p.objetivo)
  const [texto, setTexto] = useState(p.objetivo_texto)
  const [dias, setDias] = useState<number[]>(p.dias.length ? p.dias : [0, 2, 5])
  const [hora, setHora] = useState(p.hora || '20:00')
  const [minutos, setMinutos] = useState(p.minutos || 15)
  const [recordar, setRecordar] = useState(p.recordar)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const elegido = inicial.opciones.objetivos.find((o) => o.id === objetivo)

  const guardar = async () => {
    setOcupado(true)
    setError('')
    try {
      const d = await guardarPlan({ objetivo, objetivo_texto: texto, dias, hora, minutos, recordar }, token)
      qc.setQueryData(['student', 'plan'], d)
      onCerrar()
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }
  const pastilla = (on: boolean) =>
    `rounded-lg border text-[14px] font-semibold transition-colors ${on ? 'border-[#0b2da0] bg-[#0b2da0] text-white' : 'border-[#DDE3F0] bg-white text-[#0B1033] hover:border-[#B9C4E0]'}`

  return (
    <EnElCuerpo>
      <div className="fixed inset-0 z-[998] bg-[#0B1033]/45 flex items-end sm:items-center justify-center sm:p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tu plan"
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-[560px] max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl px-5 sm:px-7 py-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[21px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                Tu plan
              </h2>
              <p className="mt-1 text-[14px] text-[#4A5272]">Dos preguntas. Las puedes cambiar cuando quieras.</p>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 p-1.5 -mr-1.5 text-[#6B7393] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>

          <p className="mt-5 text-[15px] font-semibold text-[#0B1033]">1. ¿Para qué quieres el neerlandés?</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {inicial.opciones.objetivos.map((o) => (
              <button key={o.id} type="button" onClick={() => setObjetivo(o.id)} className={`${pastilla(objetivo === o.id)} px-3 py-2.5 text-left text-[13.5px] sm:text-[14px] leading-snug`}>
                {o.nombre}
              </button>
            ))}
          </div>
          {objetivo ? (
            <div className="mt-3">
              <label className="block text-[13px] font-semibold text-[#3B4262] mb-1.5">
                {objetivo === 'otro' ? 'Cuéntalo en una frase' : 'Si quieres, dilo con tus palabras'}
              </label>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={240}
                placeholder={elegido?.ejemplo || 'Lo que quiero poder hacer'}
                className="w-full h-11 rounded-lg border border-[#DDE3F0] px-3 text-[14.5px] text-[#0B1033] placeholder:text-[#9AA1BC] outline-none focus:border-[#0b2da0]"
              />
            </div>
          ) : null}

          <p className="mt-6 text-[15px] font-semibold text-[#0B1033]">2. ¿Qué días te viene bien estudiar?</p>
          <p className="mt-0.5 text-[13.5px] text-[#6B7393]">Mejor pocos días que cumplas que muchos que no.</p>
          <div className="mt-2.5 flex gap-1.5">
            {DIAS_CORTOS.map((d, i) => {
              const on = dias.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDias((v) => (on ? v.filter((x) => x !== i) : [...v, i]))}
                  className={`${pastilla(on)} flex-1 h-11`}
                >
                  {d}
                </button>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[13px] font-semibold text-[#3B4262] mb-1.5">A qué hora</span>
              <select value={hora} onChange={(e) => setHora(e.target.value)} className="w-full h-11 rounded-lg border border-[#DDE3F0] bg-white px-3 text-[14.5px] text-[#0B1033] outline-none focus:border-[#0b2da0]">
                {(HORAS.includes(hora) ? HORAS : [...HORAS, hora].sort()).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[13px] font-semibold text-[#3B4262] mb-1.5">Cuánto rato</span>
              <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} className="w-full h-11 rounded-lg border border-[#DDE3F0] bg-white px-3 text-[14.5px] text-[#0B1033] outline-none focus:border-[#0b2da0]">
                {inicial.opciones.minutos.map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-[#0b2da0]" />
            <span className="text-[14px] text-[#0B1033]">
              Recuérdamelo por correo si ese día no he entrado
              <span className="block text-[13px] text-[#6B7393]">Solo tus días, a tu hora, y como mucho uno al día.</span>
            </span>
          </label>

          {error ? <p className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-[13.5px]">{error}</p> : null}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={onCerrar} className="h-11 px-4 text-[14.5px] font-semibold text-[#4A5272] hover:text-[#0B1033]">
              Ahora no
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado || !objetivo || !dias.length}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#0b2da0] text-white text-[14.5px] font-semibold hover:bg-[#0a2690] disabled:opacity-50"
            >
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : null} Guardar mi plan
            </button>
          </div>
        </div>
      </div>
    </EnElCuerpo>
  )
}

/** Los siete días de esta semana: los suyos marcados, los que entró con check. */
function Semana({ d, repartida = false }: { d: MiPlan; repartida?: boolean }) {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return (
    <div className={repartida ? 'flex justify-between' : 'flex gap-1.5'}>
      {DIAS_CORTOS.map((l, i) => {
        const f = new Date(lunes)
        f.setDate(lunes.getDate() + i)
        const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
        const entro = d.semana.dias.includes(iso)
        const suyo = d.plan.dias.includes(i)
        return (
          <span
            key={i}
            title={entro ? 'Entraste' : suyo ? 'Uno de tus días' : ''}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 bg-white ${
              entro ? 'border-[#16A34A] text-[#16A34A]' : suyo ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-dashed border-[#D5DBEA] text-[#9AA1BC]'
            }`}
          >
            {entro ? <Check size={15} strokeWidth={3.2} /> : l}
          </span>
        )
      })}
    </div>
  )
}

export function PlanEnInicio({ soloAlumno = true }: { soloAlumno?: boolean }) {
  const { data } = usePlan()
  const [abierta, setAbierta] = useState(false)

  // A quien ya estaba en la escuela se le abre sola UNA vez (se recuerda en
  // este navegador); después queda la tarjeta, que no se va hasta rellenarlo.
  useEffect(() => {
    if (!data || data.rellenado || !soloAlumno) return
    let visto = false
    try {
      visto = !!localStorage.getItem(VISTA)
      // No encima de la visita guiada: primero la visita, otro día esto.
      if (!localStorage.getItem('nawar.visita')) return
    } catch {}
    if (visto) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(VISTA, '1')
      } catch {}
      setAbierta(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [data, soloAlumno])

  if (!data) return null
  const ventana = abierta ? <VentanaPlan inicial={data} onCerrar={() => setAbierta(false)} /> : null

  if (!data.rellenado) {
    return (
      <div className="rounded-2xl border border-[#C9D4EC] bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <Target size={30} strokeWidth={1.6} className="shrink-0 text-[#0b2da0]" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-[#0B1033]" style={POPPINS}>
            ¿Para qué quieres el neerlandés?
          </p>
          <p className="mt-0.5 text-[14px] text-[#4A5272]">Dinos tu objetivo y qué días vas a estudiar. Son dos preguntas.</p>
        </div>
        <button type="button" onClick={() => setAbierta(true)} className="shrink-0 self-start sm:self-auto h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690]">
          Hacer mi plan
        </button>
        {ventana}
      </div>
    )
  }

  // Rellenado, vive en el lateral, junto a la racha (PlanLateral, 14/11/2026:
  // «quedaría mejor en el sitio de la racha, no tan arriba»).
  return null
}

function fraseDe(data: MiPlan): string {
  const s = data.semana
  return s.cumplida
    ? 'Semana cumplida.'
    : s.hoy_toca
      ? `Hoy es uno de tus días: ${data.plan.minutos} minutos.`
      : s.proximo
        ? `Tu próximo día es el ${s.proximo}.`
        : `Te quedan ${Math.max(0, s.meta - s.hechos)} para llegar a tus ${s.meta}.`
}

/**
 * La columna de la derecha del Inicio: el objetivo con sus días de la semana.
 * Sustituye a «Tu racha esta semana» (las dos eran una fila de días con
 * checks). Sin plan hecho, enseña la racha de siempre (`sinPlan`).
 */
export function PlanLateral({ sinPlan }: { sinPlan: React.ReactNode }) {
  const { data } = usePlan()
  const [abierta, setAbierta] = useState(false)
  if (!data || !data.rellenado) return <>{sinPlan}</>
  const s = data.semana
  return (
    <div className="rounded-2xl border border-[#E4E8F2] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">Tu objetivo</p>
          <p className="mt-1 text-[15px] font-bold text-[#0B1033] leading-snug" style={POPPINS}>
            {data.plan.objetivo_texto || data.objetivo_nombre}
          </p>
        </div>
        <button type="button" onClick={() => setAbierta(true)} className="shrink-0 text-[13px] font-semibold text-[#0b2da0] hover:underline">
          Cambiar
        </button>
      </div>
      <div className="mt-3">
        <Semana d={data} repartida />
      </div>
      <p className="mt-3 text-[13.5px] text-[#0B1033]">
        <span className="font-semibold tabular-nums">
          {Math.min(s.hechos, s.meta)} de {s.meta} días esta semana.
        </span>{' '}
        <span className={s.cumplida ? 'text-[#16A34A] font-semibold' : 'text-[#4A5272]'}>{fraseDe(data)}</span>
      </p>
      <p className="mt-1.5 text-[12.5px] text-[#6B7393] leading-snug">
        {diasEnTexto(data.plan.dias)} a las {data.plan.hora}, {data.plan.minutos} min
        {data.plan.recordar ? ' · te lo recordamos por correo' : ''}
      </p>
      {abierta ? <VentanaPlan inicial={data} onCerrar={() => setAbierta(false)} /> : null}
    </div>
  )
}
