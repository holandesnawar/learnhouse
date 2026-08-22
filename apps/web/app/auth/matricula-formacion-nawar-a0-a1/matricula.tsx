'use client'

import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getAPIUrl } from '@services/config/config'

// Países más habituales primero; "Otro" al final.
const COUNTRIES = [
  { code: 'NL', label: 'Países Bajos' },
  { code: 'ES', label: 'España' },
  { code: 'BE', label: 'Bélgica' },
  { code: 'DE', label: 'Alemania' },
  { code: 'FR', label: 'Francia' },
  { code: 'IT', label: 'Italia' },
  { code: 'PT', label: 'Portugal' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CL', label: 'Chile' },
  { code: 'PE', label: 'Perú' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'OTRO', label: 'Otro' },
]

export default function MatriculaClient() {
  const [first_name, setFirst] = useState('')
  const [last_name, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('NL')
  const [city, setCity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!first_name.trim() || !last_name.trim() || !email.trim()) {
      setError('Rellena nombre, apellidos y email para continuar.')
      return
    }
    setIsSubmitting(true)
    try {
      // enroll-intent returns the URL of our embedded Nawar-branded
      // checkout (Stripe Elements under the hood). The buyer never leaves
      // the school domain (app.holandesnawar.com) — better conversion + a
      // consistent brand experience all the way through payment.
      const r = await fetch(`${getAPIUrl()}payments/enroll-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          country,
          city: city.trim(),
        }),
      })
      const data = await r.json()
      if (!r.ok || !data?.payment_url) {
        setError(data?.detail || 'No se pudo crear la matrícula. Vuelve a intentarlo en un momento.')
        setIsSubmitting(false)
        return
      }
      window.location.href = data.payment_url
    } catch (err) {
      setError('Hubo un problema de red. Revisa tu conexión y vuelve a intentarlo.')
      setIsSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#4da3ff]/60'

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 sm:px-4 sm:py-12"
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
      {error && (
        <div className="absolute top-0 inset-x-0 z-10 w-full px-4 py-3 flex items-center justify-between gap-3 bg-red-500 text-white">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="relative z-0 w-full max-w-lg">
        <div className="text-center">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
          >
            Formulario de matrícula
          </h1>
          <p className="text-white/70 mt-2 mb-8">
            Rellena tus datos y pasa al pago. Solo tarda un minuto.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-1.5">Nombre</label>
              <input
                type="text"
                value={first_name}
                onChange={(e) => setFirst(e.target.value)}
                className={inputCls}
                required
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-1.5">Apellidos</label>
              <input
                type="text"
                value={last_name}
                onChange={(e) => setLast(e.target.value)}
                className={inputCls}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-1.5">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className={inputCls}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-1.5">
              Teléfono <span className="text-white/50 text-xs font-normal">— con prefijo internacional, ej +34 600 12 34 56</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 12 34 56"
              className={inputCls}
              autoComplete="tel"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-1.5">País</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputCls}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-1.5">Ciudad</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputCls}
                autoComplete="address-level2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] font-bold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? 'Preparando tu pago…' : 'Continuar al pago →'}
          </button>

          <p className="text-center text-xs text-white/55 mt-3">
            Al continuar aceptas los{' '}
            <a
              href="https://www.holandesnawar.com/terminos-y-condiciones"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-white"
            >
              Términos
            </a>{' '}
            y la{' '}
            <a
              href="https://www.holandesnawar.com/politica-de-privacidad"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-white"
            >
              Política de privacidad
            </a>
            .
          </p>
        </form>
      </div>
    </div>
  )
}
