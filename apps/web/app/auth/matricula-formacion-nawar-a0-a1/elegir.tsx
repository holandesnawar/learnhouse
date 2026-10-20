'use client'

/**
 * Elegir 3 o 4 pagos (20/10/2026): "que elijan desde la misma página si lo
 * quieren en 3 o 4 plazos". El enlace «A plazos» del equipo trae aquí
 * (`/payments/pagar/{token}` redirige con `elegir=plazos`), la persona elige y
 * vuelve al mismo enlace con `?cuotas=`, que es cuando se crea la sesión de
 * pago de Stripe. Las opciones llegan en `op` ("3x49700,4x54000") desde
 * `OPCIONES` en apps/api/src/services/payments/plazos.py.
 */

import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { getAPIUrl } from '@services/config/config'
import { FondoPago, GUARANTEE_DAYS, LOGO_URL, PieSeguro } from './checkout'

type Opcion = { cuotas: number; total: number }

/** Por si faltara `op`: las mismas que el servidor. */
const POR_DEFECTO: Opcion[] = [
  { cuotas: 3, total: 49700 },
  { cuotas: 4, total: 54000 },
]

function leerOpciones(op: string): Opcion[] {
  const lista = op
    .split(',')
    .map((p) => p.split('x').map((n) => parseInt(n, 10)))
    .filter(([n, t]) => n >= 2 && n <= 12 && t > 0)
    .map(([cuotas, total]) => ({ cuotas, total }))
  return lista.length ? lista : POR_DEFECTO
}

/** Como `reparto` en plazos.py: los céntimos que sobran, en las primeras. */
function reparto(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => (i < resto ? base + 1 : base))
}

const euros = (cents: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)

const POPPINS = {
  fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
}

function Elegir() {
  const sp = useSearchParams()
  const token = sp.get('t') || ''
  const email = sp.get('em') || ''
  const nombre = sp.get('nm') || ''
  const opciones = React.useMemo(() => leerOpciones(sp.get('op') || ''), [sp])
  const [elegida, setElegida] = React.useState(opciones[0]?.cuotas || 3)
  const [yendo, setYendo] = React.useState(false)
  const actual = opciones.find((o) => o.cuotas === elegida) || opciones[0]
  const primera = reparto(actual.total, actual.cuotas)[0]

  function seguir() {
    if (!token || yendo) return
    setYendo(true)
    window.location.href = `${getAPIUrl()}payments/pagar/${encodeURIComponent(token)}?cuotas=${actual.cuotas}`
  }

  return (
    <div className="w-full max-w-2xl mx-auto min-w-0">
      <Link href="https://www.holandesnawar.com/" className="inline-flex items-center mb-5 sm:mb-6" aria-label="Volver a Holandés Nawar">
        <img src={LOGO_URL} alt="Holandés Nawar" className="h-10 sm:h-11 w-auto" />
      </Link>
      <div className="bg-white rounded-2xl p-4 sm:p-7 shadow-xl space-y-5">
        <div>
          <div className="text-[12px] font-bold text-[#4da3ff] tracking-wider uppercase">Formación Nawar A0-A1 · Pago a plazos</div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[#1D0084] leading-tight mt-1" style={POPPINS}>
            Elige en cuántos pagos
          </h1>
          <p className="text-[14px] text-[#0a1656] leading-relaxed mt-2">
            Entras en la escuela con el primer pago. Los demás se cobran solos cada mes con el mismo método de pago, y con
            el último se acaba: no hay nada que cancelar.
          </p>
        </div>

        {email ? (
          <div className="flex items-start gap-2.5 bg-[#F0F5FF] rounded-xl px-3 sm:px-4 py-2.5">
            <Mail size={16} className="shrink-0 mt-0.5 text-[#4da3ff]" strokeWidth={2.5} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Pagando como</div>
              <div className="text-[13.5px] font-semibold text-[#1D0084] truncate">
                {nombre ? `${nombre} · ` : ''}
                <span className="font-normal text-[#0a1656]">{email}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div role="radiogroup" aria-label="Número de pagos" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opciones.map((o) => {
            const cuotas = reparto(o.total, o.cuotas)
            const iguales = cuotas.every((c) => c === cuotas[0])
            const activa = o.cuotas === elegida
            return (
              <button
                key={o.cuotas}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => setElegida(o.cuotas)}
                className={`relative text-left rounded-xl border px-4 py-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#4da3ff]/30 ${
                  activa ? 'border-[#4da3ff] bg-white ring-[3px] ring-[#4da3ff]/20' : 'border-[#DDE6F5] bg-[#F0F5FF] hover:bg-[#E5ECFF]'
                }`}
              >
                <span
                  className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center ${
                    activa ? 'bg-[#4da3ff] border-[#4da3ff]' : 'border-[#B9C7E2] bg-white'
                  }`}
                >
                  {activa ? <Check size={13} strokeWidth={3} className="text-[#0a1656]" /> : null}
                </span>
                <span className="block text-[13px] font-semibold uppercase tracking-wider text-[#4da3ff]">{o.cuotas} pagos</span>
                <span className="block mt-1.5 text-[26px] font-bold text-[#1D0084] leading-none tabular-nums" style={POPPINS}>
                  {euros(cuotas[0])}
                  <span className="text-[14px] font-semibold text-[#0a1656]"> /mes</span>
                </span>
                <span className="block mt-2 text-[13px] text-[#0a1656] tabular-nums">
                  {euros(o.total)} en total
                  {iguales ? '' : ` · el último, ${euros(cuotas[cuotas.length - 1])}`}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={seguir}
          disabled={!token || yendo}
          className="w-full bg-[#4da3ff] hover:bg-[#5eb4ff] disabled:opacity-60 text-[#0a1656] font-bold py-3.5 rounded-xl text-[15px] inline-flex items-center justify-center gap-2.5 transition-colors"
        >
          {yendo ? <Loader2 size={16} className="animate-spin" /> : null}
          Pagar el primer mes · {euros(primera)}
          {yendo ? null : <ArrowRight size={15} strokeWidth={2.5} />}
        </button>

        <div className="flex items-start gap-2.5 bg-[#F0F5FF] rounded-xl px-3 py-3">
          <ShieldCheck size={16} className="shrink-0 mt-0.5 text-[#4da3ff]" strokeWidth={2.5} />
          <p className="text-[12.5px] text-[#0a1656] leading-relaxed">
            <strong className="text-[#1D0084]">{GUARANTEE_DAYS} días de garantía.</strong> Si no es para ti, escribes a
            soporte@holandesnawar.com y te devolvemos lo pagado.
          </p>
        </div>
        <PieSeguro />
      </div>
    </div>
  )
}

export default function ElegirPlazos() {
  return (
    <FondoPago>
      <Elegir />
    </FondoPago>
  )
}
