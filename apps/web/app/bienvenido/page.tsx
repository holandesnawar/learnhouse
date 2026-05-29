import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bienvenido a Holandés Nawar',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function BienvenidoPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        backgroundColor: '#1D0084',
        color: 'white',
        textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ maxWidth: '28rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🎉</div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
          ¡Bienvenido a Holandés Nawar!
        </h1>
        <p style={{ opacity: 0.75, lineHeight: 1.6, marginBottom: '0.5rem' }}>
          Tu compra está confirmada. Te acabamos de mandar un email con un enlace para crear tu contraseña.
        </p>
        <p style={{ opacity: 0.55, fontSize: '0.875rem', marginBottom: '2rem' }}>
          Si no lo ves, revisa Spam o Promociones.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            backgroundColor: '#4da3ff',
            color: '#0a1656',
            fontWeight: 'bold',
            textDecoration: 'none',
          }}
        >
          Ya tengo cuenta — Entrar
        </Link>
      </div>
    </div>
  )
}
