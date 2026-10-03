'use client'

/**
 * Llamadas — la mesa de trabajo del closer.
 *
 * Arriba, la AGENDA: las citas de Calendly en una semana (pasadas, próximas,
 * canceladas y reprogramadas), cada una con su enlace para entrar y, al
 * colgar, "¿Qué pasó?" (va a pagar / lo piensa / no encaja / no vino), que
 * mueve sola la tarjeta del tablero de Matrículas. Al lado, el calendario de
 * Google del usuario, por si allí tiene más cosas. El closer no tiene que
 * abrir ni Calendly ni Google.
 *
 * Debajo, quien pidió una llamada por el formulario de /agendar, con sus
 * respuestas. La marca de "atendida" es la misma que en Contactos y el
 * tablero (la solicitud que crea el formulario).
 *
 * Estilo: el de `Panel/ui.tsx` (29/09, "que parezca un software, como
 * Calendly"): blanco y gris, sin cajitas de color.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PorDia from './PorDia'
import Seguimiento from './Seguimiento'
import FichaCliente from '../Panel/FichaCliente'
import EnlacePago from '../Panel/EnlacePago'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  avisoTrasBorrar,
  borrarContacto,
  cuandoLlamar,
  devolverCita,
  getAgenda,
  getAgendaGoogle,
  getLlamadas,
  getRecordatorios,
  guardarAgendaGoogle,
  guardarResultado,
  hoyISO,
  marcarLlamada,
  quitarCita,
  RESULTADOS,
  type Agenda,
  type AgendaGoogle,
  type Cita,
  type Llamada,
  type ResultadoLlamada,
  type VolverALlamar,
} from '@services/stats/contactos'
import { marcarSolicitud } from '@services/stats/school'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, RotateCcw, Trash2, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import { BOTON, BOTON_PELIGRO, BOTON_PRINCIPAL, ENLACE, Estado, META, Meta, Seccion, TARJETA, filtro, type Tono } from '../Panel/ui'
import { numeroWhatsApp } from '@/lib/nawar/telefono'

// ── Fechas ────────────────────────────────────────────────────────────────

function fecha(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const diaLargo = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
/** "jue 25 sep · 18:00", en la hora del que mira. */
function diaHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · ${hora(iso)}`
}
function lunesDe(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()

function whatsapp(tel: string) {
  const num = numeroWhatsApp(tel)
  return num ? `https://wa.me/${num}` : ''
}

/** Cómo se enseña una cita: su estado en palabras y el color del punto. */
function estadoDe(c: Cita): { texto: string; tono: Tono; pendiente: boolean } {
  if (c.estado === 'cancelada') return { texto: c.reprogramada ? 'Reprogramada' : 'Cancelada', tono: 'gris', pendiente: false }
  if (c.resultado) {
    const tono: Tono = c.resultado.resultado === 'compra' || c.resultado.resultado === 'pagado' ? 'verde' : c.resultado.resultado === 'piensa' ? 'ambar' : 'gris'
    return { texto: c.resultado.nombre, tono, pendiente: false }
  }
  const pasada = new Date(c.fin || c.inicio).getTime() < Date.now()
  return pasada ? { texto: '¿Qué pasó?', tono: 'rojo', pendiente: true } : { texto: 'Programada', tono: 'azul', pendiente: false }
}

// ── Pantalla ──────────────────────────────────────────────────────────────

