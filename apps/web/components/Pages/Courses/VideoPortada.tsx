'use client'

/**
 * El vídeo de portada de un curso (27/10/2026, la de la Masterclass): siempre
 * en marcha, en bucle, sin sonido y sin botones, como una imagen que se mueve.
 * La caja toma la forma del propio vídeo en cuanto se sabe su tamaño, así que
 * no quedan franjas negras arriba y abajo, venga en 16:9 o en formato banner.
 *
 * El silencio se pone también a mano (`muted` del elemento): React no siempre
 * escribe el atributo, y sin él el navegador no deja arrancar solo.
 */

import React, { useEffect, useRef, useState } from 'react'

export default function VideoPortada({ src, children }: { src: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [aspecto, setAspecto] = useState('16 / 9')

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
      {children}
      <video
        ref={ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          if (v.videoWidth && v.videoHeight) setAspecto(`${v.videoWidth} / ${v.videoHeight}`)
        }}
      />
    </div>
  )
}
