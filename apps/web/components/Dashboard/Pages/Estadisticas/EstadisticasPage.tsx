'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import FacturasPanel from './FacturasPanel'
import ContactosPanel from './ContactosPanel'
import LlamadasPanel from './LlamadasPanel'
import GastosPanel from './GastosPanel'
import GuionPanel from './GuionPanel'
import PaginasPanel from './PaginasPanel'
import { getContactos, type Contacto } from '@services/stats/contactos'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgAccesoCloser } from '@services/settings/org'
import { getAPIUrl } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  baseSinUtm,
  buildUtmUrl,
  deleteManualEntry,
  euros,
  getSchoolStats,
  marcarSolicitud,
  readUtmLinks,
  saveManualEntry,
  saveUtmLinks,
  type SchoolStats,
  type SalesRow,
  type UtmLink,
} from '@services/stats/school'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Link2,
  Loader2,
  Mail,
  Pencil,
  PhoneCall,
  Plus,
  Receipt,
  RefreshCw,
  ScrollText,
  Trash2,
  TrendingDown,
  UserPlus,
  Users,
  Wallet,
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

  const { isCloser, isAdmin } = useAdminStatus()
  // Qué ve el closer además de Contactos. Lo decide el administrador desde
  // esta misma pantalla; el closer lo lee para saber qué pestañas enseñar.
  // El servidor lo exige igual: esto solo evita enseñar una pestaña que daría 403.
  const [closerVeNumeros, setCloserVeNumeros] = useState<boolean | null>(null)
  useEffect(() => {
    if (!org?.id) return
    fetch(`${getAPIUrl()}orgs/${org.id}/config/acceso_closer`)
      .then((r) => r.json())
      .then((d) => setCloserVeNumeros(!!d?.numeros))
      .catch(() => setCloserVeNumeros(false))
  }, [org?.id])

  // Para el relector de la dirección (efecto sin dependencias): el closer sin
  // ?tab= va a Contactos, no a Números, o saltaría de una a otra sin parar.
  const esCloserRef = React.useRef(false)
  esCloserRef.current = isCloser
  const [tab, setTab] = useState<'numeros' | 'contactos' | 'llamadas' | 'facturas' | 'gastos' | 'guion' | 'paginas' | 'utm'>('numeros')
  // El closer arranca en Contactos, que es lo suyo.
  useEffect(() => {
    if (isCloser) setTab('contactos')
  }, [isCloser])
  // La barra del panel enlaza directo a una pestaña (?tab=contactos). Se lee
  // de window y no con useSearchParams: ese hook obliga a envolver la página
  // en Suspense o el build de Next se cae, y aquí no aporta nada más.
  useEffect(() => {
    const leer = () => {
      const pedida = new URLSearchParams(window.location.search).get('tab')
      if (pedida === 'numeros' || pedida === 'contactos' || pedida === 'llamadas' || pedida === 'facturas' || pedida === 'gastos' || pedida === 'guion' || pedida === 'paginas' || pedida === 'utm') setTab(pedida)
      // Sin ?tab= (el enlace «Estadísticas» de la barra) = los números.
      else if (!pedida) setTab(esCloserRef.current ? 'contactos' : 'numeros')
    }
    leer()
    window.addEventListener('popstate', leer)
    // La barra lateral cambia el ?tab= con un Link de Next, que no dispara
    // popstate ni vuelve a montar la página: se mira cada poco, como hace la
    // propia barra para saber qué entrada marcar.
    const id = window.setInterval(leer, 400)
    return () => {
      window.removeEventListener('popstate', leer)
      window.clearInterval(id)
    }
  }, [])
  // El closer sin Números no se queda nunca en esa sección.
  useEffect(() => {
    if (isCloser && tab !== 'contactos' && tab !== 'llamadas' && tab !== 'guion' && tab !== 'paginas' && !(tab === 'numeros' && closerVeNumeros === true)) {
      setTab('contactos')
    }
  }, [isCloser, tab, closerVeNumeros])
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const [stats, setStats] = useState<SchoolStats | null>(null)
  const [contactosResumen, setContactosResumen] = useState<Contacto[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloading, setReloading] = useState(false)

  const load = useCallback(async () => {
    if (!org?.id || !accessToken) return
    // Al closer sin Números no se le piden: darían 403.
    if (isCloser && closerVeNumeros !== true) {
      setLoaded(true)
      return
    }
    const [data, cs] = await Promise.all([getSchoolStats(org.id, accessToken), getContactos(org.id, '', accessToken)])
    setStats(data)
    setContactosResumen(cs?.contactos ?? null)
    setLoaded(true)
  }, [org?.id, accessToken, isCloser, closerVeNumeros])

  useEffect(() => {
    load()
  }, [load])

  // Contactos, Llamadas y Facturas cargan lo suyo: "Actualizar" las vuelve a
  // montar para que pidan los datos otra vez.
  const [vuelta, setVuelta] = useState(0)
  const refresh = async () => {
    setReloading(true)
    setVuelta((v) => v + 1)
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
        {/* El título es el de la sección que se ha abierto en la barra. Antes
            todo se llamaba "Estadísticas" con pestañas debajo que repetían la
            barra, y el closer no sabía dónde estaba. */}
        <div className="flex items-center gap-2 min-w-0">
          {tab === 'contactos' ? (
            <Users size={22} className="text-[#025dc7] shrink-0" />
          ) : tab === 'llamadas' ? (
            <PhoneCall size={22} className="text-[#025dc7] shrink-0" />
          ) : tab === 'facturas' ? (
            <Receipt size={22} className="text-[#025dc7] shrink-0" />
          ) : tab === 'gastos' ? (
            <Wallet size={22} className="text-[#025dc7] shrink-0" />
          ) : tab === 'guion' ? (
            <ScrollText size={22} className="text-[#025dc7] shrink-0" />
          ) : tab === 'paginas' ? (
            <Globe size={22} className="text-[#025dc7] shrink-0" />
          ) : (
            <BarChart3 size={22} className="text-[#025dc7] shrink-0" />
          )}
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">
            {tab === 'contactos'
              ? 'Contactos'
              : tab === 'llamadas'
                ? 'Llamadas'
                : tab === 'facturas'
                  ? 'Facturas'
                  : tab === 'gastos'
                    ? 'Gastos'
                    : tab === 'guion'
                      ? 'Guion de llamada'
                      : tab === 'paginas'
                        ? 'Páginas de la web'
                        : 'Estadísticas'}
          </h1>
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

      {tab === 'contactos' ? (
        <>
          <ContactosPanel key={vuelta} />
          {/* Un ajuste que se toca una vez: abajo, no encima de la lista. */}
          {isAdmin ? (
            <QueVeElCloser
              orgId={org?.id}
              accessToken={accessToken}
              numeros={closerVeNumeros}
              onChange={setCloserVeNumeros}
            />
          ) : null}
        </>
      ) : tab === 'llamadas' ? (
        <LlamadasPanel key={vuelta} />
      ) : tab === 'facturas' ? (
        <FacturasPanel key={vuelta} />
      ) : tab === 'gastos' ? (
        <GastosPanel key={vuelta} />
      ) : tab === 'guion' ? (
        <GuionPanel key={vuelta} />
      ) : tab === 'paginas' ? (
        <PaginasPanel key={vuelta} />
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
          {/* ── La escuela de un vistazo ─────────────────────────── */}
          {/* Antes aquí iba la lista entera de "Matrículas nuevas", que repetía
              Contactos → Matrículas hechas (donde además se atienden, se
              anotan y se programan). Ahora solo el número y el enlace. */}
          <Resumen stats={stats} contactos={contactosResumen} />

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
                    tu lista de recuperación
                    {(sales.funnel.pending?.length ?? 0) > 0
                      ? `: ${sales.funnel.pending!.length} ${sales.funnel.pending!.length === 1 ? 'persona' : 'personas'} (un intento repetido cuenta una vez).`
                      : '.'}
                  </p>
                  {/* La lista de estas personas vive en Contactos (etapa
                      "Llegaron al pago"). Aquí solo el enlace: un segundo sitio
                      donde buscarlos es un sitio donde no mirar. */}
                  {(sales.funnel.pending?.length ?? 0) > 0 && (
                    <a
                      href="/dash/estadisticas?tab=contactos&vista=matriculas"
                      className="mt-2 inline-block text-[12px] text-[#025dc7] font-semibold hover:underline"
                    >
                      Los tienes en Contactos →
                    </a>
                  )}
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

          {/* Alumnos sin señales de vida: justo debajo de los números de alumnos. */}
          <AtRisk rows={stats.at_risk} />

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

          {/* ── Cómo va la cohorte ───────────────────────────────── */}
          <Cohorte stats={stats} />

          {/* ── Datos que escribes tú ────────────────────────────── */}
          <ManualBlocks stats={stats} onSaved={load} />
        </div>
      )}
    </div>
  )
}

