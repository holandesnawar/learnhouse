'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ContactosPanel from './ContactosPanel'
import LlamadasPanel from './LlamadasPanel'
import GastosPanel from './GastosPanel'
import GuionPanel from './GuionPanel'
import EstudioPanel from '../Panel/EstudioPanel'
import KanbanPanel from '../Panel/KanbanPanel'
import TareasPanel from '../Panel/TareasPanel'
import FacturasDosPartes from './FacturasDosPartes'
import ClientesPanel from '../Panel/ClientesPanel'
import ProgresoPanel from '../Panel/ProgresoPanel'
import CaminoPanel from '../Panel/CaminoPanel'
import SeguimientoPanel from '../Panel/SeguimientoPanel'
import AnunciosPanel from '../Panel/AnunciosPanel'
import PaginasPanel from './PaginasPanel'
import RecursosAdmin from '../Recursos/RecursosAdmin'
import RecursosPage from '@components/Pages/Recursos/RecursosPage'
import VisionPage from '../Vision/VisionPage'
import KpisPanel from '../Panel/KpisPanel'
import CorreosPanel from '../Panel/CorreosPanel'
import PlazosPanel from '../Panel/PlazosPanel'
import TandasPanel from '../Panel/TandasPanel'
import CabeceraPagina from '../Panel/Cabecera'
import ClasesProfes from '@components/Pages/Profes/ClasesProfes'
import { getContactos, type Contacto } from '@services/stats/contactos'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgAccesoCloser, updateOrgAlcanceCloser, type AlcanceCloser } from '@services/settings/org'
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
  BarChart3,
  CalendarClock,
  Tags,
  Gauge,
  Mails,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  GraduationCap,
  KanbanSquare,
  Link2,
  ListChecks,
  Megaphone,
  Loader2,
  Mail,
  Pencil,
  PhoneCall,
  Plus,
  Receipt,
  RefreshCw,
  ScrollText,
  Trash2,
  UserPlus,
  UserCheck,
  Users,
  Wallet,
  FolderOpen,
  Telescope,
  Compass,
  Route,
  ClipboardCheck,
  Presentation,
  Lightbulb,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-xl border border-[#E2E8F4] bg-white p-3.5 sm:p-5'
// En móvil las etiquetas son de dos palabras ("ACTIVOS 30 DÍAS") y en tres
// columnas se cortaban: letra más pequeña y sin `tracking` para que quepan.
const LABEL =
  'text-[10px] sm:text-[11px] font-semibold text-[#6B7280] uppercase tracking-normal sm:tracking-[0.08em] leading-tight'
const BIG = 'text-[22px] sm:text-[28px] font-semibold text-[#1D0084] leading-tight mt-1 tabular-nums'
const INPUT =
  'h-9 bg-white rounded-md px-3 text-[13.5px] text-gray-900 placeholder:text-[#9CA3AF] border border-[#E5E7EB] outline-none focus:border-[#025dc7] transition-colors w-full'
const BTN =
  'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-[#025dc7] hover:bg-[#014fa9] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60'

/**
 * Cada sección del panel que vive en esta página: su icono, su título y para
 * qué sirve, en una línea (04/11/2026, "da pereza encontrar todo y dónde están
 * las cosas"). El título es el de la barra.
 */
const ICONO = { size: 20 }
const SECCIONES: Record<string, { titulo: string; icono: React.ReactNode; que: string }> = {
  numeros: { titulo: 'Estadísticas', icono: <BarChart3 {...ICONO} />, que: 'Ventas, ingresos, el embudo del pago y la asistencia a la clase en vivo.' },
  kpis: { titulo: 'KPIs', icono: <Gauge {...ICONO} />, que: 'Cuánta gente entra, ve el vídeo, reserva, se presenta a la llamada y paga.' },
  vision: { titulo: 'Visión', icono: <Telescope {...ICONO} />, que: 'El mapa del negocio, el tablero de trabajo y las cuentas de cada campaña.' },
  anuncios: { titulo: 'Anuncios', icono: <Megaphone {...ICONO} />, que: 'Qué trae cada campaña y cuánto cuesta cada lead y cada venta.' },
  matriculas: { titulo: 'Matrículas', icono: <KanbanSquare {...ICONO} />, que: 'Cada persona interesada, de Nuevo a Alumno. Arrastra la tarjeta para moverla.' },
  llamadas: { titulo: 'Llamadas', icono: <PhoneCall {...ICONO} />, que: 'La agenda de Calendly, los WhatsApp de cada llamada y a quién toca llamar.' },
  contactos: { titulo: 'Contactos', icono: <Users {...ICONO} />, que: 'Todo el que ha dejado sus datos, con lo que ha visto y hecho.' },
  tareas: { titulo: 'Tareas', icono: <ListChecks {...ICONO} />, que: 'Lo tuyo y lo del equipo, con su fecha.' },
  guion: { titulo: 'Guion', icono: <ScrollText {...ICONO} />, que: '' },
  enfoque: { titulo: 'Enfoque', icono: <Compass {...ICONO} />, que: '' },
  recursos: { titulo: 'Recursos', icono: <FolderOpen {...ICONO} />, que: '' },
  clientes: { titulo: 'Clientes', icono: <UserCheck {...ICONO} />, que: 'Quién ha pagado, cuánto, si sigue entrando y la comisión del closer.' },
  plazos: { titulo: 'Pagos a plazos', icono: <CalendarClock {...ICONO} />, que: 'Quién paga a plazos, en qué pago va y los cobros que fallan.' },
  facturas: { titulo: 'Facturas', icono: <Receipt {...ICONO} />, que: 'Las facturas de los alumnos (Stripe) y las de la empresa.' },
  gastos: { titulo: 'Gastos', icono: <Wallet {...ICONO} />, que: 'Lo que gastas cada mes, el margen y el coste por matrícula.' },
  progreso: { titulo: 'Progreso de los alumnos', icono: <GraduationCap {...ICONO} />, que: 'Por dónde va cada alumno y cuándo entró por última vez.' },
  seguimiento: { titulo: 'Seguimiento semanal', icono: <ClipboardCheck {...ICONO} />, que: 'Cada semana de las clases: quién va al día y qué hay por corregir.' },
  camino: { titulo: 'Camino de 16 semanas', icono: <Route {...ICONO} />, que: 'Las 16 semanas de cada alumno y las clases en directo a las que fue.' },
  tandas: { titulo: 'Tandas y grupos', icono: <Tags {...ICONO} />, que: 'La beta y el programa nuevo: el grupo de cada alumno y quién ve qué.' },
  paginas: { titulo: 'Páginas de la web', icono: <Globe {...ICONO} />, que: 'Las páginas de la web y lo que ya sabe quien llega desde cada una.' },
  correos: { titulo: 'Correos', icono: <Mails {...ICONO} />, que: 'Quién está en cada campaña y a quién le ha llegado cada correo.' },
  estudio: { titulo: 'Estudio', icono: <Lightbulb {...ICONO} />, que: 'Tu pizarra para apuntar deprisa, el banco de ideas de contenido y los prompts ya preparados para Claude.' },
  profes: { titulo: 'Clases de los profes', icono: <Presentation {...ICONO} />, que: 'Las próximas clases con su presentación, lo que falta preparar y los recursos. Lo mismo que ven los profes en la escuela.' },
}
/** Las pestañas de «Material de venta», en este orden. */
const MATERIAL = ['guion', 'enfoque', 'recursos']

/**
 * Secciones que van juntas en una sola entrada de la barra, con sus pestañas
 * arriba (08/11/2026, limpieza del panel: «que no esté todo separado»).
 * Las direcciones (`?tab=…`) no cambian: los enlaces guardados siguen.
 */
const PAQUETES: { tabs: string[]; titulo: string; que: string; nombres?: Record<string, string> }[] = [
  { tabs: MATERIAL, titulo: 'Material de venta', que: 'Lo que hace falta para la llamada: el guion, el enfoque del programa y los recursos.' },
  {
    tabs: ['clientes', 'plazos'],
    titulo: 'Clientes',
    que: 'Quién ha pagado, cuánto, la comisión del closer y quién paga a plazos.',
    nombres: { clientes: 'Clientes', plazos: 'Pagos a plazos' },
  },
  {
    tabs: ['seguimiento', 'camino'],
    titulo: 'Seguimiento',
    que: 'Cada semana de las clases (quién va al día y qué hay por corregir) y el camino de 16 semanas de cada alumno.',
    nombres: { seguimiento: 'Semana a semana', camino: 'Camino de 16 semanas' },
  },
]
const paqueteDe = (t: string) => PAQUETES.find((p) => p.tabs.includes(t))

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
              <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
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
                    className="text-[12px] text-[#6B7280]"
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
              <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-gray-900">
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
                      className="text-[12px] text-[#6B7280]"
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
  const [alcanceCloser, setAlcanceCloser] = useState<AlcanceCloser | null>(null)
  useEffect(() => {
    if (!org?.id) return
    fetch(`${getAPIUrl()}orgs/${org.id}/config/acceso_closer`)
      .then((r) => r.json())
      .then((d) => {
        setCloserVeNumeros(!!d?.numeros)
        setAlcanceCloser((d?.alcance as AlcanceCloser) || 'todo')
      })
      .catch(() => {
        setCloserVeNumeros(false)
        setAlcanceCloser('todo')
      })
  }, [org?.id])

  // Para el relector de la dirección (efecto sin dependencias): el closer sin
  // ?tab= va a Matrículas, no a Números, o saltaría de una a otra sin parar.
  const esCloserRef = React.useRef(false)
  esCloserRef.current = isCloser
  const [tab, setTab] = useState<'numeros' | 'contactos' | 'llamadas' | 'facturas' | 'gastos' | 'guion' | 'paginas' | 'utm' | 'matriculas' | 'tareas' | 'clientes' | 'anuncios' | 'progreso' | 'recursos' | 'vision' | 'kpis' | 'plazos' | 'tandas' | 'enfoque' | 'camino' | 'seguimiento' | 'correos' | 'profes' | 'estudio'>('numeros')
  // El closer arranca en Matrículas, que es lo suyo. Contactos también lo ve
  // desde el 03/11 (del 08/10 al 03/11 era solo del administrador).
  useEffect(() => {
    if (isCloser) setTab('matriculas')
  }, [isCloser])
  // La barra del panel enlaza directo a una pestaña (?tab=contactos). Se lee
  // de window y no con useSearchParams: ese hook obliga a envolver la página
  // en Suspense o el build de Next se cae, y aquí no aporta nada más.
  useEffect(() => {
    const leer = () => {
      const pedida = new URLSearchParams(window.location.search).get('tab')
      if (pedida === 'numeros' || pedida === 'contactos' || pedida === 'llamadas' || pedida === 'facturas' || pedida === 'gastos' || pedida === 'guion' || pedida === 'paginas' || pedida === 'utm' || pedida === 'matriculas' || pedida === 'tareas' || pedida === 'clientes' || pedida === 'anuncios' || pedida === 'progreso' || pedida === 'recursos' || pedida === 'vision' || pedida === 'kpis' || pedida === 'plazos' || pedida === 'tandas' || pedida === 'enfoque' || pedida === 'camino' || pedida === 'seguimiento' || pedida === 'correos' || pedida === 'profes' || pedida === 'estudio') setTab(pedida)
      // Sin ?tab= (el enlace «Estadísticas» de la barra) = los números.
      else if (!pedida) setTab(esCloserRef.current ? 'matriculas' : 'numeros')
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
    if (isCloser && tab !== 'contactos' && tab !== 'llamadas' && tab !== 'guion' && tab !== 'enfoque' && tab !== 'recursos' && tab !== 'paginas' && tab !== 'matriculas' && tab !== 'tareas' && tab !== 'kpis' && tab !== 'estudio' && !(tab === 'numeros' && closerVeNumeros === true)) {
      setTab('matriculas')
    }
  }, [isCloser, tab, closerVeNumeros])
  // «Correos» vive en Correos y avisos desde el 04/11 (pestaña «Quién recibe
  // qué»): la dirección vieja lleva allí.
  const router = useRouter()
  useEffect(() => {
    if (tab === 'correos' && !isCloser) router.replace('/dash/avisos?tab=campana')
  }, [tab, isCloser, router])
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
    <div className="h-full w-full bg-[#F4F7FD] px-4 sm:px-9 py-6 sm:py-9 pb-10 space-y-5 sm:space-y-6">
      {/* El título es el de la sección que se ha abierto en la barra, con una
          línea que dice para qué sirve (04/11/2026). Antes todo se llamaba
          "Estadísticas" con pestañas debajo que repetían la barra, y el closer
          no sabía dónde estaba. Guion, Enfoque y Recursos van juntos como
          «Material de venta», con sus pestañas. */}
      <CabeceraPagina
        icono={SECCIONES[tab]?.icono ?? <BarChart3 size={20} />}
        titulo={paqueteDe(tab)?.titulo ?? SECCIONES[tab]?.titulo ?? 'Estadísticas'}
        descripcion={paqueteDe(tab)?.que ?? SECCIONES[tab]?.que}
        pestanas={(() => {
          const pq = paqueteDe(tab)
          // El closer solo ve las pestañas que puede abrir (el Material de venta entero).
          return pq ? pq.tabs.map((m) => ({ href: `/dash/estadisticas?tab=${m}`, label: pq.nombres?.[m] ?? SECCIONES[m].titulo, activa: tab === m })) : undefined
        })()}
        acciones={
          <button
            onClick={refresh}
            aria-label="Actualizar"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#025dc7] hover:bg-[#E9EFFB] transition-colors"
          >
            <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        }
      />

      {tab === 'contactos' ? (
        <>
          <ContactosPanel key={vuelta} />
          {/* Un ajuste que se toca una vez: abajo, no encima de la lista. */}
          {isAdmin ? (
            <>
              <QueVenLosClosers orgId={org?.id} accessToken={accessToken} alcance={alcanceCloser} onChange={setAlcanceCloser} />
              <QueVeElCloser
                orgId={org?.id}
                accessToken={accessToken}
                numeros={closerVeNumeros}
                onChange={setCloserVeNumeros}
              />
            </>
          ) : null}
        </>
      ) : tab === 'llamadas' ? (
        <LlamadasPanel key={vuelta} />
      ) : tab === 'facturas' ? (
        <FacturasDosPartes key={vuelta} />
      ) : tab === 'gastos' ? (
        <GastosPanel key={vuelta} />
      ) : tab === 'guion' ? (
        <GuionPanel key={vuelta} />
      ) : tab === 'enfoque' ? (
        <GuionPanel key={vuelta} doc="enfoque" />
      ) : tab === 'recursos' ? (
        // El administrador las gestiona (y las ve todas); el closer ve las de su grupo.
        isAdmin ? <RecursosAdmin key={vuelta} embebido /> : <RecursosPage key={vuelta} embebido />
      ) : tab === 'paginas' ? (
        <PaginasPanel key={vuelta} />
      ) : tab === 'matriculas' ? (
        <>
          <KanbanPanel key={vuelta} />
          {isAdmin ? (
            <QueVenLosClosers orgId={org?.id} accessToken={accessToken} alcance={alcanceCloser} onChange={setAlcanceCloser} />
          ) : null}
        </>
      ) : tab === 'tareas' ? (
        <TareasPanel key={vuelta} />
      ) : tab === 'clientes' ? (
        <ClientesPanel key={vuelta} />
      ) : tab === 'anuncios' ? (
        <AnunciosPanel key={vuelta} />
      ) : tab === 'progreso' ? (
        <ProgresoPanel key={vuelta} />
      ) : tab === 'camino' ? (
        <CaminoPanel key={vuelta} />
      ) : tab === 'seguimiento' ? (
        <SeguimientoPanel key={vuelta} />
      ) : tab === 'vision' ? (
        <VisionPage key={vuelta} />
      ) : tab === 'kpis' ? (
        <KpisPanel key={vuelta} />
      ) : tab === 'correos' ? (
        // Vive en Correos y avisos desde el 04/11 (allí lleva a «Quién recibe
        // qué»); esta dirección se queda por los enlaces viejos.
        <CorreosPanel key={vuelta} />
      ) : tab === 'estudio' ? (
        <EstudioPanel key={vuelta} />
      ) : tab === 'profes' ? (
        <ClasesProfes key={vuelta} enPanel />
      ) : tab === 'plazos' ? (
        <PlazosPanel key={vuelta} />
      ) : tab === 'tandas' ? (
        <TandasPanel key={vuelta} />
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
                    <div className="flex gap-1.5">
                      {[
                        { id: 'month' as const, label: 'Por mes' },
                        { id: 'quarter' as const, label: 'Por trimestre' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPeriod(p.id)}
                          className={`h-8 px-3 rounded-md text-[13px] font-medium border transition-colors ${
                            period === p.id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
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
                            <span className="font-semibold text-gray-900">
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
                      <p className="text-[20px] sm:text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                        {sales.funnel.started}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Pagaron</p>
                      <p className="text-[20px] sm:text-[22px] font-semibold text-[#15803D] tabular-nums mt-0.5">
                        {sales.funnel.paid}
                      </p>
                    </div>
                    <div>
                      <p className={LABEL}>Conversión</p>
                      <p className="text-[20px] sm:text-[22px] font-semibold text-gray-900 tabular-nums mt-0.5">
                        {sales.funnel.conversion_pct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
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

                {/* Devoluciones: es dinero, así que se queda aquí. */}
                <div className={CARD}>
                  <p className={LABEL}>Devoluciones</p>
                  <p className={BIG}>{stats.refunds?.available ? stats.refunds.refunds : '—'}</p>
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    {stats.refunds?.available
                      ? `${euros(stats.refunds.refunded_cents)} devueltos · ${stats.refunds.disputes} disputas`
                      : 'Stripe no ha contestado'}
                  </p>
                </div>
              </>
            )}
          </section>

          {/* Lo de los alumnos (quién está activo, quién se descuelga, por
              dónde va cada uno) vive en Alumnos → Progreso desde el 04/10:
              aquí solo los números del negocio. */}
          <a
            href="/dash/estadisticas?tab=progreso"
            className={`${CARD} flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors`}
          >
            <span className="text-[13.5px] text-gray-700">
              Por dónde va cada alumno y quién lleva días sin entrar
            </span>
            <span className="text-[13px] font-medium text-[#025dc7] shrink-0">Alumnos → Progreso</span>
          </a>

          {/* ── Datos que escribes tú ────────────────────────────── */}
          <ManualBlocks stats={stats} onSaved={load} />
        </div>
      )}
    </div>
  )
}

/**
 * La escuela de un vistazo: lo que ha entrado (leads, matrículas), lo que se
 * ha cobrado y cuántos alumnos siguen activos. Cada cifra con su enlace a
 * donde se trabaja (la de alumnos, a Alumnos → Progreso).
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
      <a href={href} className={`${CARD} block hover:bg-[#F9FAFB] transition-colors`}>
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
          href="/dash/estadisticas?tab=progreso"
        />
      </div>
      {porAtender > 0 ? (
        <a
          href="/dash/estadisticas?tab=contactos&vista=matriculas"
          className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 hover:bg-[#F9FAFB] transition-colors"
        >
          <span className="text-[13.5px] text-gray-800">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#DC2626] mr-2 align-middle" />
            <strong>{porAtender}</strong> {porAtender === 1 ? 'matrícula espera' : 'matrículas esperan'} que las llamen
          </span>
          <span className="text-[13px] font-medium text-[#025dc7]">Abrir en Contactos →</span>
        </a>
      ) : null}
    </section>
  )
}

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

const ALCANCES: { id: AlcanceCloser; titulo: string; que: string }[] = [
  { id: 'todo', titulo: 'Todo', que: 'Lo de todo el equipo, y cada uno filtra lo suyo con «Solo las mías».' },
  { id: 'suyo_y_libre', titulo: 'Lo suyo y lo libre', que: 'Sus leads y llamadas, y lo que aún no lleva nadie para poder cogerlo.' },
  { id: 'suyo', titulo: 'Solo lo suyo', que: 'Solo sus leads y sus llamadas. Lo que no lleva nadie lo repartes tú (o quien reparte).' },
]

/**
 * Qué personas ve cada closer (05/11): en Matrículas, Llamadas, Contactos y
 * la ficha. Lo filtra el servidor (`services/panel/alcance.py`); esto es el
 * interruptor. Solo administradores.
 */
function QueVenLosClosers({
  orgId,
  accessToken,
  alcance,
  onChange,
}: {
  orgId: number | undefined
  accessToken: string
  alcance: AlcanceCloser | null
  onChange: (v: AlcanceCloser) => void
}) {
  const [guardando, setGuardando] = useState<AlcanceCloser | null>(null)
  const elegir = async (v: AlcanceCloser) => {
    if (!orgId || v === alcance) return
    setGuardando(v)
    try {
      await updateOrgAlcanceCloser(orgId, v, accessToken)
      onChange(v)
      toast.success('Guardado: los closers lo verán así al recargar.')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }
  return (
    <div className={`${CARD} mt-4`}>
      <p className="text-[13.5px] font-semibold text-gray-900">Qué ven los closers</p>
      <p className="text-[12.5px] text-gray-500 mt-0.5">
        En Matrículas, Llamadas, Contactos y la ficha. «Lo suyo» son las personas que llevan (su etiqueta en la tarjeta) y las
        llamadas que Calendly les dio. Tú lo sigues viendo todo.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {ALCANCES.map((a) => {
          const activo = alcance === a.id
          return (
            <button
              key={a.id}
              onClick={() => elegir(a.id)}
              disabled={alcance === null || guardando !== null}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-60 ${
                activo ? 'border-[#1D0084] bg-[#F0F5FF]' : 'border-[#E2E8F4] hover:bg-[#F7F9FD]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                {guardando === a.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} className={activo ? 'text-[#1D0084]' : 'opacity-0'} strokeWidth={3} />
                )}
                {a.titulo}
              </span>
              <span className="block text-[12px] text-gray-600 mt-0.5 leading-snug">{a.que}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
      toast.success(!numeros ? 'El closer ya ve también los Números.' : 'El closer ya no ve los Números.')
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
          Matrículas, Contactos, Llamadas, KPIs (sin el dinero), Tareas, el Guion y las Páginas de
          la web. Aquí decides si además ve los Números.
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
