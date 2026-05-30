import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bienvenido a Holandés Nawar',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Landing the buyer sees right after Stripe Checkout succeeds.
 * Account provisioning happens server-side via the webhook (seconds), and a
 * "create your password" link arrives by email. This page tells them that
 * and offers a button to log in once they have the password set.
 */
export default function BienvenidoPage() {
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
        <span className="text-5xl block mb-6" aria-hidden>🎉</span>
        <h1 className="text-3xl font-bold text-white leading-tight">
          ¡Bienvenid<span className="text-[#4da3ff]">@</span> a Holandés Nawar!
        </h1>
        <p className="text-white/80 mt-4 leading-relaxed">
          Tu compra está confirmada. Te acabamos de mandar un email con un
          enlace para crear tu contraseña.
        </p>
        <p className="text-white/55 text-sm mt-3">
          ¿No lo ves? Mira la carpeta de Spam o Promociones — suele tardar un minuto.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center w-full px-5 py-3 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold transition-colors"
          >
            Ya creé mi contraseña — Entrar
          </Link>
          <p className="text-white/55 text-xs">
            Si ya pulsaste el enlace del email y pusiste tu contraseña, entra desde aquí.
          </p>
        </div>
      </div>
    </div>
  )
}
