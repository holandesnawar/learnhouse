'use client'

/**
 * El reproductor de una grabación de la sala, tal como la ve el ALUMNO
 * (10/11/2026). La grabación está entera en Daily; aquí se enseñan solo los
 * trozos publicados: el vídeo se salta lo cortado y la barra mide únicamente
 * lo que se ve, así que el recorte no se nota. Si la sala cortó y volvió a
 * grabar, las partes van seguidas en una sola línea de tiempo.
 *
 * Sin los botones del navegador a propósito: con ellos la barra enseñaría la
 * grabación entera y se podría ir a lo cortado. En el iPhone, la pantalla
 * completa es la del propio vídeo (no hay otra): ahí la barra es la del
 * teléfono, pero los cortes se siguen saltando.
 *
 * El vídeo se pide a la escuela (`urlVideoSala`), que redirige a un enlace de
 * Daily que caduca. Si deja de servir a mitad, se pide otro y se sigue por
 * donde iba (hasta tres veces).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Maximize, Pause, Play, RotateCcw } from 'lucide-react'
import { aParte, deParte, dondeSeguir, duracionDePartes, limpiarTrozos, reloj, type Parte } from '@/lib/nawar/recorte'
import { urlVideoSala } from '@services/grabaciones/grabaciones'

const VELOCIDADES = [1, 1.25, 1.5, 2, 0.75]
const REINTENTOS = 3

function leerPosicion(clave: string): number {
  try {
    return Number(window.localStorage.getItem(`nawar.grabacion.${clave}`) || 0) || 0
  } catch {
    return 0
  }
}

function guardarPosicion(clave: string, t: number) {
  try {
    if (t > 0) window.localStorage.setItem(`nawar.grabacion.${clave}`, String(Math.floor(t)))
    else window.localStorage.removeItem(`nawar.grabacion.${clave}`)
  } catch {
    /* sin almacén (ventana privada): se ve igual, solo no recuerda */
  }
}