/* ── Alumnos que necesitan un empujón ────────────────────────────── */

/**
 * La escuela de un vistazo: lo que ha entrado (leads, matrículas), lo que se
 * ha cobrado y cuántos alumnos siguen activos. Cada cifra con su enlace a
 * donde se trabaja.
 */
function Resumen({ stats, contactos }: { stats: SchoolStats; contactos: Contacto[] | null }) {
  const ahora = Date.now()
  const dentro = (iso: string, dias: number) => {
    const t = Date.parse(iso || '')
    return Number.isFinite(t) && ahora - t <= dias * 86400000
  }
  const cs = (contactos ?? []).filter((c) => !c.fuera_de_metricas)
  const leads7 = cs.filter((c) => dentro(c.primer_contacto.when, 7)).length
  const leads30 = cs.filter((c) => dentro(c.primer_contacto.when, 30)).length
  const mat7 = cs.filter((c) => c.matricula_at && dentro(c.matricula_at, 7)).length
  const mat30 = cs.filter((c) => c.matricula_at && dentro(c.matricula_at, 30)).length
  const porAtender = cs.filter((c) => c.matricula_at && c.etapa !== 'alumno' && !c.atendida).length
  const ventas30 = stats.sales?.last_30_days
  const alumnos = stats.students

  const Cifra = ({ label, valor, nota, href }: { label: string; valor: string; nota: string; href?: string }) => {
    const cuerpo = (
      <>
        <p className={LABEL}>{label}</p>
        <p className={BIG}>{valor}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{nota}</p>
      </>
    )
    return href ? (
      <a href={href} className={`${CARD} block hover:border-[#4da3ff] transition-colors`}>
        {cuerpo}
      </a>
    ) : (
      <div className={CARD}>{cuerpo}</div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra
          label="Leads nuevos · 7 días"
          valor={contactos ? String(leads7) : '—'}
          nota={contactos ? `${leads30} en 30 días` : 'Cargando…'}
          href="/dash/estadisticas?tab=contactos"
        />
        <Cifra
          label="Matrículas · 7 días"
          valor={contactos ? String(mat7) : '—'}
          nota={contactos ? `${mat30} en 30 días` : 'Cargando…'}
          href="/dash/estadisticas?tab=contactos&vista=matriculas"
        />
        <Cifra
          label="Ventas · 30 días"
          valor={ventas30 ? euros(ventas30.revenue_cents) : '—'}
          nota={ventas30 ? `${ventas30.sales} ${ventas30.sales === 1 ? 'venta' : 'ventas'}` : ''}
          href="/dash/estadisticas?tab=facturas"
        />
        <Cifra
          label="Alumnos activos · 7 días"
          valor={alumnos ? String(alumnos.active_7d) : '—'}
          nota={alumnos ? `de ${alumnos.total} alumnos` : ''}
        />
      </div>
      {porAtender > 0 ? (
        <a
          href="/dash/estadisticas?tab=contactos&vista=matriculas"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#4da3ff]/40 bg-[#EAF3FF] px-4 py-3 hover:bg-[#dfeeff] transition-colors"
        >
          <span className="text-[13.5px] text-[#0a1656]">
            <strong>{porAtender}</strong> {porAtender === 1 ? 'matrícula espera' : 'matrículas esperan'} que las llamen
          </span>
          <span className="text-[13px] font-bold text-[#025dc7]">Abrir en Contactos →</span>
        </a>
      ) : null}
    </section>
  )
}

function AtRisk({ rows }: { rows: SchoolStats['at_risk'] }) {
  if (!rows) return null
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" /> A quién escribir
      </h2>
      <div className={CARD}>
        {rows.length === 0 ? (
          <div className="flex items-center gap-2.5 py-2">
            <Check size={18} className="text-emerald-500 shrink-0" />
            <p className="text-[13.5px] text-gray-700">
              Nadie descolgado ahora mismo. Todos han entrado esta semana.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-[#9CA3AF] mb-3">
              {rows.length} {rows.length === 1 ? 'alumno' : 'alumnos'} sin señales de vida. Los que
              no han empezado van primero: son los que se piden el reembolso.
            </p>
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div
                  key={r.user_id}
                  className="rounded-xl border border-[#E7EEF9] px-3.5 py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[12px] text-gray-500 truncate">
                      <span
                        className={
                          r.activities_done === 0 ? 'text-amber-700 font-semibold' : ''
                        }
                      >
                        {r.reason}
                      </span>
                      {r.days_since_join !== null && (
                        <span className="text-[#9CA3AF]"> · alumno desde hace {r.days_since_join} días</span>
                      )}
                    </p>
                  </div>
                  <a
                    href={`mailto:${r.email}`}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                  >
                    <Mail size={13} /> Escribir
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/* ── Activación, retención, soporte y devoluciones ───────────────── */

function Cohorte({ stats }: { stats: SchoolStats }) {
  const { activation, retention, support, refunds } = stats
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-bold text-gray-900">Cómo va la cohorte</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={CARD}>
          <p className={LABEL}>Arrancan en {activation?.window_days ?? 7} días</p>
          <p className={BIG}>{activation ? `${activation.pct}%` : '—'}</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            {activation
              ? `${activation.activated} de ${activation.eligible} hicieron algo su primera semana`
              : 'Sin datos'}
          </p>
        </div>

        <div className={CARD}>
          <p className={LABEL}>Respuesta a mensajes</p>
          <p className={BIG}>
            {support?.median_hours === null || !support ? '—' : `${support.median_hours} h`}
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            {support
              ? `${support.under_24h_pct}% en menos de 24 h · ${support.pending} sin contestar`
              : 'Sin datos'}
          </p>
        </div>

        <div className={CARD}>
          <p className={LABEL}>Devoluciones</p>
          <p className={BIG}>{refunds?.available ? refunds.refunds : '—'}</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            {refunds?.available
              ? `${euros(refunds.refunded_cents)} devueltos · ${refunds.disputes} disputas`
              : 'Stripe no ha contestado'}
          </p>
        </div>
      </div>

      {retention && retention.cohorts.length > 0 && (
        <div className={CARD}>
          <h3 className="text-[14px] font-bold text-gray-900">Quién sigue entrando</h3>
          <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
            Cada fila es la gente que se dio de alta ese mes. Las semanas cuentan desde SU alta, no
            del calendario, así que se pueden comparar entre sí.
          </p>

          {/* Sin historial no se sabe si volvieron: mejor decirlo que pintar
              una rejilla de ceros que parece que nadie ha vuelto nunca. */}
          {retention.weeks.every((w) => w === null) ? (
            <div className="rounded-xl bg-[#F0F5FF] px-3.5 py-3">
              <p className="text-[12.5px] text-[#0a1656] leading-relaxed">
                Todavía no hay historial de visitas, así que aún no se puede saber quién repite.
                Empieza a contar desde hoy: dentro de una semana verás la primera columna, y el
                cuadro se irá llenando solo.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {retention.cohorts.map((c) => (
                  <span
                    key={c.key}
                    className="text-[12px] font-semibold bg-white border border-[#DDE6F5] rounded-full px-2.5 py-1 capitalize"
                  >
                    {c.label}: {c.size} {c.size === 1 ? 'alta' : 'altas'}
                  </span>
                ))}
              </div>
            </div>
          ) : (
          <>
          {/* Móvil: una tarjeta por cohorte, con el mes y cuánta gente
              delante. En tabla, esa columna se quedaba fuera de la pantalla. */}
          <div className="sm:hidden space-y-2">
            {retention.cohorts.map((c) => (
              <div key={c.key} className="rounded-xl border border-[#E7EEF9] px-3.5 py-3">
                <p className="text-[13.5px] font-bold text-gray-900 capitalize">
                  {c.label}{' '}
                  <span className="text-[12px] font-semibold text-[#9CA3AF]">
                    · {c.size} {c.size === 1 ? 'alta' : 'altas'}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.weeks.map((w, i) => (
                    <span
                      key={i}
                      className="text-[11.5px] font-semibold rounded-md px-2 py-1 tabular-nums"
                      style={{
                        backgroundColor:
                          w === null ? '#F5F7FB' : `rgba(77,163,255,${Math.max(0.08, w / 100) * 0.35})`,
                        color: w === null ? '#C6D2E6' : w >= 50 ? '#025dc7' : '#8a6a2a',
                      }}
                    >
                      S{i + 1} {w === null ? '—' : `${w}%`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[13px] min-w-[420px]">
              <thead>
                <tr className="text-left text-[#9CA3AF]">
                  <th className="font-semibold py-2 pr-3">Alta</th>
                  {retention.weeks.map((_, i) => (
                    <th key={i} className="font-semibold py-2 px-1.5 text-center">
                      S{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3FB]">
                {retention.cohorts.map((c) => (
                  <tr key={c.key}>
                    <td className="py-2 pr-3 font-semibold text-gray-900 capitalize whitespace-nowrap">
                      {c.label}{' '}
                      <span className="text-[11px] text-[#9CA3AF] font-normal">({c.size})</span>
                    </td>
                    {c.weeks.map((w, i) => (
                      <td key={i} className="py-2 px-1.5 text-center">
                        {w === null ? (
                          <span className="text-[#DDE6F5]">·</span>
                        ) : (
                          <span
                            className="inline-block min-w-[38px] rounded-md py-0.5 text-[12px] font-bold tabular-nums"
                            style={{
                              backgroundColor: `rgba(77,163,255,${Math.max(0.08, w / 100) * 0.35})`,
                              color: w >= 50 ? '#025dc7' : '#8a6a2a',
                            }}
                          >
                            {w}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
          {retention.tracking_since && !retention.weeks.every((w) => w === null) && (
            <p className="mt-3 text-[11.5px] text-[#9CA3AF]">
              Con datos desde el {retention.tracking_since}: antes de esa fecha no se guardaban las
              visitas, así que las semanas anteriores salen vacías.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/* ── Gasto del mes + asistencia a los directos ───────────────────── */

function ManualBlocks({ stats, onSaved }: { stats: SchoolStats; onSaved: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [attDate, setAttDate] = useState(today)
  const [attValue, setAttValue] = useState('')
  const [attNote, setAttNote] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (
    kind: 'attendance',
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
      setAttValue('')
      setAttNote('')
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

  const attendance = stats.manual?.attendance ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-bold text-gray-900">Lo que apuntas tú</h2>

      {/* Los gastos (captar y entregar) se apuntan ahora en UN solo sitio:
          la sección Gastos. Aquí había dos formularios más y una tabla de
          margen que repetían lo mismo; lo ya apuntado aquí sale en Gastos. */}
      <p className="text-[12.5px] text-[#5A6480]">
        Los gastos (profes, publicidad, herramientas) se apuntan en{' '}
        <a href="/dash/estadisticas?tab=gastos" className="text-[#025dc7] font-semibold hover:underline">
          Gastos
        </a>
        , con el margen y el coste por matrícula.
      </p>

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

/**
 * Lo que ve el closer, decidido por el administrador. Contactos lo ve
 * siempre (es su trabajo); los Números —ventas, embudo, alumnos— solo si se
 * marca aquí. El servidor lo exige por su cuenta: esto no es la seguridad,
 * es el interruptor.
 *
 * Quién es closer: quien está en el grupo "Closers" (Usuarios → Grupos).
 */
function QueVeElCloser({
  orgId,
  accessToken,
  numeros,
  onChange,
}: {
  orgId: number | undefined
  accessToken: string
  numeros: boolean | null
  onChange: (v: boolean) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const cambiar = async () => {
    if (!orgId || numeros === null) return
    setGuardando(true)
    try {
      await updateOrgAccesoCloser(orgId, !numeros, accessToken)
      onChange(!numeros)
      toast.success(!numeros ? 'El closer ya ve también los Números.' : 'El closer ve solo Contactos.')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className={`${CARD} flex flex-col sm:flex-row sm:items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-gray-900">Qué ve el closer</p>
        <p className="text-[12.5px] text-gray-500">
          Quien está en el grupo <strong>Closers</strong> (Usuarios → Grupos) entra al panel y ve
          Contactos (solo las matrículas), Llamadas, el Guion de llamada y las Páginas de la web.
          Aquí decides si además ve los Números.
        </p>
      </div>
      <button
        onClick={cambiar}
        disabled={guardando || numeros === null}
        className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
          numeros ? 'bg-[#1D0084] text-white' : 'bg-[#F0F5FF] text-[#1D0084] hover:bg-[#E4EDFF]'
        }`}
      >
        {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className={numeros ? '' : 'opacity-30'} />}
        {numeros ? 'Ve también los Números' : 'Sin los Números'}
      </button>
    </div>
  )
}
