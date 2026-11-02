'use client'

/**
 * Agendar una llamada desde la escuela (15/10/2026): nombre, correo, día y una
 * de las horas libres que da Calendly. La reserva la hace Calendly, que le
 * manda a la persona su correo con el enlace de la videollamada, igual que si
 * hubiera reservado ella.
 *
 * Con `cambiar` (31/10) es «Cambiar la hora» de una llamada que ya existe: la
 * misma persona, otro día y otra hora. El servidor reserva la nueva y, si sale
 * bien, cancela la vieja (apps/api/src/services/contactos/reservar.py,
 * `cambiar_hora`). Lo usan closers y administradores, con cualquier llamada.
 *
 * Si Calendly no deja reservar desde fuera (su plan gratis), en vez de fallar
 * se ofrece su página de esa hora con el nombre y el correo puestos: un clic
 * en «Programar evento» y listo. Ver apps/api/src/services/contactos/reservar.py.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { cambiarHoraLlamada, getHuecos, reservarLlamada, type Cita, type Huecos } from '@services/stats/contactos'
import { CalendarClock, CalendarPlus, ExternalLink, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ZONA_ESCUELA, horaEscuela } from '@/lib/nawar/recordatorioLlamada'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'

const CAMPO =
  'w-full h-9 rounded-md border border-[#D1D5DB] px-3 text-[13.5px] text-gray-900 outline-none focus:border-gray-900'

/** AAAA-MM-DD de una fecha, en Países Bajos. */
const diaDe = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA_ESCUELA })

