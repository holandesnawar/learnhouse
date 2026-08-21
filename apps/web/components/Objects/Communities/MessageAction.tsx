'use client'

import React from 'react'

/**
 * Un botón de la barra que sale encima de un mensaje al pasar el ratón.
 *
 * Con su etiqueta, igual que los del compositor: un icono suelto no dice qué
 * hace, y el `title` del navegador tarda un segundo y se ve de sistema.
 */
export default function MessageAction({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  /** Para eliminar: en rojo al pasar por encima. */
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative group/act">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
          danger
            ? 'text-[#6B7280] hover:text-rose-600 hover:bg-rose-50'
            : 'text-[#4B5563] hover:text-[#025dc7] hover:bg-[#F0F5FF]'
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-[#025dc7] px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover/act:opacity-100 transition-opacity duration-150 hidden sm:block"
      >
        {label}
      </span>
    </div>
  )
}
