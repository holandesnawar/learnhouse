'use client'

/**
 * Clientes: quien ha pagado, el más reciente arriba, con lo que pagó y si
 * sigue entrando a la escuela. Se abre la ficha para ver todo lo demás (qué
 * páginas vio, qué correos recibió, notas, tareas…). Solo administradores.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { euros, fechaCorta, getClientes, haceCuanto, type Cliente } from '@services/panel/panel'
import FichaCliente from './FichaCliente'
import { ChevronRight, Loader2, Search } from 'lucide-react'

const CARD = 'rounded-lg border border-[#E5E7EB] bg-white p-3.5 sm:p-5'

function Cifra({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className={CARD}>
      <p className="text-[10px] sm:text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-[22px] sm:text-[26px] font-semibold tabular-nums leading-tight mt-1 text-[#1D0084]">{valor}</p>
      {nota ? <p className="text-[11.5px] text-gray-500 mt-0.5">{nota}</p> : null}
    </div>
  )
}

/** "Entró hoy", "hace 5 días", o que no ha entrado nunca. */
function actividad(c: Cliente): { texto: string; tono: 'verde' | 'ambar' | 'gris' } {
  if (!c.tiene_cuenta) return { texto: 'Sin cuenta', tono: 'gris' }
  if (!c.ultima_visita) return { texto: 'No ha entrado', tono: 'ambar' }
  const dias = Math.floor((Date.now() - new Date(`${c.ultima_visita}T12:00:00`).getTime()) / 86400000)
  if (dias <= 0) return { texto: 'Entró hoy', tono: 'verde' }
  if (dias <= 7) return { texto: `Entró ${haceCuanto(`${c.ultima_visita}T12:00:00`)}`, tono: 'verde' }
  return { texto: `Última vez ${haceCuanto(`${c.ultima_visita}T12:00:00`)}`, tono: 'ambar' }
}

export default function ClientesPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<{ clientes: Cliente[]; total_cents: number; n: number } | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getClientes(org.id, accessToken)
    if (r.ok && r.datos) setDatos(r.datos)
    else setError(r.error || 'No se han podido cargar')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (datos?.clientes ?? []).filter((c) => !t || c.email.includes(t) || c.nombre.toLowerCase().includes(t) || c.telefono.includes(t))
  }, [datos, q])

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={24} />}
      </div>
    )
  }

  const sinEntrar = datos.clientes.filter((c) => actividad(c).tono !== 'verde').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Cifra label="Clientes" valor={String(datos.n)} />
        <Cifra label="Cobrado" valor={euros(datos.total_cents)} />
        <Cifra label="Ticket medio" valor={datos.n ? euros(Math.round(datos.total_cents / datos.n)) : '—'} />
        <Cifra label="Sin entrar esta semana" valor={String(sinEntrar)} nota="Los que conviene escribir" />
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono"
          className="w-full bg-white border border-[#E5E7EB] rounded-lg pl-9 pr-3 py-2 text-[13.5px] text-gray-900 outline-none focus:border-gray-900"
        />
      </div>

      {!lista.length ? (
        <p className="text-[13.5px] text-[#9CA3AF] py-10 text-center">Todavía no hay clientes.</p>
      ) : (
        <div className="rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] overflow-hidden">
          {lista.map((c) => {
            const a = actividad(c)
            return (
              <button
                key={c.email}
                onClick={() => setAbierta(c.email)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">{c.nombre || c.email}</p>
                  <p className="text-[12px] text-[#6B7280] truncate">
                    {c.email}
                    {c.telefono ? ` · ${c.telefono}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        a.tono === 'verde' ? 'text-[#15803D]' : a.tono === 'ambar' ? 'text-[#B45309]' : 'bg-[#F3F4F6] text-[#6B7590]'
                      }`}
                    >
                      {a.texto}
                    </span>
                    {c.tiene_cuenta ? (
                      <span className="rounded-full px-2 py-0.5 font-semibold bg-[#F3F4F6] text-[#6B7280]">
                        {c.lecciones} {c.lecciones === 1 ? 'lección hecha' : 'lecciones hechas'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold tabular-nums text-[#1D0084]">{euros(c.total_cents)}</p>
                  <p className="text-[11.5px] text-[#9CA3AF]">
                    {c.pagos > 1 ? `${c.pagos} pagos · ` : ''}
                    {fechaCorta(c.ultimo_pago)}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[#B9C6DC]" />
              </button>
            )
          })}
        </div>
      )}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
