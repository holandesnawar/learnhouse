/**
 * Bloques grises que laten mientras carga algo (19/11/2026): la forma de lo
 * que va a salir, en vez de un hueco vacío o un «Cargando…». Gris #EEF1F7,
 * sin sombras ni colores. El tamaño, por props (número = px, texto = CSS) o
 * con `className` (clases de Tailwind).
 */

import React from 'react'

type Medida = number | string

const css = (m?: Medida) => (typeof m === 'number' ? `${m}px` : m)

export function Esqueleto({
  ancho,
  alto = 12,
  redondo = 8,
  className = '',
}: {
  ancho?: Medida
  alto?: Medida
  /** Radio de las esquinas (px), o 'circulo'. */
  redondo?: number | 'circulo'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`block bg-[#EEF1F7] animate-pulse ${className}`}
      style={{
        width: css(ancho) ?? '100%',
        height: css(alto),
        borderRadius: redondo === 'circulo' ? 9999 : redondo,
      }}
    />
  )
}

/** Unas líneas de texto: la última más corta, como un párrafo de verdad. */
export function EsqueletoLineas({ lineas = 3, alto = 11, hueco = 8 }: { lineas?: number; alto?: number; hueco?: number }) {
  return (
    <span aria-hidden className="block" style={{ display: 'grid', gap: hueco }}>
      {Array.from({ length: lineas }, (_, i) => (
        <Esqueleto key={i} alto={alto} ancho={i === lineas - 1 && lineas > 1 ? '62%' : '100%'} />
      ))}
    </span>
  )
}

/** Envoltorio que avisa a los lectores de pantalla de que algo está cargando. */
export function Cargando({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  )
}

export default Esqueleto
