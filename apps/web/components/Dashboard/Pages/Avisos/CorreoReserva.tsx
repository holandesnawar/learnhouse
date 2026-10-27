'use client'

/**
 * Avisos → «Al reservar una llamada»: el correo de Rida.
 *
 * Pedido del usuario (27/10/2026): que el correo «Un mensaje de Rida antes de
 * tu llamada» salga de la escuela (con su marca) en cuanto alguien reserva,
 * no de Calendly, y que no se repita al cambiar la hora. Apagado de serie: se
 * escribe, se prueba con «Mandármelo a mí» y se enciende.
 *
 * Calendly avisa a la escuela de cada reserva; la escuela se lo pide sola al
 * encenderlo (o con «Volver a conectar»). Servidor:
 * apps/api/src/services/contactos/correo_reserva.py.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  conectarCorreoReserva,
  getCorreoReserva,
  guardarCorreoReserva,
  vistaCorreoReserva,
  type CorreoReserva as Estado,
} from '@services/panel/panel'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { Eye, Loader2, RefreshCw, Send } from 'lucide-react'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA } from '../Panel/ui'

const CAMPO =
  'w-full bg-white rounded-md px-3 border border-[#E5E7EB] text-[13.5px] text-gray-900 placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] transition-colors'

function Interruptor({ activo, onClick, ocupado }: { activo: boolean; onClick: () => void; ocupado: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      onClick={onClick}
      disabled={ocupado}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${activo ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })

export default function CorreoReserva() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const [estado, setEstado] = useState<Estado | null>(null)
  const [asunto, setAsunto] = useState('')
  const [texto, setTexto] = useState('')
  const [vista, setVista] = useState<{ asunto: string; html: string } | null>(null)
  const [ocupado, setOcupado] = useState<'' | 'interruptor' | 'guardar' | 'vista' | 'prueba' | 'conectar'>('')
  const [error, setError] = useState('')

  const poner = (e: Estado) => {
    setEstado(e)
    setAsunto(e.asunto)
    setTexto(e.texto)
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getCorreoReserva(org.id, token)
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido cargar')
    poner(r.datos)
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiado = !!estado && (asunto !== estado.asunto || texto !== estado.texto)

  const alternar = async () => {
    if (!estado) return
    const activar = !estado.activo
    if (activar) {
      const ok = await confirmar(
        'A partir de ahora, cada persona que reserve su llamada recibirá este correo al momento (una sola vez). ¿Lo enciendes?',
        { boton: 'Encender' }
      )
      if (!ok) return
    }
    setOcupado('interruptor')
    setError('')
    // Con el texto que haya en pantalla: así no se enciende con uno a medias sin guardar.
    const r = await guardarCorreoReserva(org.id, { activo: activar, ...(cambiado ? { asunto, texto } : {}) }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido cambiar')
    poner(r.datos)
    if (activar && !r.datos.conexion.conectado) return toast.error('Encendido, pero Calendly todavía no avisa a la escuela: mira abajo por qué')
    toast.success(activar ? 'Correo encendido' : 'Correo apagado')
  }

  const guardar = async () => {
    setOcupado('guardar')
    setError('')
    const r = await guardarCorreoReserva(org.id, { asunto, texto }, token)
    setOcupado('')
    if (!r.ok || !r.datos) {
      setError(r.error || 'No se ha podido guardar')
      return false
    }
    poner(r.datos)
    toast.success('Texto guardado')
    return true
  }

  const verVista = async (aMi: boolean) => {
    setOcupado(aMi ? 'prueba' : 'vista')
    setError('')
    const r = await vistaCorreoReserva(org.id, { asunto, texto, a_mi: aMi }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido preparar')
    if (aMi) return toast.success(`Prueba enviada a ${r.datos.para}`)
    setVista({ asunto: r.datos.asunto, html: r.datos.html })
  }

  const conectar = async () => {
    setOcupado('conectar')
    const r = await conectarCorreoReserva(org.id, token)
    setOcupado('')
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido conectar')
    setEstado((e) => (e ? { ...e, conexion: r.datos!.conexion, ultimo_aviso: r.datos!.ultimo_aviso } : e))
    r.datos.conexion.conectado ? toast.success('Calendly ya avisa a la escuela') : toast.error('Calendly no ha dejado conectarlo')
  }

  if (error && !estado) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!estado)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )

  const { conexion, ultimo_aviso: ultimo } = estado
  return (
    <div className="max-w-3xl space-y-5">
      {/* El interruptor y Calendly */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-gray-900">Un mensaje de Rida, al reservar la llamada</p>
            <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
              Sale solo, al momento, a quien reserva su llamada en Calendly. <strong>Una vez por persona</strong>: no se repite si cambia la
              hora ni si cancela y vuelve a reservar. Si contesta, la respuesta llega a info@holandesnawar.com.
            </p>
          </div>
          <Interruptor activo={estado.activo} onClick={alternar} ocupado={ocupado === 'interruptor'} />
        </div>
        <p className={`mt-3 text-[13px] font-medium ${estado.activo ? 'text-[#15803D]' : 'text-[#6B7280]'}`}>
          {estado.activo ? 'Encendido' : 'Apagado: no sale nada'}
          {estado.cambiado_en ? (
            <span className="font-normal text-[#9CA3AF]">
              {' '}
              · cambiado el {new Date(estado.cambiado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {estado.por ? ` por ${estado.por}` : ''}
            </span>
          ) : null}
        </p>

        <div className="mt-4 border-t border-[#F3F4F6] pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-gray-800 inline-flex items-center gap-2 min-w-0">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${conexion.conectado ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
              {conexion.conectado ? 'Calendly avisa a la escuela de cada reserva' : 'Calendly no avisa a la escuela'}
            </p>
            <button onClick={conectar} disabled={!!ocupado} className={BOTON}>
              {ocupado === 'conectar' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{' '}
              {conexion.conectado ? 'Volver a conectar' : 'Conectar'}
            </button>
          </div>
          {!conexion.conectado && conexion.motivo ? (
            <p className="text-[12.5px] text-[#B91C1C] leading-relaxed">
              {conexion.motivo}
              {conexion.plan
                ? ' Calendly solo deja avisar con el plan Standard o superior. Si ya lo tienes, crea un token nuevo en Calendly (Integraciones → API y webhooks) y ponlo en LEARNHOUSE_CALENDLY_TOKEN en Railway.'
                : ''}
            </p>
          ) : null}
          <p className={META}>
            {ultimo
              ? ultimo.ok
                ? `Último aviso de Calendly: ${fecha(ultimo.at)}.`
                : `El ${fecha(ultimo.at)} llegó un aviso con la firma mal: pulsa «Volver a conectar».`
              : 'Todavía no ha llegado ningún aviso de Calendly.'}{' '}
            {estado.enviados
              ? `Le ha llegado a ${estado.enviados === 1 ? '1 persona' : `${estado.enviados} personas`}.`
              : 'Todavía no le ha llegado a nadie.'}
          </p>
        </div>
      </div>

      {/* El texto */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-4`}>
        <div>
          <p className="text-[15px] font-semibold text-gray-900">El correo</p>
          <p className={`${META} mt-0.5`}>Va con el logo de la escuela arriba y lo firma Rida: sin «El equipo de Nawar» al final.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-gray-800">Asunto</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={`${CAMPO} h-9`} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-gray-800">Texto</label>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={18} className={`${CAMPO} py-2.5 leading-relaxed resize-y`} />
          <p className={META}>
            Huecos: <code>{'{nombre}'}</code> (su nombre de pila), <code>{'{dia}'}</code> y <code>{'{hora}'}</code> (de su llamada, en su
            hora), <code>{'{enlace}'}</code> (el de la videollamada) y <code>{'{cambiar}'}</code> (para cambiar la hora). Una línea en blanco
            separa párrafos; <code>*así*</code> va en negrita.
          </p>
        </div>

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={guardar} disabled={!!ocupado || !cambiado} className={BOTON_PRINCIPAL}>
            {ocupado === 'guardar' ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
          </button>
          <button onClick={() => verVista(false)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'vista' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver cómo queda
          </button>
          <button onClick={() => verVista(true)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'prueba' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandármelo a mí
          </button>
          <button
            onClick={() => {
              setAsunto(estado.de_fabrica.asunto)
              setTexto(estado.de_fabrica.texto)
              setVista(null)
            }}
            disabled={!!ocupado}
            className="text-[12.5px] text-[#6B7280] hover:text-gray-900 px-1"
          >
            Volver al texto de fábrica
          </button>
        </div>
        {cambiado ? <p className="text-[12.5px] text-[#B45309]">Hay cambios sin guardar. «Ver cómo queda» y «Mandármelo a mí» ya usan este texto.</p> : null}

        {vista ? (
          <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
            <p className="px-3.5 py-2 border-b border-[#E5E7EB] text-[12.5px] text-[#6B7280] truncate">
              Asunto: <span className="text-gray-900">{vista.asunto}</span> <span className="text-[#9CA3AF]">· con una reserva de ejemplo</span>
            </p>
            <iframe title="Vista previa" srcDoc={vista.html} className="w-full h-[760px] bg-white" sandbox="" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
