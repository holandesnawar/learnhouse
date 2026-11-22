'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ContactosPanel from './ContactosPanel'
import LlamadasPanel from './LlamadasPanel'
import GastosPanel from './GastosPanel'
import GuionPanel from './GuionPanel'
import EstudioPanel from '../Panel/EstudioPanel'
import ResenasPanel from '../Panel/ResenasPanel'
import EstadoPanel from '../Panel/EstadoPanel'
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
import { BOTON_PRINCIPAL, BOTON_TEXTO, Cifra as CifraTira, Fila, Seccion, Segmentado, SUB, TABLA, TD, TD_NUM, TH, TH_NUM, Tira } from '../Panel/ui'
import ClasesProfes from '@components/Pages/Profes/ClasesProfes'
import { getContactos, type Contacto } from '@services/stats/contactos'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { updateOrgAccesoCloser, updateOrgAlcanceCloser, type AlcanceCloser } from '@services/settings/org'
import { getAPIUrl } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  baseSinUtm,
  cobradoDe,
  porCobrarDe,
  vendidoDe,
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
  Video,
  Activity,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Caja con borde: solo para un ajuste o un formulario (objetos de verdad). Las
// cifras y las tablas ya no van en cajas (22/11/2026, ver Panel/ui.tsx).
const CARD = 'rounded-[10px] border border-[#E6E8EE] bg-white p-4 sm:p-5'
const INPUT =
  'h-9 bg-white rounded-lg px-3 text-[13.5px] text-[#0B1020] placeholder:text-[#8A93A3] border border-[#E6E8EE] outline-none focus:border-[#0B1020] transition-colors w-full'
const BTN = `${BOTON_PRINCIPAL} h-9 px-4 text-[13.5px]`

/**
 * Cada sección del panel que vive en esta página: su icono, su título y para
 * qué sirve, en una línea (04/11/2026, "da pereza encontrar todo y dónde están
 * las cosas"). El título es el de la barra.
 */