export default function LlamadasPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus()

  const [llamadas, setLlamadas] = useState<Llamada[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [verAtendidas, setVerAtendidas] = useState(false)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [cargandoAgenda, setCargandoAgenda] = useState(false)
  const [cita, setCita] = useState<Cita | null>(null)
  const [ficha, setFicha] = useState<string | null>(null)
  const [recordatorios, setRecordatorios] = useState<Record<string, VolverALlamar>>({})
  const llamarDe = (email: string) => recordatorios[(email || '').toLowerCase()]
  const cambioFecha = (email: string, v: VolverALlamar | null) =>
    setRecordatorios((prev) => {
      const next = { ...prev }
      if (v) next[email.toLowerCase()] = v
      else delete next[email.toLowerCase()]
      return next
    })

  async function borrar(l: Llamada) {
    if (!(await confirmar(`¿Borrar a ${l.name || l.email}? Es para pruebas o leads que no valen. No se puede deshacer. Los pagos, la cuenta y el CRM no se tocan.`))) return
    const r = await borrarContacto(org?.id, l.email, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido borrar')
      return
    }
    setAbierta(null)
    setLlamadas((prev) => (prev ? prev.filter((x) => x.email !== l.email) : prev))
    const aviso = avisoTrasBorrar(r.quedan)
    if (aviso === 'Borrado') toast.success(aviso)
    else toast(aviso, { duration: 7000 })
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const [data, recs] = await Promise.all([getLlamadas(org.id, accessToken), getRecordatorios(org.id, accessToken)])
    setRecordatorios(recs)
    if (data === null) setFallo(true)
    else setLlamadas(data)
  }, [org?.id, accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])

  const cargarAgenda = useCallback(
    async (forzar = false) => {
      if (!org?.id || !accessToken) return
      setCargandoAgenda(true)
      setAgenda(await getAgenda(org.id, accessToken, forzar))
      setCargandoAgenda(false)
    },
    [org?.id, accessToken]
  )
  useEffect(() => {
    // Recién abierta la pantalla, lo último de Calendly (el botón Actualizar
    // de arriba vuelve a montar la pantalla, así que también lo pide).
    cargarAgenda(true)
  }, [cargarAgenda])

  // La próxima cita activa de cada correo, para ponerla en su línea.
  const citaDe = (email: string): Cita | undefined =>
    (agenda?.citas || []).find(
      (c) => c.email === (email || '').toLowerCase() && c.estado === 'activa' && new Date(c.fin || c.inicio).getTime() > Date.now()
    )

  async function alternar(l: Llamada) {
    const ahora = Boolean(l.contacted_at)
    setGuardando(l.id)
    const ok = l.solicitud_id
      ? await marcarSolicitud(org?.id, l.solicitud_id, !ahora, accessToken)
      : await marcarLlamada(org?.id, l.id, !ahora, accessToken)
    setGuardando(null)
    if (!ok) {
      toast.error('No se ha podido guardar')
      return
    }
    setLlamadas((prev) => (prev || []).map((x) => (x.id === l.id ? { ...x, contacted_at: ahora ? '' : new Date().toISOString() } : x)))
  }

  const sinApuntar = (agenda?.citas || []).filter((c) => estadoDe(c).pendiente)

  if (fallo) {
    return (
      <div className={`${TARJETA} p-5`}>
        <p className="text-[14px] text-gray-600">No se han podido cargar las llamadas. Prueba a actualizar.</p>
      </div>
    )
  }
  if (llamadas === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  const pendientes = llamadas.filter((l) => !l.contacted_at)
  const atendidas = llamadas.filter((l) => Boolean(l.contacted_at))

  return (
    <div className="space-y-8">
      <AgendaVista
        agenda={agenda}
        cargando={cargandoAgenda}
        recargar={() => cargarAgenda(true)}
        abrirCita={setCita}
        devolver={async (c) => {
          const r = await devolverCita(org?.id, c.id, accessToken)
          if (!r.ok) {
            toast.error(r.error || 'No se ha podido devolver')
            return
          }
          toast.success('Vuelve a salir en el calendario')
          cargarAgenda(true)
        }}
      />

      {sinApuntar.length ? (
        <Seccion titulo={`Llamadas sin apuntar qué pasó · ${sinApuntar.length}`}>
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {sinApuntar.map((c) => (
              <button key={c.id} onClick={() => setCita(c)} className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-[#F9FAFB]">
                <span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-4">
                  <span className="block sm:order-2 text-[14px] font-medium text-gray-900 truncate">{c.nombre || c.email}</span>
                  <span className="block sm:order-1 text-[13px] text-gray-500 sm:w-[150px] shrink-0 tabular-nums">{diaHora(c.inicio)}</span>
                </span>
                <span className={BOTON_PRINCIPAL}>¿Qué pasó?</span>
              </button>
            ))}
          </div>
        </Seccion>
      ) : null}

      <Seccion titulo={pendientes.length === 0 ? 'Solicitudes de llamada · todas atendidas' : `Solicitudes de llamada · ${pendientes.length} por atender`}>
        <p className={META}>
          Quien rellenó el formulario de agendar llamada, con sus respuestas. Márcala cuando la hayas atendido.
          «No terminó» = dejó sus datos y se fue a mitad.
        </p>
        {llamadas.length === 0 ? (
          <div className={`${TARJETA} p-5`}>
            <p className="text-[14px] text-gray-600">Todavía no ha pedido una llamada nadie.</p>
          </div>
        ) : (
          <>
            <PorDia
              items={pendientes}
              fecha={(l) => l.created_at}
              clave={(l) => l.id}
              recordarComo="llamadas"
              render={(l) => (
                <Lista
                  filas={[l]}
                  abierta={abierta}
                  setAbierta={setAbierta}
                  alternar={alternar}
                  guardando={guardando}
                  citaDe={citaDe}
                  borrar={isAdmin ? borrar : undefined}
                  llamarDe={llamarDe}
                  onCambioFecha={cambioFecha}
                />
              )}
            />
            {atendidas.length > 0 && (
              <div>
                <button
                  onClick={() => setVerAtendidas((v) => !v)}
                  className="text-[13px] font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 mb-2"
                >
                  {verAtendidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Ya atendidas · {atendidas.length}
                </button>
                {verAtendidas && (
                  <Lista
                    filas={atendidas}
                    abierta={abierta}
                    setAbierta={setAbierta}
                    alternar={alternar}
                    guardando={guardando}
                    citaDe={citaDe}
                    borrar={isAdmin ? borrar : undefined}
                    llamarDe={llamarDe}
                    onCambioFecha={cambioFecha}
                  />
                )}
              </div>
            )}
          </>
        )}
      </Seccion>

      {cita ? (
        <CitaDialogo
          cita={cita}
          onClose={() => setCita(null)}
          verFicha={(email) => {
            setCita(null)
            setFicha(email)
          }}
          onGuardado={(c) => {
            setAgenda((a) => (a ? { ...a, citas: a.citas.map((x) => (x.id === c.id ? c : x)) } : a))
            setCita(null)
          }}
          onQuitada={(c) => {
            setAgenda((a) =>
              a ? { ...a, citas: a.citas.filter((x) => x.id !== c.id), quitadas: [{ ...c, quitada_por: 'mano' }, ...(a.quitadas || [])] } : a
            )
            setCita(null)
          }}
        />
      ) : null}
      {ficha ? <FichaCliente email={ficha} onClose={() => setFicha(null)} onCambio={() => cargarAgenda(true)} /> : null}
    </div>
  )
}

// ── Agenda: semana / lista / Google ──────────────────────────────────────

type Vista = 'semana' | 'lista' | 'google'

function AgendaVista({
  agenda,
  cargando,
  recargar,
  abrirCita,
  devolver,
}: {
  agenda: Agenda | null
  cargando: boolean
  recargar: () => void
  abrirCita: (c: Cita) => void
  devolver: (c: Cita) => void
}) {
  const { isAdmin } = useAdminStatus()
  const [vista, setVista] = useState<Vista>('semana')
  const [verQuitadas, setVerQuitadas] = useState(false)
  const quitadas = agenda?.quitadas || []
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const dias = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lunes)
        d.setDate(d.getDate() + i)
        return d
      }),
    [lunes]
  )
  const citas = agenda?.citas || []
  const hoy = new Date()
  const domingo = dias[6]
  const rango = `${dias[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${domingo.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const moverSemana = (n: number) =>
    setLunes((l) => {
      const x = new Date(l)
      x.setDate(x.getDate() + 7 * n)
      return x
    })

  return (
    <Seccion titulo="Agenda">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(
            [
              ['semana', 'Semana'],
              ['lista', 'Lista'],
              ['google', 'Google Calendar'],
            ] as [Vista, string][]
          ).map(([id, nombre]) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              className={`${
                // En el móvil no hay semana: ahí "Semana" se ve como la lista.
                id === 'lista' && vista === 'semana'
                  ? `${filtro(true)} lg:!bg-white lg:!border-[#E5E7EB] lg:!text-gray-700`
                  : filtro(vista === id)
              } ${id === 'semana' ? 'hidden lg:inline-flex items-center' : ''}`}
            >
              {nombre}
            </button>
          ))}
        </div>
        {vista === 'semana' ? (
          <div className="hidden lg:flex items-center gap-1 ml-auto">
            <button onClick={() => setLunes(lunesDe(new Date()))} className={BOTON}>
              Hoy
            </button>
            <button onClick={() => moverSemana(-1)} className={`${BOTON} !px-2`} aria-label="Semana anterior">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => moverSemana(1)} className={`${BOTON} !px-2`} aria-label="Semana siguiente">
              <ChevronRight size={15} />
            </button>
            <span className="text-[13.5px] font-medium text-gray-900 ml-2 tabular-nums">{rango}</span>
          </div>
        ) : null}
      </div>

      {vista === 'google' ? (
        <CalendarioGoogle esAdmin={Boolean(isAdmin)} />
      ) : agenda === null ? (
        <div className={`${TARJETA} p-5`}>
          <p className={META}>{cargando ? 'Cargando…' : 'No se ha podido leer la agenda.'}</p>
        </div>
      ) : !agenda.configurado ? (
        <div className={`${TARJETA} p-5`}>
          <p className={META}>
            {isAdmin
              ? 'Para ver aquí las llamadas, conecta Calendly: en Calendly, Integraciones → API y webhooks → token de acceso personal, y pégalo en Railway como LEARNHOUSE_CALENDLY_TOKEN.'
              : 'La agenda de Calendly todavía no está conectada.'}
          </p>
        </div>
      ) : agenda.error ? (
        <div className={`${TARJETA} p-5`}>
          <p className="text-[13px] text-red-700">{agenda.error}</p>
        </div>
      ) : (
        <>
          {/* Semana: solo en pantallas anchas. En el móvil, la lista. */}
          <div className={`${vista === 'semana' ? 'hidden lg:grid' : 'hidden'} ${TARJETA} grid-cols-7 divide-x divide-[#F3F4F6] overflow-hidden`}>
            {dias.map((d) => {
              const delDia = citas.filter((c) => mismoDia(new Date(c.inicio), d)).sort((a, b) => a.inicio.localeCompare(b.inicio))
              const esHoy = mismoDia(d, hoy)
              return (
                <div key={d.toISOString()} className="min-h-[260px] flex flex-col">
                  <div className="px-2.5 py-2 border-b border-[#F3F4F6]">
                    <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</p>
                    <p
                      className={`text-[18px] font-semibold tabular-nums leading-tight ${
                        esHoy ? 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#025dc7] text-white text-[15px] mt-0.5' : 'text-gray-900'
                      }`}
                    >
                      {d.getDate()}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-1.5 flex-1">
                    {delDia.map((c) => (
                      <CitaBloque key={c.id || c.inicio + c.email} c={c} onClick={() => abrirCita(c)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className={vista === 'semana' ? 'lg:hidden' : ''}>
            <CitasEnLista citas={citas} abrir={abrirCita} />
          </div>
          {isAdmin && quitadas.length ? (
            <div>
              <button onClick={() => setVerQuitadas((v) => !v)} className={`${ENLACE} inline-flex items-center gap-1`}>
                <ChevronDown size={14} className={verQuitadas ? 'rotate-180' : ''} />
                {quitadas.length} {quitadas.length === 1 ? 'quitada' : 'quitadas'} del calendario
              </button>
              {verQuitadas ? (
                <div className={`${TARJETA} mt-2 divide-y divide-[#F3F4F6]`}>
                  {quitadas.map((c) => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-gray-900 truncate">{c.nombre || c.email}</p>
                        <Meta
                          partes={[
                            diaHora(c.inicio),
                            c.quitada_por === 'prueba' ? 'fuera de los números (prueba)' : 'quitada a mano',
                          ]}
                        />
                      </div>
                      {c.quitada_por === 'mano' ? (
                        <button onClick={() => devolver(c)} className={BOTON}>
                          <RotateCcw size={13} /> Devolver
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Seccion>
  )
}

function CitaBloque({ c, onClick }: { c: Cita; onClick: () => void }) {
  const e = estadoDe(c)
  const cancelada = c.estado === 'cancelada'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md border px-2 py-1.5 transition-colors ${
        e.pendiente ? 'border-[#FECACA] bg-white hover:bg-[#FEF2F2]' : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
      }`}
    >
      <p className={`text-[12px] tabular-nums ${cancelada ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{hora(c.inicio)}</p>
      <p className={`text-[13px] font-medium truncate ${cancelada ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{c.nombre || c.email}</p>
      <Estado tono={e.tono} className="mt-0.5 !text-[11.5px]">
        {e.texto}
      </Estado>
    </button>
  )
}

/** Lista por días: lo que viene (desde hoy) y, plegado, lo de antes. */
function CitasEnLista({ citas, abrir }: { citas: Cita[]; abrir: (c: Cita) => void }) {
  const [verPasadas, setVerPasadas] = useState(false)
  const inicioHoy = new Date()
  inicioHoy.setHours(0, 0, 0, 0)
  const proximas = citas.filter((c) => new Date(c.inicio) >= inicioHoy)
  const pasadas = citas.filter((c) => new Date(c.inicio) < inicioHoy).reverse()
  const porDia = (lista: Cita[]) => {
    const m = new Map<string, Cita[]>()
    for (const c of lista) {
      const k = new Date(c.inicio).toDateString()
      m.set(k, [...(m.get(k) || []), c])
    }
    return [...m.entries()]
  }
  const bloque = (lista: Cita[]) =>
    porDia(lista).map(([k, delDia]) => (
      <div key={k}>
        <p className="text-[12.5px] font-medium text-gray-500 mb-1.5 first-letter:uppercase">{diaLargo(new Date(k))}</p>
        <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
          {delDia.map((c) => {
            const e = estadoDe(c)
            const cancelada = c.estado === 'cancelada'
            return (
              <button key={c.id || c.inicio + c.email} onClick={() => abrir(c)} className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-[#F9FAFB]">
                <span className={`text-[13px] tabular-nums w-12 shrink-0 ${cancelada ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{hora(c.inicio)}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[14px] font-medium truncate ${cancelada ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{c.nombre || c.email}</span>
                  <span className="block text-[12.5px] text-gray-500 truncate">{c.email}</span>
                </span>
                <Estado tono={e.tono}>{e.texto}</Estado>
              </button>
            )
          })}
        </div>
      </div>
    ))
  return (
    <div className="space-y-4">
      {proximas.length ? bloque(proximas) : <p className={`${META} ${TARJETA} p-5`}>No hay llamadas programadas.</p>}
      {pasadas.length ? (
        <div>
          <button onClick={() => setVerPasadas((v) => !v)} className="text-[13px] font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 mb-2">
            {verPasadas ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Anteriores · {pasadas.length}
          </button>
          {verPasadas ? <div className="space-y-4">{bloque(pasadas)}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

/** Una cita abierta: sus datos, entrar, y al colgar, qué pasó. */
function CitaDialogo({
  cita,
  onClose,
  onGuardado,
  onQuitada,
  verFicha,
}: {
  cita: Cita
  onClose: () => void
  onGuardado: (c: Cita) => void
  onQuitada: (c: Cita) => void
  verFicha: (email: string) => void
}) {
  const { isAdmin } = useAdminStatus()
  const [quitando, setQuitando] = useState(false)
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [resultado, setResultado] = useState<ResultadoLlamada | ''>(cita.resultado?.resultado || '')
  const [nota, setNota] = useState(cita.resultado?.nota || '')
  const [guardando, setGuardando] = useState(false)
  const pasada = new Date(cita.inicio).getTime() < Date.now()
  const cancelada = cita.estado === 'cancelada'
  const e = estadoDe(cita)

  useEffect(() => {
    const f = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  async function guardar() {
    if (!resultado) return
    setGuardando(true)
    const r = await guardarResultado(org?.id, { cita_id: cita.id, email: cita.email, resultado, nota, inicio: cita.inicio }, accessToken)
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    const elegido = RESULTADOS.find((x) => x.id === resultado)
    toast.success(elegido ? `Apuntado: ${elegido.nombre}` : 'Apuntado')
    onGuardado({ ...cita, resultado: { resultado, nombre: elegido?.nombre || '', nota, autor: '', cuando: new Date().toISOString() } })
  }

  async function quitar() {
    const ok = await confirmar(
      `¿Quitar la cita de ${cita.nombre || cita.email} del calendario? Solo deja de salir aquí: en Calendly sigue igual y a la persona no le llega nada. Se puede devolver.`,
      { boton: 'Quitar del calendario' }
    )
    if (!ok) return
    setQuitando(true)
    const r = await quitarCita(org?.id, cita, accessToken)
    setQuitando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    toast.success('Quitada del calendario')
    onQuitada(cita)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white border border-[#E5E7EB]" onClick={(ev) => ev.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-semibold text-gray-900 truncate">{cita.nombre || cita.email}</p>
              <p className="text-[13px] text-gray-500 mt-0.5 first-letter:uppercase">
                {diaLargo(new Date(cita.inicio))}, {hora(cita.inicio)}
                {cita.fin ? `–${hora(cita.fin)}` : ''}
              </p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="p-1 -m-1 text-gray-400 hover:text-gray-900">
              <X size={18} />
            </button>
          </div>
          <Meta className="mt-2" partes={[cita.email, cita.telefono, cita.titulo]} />
          <Estado tono={e.tono} className="mt-2">
            {e.texto}
          </Estado>
          {cancelada && cita.motivo_cancelacion ? <p className={`${META} mt-1`}>Motivo: {cita.motivo_cancelacion}</p> : null}
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-2">
          {cita.enlace && !cancelada && !pasada ? (
            <a href={cita.enlace} target="_blank" rel="noreferrer" className={BOTON_PRINCIPAL}>
              <Video size={14} /> Entrar a la llamada
            </a>
          ) : null}
          {whatsapp(cita.telefono) ? (
            <a href={whatsapp(cita.telefono)} target="_blank" rel="noreferrer" className={BOTON}>
              WhatsApp
            </a>
          ) : null}
          <button onClick={() => verFicha(cita.email)} className={BOTON}>
            Ver ficha
          </button>
          {cita.resultado?.resultado === 'pagado' ? null : <EnlacePago email={cita.email} nombre={cita.nombre} telefono={cita.telefono} />}
          {cita.cambiar_url && !cancelada && !pasada ? (
            <a href={cita.cambiar_url} target="_blank" rel="noreferrer" className={BOTON}>
              Cambiar hora
            </a>
          ) : null}
          {isAdmin ? (
            <button onClick={quitar} disabled={quitando} className={BOTON_PELIGRO}>
              {quitando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Quitar del calendario
            </button>
          ) : null}
        </div>

        {pasada && !cancelada ? (
          <div className="px-5 pb-5 border-t border-[#F3F4F6] pt-4">
            <p className="text-[14px] font-semibold text-gray-900">¿Qué pasó?</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResultado(r.id)}
                  className={`text-left rounded-md border px-3 py-2 transition-colors ${
                    resultado === r.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#E5E7EB] hover:bg-[#F9FAFB] text-gray-900'
                  }`}
                >
                  <span className="block text-[13.5px] font-medium">{r.nombre}</span>
                  <span className={`block text-[11.5px] ${resultado === r.id ? 'text-white/70' : 'text-gray-500'}`}>{r.que}</span>
                </button>
              ))}
            </div>
            <textarea
              value={nota}
              onChange={(ev) => setNota(ev.target.value)}
              rows={2}
              placeholder="Nota (opcional): qué le frena, qué quedasteis…"
              className="mt-2.5 w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-gray-900 outline-none focus:border-gray-900"
            />
            <button onClick={guardar} disabled={!resultado || guardando} className={`${BOTON_PRINCIPAL} w-full mt-2 h-9`}>
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * El calendario de Google del usuario, dentro de la escuela. Solo se ve si
 * quien mira ha entrado en Google con una cuenta a la que se le ha compartido
 * (el calendario NO debe ser público: se verían los nombres de los leads).
 */
function CalendarioGoogle({ esAdmin }: { esAdmin: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [cal, setCal] = useState<AgendaGoogle | null>(null)
  const [editando, setEditando] = useState(false)
  const [codigo, setCodigo] = useState('')

  useEffect(() => {
    if (!org?.id || !accessToken) return
    getAgendaGoogle(org.id, accessToken).then((r) => setCal(r.ok && r.datos ? r.datos : { ids: [], zona: '', url: '' }))
  }, [org?.id, accessToken])

  async function guardar() {
    const r = await guardarAgendaGoogle(org?.id, codigo, accessToken)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    setCal(r.datos)
    setEditando(false)
    setCodigo('')
    toast.success('Calendario guardado')
  }

  if (!cal) return <p className={META}>Cargando…</p>
  return (
    <div className="space-y-2">
      {cal.url && !editando ? (
        <div className={`${TARJETA} overflow-hidden`}>
          <iframe title="Calendario de Google" src={cal.url} className="w-full h-[640px] border-0" />
        </div>
      ) : null}
      <p className={META}>
        Si sale vacío o pide permiso, entra en Google con la cuenta a la que se le ha compartido este calendario.
        {esAdmin && !editando ? (
          <>
            {' '}
            <button onClick={() => setEditando(true)} className={ENLACE}>
              {cal.url ? 'Cambiar calendario' : 'Poner el calendario'}
            </button>
          </>
        ) : null}
      </p>
      {editando ? (
        <div className={`${TARJETA} p-4 space-y-2`}>
          <p className="text-[13px] text-gray-700">
            En Google Calendar: Configuración → tu calendario → «Integrar el calendario». Copia el código y pégalo aquí.
            No lo hagas público.
          </p>
          <textarea
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            rows={3}
            placeholder='<iframe src="https://calendar.google.com/calendar/embed?src=…"></iframe>'
            className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[12.5px] font-mono text-gray-900 outline-none focus:border-gray-900"
          />
          <div className="flex gap-2">
            <button onClick={guardar} className={BOTON_PRINCIPAL}>
              Guardar
            </button>
            <button onClick={() => setEditando(false)} className={BOTON}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Solicitudes de llamada (formulario de /agendar) ──────────────────────

function Lista({
  filas,
  abierta,
  setAbierta,
  alternar,
  guardando,
  citaDe,
  borrar,
  llamarDe,
  onCambioFecha,
}: {
  filas: Llamada[]
  abierta: number | null
  setAbierta: (id: number | null) => void
  alternar: (l: Llamada) => void
  guardando: number | null
  citaDe: (email: string) => Cita | undefined
  borrar?: (l: Llamada) => void
  llamarDe?: (email: string) => VolverALlamar | undefined
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
}) {
  if (filas.length === 0) return null
  return (
    <section className="space-y-2">
      {filas.map((l) => {
        const open = abierta === l.id
        const hecha = Boolean(l.contacted_at)
        const cita = citaDe(l.email)
        const llamar = llamarDe?.(l.email)
        return (
          <div key={l.id} className={`${TARJETA} ${hecha ? 'opacity-70' : ''}`}>
            <button onClick={() => setAbierta(open ? null : l.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F9FAFB] rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <p className="text-[14px] font-medium text-gray-900 truncate">{l.name || l.email}</p>
                  {cita ? (
                    <Estado tono="azul">Llamada {diaHora(cita.inicio)}</Estado>
                  ) : l.reservada_at ? (
                    <Estado tono="azul">Hora reservada</Estado>
                  ) : null}
                  {llamar ? <Estado tono={llamar.fecha <= hoyISO() ? 'rojo' : 'gris'}>Volver a llamar {cuandoLlamar(llamar.fecha)}</Estado> : null}
                </div>
                <Meta
                  partes={[
                    l.terminado ? `${l.apto ? 'Encaja' : 'No encaja'} · ${l.puntuacion} pts` : 'No terminó',
                    l.embudo === 'admision' ? `Proceso de admisión · ${l.video === 'visto' ? 'vio el vídeo entero' : 'no terminó el vídeo'}` : '',
                    l.email,
                    l.phone,
                    fecha(l.created_at),
                  ]}
                />
              </div>
              {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
            </button>

            {open && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#F3F4F6] pt-3">
                <Meta
                  partes={[
                    l.vino_de ? `Vino de ${l.vino_de}` : 'Sin rastro de por dónde llegó',
                    l.vio_precio ? 'ya vio el precio' : 'sin rastro de haber visto el precio',
                    l.utm_campaign ? `campaña ${l.utm_campaign}` : '',
                  ]}
                  className="!whitespace-normal"
                />
                {l.terminado && !l.apto && l.motivo_fuera ? <p className="text-[13px] text-gray-700">Se quedó fuera por: {l.motivo_fuera}.</p> : null}
                {!l.terminado && l.respuestas.length === 0 ? (
                  <p className="text-[13px] text-gray-700">
                    {l.embudo === 'admision'
                      ? l.video === 'visto'
                        ? 'Dejó sus datos y vio el vídeo entero, pero no contestó las preguntas. Escríbele: está muy cerca.'
                        : 'Dejó sus datos para ver el vídeo y no lo terminó. Escríbele: ya mostró interés.'
                      : 'Dejó su nombre, correo y teléfono y se fue antes de contestar las preguntas. Escríbele: ya mostró interés.'}
                  </p>
                ) : l.sin_respuestas ? (
                  <p className={META}>No se guardaron las respuestas de esta llamada.</p>
                ) : (
                  <>
                    {!l.terminado ? (
                      <p className="text-[13px] text-gray-700">
                        Se fue a mitad{l.ultima_pregunta ? ` después de «${l.ultima_pregunta}»` : ''}. Esto es lo que llegó a contestar:
                      </p>
                    ) : null}
                    <dl className="rounded-md border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                      {l.respuestas.map((r, j) => (
                        <div key={j} className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-0.5">
                          <dt className="text-[12.5px] text-gray-500 leading-snug">{r.pregunta}</dt>
                          <dd className="text-[13px] text-gray-900 leading-snug whitespace-pre-wrap break-words">{r.respuesta}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => alternar(l)} disabled={guardando === l.id} className={hecha ? BOTON : BOTON_PRINCIPAL}>
                    {guardando === l.id ? <Loader2 size={13} className="animate-spin" /> : hecha ? <RotateCcw size={13} /> : <Check size={13} />}
                    {hecha ? 'Volver a pendiente' : 'Ya la he atendido'}
                  </button>
                  {cita?.enlace ? (
                    <a href={cita.enlace} target="_blank" rel="noreferrer" className={BOTON}>
                      <Video size={13} /> Entrar a la llamada
                    </a>
                  ) : null}
                  {whatsapp(l.phone) ? (
                    <a href={whatsapp(l.phone)} target="_blank" rel="noreferrer" className={BOTON}>
                      WhatsApp
                    </a>
                  ) : null}
                  <a href={`mailto:${l.email}`} className={BOTON}>
                    Correo
                  </a>
                  {borrar ? (
                    <button onClick={() => borrar(l)} className={`${BOTON_PELIGRO} ml-auto`}>
                      <Trash2 size={13} /> Borrar
                    </button>
                  ) : null}
                </div>
                <Seguimiento email={l.email} onCambioFecha={onCambioFecha} />
                <div>
                  <EnlacePago email={l.email} nombre={l.name} telefono={l.phone} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

