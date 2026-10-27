'use client'

/**
 * La videollamada del curso, DENTRO de la escuela (27/10/2026). Pide a la API
 * una entrada con el nombre de quien entra y pinta la sala de Daily: sin otra
 * pestaña, sin app y sin escribir el nombre. Ver
 * apps/api/src/services/salas/salas.py.
 *
 * Va con la librería de Daily (`@daily-co/daily-js`, cargada solo aquí) y no
 * con un iframe suelto por dos cosas que solo da la librería: los COLORES de
 * la marca (`TEMA_NAWAR`; sin él, Daily sale en su verde) y saber cuándo se
 * pulsa «Salir» para volver al curso. Si la librería no carga, se pinta el
 * iframe suelto de antes: nadie se queda sin sala por eso.
 *
 * ⚠️ La cámara y el micro dependen también de la cabecera Permissions-Policy
 * de nginx (docker/nginx.conf), que NO puede prohibirlos (`camera=()` los
 * bloqueaba en toda la escuela).
 */

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Circle, AlertTriangle, Loader2 } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { entrarSala, type EntradaSala } from '@services/salas/salas'

// Los colores de la sala, los de la marca: el azul de los botones (#4da3ff
// con letra #0a1656) sobre el azul oscuro (#1D0084). Daily deja cambiar diez.
const TEMA_NAWAR = {
  colors: {
    accent: '#4DA3FF',
    accentText: '#0A1656',
    background: '#0D1452',
    backgroundAccent: '#1A2470',
    baseText: '#FFFFFF',
    border: '#2B3A8F',
    mainAreaBg: '#070B33',
    mainAreaBgAccent: '#1D0084',
    mainAreaText: '#FFFFFF',
    supportiveText: '#B8C4E6',
  },
}

const ALTO = 'h-[calc(100dvh-150px)] min-h-[460px]'

export default function SalaPage({ courseUuid }: { courseUuid: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const router = useRouter()
  const contenedor = useRef<HTMLDivElement>(null)
  const [entrada, setEntrada] = useState<EntradaSala | null>(null)
  const [error, setError] = useState('')
  const [sinLibreria, setSinLibreria] = useState(false)
  const volver = `/course/${curso}`

  useEffect(() => {
    if (!token || !curso || entrada) return
    entrarSala(curso, token)
      .then(setEntrada)
      .catch((e) => setError(e.message || 'No se pudo entrar a la sala'))
    // Una entrada por visita: pedir otra al cambiar la sesión volvería a
    // montar la sala en mitad de la llamada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, curso])

  // La sala de Daily, con la librería y los colores de la marca.
  useEffect(() => {
    if (!entrada || sinLibreria || !contenedor.current) return
    let vivo = true
    let llamada: any = null
    ;(async () => {
      try {
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        if (!vivo || !contenedor.current) return
        // Una sola sala a la vez: Daily no deja dos en la misma página.
        DailyIframe.getCallInstance()?.destroy()
        llamada = DailyIframe.createFrame(contenedor.current, {
          iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '16px' },
          showLeaveButton: true,
          theme: TEMA_NAWAR,
        })
        // «Salir» dentro de la llamada = de vuelta al curso.
        llamada.on('left-meeting', () => router.push(volver))
      } catch {
        if (vivo) setSinLibreria(true)
        return
      }
      // Si entrar falla (entrada caducada…), Daily lo enseña dentro de la sala.
      llamada.join({ url: entrada.url, token: entrada.token }).catch(() => {})
    })()
    return () => {
      vivo = false
      try {
        llamada?.destroy()
      } catch {
        /* ya cerrada */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, sinLibreria])

  return (
    <div className="w-full px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={volver}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#025dc7] hover:text-[#1D0084]"
        >
          <ArrowLeft size={16} /> Volver al curso
        </Link>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
          {entrada?.curso ? `Sala · ${entrada.curso}` : 'Sala en directo'}
        </h1>
        {(entrada?.grabando || entrada?.grabar) && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#B4413C]">
            <Circle size={9} className="fill-[#B4413C] text-[#B4413C]" />
            {entrada.grabando ? 'Esta sesión se graba' : 'Se graba cuando entra el profe'}
          </span>
        )}
      </div>

      {entrada?.aviso && (
        <p className="bg-[#FFFBF2] text-[#8A6A2A] rounded-xl px-3 py-2 text-[13px] flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {entrada.aviso}
        </p>
      )}

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[13.5px] flex items-start gap-2 max-w-xl">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {error}
            <br />
            <Link href={volver} className="font-semibold underline">
              Volver al curso
            </Link>
          </span>
        </div>
      ) : !entrada ? (
        <div className="flex items-center gap-2 text-[14px] text-[#5A6480] py-10">
          <Loader2 size={18} className="animate-spin" /> Preparando la sala…
        </div>
      ) : (
        <>
          {sinLibreria ? (
            <iframe
              title="Sala en directo"
              src={`${entrada.url}?t=${encodeURIComponent(entrada.token)}`}
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
              className={`w-full rounded-2xl border border-[#DDE6F5] bg-[#070B33] ${ALTO}`}
            />
          ) : (
            <div ref={contenedor} className={`w-full rounded-2xl overflow-hidden bg-[#070B33] ${ALTO}`} />
          )}
          <p className="text-[12px] text-[#5A6480]">
            Entras como <strong className="text-gray-900">{entrada.nombre}</strong>
            {entrada.anfitrion ? ' (anfitrión: puedes silenciar y compartir pantalla)' : ''}. Si el navegador te
            pregunta por la cámara y el micrófono, dale a «Permitir».
          </p>
        </>
      )}
    </div>
  )
}
