'use client'

/**
 * La videollamada del curso, DENTRO de la escuela (27/10/2026). Pide a la API
 * una entrada con el nombre de quien entra y pinta la sala de Daily en un
 * iframe: sin otra pestaña, sin app y sin escribir el nombre. Ver
 * apps/api/src/services/salas/salas.py.
 *
 * ⚠️ La cámara y el micro del iframe dependen de dos cosas: el `allow` de
 * aquí abajo y la cabecera Permissions-Policy de nginx (docker/nginx.conf),
 * que NO puede prohibirlos (`camera=()` los bloqueaba en toda la escuela).
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Circle, AlertTriangle, Loader2 } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { entrarSala, type EntradaSala } from '@services/salas/salas'

export default function SalaPage({ courseUuid }: { courseUuid: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const [entrada, setEntrada] = useState<EntradaSala | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !curso || entrada) return
    entrarSala(curso, token)
      .then(setEntrada)
      .catch((e) => setError(e.message || 'No se pudo entrar a la sala'))
    // Una entrada por visita: pedir otra al cambiar la sesión volvería a
    // montar la sala en mitad de la llamada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, curso])

  const volver = `/course/${curso}`
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
          <iframe
            title="Sala en directo"
            src={`${entrada.url}?t=${encodeURIComponent(entrada.token)}`}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            className="w-full rounded-2xl border border-[#DDE6F5] bg-[#0b0f1a] h-[calc(100dvh-150px)] min-h-[460px]"
          />
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
