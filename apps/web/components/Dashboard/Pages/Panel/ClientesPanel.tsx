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
 * Sobre el TOTAL de la venta (con plazos, el del plan), y al marcarla se
 * elige el % (10 o 15) y el importe se ajusta solo (lib/nawar/comision.ts).
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
import FichaCliente from './Ficha'
import PlazasReservadas from './PlazasReservadas'
import { BOTON, BOTON_PRINCIPAL, BOTON_TEXTO, Cifra, Estado, filtro, Seccion, SUB, TABLA, TD, TD_NUM, TH, TH_NUM, Tira, type Tono } from './ui'
import { useEquipo } from './Tareas'
import { colorCloser } from '@/lib/nawar/colorCloser'
import { confirmar } from '@lib/nawar/confirmar'
import { aCaja, comisionCents, leerEuros, pctQueCuadra, textoPct } from '@lib/nawar/comision'
import ComisionPct from './ComisionPct'
import toast from 'react-hot-toast'
import { Loader2, Search } from 'lucide-react'

/** Cómo paga, en dos líneas: «3 plazos» + «pago 1 de 3 · próximo 20 dic». */
function formaDePago(c: Cliente): { texto: string; detalle: string; aviso: boolean } {
  const p = c.plazos
  if (!p) return { texto: c.pagos > 1 ? `${c.pagos} pagos` : 'Un pago', detalle: '', aviso: false }
  const texto = `${p.cuotas} plazos`
  if (p.estado === 'fallido') return { texto, detalle: `cobro fallido · pago ${Math.min(p.cuotas_pagadas + 1, p.cuotas)} de ${p.cuotas}`, aviso: true }
  if (p.estado === 'cancelado') return { texto, detalle: `sin completar · pagó ${p.cuotas_pagadas} de ${p.cuotas}`, aviso: true }
  if (p.cuotas_pagadas >= p.cuotas) return { texto, detalle: 'pagado entero', aviso: false }
  return {
    texto,
    detalle: `pago ${p.cuotas_pagadas} de ${p.cuotas}${p.proximo_cobro ? ` · próximo ${fechaCorta(p.proximo_cobro)}` : ''}`,
    aviso: false,
  }
}

