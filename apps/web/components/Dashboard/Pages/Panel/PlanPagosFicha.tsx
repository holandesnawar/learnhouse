'use client'

/**
 * El plan de pagos propio en la ficha (14/10/2026): cuántos pagos lleva, el
 * siguiente cobro y, si alguno no entró, por qué. Los cobros los hace Stripe
 * solo; la escuela se pone al día cada mañana, y «Comprobar con Stripe» lo
 * hace en el momento. El acceso NO se quita solo si un cobro falla: eso lo
 * decide el equipo (Panel → Usuarios).
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { comprobarPlazos, type PlanPagos } from '@services/stats/contactos'
import { Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, Estado, Meta, type Tono } from './ui'

const TONO: Record<string, Tono> = { activo: 'verde', completado: 'verde', fallido: 'rojo', cancelado: 'rojo' }

const euros = (c: number) => `${(c / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`
const dia = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : ''

export default function PlanPagosFicha({ plan: inicial }: { plan: PlanPagos }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [plan, setPlan] = useState(inicial)
  const [comprobando, setComprobando] = useState(false)

  async function comprobar() {
    setComprobando(true)
    const r = await comprobarPlazos(org?.id, plan.id, accessToken)
    setComprobando(false)
    if (!r.ok || !r.plan) return toast.error(r.error || 'No se ha podido comprobar')
    setPlan(r.plan)
    toast.success('Al día con Stripe')
  }

  return (
    <div className="rounded-md border border-[#E5E7EB] px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-gray-900">
          Paga en {plan.cuotas} plazos · {plan.cuotas_pagadas} de {plan.cuotas} pagados
        </p>
        <Estado tono={TONO[plan.estado] || 'gris'}>{plan.estado_nombre}</Estado>
      </div>
      <Meta
        partes={[
          `Pagado ${euros(plan.pagado_cents)} de ${euros(plan.total_cents)}`,
          plan.proximo_cobro ? `Próximo cobro el ${dia(plan.proximo_cobro)}` : '',
          plan.creado_por ? `Enlace de ${plan.creado_por}` : '',
        ]}
      />
      {plan.fallo ? <p className="text-[12.5px] text-[#B91C1C] leading-snug">{plan.fallo}</p> : null}
      {plan.estado === 'fallido' || plan.estado === 'cancelado' ? (
        <p className="text-[12px] text-[#6B7280] leading-snug">
          Sigue teniendo acceso a la escuela. Si hay que quitárselo, es en Panel → Usuarios.
        </p>
      ) : null}
      <div className="pt-0.5">
        <button onClick={comprobar} disabled={comprobando} className={`${BOTON} disabled:opacity-50`}>
          {comprobando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Comprobar con Stripe
        </button>
      </div>
    </div>
  )
}
