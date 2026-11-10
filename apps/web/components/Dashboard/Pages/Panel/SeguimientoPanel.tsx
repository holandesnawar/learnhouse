'use client'

/**
 * Seguimiento semanal (28/10/2026): una semana de una clase en directo, alumno
 * a alumno (vio la presentación, fue a la clase, ejercicios, tarea, semanas
 * sin nada), lo que queda por corregir con el corrector al lado, y a quién le
 * toca el check-in de las semanas 4, 8 y 12.
 *
 * Desde el 06/11/2026: arriba, las clases lado a lado (la semana en curso de
 * cada una), la columna «Grabación» (quién la ha visto) y «Avisar a la clase»
 * con la semana elegida.
 *
 * Vive en el panel (administradores) y en la escuela (`/seguimiento`, para los
 * profes, que no entran al panel). La lógica, en
 * apps/api/src/services/tareas/tareas.py.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ChevronLeft, ChevronRight, ListChecks, Loader2, Megaphone, MessageCircle, RefreshCw, X } from 'lucide-react'
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
  getResumenClases,
  getSeguimiento,
  marcarCheckin,
  reabrirEntrega,
  type CheckinToca,
  type FilaSeguimiento,
  type PorCorregir,
  type ResumenClase,
  type Seguimiento,
} from '@services/tareas/tareas'
import { AvisarClase } from '@components/Pages/Courses/AvisarClase'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { confirmar } from '@lib/nawar/confirmar'
import { BOTON, BOTON_PRINCIPAL, META, Plegable, TARJETA } from './ui'
import { FichaAlumno } from './ProgresoPanel'

function haceCuando(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).replace('.', '') +
    ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
}

const Si = () => <Check size={16} strokeWidth={3} className="text-[#16A34A]" />
const No = () => <span className="text-[#D1D5DB]">—</span>

/** Fue a la clase: lo cuenta la sala de la escuela (o la lista del profe). */
function Asistio({ f, futura }: { f: FilaSeguimiento; futura: boolean }) {
  if (futura) return <span className="text-[12.5px] text-[#9CA3AF]">Aún no</span>
  if (f.clase === null) return <span className="text-[12.5px] text-[#9CA3AF]" title="Ni la sala ni la lista lo saben">No se sabe</span>
  return f.clase ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#15803D]" title={f.clase_origen === 'lista' ? 'Lo marcó el profe' : 'Lo vio la sala de la escuela'}>
      <Check size={14} strokeWidth={3} /> Fue
    </span>
  ) : (
    <span className="text-[13px] text-[#B91C1C]">No fue</span>
  )
}

