'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Una fila que se abre y se cierra.
 *
 * La usan el índice (módulos y lecciones) y las preguntas frecuentes, para
 * que las tres se comporten igual: pulsas, se abre; pulsas otra, se cierra la
 * anterior. Así una pantalla con veinticuatro lecciones cabe de un vistazo en
 * vez de ser un tocho por el que hay que bajar y bajar.
 */
export default function Collapsible({
  open,
  onToggle,
  header,
  aside,
  children,
  tone = 'card',
}: {
  open: boolean
  onToggle: () => void
  /** Lo que se ve a la izquierda, siempre. */
  header: React.ReactNode
  /** Etiqueta opcional a la derecha (una fecha, un contador). */
  aside?: React.ReactNode
  children: React.ReactNode
  /** `card` = caja con borde propio · `row` = fila dentro de otra caja. */
  tone?: 'card' | 'row'
}) {
  const isCard = tone === 'card'
  return (
    <div
      className={
        isCard
          ? `rounded-2xl border bg-white overflow-hidden transition-colors ${
              open ? 'border-[#4da3ff]' : 'border-[#DDE6F5]'
            }`
          : ''
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full text-left flex items-center gap-3 transition-colors ${
          isCard ? 'px-4 sm:px-5 py-4 hover:bg-[#F8FAFF]' : 'px-3 sm:px-4 py-3 hover:bg-[#F8FAFF]'
        }`}
      >
        <ChevronDown
          size={isCard ? 18 : 16}
          className={`shrink-0 text-[#8A96AB] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
        <div className="min-w-0 flex-1">{header}</div>
        {aside && <div className="shrink-0">{aside}</div>}
      </button>

      {open && (
        <div className={isCard ? 'border-t border-[#EEF3FB]' : 'pl-9 pr-3 pb-3'}>{children}</div>
      )}
    </div>
  )
}
