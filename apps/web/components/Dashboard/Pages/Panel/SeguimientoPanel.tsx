'use client'

/**
 * Seguimiento semanal (28/10/2026): una semana de una clase en directo, alumno
 * a alumno (vio la presentación, fue a la clase, ejercicios, tarea, semanas
 * sin nada), lo que queda por corregir con el corrector al lado, y a quién le
 * toca el check-in de las semanas 4, 8 y 12.
 *
 * Vive en el panel (administradores) y en la escuela (`/seguimiento`, para los
 * profes, que no entran al panel). La lógica, en
 * apps/api/src/services/tareas/tareas.py.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import VoiceRecorder from '@components/Pages/Messages/VoiceRecorder'
import AudioPrivado from '@components/Pages/Tareas/AudioPrivado'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import {
  corregirEntrega,
  diaCorto,
  getCheckins,
  getClasesEnDirecto,
  getEntrega,
  getPorCorregir,
  getSeguimiento,
  marcarCheckin,
  reabrirEntrega,
  type CheckinToca,
  type FilaSeguimiento,
  type PorCorregir,
  type Seguimiento,
} from '@services/tareas/tareas'
import { confirmar } from '@lib/nawar/confirmar'
import { BOTON, BOTON_PRINCIPAL, Estado, META, TARJETA } from './ui'
import { FichaAlumno } from './ProgresoPanel'

function haceCuando(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).replace('.', '') +
    ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
}

function Cifra({ k, n, extra }: { k: string; n: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className={`${TARJETA} px-3.5 py-3`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">{k}</p>
      <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-gray-900">
        {n} {extra}
      </p>
    </div>
  )
}

const Si = () => <Check size={16} strokeWidth={3} className="text-[#16A34A]" />
const No = () => <span className="text-[#D1D5DB]">—</span>

function EstadoTarea({ f, onCorregir }: { f: FilaSeguimiento; onCorregir: (id: number) => void }) {
  if (f.tarea === 'corregida')
    return (
      <button onClick={() => f.entrega_id && onCorregir(f.entrega_id)} className="hover:underline">
        <Estado tono="verde">Corregida</Estado>
      </button>
    )
  if (f.tarea === 'entregada')
    return (
      <button onClick={() => f.entrega_id && onCorregir(f.entrega_id)} className="font-medium text-[#B45309] hover:underline">
        <Estado tono="ambar">Por corregir</Estado>
      </button>
    )
  if (f.tarea === 'pendiente') return <span className="text-[12.5px] text-[#9CA3AF]">Sin entregar</span>
  return <No />
}

function Semanas({ f }: { f: FilaSeguimiento }) {
  if (f.sin_nada >= 2) return <span className="text-[12.5px] font-semibold text-[#B91C1C]">{f.sin_nada} semanas sin nada</span>
  if (f.sin_nada === 1) return <span className="text-[12.5px] text-[#B45309]">1 semana sin nada</span>
  return <span className="text-[13px] tabular-nums text-gray-700">{f.seguidas ? `${f.seguidas} seguidas` : '—'}</span>
}

// ── El corrector ────────────────────────────────────────────────────────────

function Corrector({ entregaId, onClose, onHecho }: { entregaId: number; onClose: () => void; onHecho: () => void }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [dato, setDato] = useState<PorCorregir | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [audio, setAudio] = useState<{ blob: Blob; seg: number; url: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setDato(null)
    setError('')
    setAudio(null)
    getEntrega(entregaId, token)
      .then((d) => {
        setDato(d)
        setTexto(d.entrega.correccion_texto || '')
      })
      .catch((e) => setError(e?.message || 'No se pudo abrir'))
  }, [entregaId, token])

  async function guardar() {
    setGuardando(true)
    try {
      await corregirEntrega(entregaId, { texto, audio: audio?.blob || null, audioSeg: audio?.seg || 0 }, token)
      toast.success('Corregida: le llega el aviso en la campana')
      onHecho()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function reabrir() {
    if (!(await confirmar('¿Quitar la corrección? Vuelve a «por corregir» y se borra tu nota de voz.', { boton: 'Quitar la corrección' }))) return
    try {
      await reabrirEntrega(entregaId, token)
      onHecho()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo quitar')
    }
  }

  return (
    <div className={`${TARJETA} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-gray-900 truncate">
            {dato ? `${dato.nombre} · ${dato.tema}` : 'Cargando…'}
          </p>
          {dato ? <p className={META}>Entregó el {haceCuando(dato.entrega.entregada_at)}</p> : null}
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      {dato ? (
        <>
          <details className="text-[12.5px] text-[#4B5563]">
            <summary className="cursor-pointer font-medium">La tarea</summary>
            <p className="mt-1 whitespace-pre-wrap">{dato.enunciado}</p>
          </details>
          {dato.entrega.texto ? (
            <div className="rounded-md bg-[#F9FAFB] px-3 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-gray-900">{dato.entrega.texto}</div>
          ) : (
            <p className={META}>Sin texto.</p>
          )}
          {dato.entrega.tiene_audio ? (
            <AudioPrivado entregaId={dato.entrega.id} cual="alumno" token={token} segundos={dato.entrega.audio_seg} />
          ) : null}

          <div className="border-t border-[#F3F4F6] pt-3 space-y-2">
            <p className="text-[13px] font-semibold text-gray-900">Tu corrección</p>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="Escribe la corrección (opcional)…"
              className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13.5px] outline-none focus:border-gray-900 resize-y"
            />
            {dato.entrega.tiene_correccion_audio && !audio ? (
              <AudioPrivado entregaId={dato.entrega.id} cual="correccion" token={token} segundos={dato.entrega.correccion_audio_seg} />
            ) : null}
            {audio ? (
              <div className="flex items-center gap-2">
                <audio src={audio.url} controls className="h-9 flex-1 min-w-0" />
                <button onClick={() => setAudio(null)} className={BOTON}>
                  Quitar
                </button>
              </div>
            ) : (
              <VoiceRecorder
                textoGrabar={dato.entrega.tiene_correccion_audio ? 'Grabar otra nota de voz' : 'Corregir con nota de voz'}
                etiqueta="Usar esta grabación"
                sending={false}
                onSend={async (blob, seg) => setAudio({ blob, seg, url: URL.createObjectURL(blob) })}
              />
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={guardar} disabled={guardando} className={BOTON_PRINCIPAL}>
                {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                {dato.entrega.estado === 'corregida' ? 'Guardar la corrección' : 'Marcar corregida'}
              </button>
              {dato.entrega.estado === 'corregida' ? (
                <button onClick={reabrir} className={BOTON}>
                  Quitar la corrección
                </button>
              ) : null}
              <span className={META}>Sin texto ni voz también vale: «visto, todo bien».</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ── Check-in ────────────────────────────────────────────────────────────────

function Checkins({ lista, onHecho }: { lista: CheckinToca[]; onHecho: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const yo: string = session?.data?.user?.first_name || ''
  const [abierto, setAbierto] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (!lista.length) return null

  async function hecho(a: CheckinToca) {
    setGuardando(true)
    try {
      await marcarCheckin(org.id, { user_id: a.user_id, hito: a.hito, nota }, token)
      toast.success(`Check-in de ${a.nombre.split(' ')[0]} apuntado`)
      setAbierto(null)
      setNota('')
      onHecho()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo apuntar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`${TARJETA}`}>
      <div className="px-4 pt-3.5 pb-2">
        <p className="text-[14px] font-semibold text-gray-900">
          Check-in de esta semana <span className="font-normal text-[#6B7280]">· {lista.length}</span>
        </p>
        <p className={META}>Semanas 4, 8 y 12 de su camino: un mensaje corto para ver cómo van y qué les cuesta.</p>
      </div>
      <div className="divide-y divide-[#F3F4F6]">
        {lista.map((a) => {
          const nombre = a.nombre.split(' ')[0]
          const texto = encodeURIComponent(
            `Hola ${nombre}, soy ${yo || 'del equipo'} de Holandés Nawar. Ya llevas ${a.semana} semanas con nosotros: ¿cómo lo llevas? ¿Hay algo que te esté costando más?`
          )
          const num = numeroWhatsApp(a.telefono)
          return (
            <div key={a.user_id} className="px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-gray-900 truncate">{a.nombre}</p>
                  <p className={META}>
                    Semana {a.semana} de 16 · check-in de la semana {a.hito}
                    {a.atrasado ? ' · con retraso' : ''}
                    {a.ultimo ? ` · el anterior: ${a.ultimo.autor || 'equipo'}` : ''}
                  </p>
                </div>
                {num ? (
                  <a href={`https://wa.me/${num}?text=${texto}`} target="_blank" rel="noreferrer" className={BOTON}>
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                ) : null}
                <button onClick={() => setAbierto(abierto === a.user_id ? null : a.user_id)} className={BOTON}>
                  <Check size={13} /> Hecho
                </button>
              </div>
              {abierto === a.user_id ? (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Cómo va (opcional): sale en su ficha"
                    className="flex-1 h-8 rounded-md border border-[#D1D5DB] px-2.5 text-[13px] outline-none focus:border-gray-900"
                  />
                  <button onClick={() => hecho(a)} disabled={guardando} className={BOTON_PRINCIPAL}>
                    {guardando ? <Loader2 size={13} className="animate-spin" /> : null} Apuntar
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── La pantalla ─────────────────────────────────────────────────────────────

function leerUrl(nombre: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(nombre) || ''
}

export default function SeguimientoPanel({ enEscuela = false }: { enEscuela?: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [clases, setClases] = useState<{ uuid: string; nombre: string }[] | null>(null)
  const [clase, setClase] = useState('')
  const [semanaId, setSemanaId] = useState<number | null>(null)
  const [datos, setDatos] = useState<Seguimiento | null>(null)
  const [pendientes, setPendientes] = useState<PorCorregir[]>([])
  const [checkins, setCheckins] = useState<CheckinToca[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null)
  const [ficha, setFicha] = useState<FilaSeguimiento | null>(null)

  // Las clases, y la que pide la dirección (desde «Seguimiento» de una semana).
  useEffect(() => {
    if (!org?.id || !token) return
    getClasesEnDirecto(org.id, token)
      .then((r) => {
        setClases(r.clases)
        const pedida = leerUrl('clase')
        const s = Number(leerUrl('semana')) || null
        setClase(r.clases.find((c) => c.uuid === pedida)?.uuid || r.clases[0]?.uuid || '')
        if (s) setSemanaId(s)
      })
      .catch((e) => setError(e?.message || 'No se pudieron cargar las clases'))
  }, [org?.id, token])

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    setCargando(true)
    try {
      const [p, c] = await Promise.all([getPorCorregir(org.id, token), getCheckins(org.id, token)])
      setPendientes(p.entregas)
      setCheckins(c.toca)
      if (clase) setDatos(await getSeguimiento(org.id, clase, semanaId, token))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar')
    } finally {
      setCargando(false)
    }
  }, [org?.id, token, clase, semanaId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filas = datos?.alumnos ?? []
  const sinEntregar = useMemo(() => filas.filter((f) => f.tarea === 'pendiente').length, [filas])
  const descolgados = useMemo(() => filas.filter((f) => f.sin_nada >= 2).length, [filas])
  const c = datos?.cifras

  if (!clases) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={22} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={clase} onChange={(e) => { setClase(e.target.value); setSemanaId(null) }} className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13px] font-medium">
          {clases.map((x) => (
            <option key={x.uuid} value={x.uuid}>
              {x.nombre}
            </option>
          ))}
        </select>
        {datos?.semanas.length ? (
          <select
            value={datos.semana?.id ?? ''}
            onChange={(e) => setSemanaId(Number(e.target.value) || null)}
            className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13px] font-medium"
          >
            {datos.semanas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.tema} · {diaCorto(s.fecha)}
              </option>
            ))}
          </select>
        ) : null}
        {/* En el panel ya está el «Actualizar» de arriba. */}
        {enEscuela ? (
          <button onClick={cargar} className={BOTON} disabled={cargando}>
            {cargando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar
          </button>
        ) : cargando ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : null}
      </div>

      <Checkins lista={checkins} onHecho={cargar} />

      {datos && !datos.semanas.length ? (
        <div className={`${TARJETA} px-4 py-6 text-center`}>
          <p className="text-[14px] font-medium text-gray-900">Esta clase aún no tiene semanas.</p>
          <p className={`${META} mt-1`}>Se crean en la página de la clase, con «Nueva semana».</p>
        </div>
      ) : null}

      {c ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Cifra k="Alumnos" n={c.alumnos} />
          <Cifra k="Vieron la presentación" n={c.con_presentacion ? c.presentacion : '—'} />
          <Cifra k="Fueron a la clase" n={c.sabe_clase ? c.clase : '—'} />
          <Cifra k="Hicieron los ejercicios" n={c.con_ejercicios ? c.ejercicios : '—'} />
          <Cifra
            k="Entregaron la tarea"
            n={c.con_tarea ? c.entregadas : '—'}
            extra={c.por_corregir ? <span className="text-[13px] font-semibold text-[#B45309]">· {c.por_corregir} por corregir</span> : null}
          />
        </div>
      ) : null}
      {datos?.aviso ? <p className={META}>{datos.aviso}</p> : null}

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* La tabla de la semana. */}
        {datos?.semana ? (
          <div className={`${TARJETA} flex-1 min-w-0 w-full overflow-hidden`}>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                    <th className="px-3 py-2.5">Alumno</th>
                    <th className="px-3 py-2.5">Presentación</th>
                    <th className="px-3 py-2.5">Clase</th>
                    <th className="px-3 py-2.5">Ejercicios</th>
                    <th className="px-3 py-2.5">Tarea</th>
                    <th className="px-3 py-2.5">Semanas</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.user_id} className="border-b border-[#F3F4F6] last:border-0">
                      <td className="px-3 py-2.5">
                        {enEscuela ? (
                          <span className="font-medium text-gray-900">{f.nombre}</span>
                        ) : (
                          <button onClick={() => setFicha(f)} className="font-medium text-gray-900 hover:underline text-left">
                            {f.nombre}
                          </button>
                        )}
                        {f.grupos.length ? <p className="text-[11.5px] text-[#9CA3AF] truncate max-w-[200px]">{f.grupos.join(' · ')}</p> : null}
                      </td>
                      <td className="px-3 py-2.5">{f.presentacion === null ? <No /> : f.presentacion ? <Si /> : <No />}</td>
                      <td className="px-3 py-2.5">{f.clase === null ? <span className="text-[#D1D5DB]">?</span> : f.clase ? <Si /> : <No />}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {f.ejercicios.total ? (
                          <span className={f.ejercicios.hechos >= f.ejercicios.total ? 'text-[#15803D] font-medium' : f.ejercicios.hechos ? 'text-[#025dc7]' : 'text-[#9CA3AF]'}>
                            {f.ejercicios.hechos} de {f.ejercicios.total}
                          </span>
                        ) : (
                          <No />
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EstadoTarea f={f} onCorregir={setCorrigiendo} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Semanas f={f} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Móvil: una tarjeta por alumno. */}
            <div className="md:hidden divide-y divide-[#F3F4F6]">
              {filas.map((f) => (
                <div key={f.user_id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-gray-900 truncate">{f.nombre}</p>
                    <EstadoTarea f={f} onCorregir={setCorrigiendo} />
                  </div>
                  <p className={META}>
                    Presentación {f.presentacion ? '✓' : '—'} · Clase {f.clase === null ? '?' : f.clase ? '✓' : '—'} · Ejercicios{' '}
                    {f.ejercicios.total ? `${f.ejercicios.hechos}/${f.ejercicios.total}` : '—'}
                  </p>
                  <Semanas f={f} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] text-[#374151]">
              <span>
                {datos.semana.tiene_tarea ? `${sinEntregar} sin entregar` : 'Esta semana no tiene tarea'}
                {descolgados ? ` · ${descolgados} llevan 2 semanas o más sin nada` : ''}
              </span>
              {!enEscuela ? <span className="text-[#6B7280]">Toca un nombre para abrir su ficha y mandarle un recordatorio.</span> : null}
            </div>
          </div>
        ) : null}

        {/* Por corregir (todas las clases) y el corrector. */}
        <div className="w-full xl:w-[400px] shrink-0 space-y-3">
          {corrigiendo ? (
            <Corrector
              entregaId={corrigiendo}
              onClose={() => setCorrigiendo(null)}
              onHecho={() => {
                setCorrigiendo(null)
                cargar()
              }}
            />
          ) : null}
          <div className={TARJETA}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
              <p className="text-[14px] font-semibold text-gray-900">Por corregir</p>
              <span className={`text-[13px] font-semibold ${pendientes.length ? 'text-[#B45309]' : 'text-[#9CA3AF]'}`}>{pendientes.length}</span>
            </div>
            {pendientes.length ? (
              <div className="divide-y divide-[#F3F4F6]">
                {pendientes.map((p) => (
                  <button
                    key={p.entrega.id}
                    onClick={() => setCorrigiendo(p.entrega.id)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[#F9FAFB] ${corrigiendo === p.entrega.id ? 'bg-[#F9FAFB]' : ''}`}
                  >
                    <p className="text-[13.5px] font-medium text-gray-900 truncate">
                      {p.nombre} · {p.tema}
                    </p>
                    <p className={META}>
                      {p.curso ? `${p.curso} · ` : ''}
                      {haceCuando(p.entrega.entregada_at)}
                      {p.entrega.texto && p.entrega.tiene_audio ? ' · texto + voz' : p.entrega.tiene_audio ? ' · solo voz' : ' · solo texto'}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 py-4 text-[13px] text-[#9CA3AF]">Nada por corregir.</p>
            )}
          </div>
        </div>
      </div>

      {ficha ? <FichaAlumno userId={ficha.user_id} nombre={ficha.nombre} onClose={() => setFicha(null)} /> : null}
    </div>
  )
}
