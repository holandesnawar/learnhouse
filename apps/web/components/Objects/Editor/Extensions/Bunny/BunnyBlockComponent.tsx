'use client'

import React from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { AlertTriangle, Clapperboard, RefreshCcw } from 'lucide-react'

// Accepts anything Bunny's "Embed" panel gives you — the player URL, the
// iframe.mediadelivery.net URL, or the whole <iframe> code — and pulls out the
// library id + video id to build the canonical embed src. Returns null if it
// can't find a Bunny embed in the pasted text.
// Parámetros del reproductor de Bunny.
//
// `responsive=true` es el que importa y viene en el código de inserción que da
// el propio Bunny. Sin él, el reproductor se dibuja al tamaño que calculó al
// arrancar y no vuelve a ajustarse al marco: se ve **encogido y centrado**
// dentro del rectángulo negro durante los primeros segundos, hasta que algo lo
// obliga a recalcular. Como nosotros reconstruimos la dirección desde cero,
// estábamos tirando ese parámetro aunque se pegara el embed oficial entero.
//
// `preload=true` deja lista la primera parte del vídeo antes de darle al play.
const BUNNY_PARAMS = 'responsive=true&preload=true'

/**
 * El alto de la caja del vídeo, en % del ancho: 16:9 exactos.
 *
 * Estuvo un rato en 54 intentando tapar la franja negra de abajo, con el
 * diagnóstico equivocado. La franja no la causaba la caja: la causaba que a
 * la dirección del embed le faltaba `responsive=true`. Recortar la caja solo
 * habría recortado el vídeo.
 */
const ALTO_CAJA = 56.25

function parseBunnySrc(input: string): string | null {
  if (!input) return null
  const s = input.trim()
  // .../embed/{libraryId}/{videoGuid}  (player. or iframe. host, with/without query)
  const m = s.match(/mediadelivery\.net\/embed\/(\d+)\/([0-9a-fA-F-]{8,})/)
  if (m) {
    return `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?${BUNNY_PARAMS}`
  }
  return null
}

// Los vídeos que ya están puestos se guardaron sin parámetros, y volver a
// pegarlos uno a uno no es plan. Así que la dirección se completa también al
// pintar: lo guardado en la lección no se toca y aun así todos se ven bien.
function conParametros(src: string): string {
  if (!src) return src
  if (/[?&]responsive=/.test(src)) return src
  return src + (src.includes('?') ? '&' : '?') + BUNNY_PARAMS
}

export default function BunnyBlockComponent(props: any) {
  const src: string | null = props.node?.attrs?.src || null
  const editable: boolean = props.editor?.isEditable ?? true

  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState('')

  function insert() {
    const parsed = parseBunnySrc(value)
    if (!parsed) {
      setError(
        'No reconozco el vídeo. Pega el enlace del reproductor de Bunny o el código <iframe> (debe contener iframe.mediadelivery.net/embed/...).',
      )
      return
    }
    setError('')
    props.updateAttributes({ src: parsed })
  }

  // ── Rendered video (both edit + student view) ──
  if (src) {
    return (
      <NodeViewWrapper className="block-bunny w-full my-3">
        <div
          style={{ position: 'relative', paddingTop: `${ALTO_CAJA}%` }}
          className="rounded-xl overflow-hidden bg-black"
        >
          <iframe
            src={conParametros(src)}
            loading="lazy"
            style={{
              border: 0,
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '100%',
            }}
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
            allowFullScreen
          />
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              props.updateAttributes({ src: null })
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500 hover:text-[#1D0084] transition-colors"
          >
            <RefreshCcw size={13} strokeWidth={2.5} />
            Cambiar vídeo
          </button>
        )}
      </NodeViewWrapper>
    )
  }

  // Empty + student view → render nothing.
  if (!editable) {
    return <NodeViewWrapper className="block-bunny" />
  }

  // ── Empty + editor view → paste box ──
  return (
    <NodeViewWrapper className="block-bunny w-full my-3">
      <div className="bg-neutral-50 rounded-xl px-5 py-4 nice-shadow border border-[#DDE6F5]">
        <div className="flex items-center gap-2 mb-3 text-neutral-500">
          <Clapperboard size={16} />
          <span className="uppercase tracking-widest text-xs font-bold">Vídeo Bunny</span>
        </div>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
          placeholder="Pega aquí el enlace del reproductor de Bunny o el código <iframe>…"
          className="w-full rounded-lg border border-[#DDE6F5] bg-white p-3 text-sm text-[#1D0084] outline-none focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors min-h-[84px]"
        />
        {error && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
        )}
        <button
          type="button"
          onClick={insert}
          disabled={!value.trim()}
          className="mt-2.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] disabled:opacity-50 disabled:cursor-not-allowed text-[#0a1656] text-sm font-bold transition-colors"
        >
          Insertar vídeo
        </button>
        <p className="mt-2 text-[11px] text-neutral-400 leading-relaxed">
          En Bunny → tu vídeo → pestaña <strong>Embed</strong> → copia el enlace o el
          código y pégalo aquí. Sin anuncios ni marca de agua.
        </p>
      </div>
    </NodeViewWrapper>
  )
}
