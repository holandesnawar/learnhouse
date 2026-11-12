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

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlayCircle, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import ReproductorRecortado from '@components/Pages/Grabaciones/ReproductorRecortado'
import { diaCorto, getMiraTambien, urlVideoHermana, type MiraTambien as Datos, type VideoGrabacion } from '@services/tareas/tareas'

const A_LA_VISTA = 3

export type Grabacion = Datos['clases'][number]['grabaciones'][number]
export type ClaseHermana = Datos['clases'][number]

/** Las grabaciones de las clases hermanas, para quien está en esta clase. */
export function useMiraTambien(courseUuid: string, activo = true) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  return useQuery({
    queryKey: ['tareas', 'mira-tambien', String(courseUuid || '').replace(/^course_/, '')],
    queryFn: () => getMiraTambien(courseUuid, token),
    enabled: !!courseUuid && !!token && activo,
    staleTime: 60_000,
    retry: 1,
  })
}

const DIA_MS = 86_400_000
const aDia = (f: string) => Date.parse(`${(f || '').slice(0, 10)}T12:00:00Z`)

/**
 * La grabación del otro grupo de ESA semana (09/11/2026): la de la clase
 * hermana que cae a 6 días o menos de la nuestra. Rood y blauw dan el mismo
 * tema la misma semana, en días distintos.
 */
export function deLaMismaSemana(clases: ClaseHermana[] | undefined, fecha: string) {
  const f = aDia(fecha)
  if (!clases || Number.isNaN(f)) return []
  const out: { clase: ClaseHermana; g: Grabacion }[] = []
  for (const clase of clases) {
    let mejor: Grabacion | null = null
    for (const g of clase.grabaciones) {
      const d = Math.abs(aDia(g.fecha) - f)
      if (Number.isNaN(d) || d > 6 * DIA_MS) continue
      if (!mejor || d < Math.abs(aDia(mejor.fecha) - f)) mejor = g
    }
    if (mejor) out.push({ clase, g: mejor })
  }
  return out
}

export const claveDe = (g: Grabacion) => g.clave || g.activity_uuid

/** La semana del otro grupo que aún no tiene grabación (solo llega al equipo). */
export function pendienteDeLaSemana(clases: ClaseHermana[] | undefined, fecha: string) {
  const f = aDia(fecha)
  if (!clases || Number.isNaN(f)) return null
  for (const clase of clases) {
    const p = (clase.pendientes || []).find((x) => Math.abs(aDia(x.fecha) - f) <= 6 * DIA_MS)
    if (p) return { clase, p }
  }
  return null
}

function ReproductorDentro({ courseUuid, g, onClose }: { courseUuid: string; g: Grabacion; onClose: () => void }) {
  const v: VideoGrabacion = g.video
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onClose])
  if (v.tipo === 'sala' && g.sala) {
    // Lo que grabó la sala de la escuela con el otro grupo (12/11/2026): el
    // mismo reproductor que la grabación propia, con su recorte.
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-2 sm:p-6" onClick={onClose}>
        <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between gap-3 text-white">
            <p className="truncate text-[14px] font-semibold">
              {g.tema} <span className="font-normal text-white/70">· la clase del otro grupo · {diaCorto(g.fecha)}</span>
            </p>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          <ReproductorRecortado courseUuid={courseUuid} partes={g.sala.partes} clave={`otro-${claveDe(g)}`} otroGrupo />
        </div>
      </div>
    )
  }
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

/** A toda la ventana, por encima de la barra de la escuela (ver `EnElCuerpo`). */
export function Reproductor(props: { courseUuid: string; g: Grabacion; onClose: () => void }) {
  return (
    <EnElCuerpo>
      <ReproductorDentro {...props} />
    </EnElCuerpo>
  )
}

export default function MiraTambien({ courseUuid }: { courseUuid: string }) {
  const [todas, setTodas] = useState(false)
  const [viendo, setViendo] = useState<{ curso: string; g: Grabacion } | null>(null)
  const { data } = useMiraTambien(courseUuid)
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
                  key={claveDe(g)}
                  onClick={() => setViendo({ curso: c.course_uuid, g })}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-[#F4F7FD]"
                >
                  <PlayCircle size={16} className="shrink-0 text-[#0b2da0]" />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-gray-900">{g.tema}</span>
                  <span className="shrink-0 text-[11.5px] text-[#6B7280]">{diaCorto(g.fecha).replace(/^\w+\s/, '')}</span>
                </button>
              ))}
            </div>
            {c.grabaciones.length > A_LA_VISTA ? (
              <button onClick={() => setTodas((v) => !v)} className="mt-1.5 text-[12px] font-semibold text-[#0b2da0] hover:underline">
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
