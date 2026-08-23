'use client'

import React from 'react'
import { RefreshCcw } from 'lucide-react'
import { BRAND_LOGO_URL, BRAND_SUPPORT_EMAIL } from '@/lib/brand'

/**
 * Lo que ve el alumno si la escuela no responde justo cuando entra.
 *
 * Sustituye a `OrgNotFound` ("Enter Your Organization", en inglés, con un
 * icono de edificio): esa pantalla tiene sentido cuando hay muchas escuelas y
 * no se sabe a cuál vas, pero aquí solo hay una — si no responde es que está
 * arrancando, no que te hayas equivocado de sitio.
 *
 * Se recarga sola cada 5 segundos, así que el alumno entra en cuanto vuelve,
 * sin tocar nada. El logo viene de CloudFront: si cargara desde nuestra API,
 * tampoco se vería.
 */
/** Cuántas veces se recarga sola antes de rendirse. Sin este tope, si el
 *  fallo fuera permanente la página entraría en un bucle de recargas. */
const MAX_AUTO_RELOADS = 3
const COUNTER_KEY = 'nawar_org_unavailable_reloads'

export default function OrgUnavailable() {
  const [seconds, setSeconds] = React.useState(5)
  const [autoRetry, setAutoRetry] = React.useState(true)

  React.useEffect(() => {
    let count = 0
    try {
      count = Number(sessionStorage.getItem(COUNTER_KEY) || '0')
    } catch {
      /* sin sessionStorage: se reintenta igual, sin contar */
    }
    if (count >= MAX_AUTO_RELOADS) {
      setAutoRetry(false)
      return
    }

    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          try {
            sessionStorage.setItem(COUNTER_KEY, String(count + 1))
          } catch {
            /* da igual: como mucho se recarga alguna vez de más */
          }
          window.location.reload()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-7 sm:p-8 text-center">
        <img
          src={BRAND_LOGO_URL}
          alt="Holandés Nawar"
          className="h-9 mx-auto mb-6"
        />
        <div className="mx-auto w-11 h-11 rounded-full bg-[#F0F5FF] flex items-center justify-center mb-4">
          <RefreshCcw size={18} className="text-[#025dc7] animate-spin" />
        </div>
        <h1 className="text-[19px] font-bold text-[#1D0084] leading-snug">
          Volvemos en un momento
        </h1>
        <p className="text-[14px] text-[#5A6480] mt-2 leading-relaxed">
          {autoRetry ? (
            <>
              La escuela se está poniendo en marcha. Esto se abre solo en{' '}
              <span className="font-semibold text-[#1D0084] tabular-nums">{seconds}</span>{' '}
              {seconds === 1 ? 'segundo' : 'segundos'} — no hace falta que hagas nada.
            </>
          ) : (
            <>
              La escuela sigue sin responder. Prueba otra vez en un minuto; si
              continúa, avísanos y lo miramos enseguida.
            </>
          )}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-sm font-bold transition-colors"
        >
          <RefreshCcw size={15} strokeWidth={2.5} /> Probar ahora
        </button>
        <p className="mt-5 text-[12px] text-[#8A96AB]">
          ¿Sigue sin entrar?{' '}
          <a
            href={`mailto:${BRAND_SUPPORT_EMAIL}`}
            className="text-[#025dc7] font-semibold hover:underline"
          >
            {BRAND_SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  )
}
