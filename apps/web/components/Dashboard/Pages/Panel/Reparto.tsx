'use client'

/**
 * Repartir las llamadas entre los closers (22/10/2026): «Para mí» o «Para
 * <otro closer>». Lo usan la columna «Por asignar» del tablero de Ventas y la
 * ficha de cada persona. Al closer que la recibe le llega un correo (salvo que
 * se la quede quien reparte); ver `apps/api/src/services/panel/reparto.py`.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { asignarCloser, getReparto, type MiembroEquipo } from '@services/panel/panel'
import toast from 'react-hot-toast'

export interface Reparto {
  equipo: MiembroEquipo[]
  yo: number
  repartidorId: number
  recargar: () => void
}

/** El equipo del panel, quién soy y quién reparte. */
export function useReparto(): Reparto {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<{ equipo: MiembroEquipo[]; yo: number; repartidorId: number }>({
    equipo: [],
    yo: 0,
    repartidorId: 0,
  })
  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getReparto(org.id, accessToken)
    if (r.ok && r.datos) setDatos({ equipo: r.datos.equipo, yo: r.datos.yo, repartidorId: r.datos.repartidor_id })
  }, [org?.id, accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { ...datos, recargar: cargar }
}

/** A quién se le puede pasar una llamada: los closers, y yo aunque no lo sea
 *  (un administrador también puede quedarse una). Yo primero. */
export function aQuienRepartir(equipo: MiembroEquipo[], yo: number): MiembroEquipo[] {
  const closers = equipo.filter((m) => m.rol === 'Closer' || m.id === yo)
  return [...closers.filter((m) => m.id === yo), ...closers.filter((m) => m.id !== yo)]
}

/** El nombre de pila, para que los botones quepan en la tarjeta. */
export const nombreCorto = (nombre: string) => (nombre || '').trim().split(/\s+/)[0] || nombre

export function BotonesReparto({
  email,
  closerId,
  reparto,
  onHecho,
  pequeno = false,
}: {
  email: string
  closerId: number
  reparto: Reparto
  onHecho: (closerId: number, closer: string) => void
  pequeno?: boolean
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [enviando, setEnviando] = useState(0)
  const opciones = aQuienRepartir(reparto.equipo, reparto.yo)
  if (!opciones.length) return null

  async function dar(m: MiembroEquipo | null) {
    const id = m?.id ?? 0
    setEnviando(id || -1)
    const r = await asignarCloser(org?.id, email, id, accessToken)
    setEnviando(0)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido asignar')
      return
    }
    if (!m) toast.success('Vuelve a «Por asignar»')
    else if (m.id === reparto.yo) toast.success('Para ti')
    else toast.success(r.datos?.avisado ? `Para ${nombreCorto(m.nombre)}: le ha llegado un correo` : `Para ${nombreCorto(m.nombre)}`)
    onHecho(id, m?.nombre ?? '')
  }

  const clase = pequeno
    ? 'h-7 px-2 rounded-md text-[12px] font-semibold'
    : 'h-8 px-2.5 rounded-md text-[12.5px] font-semibold'
  return (
    <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {opciones.map((m) => {
        const suyo = closerId === m.id
        return (
          <button
            key={m.id}
            type="button"
            disabled={Boolean(enviando) || suyo}
            onClick={() => dar(m)}
            className={`${clase} ${
              suyo ? 'bg-gray-900 text-white' : 'border border-[#E5E7EB] bg-white text-gray-800 hover:bg-[#F9FAFB]'
            } disabled:opacity-100`}
          >
            {enviando === m.id ? '…' : m.id === reparto.yo ? 'Para mí' : `Para ${nombreCorto(m.nombre)}`}
          </button>
        )
      })}
      {closerId ? (
        <button
          type="button"
          disabled={Boolean(enviando)}
          onClick={() => dar(null)}
          className={`${clase} border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]`}
        >
          Sin asignar
        </button>
      ) : null}
    </div>
  )
}
