'use client'

/**
 * Estadísticas → Pagos a plazos (20/10/2026): "una parte de pagos aplazados,
 * en qué punto están del pago… quién tiene un pago aplazado de los alumnos".
 *
 * Cada plan propio (3 o 4 pagos, apps/api/src/services/payments/plazos.py):
 * en qué pago va, cuánto lleva y cuánto falta, el próximo cobro, si el último
 * falló y por qué, y si Stripe tiene puesto el calendario que corta la
 * suscripción en el último pago. Debajo, las plazas reservadas con señal a las
 * que les falta el resto. Solo administradores (es dinero).
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { comprobarTodosLosPlazos, getPlazos, type ListaPlazos, type PlanEnLista } from '@services/stats/kpis'
import { comprobarPlazos, getReservas, type Reserva } from '@services/stats/contactos'
import { euros } from '@services/stats/school'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import FichaCliente from './FichaCliente'
import { BOTON, ENLACE, Estado, META, Meta, Seccion, TARJETA, type Tono } from './ui'

const TONO: Record<string, Tono> = { fallido: 'rojo', activo: 'azul', completado: 'verde', cancelado: 'gris' }

const fecha = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' })
    : ''

/** La cuota que toca en el pago `n` (1, 2…): los céntimos que sobran van en las primeras. */
function cuotaDel(plan: PlanEnLista, n: number): number {
  const base = Math.floor(plan.total_cents / plan.cuotas)
  const resto = plan.total_cents - base * plan.cuotas
  return n <= resto ? base + 1 : base
}

function Cifra({ titulo, valor, sub, alerta }: { titulo: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div className={`${TARJETA} px-4 py-3.5 min-w-0`}>
      <p className="text-[12px] font-medium text-[#6B7280]">{titulo}</p>
      <p className={`mt-1 text-[26px] font-semibold leading-none tabular-nums ${alerta ? 'text-red-700' : 'text-gray-900'}`}>{valor}</p>
      {sub ? <p className={`${META} mt-1.5 leading-snug`}>{sub}</p> : null}
    </div>
  )
}

