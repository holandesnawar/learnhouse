'use client'
/**
 * El vídeo de bienvenida (24/11/2026). Servidor:
 * apps/api/src/services/student_progress/bienvenida.py (cabecera: léela).
 *
 * - `VideoBienvenidaInicio`: tarjeta fija ARRIBA del Inicio, solo para los
 *   alumnos que entraron desde el día del vídeo y aún no lo han visto. Sin
 *   ventana nueva a propósito: quien entra ya ve la visita guiada y la de
 *   «Tu plan». El vídeo se ve ahí mismo y la tarjeta se va con «Ya lo he visto».
 * - `VentanaVideoBienvenida`: el mismo vídeo en una ventana, para el paso 1 de
 *   «Empieza aquí» (lo ve cualquiera, también quien ya estaba).
 */
import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { getBienvenida, marcarBienvenidaVista, type Bienvenida } from '@services/student/bienvenida'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
export const CLAVE_BIENVENIDA = ['student', 'bienvenida']

export function useBienvenida() {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const q = useQuery<Bienvenida>({
    queryKey: CLAVE_BIENVENIDA,
    queryFn: () => getBienvenida(token),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
  return { ...q, token }
}

function useMarcarVisto() {
  const { token } = useBienvenida()
  const qc = useQueryClient()
  const [guardando, setGuardando] = useState(false)
  const marcar = async () => {
    setGuardando(true)
    // Se quita de la pantalla al momento; si el servidor falla, vuelve a salir
    // la próxima vez (mejor eso que dejar el botón sin hacer nada).
    qc.setQueryData<Bienvenida>(CLAVE_BIENVENIDA, (d) => (d ? { ...d, toca: false, visto: true } : d))
    await marcarBienvenidaVista(token)
    setGuardando(false)
  }
  return { marcar, guardando }
}

function Reproductor({ url, titulo }: { url: string; titulo: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-[#0B1033]" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={url}
        title={titulo || 'Vídeo de bienvenida'}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  )
}

export function VideoBienvenidaInicio() {
  const { data } = useBienvenida()
  const { marcar, guardando } = useMarcarVisto()
  if (!data?.toca || !data.url) return null
  return (
    <section className="rounded-2xl border border-[#C9D4EC] bg-white p-4 sm:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Empieza por aquí</p>
      <h2 className="mt-1 text-[20px] sm:text-[22px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
        {data.titulo || 'Tu bienvenida a la escuela'}
      </h2>
      <p className="mt-1 text-[14.5px] text-[#4A5272] leading-relaxed">
        Antes de nada, mira este vídeo: te contamos cómo funciona la escuela y por dónde empezar.
      </p>
      <div className="mt-4">
        <Reproductor url={data.url} titulo={data.titulo} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={marcar}
          disabled={guardando}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690] disabled:opacity-70"
        >
          <Check size={16} strokeWidth={2.6} /> Ya lo he visto
        </button>
        <span className="text-[13px] text-[#6B7393]">Lo tienes siempre en «Empieza aquí» y en la introducción de la formación.</span>
      </div>
    </section>
  )
}

export function VentanaVideoBienvenida({ onCerrar }: { onCerrar: () => void }) {
  const { data } = useBienvenida()
  const { marcar } = useMarcarVisto()
  return (
    <EnElCuerpo>
      <div className="fixed inset-0 z-[998] bg-[#0B1033]/60 flex items-center justify-center p-3 sm:p-6" onClick={onCerrar}>
        <div role="dialog" aria-label="Vídeo de bienvenida" className="w-full max-w-[920px] rounded-2xl bg-white p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-[18px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
              {data?.titulo || 'Tu bienvenida a la escuela'}
            </h2>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>
          {data?.url ? (
            <Reproductor url={data.url} titulo={data.titulo} />
          ) : (
            <p className="text-[14px] text-[#4A5272]">El vídeo no se ha podido cargar ahora mismo. Inténtalo en un momento.</p>
          )}
          {data?.url && !data.visto ? (
            <button
              type="button"
              onClick={async () => {
                await marcar()
                onCerrar()
              }}
              className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690]"
            >
              <Check size={16} strokeWidth={2.6} /> Ya lo he visto
            </button>
          ) : null}
        </div>
      </div>
    </EnElCuerpo>
  )
}
