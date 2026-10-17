'use client'

/**
 * Los ajustes de Visión: precio, plazos, comisión del closer por tramos de
 * fecha, Klarna, el profe de la clase semanal y los umbrales del semáforo.
 * Se guardan en la configuración de la escuela (org_config `vision_ajustes`).
 */

import React, { useEffect, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAjustes, guardarAjustes, type Ajustes, type MetricaInfo } from '@services/vision/vision'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA, Seccion } from '../Panel/ui'
import { CAMPO, ROTULO, aCents, deCents } from './piezas'

type Texto = {
  precio: string
  cuotas: string
  cuota: string
  closer: { desde: string; pct: string }[]
  klarna_pct: string
  klarna_fijo: string
  profe: string
  profe_desde: string
  umbrales: Record<string, { verde: string; rojo: string }>
}

const coma = (n: number) => String(n).replace('.', ',')
const numero = (t: string) => Number(String(t).replace(',', '.'))

function aTexto(a: Ajustes): Texto {
  return {
    precio: deCents(a.precio_cents),
    cuotas: String(a.plazos.cuotas),
    cuota: deCents(a.plazos.cuota_cents),
    closer: a.closer.map((t) => ({ desde: t.desde, pct: coma(t.pct) })),
    klarna_pct: coma(a.klarna_pct),
    klarna_fijo: deCents(a.klarna_fijo_cents),
    profe: deCents(a.profe_semanal_cents),
    profe_desde: a.profe_desde,
    umbrales: Object.fromEntries(Object.entries(a.umbrales).map(([k, u]) => [k, { verde: coma(u.verde), rojo: coma(u.rojo) }])),
  }
}

function deTexto(t: Texto): Ajustes {
  return {
    precio_cents: aCents(t.precio) ?? 0,
    plazos: { cuotas: Math.max(1, Math.round(numero(t.cuotas) || 1)), cuota_cents: aCents(t.cuota) ?? 0 },
    closer: t.closer.filter((x) => x.pct.trim() !== '').map((x) => ({ desde: x.desde, pct: numero(x.pct) || 0 })),
    klarna_pct: numero(t.klarna_pct) || 0,
    klarna_fijo_cents: aCents(t.klarna_fijo) ?? 0,
    profe_semanal_cents: aCents(t.profe) ?? 0,
    profe_desde: t.profe_desde,
    umbrales: Object.fromEntries(Object.entries(t.umbrales).map(([k, u]) => [k, { verde: numero(u.verde) || 0, rojo: numero(u.rojo) || 0 }])),
  }
}

const UNIDAD: Record<string, string> = { eur: '€', pct: '%', x: '×', n: '' }

