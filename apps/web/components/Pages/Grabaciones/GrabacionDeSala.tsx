'use client'

/**
 * La grabación de la sala de UNA semana, en pequeño, para el equipo
 * (10/11/2026): va en la tarjeta de la clase de la sala de profes y en la
 * semana de la página de la clase.
 *
 *   «La sala grabó 58 min»            [Recortar] [Publicar]
 *   «Grabación publicada · 54 min»    [Cambiar]  [Quitar]
 *
 * Antes del día de la clase no pinta nada. Usa los mismos datos que el
 * estudio entero (`useEstudio`): varias piezas en pantalla, una sola petición.
 */

import React, { useState } from 'react'
import { CheckCircle2, Loader2, Scissors, Video } from 'lucide-react'
import { duracionCorta } from '@/lib/nawar/recorte'
import EditorRecorte from './EditorRecorte'
import { useEstudio } from './useEstudio'

const ENLACE = 'text-[13px] font-semibold text-[#0b2da0] hover:underline disabled:opacity-40 disabled:no-underline'

export default function GrabacionDeSala({
  semana,
  courseUuid,
  hoy,
  className = '',
}: {
  semana: { id: number; tema: string; fecha: string }
  courseUuid: string
  /** AAAA-MM-DD. Sin él, el día de este navegador. */
  hoy?: string
  className?: string
}) {
  const dia = hoy || new Date().toLocaleDateString('sv-SE')
  const yaFue = !!semana.fecha && semana.fecha <= dia
  const { data, isLoading, token, recargar, publicarTalCual, quitar } = useEstudio(courseUuid, yaFue)
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  if (!yaFue) return null
  if (isLoading)
    return (
      <p className={`flex items-center gap-2 text-[13px] text-[#8A91AD] ${className}`}>
        <Loader2 size={14} className="animate-spin" /> Mirando la grabación de la sala…
      </p>
    )
  if (!data) return null

  const grabado =
    data.dias.find((d) => d.publicada?.semana_id === semana.id) || data.dias.find((d) => !d.publicada && d.semana?.id === semana.id) || null
  if (!grabado) {
    // Si la sala no grabó ese día, no se dice nada con la clave de Daily
    // puesta y sin fallos: la clase pudo ser por otro sitio.
    return data.aviso ? <p className={`text-[12.5px] text-[#8A6A2A] ${className}`}>{data.aviso}</p> : null
  }

  const publicada = grabado.publicada?.semana_id === semana.id ? grabado.publicada : null
  const listas = grabado.partes.filter((p) => p.lista)
  const vistas = data.semanas.find((s) => s.id === semana.id)?.grabacion_sala?.vistas || 0

  async function con(accion: () => Promise<unknown>) {
    setOcupado(true)
    try {
      await accion()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {publicada ? (
        <p className="flex items-center gap-1.5 text-[13.5px] text-[#0B1033]">
          <CheckCircle2 size={15} className="text-[#16A34A]" />
          Grabación publicada · {duracionCorta(publicada.segundos)}
          {vistas ? <span className="text-[#6B7393]">· la han visto {vistas}</span> : null}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[13.5px] text-[#0B1033]">
          <Video size={15} className="text-[#0b2da0]" />
          La sala grabó {duracionCorta(grabado.dur)}
          {!listas.length ? <span className="text-[#6B7393]">· aún se está procesando</span> : <span className="text-[#6B7393]">· sin publicar</span>}
        </p>
      )}
      <div className="flex items-center gap-3.5">
        <button disabled={!listas.length || ocupado} onClick={() => setEditando(true)} className={`${ENLACE} inline-flex items-center gap-1`}>
          <Scissors size={13} /> {publicada ? 'Cambiar' : 'Recortar'}
        </button>
        {publicada ? (
          <button disabled={ocupado} onClick={() => con(() => quitar(semana))} className="text-[13px] font-semibold text-[#6B7393] hover:text-[#B4413C] disabled:opacity-40">
            Quitar
          </button>
        ) : (
          <button disabled={!listas.length || ocupado} onClick={() => con(() => publicarTalCual(grabado, semana))} className={ENLACE}>
            Publicar
          </button>
        )}
      </div>
      {editando ? (
        <EditorRecorte
          courseUuid={courseUuid}
          dia={grabado}
          semanas={data.semanas}
          token={token}
          onClose={() => setEditando(false)}
          onPublicado={recargar}
        />
      ) : null}
    </div>
  )
}
