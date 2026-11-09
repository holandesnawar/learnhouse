'use client'
/**
 * Juntar dos publicaciones de la misma persona (09/11/2026, segunda vuelta).
 *
 * Pedido: "no quedó bien… no sé cuál iba en título y cuál de subtítulo… mejor
 * elegir un post y otro y poder juntar dos". En el tablón, el administrador
 * pulsa «Juntar dos», marca las dos y aquí VE el resultado antes de juntar:
 * cuál va arriba (con «Cambiar el orden»), el título (escrito o el de una de
 * las dos) y cómo queda. El servidor: `services/communities/juntar_posts.py`.
 */
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { ArrowUpDown, X } from 'lucide-react'
import { juntarPublicaciones, type DiscussionWithAuthor } from '@services/communities/discussions'

export type Pieza = { d: DiscussionWithAuthor; texto: string; fotos: number }

export default function JuntarPublicaciones({
  dos,
  autor,
  token,
  onCerrar,
  onHecho,
}: {
  dos: [Pieza, Pieza]
  autor: string
  token: string
  onCerrar: () => void
  onHecho: () => void
}) {
  // De serie, arriba la más antigua (lo normal: «Hoi» y luego el resto).
  const [orden, setOrden] = useState<[Pieza, Pieza]>(() =>
    (dos[0].d.creation_date || '') <= (dos[1].d.creation_date || '') ? dos : [dos[1], dos[0]]
  )
  const [titulo, setTitulo] = useState(() => {
    // De serie, el título más largo de los dos (el «Hoi» casi nunca vale).
    const [a, b] = dos
    return (a.d.title || '').length >= (b.d.title || '').length ? a.d.title : b.d.title
  })
  const [juntando, setJuntando] = useState(false)
  const [arriba, abajo] = orden

  const juntar = async () => {
    setJuntando(true)
    try {
      await juntarPublicaciones(arriba.d.discussion_uuid, abajo.d.discussion_uuid, titulo, token)
      toast.success('Publicaciones juntadas')
      onHecho()
    } catch (e: any) {
      toast.error(e?.message || 'No se han podido juntar')
      setJuntando(false)
    }
  }

  const Bloque = ({ p, n }: { p: Pieza; n: 1 | 2 }) => (
    <div className="rounded-xl border border-[#E4E8F2] bg-white px-4 py-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">
        {n === 1 ? 'Arriba' : 'Debajo'} · «{p.d.title}»
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-[#2B3150] whitespace-pre-wrap line-clamp-6">
        {p.texto || <span className="text-[#8A91AD]">(sin texto)</span>}
      </p>
      {p.fotos ? <p className="mt-1 text-[12.5px] text-[#6B7393]">{p.fotos === 1 ? '1 foto o audio' : `${p.fotos} fotos o audios`}</p> : null}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-[#0a1656]/40 p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="w-full sm:max-w-[560px] max-h-[92dvh] overflow-y-auto bg-[#F7F9FD] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">{autor}</p>
            <h2 className="text-[19px] font-bold text-[#0B1033]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
              Juntar en una publicación
            </h2>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
            <X size={20} />
          </button>
        </div>

        <label className="block mt-4">
          <span className="text-[13px] font-semibold text-[#3B4262]">Título de la publicación</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[15px] text-[#0B1033] outline-none focus:border-[#0b2da0]"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12.5px]">
          <span className="text-[#6B7393] self-center">Usar el de:</span>
          {[arriba, abajo].map((p) => (
            <button
              key={p.d.discussion_uuid}
              onClick={() => setTitulo(p.d.title)}
              className={`max-w-[230px] truncate h-7 px-2.5 rounded-full border ${
                titulo === p.d.title ? 'border-[#0b2da0] bg-[#0b2da0] text-white' : 'border-[#DDE3EF] bg-white text-[#3B4262]'
              }`}
            >
              {p.d.title}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#3B4262]">Así queda el texto</p>
          <button
            onClick={() => setOrden([abajo, arriba])}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDE3EF] bg-white text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]"
          >
            <ArrowUpDown size={14} /> Cambiar el orden
          </button>
        </div>
        <div className="mt-2 space-y-2">
          <Bloque p={arriba} n={1} />
          <Bloque p={abajo} n={2} />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B7393]">
          Se queda una sola publicación con los comentarios de las dos. Los «me gusta» de la de abajo se pierden. No se puede deshacer.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] bg-white text-[14px] font-semibold text-[#3B4262]">
            Cancelar
          </button>
          <button
            onClick={juntar}
            disabled={juntando || titulo.trim().length < 2}
            className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-60"
          >
            {juntando ? 'Juntando…' : 'Juntar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
