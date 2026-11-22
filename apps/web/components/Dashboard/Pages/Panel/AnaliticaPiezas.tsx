'use client'

/**
 * Las piezas de la Analítica (22/11/2026): la comparación con el periodo de
 * antes, el gráfico día a día con las dos series, el embudo dibujado, el mapa
 * de calor y las tablas con «Descargar CSV». La pantalla que las reparte en
 * pestañas es `AnaliticaPanel.tsx`; el cálculo, el servidor
 * (apps/api/src/services/stats/analitica.py).
 *
 * Gráficos (skill de visualización): una sola escala por gráfico, leyenda
 * cuando hay dos series, la cifra al pasar el ratón y una tabla alternativa.
 * La serie de «antes» va en gris y discontinua: es contexto, no otra
 * categoría. Pago y orgánico, azul y verde (pasan el validador de la paleta).
 */

import React, { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Cifras, FilaCifras, PuntoSerie } from '@services/stats/analitica'
import { euros } from '@services/stats/school'
import { Download } from 'lucide-react'
import { BOTON_TEXTO, Cambio, ENLACE, META, SUB, TABLA, TD, TD_NUM, TH, TH_NUM } from './ui'

export const COLOR_PAGO = '#2F6FED'
export const COLOR_ORGANICO = '#0E8A4F'
const COLOR_SERIE = '#2F6FED'
const COLOR_ANTES = '#A3ABBA'

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)
export const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('es-ES'))
export const coma = (v: number | null | undefined, sufijo = '') => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}${sufijo}`)

export const fecha = (s: string) => {
  if (!s) return ''
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
}

export function duracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return '—'
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return m ? `${m} min ${s} s` : `${s} s`
}

/** Cuánto ha cambiado una cifra respecto al periodo de antes. Con cifras
 * pequeñas (menos de 10 antes) se dice la diferencia, no el %: de 2 a 4 no es
 * «+100 %», son 2 más. */
export function cambioDe(ahora: number | null | undefined, antes: number | null | undefined): { sentido: number; texto: string } | null {
  if (ahora === null || ahora === undefined || antes === null || antes === undefined) return null
  const dif = ahora - antes
  if (!dif) return { sentido: 0, texto: 'igual que antes' }
  if (antes < 10) return { sentido: dif, texto: String(Math.abs(Math.round(dif * 10) / 10)).replace('.', ',') }
  return { sentido: dif, texto: `${Math.abs(Math.round((dif * 100) / antes))} %` }
}

/** «↑ 18 % · antes 661», o nada si no hay con qué comparar. */
export function Antes({
  ahora,
  antes,
  formato = num,
  alReves = false,
  corto = false,
}: {
  ahora: number | null | undefined
  antes: number | null | undefined
  formato?: (v: number) => string
  alReves?: boolean
  corto?: boolean
}) {
  const c = cambioDe(ahora, antes)
  if (!c) return null
  return (
    <>
      <Cambio sentido={c.sentido} alReves={alReves}>
        {c.texto}
      </Cambio>
      {corto || !c.sentido ? null : <span> · antes {formato(antes as number)}</span>}
    </>
  )
}

/** Baja una tabla como CSV (con `;`, que es como lo abre Excel en español). */
export function descargarCSV(nombre: string, cabeceras: string[], filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    // Los números, con coma decimal: así Excel en español los lee como cifras.
    const t = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const texto = [cabeceras, ...filas].map((f) => f.map(celda).join(';')).join('\r\n')
  try {
    const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${nombre}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch {
    /* sin descarga en ese navegador */
  }
}

export function BotonCSV({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${BOTON_TEXTO} !h-7 !px-2 text-[12.5px]`}>
      <Download size={13} /> Descargar CSV
    </button>
  )
}

const euroCorto = (cents: number | null | undefined) => (cents === null || cents === undefined ? '—' : euros(cents))
const euroFino = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/* ───────────────────────── día a día ───────────────────────── */

export const MEDIDAS = [
  { id: 'visitas', label: 'Visitas' },
  { id: 'leads', label: 'Leads' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'ventas', label: 'Ventas' },
] as const
export type Medida = (typeof MEDIDAS)[number]['id']

function Pista({ active, payload, medida }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[#E6E8EE] bg-white px-3 py-2 text-[12.5px] text-[#0B1020]">
      <p className="font-semibold tabular-nums">
        {fecha(d.dia)} · {num(d.actual)} {medida.toLowerCase()}
      </p>
      {d.antes !== null && d.antes !== undefined ? (
        <p className="text-[#8A93A3] tabular-nums">
          {fecha(d.diaAntes)} · {num(d.antes)}
        </p>
      ) : null}
    </div>
  )
}

