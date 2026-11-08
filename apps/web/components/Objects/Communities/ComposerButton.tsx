'use client'

import React from 'react'

/**
 * Un botón de la barra del compositor.
 *
 * Rediseño (08/11/2026): icono gris fino, un fondo gris suave solo al pasar
 * el ratón y la etiqueta en casi negro, como en Circle.
 *
 * Con su etiqueta al pasar el ratón: los iconos sueltos no dicen qué hacen, y
 * el `title` del navegador tarda un segundo largo en salir y se ve de sistema.
 * Esta aparece al momento y va con la marca.
 *
 * En móvil no hay ratón, así que la etiqueta no molesta: no llega a aparecer.
 */
export default function ComposerButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  /** Qué hace el botón, en una palabra o dos. */
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    // La etiqueta crece hacia la DERECHA desde el borde del botón, no centrada.
    // Centrada, la del primer icono ("Adjuntar un archivo") se salía por la
    // izquierda de la pantalla, encima del menú.
    <div className="relative group/tip shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-40 [&_svg]:stroke-[1.75] ${
          active ? 'bg-[#EAF0FE] text-[#0b2da0]' : 'text-[#6B7393] hover:bg-[#F2F5FB] hover:text-[#0B1033]'
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-[#0B1033] px-2 py-1 text-[11.5px] font-medium text-white opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 hidden sm:block"
      >
        {label}
      </span>
    </div>
  )
}
