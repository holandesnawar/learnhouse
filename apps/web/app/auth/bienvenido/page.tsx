import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import AuthShell from '@components/Auth/AuthShell'

export const metadata: Metadata = {
  title: 'Bienvenido a Holandés Nawar',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function euros(cents: number, moneda: string): string {
  const v = (cents || 0) / 100
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: (moneda || 'eur').toUpperCase(),
      minimumFractionDigits: v % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(v)
  } catch {
    return `${v} €`
  }
}

/**
 * Después de pagar una SEÑAL o un pago a cuenta (06/10/2026): la plaza queda
 * guardada, pero todavía no hay cuenta ni correo de contraseña. Decirle
 * "bienvenido, mira tu correo" aquí sería mentirle. Lo manda la vuelta de la
 * sesión de pago con `?reserva=1&pag=…&pend=…` (services/payments/reservas.py).
 */
function PlazaReservada({ pagado, pendiente, moneda }: { pagado: number; pendiente: number; moneda: string }) {
  return (
    <AuthShell>
      <div className="relative z-0 w-full max-w-[480px] flex flex-col items-center gap-8 text-center">
        <span className="text-5xl block" aria-hidden>🔒</span>
        <div className="w-full text-white/95">
          <h1
            className="text-center font-bold leading-[1.1]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
              fontSize: 'clamp(30px, 5vw, 40px)',
              letterSpacing: '-0.03em',
            }}
          >
            <span style={{ color: '#4da3ff' }}>¡Plaza reservada!</span>
          </h1>
          <p className="text-[15px] text-white mt-4 leading-relaxed">
            Hemos recibido tu pago. Llevas <strong>{euros(pagado, moneda)}</strong> pagados y tu plaza en la
            formación ya está guardada.
          </p>
          <p className="text-[15px] text-white mt-3 leading-relaxed">
            Te quedan <strong>{euros(pendiente, moneda)}</strong>. En cuanto los pagues, te llegará un correo para
            crear tu contraseña y entrar en la escuela.
          </p>
          <p className="text-[13px] text-white/85 mt-3 leading-relaxed">
            El recibo de este pago te llega por correo. Si tienes cualquier duda, escríbenos por WhatsApp.
          </p>
          <a
            href="https://www.holandesnawar.com/"
            className="mt-7 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-3.5 rounded-xl transition-colors text-[15px]"
          >
            Volver a Holandés Nawar
            <ArrowRight size={15} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </AuthShell>
  )
}

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
export default async function BienvenidoPage({
  searchParams,
}: {
  searchParams: Promise<{ reserva?: string; pag?: string; pend?: string; cur?: string }>
}) {
  const sp = await searchParams
  const pendiente = parseInt(sp.pend || '0', 10) || 0
  if (sp.reserva === '1' && pendiente > 0) {
    return <PlazaReservada pagado={parseInt(sp.pag || '0', 10) || 0} pendiente={pendiente} moneda={sp.cur || 'eur'} />
  }
  return (
    <AuthShell>
      <div className="relative z-0 w-full max-w-[480px] flex flex-col items-center gap-8 text-center">
        <span className="text-5xl block" aria-hidden>🎉</span>

        <div className="w-full text-white/95">
          <h1
            className="text-center font-bold leading-[1.1]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
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

          <p className="text-[15px] text-white mt-4 leading-relaxed">
            Tu compra está confirmada. Te acabamos de mandar un email con un
            enlace para crear tu contraseña.
          </p>
          <p className="text-[13px] text-white/85 mt-3 leading-relaxed">
            ¿No lo ves? Mira la carpeta de Spam o Promociones. Suele tardar un minuto.
          </p>

          <Link
            href="/auth/login"
            className="mt-7 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]"
          >
            Ya creé mi contraseña — Entrar
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <p className="text-[12px] text-white/85 mt-3 leading-relaxed">
            Si ya pulsaste el enlace del email y pusiste tu contraseña, entra desde aquí.
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
