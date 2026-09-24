'use client'

/**
 * Llamadas — quién ha terminado el formulario de agendar llamada, por nombre.
 * Se abre uno y están todas sus respuestas, sus datos y los botones para
 * escribirle. La marca de "atendida" es la misma que en Matrículas nuevas
 * (la solicitud que crea el mismo formulario), así que no hay dos listas que
 * mantener al día.
 *
 * Qué pasa después de que alguien termine el formulario, para que quede
 * claro desde aquí:
 *  1. Si encaja, ve el botón de reservar día y hora (Calendly, o WhatsApp si
 *     no está puesto). Si no encaja, se le manda a la guía gratis.
 *  2. Los administradores reciben un correo con sus respuestas.
 *  3. Aquí sale como "por atender" hasta que se marca. Si reservó por
 *     Calendly ya tiene hora; si no, hay que escribirle uno.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PorDia from './PorDia'
import Seguimiento from './Seguimiento'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { avisoTrasBorrar, borrarContacto, crearEnlacePago, cuandoLlamar, getAgenda, getRecordatorios, hoyISO, type VolverALlamar, getLlamadas, marcarLlamada, type Agenda, type Cita, type Llamada } from '@services/stats/contactos'
import { marcarSolicitud } from '@services/stats/school'
import { CalendarDays, Check, ChevronDown, ChevronRight, Copy, CreditCard, Loader2, PhoneCall, RefreshCw, RotateCcw, Trash2, Video } from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'

function fecha(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "jue 25 sep · 18:00", en la hora del que mira. */
function diaHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${dia} · ${hora}`
}

function whatsapp(tel: string) {
  const num = (tel || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '')
  return num ? `https://wa.me/${num}` : ''
}

