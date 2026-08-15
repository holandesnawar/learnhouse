'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  buildUtmUrl,
  deleteManualEntry,
  euros,
  getSchoolStats,
  readUtmLinks,
  saveManualEntry,
  saveUtmLinks,
  type SchoolStats,
  type SalesRow,
  type UtmLink,
} from '@services/stats/school'
import {
  BarChart3,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
// En móvil las etiquetas son de dos palabras ("ACTIVOS 30 DÍAS") y en tres
// columnas se cortaban: letra más pequeña y sin `tracking` para que quepan.
const LABEL =
  'text-[10px] sm:text-[11px] font-bold text-[#9CA3AF] uppercase tracking-normal sm:tracking-wider leading-tight'
const BIG = 'text-[22px] sm:text-[30px] font-bold text-[#1D0084] leading-tight mt-1 tabular-nums'
const INPUT =
  'bg-[#F0F5FF] rounded-xl px-3 py-2 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors w-full'
const BTN =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[14px] font-bold transition-colors disabled:opacity-60'

/** Nombre bonito para el identificador de producto. */
function productName(id: string): string {
  const known: Record<string, string> = {
    'formacion-a0-a1': 'Formación A0-A1',
    'vip-a0-a1': 'VIP A0-A1',
    'formacion-a1-a2': 'Formación A1-A2',
  }
  return known[id] || id
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[#9CA3AF] py-6 text-center">{children}</p>
}

function SalesTable({ rows }: { rows: SalesRow[] }) {
  if (!rows.length) return <Empty>Todavía no hay ventas en este periodo.</Empty>
  return (
    <>
      {/* Móvil: una tarjeta por periodo. La tabla obligaba a arrastrar de
          lado para ver los ingresos, que es justo la columna que importa. */}
      <div className="sm:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl border border-[#E7EEF9] px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13.5px] font-bold text-gray-900 capitalize">{r.label}</span>
              <span className="text-[15px] font-bold text-[#025dc7] tabular-nums">
                {euros(r.revenue_cents)}
              </span>
            </div>
            <p className="text-[12px] text-[#9CA3AF] tabular-nums mt-0.5">
              {r.sales} {r.sales === 1 ? 'venta' : 'ventas'} · ticket {euros(r.avg_ticket_cents)}
            </p>
            {Object.keys(r.by_product).length > 1 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(r.by_product).map(([id, p]) => (
                  <span
                    key={id}
                    className="text-[11px] font-semibold bg-[#F0F5FF] text-[#025dc7] rounded-full px-2 py-0.5"
                  >
                    {productName(id)} · {p.sales}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-[13.5px] min-w-[520px]">
        <thead>
          <tr className="text-left text-[#9CA3AF]">
            <th className="font-semibold py-2 pr-3">Periodo</th>
            <th className="font-semibold py-2 pr-3 text-right">Ventas</th>
            <th className="font-semibold py-2 pr-3 text-right">Ingresos</th>
            <th className="font-semibold py-2 pr-3 text-right">Ticket medio</th>
            <th className="font-semibold py-2">Productos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEF3FB]">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2.5 pr-3 font-semibold text-gray-900 capitalize">{r.label}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{r.sales}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-bold text-[#025dc7]">
                {euros(r.revenue_cents)}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-gray-500">
                {euros(r.avg_ticket_cents)}
              </td>
              <td className="py-2.5">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(r.by_product).map(([id, p]) => (
                    <span
                      key={id}
                      className="text-[11px] font-semibold bg-[#F0F5FF] text-[#025dc7] rounded-full px-2 py-0.5"
                    >
                      {productName(id)} · {p.sales}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}

export default function EstadisticasPage() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [tab, setTab] = useState<'numeros' | 'utm'>('numeros')
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const [stats, setStats] = useState<SchoolStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloading, setReloading] = useState(false)

  const load = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const data = await getSchoolStats(org.id, accessToken)
    setStats(data)
    setLoaded(true)
  }, [org?.id, accessToken])

  useEffect(() => {
    load()
  }, [load])

  const refresh = async () => {
    setReloading(true)
    await load()
    setReloading(false)
  }

  const sales = stats?.sales
  const salesRows = period === 'month' ? sales?.by_month ?? [] : sales?.by_quarter ?? []

  return (
    // Mismo marco que el resto del panel (Avisos, Cursos): sin esto el
    // contenido se pegaba a los bordes de la pantalla en el móvil. El hueco
    // de abajo para la barra del navegador ya lo pone el layout del panel.
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-6 sm:py-9 pb-10 space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={22} className="text-[#025dc7] shrink-0" />
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Estadísticas</h1>
        </div>
        <button
          onClick={refresh}
          aria-label="Actualizar"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#025dc7] hover:bg-[#EAF3FF] transition-colors"
        >
          <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      <div className="flex gap-1 border-b border-[#DDE6F5]">
        {[
          { id: 'numeros' as const, label: 'Números' },
          { id: 'utm' as const, label: 'Enlaces UTM' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-[#4da3ff] text-[#025dc7]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'utm' ? (
        <UtmNotepad />
      ) : !loaded ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : !stats ? (
        <div className={CARD}>
          <p className="text-[14px] text-gray-600">
            No se han podido cargar los números. Prueba a actualizar; si sigue igual, es que el
            servidor no está respondiendo.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Dinero ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-gray-900">Dinero</h2>
            {!sales ? (
              <div className={CARD}>
                <Empty>No se han podido calcular las ventas.</Empty>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={CARD}>
                    <p className={LABEL}>Ingresos totales</p>
                    <p className={BIG}>{euros(sales.total_revenue_cents)}</p>
                  </div>
                  <div className={CARD}>
                    <p className={LABEL}>Ventas</p>
                    <p className={BIG}>{sales.total_sales}</p>
                  </div>
                  <div className={CARD}>
                    <p className={LABEL}>Ticket medio</p>
                    <p className={BIG}>{euros(sales.avg_ticket_cents)}</p>
                  </div>
                  <div className={CARD}>
                    <p className={LABEL}>Últimos 30 días</p>
                    <p className={BIG}>{euros(sales.last_30_days.revenue_cents)}</p>
                    <p className="text-[12px] text-[#9CA3AF] font-semibold mt-1 tabular-nums">
                      {sales.last_30_days.sales} ventas
                    </p>
                  </div>
                </div>

                <div className={CARD}>
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="text-[14px] font-bold text-gray-900">Ventas por periodo</h3>
                    <div className="flex gap-1 bg-[#F0F5FF] rounded-lg p-1">
                      {[
                        { id: 'month' as const, label: 'Por mes' },
                        { id: 'quarter' as const, label: 'Por trimestre' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPeriod(p.id)}
                          className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${
                            period === p.id ? 'bg-white text-[#025dc7] shadow-sm' : 'text-gray-500'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SalesTable rows={salesRows} />
                  {sales.undated > 0 && (
                    <p className="mt-3 text-[12px] text-amber-700">
                      {sales.undated} {sales.undated === 1 ? 'venta' : 'ventas'} sin fecha
                      utilizable, fuera de la tabla (son de antes de que se guardara la fecha del
                      cobro). Sí cuentan en los totales de arriba.
                    </p>
                  )}
                </div>

                {sales.by_product.length > 1 && (
                  <div className={CARD}>
                    <h3 className="text-[14px] font-bold text-gray-900 mb-3">Por producto</h3>
                    <div className="space-y-2">
                      {sales.by_product.map((p) => (
                        <div key={p.product} className="flex items-center justify-between gap-3">
                          <span className="text-[13.5px] font-semibold text-gray-800">
                            {productName(p.product)}
                          </span>
                          <span className="text-[13.5px] tabular-nums text-gray-500">
                            {p.sales} ·{' '}
                            <span className="font-bold text-[#025dc7]">
                              {euros(p.revenue_cents)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embudo del checkout */}
                <div className={CARD}>
                  <h3 className="text-[14px] font-bold text-gray-900 mb-3">Checkout</h3>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div>
                      <p className={LABEL}>Empezaron</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-gray-900 tabular-nums mt-0.5">
                        {sales.funnel.started}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Pagaron</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-emerald-600 tabular-nums mt-0.5">
                        {sales.funnel.paid}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Conversión</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-[#025dc7] tabular-nums mt-0.5">
                        {sales.funnel.conversion_pct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#F0F5FF] overflow-hidden">
                    <div
                      className="h-full bg-[#4da3ff] rounded-full"
                      style={{ width: `${Math.min(100, sales.funnel.conversion_pct)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-[#9CA3AF]">
                    {sales.funnel.abandoned} rellenaron el formulario y no llegaron a pagar. Esa es
                    tu lista de recuperación.
                  </p>
                </div>
              </>
            )}
          </section>

          {/* ── Alumnos ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
              <Users size={16} className="text-[#025dc7]" /> Alumnos
            </h2>
            {!stats.students ? (
              <div className={CARD}>
                <Empty>No se han podido calcular los alumnos.</Empty>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
                <div className={CARD}>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div>
                      <p className={LABEL}>Total</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-gray-900 tabular-nums mt-0.5">
                        {stats.students.total}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Activos 7 días</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-[#025dc7] tabular-nums mt-0.5">
                        {stats.students.active_7d}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Activos 30 días</p>
                      <p className="text-[20px] sm:text-[22px] font-bold text-[#025dc7] tabular-nums mt-0.5">
                        {stats.students.active_30d}
                        {/* El % en su propia línea: pegado al número no cabía. */}
                        <span className="block text-[11px] text-[#9CA3AF] font-semibold">
                          {stats.students.active_30d_pct}% del total
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className={CARD}>
                  <p className="text-[13px] font-bold text-gray-900 mb-2">Altas por mes</p>
                  {stats.students.new_by_month.length === 0 ? (
                    <Empty>Sin altas todavía.</Empty>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.students.new_by_month.slice(0, 6).map((m) => (
                        <div key={m.key} className="flex items-center justify-between">
                          <span className="text-[13px] text-gray-700 capitalize">{m.label}</span>
                          <span className="text-[13px] font-bold tabular-nums text-[#025dc7]">
                            {m.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Avance del curso ─────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-gray-900">Avance de la formación</h2>
            {!stats.courses || stats.courses.length === 0 ? (
              <div className={CARD}>
                <Empty>Todavía no hay cursos con alumnos dentro.</Empty>
              </div>
            ) : (
              stats.courses
                .filter((c) => c.students_started > 0 || c.modules.length > 0)
                .map((course) => (
                  <div key={course.course_uuid} className={CARD}>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                      <h3 className="text-[14px] font-bold text-gray-900">{course.name}</h3>
                      <span className="text-[12px] font-semibold text-[#9CA3AF] tabular-nums">
                        {course.students_started} alumnos dentro
                      </span>
                    </div>

                    {course.modules.length === 0 ? (
                      <Empty>Este curso no tiene módulos.</Empty>
                    ) : (
                      <div className="space-y-2.5">
                        {course.modules.map((m) => (
                          <div key={m.name}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[13px] font-semibold text-gray-800 truncate">
                                {m.name}
                              </span>
                              <span className="text-[12.5px] tabular-nums shrink-0 text-gray-500">
                                {m.students_completed} de {course.students_started}{' '}
                                <span className="font-bold text-[#025dc7]">({m.pct}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F0F5FF] overflow-hidden">
                              <div
                                className="h-full bg-[#4da3ff] rounded-full"
                                style={{ width: `${Math.min(100, m.pct)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {course.biggest_drop && (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
                        <TrendingDown size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[12.5px] text-amber-800 leading-relaxed">
                          Donde más gente se cae: después de{' '}
                          <strong>{course.biggest_drop.after}</strong> se pierden{' '}
                          <strong>{course.biggest_drop.lost}</strong> alumnos antes de{' '}
                          <strong>{course.biggest_drop.activity}</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                ))
            )}
            <p className="text-[11px] text-[#9CA3AF]">
              &quot;Completó el módulo&quot; = terminó todas sus clases.
            </p>
          </section>

          {/* ── Datos que escribes tú ────────────────────────────── */}
          <ManualBlocks stats={stats} onSaved={load} />
        </div>
      )}
    </div>
  )
}

/* ── Gasto del mes + asistencia a los directos ───────────────────── */

function ManualBlocks({ stats, onSaved }: { stats: SchoolStats; onSaved: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const thisMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [costPeriod, setCostPeriod] = useState(thisMonth)
  const [costValue, setCostValue] = useState('')
  const [costNote, setCostNote] = useState('')
  const [attDate, setAttDate] = useState(today)
  const [attValue, setAttValue] = useState('')
  const [attNote, setAttNote] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (
    kind: 'cost' | 'attendance',
    period: string,
    value: string,
    note: string,
    label = ''
  ) => {
    const num = Number(String(value).replace(',', '.'))
    if (!period || !Number.isFinite(num) || num < 0) {
      toast.error('Revisa la fecha y el número')
      return
    }
    setSaving(true)
    const ok = await saveManualEntry(org.id, { kind, period, value: num, label, note }, accessToken)
    setSaving(false)
    if (ok) {
      toast.success('Guardado')
      if (kind === 'cost') {
        setCostValue('')
        setCostNote('')
      } else {
        setAttValue('')
        setAttNote('')
      }
      onSaved()
    } else {
      toast.error('No se pudo guardar')
    }
  }

  const remove = async (id: number) => {
    const ok = await deleteManualEntry(org.id, id, accessToken)
    if (ok) {
      toast.success('Borrado')
      onSaved()
    } else {
      toast.error('No se pudo borrar')
    }
  }

  const costs = stats.manual?.costs ?? []
  const attendance = stats.manual?.attendance ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-bold text-gray-900">Lo que escribes tú</h2>

      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900">Gasto del mes y coste por lead</h3>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
          Apunta lo que te has gastado ese mes (herramientas, publicidad…). El coste por lead se
          calcula sobre las matrículas empezadas de ese mismo mes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[150px_130px_1fr_auto] gap-2 items-start">
          <input type="month" value={costPeriod} onChange={(e) => setCostPeriod(e.target.value)} className={INPUT} />
          <input
            value={costValue}
            onChange={(e) => setCostValue(e.target.value)}
            placeholder="Euros"
            inputMode="decimal"
            className={INPUT}
          />
          <input
            value={costNote}
            onChange={(e) => setCostNote(e.target.value)}
            placeholder="En qué (opcional)"
            className={INPUT}
          />
          <button
            onClick={() => save('cost', costPeriod, costValue, costNote)}
            disabled={saving}
            className={BTN}
          >
            <Plus size={15} /> Guardar
          </button>
        </div>

        {costs.length > 0 && (
          <>
          {/* Móvil: lista, no tabla (mismo motivo que en las ventas). */}
          <div className="mt-4 sm:hidden space-y-2">
            {costs.map((c) => (
              <div key={c.id} className="rounded-xl border border-[#E7EEF9] px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-gray-900 capitalize">{c.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[#025dc7] tabular-nums">
                      {c.cost_per_lead_cents === null ? '—' : `${euros(c.cost_per_lead_cents)} / lead`}
                    </span>
                    <button
                      onClick={() => remove(c.id)}
                      className="text-gray-300 hover:text-rose-500 transition-colors"
                      aria-label="Borrar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
                <p className="text-[12px] text-[#9CA3AF] tabular-nums mt-0.5">
                  {euros(c.cost_cents)} · {c.leads} {c.leads === 1 ? 'matrícula' : 'matrículas'}
                  {c.note && <span> · {c.note}</span>}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden sm:block overflow-x-auto">
            <table className="w-full text-[13.5px] min-w-[460px]">
              <thead>
                <tr className="text-left text-[#9CA3AF]">
                  <th className="font-semibold py-2 pr-3">Mes</th>
                  <th className="font-semibold py-2 pr-3 text-right">Gasto</th>
                  <th className="font-semibold py-2 pr-3 text-right">Matrículas</th>
                  <th className="font-semibold py-2 pr-3 text-right">Coste por lead</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3FB]">
                {costs.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3 font-semibold text-gray-900 capitalize">{c.label}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{euros(c.cost_cents)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-500">{c.leads}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-bold text-[#025dc7]">
                      {c.cost_per_lead_cents === null ? '—' : euros(c.cost_per_lead_cents)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => remove(c.id)}
                        className="text-gray-300 hover:text-rose-500 transition-colors"
                        aria-label="Borrar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900">Asistencia a la clase en vivo</h3>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
          La escuela no puede saber quién entra al directo, así que esto se apunta a mano después
          de cada clase.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[150px_130px_1fr_auto] gap-2 items-start">
          <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className={INPUT} />
          <input
            value={attValue}
            onChange={(e) => setAttValue(e.target.value)}
            placeholder="Asistentes"
            inputMode="numeric"
            className={INPUT}
          />
          <input
            value={attNote}
            onChange={(e) => setAttNote(e.target.value)}
            placeholder="Tema de la clase (opcional)"
            className={INPUT}
          />
          <button
            onClick={() => save('attendance', attDate, attValue, attNote, attDate)}
            disabled={saving}
            className={BTN}
          >
            <Plus size={15} /> Guardar
          </button>
        </div>

        {attendance.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {attendance.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-[#EEF3FB] pb-1.5"
              >
                <span className="text-[13.5px] text-gray-800">
                  <span className="font-semibold">{a.period}</span>
                  {a.note && <span className="text-gray-500"> · {a.note}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[13.5px] font-bold tabular-nums text-[#025dc7]">
                    {a.value}
                    {stats.students?.total ? (
                      <span className="text-[12px] text-[#9CA3AF] font-semibold">
                        {' '}
                        de {stats.students.total}
                      </span>
                    ) : null}
                  </span>
                  <button
                    onClick={() => remove(a.id)}
                    className="text-gray-300 hover:text-rose-500 transition-colors"
                    aria-label="Borrar"
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Bloc de notas de enlaces UTM ────────────────────────────────── */

const EMPTY_LINK: UtmLink = { name: '', url: '', source: '', medium: '', campaign: '', content: '' }

function UtmNotepad() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [links, setLinks] = useState<UtmLink[]>(() => readUtmLinks(org))
  const [draft, setDraft] = useState<UtmLink>(EMPTY_LINK)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const preview = buildUtmUrl(draft)

  const persist = async (next: UtmLink[]) => {
    setSaving(true)
    const ok = await saveUtmLinks(org.id, next, accessToken)
    setSaving(false)
    if (ok) {
      setLinks(next)
      toast.success('Guardado')
    } else {
      toast.error('No se pudo guardar')
    }
  }

  const add = () => {
    if (!draft.url.trim()) {
      toast.error('Falta el enlace')
      return
    }
    persist([...links, { ...draft, url: buildUtmUrl(draft) }])
    setDraft(EMPTY_LINK)
  }

  const copy = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(index)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Tu navegador no ha dejado copiar')
    }
  }

  const field = (key: keyof UtmLink, placeholder: string) => (
    <input
      value={draft[key]}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      className={INPUT}
    />
  )

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
          <Link2 size={16} className="text-[#025dc7]" /> Montar un enlace
        </h3>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
          Esto es un bloc de notas: guarda los enlaces montados para copiarlos cuando toque. La
          escuela no lee los UTM de nadie, así que no aparecerán en los números.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field('name', 'Nombre para acordarte (ej. Correo 1 lanzamiento)')}
          {field('url', 'https://www.holandesnawar.com/…')}
          {field('source', 'utm_source (ej. email, instagram)')}
          {field('medium', 'utm_medium (ej. newsletter, bio)')}
          {field('campaign', 'utm_campaign (ej. lanzamiento-sept)')}
          {field('content', 'utm_content (ej. boton-final)')}
        </div>

        {preview && (
          <div className="mt-3 rounded-xl bg-[#F0F5FF] px-3.5 py-3">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">
              Queda así
            </p>
            <p className="text-[12.5px] text-[#0a1656] break-all">{preview}</p>
          </div>
        )}

        <button onClick={add} disabled={saving} className={`${BTN} mt-3`}>
          <Plus size={15} /> Guardar enlace
        </button>
      </div>

      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">Tus enlaces</h3>
        {links.length === 0 ? (
          <Empty>Todavía no has guardado ninguno.</Empty>
        ) : (
          <div className="space-y-2">
            {links.map((l, i) => (
              <div
                key={`${l.url}-${i}`}
                className="rounded-xl border border-[#E7EEF9] px-3.5 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-gray-900">
                    {l.name || l.campaign || 'Sin nombre'}
                  </p>
                  <p className="text-[12px] text-gray-500 break-all mt-0.5">{l.url}</p>
                </div>
                <button
                  onClick={() => copy(l.url, i)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                >
                  {copied === i ? <Check size={13} /> : <Copy size={13} />}
                  {copied === i ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={() => persist(links.filter((_, j) => j !== i))}
                  className="shrink-0 text-gray-300 hover:text-rose-500 transition-colors mt-1.5"
                  aria-label="Borrar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
