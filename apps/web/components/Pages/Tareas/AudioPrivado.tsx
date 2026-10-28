'use client'

/**
 * Una nota de voz de una tarea (la del alumno o la de la corrección). No son
 * públicas: se piden con la sesión y se pintan desde una dirección local del
 * navegador (services/tareas/tareas.ts → `audioEntrega`).
 */

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { audioEntrega } from '@services/tareas/tareas'

export default function AudioPrivado({
  entregaId,
  cual,
  token,
  segundos,
}: {
  entregaId: number
  cual: 'alumno' | 'correccion'
  token: string
  segundos?: number
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!entregaId || !token) return
    let vivo = true
    let creada = ''
    audioEntrega(entregaId, cual, token)
      .then((u) => {
        creada = u
        if (vivo) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((e) => vivo && setError(e?.message || 'No se pudo cargar'))
    return () => {
      vivo = false
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [entregaId, cual, token])

  if (error) return <p className="text-[13px] text-[#9CA3AF]">{error}</p>
  if (!url)
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#9CA3AF] h-10">
        <Loader2 size={14} className="animate-spin" /> Cargando la nota de voz{segundos ? ` (${segundos} s)` : ''}…
      </div>
    )
  return <audio src={url} controls preload="metadata" className="w-full h-10" />
}
