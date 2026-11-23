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
 *
 * «A Belén no le carga ningún vídeo de portada, ni con recarga forzada ni
 * cerrando sesión» (23/11/2026). Si un navegador NO PUEDE enseñar el vídeo
 * (no reproduce ese formato, el modo de ahorro de energía no deja arrancar
 * vídeos solos y entonces tampoco los descarga, o el archivo no llega), la caja
 * se quedaba para siempre con el brillo: un rectángulo en blanco. Ahora:
 * - Si el vídeo da error, o a los 8 s aún no tiene imagen: se queda la foto
 *   del curso si la hay y, si no, la caja DESAPARECE (mejor nada que un hueco).
 * - Si el navegador no deja arrancar solo, se intenta cargar el primer
 *   fotograma igualmente y un toque en la caja lo pone en marcha.
 * - El navegador avisa a Panel → Estado de la escuela con el motivo (código
 *   de error del vídeo, formato del archivo, si es el ahorro de energía): así
 *   se ve si le pasa a más gente y a cuánta.
 */

import React, { useEffect, useRef, useState } from 'react'
import { avisarPantallaRota } from '@/lib/nawar/avisarFallo'

const CLAVE = (src: string) => `nawar.portada.${src.split('?')[0]}`
/** Lo que se espera a que el vídeo tenga imagen antes de darlo por perdido. */
const ESPERA_MS = 8000

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

const ERRORES: Record<number, string> = {
  1: 'cancelado',
  2: 'fallo de red',
  3: 'no se pudo descodificar',
  4: 'formato no compatible con este navegador',
}

/** El formato del archivo, por su extensión (mp4, mov, webm…). Nunca el nombre. */
function formatoDe(src: string): string {
  const m = /\.([a-z0-9]{2,5})(?:$|\?)/i.exec(src.split('#')[0])
  return m ? m[1].toLowerCase() : '?'
}

export default function VideoPortada({ src, poster, children }: { src: string; poster?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [aspecto, setAspecto] = useState('16 / 9')
  const [foto, setFoto] = useState<string | undefined>(poster)
  const [listo, setListo] = useState(false)
  // El vídeo no se puede enseñar en este navegador (error o no llegó a tiempo).
  const [perdido, setPerdido] = useState(false)
  // El navegador no deja arrancar solo: un toque lo pone en marcha.
  const [parado, setParado] = useState(false)
  const avisado = useRef(false)

  const avisar = (motivo: string) => {
    if (avisado.current) return
    avisado.current = true
    const v = ref.current
    const estado = v ? ` (readyState ${v.readyState}, networkState ${v.networkState})` : ''
    avisarPantallaRota(new Error(`Vídeo de portada sin imagen: ${motivo} · formato ${formatoDe(src)}${estado}`), 'trozo', 'VideoPortada')
  }

  // Lo que este navegador recuerda de la vez anterior (después de montar:
  // localStorage no existe al pintar en el servidor).
  useEffect(() => {
    const g = leer(src)
    if (g.aspecto) setAspecto(g.aspecto)
    if (!poster && g.foto) setFoto(g.foto)
    setListo(false)
    setPerdido(false)
    setParado(false)
    avisado.current = false
  }, [src, poster])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch((e: unknown) => {
      // Sin permiso para arrancar solo (ahorro de energía, ajuste del
      // navegador): algunos navegadores entonces ni siquiera descargan el
      // vídeo. Se le pide que cargue para tener al menos el primer fotograma,
      // y un toque en la caja lo arranca.
      if ((e as { name?: string })?.name === 'NotAllowedError') {
        setParado(true)
        try {
          v.load()
        } catch {
          /* nada */
        }
      }
    })
  }, [src])

  // Si a los 8 s no hay imagen, se da por perdido en este navegador.
  useEffect(() => {
    if (listo || perdido) return
    const t = window.setTimeout(() => {
      const v = ref.current
      if (v && v.readyState >= 2) {
        setListo(true)
        return
      }
      setPerdido(true)
      avisar(parado ? 'el navegador no deja arrancarlo solo (ahorro de energía)' : `no llegó en ${ESPERA_MS / 1000} s`)
    }, ESPERA_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, listo, perdido, parado])

  const arrancar = () => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play()
      .then(() => {
        setParado(false)
        setPerdido(false)
      })
      .catch(() => {})
  }

  // Sin imagen que enseñar: mejor nada que un rectángulo en blanco.
  if (perdido && !listo && !foto) return null

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ring-1 ring-inset ring-black/10 shadow-xl bg-[#F0F5FF] ${parado ? 'cursor-pointer' : ''}`}
      style={{ aspectRatio: aspecto }}
      onClick={parado ? arrancar : undefined}
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
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${listo && !perdido ? 'opacity-100' : 'opacity-0'}`}
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
          setPerdido(false)
          // El primer fotograma, para la próxima visita (solo si no hay foto del curso).
          if (!poster) {
            const f = fotograma(e.currentTarget)
            if (f) guardar(src, { ...leer(src), foto: f })
          }
        }}
        onPlaying={() => {
          setListo(true)
          setPerdido(false)
          setParado(false)
        }}
        onError={(e) => {
          const code = e.currentTarget.error?.code || 0
          setPerdido(true)
          avisar(ERRORES[code] || `error ${code}`)
        }}
      />
      {children}
    </div>
  )
}
