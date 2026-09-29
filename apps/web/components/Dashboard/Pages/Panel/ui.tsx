'use client'

/**
 * Las piezas de estilo del panel de ventas (closer y administrador).
 *
 * Decidido el 29/09 mirando Calendly: "tiene que parecer un software, no IA".
 * Lo que lo hacía parecer barato eran las etiquetas en cajitas pastel, las
 * sombras y los fondos tintados. Reglas:
 * - Blanco, gris y negro. Bordes finos (#E5E7EB), sin sombras.
 * - El color solo para lo que se toca (el azul de la marca) y para lo que
 *   importa de verdad: rojo si algo está vencido, verde si ya pagó.
 * - Las "etiquetas" son texto gris pequeño separado por puntos, no cajitas.
 *   Si hace falta señalar un estado, un punto de color de 6 px al lado.
 */

import React from 'react'

export const TARJETA = 'rounded-lg border border-[#E5E7EB] bg-white'
export const META = 'text-[12.5px] text-[#6B7280]'
export const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-[#D1D5DB] bg-white text-[13px] font-medium text-gray-800 hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors'
export const BOTON_PRINCIPAL =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-[#025dc7] text-white text-[13px] font-medium hover:bg-[#014fa9] disabled:opacity-50 transition-colors'
export const BOTON_PELIGRO =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-[#FCA5A5] bg-white text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors'
export const ENLACE = 'text-[13px] font-medium text-[#025dc7] hover:underline'
/** Filtro tipo "pastilla" (Todos, WhatsApp…): gris; el elegido, negro. */
export const filtro = (activo: boolean) =>
  `shrink-0 h-8 px-3 rounded-md text-[13px] font-medium border transition-colors ${
    activo ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
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

/** Título de sección: texto negro, sin icono de color. */
export function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}