function FilaPlan({ plan, onAbrir, onCambio }: { plan: PlanEnLista; onAbrir: () => void; onCambio: (p: PlanEnLista) => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [comprobando, setComprobando] = useState(false)
  const siguiente = plan.cuotas_pagadas + 1
  const vivo = plan.estado === 'activo' || plan.estado === 'fallido'
  const num = numeroWhatsApp(plan.telefono)

  async function comprobar() {
    setComprobando(true)
    const r = await comprobarPlazos(org?.id, plan.id, accessToken)
    setComprobando(false)
    if (!r.ok || !r.plan) {
      toast.error(r.error || 'No se ha podido comprobar')
      return
    }
    onCambio({ ...plan, ...r.plan })
    toast.success('Comprobado con Stripe')
  }

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <button onClick={onAbrir} className="text-left min-w-0">
          <span className="text-[14px] font-semibold text-gray-900 hover:underline">{plan.nombre || plan.email}</span>
          {plan.fuera_de_metricas ? <span className={`${META} ml-2`}>fuera de los números (prueba)</span> : null}
        </button>
        <Estado tono={TONO[plan.estado] || 'gris'}>{plan.estado_nombre}</Estado>
      </div>
      <Meta partes={[plan.email, plan.telefono, plan.creado_por ? `enlace de ${plan.creado_por}` : '']} />
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-label={`${plan.cuotas_pagadas} de ${plan.cuotas} pagos hechos`}>
          {Array.from({ length: plan.cuotas }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full ${
                i < plan.cuotas_pagadas ? 'bg-[#16A34A]' : i === plan.cuotas_pagadas && plan.estado === 'fallido' ? 'bg-[#DC2626]' : 'bg-[#E5E7EB]'
              }`}
            />
          ))}
        </div>
        <span className="text-[13px] text-gray-900 tabular-nums">
          Pago {Math.min(plan.cuotas_pagadas, plan.cuotas)} de {plan.cuotas} · {euros(plan.pagado_cents)} de {euros(plan.total_cents)}
        </span>
      </div>
      {vivo && plan.proximo_cobro && plan.estado !== 'fallido' ? (
        <p className="text-[13px] text-gray-700">
          Próximo cobro: {fecha(plan.proximo_cobro)} · {euros(cuotaDel(plan, siguiente))} (pago {siguiente} de {plan.cuotas})
        </p>
      ) : null}
      {plan.fallo ? <p className="text-[13px] text-red-700">{plan.fallo}</p> : null}
      {vivo && !plan.calendario ? (
        <p className="text-[12.5px] text-[#8A6A2A]">
          Stripe aún no tiene el calendario que corta los cobros en el pago {plan.cuotas}. La escuela lo vuelve a poner cada día y, si
          no saliera, corta la suscripción al llegar al último pago.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Meta
          partes={[
            plan.calendario ? 'Se corta sola al último pago' : '',
            plan.sincronizado_at ? `comprobado con Stripe el ${fecha(plan.sincronizado_at)}` : 'aún no comprobado con Stripe',
          ]}
        />
        {vivo ? (
          <button onClick={comprobar} disabled={comprobando} className={`${ENLACE} disabled:opacity-50`}>
            {comprobando ? 'Comprobando…' : 'Comprobar ahora'}
          </button>
        ) : null}
        {num ? (
          <a href={`https://wa.me/${num}`} target="_blank" rel="noreferrer" className={ENLACE}>
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default function PlazosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<ListaPlazos | null>(null)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [error, setError] = useState('')
  const [comprobando, setComprobando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [verAcabados, setVerAcabados] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const [p, r] = await Promise.all([getPlazos(org.id, accessToken), getReservas(org.id, accessToken)])
    if (p.ok && p.datos) setDatos(p.datos)
    else setError(p.error || 'No se han podido leer los planes')
    setReservas((r.datos?.reservas || []).filter((x) => x.estado === 'abierta' && x.pagado_cents > 0))
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function comprobarTodos() {
    setComprobando(true)
    const r = await comprobarTodosLosPlazos(org?.id, accessToken)
    setComprobando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'Stripe no ha contestado')
      return
    }
    setDatos(r.datos)
    const res = r.datos.resultado
    toast.success(
      res
        ? `Revisados ${res.revisados}: ${res.al_dia} al día, ${res.fallidos} con cobro fallido${res.errores ? `, ${res.errores} sin respuesta de Stripe` : ''}`
        : 'Comprobado con Stripe'
    )
  }

  if (!datos) {
    return error ? (
      <p className="text-[14px] text-red-700">{error}</p>
    ) : (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  const t = datos.totales
  const vivos = datos.planes.filter((p) => p.estado === 'activo' || p.estado === 'fallido')
  const acabados = datos.planes.filter((p) => !(p.estado === 'activo' || p.estado === 'fallido'))
  const cambiar = (nuevo: PlanEnLista) =>
    setDatos((d) => (d ? { ...d, planes: d.planes.map((p) => (p.id === nuevo.id ? nuevo : p)) } : d))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Cifra titulo="Pagando a plazos" valor={String(t.vivos)} sub="planes en marcha" />
        <Cifra titulo="Con un cobro fallido" valor={String(t.fallidos)} alerta={t.fallidos > 0} sub={t.fallidos ? 'mira abajo quién' : 'ninguno'} />
        <Cifra titulo="Falta por cobrar" valor={euros(t.pendiente_cents)} sub="de los planes en marcha" />
        <Cifra titulo="Cobrado a plazos" valor={euros(t.cobrado_cents)} sub="hasta hoy" />
        <Cifra titulo="Pagados enteros" valor={String(t.completados)} sub={t.cancelados ? `${t.cancelados} cancelados sin completar` : undefined} />
      </div>

      <Seccion
        titulo="Planes en marcha"
        extra={
          <button onClick={comprobarTodos} disabled={comprobando} className={BOTON}>
            {comprobando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Comprobar todos con Stripe
          </button>
        }
      >
        {vivos.length ? (
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {vivos.map((p) => (
              <FilaPlan key={p.id} plan={p} onAbrir={() => setAbierta(p.email)} onCambio={cambiar} />
            ))}
          </div>
        ) : (
          <div className={`${TARJETA} px-4 py-6`}>
            <p className="text-[13.5px] text-gray-700">Ahora mismo nadie está pagando a plazos.</p>
          </div>
        )}
        <p className={META}>
          Stripe cobra solo cada mes con el mismo método de pago y corta la suscripción en el último pago. Si un cobro falla, Stripe lo
          reintenta durante unos días; a la persona le llega un correo de la escuela con un botón para pagar esa cuota y a vosotros, otro
          aviso. El acceso a la escuela no se quita solo: si hay que hacerlo, es en Panel → Usuarios. La escuela comprueba los planes
          con Stripe cada mañana.
        </p>
      </Seccion>

      {reservas.length ? (
        <Seccion titulo="Plazas reservadas con señal (falta el resto)">
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {reservas.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button onClick={() => setAbierta(r.email)} className="text-[14px] font-semibold text-gray-900 hover:underline text-left">
                    {r.nombre || r.email}
                  </button>
                  <span className="text-[13px] text-gray-900 tabular-nums">
                    {euros(r.pagado_cents)} de {euros(r.total_cents)} · faltan {euros(r.pendiente_cents)}
                  </span>
                </div>
                <Meta partes={[r.email, r.telefono, r.creado_por ? `señal de ${r.creado_por}` : '', `desde el ${fecha(r.created_at)}`]} />
              </div>
            ))}
          </div>
          <p className={META}>Con la señal no entran en la escuela: entran al completar el total. El enlace por lo que falta se crea en su ficha.</p>
        </Seccion>
      ) : null}

      {acabados.length ? (
        <Seccion
          titulo="Terminados"
          extra={
            <button onClick={() => setVerAcabados((v) => !v)} className={ENLACE}>
              {verAcabados ? 'Ocultar' : `Ver los ${acabados.length}`}
            </button>
          }
        >
          {verAcabados ? (
            <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
              {acabados.map((p) => (
                <FilaPlan key={p.id} plan={p} onAbrir={() => setAbierta(p.email)} onCambio={cambiar} />
              ))}
            </div>
          ) : null}
        </Seccion>
      ) : null}

      {abierta ? (
        <FichaCliente
          email={abierta}
          onClose={() => {
            setAbierta(null)
            cargar()
          }}
        />
      ) : null}
    </div>
  )
}
