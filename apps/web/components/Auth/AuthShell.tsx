'use client'

import React from 'react'

// Focused auth screen (login, forgot, reset, crear-cuenta): no marketing
// navbar, no footer — a sign-in screen is a task, not a page to browse.
// The Nawar gradient is pinned to the full viewport via `fixed inset-0`, and
// the inner wrapper scrolls inside it (`overflow-y-auto` + `overscroll-none`)
// so on hard scroll / mobile rubber-band you never see the white body behind.
// Not a hard `position:fixed` lock on the card: the content can still scroll
// when the viewport is short (small phones, on-screen keyboard) so the submit
// button is always reachable.

const LOGO_URL = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    // `nawar-auth-shell` no pinta nada por sí sola: la usa `globals.css` para
    // teñir el CUERPO de la página del mismo azul. En el móvil, al abrir el
    // teclado cambia el alto de la ventana y por debajo de este `fixed` asomaba
    // el fondo blanco del documento: media pantalla en blanco justo al escribir
    // la contraseña.
    <div
      className="nawar-auth-shell fixed inset-0 overflow-y-auto overscroll-none text-white"
      style={{
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(ellipse 960px 560px at 50% 0%, rgba(11,109,240,0.50) 0%, transparent 65%), ' +
          'radial-gradient(ellipse 600px 400px at 100% 100%, rgba(77,163,255,0.16) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        <a
          href="https://www.holandesnawar.com/"
          className="shrink-0 mb-8 sm:mb-10"
          aria-label="Holandés Nawar"
        >
          <img
            src={LOGO_URL}
            alt="Holandés Nawar"
            className="h-10 sm:h-11 w-auto object-contain"
          />
        </a>
        {children}
      </div>
    </div>
  )
}
