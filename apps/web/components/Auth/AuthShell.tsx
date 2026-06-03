'use client'

import React from 'react'

// Auth-shell variant of the holandesnawar.com landing chrome. Navbar fades
// from transparent to dark Nawar as the page scrolls — same behaviour the
// landing has — instead of locking to a solid dark bar, so it feels like a
// continuation of the brand site rather than a separate "app".

const NAV_LINKS = [
  { label: 'Inicio',         href: 'https://www.holandesnawar.com/' },
  { label: 'Nuestra visión', href: 'https://www.holandesnawar.com/nuestra-vision' },
  { label: 'Blog',           href: 'https://www.holandesnawar.com/blog' },
  { label: 'Contacto',       href: 'https://www.holandesnawar.com/contacto' },
]

const LOGO_URL = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'

function NavbarLanding() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const headerRef = React.useRef<HTMLElement>(null)

  // Identical scroll-fade logic to nawar-web's NavbarLanding: opacity
  // goes from 0 at scroll < 38% of viewport to 1 at scroll > 84%.
  React.useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const update = () => {
      const sy = window.scrollY
      const vh = window.innerHeight
      const fadeStart = vh * 0.18
      const fadeEnd = vh * 0.5
      const opacity = Math.min(1, Math.max(0, (sy - fadeStart) / (fadeEnd - fadeStart)))
      header.style.transition = 'none'
      header.style.backgroundColor = `rgba(29,0,132,${opacity.toFixed(3)})`
      header.style.backdropFilter = opacity > 0.1 ? 'blur(8px)' : 'none'
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-40"
        style={{ backgroundColor: 'rgba(29,0,132,0)' }}
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
  const year = new Date().getFullYear()
  return (
    <footer className="bg-[#1D0084] border-t border-white/10">
      {/* Contacto CTA — sustituye al bloque "Aprende como el 1%" del home */}
      <div className="max-w-6xl mx-auto px-6 pt-14 sm:pt-16">
        <div className="flex flex-col items-center text-center gap-4 pb-14 sm:pb-16 border-b border-white/10">
          <h2
            className="font-semibold text-white leading-tight"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(24px, 4vw, 34px)',
              letterSpacing: '-0.025em',
            }}
          >
            ¿Tienes alguna duda?
          </h2>
          <p className="text-[15px] text-white/70 max-w-md leading-relaxed">
            Estamos aquí para ayudarte. Escríbenos y te respondemos lo antes posible.
          </p>
          <a
            href="https://www.holandesnawar.com/contacto"
            className="mt-1 inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-[#4da3ff] text-[#1D0084] font-bold text-[15px] hover:bg-[#5eb4ff] transition-colors"
          >
            Escríbenos
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Columnas — mismo layout y estilo que el footer del home */}
      <div className="max-w-6xl mx-auto px-6 py-14 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10 pb-12 border-b border-white/10">
          {/* Brand + socials */}
          <div>
            <img
              src={LOGO_URL}
              alt="Holandés Nawar"
              className="h-[52px] w-auto object-contain mb-5"
            />
            <p className="text-[14px] text-white leading-[1.65] max-w-[260px] mb-5">
              Academia online de neerlandés para hispanohablantes. Aprende de
              verdad, con método y comunidad.
            </p>
            <div className="flex items-center gap-1">
              <a
                href="https://www.instagram.com/holandes.nawar"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 inline-flex items-center justify-center rounded-[10px] text-white/75 hover:text-white transition-colors"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a
                href="https://www.facebook.com/holandes.nawar/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-9 h-9 inline-flex items-center justify-center rounded-[10px] text-white/75 hover:text-white transition-colors"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a
                href="mailto:info@holandesnawar.com"
                aria-label="Email"
                className="w-9 h-9 inline-flex items-center justify-center rounded-[10px] text-white/75 hover:text-white transition-colors"
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
            </div>
          </div>

          {/* Navegación */}
          <div>
            <p className="text-base font-bold text-white mb-5">Navegación</p>
            <ul className="space-y-3 text-[14px]">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-white/75 hover:text-white transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <p className="text-base font-bold text-white mb-5">Contacto</p>
            <ul className="space-y-3 text-[14px]">
              <li>
                <a
                  href="mailto:info@holandesnawar.com"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  info@holandesnawar.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/holandes.nawar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  @holandes.nawar
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-base font-bold text-white mb-5">Legal</p>
            <ul className="space-y-3 text-[14px]">
              <li>
                <a
                  href="https://www.holandesnawar.com/terminos-y-condiciones"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Términos y condiciones
                </a>
              </li>
              <li>
                <a
                  href="https://www.holandesnawar.com/politica-de-privacidad"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Política de privacidad
                </a>
              </li>
              <li>
                <a
                  href="https://www.holandesnawar.com/cookies"
                  className="text-white/75 hover:text-white transition-colors"
                >
                  Cookies
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8">
          <p className="text-[12px] text-white/65">
            © {year} HOLANDÉS NAWAR. Todos los derechos reservados.
          </p>
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
      {/* min-h calc keeps the form vertically centred in the viewport on
          the first paint, regardless of how tall the footer gets when it
          stacks on mobile. Generous top padding so the title sits well
          below the fixed navbar with breathing room instead of crammed up
          against it. */}
      <main
        className="relative flex items-center justify-center px-6 pt-32 pb-12 sm:px-4 sm:pt-40 sm:pb-16"
        style={{ minHeight: 'calc(100vh - 72px)' }}
      >
        {children}
      </main>
      <FooterLanding />
    </div>
  )
}
