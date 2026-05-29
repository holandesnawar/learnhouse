import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bienvenido a Holandés Nawar',
  robots: { index: false, follow: false },
}

// Always render on request so Stripe's session_id reaches the page intact.
export const dynamic = 'force-dynamic'

/**
 * Landing the student sees right after Stripe Checkout succeeds.
 * Account provisioning happens server-side via the webhook (seconds), so we
 * just say "look at your email" — the welcome message there has the actual
 * "crea tu contraseña" CTA.
 */
export default function ThanksPage() {
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
      <div className="relative z-0 w-full max-w-md text-center">
        <span className="text-5xl block mb-6">🎉</span>
        <h1 className="text-3xl font-bold text-white leading-tight">
          ¡Bienvenid<span className="text-[#4da3ff]">@</span> a Holandés Nawar!
        </h1>
        <p className="text-white/75 mt-3 leading-relaxed">
          Tu compra está confirmada. Te acabamos de mandar un email con un enlace
          para crear tu contraseña y entrar a la academia.
        </p>
        <p className="text-white/55 text-sm mt-4">
          ¿No lo ves? Mira la carpeta de Spam o Promociones. Tarda hasta un minuto.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center w-full px-5 py-3 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold transition-colors"
        >
          Ya tengo cuenta — Entrar
        </Link>
      </div>
    </div>
  )
}
