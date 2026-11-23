'use client'
import { getUriWithoutOrg } from '@services/config/config'
import { AlertTriangle, HomeIcon, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'

// Branded Nawar variant of the generic LearnHouse error UI. Renders inside
// any page wrapper, so it inherits the platform layout (sidebar stays put).
// Copy is Spanish + neutral so it works whether the error is "couldn't fetch
// the org", "the api timed out", or a one-off 500.
function ErrorUI(params: { message?: string; submessage?: string; reset?: () => void }) {
  const router = useRouter()
  const [retrying, setRetrying] = React.useState(false)

  function reloadPage() {
    router.refresh()
    window.location.reload()
  }

  // Auto-retry once on a transient error (e.g. the API was asleep after a
  // period of inactivity and the first request raced its cold start). We
  // recharge silently instead of dumping the user on the error screen. An
  // anti-loop guard in sessionStorage means that if it STILL fails within
  // 30s we stop auto-retrying and show the real error + buttons.
  //
  // 23/11/2026 ("no quiero más esta pantalla tan rápido"): antes de recargar
  // la página entera se prueba a volver a pintarla sin recargar (`reset` de
  // Next), que es casi instantáneo y no pierde nada. Solo si vuelve a fallar
  // en 20 s se recarga, y solo si falla otra vez se enseña este aviso.
  React.useEffect(() => {
    try {
      const SUAVE = 'nawar_soft_retry_ts'
      const ahora = Date.now()
      const ultimoSuave = Number(sessionStorage.getItem(SUAVE) || '0')
      if (params.reset && ahora - ultimoSuave > 20000) {
        sessionStorage.setItem(SUAVE, String(ahora))
        setRetrying(true)
        const t = setTimeout(() => params.reset?.(), 500)
        return () => clearTimeout(t)
      }
    } catch {
      /* sin sessionStorage: se sigue con la recarga de siempre */
    }
    try {
      const KEY = 'nawar_auto_retry_ts'
      const now = Date.now()
      const last = Number(sessionStorage.getItem(KEY) || '0')
      if (now - last > 30000) {
        sessionStorage.setItem(KEY, String(now))
        setRetrying(true)
        const t = setTimeout(() => reloadPage(), 1200)
        return () => clearTimeout(t)
      }
    } catch {
      /* sessionStorage unavailable — just show the error UI */
    }
  }, [])

  // Red de seguridad: si «Reconectando…» se queda puesto (el reintento no
  // ha llegado a desmontar esta pantalla), a los 6 s se enseñan los botones.
  React.useEffect(() => {
    if (!retrying) return
    const t = setTimeout(() => setRetrying(false), 6000)
    return () => clearTimeout(t)
  }, [retrying])

  if (retrying) {
    return (
      <div className="w-full px-4 py-16 sm:py-20 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-[#5A6480]">
          <RefreshCcw className="animate-spin text-[#4da3ff]" size={18} strokeWidth={2.5} />
          <span className="text-sm font-medium">Reconectando…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-16 sm:py-20 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl nice-shadow border border-[#DDE6F5] p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#F0F5FF] flex items-center justify-center">
          <AlertTriangle className="text-[#025dc7]" size={22} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
            {params.message || 'Hubo un problema cargando la página'}
          </h2>
          {params.submessage && (
            <p className="text-sm text-gray-500 mt-1.5">{params.submessage}</p>
          )}
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            Suele resolverse recargando. Si sigue pasando, escríbenos a{' '}
            <a
              href="mailto:info@holandesnawar.com"
              className="text-[#025dc7] font-semibold hover:underline"
            >
              info@holandesnawar.com
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-2">
          <button
            onClick={() => reloadPage()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] text-sm font-bold transition-colors"
          >
            <RefreshCcw size={15} strokeWidth={2.5} />
            Reintentar
          </button>
          <Link
            href={getUriWithoutOrg('/home')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#5A6480] border border-[#DDE6F5] hover:text-[#1D0084] hover:border-[#4da3ff] text-sm font-bold transition-colors"
          >
            <HomeIcon size={15} strokeWidth={2.5} />
            Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ErrorUI
