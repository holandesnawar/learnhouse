'use client'

/**
 * WhatsApp ya escrito para una llamada (15/10/2026; dos mensajes desde el
 * 27/10): abre WhatsApp con el texto puesto, a su número. Pulsas enviar y
 * listo. No hay envío automático: eso pediría la API de WhatsApp Business (de
 * pago, con plantillas aprobadas por Meta), y se decidió que el seteo lo haga
 * el closer a mano, que contesta y llama si hace falta.
 *
 * - «Confirmar cita»: en cuanto reserva, con el enlace y «¿me confirmas?».
 *   Cuando dice que sí, se marca la cita como confirmada en Llamadas.
 * - «Recordatorio»: el mismo día.
 *
 * Firman con el nombre de quien lo manda (el de su cuenta). Cada texto se
 * cambia con su lápiz y se queda guardado en este navegador. Lógica del
 * mensaje, con test, en `lib/nawar/recordatorioLlamada.ts`.
 */

import React, { useState } from 'react'
import { MessageCircle, Pencil } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { enlaceWhatsApp, MENSAJES, mensajeRecordatorio, type TipoMensaje } from '@/lib/nawar/recordatorioLlamada'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'

// La del recordatorio es la clave de siempre: quien ya lo había cambiado, lo conserva.
const CLAVES: Record<TipoMensaje, string> = {
  recordatorio: 'nawar.recordatorio.llamada.plantilla',
  confirmar: 'nawar.recordatorio.llamada.plantilla.confirmar',
}
const ETIQUETA: Record<TipoMensaje, string> = { confirmar: 'Confirmar cita', recordatorio: 'Recordatorio' }

function deSerie(tipo: TipoMensaje): string {
  return MENSAJES.find((m) => m.id === tipo)?.plantilla || ''
}

function leer(tipo: TipoMensaje): string {
  try {
    return window.localStorage.getItem(CLAVES[tipo]) || deSerie(tipo)
  } catch {
    return deSerie(tipo)
  }
}

function guardar(tipo: TipoMensaje, texto: string) {
  try {
    if (texto.trim() && texto !== deSerie(tipo)) window.localStorage.setItem(CLAVES[tipo], texto)
    else window.localStorage.removeItem(CLAVES[tipo])
  } catch {
    /* sin almacenamiento: vale solo para esta vez */
  }
}

type Datos = { nombre: string; telefono: string; inicio: string; enlace?: string }

export default function RecordatorioWhatsApp({
  tipos = ['confirmar', 'recordatorio'],
  compacto = false,
  ...datos
}: Datos & { tipos?: TipoMensaje[]; compacto?: boolean }) {
  return (
    <>
      {tipos.map((tipo) => (
        <MensajeWhatsApp key={tipo} tipo={tipo} compacto={compacto} {...datos} />
      ))}
    </>
  )
}

function MensajeWhatsApp({ tipo, nombre, telefono, inicio, enlace, compacto }: Datos & { tipo: TipoMensaje; compacto: boolean }) {
  const session = useLHSession() as any
  const yo = session?.data?.user?.first_name || ''
  const [plantilla, setPlantilla] = useState(() => leer(tipo))
  const [editando, setEditando] = useState(false)
  const numero = numeroWhatsApp(telefono)
  const texto = mensajeRecordatorio(plantilla, { nombre, inicio, enlace, yo })

  return (
    <div className={editando ? 'w-full space-y-2' : 'inline-flex items-center gap-1'}>
      <div className="inline-flex items-center gap-1">
        <a
          href={enlaceWhatsApp(numero, texto)}
          target="_blank"
          rel="noreferrer"
          className={compacto ? 'text-[13px] font-medium text-[#025dc7] hover:underline inline-flex items-center gap-1' : BOTON}
          title={numero ? texto : 'No tenemos su número: WhatsApp te dejará elegir a quién mandarlo'}
        >
          <MessageCircle size={13} /> {compacto ? ETIQUETA[tipo] : `WhatsApp · ${ETIQUETA[tipo].toLowerCase()}`}
        </a>
        <button
          onClick={() => setEditando((v) => !v)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-[#F3F4F6]"
          aria-label={`Cambiar el mensaje «${ETIQUETA[tipo]}»`}
          title="Cambiar el mensaje"
        >
          <Pencil size={12} />
        </button>
      </div>
      {editando ? (
        <div className="w-full rounded-md border border-[#E5E7EB] p-2.5 space-y-2">
          <p className="text-[12.5px] font-medium text-gray-900">{ETIQUETA[tipo]}</p>
          <textarea
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-[#D1D5DB] px-2.5 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-900"
          />
          <p className={`${META} !whitespace-normal`}>
            Huecos: {'{nombre}'}, {'{yo}'} (tu nombre), {'{cuando}'} (de hoy, de mañana, del jueves 16 de octubre), {'{hora}'} y{' '}
            {'{enlace}'}. La línea del enlace desaparece si la llamada no tiene. Se guarda en este navegador.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                guardar(tipo, plantilla)
                setEditando(false)
              }}
              className={BOTON_PRINCIPAL}
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setPlantilla(deSerie(tipo))
                guardar(tipo, deSerie(tipo))
              }}
              className={BOTON}
            >
              El de serie
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
