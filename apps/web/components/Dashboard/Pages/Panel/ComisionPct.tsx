'use client'
/**
 * El % de comisión del closer de UNA venta (24/11/2026). Usuario: «si Belén
 * mete a alguien seteando, quiero poder meter 18 % de comisión, no 15… que se
 * ajuste automáticamente en cifras». Tocar un % lo guarda en esa venta y lo
 * que le toca, el pendiente por closer y Visión se recalculan con él. Sale en
 * Panel → Clientes y en la ficha del alumno. Solo administradores.
 * Servidor: apps/api/src/services/panel/comisiones.py (`elegir_pct`).
 */
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { elegirPctComision, type ComisionVenta } from '@services/panel/panel'
import { textoPct } from '@lib/nawar/comision'
import { filtro } from './ui'

export default function ComisionPct({
  email,
  com,
  pcts,
  onCambio,
  compacto = false,
}: {
  email: string
  com: ComisionVenta
  pcts: number[]
  onCambio: (pct: number) => void
  compacto?: boolean
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [otro, setOtro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const lista = pcts.length ? pcts : [10, 15, 18]
  const actual = com.pct || 0

  async function elegir(p: number) {
    if (ocupado) return
    setOcupado(true)
    const r = await elegirPctComision(org.id, email, p, token)
    setOcupado(false)
    if (!r.ok) return toast.error(r.error || 'No se ha podido guardar el %')
    setOtro('')
    toast.success(p ? `Comisión de esta venta: ${textoPct(p)}` : 'Vuelve al % de Visión')
    onCambio(p || com.pct_tramo || 0)
  }

  const alto = compacto ? '!h-7 !px-2' : ''
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12.5px] text-[#4B5565]">% de esta venta:</span>
      {lista.map((p) => (
        <button key={p} disabled={ocupado} onClick={() => elegir(p)} className={`${filtro(actual === p)} tabular-nums ${alto}`}>
          {textoPct(p)}
        </button>
      ))}
      <label className={`inline-flex items-center gap-1 rounded-lg border border-[#E6E8EE] bg-white px-2 ${compacto ? 'h-7' : 'h-8'}`}>
        <input
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const n = parseFloat(otro.replace(',', '.'))
            if (Number.isFinite(n) && n > 0 && n <= 50) elegir(n)
            else toast.error('Escribe un % entre 1 y 50')
          }}
          inputMode="decimal"
          placeholder="Otro"
          aria-label="Otro %, y pulsa Intro"
          className="w-11 text-[13px] tabular-nums outline-none bg-transparent"
        />
        <span className="text-[12.5px] text-[#8A93A3]">%</span>
      </label>
      {com.pct_elegido ? (
        <button disabled={ocupado} onClick={() => elegir(0)} className="text-[12.5px] text-[#4B5565] underline">
          Volver al de Visión{com.pct_tramo ? ` (${textoPct(com.pct_tramo)})` : ''}
        </button>
      ) : null}
    </div>
  )
}
