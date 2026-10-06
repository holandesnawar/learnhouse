'use client'

/**
 * Plazas reservadas con señal que aún no han completado el pago: a quién hay
 * que cobrarle lo que falta. Cada línea abre la ficha, donde está el botón
 * «Enlace por lo que falta». Si no hay ninguna, no pinta nada.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getReservas, type Reserva } from '@services/stats/contactos'
import { ChevronRight } from 'lucide-react'
import { euros } from '@services/panel/panel'
import { TARJETA } from './ui'

export default function PlazasReservadas({ onAbrir, vuelta = 0 }: { onAbrir: (email: string) => void; vuelta?: number }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [reservas, setReservas] = useState<Reserva[]>([])

  useEffect(() => {
    if (!org?.id || !accessToken) return
    getReservas(org.id, accessToken).then((r) => {
      if (r.ok && r.datos) setReservas(r.datos.reservas)
    })
  }, [org?.id, accessToken, vuelta])

  if (!reservas.length) return null
  const pendiente = reservas.reduce((s, r) => s + r.pendiente_cents, 0)
  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-gray-900">
          Plazas reservadas · {reservas.length}
        </h2>
        <span className="text-[12.5px] text-[#6B7280] tabular-nums">Pendiente de cobrar: {euros(pendiente)}</span>
      </div>
      <ul className="divide-y divide-[#F3F4F6]">
        {reservas.map((r) => {
          const pct = r.total_cents ? Math.min(100, Math.round((r.pagado_cents * 100) / r.total_cents)) : 0
          return (
            <li key={r.id}>
              <button onClick={() => onAbrir(r.email)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#F9FAFB]">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-gray-900 truncate">{r.nombre || r.email}</p>
                  <p className="text-[12px] text-[#6B7280] truncate">
                    {r.pagado_cents > 0 ? `Pagado ${euros(r.pagado_cents)} de ${euros(r.total_cents)}` : 'Señal sin pagar todavía'} · sin acceso
                  </p>
                  <div className="mt-1.5 h-1 rounded-full bg-[#F3F4F6] overflow-hidden max-w-[220px]">
                    <div className="h-full bg-gray-900" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13.5px] font-semibold tabular-nums text-gray-900">{euros(r.pendiente_cents)}</p>
                  <p className="text-[11.5px] text-[#9CA3AF]">le falta</p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-[#9CA3AF]" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
