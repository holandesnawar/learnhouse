'use client'

/**
 * La cabecera de cada página del panel: el título en Poppins, una línea gris
 * que dice para qué sirve la página y, si la sección agrupa varias pestañas,
 * sus pestañas debajo.
 *
 * 22/11/2026 (usuario: «diseño más clean, de software caro, no tan IA»): fuera
 * la baldosa azul con el icono delante del título (era lo que más cantaba a
 * plantilla) y la caja gris de las pestañas, que ahora son texto con una raya
 * debajo. El `icono` se sigue aceptando para no romper a quien lo pasa, pero
 * no se pinta.
 */

import React from 'react'
import Link from 'next/link'
import { POPPINS } from '@/lib/nawar/marca'

export type Pestana = { href: string; label: string; activa: boolean; onClick?: () => void }

export default function CabeceraPagina({
  titulo,
  descripcion,
  acciones,
  pestanas,
  sobre,
}: {
  icono?: React.ReactNode
  titulo: string
  descripcion?: string
  acciones?: React.ReactNode
  pestanas?: Pestana[]
  /** Una línea pequeña encima del título (la fecha, la sección). */
  sobre?: React.ReactNode
}) {
  const clase = (activa: boolean) =>
    `shrink-0 -mb-px pb-2.5 text-[13.5px] font-medium border-b-2 whitespace-nowrap transition-colors ${
      activa ? 'text-[#0B1020] border-[#0B1020]' : 'text-[#8A93A3] border-transparent hover:text-[#0B1020]'
    }`
  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {sobre ? <div className="text-[13px] text-[#8A93A3]">{sobre}</div> : null}
          <h1 className="text-[22px] sm:text-[26px] font-semibold text-[#0B1020] leading-tight tracking-[-0.02em] truncate" style={POPPINS}>
            {titulo}
          </h1>
          {descripcion ? <p className="text-[13.5px] text-[#6B7384] leading-snug mt-1 max-w-[720px]">{descripcion}</p> : null}
        </div>
        {acciones ? <div className="shrink-0 flex items-center gap-2">{acciones}</div> : null}
      </div>
      {pestanas && pestanas.length ? (
        <div className="mt-5 flex gap-6 overflow-x-auto border-b border-[#E6E8EE]">
          {pestanas.map((p) =>
            p.onClick ? (
              <button key={p.href} onClick={p.onClick} className={clase(p.activa)}>
                {p.label}
              </button>
            ) : (
              <Link key={p.href} href={p.href} className={clase(p.activa)}>
                {p.label}
              </Link>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}