export default function ReproductorRecortado({
  courseUuid,
  partes,
  clave,
  autoPlay = true,
  onMitad,
}: {
  courseUuid: string
  partes: Parte[]
  /** Para recordar por dónde iba (p. ej. `semana-12`). Sin ella, no recuerda. */
  clave?: string
  autoPlay?: boolean
  /** Se llama UNA vez, al pasar de la mitad: cuenta como vista. */
  onMitad?: () => void
}) {
  const video = useRef<HTMLVideoElement | null>(null)
  const caja = useRef<HTMLDivElement | null>(null)
  // Lo que hay que hacer cuando el vídeo (o su nueva parte) esté listo.
  const pendiente = useRef<number | null>(null)
  const quiereSonar = useRef(autoPlay)
  const mitad = useRef(false)
  const ultimoGuardado = useRef(0)

  const [durReal, setDurReal] = useState<Record<string, number>>({})
  const [iParte, setIParte] = useState(0)
  const [visible, setVisible] = useState(0)
  const [sonando, setSonando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [velocidad, setVelocidad] = useState(1)
  const [intento, setIntento] = useState(0)
  const [error, setError] = useState('')
  const [fin, setFin] = useState(false)

  // Las partes con su duración (la de Daily; si faltara, la del propio vídeo).
  const efectivas = useMemo<Parte[]>(
    () =>
      partes.map((p) => {
        const dur = p.dur || durReal[p.id] || 0
        return { id: p.id, dur, trozos: limpiarTrozos(p.trozos, dur) }
      }),
    [partes, durReal]
  )
  const total = duracionDePartes(efectivas)
  const parte = efectivas[iParte] || efectivas[0]

  // Al abrir: sigue por donde lo dejó.
  useEffect(() => {
    if (!clave) return
    const t = leerPosicion(clave)
    const todo = duracionDePartes(partes.map((p) => ({ ...p, trozos: limpiarTrozos(p.trozos, p.dur) })))
    if (t > 5 && todo > 0 && t < todo - 10) {
      const destino = aParte(
        partes.map((p) => ({ ...p, trozos: limpiarTrozos(p.trozos, p.dur) })),
        t
      )
      pendiente.current = destino.real
      setIParte(destino.parte)
      setVisible(t)
    }
    // Solo al montar: cambiar de grabación monta otro reproductor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const irA = useCallback(
    (t: number) => {
      const v = video.current
      const destino = aParte(efectivas, Math.max(0, Math.min(t, total || t)))
      setFin(false)
      setVisible(t)
      if (destino.parte === iParte && v) {
        try {
          v.currentTime = destino.real
        } catch {
          /* aún sin cargar: se queda donde está */
        }
      } else {
        pendiente.current = destino.real
        quiereSonar.current = sonando
        setCargando(true)
        setIParte(destino.parte)
      }
    },
    [efectivas, iParte, sonando, total]
  )

  const alternar = useCallback(() => {
    const v = video.current
    if (!v) return
    if (fin) {
      quiereSonar.current = true
      irA(0)
      void v.play().catch(() => undefined)
      return
    }
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }, [fin, irA])

  function alCargar() {
    const v = video.current
    if (!v || !parte) return
    if (Number.isFinite(v.duration) && v.duration > 0 && !parte.dur) setDurReal((d) => ({ ...d, [parte.id]: v.duration }))
    const destino = pendiente.current ?? dondeSeguir(parte.trozos, 0) ?? 0
    pendiente.current = null
    try {
      if (destino > 0.2) v.currentTime = destino
    } catch {
      /* aún no deja saltar: el primer `timeupdate` lo coloca */
    }
    v.playbackRate = velocidad
    setCargando(false)
    setError('')
    if (quiereSonar.current) void v.play().catch(() => undefined)
  }

  /** Se acabó lo que se ve de esta parte: la siguiente, o el final. */
  function terminarParte() {
    const v = video.current
    if (!v || pendiente.current !== null) return
    if (iParte < efectivas.length - 1) {
      const siguiente = efectivas[iParte + 1]
      pendiente.current = dondeSeguir(siguiente.trozos, 0) ?? 0
      quiereSonar.current = !v.paused || v.ended
      setCargando(true)
      setIParte(iParte + 1)
    } else {
      v.pause()
      setFin(true)
      setVisible(total)
      if (clave) guardarPosicion(clave, 0)
    }
  }

  function alAvanzar() {
    const v = video.current
    if (!v || !parte || pendiente.current !== null) return
    const sitio = dondeSeguir(parte.trozos, v.currentTime)
    if (sitio === null) {
      terminarParte()
      return
    }
    if (sitio > v.currentTime + 0.05) {
      v.currentTime = sitio // un corte: se salta
      return
    }
    const ahora = deParte(efectivas, iParte, v.currentTime)
    setVisible(ahora)
    if (!mitad.current && total > 0 && ahora >= total / 2) {
      mitad.current = true
      onMitad?.()
    }
    if (clave && Math.abs(ahora - ultimoGuardado.current) >= 5) {
      ultimoGuardado.current = ahora
      guardarPosicion(clave, ahora)
    }
  }

  function alFallar() {
    const v = video.current
    if (intento >= REINTENTOS) {
      setCargando(false)
      setError('No se pudo cargar el vídeo. Puede que la grabación ya no esté en la sala.')
      return
    }
    // El enlace caducó o se cortó la conexión: otro enlace y por donde iba.
    pendiente.current = v && v.currentTime > 0 ? v.currentTime : pendiente.current
    quiereSonar.current = sonando || quiereSonar.current
    setCargando(true)
    setIntento((n) => n + 1)
  }

  function cambiarVelocidad() {
    const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length]
    setVelocidad(siguiente)
    if (video.current) video.current.playbackRate = siguiente
  }

  function pantallaCompleta() {
    const c = caja.current as any
    const v = video.current as any
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    } else if (c?.requestFullscreen) {
      void c.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.())
    } else {
      v?.webkitEnterFullscreen?.() // iPhone
    }
  }

  if (!parte) return null

  return (
    <div ref={caja} className="relative w-full overflow-hidden rounded-xl bg-black select-none [&:fullscreen]:rounded-none [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center">
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <video
          ref={video}
          key={`${parte.id}-${intento}`}
          src={urlVideoSala(courseUuid, parte.id, intento)}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full"
          onClick={alternar}
          onLoadedMetadata={alCargar}
          onTimeUpdate={alAvanzar}
          onPlay={() => setSonando(true)}
          onPause={() => setSonando(false)}
          onEnded={terminarParte}
          onWaiting={() => setCargando(true)}
          onPlaying={() => setCargando(false)}
          onError={alFallar}
        />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[14px] text-white/90">{error}</p>
            <button
              onClick={() => {
                setError('')
                setCargando(true)
                // De 3 a 0: otra `key`, así que el vídeo se monta de nuevo.
                setIntento(0)
              }}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-[13.5px] font-semibold text-[#0B1033]"
            >
              <RotateCcw size={15} /> Volver a intentarlo
            </button>
          </div>
        ) : cargando ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 size={34} className="animate-spin text-white/80" />
          </div>
        ) : !sonando ? (
          <button onClick={alternar} aria-label={fin ? 'Ver otra vez' : 'Reproducir'} className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white">
              {fin ? <RotateCcw size={26} /> : <Play size={28} className="ml-1" fill="currentColor" />}
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 bg-[#0B1033] px-3 py-2 text-white">
        <button onClick={alternar} aria-label={sonando ? 'Pausar' : 'Reproducir'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10">
          {sonando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
        <span className="shrink-0 text-[12.5px] tabular-nums text-white/85">{reloj(visible)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(total))}
          step={1}
          value={Math.min(Math.floor(visible), Math.max(1, Math.floor(total)))}
          onChange={(e) => irA(Number(e.target.value))}
          aria-label="Avanzar o retroceder"
          className="min-w-0 flex-1 h-1.5 cursor-pointer accent-[#4da3ff]"
        />
        <span className="shrink-0 text-[12.5px] tabular-nums text-white/60">{reloj(total)}</span>
        <button
          onClick={cambiarVelocidad}
          aria-label="Velocidad"
          className="shrink-0 h-9 min-w-[44px] rounded-lg px-1.5 text-[12.5px] font-semibold tabular-nums hover:bg-white/10"
        >
          {String(velocidad).replace('.', ',')}×
        </button>
        <button onClick={pantallaCompleta} aria-label="Pantalla completa" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10">
          <Maximize size={17} />
        </button>
      </div>
    </div>
  )
}
