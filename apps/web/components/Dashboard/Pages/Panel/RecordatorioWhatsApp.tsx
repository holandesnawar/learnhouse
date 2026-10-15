'use client'

/**
 * «Recordar por WhatsApp» (15/10/2026): abre WhatsApp con el recordatorio de
 * la llamada ya escrito, a su número. Pulsas enviar y listo. No hay envío
 * automático: eso pediría la API de WhatsApp Business (de pago, con plantillas
 * aprobadas por Meta).
 *
 * El texto se cambia con el lápiz y se queda guardado en este navegador: cada
 * persona del equipo firma con su nombre («soy Rida», «soy Zulay»…). Lógica
 * del mensaje, con test, en `lib/nawar/recordatorioLlamada.ts`.
 */

import React, { useState } from 'react'
import { MessageCircle, Pencil } from 'lucide-react'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { enlaceWhatsApp, mensajeRecordatorio, PLANTILLA_RECORDATORIO } from '@/lib/nawar/recordatorioLlamada'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'

const CLAVE = 'nawar.recordatorio.llamada.plantilla'

function leer(): string {
  try {
    return window.localStorage.getItem(CLAVE) || PLANTILLA_RECORDATORIO
  } catch {
    return PLANTILLA_RECORDATORIO
  }
}

function guardar(texto: string) {
  try {
    if (texto.trim() && texto !== PLANTILLA_RECORDATORIO) window.localStorage.setItem(CLAVE, texto)
    else window.localStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento: vale solo para esta vez */
  }
}

export default function RecordatorioWhatsApp({
  nombre,
  telefono,
  inicio,
  enlace,
  compacto = false,
}: {
  nombre: string
  telefono: string
  inicio: string
  enlace?: string
  compacto?: boolean
}) {
  const [plantilla, setPlantilla] = useState(leer)
  const [editando, setEditando] = useState(false)
  const numero = numeroWhatsApp(telefono)
  const texto = mensajeRecordatorio(plantilla, { nombre, inicio, enlace })

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
          <MessageCircle size={13} /> Recordar por WhatsApp
        </a>
        <button
          onClick={() => setEditando((v) => !v)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-[#F3F4F6]"
          aria-label="Cambiar el mensaje"
          title="Cambiar el mensaje"
        >
          <Pencil size={12} />
        </button>
      </div>
      {editando ? (
        <div className="w-full rounded-md border border-[#E5E7EB] p-2.5 space-y-2">
          <textarea
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-[#D1D5DB] px-2.5 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-900"
          />
          <p className={`${META} !whitespace-normal`}>
            Huecos: {'{nombre}'}, {'{cuando}'} (de hoy, de mañana, del jueves 16 de octubre), {'{hora}'} y {'{enlace}'}. La línea del
            enlace desaparece si la llamada no tiene. Se guarda en este navegador.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                guardar(plantilla)
                setEditando(false)
              }}
              className={BOTON_PRINCIPAL}
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setPlantilla(PLANTILLA_RECORDATORIO)
                guardar(PLANTILLA_RECORDATORIO)
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