export default function LlamadasPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [llamadas, setLlamadas] = useState<Llamada[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [verAtendidas, setVerAtendidas] = useState(false)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [recordatorios, setRecordatorios] = useState<Record<string, VolverALlamar>>({})
  const llamarDe = (email: string) => recordatorios[(email || '').toLowerCase()]
  const cambioFecha = (email: string, v: VolverALlamar | null) =>
    setRecordatorios((prev) => {
      const next = { ...prev }
      if (v) next[email.toLowerCase()] = v
      else delete next[email.toLowerCase()]
      return next
    })
  const [cargandoAgenda, setCargandoAgenda] = useState(false)

  const { isAdmin } = useAdminStatus()
  // Solo administradores: quitar a quien era una prueba o no vale. Borra a la
  // persona entera (sus llamadas, solicitudes y matrículas sin pagar), igual
  // que desde Contactos.
  async function borrar(l: Llamada) {
    if (!window.confirm(`¿Borrar a ${l.name || l.email}? Es para pruebas o leads que no valen. No se puede deshacer. Los pagos, la cuenta y el CRM no se tocan.`)) return
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
    cargarAgenda()
  }, [cargarAgenda])

  // La próxima cita de cada correo, para ponerla en su línea.
  const citaDe = (email: string): Cita | undefined =>
    (agenda?.citas || []).find((c) => c.email === (email || '').toLowerCase())

  async function alternar(l: Llamada) {
    const ahora = Boolean(l.contacted_at)
    setGuardando(l.id)
    // Con solicitud, la misma marca que Matrículas nuevas; sin ella (los que
    // no terminaron), la marca va en el propio evento.
    const ok = l.solicitud_id
      ? await marcarSolicitud(org?.id, l.solicitud_id, !ahora, accessToken)
      : await marcarLlamada(org?.id, l.id, !ahora, accessToken)
    setGuardando(null)
    if (!ok) {
      toast.error('No se ha podido guardar')
      return
    }
    setLlamadas((prev) =>
      (prev || []).map((x) => (x.id === l.id ? { ...x, contacted_at: ahora ? '' : new Date().toISOString() } : x))
    )
  }

  if (fallo) {
    return (
      <div className={CARD}>
        <p className="text-[14px] text-gray-600">No se han podido cargar las llamadas. Prueba a actualizar.</p>
      </div>
    )
  }
  if (llamadas === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  const pendientes = llamadas.filter((l) => !l.contacted_at)
  const atendidas = llamadas.filter((l) => Boolean(l.contacted_at))

  return (
    <div className="space-y-4">
      {/* Lo justo para saber qué es cada cosa. Antes era un párrafo de cinco
          líneas que nadie leía. */}
      <p className="text-[13px] text-[#5A6480] leading-relaxed">
        Quien pide una llamada en la web, con sus respuestas. Ábrela para leerlas antes de llamar y márcala
        cuando la hayas atendido. <strong className="text-gray-800">No terminó</strong> = dejó sus datos y se fue a mitad.
      </p>

      <AgendaCard
        agenda={agenda}
        cargando={cargandoAgenda}
        recargar={() => cargarAgenda(true)}
        abrir={(email) => {
          const l = llamadas.find((x) => x.email === email)
          if (l) setAbierta(l.id)
        }}
        tieneFicha={(email) => llamadas.some((x) => x.email === email)}
      />

      {llamadas.length === 0 ? (
        <div className={CARD}>
          <p className="text-[13.5px] text-gray-700">Todavía no ha pedido una llamada nadie.</p>
        </div>
      ) : (
        <>
          <h3 className="text-[14px] font-bold text-gray-900">
            {pendientes.length === 0 ? 'Todas atendidas' : `Por atender · ${pendientes.length}`}
          </h3>
          {/* Por día en que la pidieron, como Matrículas nuevas: Hoy y Ayer
              abiertos, lo viejo plegado. */}
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
                className="text-[13px] font-semibold text-[#5A6480] inline-flex items-center gap-1 mb-2"
              >
                {verAtendidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Ya atendidas · {atendidas.length}
              </button>
              {verAtendidas && (
                <Lista filas={atendidas} abierta={abierta} setAbierta={setAbierta} alternar={alternar} guardando={guardando} citaDe={citaDe} borrar={isAdmin ? borrar : undefined} llamarDe={llamarDe} onCambioFecha={cambioFecha} apagada />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Lista({
  titulo,
  filas,
  abierta,
  setAbierta,
  alternar,
  guardando,
  citaDe,
  borrar,
  llamarDe,
  onCambioFecha,
  apagada = false,
}: {
  titulo?: string
  filas: Llamada[]
  abierta: number | null
  setAbierta: (id: number | null) => void
  alternar: (l: Llamada) => void
  guardando: number | null
  citaDe: (email: string) => Cita | undefined
  borrar?: (l: Llamada) => void
  llamarDe?: (email: string) => VolverALlamar | undefined
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
  apagada?: boolean
}) {
  if (filas.length === 0 && !titulo) return null
  return (
    <section className="space-y-2">
      {titulo ? <h3 className="text-[13px] font-semibold text-gray-900">{titulo}</h3> : null}
      {filas.map((l) => {
        const open = abierta === l.id
        const hecha = Boolean(l.contacted_at)
        const cita = citaDe(l.email)
        const llamar = llamarDe?.(l.email)
        return (
          <div
            key={l.id}
            className={`rounded-xl border transition-colors ${
              open ? 'border-[#4da3ff] bg-white' : hecha || apagada ? 'border-[#E7EEF9] bg-white opacity-70' : 'border-[#DDE6F5] bg-[#F7FAFF]'
            }`}
          >
            <div className="flex items-stretch">
            <button
              onClick={() => setAbierta(open ? null : l.id)}
              className="flex-1 min-w-0 text-left px-3.5 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-gray-900 truncate">
                  {l.name || l.email}
                  {llamar ? (
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle ${
                        llamar.fecha <= hoyISO() ? 'bg-red-50 text-red-600' : 'bg-[#FFFBF2] text-[#8A6A2A]'
                      }`}
                    >
                      Volver a llamar {cuandoLlamar(llamar.fecha)}
                    </span>
                  ) : null}
                  {cita ? (
                    <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle bg-[#E8FBF3] text-[#0E9F6E]">
                      Llamada {diaHora(cita.inicio)}
                    </span>
                  ) : l.reservada_at ? (
                    <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle bg-[#E8FBF3] text-[#0E9F6E]">
                      Hora reservada
                    </span>
                  ) : null}
                  {l.terminado ? (
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle ${
                        l.apto ? 'bg-[#E8FBF3] text-[#0E9F6E]' : 'bg-[#FFFBF2] text-[#8A6A2A]'
                      }`}
                    >
                      {l.apto ? 'Encaja' : 'No encaja'} · {l.puntuacion} pts
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle bg-[#EAF3FF] text-[#025dc7]">
                      No terminó
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-gray-500 truncate">
                  {l.email}
                  {l.phone ? ` · ${l.phone}` : ''}
                  {l.created_at ? <span className="text-[#9CA3AF]"> · {fecha(l.created_at)}</span> : null}
                </p>
              </div>
              {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
            </button>
            {/* Papelera a la vista, sin tener que abrir la llamada (solo administradores). */}
            {borrar ? (
              <button
                onClick={() => borrar(l)}
                title="Borrar (era una prueba o no vale)"
                aria-label={`Borrar a ${l.name || l.email}`}
                className="shrink-0 px-3 border-l border-[#DDE6F5] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-r-xl transition-colors"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
            </div>

            {open && (
              <div className="px-3.5 pb-3.5 space-y-3">
                <p className="text-[12px] text-[#5A6480]">
                  {l.vino_de ? `Vino de ${l.vino_de}` : 'Sin rastro de por dónde llegó'}
                  {' · '}
                  {l.vio_precio ? (
                    <span className="text-emerald-700 font-semibold">ya vio el precio</span>
                  ) : (
                    <span className="text-[#8A6A2A] font-semibold">sin rastro de haber visto el precio</span>
                  )}
                  {l.utm_campaign ? ` · campaña ${l.utm_campaign}` : ''}
                </p>

                {l.terminado && !l.apto && l.motivo_fuera ? (
                  <p className="text-[12.5px] text-[#8A6A2A]">Se quedó fuera por: {l.motivo_fuera}.</p>
                ) : null}
                {!l.terminado && l.respuestas.length === 0 ? (
                  <p className="text-[12.5px] text-gray-600">
                    Dejó su nombre, correo y teléfono y se fue antes de contestar las preguntas. Escríbele: ya
                    mostró interés.
                  </p>
                ) : !l.terminado ? (
                  <>
                    <p className="text-[12.5px] text-gray-600">
                      Se fue a mitad{l.ultima_pregunta ? ` después de «${l.ultima_pregunta}»` : ''}. Esto es lo que
                      llegó a contestar:
                    </p>
                    <ul className="rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] divide-y divide-[#E7EEF9]">
                      {l.respuestas.map((r, j) => (
                        <li key={j} className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-0.5">
                          <span className="text-[12px] text-gray-500 leading-snug">{r.pregunta}</span>
                          <span className="text-[12.5px] text-gray-900 font-semibold leading-snug whitespace-pre-wrap break-words">{r.respuesta}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : l.sin_respuestas ? (
                  <p className="text-[12.5px] text-gray-500">No se guardaron las respuestas de esta llamada.</p>
                ) : (
                  <ul className="rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] divide-y divide-[#E7EEF9]">
                    {l.respuestas.map((r, j) => (
                      <li key={j} className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-0.5">
                        <span className="text-[12px] text-gray-500 leading-snug">{r.pregunta}</span>
                        <span className="text-[12.5px] text-gray-900 font-semibold leading-snug whitespace-pre-wrap break-words">{r.respuesta}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  {whatsapp(l.phone) && (
                    <a
                      href={whatsapp(l.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                  <a
                    href={`mailto:${l.email}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                  >
                    Correo
                  </a>
                  <button
                    onClick={() => alternar(l)}
                    disabled={guardando === l.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50 ${
                      hecha ? 'bg-white border border-[#DDE6F5] text-gray-600 hover:bg-gray-50' : 'bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656]'
                    }`}
                  >
                    {guardando === l.id ? <Loader2 size={13} className="animate-spin" /> : hecha ? <RotateCcw size={13} /> : <Check size={13} />}
                    {hecha ? 'Volver a pendiente' : 'Ya la he atendido'}
                  </button>
                  {borrar ? (
                    <button
                      onClick={() => borrar(l)}
                      title="Borrar (era una prueba o no vale)"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} /> Borrar
                    </button>
                  ) : null}
                  {cita?.enlace ? (
                    <a
                      href={cita.enlace}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                    >
                      <Video size={13} /> Entrar a la llamada
                    </a>
                  ) : null}
                </div>
                <Seguimiento email={l.email} onCambioFecha={onCambioFecha} />
                <EnlacePago llamada={l} />
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/**
 * La agenda de Calendly: quién tiene llamada y cuándo. Es lo primero que mira
 * el closer al abrir la pestaña.
 */
function AgendaCard({
  agenda,
  cargando,
  recargar,
  abrir,
  tieneFicha,
}: {
  agenda: Agenda | null
  cargando: boolean
  recargar: () => void
  abrir: (email: string) => void
  tieneFicha: (email: string) => boolean
}) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays size={16} className="text-[#025dc7]" /> Próximas llamadas
        </h2>
        {agenda?.configurado ? (
          <button
            onClick={recargar}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A6480] hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        ) : null}
      </div>

      {agenda === null ? (
        <p className="text-[12.5px] text-gray-500 mt-2">{cargando ? 'Cargando…' : 'No se ha podido leer la agenda.'}</p>
      ) : !agenda.configurado ? (
        <p className="text-[12.5px] text-[#5A6480] mt-2 leading-relaxed">
          Para ver aquí el día y la hora de cada llamada, conecta Calendly: en Calendly, Integraciones → API y
          webhooks → crea un token de acceso personal, y pégalo en Railway como{' '}
          <code className="text-[11.5px] bg-[#F0F5FF] px-1 rounded">LEARNHOUSE_CALENDLY_TOKEN</code>.
        </p>
      ) : agenda.error ? (
        <p className="text-[12.5px] text-red-700 mt-2">{agenda.error}</p>
      ) : agenda.citas.length === 0 ? (
        <p className="text-[12.5px] text-gray-500 mt-2">No hay llamadas reservadas en los próximos días.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {agenda.citas.map((c, i) => (
            <li
              key={`${c.email}-${c.inicio}-${i}`}
              className="rounded-xl border border-[#DDE6F5] bg-[#F7FAFF] px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="text-[13px] font-semibold text-[#025dc7] min-w-[150px]">{diaHora(c.inicio)}</span>
              <span className="flex-1 min-w-0 text-[13px] text-gray-900 truncate">
                <span className="font-semibold">{c.nombre || c.email}</span>
                <span className="text-gray-500"> · {c.email}{c.telefono ? ` · ${c.telefono}` : ''}</span>
              </span>
              <span className="flex gap-2">
                {tieneFicha(c.email) ? (
                  <button onClick={() => abrir(c.email)} className="text-[12px] font-bold text-[#025dc7] hover:underline">
                    Ver respuestas
                  </button>
                ) : (
                  <span className="text-[11.5px] text-[#9CA3AF]">Reservó sin pasar por el formulario</span>
                )}
                {c.enlace ? (
                  <a href={c.enlace} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-[#025dc7] hover:underline">
                    Entrar
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Enlace de pago personal: el checkout de la escuela con sus datos ya puestos.
 * Para mandárselo por WhatsApp después de la llamada. Paga por el camino de
 * siempre, así que la cuenta, el correo y la factura salen solos (con un
 * Payment Link de Stripe no pasaba y había que dar de alta a mano).
 */
function EnlacePago({ llamada }: { llamada: Llamada }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [url, setUrl] = useState('')
  const [dias, setDias] = useState(0)
  const [creando, setCreando] = useState(false)

  const partes = (llamada.name || '').trim().split(/\s+/)
  const nombre = partes[0] || ''
  const apellidos = partes.slice(1).join(' ')

  async function crear() {
    setCreando(true)
    const r = await crearEnlacePago(
      org?.id,
      { email: llamada.email, first_name: nombre || llamada.email, last_name: apellidos, phone: llamada.phone },
      accessToken
    )
    setCreando(false)
    if (!r.url) {
      toast.error(r.error || 'No se ha podido crear el enlace')
      return
    }
    setUrl(r.url)
    setDias(r.dias || 0)
  }

  const num = (llamada.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '')
  const textoWa = encodeURIComponent(`Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu enlace para apuntarte a la formación: ${url}`)

  return (
    <div className="rounded-lg border border-dashed border-[#DDE6F5] px-3 py-2.5">
      {!url ? (
        <button
          onClick={crear}
          disabled={creando}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#025dc7] hover:underline disabled:opacity-50"
        >
          {creando ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Crear su enlace de pago
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-gray-600">
            Enlace listo, con sus datos ya puestos. Vale {dias} días. Al pagar se le crea la cuenta y le llega la
            factura, como en cualquier matrícula.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={url} className="flex-1 min-w-[180px] text-[12px] bg-[#F7FAFF] border border-[#E7EEF9] rounded-lg px-2.5 py-1.5 text-gray-700" />
            <button
              onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Copiado'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold"
            >
              <Copy size={13} /> Copiar
            </button>
            {num ? (
              <a
                href={`https://wa.me/${num}?text=${textoWa}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[12px] font-bold"
              >
                Mandar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
