'use client'

/**
 * La grabación de la sala de una semana, en una ventana de la misma página
 * (10/11/2026): lo que abre el alumno desde «Mira la grabación». Cuando pasa
 * de la mitad cuenta como vista (lo apunta la escuela y sale en el
 * Seguimiento semanal).
 */

import React, { useEffect } from 'react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { diaCorto } from '@services/tareas/tareas'
import { marcarVista, type GrabacionSala } from '@services/grabaciones/grabaciones'
import ReproductorRecortado from './ReproductorRecortado'

function VentanaGrabacionSalaDentro({
  courseUuid,
  semana,
  grabacion,
  onClose,
}: {
  courseUuid: string
  semana: { id: number; tema: string; fecha: string }
  grabacion: GrabacionSala
  onClose: () => void
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const cola = useQueryClient()

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onClose])

  function vista() {
    if (!token || grabacion.vista) return
    // En blando: si no se puede apuntar (p. ej. mirando «como un alumno»), el vídeo sigue.
    marcarVista(semana.id, token)
      .then((r) => (r?.vista ? cola.invalidateQueries({ queryKey: ['tareas'] }) : undefined))
      .catch(() => undefined)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-2 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3 text-white">
          <p className="truncate text-[14px] font-semibold">
            {grabacion.titulo || semana.tema || 'La clase grabada'}
            {semana.fecha ? <span className="font-normal text-white/70"> · {diaCorto(semana.fecha)}</span> : null}
          </p>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <ReproductorRecortado courseUuid={courseUuid} partes={grabacion.partes} clave={`semana-${semana.id}`} onMitad={vista} />
      </div>
    </div>
  )
}

/** A toda la ventana, por encima de la barra de la escuela (ver `EnElCuerpo`). */
export default function VentanaGrabacionSala(props: React.ComponentProps<typeof VentanaGrabacionSalaDentro>) {
  return (
    <EnElCuerpo>
      <VentanaGrabacionSalaDentro {...props} />
    </EnElCuerpo>
  )
}
