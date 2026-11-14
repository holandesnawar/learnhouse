'use client'

/**
 * La grabación de la sala en la lista de una semana pasada («Clases
 * anteriores» de la página de la clase), para el alumno: misma pinta que las
 * demás filas de `SemanasClase`, pero abre el vídeo en esta misma página.
 */

import React, { useState } from 'react'
import { Check, ChevronRight, Video } from 'lucide-react'
import { duracionCorta } from '@/lib/nawar/recorte'
import type { GrabacionSala } from '@services/grabaciones/grabaciones'
import VentanaGrabacionSala from './VentanaGrabacionSala'

export default function FilaGrabacionAlumno({
  courseUuid,
  semana,
  grabacion,
}: {
  courseUuid: string
  semana: { id: number; tema: string; fecha: string }
  grabacion: GrabacionSala
}) {
  const [viendo, setViendo] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setViendo(true)} className="block w-full text-left hover:bg-[#F8FAFF] transition-colors">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 flex items-center justify-center shrink-0">
            <Video size={22} strokeWidth={1.6} className="text-[#0b2da0]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-gray-900 truncate">{grabacion.titulo || 'Grabación'}</p>
            <p className="text-[12.5px] text-[#6B7280] leading-snug">La clase grabada{grabacion.segundos ? ` · ${duracionCorta(grabacion.segundos)}` : ''}</p>
          </div>
          {grabacion.vista ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#15803D]">
              <Check size={14} strokeWidth={3} /> Vista
            </span>
          ) : null}
          <ChevronRight size={15} className="shrink-0 text-[#B9C6DC]" />
        </div>
      </button>
      {viendo ? <VentanaGrabacionSala courseUuid={courseUuid} semana={semana} grabacion={grabacion} onClose={() => setViendo(false)} /> : null}
    </>
  )
}
