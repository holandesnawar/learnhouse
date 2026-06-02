import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import AuthShell from '@components/Auth/AuthShell'

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
 *
 * Visual language matches nawar-web/src/pages/acceso.astro: Poppins title
 * with a soft white→translucent gradient + #4da3ff accent, #4da3ff CTA
 * with #1D0084 text.
 */
export default function BienvenidoPage() {
  return (
    <AuthShell>
      <div className="relative z-0 w-full max-w-[480px] flex flex-col items-center gap-8 text-center">
        <span className="text-5xl block" aria-hidden>🎉</span>

        <div className="w-full text-white/95">
          <h1
            className="text-center font-bold leading-[1.1]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(32px, 5vw, 44px)',
              letterSpacing: '-0.03em',
            }}
          >
            <span
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.45) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ¡Bienvenid@ a
            </span>{' '}
            <span style={{ color: '#4da3ff' }}>Holandés Nawar!</span>
          </h1>

          <p className="text-[15px] text-white/70 mt-4 leading-relaxed">
            Tu compra está confirmada. Te acabamos de mandar un email con un
            enlace para crear tu contraseña.
          </p>
          <p className="text-[13px] text-white/55 mt-3 leading-relaxed">
            ¿No lo ves? Mira la carpeta de Spam o Promociones — suele tardar un minuto.
          </p>

          <Link
            href="/auth/login"
            className="mt-7 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]"
          >
            Ya creé mi contraseña — Entrar
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <p className="text-[12px] text-white/55 mt-3 leading-relaxed">
            Si ya pulsaste el enlace del email y pusiste tu contraseña, entra desde aquí.
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
