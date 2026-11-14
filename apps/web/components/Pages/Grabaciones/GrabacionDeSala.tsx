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
import toast from 'react-hot-toast'
import { CheckCircle2, Link2, Loader2, Scissors, Video } from 'lucide-react'
import { ponerEnlaceGrabacion, type GrabacionSala } from '@services/grabaciones/grabaciones'
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
  semana: { id: number; tema: string; fecha: string; grabacion_sala?: GrabacionSala | null }
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
  const [pegando, setPegando] = useState(false)
  const [url, setUrl] = useState('')

  if (!yaFue) return null

  // La grabación como ENLACE pegado (14/11/2026): en la misma semana, sin crear
  // clases ni capítulos en el curso. Sale siempre, grabe la sala o no.
  const puesta = data?.semanas.find((s) => s.id === semana.id)?.grabacion_sala ?? semana.grabacion_sala ?? null
  const enlacePuesto = puesta?.enlace?.url ? puesta : null

  async function guardarEnlace() {
    if (!url.trim()) return
    setOcupado(true)
    try {
      await ponerEnlaceGrabacion(semana.id, { url: url.trim() }, token)
      toast.success('Grabación puesta: ya la ven los alumnos en su semana')
      setPegando(false)
      setUrl('')
      await recargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el enlace')
    } finally {
      setOcupado(false)
    }
  }

  const pegar = pegando ? (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardarEnlace()}
        placeholder="Pega aquí el enlace de Bunny, YouTube o Vimeo"
        className="min-w-0 flex-1 rounded-lg border border-[#DDE6F5] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#0b2da0]"
      />
      <button disabled={ocupado || !url.trim()} onClick={guardarEnlace} className="h-9 rounded-lg bg-[#0b2da0] px-3.5 text-[13px] font-semibold text-white disabled:opacity-40">
        {ocupado ? 'Guardando…' : 'Guardar'}
      </button>
      <button onClick={() => setPegando(false)} className="text-[13px] font-semibold text-[#6B7393]">
        Cancelar
      </button>
    </div>
  ) : null

  if (enlacePuesto)
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
        <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-[#0B1033]">
          <CheckCircle2 size={15} className="shrink-0 text-[#16A34A]" />
          Grabación puesta · enlace de {enlacePuesto.enlace!.tipo === 'bunny' ? 'Bunny' : enlacePuesto.enlace!.tipo === 'youtube' ? 'YouTube' : 'Vimeo'}
          {enlacePuesto.vistas ? <span className="text-[#6B7393]">· la han visto {enlacePuesto.vistas}</span> : null}
        </p>
        <div className="flex items-center gap-3.5">
          <a href={enlacePuesto.enlace!.original} target="_blank" rel="noreferrer" className={ENLACE}>
            Ver
          </a>
          <button disabled={ocupado} onClick={() => { setUrl(enlacePuesto.enlace!.original); setPegando(true) }} className={ENLACE}>
            Cambiar enlace
          </button>
          <button disabled={ocupado} onClick={() => con(() => quitar(semana))} className="text-[13px] font-semibold text-[#6B7393] hover:text-[#B4413C] disabled:opacity-40">
            Quitar
          </button>
        </div>
        {pegar}
      </div>
    )

  const botonPegar = (
    <button disabled={ocupado} onClick={() => setPegando(true)} className={`${ENLACE} inline-flex items-center gap-1`}>
      <Link2 size={13} /> Pegar enlace
    </button>
  )

  async function con(accion: () => Promise<unknown>) {
    setOcupado(true)
    try {
      await accion()
    } finally {
      setOcupado(false)
    }
  }

  if (isLoading)
    return (
      <p className={`flex items-center gap-2 text-[13px] text-[#8A91AD] ${className}`}>
        <Loader2 size={14} className="animate-spin" /> Mirando la grabación de la sala…
      </p>
    )
  if (!data)
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
        <p className="text-[13.5px] text-[#6B7393]">Grabación: aún no hay ninguna puesta.</p>
        {botonPegar}
        {pegar}
      </div>
    )

  const grabado =
    data.dias.find((d) => d.publicada?.semana_id === semana.id) || data.dias.find((d) => !d.publicada && d.semana?.id === semana.id) || null
  if (!grabado) {
    // Si la sala no grabó ese día, no se dice nada con la clave de Daily
    // puesta y sin fallos: la clase pudo ser por otro sitio.
    return (
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
        <p className="text-[13.5px] text-[#6B7393]">{data.aviso || 'La sala no grabó esta clase.'}</p>
        {botonPegar}
        {pegar}
      </div>
    )
  }

  const publicada = grabado.publicada?.semana_id === semana.id ? grabado.publicada : null
  const listas = grabado.partes.filter((p) => p.lista)
  const vistas = data.semanas.find((s) => s.id === semana.id)?.grabacion_sala?.vistas || 0

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
        {!publicada ? botonPegar : null}
      </div>
      {pegar}
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
