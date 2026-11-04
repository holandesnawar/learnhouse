'use client'

/**
 * La cabecera de cada página del panel (04/11/2026): un icono con el azul de
 * la marca, el título en Poppins, una línea que dice para qué sirve la página
 * (usuario: "da pereza encontrar todo y dónde están las cosas") y, si la
 * sección agrupa varias pestañas, sus pestañas debajo.
 */

import React from 'react'
import Link from 'next/link'
import { POPPINS } from '@/lib/nawar/marca'

export type Pestana = { href: string; label: string; activa: boolean; onClick?: () => void }

export default function CabeceraPagina({
  icono,
  titulo,
  descripcion,
  acciones,
  pestanas,
}: {
  icono: React.ReactNode
  titulo: string
  descripcion?: string
  acciones?: React.ReactNode
  pestanas?: Pestana[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}
          >
            {icono}
          </span>
          <div className="min-w-0">
            <h1 className="text-[21px] sm:text-[26px] font-bold text-[#0a1656] leading-tight truncate" style={POPPINS}>
              {titulo}
            </h1>
            {descripcion ? <p className="text-[13px] sm:text-[13.5px] text-[#5A6480] leading-snug mt-0.5 line-clamp-2">{descripcion}</p> : null}
          </div>
        </div>
        {acciones ? <div className="shrink-0 flex items-center gap-2">{acciones}</div> : null}
      </div>
      {pestanas && pestanas.length ? (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#E9EFFB] p-1 w-full sm:w-fit">
          {pestanas.map((p) =>
            p.onClick ? (
              <button
                key={p.href}
                onClick={p.onClick}
                className={`shrink-0 h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-colors ${
                  p.activa ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480] hover:text-[#1D0084]'
                }`}
              >
                {p.label}
              </button>
            ) : (
              <Link
                key={p.href}
                href={p.href}
                className={`shrink-0 h-9 px-4 rounded-lg text-[13.5px] font-semibold inline-flex items-center transition-colors ${
                  p.activa ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480] hover:text-[#1D0084]'
                }`}
              >
                {p.label}
              </Link>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}
