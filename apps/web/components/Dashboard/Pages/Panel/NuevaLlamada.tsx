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
import {
  cambiarHoraLlamada,
  getEventosAgenda,
  getHuecos,
  getOpcionesAgenda,
  reservarLlamada,
  type Cita,
  type Huecos,
  type OpcionesAgenda,
} from '@services/stats/contactos'
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

/** Lo último elegido en «Por dónde», por evento, en este navegador. */
const CLAVE_DONDE = 'nawar.llamada.donde'

const CHIP = (activo: boolean) =>
  `h-8 px-3 rounded-md border text-[13px] font-medium transition-colors ${
    activo ? 'bg-gray-900 border-gray-900 text-white' : 'border-[#E5E7EB] text-gray-800 hover:bg-[#F9FAFB]'
  }`

/** «No sale Belén» (06/11): lo que ve la escuela de Calendly, evento a
 *  evento, con el motivo por el que cuenta o no. Solo lee. */
function PorQueNoSale() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof getEventosAgenda>> | undefined>(undefined)
  useEffect(() => {
    if (!abierto || datos !== undefined || !org?.id || !accessToken) return
    getEventosAgenda(org.id, accessToken).then((r) => setDatos(r))
  }, [abierto, datos, org?.id, accessToken])
  return (
    <div className="mt-1">
      <button onClick={() => setAbierto((v) => !v)} className="text-[12px] font-semibold text-[#025dc7] hover:underline">
        {abierto ? 'Ocultar' : '¿Por qué no sale? Ver los eventos que ve la escuela'}
      </button>
      {abierto ? (
        datos === undefined ? (
          <p className={`${META} mt-1 inline-flex items-center gap-1.5`}>
            <Loader2 size={12} className="animate-spin" /> Preguntando a Calendly…
          </p>
        ) : !datos ? (
          <p className="mt-1 text-[12px] text-[#B91C1C]">No se ha podido leer.</p>
        ) : datos.error ? (
          <p className="mt-1 text-[12px] text-[#B91C1C]">Lo que dijo Calendly: {datos.error}</p>
        ) : (
          <div className="mt-1.5 space-y-1.5 rounded-lg border border-[#E2E8F4] bg-[#F8FAFE] p-2.5">
            {datos.fuente === 'usuario' ? (
              <p className="text-[12px] text-[#92400E]">
                Calendly solo deja leer los eventos de la cuenta conectada, no los de toda la organización: el token tiene que
                ser de un administrador de la organización de Calendly.
              </p>
            ) : null}
            {datos.filas.length === 0 ? <p className="text-[12px] text-gray-600">Calendly no devuelve ningún evento activo.</p> : null}
            {datos.filas.map((f, i) => (
              <div key={i} className="text-[12px] leading-snug">
                <p className="font-semibold text-gray-900">
                  {f.evento}{' '}
                  <span className="font-normal text-gray-500">
                    · {f.como}
                    {f.gestionado ? ' · gestionado' : ''}
                    {f.secreto ? ' · secreto' : ''}
                    {f.de ? ` · de ${f.de}` : ''}
                  </span>
                </p>
                <p className={f.vale ? 'text-[#15803D]' : 'text-gray-700'}>{f.motivo}</p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

/** «Quién la lleva» y «Por dónde» (05/11). Con el evento por turnos, Calendly
 *  elige el closer y la herramienta va con él; con el evento propio de un
 *  closer, se elige entre las videollamadas que tenga ese evento. */
function QuienYDonde({
  opciones,
  quien,
  setQuien,
  ubicacion,
  setUbicacion,
  deQuien = 0,
  deQuienNombre = '',
}: {
  opciones: OpcionesAgenda | null
  quien: string
  setQuien: (v: string) => void
  ubicacion: string
  setUbicacion: (v: string) => void
  /** Al cambiar la hora (06/11): el closer de esa llamada y su nombre. */
  deQuien?: number
  deQuienNombre?: string
}) {
  if (!opciones) return <p className={`${META} inline-flex items-center gap-1.5`}><Loader2 size={13} className="animate-spin" /> Cargando quién puede llevarla…</p>
  if (!opciones.configurado || opciones.opciones.length === 0) return null
  const elegida = opciones.opciones.find((o) => o.id === quien)
  const base = opciones.opciones.find((o) => o.id === 'turnos')?.evento || 'Llamada de Consultoría HN'
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[12.5px] font-medium text-gray-700 mb-1.5">Quién la lleva</p>
        <div className="flex flex-wrap gap-1.5">
          {opciones.opciones.map((o) => (
            <button key={o.id} onClick={() => setQuien(o.id)} className={CHIP(quien === o.id)} title={o.evento}>
              {o.quien}
            </button>
          ))}
        </div>
        {elegida?.por_turnos ? (
          <p className={`${META} mt-1 !whitespace-normal`}>Calendly elige quién está libre a esa hora.</p>
        ) : elegida ? (
          <p className={`${META} mt-1 !whitespace-normal`}>Con su evento «{elegida.evento}»: salen las horas libres de {elegida.quien}.</p>
        ) : null}
        {/* «Una llamada de Belén acabó en el calendario de Diego al cambiarle
            la hora» (06/11): que se vea ANTES de confirmar a qué calendario va. */}
        {deQuien > 0 && elegida && !elegida.por_turnos && elegida.closer_id !== deQuien ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-[#B91C1C]">
            Esta llamada es de {deQuienNombre || 'otro closer'}: así pasa al calendario de {elegida.quien}, con su enlace.
          </p>
        ) : null}
        {deQuien > 0 && elegida?.por_turnos ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-[#92400E]">
            Con «Por turnos», Calendly puede ponerla en el calendario de otro closer.{' '}
            {opciones.opciones.some((o) => o.closer_id === deQuien)
              ? `Para que siga con ${deQuienNombre || 'su closer'}, elige «${deQuienNombre}».`
              : `${deQuienNombre || 'Su closer'} no tiene evento propio en Calendly: créale uno para que la hora nueva vaya a su calendario.`}
          </p>
        ) : null}
        {opciones.faltan.length > 0 ? (
          <>
            <p className={`${META} mt-1 !whitespace-normal`}>
              Sin evento propio en Calendly: {opciones.faltan.join(' y ')}. Para poder elegir a {opciones.faltan.length > 1 ? 'cada uno' : opciones.faltan[0]}{' '}
              aquí, crea en su Calendly un evento 1 a 1 cuyo nombre empiece por «{base}» (por ejemplo «{base} (equipo)»).
            </p>
            <PorQueNoSale />
          </>
        ) : null}
      </div>
      {elegida && elegida.ubicaciones.length > 1 ? (
        <div>
          <p className="text-[12.5px] font-medium text-gray-700 mb-1.5">Por dónde</p>
          <div className="flex flex-wrap gap-1.5">
            {elegida.por_turnos ? (
              <button onClick={() => setUbicacion('')} className={CHIP(ubicacion === '')}>
                La de quien le toque
              </button>
            ) : null}
            {elegida.ubicaciones.map((u) => (
              <button key={u.kind} onClick={() => setUbicacion(u.kind)} className={CHIP(ubicacion === u.kind)}>
                {u.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : elegida && elegida.ubicaciones.length === 1 ? (
        <p className="text-[13px] text-gray-800">
          <span className="font-medium">Por dónde:</span> {elegida.ubicaciones[0].nombre}{' '}
          <span className="text-gray-500">(es la única que tiene su evento)</span>
        </p>
      ) : elegida?.por_turnos ? (
        <p className="text-[13px] text-gray-700">
          <span className="font-medium">Por dónde:</span> la de quien le toque (en Calendly, cada closer tiene la suya).
        </p>
      ) : elegida ? (
        <p className="text-[13px] text-gray-700">
          <span className="font-medium">Por dónde:</span> la que ponga su evento de Calendly.
        </p>
      ) : null}
    </div>
  )
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
  // Quién la lleva y por dónde (05/11): «turnos» = Calendly elige; si no, el
  // evento propio de ese closer, con su Zoom o su Meet.
  const [opciones, setOpciones] = useState<OpcionesAgenda | null>(null)
  const [quien, setQuien] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const elegida = opciones?.opciones.find((o) => o.id === quien) || null
  const evento = elegida && !(elegida.id === 'turnos') ? elegida.uri : ''

  useEffect(() => {
    const f = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  // Al cambiar la hora: el closer de esa llamada (el de su tarjeta; si no
  // tiene, a quien se la dio Calendly).
  const deQuien = cambiar ? Number(cambiar.closer_id || cambiar.calendly_closer_id || 0) : 0
  const deQuienNombre = cambiar ? ((cambiar.closer_id ? cambiar.closer : cambiar.calendly_closer) || '').split(/\s+/)[0] : ''

  // Las opciones, una vez (con la persona, para proponer a quien ya la lleva).
  const personaEmail = (cambiar?.email || inicial?.email || '').trim().toLowerCase()
  useEffect(() => {
    if (!org?.id || !accessToken) return
    let vivo = true
    getOpcionesAgenda(org.id, personaEmail, accessToken).then((r) => {
      if (!vivo) return
      const ops = r || { configurado: false, opciones: [], propuesta: '', faltan: [] }
      setOpciones(ops)
      // Al cambiar la hora, se propone el closer que ya tiene la llamada. Si
      // ese closer no tiene evento propio, «Por turnos» (y la ventana lo
      // avisa), NUNCA el de quien agenda: así una llamada de Belén acababa en
      // el calendario de Diego (06/11, Oriannys).
      const suya = deQuien ? ops.opciones.find((o) => o.closer_id === deQuien) : undefined
      if (cambiar && deQuien) setQuien(suya?.id || (ops.opciones.some((o) => o.id === 'turnos') ? 'turnos' : ops.opciones[0]?.id || 'turnos'))
      else setQuien(suya?.id || ops.propuesta || ops.opciones[0]?.id || 'turnos')
    })
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken, personaEmail, deQuien]) // eslint-disable-line react-hooks/exhaustive-deps

  // Por dónde (05/11): lo último que se eligió con ese evento (se recuerda en
  // este navegador); si no, en el por turnos «La de quien le toque» y en el
  // de un closer la primera que ofrezca.
  useEffect(() => {
    const ub = elegida?.ubicaciones || []
    let guardada = ''
    try {
      guardada = (JSON.parse(localStorage.getItem(CLAVE_DONDE) || '{}') || {})[elegida?.id || ''] || ''
    } catch {}
    if (ub.some((u) => u.kind === guardada)) setUbicacion(guardada)
    else setUbicacion(elegida?.por_turnos ? '' : ub[0]?.kind || '')
  }, [elegida?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function elegirDonde(v: string) {
    setUbicacion(v)
    try {
      const todas = JSON.parse(localStorage.getItem(CLAVE_DONDE) || '{}') || {}
      todas[elegida?.id || ''] = v
      localStorage.setItem(CLAVE_DONDE, JSON.stringify(todas))
    } catch {}
  }

  useEffect(() => {
    if (!org?.id || !accessToken || !fecha || !quien) return
    let vivo = true
    setCargando(true)
    setHueco(null)
    getHuecos(org.id, fecha, accessToken, evento).then((r) => {
      if (!vivo) return
      setHuecos(r)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken, fecha, quien, evento])

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
        evento,
        ubicacion,
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
    const r = await reservarLlamada(
      org?.id,
      {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        inicio: hueco.inicio,
        url: hueco.url,
        evento,
        ubicacion,
      },
      accessToken
    )
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
            <QuienYDonde
              opciones={opciones}
              quien={quien}
              setQuien={setQuien}
              ubicacion={ubicacion}
              setUbicacion={elegirDonde}
              deQuien={deQuien}
              deQuienNombre={deQuienNombre}
            />
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
                  {fecha > diaDe(new Date(Date.now() + 86400000)) ? (
                    <span className="text-gray-500">
                      Si ese día tienes huecos, es que el evento de Calendly no deja reservar tan adelante. Para el
                      equipo está la copia secreta del evento, con más días: si no la hay, que la cree el administrador
                      en Calendly.
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