/** El gráfico de líneas: estos días y, en gris discontinuo, los de antes. */
export function DiaADia({
  serie,
  antes,
  medida,
  sinVisitasAntes,
}: {
  serie: PuntoSerie[]
  antes: PuntoSerie[] | null
  medida: Medida
  /** Si antes no se contaban las visitas, esa serie no se pinta. */
  sinVisitasAntes: boolean
}) {
  const [tabla, setTabla] = useState(false)
  const conAntes = !!antes && !(medida === 'visitas' && sinVisitasAntes)
  const filas = useMemo(
    () =>
      serie.map((d, i) => ({
        dia: d.dia,
        actual: d[medida],
        antes: conAntes && antes?.[i] ? antes[i][medida] : null,
        diaAntes: antes?.[i]?.dia || '',
      })),
    [serie, antes, medida, conAntes],
  )
  const nombre = MEDIDAS.find((m) => m.id === medida)?.label || ''
  const total = filas.reduce((s, f) => s + f.actual, 0)
  const paso = Math.max(1, Math.ceil(filas.length / 8))
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#4B5565]">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block w-3.5 h-0.5 rounded" style={{ background: COLOR_SERIE }} />
            Estos días · {num(total)}
          </span>
          {conAntes ? (
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-3.5 border-t-2 border-dashed" style={{ borderColor: COLOR_ANTES }} />
              Los de antes · {num(filas.reduce((s, f) => s + (f.antes || 0), 0))}
            </span>
          ) : null}
        </div>
        <button type="button" className={`${ENLACE} !text-[12.5px]`} onClick={() => setTabla(!tabla)}>
          {tabla ? 'Ver el gráfico' : 'Ver tabla'}
        </button>
      </div>
      {tabla ? (
        <div className="max-h-[260px] overflow-auto">
          <table className={TABLA}>
            <thead>
              <tr>
                <th className={TH}>Día</th>
                <th className={TH_NUM}>{nombre}</th>
                {conAntes ? <th className={TH_NUM}>Antes</th> : null}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.dia}>
                  <td className={TD}>{fecha(f.dia)}</td>
                  <td className={TD_NUM}>{num(f.actual)}</td>
                  {conAntes ? <td className={`${TD_NUM} text-[#8A93A3]`}>{num(f.antes)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={filas} margin={{ top: 10, right: 22, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#F0F1F5" vertical={false} />
            <XAxis
              dataKey="dia"
              tickFormatter={(d: string) => fecha(d)}
              tick={{ fontSize: 11, fill: '#8A93A3' }}
              tickLine={false}
              axisLine={{ stroke: '#E6E8EE' }}
              interval={paso - 1}
              minTickGap={16}
            />
            <YAxis tick={{ fontSize: 11, fill: '#8A93A3' }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip content={<Pista medida={nombre} />} cursor={{ stroke: '#C5CAD6', strokeWidth: 1 }} />
            {conAntes ? (
              <Line isAnimationActive={false} type="linear" dataKey="antes" stroke={COLOR_ANTES} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
            ) : null}
            <Line
              isAnimationActive={false}
              type="linear"
              dataKey="actual"
              stroke={COLOR_SERIE}
              strokeWidth={2}
              dot={filas.length <= 14 ? { r: 3, fill: COLOR_SERIE, stroke: '#fff', strokeWidth: 2 } : false}
              activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/* ───────────────────────── el embudo ───────────────────────── */

export function pasosDelEmbudo(r: Cifras): { nombre: string; n: number | null; pct: number | null; detalle: string }[] {
  const v = r.visitas
  const sinVenir = r.reservaron - r.vinieron
  return [
    { nombre: 'Visitas', n: v, pct: null, detalle: '' },
    { nombre: 'Dejaron sus datos', n: r.leads, pct: v ? r.pct_lead : null, detalle: v && v > r.leads ? `${num(v - r.leads)} se van sin dejarlos` : '' },
    { nombre: 'Reservaron llamada', n: r.reservaron, pct: r.pct_reserva, detalle: r.leads > r.reservaron ? `${num(r.leads - r.reservaron)} no reservan` : '' },
    {
      nombre: 'Vinieron',
      n: r.vinieron,
      pct: r.pct_vino,
      detalle: r.no_vinieron ? `${num(r.no_vinieron)} no vinieron` : sinVenir > 0 ? `${num(sinVenir)} sin llamada aún` : '',
    },
    { nombre: 'Compraron', n: r.pagaron, pct: r.vinieron ? r.pct_pago_llamada : r.pct_pago, detalle: r.vinieron ? 'de los que vinieron' : 'de los leads' },
  ]
}

/** El embudo en columnas: cada paso con su cifra, el % sobre el anterior y
 * cuántos se quedan por el camino. La altura es la cifra (escala de raíz,
 * para que 14 ventas se vean al lado de 800 visitas; la cifra exacta va
 * escrita debajo y al pasar el ratón). */
export function EmbudoDibujado({ r, color = '#1D0084', claro = '#C9D0F0', compacto = false }: { r: Cifras; color?: string; claro?: string; compacto?: boolean }) {
  const pasos = pasosDelEmbudo(r).filter((p) => p.n !== null)
  const max = Math.max(1, ...pasos.map((p) => p.n || 0))
  const alto = compacto ? 76 : 120
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }}>
      {pasos.map((p, i) => {
        const h = p.n ? Math.max(4, Math.round(Math.sqrt((p.n || 0) / max) * 100)) : 0
        const ultimo = i === pasos.length - 1
        return (
          <div key={p.nombre} className="min-w-0" title={`${p.nombre}: ${num(p.n)}${p.pct !== null ? ` (${pct(p.pct)} del paso anterior)` : ''}`}>
            <div className="flex items-end rounded bg-[#F7F8FA]" style={{ height: alto }}>
              <i className="block w-full rounded-t" style={{ height: `${h}%`, background: ultimo ? color : claro }} />
            </div>
            <div className={`${compacto ? 'text-[15px]' : 'text-[18px]'} font-semibold text-[#0B1020] tabular-nums mt-2.5 leading-none`}>{num(p.n)}</div>
            <div className="text-[13px] text-[#4B5565] mt-1 leading-snug">{p.nombre}</div>
            <div className="text-[12.5px] text-[#8A93A3] mt-0.5 leading-snug min-h-[1.2em]">
              {p.pct !== null ? pct(p.pct) : ''}
              {!compacto && p.detalle ? <span className="hidden sm:inline">{p.pct !== null ? ' · ' : ''}{p.detalle}</span> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── tablas ───────────────────────── */

/** Una tabla de cifras (por fuente, campaña o anuncio). Tocar una fila filtra. */
export function TablaCifras({
  filas,
  primera,
  csv,
  conVisitas = true,
  conGasto = false,
  conPorVisita = false,
  elegido,
  onElegir,
  vacio,
  tope = 12,
  compacta = false,
}: {
  filas: FilaCifras[]
  primera: string
  csv: string
  conVisitas?: boolean
  conGasto?: boolean
  conPorVisita?: boolean
  elegido: string
  onElegir: (v: string) => void
  vacio: string
  tope?: number
  /** Para una columna estrecha: sin «Reservaron» ni «Vinieron». */
  compacta?: boolean
}) {
  const [todas, setTodas] = useState(false)
  const vistas = todas ? filas : filas.slice(0, tope)
  const algunGasto = conGasto && filas.some((f) => f.gasto_cents)
  if (filas.length === 0) return <p className={`${META} py-3`}>{vacio}</p>
  const bajar = () =>
    descargarCSV(
      csv,
      [primera, 'Visitas', 'Leads', 'Visita a lead %', 'Reservaron', 'Vinieron', 'Pagaron', 'Vendido €', 'Cobrado €', 'Gasto €', 'Retorno'],
      filas.map((f) => [
        f.nombre,
        f.visitas ?? '',
        f.leads,
        f.pct_lead ?? '',
        f.reservaron,
        f.vinieron,
        f.pagaron,
        (f.cents / 100).toFixed(2).replace('.', ','),
        ((f.cobrado_cents ?? f.cents) / 100).toFixed(2).replace('.', ','),
        f.gasto_cents ? (f.gasto_cents / 100).toFixed(2).replace('.', ',') : '',
        f.retorno ?? '',
      ]),
    )
  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`${TABLA} ${compacta ? 'min-w-[520px]' : 'min-w-[660px]'}`}>
          <thead>
            <tr>
              <th className={TH}>{primera}</th>
              {conVisitas ? <th className={TH_NUM}>Visitas</th> : null}
              <th className={TH_NUM}>Leads</th>
              {conVisitas ? <th className={TH_NUM}>Visita → lead</th> : null}
              {compacta ? null : <th className={TH_NUM}>Reservaron</th>}
              {compacta ? null : <th className={TH_NUM}>Vinieron</th>}
              <th className={TH_NUM}>{compacta ? 'Ventas' : 'Pagaron'}</th>
              <th className={TH_NUM} title="El total de cada venta; una venta a plazos cuenta entera">
                Vendido
              </th>
              {conPorVisita ? <th className={TH_NUM}>€ por visita</th> : null}
              {algunGasto ? (
                <>
                  <th className={TH_NUM}>Gasto</th>
                  <th className={TH_NUM}>€ / lead</th>
                  <th className={TH_NUM}>Retorno</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {vistas.map((f) => {
              const c = conVisitas ? cambioDe(f.visitas, f.visitas_antes) : null
              return (
                <tr
                  key={f.valor || '-'}
                  onClick={() => onElegir(elegido && (f.valor === elegido || (elegido === '-' && !f.valor)) ? '' : f.valor || '-')}
                  className={`cursor-pointer hover:bg-[#F7F8FA] ${elegido && (f.valor === elegido || (elegido === '-' && !f.valor)) ? 'bg-[#F7F8FA]' : ''}`}
                  title={f.meta && f.meta !== f.nombre ? `En Meta: ${f.meta}` : 'Tocar para filtrar por esta fila'}
                >
                  <td className={`${TD} max-w-[260px]`}>
                    <span className="block truncate font-medium">{f.nombre}</span>
                    {f.gasto_cents && !algunGasto ? (
                      <span className={SUB}>
                        gasto {euroCorto(f.gasto_cents)} · retorno {coma(f.retorno, '×')}
                      </span>
                    ) : null}
                  </td>
                  {conVisitas ? (
                    <td className={TD_NUM}>
                      {num(f.visitas)}
                      {c && c.sentido ? (
                        <span className="ml-1.5 text-[12.5px]">
                          <Cambio sentido={c.sentido}>{c.texto}</Cambio>
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  <td className={TD_NUM}>{num(f.leads)}</td>
                  {conVisitas ? <td className={`${TD_NUM} text-[#4B5565]`}>{f.visitas ? pct(f.pct_lead) : '—'}</td> : null}
                  {compacta ? null : <td className={TD_NUM}>{num(f.reservaron)}</td>}
                  {compacta ? null : <td className={TD_NUM}>{num(f.vinieron)}</td>}
                  <td className={TD_NUM}>{num(f.pagaron)}</td>
                  <td
                    className={`${TD_NUM} font-semibold`}
                    title={f.cents && (f.por_cobrar_cents ?? 0) > 0 ? `Cobrado ${euros(f.cobrado_cents ?? f.cents)} · por cobrar ${euros(f.por_cobrar_cents ?? 0)}` : undefined}
                  >
                    {f.cents ? euros(f.cents) : '—'}
                  </td>
                  {conPorVisita ? <td className={`${TD_NUM} text-[#4B5565]`}>{f.cents && f.cents_por_visita ? euroFino(f.cents_por_visita) : '—'}</td> : null}
                  {algunGasto ? (
                    <>
                      <td className={TD_NUM}>{f.gasto_cents ? euros(f.gasto_cents) : '—'}</td>
                      <td className={TD_NUM}>{f.coste_lead_cents ? euros(f.coste_lead_cents) : '—'}</td>
                      <td className={TD_NUM}>{coma(f.retorno, '×')}</td>
                    </>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 mt-1.5">
        {filas.length > tope ? (
          <button type="button" onClick={() => setTodas(!todas)} className={ENLACE}>
            {todas ? 'Ver menos' : `Ver las ${filas.length}`}
          </button>
        ) : (
          <span />
        )}
        <BotonCSV onClick={bajar} />
      </div>
    </div>
  )
}

/* ───────────────────────── mapa de calor ───────────────────────── */

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// Un solo tono, de claro a oscuro (cuánto, no qué).
const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const RAMPA = ['#F4F5F8', '#E4E7F7', '#CBD1F1', '#AAB3E8', '#8590DC', '#5F6BCB', '#3B46B0', '#1D0084']

export const franjaTexto = (f: number) => `${f * 2}–${f * 2 + 2} h`
export const diaTexto = (d: number) => DIAS[d] || ''

/** Cuándo visitan: día de la semana × franja de dos horas (hora de Países Bajos). */
export function MapaCalor({ calor }: { calor: number[][] }) {
  const [sobre, setSobre] = useState<{ d: number; f: number } | null>(null)
  const max = Math.max(1, ...calor.flat())
  const tono = (n: number) => (n ? RAMPA[Math.max(1, Math.ceil((n / max) * (RAMPA.length - 1)))] : RAMPA[0])
  return (
    <div>
      <div className="grid gap-[2px] items-center text-[11px] text-[#8A93A3]" style={{ gridTemplateColumns: '22px repeat(12, minmax(0, 1fr))' }}>
        <span />
        {Array.from({ length: 12 }, (_, f) => (
          <span key={f} className="text-center tabular-nums">
            {f * 2}
          </span>
        ))}
        {calor.map((fila, d) => (
          <React.Fragment key={d}>
            <span title={DIAS[d]}>{INICIALES[d]}</span>
            {fila.map((n, f) => (
              <div
                key={f}
                onMouseEnter={() => setSobre({ d, f })}
                onClick={() => setSobre({ d, f })}
                onMouseLeave={() => setSobre(null)}
                title={`${DIAS[d]}, ${franjaTexto(f)}: ${num(n)} visitas`}
                className="h-[18px] rounded-[3px]"
                style={{ background: tono(n), outline: sobre?.d === d && sobre?.f === f ? '2px solid #0B1020' : undefined }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5 text-[12.5px] text-[#8A93A3] min-h-[18px]">
        <span className="tabular-nums">
          {sobre ? `${DIAS[sobre.d]}, ${franjaTexto(sobre.f)}: ${num(calor[sobre.d][sobre.f])} visitas` : 'Toca una casilla para ver la cifra'}
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          menos
          {RAMPA.filter((_, i) => i % 2 === 1).map((c) => (
            <i key={c} className="inline-block w-3 h-3 rounded-[2px]" style={{ background: c }} />
          ))}
          más
        </span>
      </div>
    </div>
  )
}

/** Una barra con su nombre, la cifra y el % (países, móvil u ordenador…). */
export function BarraParte({ nombre, n, pctValor, max, extra }: { nombre: React.ReactNode; n: number; pctValor: number | null; max: number; extra?: React.ReactNode }) {
  return (
    <div className="grid items-center gap-x-2.5 py-1.5 text-[13.5px]" style={{ gridTemplateColumns: 'minmax(96px, 130px) minmax(0, 1fr) 44px 52px' }}>
      <span className="truncate">{nombre}</span>
      <div className="h-2 rounded bg-[#EDEFF4] overflow-hidden">
        <i className="block h-full rounded" style={{ width: `${max ? Math.max(2, Math.round((n * 100) / max)) : 0}%`, background: '#8590DC' }} />
      </div>
      <b className="text-right font-semibold tabular-nums">{num(n)}</b>
      <span className="text-right text-[12.5px] text-[#8A93A3] tabular-nums">{extra ?? pct(pctValor)}</span>
    </div>
  )
}

/* ───────────────────────── páginas ───────────────────────── */

const NOMBRES_PAGINA: Record<string, string> = {
  '/': 'Inicio de la web',
  '/formacion-nawar-fb': 'Página del anuncio',
  '/formacion-nawar-fb/vsl': 'Anuncio · el vídeo',
  '/formacion-nawar-fb/proceso-de-admision': 'Anuncio · formulario',
  '/formacion': 'Formación (web)',
  '/formacion/vsl': 'Formación · el vídeo',
  '/formacion/proceso-de-admision': 'Formación · formulario',
  '/formacion-nawar': 'Landing con precio',
  '/formacion-nawar-a0-a1': 'Landing sin precio',
  '/proceso-de-admision': 'Proceso de admisión',
  '/proceso-de-admision/paso-3': 'Admisión · preguntas',
  '/proceso-agendar': 'Formulario de la llamada',
  '/nuestra-vision': 'Nuestra visión',
  '/blog': 'Blog',
  '/black-friday': 'Lista de Black Friday',
  '/black-friday/ebook': 'Ebook de Black Friday',
  '/black-friday/ebook-ads': 'Ebook de Black Friday (anuncio)',
  '/black-friday/oferta': 'Oferta de Black Friday',
  '/black-friday/admision': 'Black Friday · llamada',
  '/matricula-formacion-nawar': 'Formulario de pago',
}

/** El nombre de una página para leerlo; debajo va su dirección. */
export function nombreDePagina(ruta: string): string {
  if (NOMBRES_PAGINA[ruta]) return NOMBRES_PAGINA[ruta]
  const limpio = (t: string) => t.replace(/-/g, ' ')
  if (ruta.startsWith('/blog/')) return `Blog · ${limpio(ruta.slice(6))}`
  if (ruta.startsWith('/guia/')) return `Guía · ${limpio(ruta.slice(6))}`
  return ruta
}

export function Pagina({ ruta }: { ruta: string }) {
  const nombre = nombreDePagina(ruta)
  return (
    <>
      <span className="block truncate">{nombre}</span>
      {nombre !== ruta ? <span className={`${SUB} truncate`}>{ruta}</span> : null}
    </>
  )
}
