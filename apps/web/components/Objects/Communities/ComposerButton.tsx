'use client'

import React from 'react'

/**
 * Un botón de la barra del compositor.
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
    <div className="relative group/tip shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40 ${
          active
            ? 'bg-[#1D0084]/8 text-[#1D0084]'
            : 'text-[#4B5563] hover:text-[#1D0084] hover:bg-[#F0F5FF]'
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-[#1D0084] px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 hidden sm:block"
      >
        {label}
      </span>
    </div>
  )
}
