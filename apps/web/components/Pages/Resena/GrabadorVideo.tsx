'use client'

/**
 * Grabar la reseña con la cámara, sin salir de la escuela (10/11/2026).
 *
 * Tres momentos: se enciende la cámara y el alumno se ve (aún no graba),
 * graba con la cuenta de segundos delante, y al parar se le devuelve el
 * vídeo a la página (`onListo`), que es donde lo ve antes de mandarlo.
 *
 * - Vertical y con la cámara de delante: es como se va a ver en redes.
 * - El formato lo elige el navegador (`formatoParaGrabar`): el iPhone graba
 *   mp4 y Chrome webm; el servidor acepta los dos.
 * - Se corta solo a los 3 minutos: se piden 60-90 segundos y así un vídeo
 *   olvidado en marcha no acaba pesando más de lo que la escuela acepta.
 * - Si el navegador no deja usar la cámara (el de dentro de Instagram, un
 *   permiso denegado), se dice y queda «Elegir un vídeo», que está fuera de
 *   este componente.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Video, Square, X } from 'lucide-react'
import { formatoParaGrabar, minutos } from '@/lib/nawar/resenas'

const TOPE_SEG = 180

export interface VideoGrabado {
  blob: Blob
  seg: number
  tipo: string
}

function motivoCamara(e: any): string {
  const n = e?.name || ''
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'El navegador no tiene permiso para usar la cámara y el micrófono. Dáselo en los ajustes del navegador, o elige un vídeo grabado con la cámara del móvil.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No encontramos una cámara en este dispositivo. Puedes elegir un vídeo que ya tengas grabado.'
  if (n === 'NotReadableError') return 'Otra aplicación está usando la cámara. Ciérrala y prueba otra vez.'
  return 'No se pudo encender la cámara aquí. Puedes elegir un vídeo grabado con la cámara del móvil.'
}

export default function GrabadorVideo({ onListo, onCerrar }: { onListo: (v: VideoGrabado) => void; onCerrar: () => void }) {
  const visor = useRef<HTMLVideoElement | null>(null)
  const camara = useRef<MediaStream | null>(null)
  const grabadora = useRef<MediaRecorder | null>(null)
  const trozos = useRef<Blob[]>([])
  const empezo = useRef(0)
  const [lista, setLista] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [seg, setSeg] = useState(0)
  const [error, setError] = useState('')

  function apagar() {
    try {
      camara.current?.getTracks().forEach((t) => t.stop())
    } catch {}
    camara.current = null
  }

  // Encender la cámara al abrir; apagarla al cerrar.
  useEffect(() => {
    let vivo = true
    async function encender() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('Este navegador no deja grabar desde la página. Ábrela en Safari o Chrome, o elige un vídeo grabado con la cámara del móvil.')
        return
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        camara.current = s
        if (visor.current) {
          visor.current.srcObject = s
          visor.current.play().catch(() => {})
        }
        setLista(true)
      } catch (e) {
        if (vivo) setError(motivoCamara(e))
      }
    }
    encender()
    return () => {
      vivo = false
      try {
        if (grabadora.current && grabadora.current.state !== 'inactive') {
          grabadora.current.onstop = null
          grabadora.current.stop()
        }
      } catch {}
      apagar()
    }
  }, [])

  // La cuenta de segundos, y el corte a los 3 minutos.
  useEffect(() => {
    if (!grabando) return
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - empezo.current) / 1000)
      setSeg(s)
      if (s >= TOPE_SEG) parar()
    }, 250)
    return () => clearInterval(t)
  }, [grabando]) // eslint-disable-line react-hooks/exhaustive-deps

  function empezar() {
    if (!camara.current) return
    const tipo = formatoParaGrabar((t) => MediaRecorder.isTypeSupported(t))
    try {
      const g = new MediaRecorder(camara.current, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 })
      trozos.current = []
      g.ondataavailable = (e) => {
        if (e.data && e.data.size) trozos.current.push(e.data)
      }
      g.onstop = () => {
        const duracion = Math.max(1, Math.round((Date.now() - empezo.current) / 1000))
        const final = g.mimeType || tipo || 'video/webm'
        const blob = new Blob(trozos.current, { type: final })
        apagar()
        if (!blob.size) {
          setError('La grabación ha salido vacía. Prueba otra vez o elige un vídeo grabado con la cámara del móvil.')
          return
        }
        onListo({ blob, seg: duracion, tipo: final })
      }
      g.onerror = () => setError('La grabación se ha cortado. Prueba otra vez.')
      grabadora.current = g
      empezo.current = Date.now()
      setSeg(0)
      g.start(1000)
      setGrabando(true)
    } catch {
      setError('Este navegador no deja grabar desde la página. Elige un vídeo grabado con la cámara del móvil.')
    }
  }

  function parar() {
    setGrabando(false)
    try {
      if (grabadora.current && grabadora.current.state !== 'inactive') grabadora.current.stop()
    } catch {}
  }

  const enSuSitio = seg >= 60 && seg <= 90

  return (
    <div className="rounded-2xl border border-[#E4E8F2] bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-[#0a1656]">
          {grabando ? 'Grabando…' : lista ? 'Así te ves. Cuando quieras, empieza.' : error ? 'No se puede grabar aquí' : 'Encendiendo la cámara…'}
        </p>
        {!grabando ? (
          <button onClick={onCerrar} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5A6480] hover:text-[#0b2da0]">
            <X size={14} /> Cerrar
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-[14px] leading-relaxed text-[#374151]">{error}</p>
      ) : (
        <>
          <div className="relative mx-auto mt-3 w-full max-w-[300px] overflow-hidden rounded-xl bg-[#0a1656]" style={{ aspectRatio: '9 / 16' }}>
            {/* En espejo, como en la cámara de delante del móvil. */}
            <video ref={visor} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {grabando ? (
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-semibold text-white tabular-nums">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {minutos(seg)}
              </div>
            ) : null}
          </div>
          <p className={`mt-2 text-center text-[12.5px] ${grabando && enSuSitio ? 'font-semibold text-[#15803D]' : 'text-[#6B7280]'}`}>
            {grabando
              ? seg < 60
                ? 'Lo ideal: entre 1:00 y 1:30.'
                : enSuSitio
                  ? 'Buena duración. Puedes parar cuando termines.'
                  : 'Ya vas largo: ve cerrando.'
              : 'El vídeo se graba tal como te ves, en vertical.'}
          </p>
          <div className="mt-3 flex justify-center">
            {grabando ? (
              <button
                onClick={parar}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-5 text-[14.5px] font-semibold text-red-600 hover:bg-red-50"
              >
                <Square size={15} fill="currentColor" /> Parar
              </button>
            ) : (
              <button
                onClick={empezar}
                disabled={!lista}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0b2da0] px-5 text-[14.5px] font-semibold text-white hover:bg-[#09248a] disabled:opacity-50"
              >
                <Video size={17} /> Empezar a grabar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
