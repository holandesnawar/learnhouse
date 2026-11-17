'use client'

/**
 * Web → Analítica (17/11/2026). Pedido del usuario: "ver las analíticas más
 * importantes de las webs dentro del panel… filtrar y ver de dónde viene x
 * tráfico, cuántos leads se convirtieron por paid vs orgánico, quién agendó
 * llamada gracias a qué utm… que esté bien hecho". Y la campaña de Black
 * Friday como filtro.
 *
 * Todo lo calcula el servidor (apps/api/src/services/stats/analitica.py): las
 * VISITAS (sesiones anónimas de toda la web, desde el 17/11) y las PERSONAS
 * (quien dejó sus datos en las fechas, y si reservó, vino y pagó aunque fuera
 * después). Cada fila de las tablas se toca para filtrar por ella. Solo
 * administradores: lleva lo cobrado.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAnalitica, type Analitica, type FilaCifras, type FiltrosAnalitica, type Modelo } from '@services/stats/analitica'
import { euros } from '@services/stats/school'
import { Loader2, X } from 'lucide-react'
import FichaCliente from './FichaCliente'
import { ENLACE, Estado, META, Seccion, TARJETA, filtro } from './ui'

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diaCorto = (s: string) => {
  const [, m, d] = s.split('-')
  return `${Number(d)}/${Number(m)}`
}
const fecha = (s: string) => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
}

type Periodo = '7' | '30' | '90' | 'mes' | 'mes-pasado' | 'a-mano'

function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = new Date()
  if (p === 'mes') return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) }
  if (p === 'mes-pasado') {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) }
  }
  const dias = Number(p) || 30
  const desde = new Date(hoy)
  desde.setDate(hoy.getDate() - (dias - 1))
  return { desde: iso(desde), hasta: iso(hoy) }
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
  { id: 'a-mano', label: 'Elegir fechas' },
]

const SERIES = [
  { id: 'visitas', label: 'Visitas' },
  { id: 'leads', label: 'Leads' },
  { id: 'reservas', label: 'Reservas de llamada' },
  { id: 'ventas', label: 'Ventas' },
] as const

const SELECT =
  'h-8 rounded-lg border border-[#E2E8F4] bg-white px-2 text-[13px] text-[#1F2A44] outline-none focus:border-[#4da3ff] max-w-full'

function Cifra({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className={`${TARJETA} px-4 py-3.5 min-w-0`}>
      <p className="text-[12px] font-medium text-[#6B7280]">{titulo}</p>
      <p className="mt-1 text-[24px] sm:text-[26px] font-semibold text-gray-900 leading-none tabular-nums">{valor}</p>
      {sub ? <p className={`${META} mt-1.5 leading-snug`}>{sub}</p> : null}
    </div>
  )
}

/** Las cifras de un canal (pago u orgánico), una debajo de otra. */
function Canal({ fila, color, onElegir, elegido }: { fila: FilaCifras; color: string; onElegir: () => void; elegido: boolean }) {
  const pasos: [string, string, string][] = [
    ['Visitas a la web', fila.visitas === null ? '—' : String(fila.visitas), ''],
    ['Dejaron sus datos', String(fila.leads), fila.visitas ? `${pct(fila.pct_lead)} de las visitas` : ''],
    ['Reservaron llamada', String(fila.reservaron), `${pct(fila.pct_reserva)} de los leads`],
    ['Vinieron a la llamada', String(fila.vinieron), fila.reservaron ? `${pct(fila.pct_vino)} de las reservas` : ''],
    ['Pagaron', String(fila.pagaron), `${pct(fila.pct_pago)} de los leads`],
  ]
  return (
    <button onClick={onElegir} className={`${TARJETA} text-left w-full p-4 hover:border-[#B9CBEA] transition-colors ${elegido ? 'ring-2 ring-[#1D0084]/20 border-[#1D0084]/40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-gray-900">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {fila.nombre}
        </span>
        <span className="text-[15px] font-semibold text-gray-900 tabular-nums">{euros(fila.cents)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {pasos.map(([t, v, s]) => (
          <div key={t} className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[#374151]">{t}</span>
            <span className="text-right">
              <span className="text-[14px] font-semibold text-gray-900 tabular-nums">{v}</span>
              {s ? <span className={`${META} ml-2`}>{s}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

/** Una tabla de cifras (por fuente, campaña o anuncio). Tocar una fila filtra. */
function Tabla({
  filas,
  titulo,
  primera,
  conVisitas = true,
  conGasto = false,
  elegido,
  onElegir,
  vacio,
}: {
  filas: FilaCifras[]
  titulo: string
  primera: string
  conVisitas?: boolean
  conGasto?: boolean
  elegido: string
  onElegir: (v: string) => void
  vacio: string
}) {
  const [todas, setTodas] = useState(false)
  const vistas = todas ? filas : filas.slice(0, 10)
  const algunGasto = conGasto && filas.some((f) => f.gasto_cents)
  return (
    <Seccion titulo={titulo}>
      <div className={`${TARJETA} overflow-x-auto`}>
        {filas.length === 0 ? (
          <p className={`${META} px-4 py-4`}>{vacio}</p>
        ) : (
          <table className="w-full text-[13px] min-w-[620px]">
            <thead>
              <tr className="text-left text-[#6B7280] border-b border-[#F3F4F6]">
                <th className="font-medium py-2 pl-4 pr-3">{primera}</th>
                {conVisitas ? <th className="font-medium py-2 pr-3 text-right">Visitas</th> : null}
                <th className="font-medium py-2 pr-3 text-right">Leads</th>
                <th className="font-medium py-2 pr-3 text-right">Reservaron</th>
                <th className="font-medium py-2 pr-3 text-right">Vinieron</th>
                <th className="font-medium py-2 pr-3 text-right">Pagaron</th>
                <th className="font-medium py-2 pr-3 text-right">Ingresos</th>
                {algunGasto ? (
                  <>
                    <th className="font-medium py-2 pr-3 text-right">Gasto</th>
                    <th className="font-medium py-2 pr-3 text-right">€ / lead</th>
                    <th className="font-medium py-2 pr-4 text-right">Retorno</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {vistas.map((f) => (
                <tr
                  key={f.valor || '-'}
                  onClick={() => onElegir(f.valor === elegido ? '' : f.valor || '-')}
                  className={`border-t border-[#F3F4F6] cursor-pointer hover:bg-[#F7F9FE] ${f.valor === elegido ? 'bg-[#F0F5FF]' : ''}`}
                  title={f.meta && f.meta !== f.nombre ? `En Meta: ${f.meta}` : undefined}
                >
                  <td className="py-2 pl-4 pr-3 text-gray-900 font-medium max-w-[260px] truncate">{f.nombre}</td>
                  {conVisitas ? <td className="py-2 pr-3 text-right tabular-nums">{f.visitas ?? '—'}</td> : null}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {f.leads}
                    {conVisitas && f.visitas ? <span className="text-[#9CA3AF] ml-1">({pct(f.pct_lead)})</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.reservaron}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.vinieron}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900">{f.pagaron}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.cents ? euros(f.cents) : '—'}</td>
                  {algunGasto ? (
                    <>
                      <td className="py-2 pr-3 text-right tabular-nums">{f.gasto_cents ? euros(f.gasto_cents) : '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{f.coste_lead_cents ? euros(f.coste_lead_cents) : '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {f.retorno === null || f.retorno === undefined ? '—' : `${String(f.retorno).replace('.', ',')}×`}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filas.length > 10 ? (
          <button onClick={() => setTodas(!todas)} className={`${ENLACE} px-4 py-2.5 block`}>
            {todas ? 'Ver menos' : `Ver las ${filas.length}`}
          </button>
        ) : null}
      </div>
    </Seccion>
  )
}

export default function AnaliticaPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [f, setF] = useState<FiltrosAnalitica>(() => ({
    ...rango('30'),
    modelo: 'ficha',
    canal: '',
    fuente: '',
    campana: '',
    anuncio: '',
    bf_todo: false,
  }))
  const [datos, setDatos] = useState<Analitica | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [serie, setSerie] = useState<(typeof SERIES)[number]['id']>('leads')
  const [quien, setQuien] = useState<'todas' | 'reservaron' | 'pagaron'>('reservaron')
  const [abierta, setAbierta] = useState<string | null>(null)
  const ultima = useRef(0)

  useEffect(() => {
    if (!org?.id || !token) return
    const n = ++ultima.current
    setCargando(true)
    getAnalitica(org.id, f, token).then((r) => {
      if (n !== ultima.current) return
      setCargando(false)
      if (r.ok && r.datos) {
        setDatos(r.datos)
        setError('')
      } else setError(r.error || 'No se han podido leer los datos')
    })
  }, [org?.id, token, f])

  const poner = (cambio: Partial<FiltrosAnalitica>) => setF((x) => ({ ...x, ...cambio }))
  const elegirPeriodo = (p: Periodo) => {
    setPeriodo(p)
    if (p !== 'a-mano') poner(rango(p))
  }
  const hayFiltros = !!(f.canal || f.fuente || f.campana || f.anuncio)

  const filasSerie = useMemo(
    () => (datos?.serie || []).map((d) => ({ dia: diaCorto(d.dia), valor: (d as any)[serie] as number })),
    [datos, serie],
  )
  const personas = useMemo(() => {
    const lista = datos?.personas || []
    if (quien === 'reservaron') return lista.filter((p) => p.reservo)
    if (quien === 'pagaron') return lista.filter((p) => p.pago)
    return lista
  }, [datos, quien])

  if (!datos && !error) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[#6B7280] py-10">
        <Loader2 size={16} className="animate-spin" /> Leyendo la analítica…
      </div>
    )
  }

  const r = datos?.resumen
  const nombreCampana = (v: string) => datos?.opciones.campanas.find((c) => c.valor === v)?.nombre || (v === '-' ? 'Sin campaña' : v)
  const nombreAnuncio = (v: string) => datos?.opciones.anuncios.find((c) => c.valor === v)?.nombre || v

  return (
    <div className="space-y-6">
      {/* ── filtros ── */}
      <div className={`${TARJETA} p-3.5 sm:p-4 space-y-3`}>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {PERIODOS.map((p) => (
            <button key={p.id} className={filtro(periodo === p.id)} onClick={() => elegirPeriodo(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'a-mano' ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#374151]">
            Del
            <input type="date" className={SELECT} value={f.desde} max={f.hasta} onChange={(e) => e.target.value && poner({ desde: e.target.value })} />
            al
            <input type="date" className={SELECT} value={f.hasta} min={f.desde} onChange={(e) => e.target.value && poner({ hasta: e.target.value })} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(
              [
                ['', 'Todo'],
                ['ads', 'Pago'],
                ['organico', 'Orgánico'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className={filtro(f.canal === v)} onClick={() => poner({ canal: v })}>
                {l}
              </button>
            ))}
          </div>
          <select className={SELECT} value={f.fuente} onChange={(e) => poner({ fuente: e.target.value })} aria-label="Fuente">
            <option value="">Todas las fuentes</option>
            {datos?.opciones.fuentes.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            {f.fuente && !datos?.opciones.fuentes.includes(f.fuente) ? <option value={f.fuente}>{f.fuente}</option> : null}
          </select>
          <select className={SELECT} value={f.campana} onChange={(e) => poner({ campana: e.target.value, bf_todo: e.target.value === 'black-friday' ? f.bf_todo : false })} aria-label="Campaña">
            <option value="">Todas las campañas</option>
            {datos?.opciones.campanas.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre}
              </option>
            ))}
            <option value="-">Sin campaña</option>
          </select>
          {datos?.opciones.anuncios.length ? (
            <select className={SELECT} value={f.anuncio} onChange={(e) => poner({ anuncio: e.target.value })} aria-label="Anuncio">
              <option value="">Todos los anuncios</option>
              {datos.opciones.anuncios.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.nombre}
                </option>
              ))}
            </select>
          ) : null}
          {hayFiltros ? (
            <button className={`${ENLACE} inline-flex items-center gap-1`} onClick={() => poner({ canal: '', fuente: '', campana: '', anuncio: '', bf_todo: false })}>
              <X size={13} /> Quitar filtros
            </button>
          ) : null}
          {cargando ? <Loader2 size={15} className="animate-spin text-[#6B7280]" /> : null}
        </div>
        {f.campana === 'black-friday' ? (
          <label className="flex items-start gap-2 text-[13px] text-[#374151]">
            <input type="checkbox" className="mt-0.5" checked={f.bf_todo} onChange={(e) => poner({ bf_todo: e.target.checked })} />
            <span>
              Contar también a quien pasó por Black Friday aunque hubiera llegado antes por otro sitio (por ejemplo, una guía en
              septiembre). Sin marcar, solo quien llegó por Black Friday.
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#374151]">
          <span>A quién se le da el mérito:</span>
          <select className={SELECT} value={f.modelo} onChange={(e) => poner({ modelo: e.target.value as Modelo })}>
            {(Object.keys(datos?.modelos || { ficha: '', primera: '', ultima: '' }) as Modelo[]).map((m) => (
              <option key={m} value={m}>
                {datos?.modelos[m] || m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-[13.5px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p> : null}

      {datos && r ? (
        <>
          {/* ── cifras ── */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
            <Cifra titulo="Visitas" valor={r.visitas === null ? '—' : String(r.visitas)} sub="sesiones en la web" />
            <Cifra titulo="Leads" valor={String(r.leads)} sub={r.visitas ? `${pct(r.pct_lead)} de las visitas` : 'dejaron sus datos'} />
            <Cifra titulo="Reservaron llamada" valor={String(r.reservaron)} sub={`${pct(r.pct_reserva)} de los leads`} />
            <Cifra titulo="Vinieron" valor={String(r.vinieron)} sub={r.reservaron ? `${pct(r.pct_vino)} de las reservas · ${r.no_vinieron} no vinieron` : ''} />
            <Cifra titulo="Pagaron" valor={String(r.pagaron)} sub={`${pct(r.pct_pago)} de los leads`} />
            <Cifra titulo="Ingresos" valor={euros(r.cents)} sub={r.pagaron ? `${euros(Math.round(r.cents / r.pagaron))} de media` : ''} />
          </div>
          <p className={`${META} -mt-3 leading-relaxed`}>
            Leads = quien dejó sus datos del {fecha(datos.desde + 'T12:00')} al {fecha(datos.hasta + 'T12:00')}. Reservaron, vinieron y pagaron cuenta
            lo que hicieron ellos, aunque fuera después.
            {datos.visitas_desde ? ` Las visitas se cuentan desde el ${fecha(datos.visitas_desde + 'T12:00')}.` : ' Las visitas se empiezan a contar hoy.'}
          </p>

          {/* ── pago vs orgánico ── */}
          <Seccion titulo="Anuncios de pago y orgánico">
            <div className="grid md:grid-cols-2 gap-2.5">
              {datos.por_canal.map((c) => (
                <Canal
                  key={c.valor}
                  fila={c}
                  color={c.valor === 'ads' ? '#025dc7' : '#16A34A'}
                  elegido={f.canal === c.valor}
                  onElegir={() => poner({ canal: f.canal === c.valor ? '' : (c.valor as 'ads' | 'organico') })}
                />
              ))}
            </div>
          </Seccion>

          {/* ── por día ── */}
          <Seccion
            titulo="Día a día"
            extra={
              <div className="flex gap-1.5 overflow-x-auto max-w-[70vw] sm:max-w-none">
                {SERIES.map((s) => (
                  <button key={s.id} className={filtro(serie === s.id)} onClick={() => setSerie(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className={`${TARJETA} p-3 sm:p-4`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filasSerie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip
                    cursor={{ fill: '#F9FAFB' }}
                    contentStyle={{ borderRadius: 6, border: '1px solid #E5E7EB', boxShadow: 'none', fontSize: 12 }}
                    formatter={(v: any) => [v, SERIES.find((s) => s.id === serie)?.label]}
                    labelFormatter={(l: any) => `Día ${l}`}
                  />
                  <Bar isAnimationActive={false} dataKey="valor" fill="#025dc7" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Seccion>

          <Tabla
            titulo="Por fuente"
            primera="De dónde vienen"
            filas={datos.por_fuente}
            elegido={f.fuente}
            onElegir={(v) => poner({ fuente: v === '-' ? '' : v })}
            vacio="Nada en estas fechas."
          />
          <Tabla
            titulo="Por campaña"
            primera="Campaña"
            filas={datos.por_campana}
            conGasto
            elegido={f.campana}
            onElegir={(v) => poner({ campana: v, bf_todo: false })}
            vacio="Nada en estas fechas."
          />
          {datos.por_campana.some((c) => c.gasto_cents) ? (
            <p className={`${META} -mt-4`}>
              El gasto es el apuntado en Panel → Anuncios, repartido por días entre estas fechas. Retorno = ingresos ÷ gasto.
            </p>
          ) : null}
          <Tabla
            titulo="Por anuncio o enlace"
            primera="Anuncio o enlace (utm_content)"
            filas={datos.por_anuncio}
            conVisitas={false}
            elegido={f.anuncio}
            onElegir={(v) => poner({ anuncio: v === '-' ? '' : v })}
            vacio="Ningún lead con anuncio (utm_content) en estas fechas."
          />

          {/* ── páginas ── */}
          <div className="grid lg:grid-cols-2 gap-6 items-start [&>*]:min-w-0">
            <Seccion titulo="Páginas más vistas" extra={<span className={META}>visitas</span>}>
              <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
                {datos.paginas.length === 0 ? (
                  <p className={`${META} px-4 py-4`}>Aún no hay visitas contadas en estas fechas.</p>
                ) : (
                  datos.paginas.slice(0, 15).map((p) => (
                    <div key={p.pagina} className="px-4 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-900 truncate">{p.pagina}</p>
                        <p className={META}>{p.entradas ? `${p.entradas} entraron por aquí` : 'llegaron desde otra página'}</p>
                      </div>
                      <span className="shrink-0 text-[13.5px] font-semibold text-gray-900 tabular-nums">{p.sesiones}</span>
                    </div>
                  ))
                )}
              </div>
              {datos.dispositivos.movil + datos.dispositivos.ordenador ? (
                <p className={META}>
                  {Math.round((datos.dispositivos.movil * 100) / (datos.dispositivos.movil + datos.dispositivos.ordenador))} % desde el móvil ·{' '}
                  {datos.dispositivos.ordenador} desde el ordenador
                </p>
              ) : null}
            </Seccion>
            <Seccion titulo="Dónde dejan sus datos" extra={<span className={META}>leads</span>}>
              <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
                {datos.donde_dejan.length === 0 ? (
                  <p className={`${META} px-4 py-4`}>Nadie en estas fechas.</p>
                ) : (
                  datos.donde_dejan.slice(0, 15).map((p) => (
                    <div key={p.marca || '-'} className="px-4 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-900 truncate first-letter:uppercase">{p.nombre}</p>
                        <p className={META}>
                          {p.reservaron} reservaron · {p.pagaron} pagaron
                        </p>
                      </div>
                      <span className="shrink-0 text-[13.5px] font-semibold text-gray-900 tabular-nums">{p.leads}</span>
                    </div>
                  ))
                )}
              </div>
              <p className={META}>La primera página de la web por la que pasaron antes de dejar sus datos.</p>
            </Seccion>
          </div>

          {/* ── personas ── */}
          <Seccion
            titulo="Quién es cada uno"
            extra={
              <div className="flex gap-1.5 overflow-x-auto max-w-[70vw] sm:max-w-none">
                {(
                  [
                    ['reservaron', 'Reservaron'],
                    ['pagaron', 'Pagaron'],
                    ['todas', 'Todos los leads'],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} className={filtro(quien === v)} onClick={() => setQuien(v)}>
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
              {personas.length === 0 ? (
                <p className={`${META} px-4 py-4`}>Nadie con estos filtros.</p>
              ) : (
                personas.slice(0, 200).map((p) => (
                  <button key={p.email} onClick={() => setAbierta(p.email)} className="w-full text-left px-4 py-2.5 hover:bg-[#F7F9FE] flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-gray-900 truncate">{p.nombre || p.email}</p>
                      <p className={`${META} truncate`}>
                        <span className={p.canal === 'ads' ? 'text-[#025dc7] font-medium' : ''}>{p.fuente}</span>
                        {p.campana_nombre ? ` · ${p.campana_nombre}` : ''}
                        {p.anuncio ? ` · ${p.anuncio}` : ''}
                        {p.primera_pagina ? ` · entró por ${p.primera_pagina}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
                      <span className={META}>Lead {fecha(p.entro)}</span>
                      {p.reservo ? <Estado tono="azul">Reservó {fecha(p.reservo)}</Estado> : null}
                      {p.vino ? <Estado tono="azul">Vino</Estado> : p.no_vino ? <Estado tono="rojo">No vino</Estado> : null}
                      {p.pago ? <Estado tono="verde">Pagó{p.cents ? ` ${euros(p.cents)}` : ''}</Estado> : null}
                    </div>
                  </button>
                ))
              )}
              {personas.length > 200 ? <p className={`${META} px-4 py-2.5`}>Y {personas.length - 200} más: afina con los filtros.</p> : null}
            </div>
          </Seccion>

          <div className={`${META} leading-relaxed space-y-1.5`}>
            <p>
              <b className="font-semibold text-[#374151]">Cómo se cuenta.</b> Pago = llegó con un enlace de anuncio (utm_medium paid, cpc…) o por la página del
              anuncio. La fuente sale del enlace (utm_source); si no lo lleva, de la web de la que venía (Instagram, Google…); si no se sabe, «Directo».
              Black Friday junta su campaña y todo lo que pasa por blackfriday.holandesnawar.com, aunque llegue sin campaña.
            </p>
            <p>
              Quien reserva directo en Calendly (el enlace de un setter) cuenta por la campaña de su enlace de Calendly
              {datos.calendly.conectado ? '' : ' (ahora mismo Calendly no contesta: esas reservas no salen)'}. Quien está fuera de los números no cuenta.
            </p>
          </div>
        </>
      ) : null}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
