import React from 'react'

// Logo de marca Holandés Nawar (mismo que usa nawar-web).
const NAWAR_LOGO =
  'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'
const WEB_URL = 'https://www.holandesnawar.com'

// Barra de marca superior — logo Nawar (vuelve a la web) + enlace "Volver a la web".
// Versión ligera del navbar de nawar-web, pensada para páginas de auth.
function NawarBrandBar() {
  return (
    <header className="relative z-20 w-full">
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-[72px] flex items-center justify-between gap-6">
          <a href={WEB_URL} className="shrink-0" aria-label="Holandés Nawar">
            <img
              src={NAWAR_LOGO}
              alt="Holandés Nawar"
              className="h-11 w-auto object-contain"
            />
          </a>
          <a
            href={WEB_URL}
            className="text-[14px] font-semibold text-white/80 hover:text-white transition-colors"
          >
            Volver a la web
          </a>
        </div>
      </div>
    </header>
  )
}

// Footer slim — © + legales + redes sociales. Sin tarjeta de captación.
function NawarFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative z-20 w-full border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[12.5px] text-white/55 order-3 sm:order-1 text-center sm:text-left">
          © {year} HOLANDÉS NAWAR. Todos los derechos reservados.
        </p>

        <nav className="flex items-center gap-5 order-1 sm:order-2">
          <a
            href={`${WEB_URL}/terminos-y-condiciones`}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] text-white/65 hover:text-white transition-colors"
          >
            Términos
          </a>
          <a
            href={`${WEB_URL}/politica-de-privacidad`}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] text-white/65 hover:text-white transition-colors"
          >
            Privacidad
          </a>
          <a
            href={`${WEB_URL}/cookies`}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] text-white/65 hover:text-white transition-colors"
          >
            Cookies
          </a>
        </nav>

        <div className="flex items-center gap-3 order-2 sm:order-3">
          <a
            href="https://www.instagram.com/holandes.nawar"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>
          <a
            href="https://www.facebook.com/holandes.nawar/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href="mailto:info@holandesnawar.com"
            aria-label="Email"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  )
}

// Envoltura compartida: fondo azul Nawar (glow + puntos, igual que el hero de
// nawar-web) + barra de marca arriba y footer slim abajo. El contenido de cada
// página de auth va centrado en el medio.
export default function AuthChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full flex flex-col"
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
      <NawarBrandBar />
      <main className="relative z-10 flex-1 w-full flex flex-col items-center justify-center px-6 py-10 sm:px-4">
        {children}
      </main>
      <NawarFooter />
    </div>
  )
}