const ICONO = { size: 20 }
const SECCIONES: Record<string, { titulo: string; icono: React.ReactNode; que: string }> = {
  numeros: { titulo: 'Estadísticas', icono: <BarChart3 {...ICONO} />, que: 'Lo vendido y lo cobrado, el embudo del pago y la asistencia a la clase en vivo.' },
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
  resenas: { titulo: 'Reseñas', icono: <Video {...ICONO} />, que: 'Pide a tus alumnos una reseña en vídeo, revísala y bájala. El regalo es por grabarla, no por hablar bien.' },
  estado: { titulo: 'Estado de la escuela', icono: <Activity {...ICONO} />, que: 'Qué ha fallado, qué va lento y qué pantallas se han roto, para enterarte antes que los alumnos.' },
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
          <div key={r.key} className="border-t border-[#F0F1F5] first:border-[#E6E8EE] py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13.5px] font-bold text-gray-900 capitalize">{r.label}</span>
              <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
                {euros(vendidoDe(r))}
              </span>
            </div>
            <p className="text-[12px] text-[#9CA3AF] tabular-nums mt-0.5">
              {r.sales} {r.sales === 1 ? 'venta' : 'ventas'} · ticket {euros(r.avg_ticket_cents)}
            </p>
            <p className="text-[12px] text-[#6B7280] tabular-nums mt-0.5">
              Cobrado {euros(cobradoDe(r))}
              {porCobrarDe(r) > 0 ? ` · por cobrar ${euros(porCobrarDe(r))}` : ''}
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
      <table className={`${TABLA} min-w-[680px]`}>
        <thead>
          <tr>
            <th className={TH}>Periodo</th>
            <th className={TH_NUM}>Ventas</th>
            <th className={TH_NUM}>Vendido</th>
            <th className={TH_NUM}>Cobrado</th>
            <th className={TH_NUM}>Por cobrar</th>
            <th className={TH_NUM}>Ticket medio</th>
            <th className={`${TH} pl-6`}>Productos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={`${TD} capitalize`}>{r.label}</td>
              <td className={TD_NUM}>{r.sales}</td>
              <td className={`${TD_NUM} font-semibold`}>{euros(vendidoDe(r))}</td>
              <td className={TD_NUM}>{euros(cobradoDe(r))}</td>
              <td className={`${TD_NUM} text-[#4B5565]`}>{porCobrarDe(r) > 0 ? euros(porCobrarDe(r)) : '—'}</td>
              <td className={`${TD_NUM} text-[#4B5565]`}>{euros(r.avg_ticket_cents)}</td>
              <td className={`${TD} pl-6 text-[12.5px] text-[#8A93A3]`}>
                {Object.entries(r.by_product)
                  .map(([id, p]) => `${productName(id)} · ${p.sales}`)
                  .join('  ·  ')}
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
  const [tab, setTab] = useState<'numeros' | 'contactos' | 'llamadas' | 'facturas' | 'gastos' | 'guion' | 'paginas' | 'utm' | 'matriculas' | 'tareas' | 'clientes' | 'anuncios' | 'progreso' | 'recursos' | 'vision' | 'kpis' | 'plazos' | 'tandas' | 'enfoque' | 'camino' | 'seguimiento' | 'correos' | 'profes' | 'estudio' | 'resenas' | 'estado'>('numeros')
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
      if (pedida === 'numeros' || pedida === 'contactos' || pedida === 'llamadas' || pedida === 'facturas' || pedida === 'gastos' || pedida === 'guion' || pedida === 'paginas' || pedida === 'utm' || pedida === 'matriculas' || pedida === 'tareas' || pedida === 'clientes' || pedida === 'anuncios' || pedida === 'progreso' || pedida === 'recursos' || pedida === 'vision' || pedida === 'kpis' || pedida === 'plazos' || pedida === 'tandas' || pedida === 'enfoque' || pedida === 'camino' || pedida === 'seguimiento' || pedida === 'correos' || pedida === 'profes' || pedida === 'estudio' || pedida === 'resenas' || pedida === 'estado') setTab(pedida)
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
    <div className="h-full w-full bg-white px-4 sm:px-9 py-6 sm:py-9 pb-10 space-y-5 sm:space-y-6">
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
            className={BOTON_TEXTO}
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
      ) : tab === 'resenas' ? (
        <ResenasPanel key={vuelta} />
      ) : tab === 'estado' ? (
        <EstadoPanel key={vuelta} />
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
        <p className="text-[14px] text-[#4B5565]">
          No se han podido cargar los números. Prueba a actualizar; si sigue igual, es que el servidor no está respondiendo.
        </p>
      ) : (
        <div className="space-y-10">
          {/* ── La escuela de un vistazo ─────────────────────────── */}
          <Resumen stats={stats} contactos={contactosResumen} />

          {/* ── Dinero ───────────────────────────────────────────── */}
          {!sales ? (
            <Seccion titulo="Dinero" filete>
              <Empty>No se han podido calcular las ventas.</Empty>
            </Seccion>
          ) : (
            <>
              <Seccion titulo="Dinero" nota="Desde que abrió la matrícula. Vendido es lo que cada persona se comprometió a pagar; cobrado, lo que ya ha entrado.">
                <Tira>
                  <CifraTira
                    rotulo="Vendido"
                    valor={euros(sales.vendido_cents ?? sales.total_revenue_cents)}
                    nota={
                      <>
                        cobrado {euros(sales.cobrado_cents ?? sales.total_revenue_cents)}
                        {(sales.por_cobrar_cents ?? 0) > 0 ? ` · por cobrar ${euros(sales.por_cobrar_cents ?? 0)}` : ''}
                      </>
                    }
                  />
                  <CifraTira
                    rotulo="Ventas"
                    valor={sales.total_sales}
                    nota={
                      (sales.a_plazos ?? 0) > 0 ? (
                        <>
                          {sales.a_plazos} a plazos
                          {(sales.con_fallo ?? 0) > 0 ? (
                            <span className="text-[#C8322B]"> · {sales.con_fallo} con un cobro fallido</span>
                          ) : null}
                        </>
                      ) : (
                        'todas en un pago'
                      )
                    }
                  />
                  <CifraTira rotulo="Ticket medio" valor={euros(sales.avg_ticket_cents)} nota="sobre lo vendido" />
                  <CifraTira
                    rotulo="Vendido en 30 días"
                    valor={euros(vendidoDe(sales.last_30_days))}
                    nota={`${sales.last_30_days.sales} ${sales.last_30_days.sales === 1 ? 'venta' : 'ventas'} · cobrado ${euros(cobradoDe(sales.last_30_days))}`}
                  />
                </Tira>
              </Seccion>

              <Seccion
                titulo="Ventas por periodo"
                extra={
                  <Segmentado
                    opciones={[
                      { id: 'month', label: 'Por mes' },
                      { id: 'quarter', label: 'Por trimestre' },
                    ]}
                    valor={period}
                    onChange={setPeriod}
                  />
                }
              >
                <SalesTable rows={salesRows} />
                {sales.undated > 0 && (
                  <p className="text-[12.5px] text-[#9A6B12]">
                    {sales.undated} {sales.undated === 1 ? 'venta' : 'ventas'} sin fecha utilizable, fuera de la tabla (son de antes de
                    que se guardara la fecha del cobro). Sí cuentan en los totales de arriba.
                  </p>
                )}
              </Seccion>

              {sales.by_product.length > 1 && (
                <Seccion titulo="Por producto" junto>
                  {sales.by_product.map((p) => (
                    <Fila key={p.product} titulo={productName(p.product)} detalle={`${p.sales} ${p.sales === 1 ? 'venta' : 'ventas'}`} n={euros(vendidoDe(p))} />
                  ))}
                </Seccion>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
                {/* Embudo del checkout */}
                <Seccion
                  titulo="Caja de pago"
                  extra={
                    (sales.funnel.pending?.length ?? 0) > 0 ? (
                      <a href="/dash/estadisticas?tab=contactos&vista=matriculas" className="text-[13px] font-medium text-[#1F3FD0] hover:underline">
                        Verlos en Contactos
                      </a>
                    ) : null
                  }
                >
                  <Tira>
                    <CifraTira pequena rotulo="Empezaron" valor={sales.funnel.started} />
                    <CifraTira pequena rotulo="Pagaron" valor={sales.funnel.paid} />
                    <CifraTira pequena rotulo="Conversión" valor={`${sales.funnel.conversion_pct} %`} />
                  </Tira>
                  <p className="text-[12.5px] text-[#8A93A3] leading-relaxed">
                    {sales.funnel.abandoned} rellenaron el formulario y no llegaron a pagar. Esa es tu lista de recuperación
                    {(sales.funnel.pending?.length ?? 0) > 0
                      ? `: ${sales.funnel.pending!.length} ${sales.funnel.pending!.length === 1 ? 'persona' : 'personas'} (un intento repetido cuenta una vez).`
                      : '.'}
                  </p>
                </Seccion>

                {/* Devoluciones: es dinero, así que se queda aquí. */}
                <Seccion titulo="Devoluciones">
                  <Tira>
                    <CifraTira pequena rotulo="Devoluciones" valor={stats.refunds?.available ? stats.refunds.refunds : '—'} />
                    <CifraTira pequena rotulo="Devuelto" valor={stats.refunds?.available ? euros(stats.refunds.refunded_cents) : '—'} />
                    <CifraTira pequena rotulo="Disputas" valor={stats.refunds?.available ? stats.refunds.disputes : '—'} />
                  </Tira>
                  {!stats.refunds?.available ? <p className="text-[12.5px] text-[#8A93A3]">Stripe no ha contestado.</p> : null}
                </Seccion>
              </div>
            </>
          )}

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

  return (
    <section>
      <Tira>
        <CifraTira
          rotulo="Leads nuevos en 7 días"
          valor={contactos ? leads7 : '—'}
          nota={contactos ? `${leads30} en 30 días` : 'Cargando…'}
          href="/dash/estadisticas?tab=contactos"
        />
        <CifraTira
          rotulo="Matrículas en 7 días"
          valor={contactos ? mat7 : '—'}
          nota={contactos ? `${mat30} en 30 días` : 'Cargando…'}
          href="/dash/estadisticas?tab=contactos&vista=matriculas"
        />
        <CifraTira
          rotulo="Vendido en 30 días"
          valor={ventas30 ? euros(vendidoDe(ventas30)) : '—'}
          nota={ventas30 ? `${ventas30.sales} ${ventas30.sales === 1 ? 'venta' : 'ventas'} · cobrado ${euros(cobradoDe(ventas30))}` : ''}
          href="/dash/estadisticas?tab=clientes"
        />
        <CifraTira
          rotulo="Alumnos activos en 7 días"
          valor={alumnos ? alumnos.active_7d : '—'}
          sufijo={alumnos ? `de ${alumnos.total}` : undefined}
          nota="Ver por dónde va cada uno"
          href="/dash/estadisticas?tab=progreso"
        />
      </Tira>
      {porAtender > 0 ? (
        <div className="mt-1">
          <Fila
            tono="rojo"
            titulo={`${porAtender === 1 ? 'Una matrícula espera' : `${porAtender} matrículas esperan`} que las llamen`}
            accion="Abrir en Contactos"
            href="/dash/estadisticas?tab=contactos&vista=matriculas"
          />
        </div>
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
    <Seccion titulo="Asistencia a la clase en vivo" nota="Lo que apuntas tú: la de las clases que no se dan en la sala de la escuela." filete>
      {/* Los gastos (captar y entregar) se apuntan ahora en UN solo sitio:
          la sección Gastos. Aquí había dos formularios más y una tabla de
          margen que repetían lo mismo; lo ya apuntado aquí sale en Gastos. */}
      <div className="pt-2">
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
          <div className="mt-4">
            {attendance.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border-t border-[#F0F1F5] first:border-[#E6E8EE] py-2.5"
              >
                <span className="text-[14px] text-[#0B1020]">
                  {a.period}
                  {a.note && <span className="text-[#8A93A3]"> · {a.note}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold tabular-nums text-[#0B1020]">
                    {a.value}
                    {stats.students?.total ? (
                      <span className="text-[12.5px] text-[#8A93A3] font-normal">
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
      <p className="text-[12.5px] text-[#8A93A3]">
        Los gastos (profes, publicidad, herramientas) se apuntan en{' '}
        <a href="/dash/estadisticas?tab=gastos" className="text-[#1F3FD0] font-medium hover:underline">
          Gastos
        </a>
        , con el margen y el coste por matrícula.
      </p>
    </Seccion>
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
                activo ? 'border-[#0B1020] bg-[#F7F8FA]' : 'border-[#E6E8EE] hover:bg-[#F7F8FA]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                {guardando === a.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} className={activo ? 'text-[#0B1020]' : 'opacity-0'} strokeWidth={3} />
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
