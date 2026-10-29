'use client'

/**
 * La etiqueta de un curso que solo ven los administradores (29/10/2026:
 * «una mini etiqueta al lado del título, que solo vea yo, para saber cuál es
 * Groep rood y cuál Groep blauw»). Se escribe en los ajustes de la clase en
 * directo y sale junto al nombre en la barra lateral y en la página.
 * `oscuro`: sobre la barra azul de la escuela.
 */

import React from 'react'
import { colorDeEtiqueta } from '@/lib/nawar/cursos'

const PUNTO: Record<ReturnType<typeof colorDeEtiqueta>, string> = {
  rojo: '#E5484D',
  azul: '#4DA3FF',
  verde: '#30A46C',
  amarillo: '#E4B252',
  morado: '#8E4EC6',
  gris: '#9CA3AF',
}

export default function EtiquetaCurso({ texto, oscuro = false }: { texto: string; oscuro?: boolean }) {
  if (!texto) return null
  return (
    <span
      title="Solo la ven los administradores"
      className={`inline-flex items-center gap-1 shrink-0 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold leading-[16px] whitespace-nowrap ${
        oscuro ? 'bg-white/15 text-white' : 'bg-[#F3F4F6] text-gray-700 border border-[#E5E7EB]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PUNTO[colorDeEtiqueta(texto)] }} />
      {texto}
    </span>
  )
}
