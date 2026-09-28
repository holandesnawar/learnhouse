'use client'

/**
 * Facturas en dos partes: las de los alumnos (lo que cobra la escuela, de
 * Stripe) y las de la empresa (lo que paga, subidas a mano). Se elige arriba y
 * se recuerda en la dirección (?vista=empresa) para poder enlazarla.
 */

import React, { useEffect, useState } from 'react'
import FacturasPanel from './FacturasPanel'
import FacturasEmpresaPanel from './FacturasEmpresaPanel'

type Vista = 'alumnos' | 'empresa'

export default function FacturasDosPartes() {
  // null hasta leer la dirección: si no, se montaba un instante la de alumnos
  // (que pide las facturas a Stripe) antes de pasar a la de la empresa.
  const [vista, setVista] = useState<Vista | null>(null)

  useEffect(() => {
    setVista(new URLSearchParams(window.location.search).get('vista') === 'empresa' ? 'empresa' : 'alumnos')
  }, [])

  function elegir(v: Vista) {
    setVista(v)
    const u = new URL(window.location.href)
    if (v === 'empresa') u.searchParams.set('vista', 'empresa')
    else u.searchParams.delete('vista')
    window.history.replaceState(null, '', u.toString())
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-white border border-[#DDE6F5] p-1">
        {(
          [
            ['alumnos', 'De alumnos', 'Lo que cobras'],
            ['empresa', 'De la empresa', 'Lo que pagas'],
          ] as const
        ).map(([id, n, que]) => (
          <button
            key={id}
            onClick={() => elegir(id)}
            className={`px-4 py-2 rounded-lg text-left transition-colors ${vista === id ? 'bg-[#1D0084] text-white' : 'text-[#5A6480] hover:bg-[#F0F5FF]'}`}
          >
            <span className="block text-[13.5px] font-bold">{n}</span>
            <span className={`block text-[11px] ${vista === id ? 'text-white/70' : 'text-[#8A96AB]'}`}>{que}</span>
          </button>
        ))}
      </div>
      {vista === 'alumnos' ? <FacturasPanel /> : vista === 'empresa' ? <FacturasEmpresaPanel /> : null}
    </div>
  )
}
