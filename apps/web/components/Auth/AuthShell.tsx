'use client'

import React from 'react'

// Auth-shell variant of the holandesnawar.com landing chrome. The full
// landing navbar fades its background based on the colour of the section
// underneath; auth pages have one dark gradient end to end, so we lock the
// navbar to solid dark and drop the scroll logic. Same logo + links so the
// student sees the same brand surface from .com to the academy.

const NAV_LINKS = [
  { label: 'Inicio',         href: 'https://www.holandesnawar.com/' },
  { label: 'Nuestra visión', href: 'https://www.holandesnawar.com/nuestra-vision' },
  { label: 'Blog',           href: 'https://www.holandesnawar.com/blog' },
  { label: 'Contacto',       href: 'https://www.holandesnawar.com/contacto' },
]

const LOGO_URL = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'

function NavbarLanding() {
  const [menuOpen, setMenuOpen] = React.useState(false)

  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <header
        className="sticky top-0 inset-x-0 z-40"
        style={{ backgroundColor: 'rgba(29,0,132,0.96)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-[72px] flex items-center justify-between gap-8">
            <a href="https://www.holandesnawar.com/" className="shrink-0">
              <img
                src={LOGO_URL}
                alt="Nawar"
                className="h-12 lg:h-11 w-auto object-contain"
              />
            </a>

            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-[15px] font-bold text-white/88 hover:text-white/50 transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <a
                href="https://www.holandesnawar.com/lista-de-espera"
                className="inline-flex items-center gap-2 px-7 py-3 text-[15px] font-semibold rounded-lg bg-[#4da3ff] text-[#1D0084] hover:bg-[#5eb4ff] transition-colors duration-200"
              >
                Apúntate
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <a
                href="https://www.holandesnawar.com/lista-de-espera"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] text-[14px] font-semibold hover:bg-[#5eb4ff] transition-all duration-200"
              >
                Apúntate
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <button
                onClick={() => setMenuOpen(true)}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors duration-200"
                aria-label="Abrir menú"
              >
                <span className="flex flex-col gap-[5px] w-5">
                  <span className="block h-[1.5px] bg-current rounded-full" />
                  <span className="block h-[1.5px] bg-current rounded-full w-[70%]" />
                  <span className="block h-[1.5px] bg-current rounded-full" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-[#1D0084] flex flex-col">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
            <nav className="w-full">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3.5 text-[21px] font-semibold text-white hover:text-white/80 text-center transition-colors duration-200"
                  style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="w-full mt-5">
              <a
                href="https://www.holandesnawar.com/lista-de-espera"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2.5 px-6 py-4 text-[16px] font-semibold rounded-xl bg-[#4da3ff] text-[#1D0084] hover:bg-[#5eb4ff] transition-all duration-200"
              >
                Apúntate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="mt-8 w-10 h-10 flex items-center justify-center text-white hover:text-white/70 transition-colors duration-200"
              aria-label="Cerrar menú"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function FooterLanding() {
  return (
    <footer className="border-t border-white/10 bg-[#1D0084]/40">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <img
            src={LOGO_URL}
            alt="Nawar"
            className="h-7 w-auto object-contain opacity-80"
          />
          <div className="flex items-center gap-6 text-[13px] text-white/55">
            <a
              href="https://www.holandesnawar.com/politica-de-privacidad"
              className="hover:text-white transition-colors"
            >
              Privacidad
            </a>
            <a
              href="https://www.holandesnawar.com/terminos-y-condiciones"
              className="hover:text-white transition-colors"
            >
              Términos
            </a>
            <a
              href="mailto:info@holandesnawar.com"
              className="hover:text-white transition-colors"
            >
              Contacto
            </a>
          </div>
          <p className="text-[12px] text-white/45">© {new Date().getFullYear()} Nawar</p>
        </div>
      </div>
    </footer>
  )
}

/**
 * Wraps an auth-page form (login, forgot, reset, crear-cuenta, bienvenido)
 * with the holandesnawar.com chrome (header + footer) on the dark Nawar
 * gradient. Pages just render their card/form as children — the shell
 * provides the page background, navigation and footer.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col text-white"
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
      <NavbarLanding />
      <main className="relative flex-1 flex items-center justify-center px-6 py-12 sm:px-4 sm:py-16">
        {children}
      </main>
      <FooterLanding />
    </div>
  )
}
