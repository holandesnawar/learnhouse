'use client'

/**
 * El vídeo de portada de un curso (27/10/2026, la de la Masterclass): siempre
 * en marcha, en bucle, sin sonido y sin botones, como una imagen que se mueve.
 * La caja toma la forma del propio vídeo en cuanto se sabe su tamaño, así que
 * no quedan franjas negras arriba y abajo, venga en 16:9 o en formato banner.
 *
 * El silencio se pone también a mano (`muted` del elemento): React no siempre
 * escribe el atributo, y sin él el navegador no deja arrancar solo.
 *
 * «Demasiado a menudo se queda en blanco» (18/11/2026): mientras el vídeo
 * llega, la caja estaba vacía. Ahora:
 * - Se ve una IMAGEN desde el primer momento: la foto del curso si la tiene
 *   (`poster`) o, si no, el fotograma que este navegador guardó la vez
 *   anterior (`nawar.portada.<src>` en localStorage, una foto pequeña en JPEG
 *   sacada del propio vídeo). La primera visita de cada navegador sale con un
 *   brillo suave en vez del blanco; las siguientes, con la foto al instante.
 * - La caja ya tiene su forma: la proporción también se recuerda.
 * - El vídeo aparece encima con un fundido cuando de verdad tiene imagen.
 */

import React, { useEffect, useRef, useState } from 'react'

const CLAVE = (src: string) => `nawar.portada.${src.split('?')[0]}`

function leer(src: string): { foto?: string; aspecto?: string } {
  try {
    const t = localStorage.getItem(CLAVE(src))
    return t ? JSON.parse(t) : {}
  } catch {
    return {}
  }
}

function guardar(src: string, datos: { foto?: string; aspecto?: string }) {
  try {
    localStorage.setItem(CLAVE(src), JSON.stringify(datos))
  } catch {
    /* sin sitio o sin permiso: la próxima vez sale el brillo, nada más */
  }
}

/** Un fotograma del vídeo, pequeño, para enseñarlo la próxima vez antes de que llegue. */
function fotograma(v: HTMLVideoElement): string | undefined {
  try {
    const ancho = Math.min(960, v.videoWidth || 0)
    if (!ancho || !v.videoHeight) return undefined
    const alto = Math.round((v.videoHeight / v.videoWidth) * ancho)
    const c = document.createElement('canvas')
    c.width = ancho
    c.height = alto
    c.getContext('2d')?.drawImage(v, 0, 0, ancho, alto)
    const url = c.toDataURL('image/jpeg', 0.72)
    return url.length < 400_000 ? url : undefined
  } catch {
    return undefined
  }
}

export default function VideoPortada({ src, poster, children }: { src: string; poster?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [aspecto, setAspecto] = useState('16 / 9')
  const [foto, setFoto] = useState<string | undefined>(poster)
  const [listo, setListo] = useState(false)

  // Lo que este navegador recuerda de la vez anterior (después de montar:
  // localStorage no existe al pintar en el servidor).
  useEffect(() => {
    const g = leer(src)
    if (g.aspecto) setAspecto(g.aspecto)
    if (!poster && g.foto) setFoto(g.foto)
    setListo(false)
  }, [src, poster])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch(() => {
      /* sin permiso para arrancar solo (ahorro de batería…): se queda el primer fotograma */
    })
  }, [src])

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl ring-1 ring-inset ring-black/10 shadow-xl bg-[#F0F5FF]"
      style={{ aspectRatio: aspecto }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
      ) : !listo ? (
        <div aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#E8EEFB] via-[#F4F7FD] to-[#E3EAF9]" />
      ) : null}
      <video
        ref={ref}
        src={src}
        poster={foto}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${listo ? 'opacity-100' : 'opacity-0'}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          if (v.videoWidth && v.videoHeight) {
            const a = `${v.videoWidth} / ${v.videoHeight}`
            setAspecto(a)
            guardar(src, { ...leer(src), aspecto: a })
          }
        }}
        onLoadedData={(e) => {
          setListo(true)
          // El primer fotograma, para la próxima visita (solo si no hay foto del curso).
          if (!poster) {
            const f = fotograma(e.currentTarget)
            if (f) guardar(src, { ...leer(src), foto: f })
          }
        }}
        onPlaying={() => setListo(true)}
      />
      {children}
    </div>
  )
}
