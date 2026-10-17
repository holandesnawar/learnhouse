'use client'

/**
 * Piezas compartidas de las pantallas de Visión: leer y escribir euros, de
 * dónde sale cada número, una cifra con su semáforo y el gráfico semanal.
 */

import React, { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COLOR_SEMAFORO, euros, fechaCorta, type Fuente, type Semaforo, type Semana } from '@services/vision/vision'
import { filtro } from '../Panel/ui'

/** "1.234,50" o "12.5" → céntimos. Vacío o raro → null. */
export function aCents(texto: string): number | null {
  const t = String(texto ?? '').replace(/[€\s]/g, '')
  if (!t) return null
  const limpio = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** Céntimos → texto para un campo ("12,50"; sin decimales si son ,00). */
export function deCents(c: number | null | undefined): string {
  if (c === null || c === undefined) return ''
  return c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)

export const FUENTE: Record<string, string> = {
  'a-mano': 'apuntado a mano',
  escuela: 'de la escuela',
  anuncios: 'de Panel → Anuncios',
  'escuela+a-mano': 'escuela + a mano',
}

export function textoFuente(f: Fuente | undefined) {
  return (f && FUENTE[f]) || 'sin datos'
}

export const CAMPO =
  'w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13.5px] text-gray-900 outline-none focus:border-gray-900 placeholder:text-[#9CA3AF]'
export const ROTULO = 'block text-[12px] font-medium text-[#6B7280] mb-1'

/** Una cifra grande con su rótulo y, si lo lleva, el punto del semáforo. */
export function Cifra({
  rotulo,
  valor,
  semaforo,
  pie,
  fuerte = false,
}: {
  rotulo: string
  valor: string
  semaforo?: Semaforo
  pie?: React.ReactNode
  fuerte?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] truncate">{rotulo}</p>
      <p className={`mt-0.5 flex items-center gap-2 font-semibold tabular-nums text-gray-900 ${fuerte ? 'text-[26px]' : 'text-[19px]'}`}>
        {semaforo ? <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR_SEMAFORO[semaforo] }} /> : null}
        <span className="truncate">{valor}</span>
      </p>
      {pie ? <p className="text-[12px] text-[#9CA3AF] truncate">{pie}</p> : null}
    </div>
  )
}

/** Gasto contra cobrado, o personas (leads, agendadas, ventas), por semana. */
export function GraficoSemanas({ semanas, alto = 240 }: { semanas: Semana[]; alto?: number }) {
  const [vista, setVista] = useState<'dinero' | 'personas'>('dinero')
  if (!semanas.length) return <p className="text-[13px] text-[#9CA3AF] py-8 text-center">Todavía no hay semanas con datos.</p>
  const filas = semanas.map((s) => ({
    semana: fechaCorta(s.semana),
    Gasto: Math.round(((s.gasto_ads_cents ?? 0) + (s.otros_gastos_cents ?? 0)) / 100),
    Cobrado: Math.round((s.ingresos_cents ?? 0) / 100),
    Leads: s.leads ?? 0,
    Agendadas: s.agendadas ?? 0,
    Ventas: s.ventas ?? 0,
  }))
  const ejes = { fontSize: 11, fill: '#9CA3AF' }
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        <button onClick={() => setVista('dinero')} className={filtro(vista === 'dinero')}>
          Dinero
        </button>
        <button onClick={() => setVista('personas')} className={filtro(vista === 'personas')}>
          Personas
        </button>
      </div>
      <ResponsiveContainer width="100%" height={alto}>
        <ComposedChart data={filas} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="semana" tick={ejes} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
          <YAxis tick={ejes} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
          <Tooltip
            cursor={{ fill: '#F9FAFB' }}
            contentStyle={{ borderRadius: 6, border: '1px solid #E5E7EB', boxShadow: 'none', fontSize: 12 }}
            formatter={(v: any, nombre: any) => (vista === 'dinero' ? [euros(Number(v) * 100), nombre] : [v, nombre])}
            labelFormatter={(l: any) => `Semana del ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {vista === 'dinero' ? (
            <>
              <Bar isAnimationActive={false} dataKey="Gasto" fill="#C7CDD6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar isAnimationActive={false} dataKey="Cobrado" fill="#025dc7" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </>
          ) : (
            <>
              <Bar isAnimationActive={false} dataKey="Leads" fill="#C7CDD6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line isAnimationActive={false} dataKey="Agendadas" stroke="#025dc7" strokeWidth={2} dot={{ r: 3 }} />
              <Line isAnimationActive={false} dataKey="Ventas" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
