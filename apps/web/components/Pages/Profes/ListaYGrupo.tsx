'use client'

/**
 * Dos piezas de «Mis clases» (07/11/2026):
 *
 * - `PasarLista`: la ventana con la lista de la clase de esa semana, una
 *   casilla por alumno. Lo que marca el profe se guarda en la escuela y cuenta
 *   en Seguimiento semanal y en el Camino de 16 semanas, por encima de lo que
 *   diga la sala de Daily (que sale solo como pista: «estuvo en la sala»).
 * - `TuGrupo`: por dónde va el grupo en la formación, lo que más fallan, sus
 *   consultas, quién es nuevo y quién lleva días sin entrar. Para preparar la
 *   clase sin pedírselo a nadie.
 */

import React, { useEffect, useState } from 'react'
import { Check, Loader2, Users, X, AlertTriangle, MessageCircleQuestion, Sparkles, Moon } from 'lucide-react'
import { getGrupo, getLista, pasarLista, diaCorto, type GrupoClase, type ListaClase } from '@services/tareas/tareas'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

export function PasarLista({
  semanaId,
  tema,
  curso,
  token,
  onCerrar,
  onGuardada,
}: {
  semanaId: number
  tema: string
  curso: string
  token: string
  onCerrar: () => void
  onGuardada: (vinieron: number) => void
}) {
  const [lista, setLista] = useState<ListaClase | null>(null)
  const [marcas, setMarcas] = useState<Record<string, boolean | null>>({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    getLista(semanaId, token)
      .then((l) => {
        if (!vivo) return
        setLista(l)
        const m: Record<string, boolean | null> = {}
        // Sin lista pasada, se propone lo que vio la sala (si se sabe).
        for (const a of l.alumnos) m[String(a.user_id)] = a.fue !== null ? a.fue : l.pasada ? null : a.en_sala === true ? true : null
        setMarcas(m)
      })
      .catch((e) => vivo && setError(e?.message || 'No se ha podido abrir la lista'))
    return () => {
      vivo = false
    }
  }, [semanaId, token])

  const alumnos = lista?.alumnos || []
  const vinieron = Object.values(marcas).filter((v) => v === true).length
  const sinMarcar = alumnos.filter((a) => marcas[String(a.user_id)] == null).length

  function poner(uid: number, v: boolean) {
    setMarcas((m) => ({ ...m, [String(uid)]: m[String(uid)] === v ? null : v }))
  }
  function todos(v: boolean) {
    const m: Record<string, boolean> = {}
    for (const a of alumnos) m[String(a.user_id)] = v
    setMarcas(m)
  }

  async function guardar() {
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      // Quien se queda sin marcar cuenta como «no vino»: la lista se pasa entera.
      const enviar: Record<string, boolean | null> = {}
      for (const a of alumnos) enviar[String(a.user_id)] = marcas[String(a.user_id)] === true
      const r = await pasarLista(semanaId, enviar, token)
      onGuardada(r.vinieron)
    } catch (e: any) {
      setError(e?.message || 'No se ha podido guardar')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#0a1656]/40 p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pasar lista"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#EEF2F9]">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8A94AD]">Pasar lista</p>
            <h3 className="text-[17px] font-bold text-[#0a1656] leading-snug" style={POPPINS}>
              {tema || 'Clase sin tema'}
            </h3>
            <p className="text-[12.5px] text-[#6B7280]">
              {curso}
              {lista?.semana.fecha ? ` · ${diaCorto(lista.semana.fecha)}` : ''}
            </p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F5FD]" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!lista && !error ? (
            <p className="py-8 text-center text-[13.5px] text-[#6B7280]">
              <Loader2 size={16} className="inline animate-spin mr-1.5" /> Abriendo la lista…
            </p>
          ) : null}
          {lista && !lista.se_puede ? (
            <p className="rounded-lg bg-[#FFFBF2] px-3 py-2.5 text-[13px] text-[#8A6A2A]">
              La lista se pasa el día de la clase o después.
            </p>
          ) : null}
          {lista && lista.se_puede ? (
            <>
              <div className="flex items-center justify-between gap-2 pb-2">
                <p className="text-[12.5px] text-[#4B5563]">
                  {alumnos.length === 1 ? '1 alumno' : `${alumnos.length} alumnos`} · marca quién vino
                </p>
                <div className="flex gap-1.5">
                  <button onClick={() => todos(true)} className="h-7 px-2.5 rounded-md bg-[#EEF3FF] text-[12px] font-semibold text-[#0b2da0]">
                    Vinieron todos
                  </button>
                  <button onClick={() => todos(false)} className="h-7 px-2.5 rounded-md bg-[#F3F4F6] text-[12px] font-semibold text-[#4B5563]">
                    Ninguno
                  </button>
                </div>
              </div>
              {alumnos.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#8A94AD]">Esta clase no tiene alumnos todavía.</p>
              ) : (
                <ul className="divide-y divide-[#EEF2F9]">
                  {alumnos.map((a) => {
                    const v = marcas[String(a.user_id)]
                    return (
                      <li key={a.user_id} className="flex items-center gap-3 py-2.5">
                        <button
                          onClick={() => poner(a.user_id, true)}
                          className={`w-7 h-7 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            v === true ? 'bg-[#16A34A] border-[#16A34A]' : 'border-[#CBD5E1] hover:border-[#16A34A]'
                          }`}
                          aria-label={`${a.nombre} vino`}
                          aria-pressed={v === true}
                        >
                          {v === true ? <Check size={16} strokeWidth={3} className="text-white" /> : null}
                        </button>
                        <button onClick={() => poner(a.user_id, true)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[14px] font-medium text-gray-900">{a.nombre}</span>
                          {a.en_sala !== null || a.voy != null ? (
                            <span className="block text-[11.5px] text-[#8A94AD]">
                              {[
                                a.voy === true ? 'Dijo que venía' : a.voy === false ? 'Dijo que no podía' : '',
                                a.en_sala === null ? '' : a.en_sala ? 'la sala le vio dentro' : 'la sala no le vio',
                              ]
                                .filter(Boolean)
                                .join(' · ')
                                .replace(/^./, (x) => x.toUpperCase())}
                            </span>
                          ) : null}
                        </button>
                        <button
                          onClick={() => poner(a.user_id, false)}
                          className={`shrink-0 h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${
                            v === false ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'text-[#8A94AD] hover:bg-[#F3F4F6]'
                          }`}
                          aria-pressed={v === false}
                        >
                          No vino
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : null}
          {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
        </div>

        {lista && lista.se_puede && alumnos.length ? (
          <div className="px-5 py-4 border-t border-[#EEF2F9] pb-24 sm:pb-4">
            <p className="text-[12.5px] text-[#4B5563] mb-2.5">
              {vinieron} de {alumnos.length} vinieron
              {sinMarcar ? ` · ${sinMarcar} sin marcar (cuentan como que no vinieron)` : ''}
              {lista.pasada && lista.por ? ` · la pasó ${lista.por}` : ''}
            </p>
            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b2da0] hover:bg-[#0a2690] py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} Guardar la lista
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TuGrupo({ orgId, courseUuid, curso, color, token }: { orgId: number; courseUuid: string; curso: string; color: string; token: string }) {
  const [g, setG] = useState<GrupoClase | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    setG(null)
    setError('')
    getGrupo(orgId, courseUuid, token)
      .then((d) => vivo && setG(d))
      .catch((e) => vivo && setError(e?.message || 'No se ha podido cargar el grupo'))
    return () => {
      vivo = false
    }
  }, [orgId, courseUuid, token])

  return (
    <section className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold text-[#0a1656] flex items-center gap-2" style={POPPINS}>
          <Users size={19} className="text-[#0b2da0]" /> Tu grupo esta semana
        </h2>
        <span className="inline-flex items-center gap-1.5 min-w-0 text-[12.5px] font-semibold text-[#5A6480]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="truncate">{curso}</span>
        </span>
      </div>

      {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
      {!g && !error ? <p className="mt-3 text-[13px] text-[#6B7280]">Cargando…</p> : null}

      {g ? (
        g.alumnos === 0 ? (
          <p className="mt-3 text-[13.5px] text-[#5A6480]">Esta clase todavía no tiene alumnos.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Por dónde van */}
            <div>
              <p className={ETIQUETA}>En la formación</p>
              {g.mayoria ? (
                <p className="mt-1 text-[14px] text-gray-900">
                  <b>
                    {g.mayoria.n} de {g.alumnos}
                  </b>{' '}
                  van por el <b>{g.mayoria.modulo}</b>
                  {g.mayoria.clase ? <span className="text-[#6B7280]"> · {g.mayoria.clase}</span> : null}
                </p>
              ) : (
                <p className="mt-1 text-[13.5px] text-[#6B7280]">Aún no han empezado la formación.</p>
              )}
              {g.detras.length ? (
                <p className="mt-1.5 text-[13px] text-[#8A6A2A]">
                  Van por detrás: {g.detras.map((d) => `${d.nombre} (${d.modulo})`).join(', ')}
                </p>
              ) : null}
              {g.delante.length ? (
                <p className="mt-1 text-[13px] text-[#4B5563]">
                  Van por delante: {g.delante.map((d) => `${d.nombre} (${d.modulo})`).join(', ')}
                </p>
              ) : null}
            </div>

            {/* Lo que más fallan */}
            <div>
              <p className={ETIQUETA}>Lo que más fallan (3 semanas)</p>
              {g.fallos.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.fallos.map((f) => (
                    <span key={f.palabra} className="inline-flex items-center gap-1 rounded-md bg-[#EEF3FF] px-2 py-1 text-[12.5px] text-[#0B1033]">
                      <AlertTriangle size={12} className="text-[#0b2da0]" /> {f.palabra}
                      <span className="text-[#5A6480] tabular-nums">· {f.alumnos}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[13.5px] text-[#6B7280]">Nada que se repita entre varios alumnos.</p>
              )}
            </div>

            {/* Consultas */}
            <div className="md:col-span-2">
              <p className={ETIQUETA}>Sus consultas (2 semanas)</p>
              {g.consultas.length ? (
                <ul className="mt-1.5 space-y-1.5">
                  {g.consultas.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[13px]">
                      <MessageCircleQuestion size={15} className="shrink-0 mt-0.5 text-[#0b2da0]" />
                      <span className="min-w-0">
                        <b className="text-gray-900">{c.titulo || 'Sin título'}</b>
                        <span className="text-[#6B7280]">
                          {' '}
                          · {c.nombre ? `${c.nombre}, ` : ''}
                          {diaCorto(c.fecha)}
                          {c.respondida ? ' · respondida' : ''}
                        </span>
                        {c.texto ? <span className="block text-[#4B5563] line-clamp-2">{c.texto}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13.5px] text-[#6B7280]">{g.aviso_consultas || 'Ninguna en las últimas dos semanas.'}</p>
              )}
            </div>

            {g.nuevos.length ? (
              <div>
                <p className={ETIQUETA}>Nuevos esta semana</p>
                <p className="mt-1 text-[13.5px] text-gray-900 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#0b2da0] shrink-0" />
                  {g.nuevos.map((n) => n.nombre).join(', ')}
                </p>
              </div>
            ) : null}
            {g.sin_entrar.length ? (
              <div>
                <p className={ETIQUETA}>Más de una semana sin entrar</p>
                <p className="mt-1 text-[13.5px] text-gray-900 flex items-start gap-1.5">
                  <Moon size={14} className="text-[#8A6A2A] shrink-0 mt-0.5" />
                  <span>
                    {g.sin_entrar.map((x) => (x.dias == null ? `${x.nombre} (nunca)` : `${x.nombre} (${x.dias} días)`)).join(', ')}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  )
}

const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94AD]'