/** «jue 30 oct, 18:00» en la hora de Países Bajos. */
const diaYHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: ZONA_ESCUELA })}, ${horaEscuela(d)}`
}

export default function NuevaLlamada({
  inicial,
  dia,
  cambiar,
  onClose,
  onHecho,
}: {
  inicial?: { nombre?: string; email?: string; telefono?: string }
  dia?: Date
  /** La llamada a la que se le cambia la hora (31/10). */
  cambiar?: Cita
  onClose: () => void
  onHecho: () => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const hoy = diaDe(new Date())
  const [nombre, setNombre] = useState(cambiar?.nombre || inicial?.nombre || '')
  const [email, setEmail] = useState(cambiar?.email || inicial?.email || '')
  const [telefono, setTelefono] = useState(cambiar?.telefono || inicial?.telefono || '')
  const [fecha, setFecha] = useState(() => {
    const d = cambiar ? diaDe(new Date(cambiar.inicio)) : dia ? diaDe(dia) : hoy
    return d < hoy ? hoy : d
  })
  // Al cambiar la hora: ¿ya lo ha hablado con la persona? Entonces la nueva
  // sale «Confirmada» y no en «Por confirmar».
  const [yaHablado, setYaHablado] = useState(false)
  const [fallo, setFallo] = useState('')
  const [huecos, setHuecos] = useState<Huecos | null>(null)
  const [cargando, setCargando] = useState(false)
  const [hueco, setHueco] = useState<{ inicio: string; url: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState<{ url: string; motivo: string; plan: boolean } | null>(null)

  useEffect(() => {
    const f = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  useEffect(() => {
    if (!org?.id || !accessToken || !fecha) return
    let vivo = true
    setCargando(true)
    setHueco(null)
    getHuecos(org.id, fecha, accessToken).then((r) => {
      if (!vivo) return
      setHuecos(r)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken, fecha])

  const listo = nombre.trim() && email.includes('@') && hueco
  const pila = (nombre.trim().split(' ')[0] || 'la persona').replace(/^./, (l) => l.toUpperCase())

  async function cambiarHora() {
    if (!hueco || !cambiar) return
    setEnviando(true)
    setFallo('')
    const r = await cambiarHoraLlamada(
      org?.id,
      {
        cita_id: cambiar.id,
        email: cambiar.email,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        antes: cambiar.inicio,
        inicio: hueco.inicio,
        confirmada: yaHablado,
      },
      accessToken
    )
    setEnviando(false)
    if (!r.ok) {
      // El motivo de Calendly tal cual, y la salida de siempre: su página.
      setFallo(r.error || 'No se ha podido cambiar la hora')
      return
    }
    if (r.datos?.aviso) toast(r.datos.aviso, { duration: 12000, icon: '⚠️' })
    else toast.success(`Hora cambiada al ${diaYHora(hueco.inicio)}. A ${pila} le llega de Calendly la invitación nueva.`, { duration: 6000 })
    onHecho()
    onClose()
  }

  async function agendar() {
    if (!hueco) return
    if (cambiar) return cambiarHora()
    setEnviando(true)
    const r = await reservarLlamada(org?.id, { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim(), inicio: hueco.inicio, url: hueco.url }, accessToken)
    setEnviando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido agendar')
      return
    }
    if (r.modo === 'enlace') {
      setConfirmar({ url: r.url || '', motivo: r.motivo || '', plan: Boolean(r.plan) })
      return
    }
    toast.success(`Agendada. A ${nombre.trim().split(' ')[0]} le llega el correo de Calendly con el enlace.`, { duration: 6000 })
    onHecho()
    onClose()
  }

  // pb-24 en el móvil: la barra flotante del panel tapaba el botón de abajo (31/10).
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-3 pb-24 sm:pb-3" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white border border-[#E5E7EB] max-h-[calc(100vh-7.5rem)] sm:max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-[#F3F4F6]">
          <div className="flex-1">
            <p className="text-[17px] font-semibold text-gray-900">{cambiar ? 'Cambiar la hora' : 'Nueva llamada'}</p>
            <p className={META}>
              {cambiar
                ? `${cambiar.nombre || cambiar.email} · ahora: ${diaYHora(cambiar.inicio)}`
                : huecos?.evento
                  ? `${huecos.evento}${huecos.duracion ? ` · ${huecos.duracion} min` : ''}`
                  : 'Se agenda en Calendly'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 -m-1 text-gray-400 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {confirmar ? (
          <div className="px-5 py-4 space-y-3">
            <p className="text-[13.5px] text-gray-900">
              {confirmar.plan
                ? 'Tu plan de Calendly no deja agendar desde fuera (es de sus planes de pago).'
                : 'Calendly no la ha aceptado directamente.'}{' '}
              Te abro su página <strong>de esa hora</strong>, con el nombre y el correo ya puestos: solo pulsa{' '}
              <strong>«Programar evento»</strong>.
            </p>
            {/* El motivo tal cual: es lo que hace falta para arreglarlo (15/10). */}
            {confirmar.motivo ? (
              <p className="text-[12.5px] text-gray-700 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2.5 py-2 !whitespace-normal break-words">
                <span className="font-medium">Lo que dijo Calendly:</span> {confirmar.motivo}
              </p>
            ) : null}
            {confirmar.url ? (
              <a
                href={confirmar.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  onHecho()
                  setTimeout(onClose, 300)
                }}
                className={`${BOTON_PRINCIPAL} w-full h-10 justify-center`}
              >
                <ExternalLink size={14} /> Abrir Calendly y confirmar
              </a>
            ) : (
              <p className="text-[13px] text-red-700">No se ha podido preparar la página de Calendly. Agéndala allí a mano.</p>
            )}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {/* Al cambiar la hora la persona es la misma: no se reescribe. */}
            {cambiar ? (
              <p className="text-[13px] text-gray-700 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-3 py-2 !whitespace-normal">
                Elige el día y la hora nuevos. Calendly reserva la nueva y cancela la de antes: a {pila} le llegan los dos
                avisos de Calendly, la cancelación y la invitación con la hora nueva.
              </p>
            ) : null}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${cambiar ? 'hidden' : ''}`}>
              <label className="block">
                <span className="text-[12.5px] font-medium text-gray-700">Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} autoFocus={!inicial?.nombre} />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium text-gray-700">WhatsApp (opcional)</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+31 6…" className={CAMPO} />
              </label>
            </div>
            <label className={`block ${cambiar ? 'hidden' : ''}`}>
              <span className="text-[12.5px] font-medium text-gray-700">Correo</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />
              <span className={`${META} block mt-0.5`}>Ahí le llega el correo de Calendly con el enlace de la llamada.</span>
            </label>
            <label className="block">
              <span className="text-[12.5px] font-medium text-gray-700">Día</span>
              <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
            </label>

            <div>
              <p className="text-[12.5px] font-medium text-gray-700 mb-1.5">Hora (hora de Países Bajos)</p>
              {cargando ? (
                <p className={`${META} inline-flex items-center gap-1.5`}>
                  <Loader2 size={13} className="animate-spin" /> Mirando las horas libres en Calendly…
                </p>
              ) : huecos === null ? (
                <p className="text-[13px] text-red-700">No se han podido leer las horas libres.</p>
              ) : !huecos.configurado ? (
                <p className="text-[13px] text-gray-700">Calendly no está conectado a la escuela.</p>
              ) : huecos.error ? (
                <p className="text-[13px] text-red-700">Calendly dijo: {huecos.error}</p>
              ) : huecos.huecos.length === 0 ? (
                <p className="text-[13px] text-gray-700 !whitespace-normal">
                  No quedan horas libres ese día. Prueba con otro.{' '}
                  {fecha > diaDe(new Date(Date.now() + 30 * 86400000)) ? (
                    <span className="text-gray-500">
                      Si es una fecha lejana, puede que Calendly no deje reservar tan adelante: el evento → Límites de reserva.
                    </span>
                  ) : null}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {huecos.huecos.map((h) => (
                    <button
                      key={h.inicio}
                      onClick={() => setHueco(h)}
                      className={`h-8 px-3 rounded-md border text-[13px] font-medium tabular-nums transition-colors ${
                        hueco?.inicio === h.inicio ? 'bg-gray-900 border-gray-900 text-white' : 'border-[#E5E7EB] text-gray-800 hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {horaEscuela(new Date(h.inicio))}
                    </button>
                  ))}
                </div>
              )}
              {/* 19/10: "¿por qué no puedo agendar hoy a las 18:00 si tengo
                  hueco?". Calendly no ofrece horas que empiecen antes de su
                  «aviso mínimo» (de serie, 4 horas), y la escuela solo puede
                  agendar las horas que da Calendly. */}
              {fecha === hoy && huecos?.configurado && !huecos.error ? (
                <p className={`${META} mt-2`}>
                  Para hoy, Calendly solo da las horas que empiezan después de su «aviso mínimo» (de serie, 4 horas desde
                  ahora). Si falta una hora que tienes libre, bájalo en Calendly: el evento → Límites de reserva → Aviso mínimo.
                </p>
              ) : null}
            </div>

            {cambiar ? (
              <label className="flex items-start gap-2 text-[13px] text-gray-800 cursor-pointer">
                <input type="checkbox" checked={yaHablado} onChange={(e) => setYaHablado(e.target.checked)} className="mt-0.5" />
                <span>Ya lo he hablado con {pila}: la hora nueva queda confirmada</span>
              </label>
            ) : null}

            {fallo ? (
              <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 !whitespace-normal break-words">
                <span className="font-medium">No se ha cambiado nada.</span> Lo que dijo Calendly: {fallo}
                {cambiar?.cambiar_url ? (
                  <>
                    {' '}
                    <a href={cambiar.cambiar_url} target="_blank" rel="noreferrer" className="font-medium underline">
                      Cambiarla en Calendly
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button onClick={agendar} disabled={!listo || enviando} className={`${BOTON_PRINCIPAL} flex-1 h-10 justify-center disabled:opacity-50`}>
                {enviando ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : cambiar ? (
                  <CalendarClock size={14} />
                ) : (
                  <CalendarPlus size={14} />
                )}{' '}
                {cambiar ? (hueco ? `Cambiar al ${diaYHora(hueco.inicio)}` : 'Cambiar la hora') : 'Agendar llamada'}
              </button>
              <button onClick={onClose} className={`${BOTON} h-10`}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
