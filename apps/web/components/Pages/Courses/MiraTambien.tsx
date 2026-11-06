'use client'

/**
 * «Mira también» (06/11/2026): en el lateral de una clase en directo, las
 * grabaciones de la misma clase con el otro grupo (Groep rood ↔ Groep blauw:
 * dos cursos con el mismo nombre, cada uno cerrado a su grupo).
 *
 * Usuario: "que no se vea tan claro la otra grabación del otro grupo, que esté
 * igual en el lateral como: mira también esto". Por eso es una tarjeta
 * pequeña y en gris, y el vídeo se ve en una ventana de esta misma página: del
 * otro grupo no se abre nada más (ni su tarea, ni su sala). Lo da el servidor
 * (`mira_tambien` en apps/api/src/services/tareas/tareas.py) y se apaga por
 * clase en los ajustes de la sala.
 */

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlayCircle, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { diaCorto, getMiraTambien, urlVideoHermana, type MiraTambien as Datos, type VideoGrabacion } from '@services/tareas/tareas'

const A_LA_VISTA = 3

type Grabacion = Datos['clases'][number]['grabaciones'][number]

function Reproductor({ courseUuid, g, onClose }: { courseUuid: string; g: Grabacion; onClose: () => void }) {
  const v: VideoGrabacion = g.video
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-2 text-white">
          <p className="text-[14px] font-semibold truncate">
            {g.tema} <span className="font-normal text-white/70">· {diaCorto(g.fecha)}</span>
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingTop: '56.25%' }}>
          {v.tipo === 'archivo' ? (
            <video
              src={urlVideoHermana(courseUuid, g.activity_uuid)}
              controls
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <iframe
              src={v.url}
              title={g.tema}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function MiraTambien({ courseUuid }: { courseUuid: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [todas, setTodas] = useState(false)
  const [viendo, setViendo] = useState<{ curso: string; g: Grabacion } | null>(null)
  const { data } = useQuery({
    queryKey: ['tareas', 'mira-tambien', String(courseUuid || '').replace(/^course_/, '')],
    queryFn: () => getMiraTambien(courseUuid, token),
    enabled: !!courseUuid && !!token,
    staleTime: 60_000,
    retry: 1,
  })
  const clases = (data?.clases || []).filter((c) => c.grabaciones.length)
  if (!clases.length) return null

  return (
    <div className="mb-5">
      {clases.map((c) => {
        const lista = todas ? c.grabaciones : c.grabaciones.slice(0, A_LA_VISTA)
        const quien = [c.dia ? `la clase del ${c.dia}` : 'la otra clase', c.profe ? `con ${c.profe}` : ''].filter(Boolean).join(', ')
        return (
          <div key={c.course_uuid} className="rounded-xl border border-[#E2E8F4] bg-white px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Mira también</p>
            <p className="mt-1 text-[13px] text-[#3F4A61] leading-snug">
              El mismo tema, en {quien}. Por si quieres repasarlo otra vez.
            </p>
            <div className="mt-2.5 space-y-0.5">
              {lista.map((g) => (
                <button
                  key={g.activity_uuid}
                  onClick={() => setViendo({ curso: c.course_uuid, g })}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-[#F4F7FD]"
                >
                  <PlayCircle size={16} className="shrink-0 text-[#025dc7]" />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-gray-900">{g.tema}</span>
                  <span className="shrink-0 text-[11.5px] text-[#6B7280]">{diaCorto(g.fecha).replace(/^\w+\s/, '')}</span>
                </button>
              ))}
            </div>
            {c.grabaciones.length > A_LA_VISTA ? (
              <button onClick={() => setTodas((v) => !v)} className="mt-1.5 text-[12px] font-semibold text-[#025dc7] hover:underline">
                {todas ? 'Ver menos' : `Ver más (${c.grabaciones.length})`}
              </button>
            ) : null}
          </div>
        )
      })}
      {viendo ? <Reproductor courseUuid={courseUuid} g={viendo.g} onClose={() => setViendo(null)} /> : null}
    </div>
  )
}
