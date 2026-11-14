'use client'

/**
 * «¿Quién viene?» (14/11/2026): lo que los alumnos contestaron en «¿Vienes?»
 * del Inicio, para que el profe sepa antes de la clase cuánta gente espera.
 * Sale en «Tu próxima clase» de la sala de profes y en la ficha de la clase.
 * Solo antes de la clase o el mismo día: después manda la asistencia.
 */

import React, { useState } from 'react'
import type { Confirmaciones } from '@/lib/nawar/salaProfes'

export default function Confirmados({ c, compacto = false }: { c?: Confirmaciones | null; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const si = c?.si || 0
  const no = c?.no || 0
  const nombres = (c?.vienen?.length || 0) + (c?.no_pueden?.length || 0) > 0
  const resumen =
    si + no === 0
      ? 'Aún no ha confirmado nadie'
      : [si ? `${si} ${si === 1 ? 'dice que viene' : 'dicen que vienen'}` : '', no ? `${no} no ${no === 1 ? 'puede' : 'pueden'}` : '']
          .filter(Boolean)
          .join(' · ')
  return (
    <div className={compacto ? '' : 'py-3'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[14px] text-[#0B1033]">
          <span className="font-semibold">¿Quién viene?</span> <span className={si + no ? 'text-[#0B1033]' : 'text-[#6B7393]'}>{resumen}</span>
        </p>
        {nombres ? (
          <button type="button" onClick={() => setAbierto((v) => !v)} className="text-[13px] font-semibold text-[#0b2da0] hover:underline">
            {abierto ? 'Ocultar' : 'Ver quiénes'}
          </button>
        ) : null}
      </div>
      {abierto && nombres ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[13.5px]">
          {c?.vienen?.length ? (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#16A34A]">Vienen</p>
              <ul className="mt-1 space-y-0.5 text-[#0B1033]">
                {c.vienen.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {c?.no_pueden?.length ? (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">No pueden</p>
              <ul className="mt-1 space-y-0.5 text-[#3B4262]">
                {c.no_pueden.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
