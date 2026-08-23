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
  align = 'left',
  children,
}: {
  label: string
  onClick: () => void
  /** Para eliminar: en rojo al pasar por encima. */
  danger?: boolean
  /**
   * Hacia dónde crece la etiqueta. En los mensajes propios la barra vive
   * pegada al borde derecho, así que la etiqueta tiene que crecer hacia la
   * izquierda: centrada se salía de la pantalla y sacaba barra de desplazamiento.
   */
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div className="relative group/act">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`inline-flex items-center justify-center w-7 h-7 transition-colors ${
          danger ? 'text-[#6B7280] hover:text-rose-600' : 'text-[#4B5563] hover:text-[#025dc7]'
        }`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-[#025dc7] px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover/act:opacity-100 transition-opacity duration-150 hidden sm:block ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