export default function AjustesVision({ orgId, token, onGuardado }: { orgId: number; token: string; onGuardado: () => void }) {
  const [t, setT] = useState<Texto | null>(null)
  const [fabrica, setFabrica] = useState<Ajustes | null>(null)
  const [metricas, setMetricas] = useState<Record<string, MetricaInfo>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getAjustes(orgId, token).then((r) => {
      if (!r.ok || !r.datos) return toast.error(r.error || 'No se han podido cargar los ajustes')
      setT(aTexto(r.datos.ajustes))
      setFabrica(r.datos.de_fabrica)
      setMetricas(r.datos.metricas)
    })
  }, [orgId, token])

  if (!t) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )
  }

  const campo = (k: keyof Texto) => (e: React.ChangeEvent<HTMLInputElement>) => setT((v) => v && { ...v, [k]: e.target.value })

  async function guardar() {
    if (!t) return
    setGuardando(true)
    const r = await guardarAjustes(orgId, deTexto(t), token)
    setGuardando(false)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se han podido guardar')
    setT(aTexto(r.datos))
    toast.success('Ajustes guardados')
    onGuardado()
  }

  const plazosTotal = (aCents(t.cuota) ?? 0) * (Math.round(numero(t.cuotas)) || 0)

  return (
    <div className="space-y-6 max-w-[860px]">
      <Seccion titulo="Precio">
        <div className={`${TARJETA} p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
          <label>
            <span className={ROTULO}>Precio al contado (€)</span>
            <input inputMode="decimal" value={t.precio} onChange={campo('precio')} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Plazos: número de cuotas</span>
            <input inputMode="numeric" value={t.cuotas} onChange={campo('cuotas')} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Plazos: cada cuota (€)</span>
            <input inputMode="decimal" value={t.cuota} onChange={campo('cuota')} className={CAMPO} />
          </label>
          <p className={`${META} col-span-2 sm:col-span-3`}>
            En plazos se paga {deCents(plazosTotal)} € en total. El precio solo se usa para estimar el CAC máximo de una campaña que aún no
            ha vendido: las ventas de verdad cuentan con lo que se cobró.
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Comisión del closer">
        <div className={`${TARJETA} p-4 sm:p-5 space-y-3`}>
          <p className={META}>
            Un % de cada venta que pasó por llamada, después de devoluciones y Klarna. Cada venta usa el tramo del día en que se cobró.
          </p>
          {t.closer.map((x, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="w-[170px]">
                <span className={ROTULO}>Desde</span>
                <input
                  type="date"
                  value={x.desde}
                  onChange={(e) => setT((v) => v && { ...v, closer: v.closer.map((y, j) => (j === i ? { ...y, desde: e.target.value } : y)) })}
                  className={CAMPO}
                />
              </label>
              <label className="w-[110px]">
                <span className={ROTULO}>%</span>
                <input
                  inputMode="decimal"
                  value={x.pct}
                  onChange={(e) => setT((v) => v && { ...v, closer: v.closer.map((y, j) => (j === i ? { ...y, pct: e.target.value } : y)) })}
                  className={CAMPO}
                />
              </label>
              <span className={`${META} pb-2 hidden sm:inline`}>{x.desde ? '' : 'sin fecha = desde siempre'}</span>
              <button
                onClick={() => setT((v) => v && { ...v, closer: v.closer.filter((_, j) => j !== i) })}
                className="mb-0.5 p-2 rounded-md text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
                aria-label="Quitar tramo"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button onClick={() => setT((v) => v && { ...v, closer: [...v.closer, { desde: new Date().toISOString().slice(0, 10), pct: '' }] })} className={BOTON}>
            <Plus size={14} /> Añadir tramo
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Klarna y profe">
        <div className={`${TARJETA} p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3`}>
          <label>
            <span className={ROTULO}>Klarna se queda (%)</span>
            <input inputMode="decimal" value={t.klarna_pct} onChange={campo('klarna_pct')} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Klarna, fijo por venta (€)</span>
            <input inputMode="decimal" value={t.klarna_fijo} onChange={campo('klarna_fijo')} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Profe clase semanal (€/semana)</span>
            <input inputMode="decimal" value={t.profe} onChange={campo('profe')} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Se le paga desde</span>
            <input type="date" value={t.profe_desde} onChange={campo('profe_desde')} className={CAMPO} />
          </label>
          <p className={`${META} col-span-2 sm:col-span-4`}>
            La comisión de Klarna sale en Stripe, en el detalle de cada pago hecho con Klarna. El profe de la clase semanal solo cuenta en el
            total del negocio, no en las campañas. Sin fecha, se cuenta desde el inicio de la convocatoria.
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Semáforo">
        <div className={`${TARJETA} overflow-x-auto`}>
          <table className="w-full text-[13px] min-w-[520px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-[#9CA3AF] border-b border-[#F3F4F6]">
                <th className="font-semibold py-2 pl-4 pr-3">Métrica</th>
                <th className="font-semibold py-2 pr-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5 align-middle" />
                  Verde
                </th>
                <th className="font-semibold py-2 pr-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#DC2626] mr-1.5 align-middle" />
                  Rojo
                </th>
                <th className="font-semibold py-2 pr-4">Cómo se lee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {Object.entries(t.umbrales).map(([clave, u]) => {
                const m = metricas[clave]
                const unidad = UNIDAD[m?.unidad ?? 'n']
                const def = fabrica?.umbrales[clave]
                const poner = (lado: 'verde' | 'rojo') => (e: React.ChangeEvent<HTMLInputElement>) =>
                  setT((v) => v && { ...v, umbrales: { ...v.umbrales, [clave]: { ...v.umbrales[clave], [lado]: e.target.value } } })
                return (
                  <tr key={clave}>
                    <td className="py-2 pl-4 pr-3 font-medium text-gray-900 whitespace-nowrap">{m?.nombre ?? clave}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <input inputMode="decimal" value={u.verde} onChange={poner('verde')} className={`${CAMPO} w-[90px]`} />
                        <span className="text-[#9CA3AF]">{unidad}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <input inputMode="decimal" value={u.rojo} onChange={poner('rojo')} className={`${CAMPO} w-[90px]`} />
                        <span className="text-[#9CA3AF]">{unidad}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-[12.5px] text-[#6B7280]">
                      {m?.mejor === 'bajo'
                        ? `Verde si es ${u.verde} ${unidad} o menos; rojo si pasa de ${u.rojo} ${unidad}`
                        : `Verde si es ${u.verde} ${unidad} o más; rojo si baja de ${u.rojo} ${unidad}`}
                      {def ? <span className="text-[#C4C9D1]"> · de fábrica {coma(def.verde)} / {coma(def.rojo)}</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Seccion>

      <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 w-fit rounded-lg border border-[#E5E7EB] bg-white p-2">
        <button onClick={guardar} disabled={guardando} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Guardar ajustes
        </button>
        {fabrica ? (
          <button onClick={() => setT(aTexto(fabrica))} className={BOTON}>
            Volver a los de fábrica
          </button>
        ) : null}
      </div>
    </div>
  )
}
