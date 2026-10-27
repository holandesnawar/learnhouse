'use client'

/**
 * Clientes: quien ha pagado, el más reciente arriba, con lo que pagó y si
 * sigue entrando a la escuela. Se abre la ficha para ver todo lo demás (qué
 * páginas vio, qué correos recibió, notas, tareas…). Solo administradores.
 *
 * Comisión del closer (27/10/2026, "saber qué venta fue ya pagada la comisión
 * del closer… que lo vea yo solo"): en cada venta, pendiente o pagada, con lo
 * que le toca aproximado y lo que se le pagó. Arriba, lo pendiente por closer
 * con «Marcar todas pagadas». El closer no ve esta pantalla. Lógica en
 * apps/api/src/services/panel/comisiones.py.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  euros,
  fechaCorta,
  getClientes,
  haceCuanto,
  marcarComision,
  marcarComisiones,
  quitarComision,
  type Cliente,
  type ComisionesCloser,
} from '@services/panel/panel'
import FichaCliente from './FichaCliente'
import PlazasReservadas from './PlazasReservadas'
import { BOTON, BOTON_PRINCIPAL } from './ui'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { ChevronRight, HandCoins, Loader2, Search } from 'lucide-react'

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
  const [datos, setDatos] = useState<{ clientes: Cliente[]; total_cents: number; n: number; comisiones?: ComisionesCloser[] } | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  // Comisión del closer: qué ventas se ven y cuál se está marcando.
  const [verComision, setVerComision] = useState<'todas' | 'pendiente' | 'pagada'>('todas')
  const [editando, setEditando] = useState<string | null>(null)
  const [importe, setImporte] = useState('')
  const [guardando, setGuardando] = useState(false)

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
    return (datos?.clientes ?? [])
      .filter((c) => !t || c.email.includes(t) || c.nombre.toLowerCase().includes(t) || c.telefono.includes(t))
      .filter((c) =>
        verComision === 'todas'
          ? true
          : verComision === 'pagada'
            ? Boolean(c.comision?.pagada)
            : Boolean(c.comision && !c.comision.pagada && c.comision.con_llamada)
      )
  }, [datos, q, verComision])

  function abrirComision(c: Cliente) {
    if (editando === c.email) {
      setEditando(null)
      return
    }
    const cents = c.comision?.pagada?.importe_cents || c.comision?.estimada_cents || 0
    setImporte(cents ? (cents / 100).toFixed(2).replace('.', ',') : '')
    setEditando(c.email)
  }

  async function guardarComision(c: Cliente) {
    // «65,25», «1.200,50» o «65.25»: con coma, los puntos son de miles.
    const limpio = (importe || '0').trim()
    const numero = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio
    const cents = Math.round(parseFloat(numero) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error('Escribe un importe válido, por ejemplo 65,25')
      return
    }
    setGuardando(true)
    const r = await marcarComision(org.id, c.email, cents, accessToken)
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    toast.success('Comisión marcada como pagada')
    setEditando(null)
    cargar()
  }

  async function quitarMarca(c: Cliente) {
    if (!(await confirmar(`¿Quitar la marca de comisión pagada de ${c.nombre || c.email}? Vuelve a salir como pendiente.`, { boton: 'Quitar la marca' })))
      return
    setGuardando(true)
    const r = await quitarComision(org.id, c.email, accessToken)
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    toast.success('Vuelve a estar pendiente')
    setEditando(null)
    cargar()
  }

  async function marcarTodas(r: ComisionesCloser) {
    const ok = await confirmar(
      `¿Marcar como pagadas las ${r.pendientes} comisiones pendientes de ${r.closer}? Se apunta en cada una lo que le toca (≈ ${euros(r.pendiente_cents)} en total). Se puede cambiar o quitar una a una.`,
      { boton: 'Marcar pagadas' }
    )
    if (!ok) return
    setGuardando(true)
    const res = await marcarComisiones(org.id, r.emails, accessToken)
    setGuardando(false)
    if (!res.ok) {
      toast.error(res.error || 'No se ha podido guardar')
      return
    }
    toast.success(`${res.datos?.marcadas ?? r.pendientes} marcadas como pagadas`)
    cargar()
  }

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={24} />}
      </div>
    )
  }

  const sinEntrar = datos.clientes.filter((c) => actividad(c).tono !== 'verde').length
  const comisiones = datos.comisiones ?? []
  const nPendientes = datos.clientes.filter((c) => c.comision && !c.comision.pagada && c.comision.con_llamada).length
  const nPagadas = datos.clientes.filter((c) => c.comision?.pagada).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Cifra label="Clientes" valor={String(datos.n)} />
        <Cifra label="Cobrado" valor={euros(datos.total_cents)} />
        <Cifra label="Ticket medio" valor={datos.n ? euros(Math.round(datos.total_cents / datos.n)) : '—'} />
        <Cifra label="Sin entrar esta semana" valor={String(sinEntrar)} nota="Los que conviene escribir" />
      </div>

      {/* Quien pagó una señal y aún no ha completado: lo que falta por cobrar. */}
      <PlazasReservadas onAbrir={setAbierta} vuelta={abierta ? 1 : 0} />

      {/* Comisión del closer (27/10): lo pendiente por closer. Solo administradores. */}
      {comisiones.length ? (
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <HandCoins size={16} className="text-[#025dc7]" />
            <p className="text-[14px] font-semibold text-gray-900">Comisión del closer</p>
            <span className="text-[12px] text-[#6B7280]">· solo lo ves tú</span>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {comisiones.map((r) => (
              <div key={r.closer} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[13.5px] font-medium text-gray-900">{r.closer}</p>
                  <p className="text-[12.5px] text-[#6B7280] tabular-nums">
                    {r.pendientes ? (
                      <span className="text-[#B45309] font-medium">
                        {r.pendientes} pendiente{r.pendientes === 1 ? '' : 's'} · ≈ {euros(r.pendiente_cents)}
                      </span>
                    ) : (
                      'Nada pendiente'
                    )}
                    {r.pagadas ? ` · pagado ${euros(r.pagado_cents)} (${r.pagadas})` : ''}
                  </p>
                </div>
                {r.pendientes ? (
                  <button onClick={() => marcarTodas(r)} disabled={guardando} className={BOTON}>
                    Marcar {r.pendientes === 1 ? 'la pendiente' : `las ${r.pendientes}`} como pagada{r.pendientes === 1 ? '' : 's'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 pt-1 text-[11.5px] text-[#9CA3AF]">
            «≈» es su % (Visión → Ajustes) sobre lo cobrado, sin restar Klarna ni devoluciones. Al marcar una venta puedes apuntar lo que le pagaste de verdad.
          </p>
        </div>
      ) : null}

      {comisiones.length ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['todas', 'Todas las ventas'],
              ['pendiente', `Comisión pendiente · ${nPendientes}`],
              ['pagada', `Comisión pagada · ${nPagadas}`],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              onClick={() => setVerComision(id)}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                verComision === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#E5E7EB] bg-white text-gray-700 hover:bg-[#F9FAFB]'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      ) : null}

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
            const com = c.comision
            return (
              <div key={c.email}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setAbierta(c.email)}
                onKeyDown={(e) => e.key === 'Enter' && setAbierta(c.email)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors cursor-pointer"
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
                    {/* Paga en 3 plazos (14/10): cuántos lleva, en rojo si uno no entró. */}
                    {c.plazos ? (
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                          c.plazos.estado === 'fallido' || c.plazos.estado === 'cancelado'
                            ? 'bg-[#FEF2F2] text-[#B91C1C]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                        title={c.plazos.fallo || undefined}
                      >
                        Plazos {c.plazos.cuotas_pagadas} de {c.plazos.cuotas}
                        {c.plazos.estado === 'fallido' ? ' · cobro fallido' : c.plazos.estado === 'cancelado' ? ' · sin completar' : ''}
                      </span>
                    ) : null}
                    {c.avance ? (
                      <span className="rounded-full px-2 py-0.5 font-semibold bg-[#F3F4F6] text-[#6B7280] tabular-nums">
                        {c.avance.hechas} de {c.avance.total} clases · {c.avance.pct} %
                      </span>
                    ) : null}
                    {/* La comisión del closer (27/10): se toca aquí, sin abrir la ficha. */}
                    {com ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirComision(c)
                        }}
                        className={`rounded-full px-2 py-0.5 font-semibold tabular-nums border ${
                          com.pagada
                            ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
                            : com.con_llamada
                              ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                              : 'border-[#E5E7EB] bg-white text-[#9CA3AF]'
                        }`}
                        title={com.closer ? `Closer: ${com.closer}` : undefined}
                      >
                        {com.pagada
                          ? `Comisión pagada${com.pagada.importe_cents ? ` · ${euros(com.pagada.importe_cents)}` : ''} · ${fechaCorta(com.pagada.cuando)}`
                          : com.con_llamada
                            ? `Comisión pendiente · ≈ ${euros(com.estimada_cents)}`
                            : 'Sin llamada · sin comisión'}
                      </button>
                    ) : null}
                  </div>
                  {c.avance?.ultima ? (
                    <p className="mt-1 text-[12px] text-[#6B7280] truncate">
                      Va por {c.avance.ultima.modulo} · {c.avance.ultima.clase}
                    </p>
                  ) : c.avance ? (
                    <p className="mt-1 text-[12px] text-[#9CA3AF] truncate">Todavía no ha terminado ninguna clase</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold tabular-nums text-[#1D0084]">{euros(c.total_cents)}</p>
                  {c.plazos && c.plazos.pendiente_cents > 0 ? (
                    <p className="text-[11.5px] text-[#9CA3AF] tabular-nums">de {euros(c.plazos.total_cents)}</p>
                  ) : null}
                  <p className="text-[11.5px] text-[#9CA3AF]">
                    {c.pagos > 1 ? `${c.pagos} pagos · ` : ''}
                    {fechaCorta(c.ultimo_pago)}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[#B9C6DC]" />
              </div>
              {editando === c.email && com ? (
                <div className="px-4 pb-3.5 -mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                  {com.pagada ? (
                    <span className="text-[#6B7280] w-full">
                      Pagada el {fechaCorta(com.pagada.cuando)}
                      {com.pagada.por ? ` · la marcó ${com.pagada.por.split(/\s+/)[0]}` : ''}
                      {com.closer ? ` · closer: ${com.closer}` : ''}
                    </span>
                  ) : (
                    <span className="text-[#6B7280] w-full">
                      ¿Cuánto le pagaste{com.closer ? ` a ${com.closer.split(/\s+/)[0]}` : ' al closer'}? Le toca ≈ {euros(com.estimada_cents)}.
                    </span>
                  )}
                  <div className="relative">
                    <input
                      value={importe}
                      onChange={(e) => setImporte(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-28 rounded-md border border-[#D1D5DB] pl-2.5 pr-6 py-1.5 text-[13.5px] text-gray-900 tabular-nums outline-none focus:border-gray-900"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]">€</span>
                  </div>
                  <button onClick={() => guardarComision(c)} disabled={guardando} className={BOTON_PRINCIPAL}>
                    {guardando ? <Loader2 size={13} className="animate-spin" /> : null} {com.pagada ? 'Guardar importe' : 'Marcar pagada'}
                  </button>
                  {com.pagada ? (
                    <button onClick={() => quitarMarca(c)} disabled={guardando} className={BOTON}>
                      Quitar la marca
                    </button>
                  ) : null}
                  <button onClick={() => setEditando(null)} className="text-[13px] font-medium text-[#6B7280] hover:text-gray-900 px-1">
                    Cancelar
                  </button>
                </div>
              ) : null}
              </div>
            )
          })}
        </div>
      )}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
