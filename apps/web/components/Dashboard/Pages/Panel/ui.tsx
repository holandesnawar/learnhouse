'use client'

/**
 * Las piezas de estilo del panel de ventas (closer y administrador).
 *
 * Decidido el 29/09 mirando Calendly: "tiene que parecer un software, no IA".
 * Lo que lo hacía parecer barato eran las etiquetas en cajitas pastel, las
 * sombras y los fondos tintados. Eso sigue fuera.
 *
 * Repaso del 04/11/2026 (usuario: "colores y diseños sin vida, mira nuestra
 * escuela por dentro, cómo tiene vida"): el gris y negro de entonces se pasa
 * a los colores de la escuela, sin volver a las cajitas pastel:
 * - Bordes con un punto de azul (#E2E8F4) y esquinas como las de la escuela.
 * - Lo elegido (un filtro, una pestaña) en el azul oscuro de la marca, no en negro.
 * - Los títulos de sección en Poppins y azul muy oscuro, como en la escuela.
 * - El color, como antes, solo para lo que se toca (el azul) y para lo que
 *   importa de verdad: rojo si algo está vencido, verde si ya pagó.
 * - Las "etiquetas" siguen siendo texto pequeño separado por puntos, no
 *   cajitas. Si hace falta señalar un estado, un punto de color de 6 px.
 */

import React from 'react'

export const TARJETA = 'rounded-xl border border-[#E2E8F4] bg-white'
export const META = 'text-[12.5px] text-[#6B7280]'
export const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-[#D5DDEC] bg-white text-[13px] font-medium text-[#1F2A44] hover:bg-[#F3F6FD] hover:border-[#B9CBEA] disabled:opacity-50 transition-colors'
export const BOTON_PRINCIPAL =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-[#025dc7] text-white text-[13px] font-semibold hover:bg-[#014fa9] disabled:opacity-50 transition-colors'
export const BOTON_PELIGRO =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-[#FCA5A5] bg-white text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors'
export const ENLACE = 'text-[13px] font-medium text-[#025dc7] hover:underline'
/** Filtro tipo "pastilla" (Todos, WhatsApp…): blanco; el elegido, en el azul de la marca. */
export const filtro = (activo: boolean) =>
  `shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors ${
    activo ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#E2E8F4] text-[#374151] hover:border-[#B9CBEA] hover:text-[#1D0084]'
  }`

export type Tono = 'gris' | 'verde' | 'rojo' | 'azul' | 'ambar'
const PUNTO: Record<Tono, string> = {
  gris: '#9CA3AF',
  verde: '#16A34A',
  rojo: '#DC2626',
  azul: '#2563EB',
  ambar: '#D97706',
}

/** Estado con un punto de color y texto gris: lo único con color en una fila. */
export function Estado({ tono = 'gris', children, className = '' }: { tono?: Tono; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] text-[#4B5563] ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PUNTO[tono] }} />
      {children}
    </span>
  )
}

/** Una línea de datos separados por " · ", saltándose los vacíos. */
export function Meta({ partes, className = '' }: { partes: React.ReactNode[]; className?: string }) {
  const llenas = partes.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  return (
    <p className={`${META} truncate ${className}`}>
      {llenas.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span className="text-[#D1D5DB]"> · </span> : null}
          {p}
        </React.Fragment>
      ))}
    </p>
  )
}

/** Título de sección: en Poppins y azul muy oscuro, como los de la escuela. */
export function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[#0a1656]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}
