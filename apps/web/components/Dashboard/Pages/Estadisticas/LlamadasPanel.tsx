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
import { getLlamadas, type Llamada } from '@services/stats/contactos'
import { marcarSolicitud } from '@services/stats/school'
import { Check, ChevronDown, ChevronRight, Loader2, PhoneCall, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'

function fecha(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const data = await getLlamadas(org.id, accessToken)
    if (data === null) setFallo(true)
    else setLlamadas(data)
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function alternar(l: Llamada) {
    if (!l.solicitud_id) {
      toast.error('Esta llamada no tiene solicitud asociada; márcala desde Contactos.')
      return
    }
    const ahora = Boolean(l.contacted_at)
    setGuardando(l.id)
    const ok = await marcarSolicitud(org?.id, l.solicitud_id, !ahora, accessToken)
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
      <div className={CARD}>
        <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
          <PhoneCall size={16} className="text-[#025dc7]" /> Llamadas pedidas
        </h2>
        <p className="text-[12.5px] text-[#5A6480] mt-1.5 leading-relaxed">
          Cada persona que termina el formulario de agendar sale aquí con todas sus respuestas, y te llega
          también por correo. Si encajaba, ya vio el botón de reservar día y hora; si no reservó, escríbele tú.
          Cuando la hayas atendido, márcala.
        </p>
      </div>

      {llamadas.length === 0 ? (
        <div className={CARD}>
          <p className="text-[13.5px] text-gray-700">Todavía no ha pedido una llamada nadie.</p>
        </div>
      ) : (
        <>
          <Lista
            titulo={pendientes.length === 0 ? 'Todas atendidas' : `Por atender · ${pendientes.length}`}
            filas={pendientes}
            abierta={abierta}
            setAbierta={setAbierta}
            alternar={alternar}
            guardando={guardando}
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
                <Lista filas={atendidas} abierta={abierta} setAbierta={setAbierta} alternar={alternar} guardando={guardando} apagada />
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
  apagada = false,
}: {
  titulo?: string
  filas: Llamada[]
  abierta: number | null
  setAbierta: (id: number | null) => void
  alternar: (l: Llamada) => void
  guardando: number | null
  apagada?: boolean
}) {
  if (filas.length === 0 && !titulo) return null
  return (
    <section className="space-y-2">
      {titulo ? <h3 className="text-[13px] font-semibold text-gray-900">{titulo}</h3> : null}
      {filas.map((l) => {
        const open = abierta === l.id
        const hecha = Boolean(l.contacted_at)
        return (
          <div
            key={l.id}
            className={`rounded-xl border transition-colors ${
              open ? 'border-[#4da3ff] bg-white' : hecha || apagada ? 'border-[#E7EEF9] bg-white opacity-70' : 'border-[#DDE6F5] bg-[#F7FAFF]'
            }`}
          >
            <button
              onClick={() => setAbierta(open ? null : l.id)}
              className="w-full text-left px-3.5 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-gray-900 truncate">
                  {l.name || l.email}
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle ${
                      l.apto ? 'bg-[#E8FBF3] text-[#0E9F6E]' : 'bg-[#FFFBF2] text-[#8A6A2A]'
                    }`}
                  >
                    {l.apto ? 'Encaja' : 'No encaja'} · {l.puntuacion} pts
                  </span>
                </p>
                <p className="text-[12px] text-gray-500 truncate">
                  {l.email}
                  {l.phone ? ` · ${l.phone}` : ''}
                  {l.created_at ? <span className="text-[#9CA3AF]"> · {fecha(l.created_at)}</span> : null}
                </p>
              </div>
              {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
            </button>

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

                {l.sin_respuestas ? (
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
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