function EstadoTarea({ f, onCorregir }: { f: FilaSeguimiento; onCorregir: (id: number) => void }) {
  if (f.tarea === 'corregida')
    return (
      <button onClick={() => f.entrega_id && onCorregir(f.entrega_id)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#15803D] hover:underline">
        <Check size={14} strokeWidth={3} /> Corregida
      </button>
    )
  if (f.tarea === 'entregada')
    return (
      <button
        onClick={() => f.entrega_id && onCorregir(f.entrega_id)}
        className="inline-flex items-center h-7 px-2.5 rounded-md bg-[#FEF3C7] text-[12.5px] font-semibold text-[#92400E] hover:bg-[#FDE68A]"
      >
        Corregir
      </button>
    )
  if (f.tarea === 'pendiente') return <span className="text-[13px] text-[#B91C1C]">Sin entregar</span>
  return <No />
}

type Filtro = 'todos' | 'no-fue' | 'sin-entregar' | 'por-corregir' | 'sin-grabacion'

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
    <div>
      <p className={`${META} px-4 pb-2`}>Semanas 4, 8 y 12 de su camino: un mensaje corto para ver cómo van y qué les cuesta.</p>
      <div className="divide-y divide-[#F3F4F6] border-t border-[#F3F4F6]">
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
  const [resumen, setResumen] = useState<ResumenClase[]>([])
  const [avisando, setAvisando] = useState(false)
  const [pasandoLista, setPasandoLista] = useState(false)

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
      // Las clases lado a lado: en blando, que no pare lo demás.
      getResumenClases(org.id, token)
        .then((r) => setResumen(r.clases))
        .catch(() => setResumen([]))
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
  const [filtro, setFiltro] = useState<Filtro>('todos')
  useEffect(() => setFiltro('todos'), [clase, semanaId])
  const semana = datos?.semana || null
  const futura = !!semana?.fecha && !!datos?.hoy && semana.fecha > datos.hoy
  const cuenta = useMemo(
    () => ({
      'no-fue': filas.filter((f) => f.clase === false).length,
      'sin-entregar': filas.filter((f) => f.tarea === 'pendiente').length,
      'por-corregir': filas.filter((f) => f.tarea === 'entregada').length,
      'sin-grabacion': filas.filter((f) => f.grabacion === false).length,
    }),
    [filas]
  )
  const visibles = useMemo(() => {
    if (filtro === 'no-fue') return filas.filter((f) => f.clase === false)
    if (filtro === 'sin-entregar') return filas.filter((f) => f.tarea === 'pendiente')
    if (filtro === 'por-corregir') return filas.filter((f) => f.tarea === 'entregada')
    if (filtro === 'sin-grabacion') return filas.filter((f) => f.grabacion === false)
    return filas
  }, [filas, filtro])
  const c = datos?.cifras
  const porCorregirDe = (uuid: string) => resumen.find((r) => r.course_uuid === uuid)?.cifras?.por_corregir || 0

  // Las semanas vienen de la más nueva a la más vieja: ‹ es la anterior.
  const lista = datos?.semanas || []
  const idx = semana ? lista.findIndex((s) => s.id === semana.id) : -1
  const irA = (i: number) => {
    const s = lista[i]
    if (s) setSemanaId(s.id)
  }

  if (!clases) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={22} />}
      </div>
    )
  }

  /** Una cifra grande que también filtra la lista de abajo. */
  const Grande = ({ titulo, n, de, nota, f, rojo }: { titulo: string; n: React.ReactNode; de?: number; nota?: React.ReactNode; f?: Filtro; rojo?: string }) => (
    <button
      onClick={() => f && setFiltro(filtro === f ? 'todos' : f)}
      disabled={!f}
      className={`${TARJETA} text-left px-4 py-3.5 transition-colors ${f ? 'hover:border-[#9cc7ff]' : 'cursor-default'} ${f && filtro === f ? 'border-[#1D0084] ring-1 ring-[#1D0084]' : ''}`}
    >
      <p className="text-[13px] text-[#4B5563]">{titulo}</p>
      <p className="mt-0.5 text-[24px] font-semibold tabular-nums text-gray-900 leading-tight">
        {n}
        {de !== undefined ? <span className="text-[16px] font-normal text-[#9CA3AF]"> de {de}</span> : null}
      </p>
      {rojo ? <p className="mt-0.5 text-[12.5px] font-medium text-[#B91C1C]">{rojo}</p> : nota ? <p className={`${META} mt-0.5`}>{nota}</p> : null}
    </button>
  )

  const FILTROS: { k: Filtro; t: string; n: number; si: boolean }[] = [
    { k: 'todos', t: 'Todos', n: filas.length, si: true },
    { k: 'no-fue', t: 'No fueron a la clase', n: cuenta['no-fue'], si: !futura && !!c?.sabe_clase },
    { k: 'sin-entregar', t: 'Sin entregar la tarea', n: cuenta['sin-entregar'], si: !!c?.con_tarea },
    { k: 'por-corregir', t: 'Por corregir', n: cuenta['por-corregir'], si: !!c?.con_tarea },
    { k: 'sin-grabacion', t: 'Sin ver la grabación', n: cuenta['sin-grabacion'], si: !!c?.con_grabacion },
  ]

  return (
    <div className="space-y-5">
      {/* Las clases: una pestaña cada una, con lo que queda por corregir. */}
      <div className="flex flex-wrap gap-2">
        {clases.map((x) => {
          const pc = porCorregirDe(x.uuid)
          const activa = clase === x.uuid
          return (
            <button
              key={x.uuid}
              onClick={() => {
                setClase(x.uuid)
                setSemanaId(null)
              }}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border text-[13.5px] font-medium transition-colors ${
                activa ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#E2E8F4] text-gray-800 hover:border-[#9cc7ff]'
              }`}
            >
              {x.nombre}
              {pc ? (
                <span className={`rounded-full px-1.5 text-[11.5px] font-semibold ${activa ? 'bg-white/20 text-white' : 'bg-[#FEF3C7] text-[#92400E]'}`} title="Tareas por corregir">
                  {pc}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* La semana, con flechas, y lo que se puede hacer con ella. */}
      {lista.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-[#E2E8F4] bg-white">
            <button onClick={() => irA(idx + 1)} disabled={idx < 0 || idx >= lista.length - 1} className="h-9 w-9 flex items-center justify-center text-gray-600 disabled:text-gray-300" aria-label="Semana anterior">
              <ChevronLeft size={16} />
            </button>
            <select
              value={semana?.id ?? ''}
              onChange={(e) => setSemanaId(Number(e.target.value) || null)}
              className="h-9 border-x border-[#E2E8F4] bg-white px-2.5 text-[14px] font-semibold text-gray-900 outline-none"
            >
              {lista.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tema} · {diaCorto(s.fecha)}
                </option>
              ))}
            </select>
            <button onClick={() => irA(idx - 1)} disabled={idx <= 0} className="h-9 w-9 flex items-center justify-center text-gray-600 disabled:text-gray-300" aria-label="Semana siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          {semana ? (
            <button onClick={() => setAvisando(true)} className={BOTON}>
              <Megaphone size={13} /> Avisar a la clase
            </button>
          ) : null}
          {semana && !futura ? (
            <button onClick={() => setPasandoLista(true)} className={BOTON} title="La asistencia la cuenta la sala sola: esto es para corregirla">
              <ListChecks size={13} /> Corregir asistencia
            </button>
          ) : null}
          {enEscuela ? (
            <button onClick={cargar} className={BOTON} disabled={cargando}>
              {cargando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar
            </button>
          ) : cargando ? (
            <Loader2 size={14} className="animate-spin text-gray-400" />
          ) : null}
        </div>
      ) : null}

      {avisando && semana ? <AvisarClase semana={semana} onClose={() => setAvisando(false)} /> : null}
      {pasandoLista && semana ? (
        <PasarLista
          semanaId={semana.id}
          tema={semana.tema}
          curso={datos!.curso}
          token={token}
          onCerrar={() => setPasandoLista(false)}
          onGuardada={() => {
            setPasandoLista(false)
            cargar()
          }}
        />
      ) : null}

      {datos && !lista.length ? (
        <div className={`${TARJETA} px-4 py-6 text-center`}>
          <p className="text-[14px] font-medium text-gray-900">Esta clase aún no tiene semanas.</p>
          <p className={`${META} mt-1`}>Se crean en la página de la clase, con «Nueva semana».</p>
        </div>
      ) : null}

      {/* Lo importante, en tres cifras. Tocar una filtra la lista. */}
      {c && semana ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Grande
            titulo="Fueron a la clase"
            n={futura ? '—' : c.sabe_clase ? c.clase : '—'}
            de={futura || !c.sabe_clase ? undefined : c.alumnos}
            nota={futura ? `La clase es el ${diaCorto(semana.fecha)}` : !c.sabe_clase ? 'La sala aún no ha contado a nadie' : datos?.lista_pasada ? `Corregida por ${(datos.lista_por || []).join(', ') || 'el profe'}` : 'Lo cuenta la sala de la escuela'}
            f={!futura && c.sabe_clase ? 'no-fue' : undefined}
            rojo={!futura && c.sabe_clase && cuenta['no-fue'] ? `${cuenta['no-fue']} no fueron` : undefined}
          />
          <Grande
            titulo="Entregaron la tarea"
            n={c.con_tarea ? c.entregadas : '—'}
            de={c.con_tarea ? c.alumnos : undefined}
            nota={!c.con_tarea ? 'Esta semana no tiene tarea' : c.por_corregir ? undefined : 'Nada por corregir'}
            rojo={c.con_tarea && c.por_corregir ? `${c.por_corregir} por corregir` : undefined}
            f={c.con_tarea ? 'sin-entregar' : undefined}
          />
          <Grande
            titulo="Vieron la grabación"
            n={c.con_grabacion ? c.grabacion ?? 0 : '—'}
            de={c.con_grabacion ? c.alumnos : undefined}
            nota={!c.con_grabacion ? 'Aún no hay grabación' : undefined}
            f={c.con_grabacion ? 'sin-grabacion' : undefined}
          />
        </div>
      ) : null}
      {datos?.aviso ? <p className={META}>{datos.aviso}</p> : null}

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* La lista de alumnos. */}
        {semana ? (
          <div className={`${TARJETA} flex-1 min-w-0 w-full overflow-hidden`}>
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5 border-b border-[#EEF1F7]">
              {FILTROS.filter((x) => x.si).map((x) => (
                <button
                  key={x.k}
                  onClick={() => setFiltro(x.k)}
                  className={`h-7 px-2.5 rounded-full text-[12.5px] font-medium border ${
                    filtro === x.k ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#E2E8F4] text-[#374151] hover:border-[#9cc7ff]'
                  }`}
                >
                  {x.t} <span className={filtro === x.k ? 'text-white/70' : 'text-[#9CA3AF]'}>{x.n}</span>
                </button>
              ))}
            </div>
            {visibles.length ? (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-[13.5px]">
                    <thead>
                      <tr className="border-b border-[#EEF1F7] text-left text-[12px] font-medium text-[#6B7280]">
                        <th className="px-4 py-2.5 font-medium">Alumno</th>
                        <th className="px-3 py-2.5 font-medium">Clase</th>
                        <th className="px-3 py-2.5 font-medium">Tarea</th>
                        <th className="px-3 py-2.5 font-medium">Grabación</th>
                        <th className="px-3 py-2.5 font-medium">Presentación</th>
                        <th className="px-3 py-2.5 font-medium">Ejercicios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((f) => (
                        <tr key={f.user_id} className="border-b border-[#F3F4F6] last:border-0">
                          <td className="px-4 py-2.5">
                            {enEscuela ? (
                              <span className="font-medium text-gray-900">{f.nombre}</span>
                            ) : (
                              <button onClick={() => setFicha(f)} className="font-medium text-gray-900 hover:underline text-left">
                                {f.nombre}
                              </button>
                            )}
                            {f.sin_nada >= 2 ? <p className="text-[11.5px] font-medium text-[#B91C1C]">{f.sin_nada} semanas sin hacer nada</p> : null}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Asistio f={f} futura={futura} />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <EstadoTarea f={f} onCorregir={setCorrigiendo} />
                          </td>
                          <td className="px-3 py-2.5">{f.grabacion ? <Si /> : <No />}</td>
                          <td className="px-3 py-2.5">{f.presentacion ? <Si /> : <No />}</td>
                          <td className="px-3 py-2.5 tabular-nums text-[13px]">
                            {f.ejercicios.total ? (
                              <span className={f.ejercicios.hechos >= f.ejercicios.total ? 'text-[#15803D] font-medium' : f.ejercicios.hechos ? 'text-gray-700' : 'text-[#9CA3AF]'}>
                                {f.ejercicios.hechos} de {f.ejercicios.total}
                              </span>
                            ) : (
                              <No />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Móvil: una línea por alumno, con lo importante. */}
                <div className="md:hidden divide-y divide-[#F3F4F6]">
                  {visibles.map((f) => (
                    <div key={f.user_id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => !enEscuela && setFicha(f)} className="text-[14px] font-medium text-gray-900 truncate text-left">
                          {f.nombre}
                        </button>
                        <EstadoTarea f={f} onCorregir={setCorrigiendo} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6B7280]">
                        <span className="inline-flex items-center gap-1">
                          Clase: <Asistio f={f} futura={futura} />
                        </span>
                        {c?.con_grabacion ? <span>Grabación {f.grabacion ? '✓' : '—'}</span> : null}
                        {f.ejercicios.total ? <span>Ejercicios {f.ejercicios.hechos}/{f.ejercicios.total}</span> : null}
                      </div>
                      {f.sin_nada >= 2 ? <p className="text-[11.5px] font-medium text-[#B91C1C]">{f.sin_nada} semanas sin hacer nada</p> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="px-4 py-6 text-center text-[13.5px] text-[#6B7280]">{filtro === 'todos' ? 'Esta clase no tiene alumnos.' : 'Nadie aquí. 🙌'}</p>
            )}
            {!enEscuela ? (
              <p className="border-t border-[#EEF1F7] px-4 py-2.5 text-[12.5px] text-[#6B7280]">Toca un nombre para abrir su ficha y mandarle un recordatorio.</p>
            ) : null}
          </div>
        ) : null}

        {/* Por corregir (todas las clases) y el corrector: solo si hay algo. */}
        {corrigiendo || pendientes.length ? (
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
            {pendientes.length ? (
              <div className={TARJETA}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                  <p className="text-[14px] font-semibold text-gray-900">Por corregir, de todas las clases</p>
                  <span className="text-[13px] font-semibold text-[#B45309]">{pendientes.length}</span>
                </div>
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
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Check-in: abajo y plegado (10/11: «poder ocultarlo»). */}
      {checkins.length ? (
        <Plegable
          titulo="Check-in de esta semana"
          icono={<MessageCircle size={16} />}
          cifra={checkins.length}
          resumen={`${checkins.length} ${checkins.length === 1 ? 'alumno' : 'alumnos'} en su semana 4, 8 o 12`}
          recordarComo="seguimiento-checkin"
        >
          <Checkins lista={checkins} onHecho={cargar} />
        </Plegable>
      ) : null}

      {ficha ? <FichaAlumno userId={ficha.user_id} nombre={ficha.nombre} onClose={() => setFicha(null)} /> : null}
    </div>
  )
}
