'use client'

/**
 * Agendar una llamada desde la escuela (15/10/2026): nombre, correo, día y una
 * de las horas libres que da Calendly. La reserva la hace Calendly, que le
 * manda a la persona su correo con el enlace de la videollamada, igual que si
 * hubiera reservado ella.
 *
 * Si Calendly no deja reservar desde fuera (su plan gratis), en vez de fallar
 * se ofrece su página de esa hora con el nombre y el correo puestos: un clic
 * en «Programar evento» y listo. Ver apps/api/src/services/contactos/reservar.py.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getHuecos, reservarLlamada, type Huecos } from '@services/stats/contactos'
import { CalendarPlus, ExternalLink, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ZONA_ESCUELA, horaEscuela } from '@/lib/nawar/recordatorioLlamada'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'

const CAMPO =
  'w-full h-9 rounded-md border border-[#D1D5DB] px-3 text-[13.5px] text-gray-900 outline-none focus:border-gray-900'

/** AAAA-MM-DD de una fecha, en Países Bajos. */
const diaDe = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA_ESCUELA })

export default function NuevaLlamada({
  inicial,
  dia,
  onClose,
  onHecho,
}: {
  inicial?: { nombre?: string; email?: string; telefono?: string }
  dia?: Date
  onClose: () => void
  onHecho: () => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const hoy = diaDe(new Date())
  const [nombre, setNombre] = useState(inicial?.nombre || '')
  const [email, setEmail] = useState(inicial?.email || '')
  const [telefono, setTelefono] = useState(inicial?.telefono || '')
  const [fecha, setFecha] = useState(() => {
    const d = dia ? diaDe(dia) : hoy
    return d < hoy ? hoy : d
  })
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

  async function agendar() {
    if (!hueco) return
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

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white border border-[#E5E7EB] max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-[#F3F4F6]">
          <div className="flex-1">
            <p className="text-[17px] font-semibold text-gray-900">Nueva llamada</p>
            <p className={META}>
              {huecos?.evento ? `${huecos.evento}${huecos.duracion ? ` · ${huecos.duracion} min` : ''}` : 'Se agenda en Calendly'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-[12.5px] font-medium text-gray-700">Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} autoFocus={!inicial?.nombre} />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium text-gray-700">WhatsApp (opcional)</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+31 6…" className={CAMPO} />
              </label>
            </div>
            <label className="block">
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
                <p className="text-[13px] text-gray-700">No quedan horas libres ese día. Prueba con otro.</p>
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
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={agendar} disabled={!listo || enviando} className={`${BOTON_PRINCIPAL} flex-1 h-10 justify-center disabled:opacity-50`}>
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} Agendar llamada
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