/** "Entró hoy", "hace 5 días", o que no ha entrado nunca. */
function actividad(c: Cliente): { texto: string; tono: Tono } {
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
  const [datos, setDatos] = useState<{
    clientes: Cliente[]
    total_cents: number
    vendido_cents?: number
    cobrado_cents?: number
    por_cobrar_cents?: number
    n: number
    comisiones?: ComisionesCloser[]
    porcentajes_comision?: number[]
  } | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  // Comisión del closer: qué ventas se ven y cuál se está marcando.
  const [verComision, setVerComision] = useState<'todas' | 'pendiente' | 'pagada'>('todas')
  const [editando, setEditando] = useState<string | null>(null)
  const [importe, setImporte] = useState('')
  const [guardando, setGuardando] = useState(false)
  const equipo = useEquipo()

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
    setImporte(aCaja(c.comision?.pagada?.importe_cents || c.comision?.estimada_cents || 0))
    setEditando(c.email)
  }

  async function guardarComision(c: Cliente) {
    const cents = leerEuros(importe)
    if (cents === null) {
      toast.error('Escribe un importe válido, por ejemplo 65,25')
      return
    }
    setGuardando(true)
    const base = c.comision?.base_cents ?? 0
    const lista = datos?.porcentajes_comision?.length ? datos.porcentajes_comision : [10, 15, 18]
    const r = await marcarComision(org.id, c.email, cents, accessToken, pctQueCuadra(base, cents, lista))
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
  const cobradoTotal = datos.cobrado_cents ?? datos.total_cents
  const vendidoTotal = datos.vendido_cents ?? datos.total_cents
  const porCobrarTotal = datos.por_cobrar_cents ?? Math.max(0, vendidoTotal - cobradoTotal)
  const comisiones = datos.comisiones ?? []
  const nPendientes = datos.clientes.filter((c) => c.comision && !c.comision.pagada && c.comision.con_llamada).length
  const nPagadas = datos.clientes.filter((c) => c.comision?.pagada).length
  // Los % que se pueden elegir al marcar (los de Visión → Ajustes: 10 y 15).
  const pcts = datos.porcentajes_comision?.length ? datos.porcentajes_comision : [10, 15, 18]

  /** El punto de color del closer: el mismo que su etiqueta en el tablero. */
  const colorDe = (nombre: string) => {
    const m = (equipo?.equipo ?? []).find((x) => x.nombre === nombre)
    return colorCloser(m?.id ?? 0, equipo?.equipo ?? [], nombre)
  }

  /** La comisión de una venta, en texto con su punto (nada de pastillas). */
  function comisionDe(c: Cliente, pctPagada: number | null): { tono: Tono; texto: string; detalle: string } | null {
    const com = c.comision
    if (!com) return null
    if (com.pagada)
      return {
        tono: 'verde',
        texto: `Pagada${com.pagada.importe_cents ? ` · ${euros(com.pagada.importe_cents)}` : ''}`,
        detalle: `${pctPagada !== null ? `${textoPct(pctPagada)} · ` : ''}${fechaCorta(com.pagada.cuando)}`,
      }
    if (com.con_llamada)
      return {
        tono: 'ambar',
        texto: `Pendiente · ≈ ${euros(com.estimada_cents)}`,
        detalle: com.pct ? `${textoPct(com.pct)}${com.pct_elegido ? ' · a mano' : ''}` : '',
      }
    return { tono: 'gris', texto: 'Sin llamada', detalle: 'sin comisión' }
  }

  function cajaComision(c: Cliente, base: number, pctEnCaja: number | null) {
    const com = c.comision
    if (!com) return null
    return (
      <div className="flex flex-wrap items-center gap-2 text-[13px] rounded-[10px] border border-[#E6E8EE] bg-[#F7F8FA] px-4 py-3">
        <span className="text-[#4B5565] w-full">
          {com.pagada ? (
            <>
              Pagada el {fechaCorta(com.pagada.cuando)}
              {com.pagada.por ? ` · la marcó ${com.pagada.por.split(/\s+/)[0]}` : ''}
              {com.closer ? ` · closer: ${com.closer}` : ''}
            </>
          ) : (
            <>¿Cuánto le pagaste{com.closer ? ` a ${com.closer.split(/\s+/)[0]}` : ' al closer'}?</>
          )}{' '}
          Sobre el total de la venta: <span className="font-semibold text-[#0B1020] tabular-nums">{euros(base)}</span>
          {c.plazos && base > c.total_cents ? ` · a plazos, cobrado ${euros(c.total_cents)} hasta hoy` : ''}
        </span>
        {/* El % de ESTA venta (24/11/2026): se guarda al tocarlo y lo
            pendiente se recalcula. Solo mientras no esté pagada. */}
        {!com.pagada ? (
          <div className="w-full">
            <ComisionPct
              email={c.email}
              com={com}
              pcts={pcts}
              onCambio={(p) => {
                setImporte(aCaja(comisionCents(base, p)))
                cargar()
              }}
            />
          </div>
        ) : null}
        {/* Ya pagada: elegir el % ajusta el importe solo; también se puede
            escribir a mano. Sin pagar, ya lo hace la fila de arriba. */}
        <div className={`flex items-center gap-1 ${com.pagada ? '' : 'hidden'}`}>
          {pcts.map((p) => (
            <button key={p} onClick={() => setImporte(aCaja(comisionCents(base, p)))} className={`${filtro(pctEnCaja === p)} tabular-nums`}>
              {textoPct(p)}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-28 h-8 rounded-lg border border-[#E6E8EE] bg-white pl-2.5 pr-6 text-[13.5px] text-[#0B1020] tabular-nums outline-none focus:border-[#0B1020]"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A93A3]">€</span>
        </div>
        <button onClick={() => guardarComision(c)} disabled={guardando} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={13} className="animate-spin" /> : null} {com.pagada ? 'Guardar importe' : 'Marcar pagada'}
        </button>
        {com.pagada ? (
          <button onClick={() => quitarMarca(c)} disabled={guardando} className={BOTON}>
            Quitar la marca
          </button>
        ) : null}
        <button onClick={() => setEditando(null)} className={BOTON_TEXTO}>
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-9">
      {/* Vendido ≠ cobrado (22/11): una venta a plazos vale el total del plan
          aunque hasta hoy solo haya entrado una parte. */}
      <Tira>
        <Cifra rotulo="Vendido" valor={euros(vendidoTotal)} nota={`${datos.n} ${datos.n === 1 ? 'cliente' : 'clientes'}`} />
        <Cifra rotulo="Cobrado" valor={euros(cobradoTotal)} nota="lo que ya ha entrado" />
        <Cifra rotulo="Por cobrar" valor={porCobrarTotal > 0 ? euros(porCobrarTotal) : '—'} nota={porCobrarTotal > 0 ? 'plazos que faltan' : 'todo cobrado'} />
        <Cifra rotulo="Ticket medio" valor={datos.n ? euros(Math.round(vendidoTotal / datos.n)) : '—'} nota="sobre lo vendido" />
        <Cifra rotulo="Sin entrar esta semana" valor={sinEntrar} sufijo={`de ${datos.n}`} nota="los que conviene escribir" />
      </Tira>

      {/* Quien pagó una señal y aún no ha completado: lo que falta por cobrar. */}
      <PlazasReservadas onAbrir={setAbierta} vuelta={abierta ? 1 : 0} />

      {/* Comisión del closer (27/10): lo pendiente por closer. Solo administradores. */}
      {comisiones.length ? (
        <Seccion titulo="Comisión del closer" nota="Solo lo ves tú.">
          <div className="border-t border-[#E6E8EE]">
            {comisiones.map((r) => (
              <div key={r.closer} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#F0F1F5]">
                <div className="flex-1 min-w-[200px]">
                  <Estado color={colorDe(r.closer)} className="!text-[14px] !text-[#0B1020]">
                    {r.closer}
                  </Estado>
                  <p className="text-[12.5px] text-[#8A93A3] tabular-nums">
                    {r.pendientes ? (
                      <span className="text-[#9A6B12] font-medium">
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
          <p className="text-[12.5px] text-[#8A93A3] max-w-[860px]">
            «≈» es su % sobre el total de la venta (a plazos, el total del plan aunque falten pagos), sin restar Klarna ni devoluciones. El % es el de Visión →
            Ajustes, salvo que en esa venta pongas otro (18 % si la seteó el closer): toca la comisión de la venta y elige el %. Al marcarla pagada eliges el % o
            escribes lo que le pagaste de verdad.
          </p>
        </Seccion>
      ) : null}

      <Seccion titulo="Clientes" nota="El último pago, arriba. Toca una fila para abrir su ficha.">
        <div className="flex flex-wrap items-center gap-2">
          {comisiones.length
            ? (
                [
                  ['todas', 'Todas las ventas'],
                  ['pendiente', `Comisión pendiente · ${nPendientes}`],
                  ['pagada', `Comisión pagada · ${nPagadas}`],
                ] as const
              ).map(([id, texto]) => (
                <button key={id} onClick={() => setVerComision(id)} className={filtro(verComision === id)}>
                  {texto}
                </button>
              ))
            : null}
          <div className="relative flex-1 min-w-[220px] sm:max-w-[340px] sm:ml-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A3]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, correo o teléfono"
              className="w-full h-8 bg-white border border-[#E6E8EE] rounded-lg pl-9 pr-3 text-[13.5px] text-[#0B1020] placeholder:text-[#8A93A3] outline-none focus:border-[#0B1020]"
            />
          </div>
        </div>

        {!lista.length ? (
          <p className="text-[13.5px] text-[#8A93A3] py-10 text-center border-t border-[#E6E8EE]">
            {datos.clientes.length ? 'Nadie con ese filtro.' : 'Todavía no hay clientes.'}
          </p>
        ) : (
          <>
            {/* Ordenador: tabla limpia. */}
            <table className={`${TABLA} hidden lg:table`}>
              <thead>
                <tr>
                  <th className={TH}>Persona</th>
                  <th className={TH}>Forma de pago</th>
                  <th className={TH}>Closer</th>
                  <th className={TH_NUM}>Vendido</th>
                  <th className={TH_NUM}>Cobrado</th>
                  <th className={`${TH} pl-6`}>Comisión</th>
                  <th className={TH}>En la escuela</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const a = actividad(c)
                  const com = c.comision
                  const base = com?.base_cents || c.total_cents
                  const vendido = c.vendido_cents ?? c.total_cents
                  const pago = formaDePago(c)
                  const pctPagada = com?.pagada ? pctQueCuadra(base, com.pagada.importe_cents, pcts) : null
                  const enCaja = editando === c.email ? leerEuros(importe) : null
                  const pctEnCaja = enCaja !== null ? pctQueCuadra(base, enCaja, pcts) : null
                  const cd = comisionDe(c, pctPagada)
                  return (
                    <React.Fragment key={c.email}>
                      <tr onClick={() => setAbierta(c.email)} className="cursor-pointer hover:bg-[#F7F8FA]">
                        <td className={`${TD} max-w-[260px]`}>
                          <span className="block truncate">{c.nombre || c.email}</span>
                          <span className={`${SUB} truncate`}>
                            {c.email}
                            {c.telefono ? ` · ${c.telefono}` : ''}
                          </span>
                        </td>
                        <td className={TD}>
                          {pago.texto}
                          <span className={SUB} style={pago.aviso ? { color: '#C8322B' } : undefined} title={c.plazos?.fallo || undefined}>
                            {pago.detalle || fechaCorta(c.ultimo_pago)}
                          </span>
                        </td>
                        <td className={TD}>
                          {com?.closer ? <Estado color={colorDe(com.closer)}>{com.closer.split(/\s+/)[0]}</Estado> : <span className="text-[13px] text-[#B4BAC6]">—</span>}
                        </td>
                        <td className={`${TD_NUM} font-semibold`}>{euros(vendido)}</td>
                        <td className={TD_NUM}>
                          {euros(c.total_cents)}
                          <span className={SUB}>{fechaCorta(c.ultimo_pago)}</span>
                        </td>
                        <td className={`${TD} pl-6`}>
                          {cd ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirComision(c)
                              }}
                              className="text-left rounded hover:opacity-70"
                              title={com?.closer ? `Closer: ${com.closer}. Toca para marcarla o cambiarla.` : 'Toca para marcarla'}
                            >
                              <Estado tono={cd.tono}>{cd.texto}</Estado>
                              {cd.detalle ? <span className={`${SUB} pl-[13px]`}>{cd.detalle}</span> : null}
                            </button>
                          ) : (
                            <span className="text-[13px] text-[#B4BAC6]">—</span>
                          )}
                        </td>
                        <td className={`${TD} max-w-[230px]`}>
                          <Estado tono={a.tono}>{a.texto}</Estado>
                          {c.avance ? (
                            <span className={`${SUB} pl-[13px] truncate`}>
                              {c.avance.hechas} de {c.avance.total} clases · {c.avance.pct} %
                            </span>
                          ) : null}
                        </td>
                      </tr>
                      {editando === c.email && com ? (
                        <tr>
                          <td colSpan={7} className="pb-3 pt-1 border-b border-[#F0F1F5]">
                            {cajaComision(c, base, pctEnCaja)}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* Móvil y tableta: cada cliente, apilado. */}
            <div className="lg:hidden border-t border-[#E6E8EE]">
              {lista.map((c) => {
                const a = actividad(c)
                const com = c.comision
                const base = com?.base_cents || c.total_cents
                const vendido = c.vendido_cents ?? c.total_cents
                const pago = formaDePago(c)
                const pctPagada = com?.pagada ? pctQueCuadra(base, com.pagada.importe_cents, pcts) : null
                const enCaja = editando === c.email ? leerEuros(importe) : null
                const pctEnCaja = enCaja !== null ? pctQueCuadra(base, enCaja, pcts) : null
                const cd = comisionDe(c, pctPagada)
                return (
                  <div key={c.email} className="border-b border-[#F0F1F5] py-3">
                    <div role="button" tabIndex={0} onClick={() => setAbierta(c.email)} onKeyDown={(e) => e.key === 'Enter' && setAbierta(c.email)} className="flex items-start gap-3 cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] text-[#0B1020] truncate">{c.nombre || c.email}</p>
                        <p className="text-[12.5px] text-[#8A93A3] truncate" style={pago.aviso ? { color: '#C8322B' } : undefined}>
                          {[pago.texto, pago.detalle, com?.closer ? com.closer.split(/\s+/)[0] : ''].filter(Boolean).join(' · ')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          <Estado tono={a.tono}>
                            {a.texto}
                            {c.avance ? ` · ${c.avance.pct} %` : ''}
                          </Estado>
                          {cd ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirComision(c)
                              }}
                            >
                              <Estado tono={cd.tono}>Comisión: {cd.texto.toLowerCase()}</Estado>
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[14px] font-semibold tabular-nums text-[#0B1020]">{euros(vendido)}</p>
                        <p className="text-[12.5px] text-[#8A93A3] tabular-nums">
                          {vendido !== c.total_cents ? `cobrado ${euros(c.total_cents)}` : fechaCorta(c.ultimo_pago)}
                        </p>
                      </div>
                    </div>
                    {editando === c.email && com ? <div className="mt-2.5">{cajaComision(c, base, pctEnCaja)}</div> : null}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Seccion>

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
