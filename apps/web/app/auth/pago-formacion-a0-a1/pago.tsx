'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { AlertTriangle, CheckCircle, CreditCard, Info, ShieldCheck } from 'lucide-react'
import AuthShell from '@components/Auth/AuthShell'

// What lands on the right rail. Tweak the copy here without touching layout.
const COURSE_IMAGE =
  'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'
const COURSE_TITLE = 'Formación Nawar A0-A1'
const COURSE_SUBTITLE = 'De cero a A1 en neerlandés'
const COURSE_FEATURES = [
  'Acceso de por vida a la formación',
  'Vídeos + ejercicios paso a paso',
  'Comunidad privada de alumnos',
  'Certificado al terminar',
  'Garantía de devolución 30 días',
]

// Stripe Appearance API — palette + spacing matches the rest of /auth/* and
// nawar-web inputs. Card iframe colours are passed via `variables` (Stripe
// limits HTML access for PCI); the rest is normal Tailwind on the wrapper.
const NAWAR_APPEARANCE = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#4da3ff',
    colorBackground: '#F0F5FF',
    colorText: '#1D0084',
    colorDanger: '#dc2626',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#F0F5FF',
      border: '1px solid transparent',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:hover': { backgroundColor: '#E5ECFF' },
    '.Input:focus': {
      backgroundColor: '#ffffff',
      border: '1px solid #4da3ff',
      boxShadow: '0 0 0 3px rgba(77,163,255,0.22)',
    },
    '.Label': {
      color: '#0a1656',
      fontWeight: '600',
      fontSize: '13px',
      letterSpacing: '0.01em',
      marginBottom: '6px',
    },
    '.Tab': {
      backgroundColor: '#F0F5FF',
      border: '1px solid transparent',
      padding: '12px',
    },
    '.Tab:hover': { backgroundColor: '#E5ECFF' },
    '.Tab--selected': {
      backgroundColor: '#ffffff',
      border: '1px solid #4da3ff',
      boxShadow: '0 0 0 3px rgba(77,163,255,0.22)',
    },
    '.TabLabel': { fontWeight: '600' },
    '.Block': {
      backgroundColor: '#F0F5FF',
      border: '1px solid transparent',
    },
  },
}

function MissingParams() {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl p-6 sm:p-8 shadow-xl text-center">
      <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
      <h1
        className="text-2xl font-bold text-[#1D0084]"
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        Falta información para abrir el pago
      </h1>
      <p className="text-[14.5px] text-gray-600 mt-3 leading-relaxed">
        Volvemos al formulario de matrícula para preparar tu pago de nuevo.
      </p>
      <a
        href="https://www.holandesnawar.com/matricula-formacion-nawar-a0-a1"
        className="mt-6 inline-flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-3 px-6 rounded-xl transition-colors text-[14.5px]"
      >
        Volver a la matrícula
      </a>
    </div>
  )
}

function CheckoutInner() {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')
    // Stripe handles 3DS / SCA / wallet flows by redirecting; come back to
    // /auth/bienvenido on success so the existing post-payment UX runs.
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: 'https://academia.holandesnawar.nl/auth/bienvenido',
      },
    })
    if (stripeError) {
      setError(
        stripeError.message ||
          'No pudimos confirmar el pago. Revisa los datos o prueba con otra tarjeta.',
      )
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13.5px] text-red-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <div className="text-[12px] font-bold text-[#4da3ff] tracking-wider uppercase">
          Paso 2 de 2
        </div>
        <h1
          className="text-[26px] sm:text-[30px] font-bold text-[#1D0084] leading-tight mt-1"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          Pago seguro
        </h1>
        <p className="text-[14.5px] text-gray-600 mt-1.5">
          Elige tarjeta, Apple&nbsp;Pay, Google&nbsp;Pay, Klarna o iDEAL.
        </p>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      <div className="flex items-start gap-2.5 bg-[#F0F5FF] rounded-xl px-4 py-3 text-[13px] text-[#0a1656] leading-relaxed">
        <Info size={16} className="shrink-0 mt-0.5 text-[#4da3ff]" />
        <div>
          <strong className="text-[#1D0084]">¿Quieres pagar a plazos?</strong>{' '}
          Selecciona <strong>Klarna</strong> y elige entre <strong>30 días sin
          comisiones</strong> o <strong>3 plazos sin intereses</strong>. Necesitas
          una cuenta de Klarna (la creas en 2 minutos al pagar).
          <br />
          Con <strong>iDEAL</strong> el pago es único — con tu banco neerlandés en
          un toque.
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] disabled:opacity-60 disabled:cursor-not-allowed text-[#0a1656] font-bold py-3.5 rounded-xl transition-colors text-[15px]"
      >
        <CreditCard size={16} strokeWidth={2.5} />
        {submitting ? 'Procesando…' : 'Pagar y entrar'}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
        <ShieldCheck size={13} />
        Pago seguro procesado por Stripe · Cifrado de extremo a extremo
      </div>
    </form>
  )
}

function CourseSummary() {
  return (
    <aside className="bg-white rounded-2xl p-6 sm:p-7 shadow-xl">
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-[#1D0084] to-[#4da3ff] aspect-[16/9] mb-5 flex items-center justify-center p-6">
        <img
          src={COURSE_IMAGE}
          alt={COURSE_TITLE}
          className="max-h-full max-w-full object-contain drop-shadow-lg"
        />
      </div>

      <h2
        className="text-[20px] font-bold text-[#1D0084] leading-tight"
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        {COURSE_TITLE}
      </h2>
      <p className="text-[13.5px] text-[#4da3ff] font-semibold mt-0.5">
        {COURSE_SUBTITLE}
      </p>

      <ul className="mt-5 space-y-2.5">
        {COURSE_FEATURES.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[14px] text-gray-700 leading-snug"
          >
            <CheckCircle
              size={16}
              className="shrink-0 mt-0.5 text-[#4da3ff]"
              strokeWidth={2.5}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-gray-200 mt-6 pt-4 flex items-baseline justify-between">
        <span className="text-[13px] text-gray-500 font-semibold uppercase tracking-wider">
          Total
        </span>
        <div className="text-right">
          <div className="text-[24px] font-bold text-[#1D0084] leading-none">
            297&nbsp;€
          </div>
          <div className="text-[12px] text-gray-500 mt-1">Pago único · IVA incl.</div>
        </div>
      </div>
    </aside>
  )
}

function CheckoutPageBody() {
  const sp = useSearchParams()
  const clientSecret = sp.get('cs') || ''
  const publishableKey = sp.get('pk') || ''

  const stripePromise = React.useMemo<Promise<StripeJS | null> | null>(() => {
    if (!publishableKey) return null
    return loadStripe(publishableKey)
  }, [publishableKey])

  if (!clientSecret || !publishableKey || !stripePromise) {
    return <MissingParams />
  }

  return (
    <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl order-2 lg:order-1">
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: NAWAR_APPEARANCE, locale: 'es' }}
        >
          <CheckoutInner />
        </Elements>
      </div>
      <div className="order-1 lg:order-2 lg:sticky lg:top-32">
        <CourseSummary />
      </div>
    </div>
  )
}

export default function PagoClient() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-white/70">Cargando pago…</div>}>
        <CheckoutPageBody />
      </Suspense>
    </AuthShell>
  )
}
