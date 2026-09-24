'use client'

/**
 * Listas agrupadas por día (Hoy, Ayer, Esta semana, Este mes, Anteriores),
 * cada grupo plegable con su flecha. Es lo mismo que Matrículas nuevas, puesto
 * aparte para que Contactos y Llamadas se lean igual.
 *
 * Abiertos de serie solo Hoy y Ayer: lo de hace un mes ya no es trabajo de
 * hoy, y si todo sale abierto hay que bajar media pantalla para llegar a lo
 * nuevo. Lo que se pliega se recuerda en este navegador (por lista).
 */

import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export const GRUPOS_DIA = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'antes', label: 'Anteriores' },
] as const

const ABIERTOS_DE_SERIE = ['hoy', 'ayer']

export function grupoDeFecha(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return 'antes'
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(d)
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return 'semana'
  if (dias < 31) return 'mes'
  return 'antes'
}

export default function PorDia<T>({
  items,
  fecha,
  clave,
  render,
  recordarComo,
}: {
  items: T[]
  /** La fecha por la que se agrupa cada elemento (ISO). */
  fecha: (item: T) => string
  clave: (item: T) => string | number
  render: (item: T) => React.ReactNode
  /** Nombre con el que se recuerda en el navegador qué grupos están abiertos. */
  recordarComo: string
}) {
  const [abiertos, setAbiertos] = useState<string[]>(ABIERTOS_DE_SERIE)
  const guardarEn = `nawar.pordia.${recordarComo}`

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(guardarEn) || 'null')
      if (Array.isArray(g)) setAbiertos(g)
    } catch {}
  }, [guardarEn])

  function alternar(id: string) {
    const nuevos = abiertos.includes(id) ? abiertos.filter((x) => x !== id) : [...abiertos, id]
    setAbiertos(nuevos)
    try {
      localStorage.setItem(guardarEn, JSON.stringify(nuevos))
    } catch {}
  }

  const porGrupo: Record<string, T[]> = {}
  for (const it of items) (porGrupo[grupoDeFecha(fecha(it))] ||= []).push(it)

  return (
    <div className="space-y-2">
      {GRUPOS_DIA.filter((g) => porGrupo[g.id]?.length).map((g) => {
        const abierto = abiertos.includes(g.id)
        const lista = porGrupo[g.id]
        return (
          <div key={g.id} className="rounded-xl border border-[#E7EEF9] bg-white">
            <button
              onClick={() => alternar(g.id)}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[#F7FAFF] rounded-xl"
            >
              {abierto ? (
                <ChevronDown size={15} className="text-[#5A6480]" />
              ) : (
                <ChevronRight size={15} className="text-[#5A6480]" />
              )}
              <span className="text-[13.5px] font-semibold text-gray-900">{g.label}</span>
              <span className="text-[12px] text-[#9CA3AF] tabular-nums">{lista.length}</span>
            </button>
            {abierto ? (
              <div className="space-y-1.5 px-2 pb-2">
                {lista.map((it) => (
                  <React.Fragment key={clave(it)}>{render(it)}</React.Fragment>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
