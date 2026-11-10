'use client'

/**
 * La barra del panel de Holandés Nawar.
 *
 * Sustituye a DashLeftMenu (la de LearnHouse, que sigue en el repo por si
 * hace falta volver). Aquella traía todo lo que LearnHouse sabe hacer —
 * tareas, analítica de Tinybird, boards, podcasts, cobros de LearnHouse— y
 * la mitad no se usa en esta escuela. Esta enseña solo lo que existe, por
 * grupos de a qué se dedica cada cosa, y en claro: el panel es donde se
 * trabaja, no una pantalla de producto.
 *
 * Repaso del 04/11/2026 (usuario: "el panel es caótico y da pereza encontrar
 * todo… hay correos dos veces… colores sin vida, mira nuestra escuela por
 * dentro, cómo tiene vida"):
 * - El mismo fondo azul de la barra de la escuela (`lib/nawar/marca.ts`).
 * - «Inicio» arriba del todo (antes solo se llegaba tocando el logo).
 * - Sin repetidos: «Correos» y «Avisos y correos» son una entrada (Correos y
 *   avisos); «Enlaces y redirecciones» y «Enlaces UTM», otra (Enlaces y UTM,
 *   que ya tiene sus pestañas); Guion, Enfoque y Recursos, otra (Material de
 *   venta, con sus pestañas arriba).
 * - Grupos por lo que se hace: Vender, Números, Dinero, Alumnos, Comunicación,
 *   Formación, Web y Escuela. Cada grupo se pliega (se recuerda) y arriba hay
 *   un buscador.
 * Las direcciones (`?tab=…`) no cambian: los enlaces guardados y los de los
 * correos siguen funcionando.
 *
 * Quitado a propósito: Tareas de LearnHouse (no se usan), Analytics (muerta,
 * era de Tinybird), Boards, Podcasts, Playgrounds, Pagos de LearnHouse (el
 * cobro va por Stripe, las facturas están en Dinero → Facturas), la paleta de
 * comandos y el onboarding de LearnHouse. Si algo de eso hiciera falta, la
 * ruta sigue existiendo: es cuestión de volver a enlazarla aquí.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import useCloserVeNumeros from '@components/Hooks/useCloserVeNumeros'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import { cn } from '@/lib/utils'
import { ACTIVO_SOBRE_MARCA, FONDO_MARCA } from '@/lib/nawar/marca'
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  ChalkboardTeacher,
  ChartBar,
  ChatsCircle,
  EnvelopeSimple,
  FolderSimple,
  GearSix,
  House,
  Lightning,
  MagnifyingGlass,
  Question,
  Receipt,
  SidebarSimple,
  SignOut,
  UserCircle,
  UsersThree,
  AddressBook,
  Kanban,
  ListChecks,
  Megaphone,
  UserCheck,
  Globe,
  LinkSimple,
  PhoneCall,
  Wallet,
  ChartLineUp,
  Binoculars,
  Gauge,
  CalendarDots,
  Tag,
  Path,
  ClipboardText,
  X,
  Lightbulb,
} from '@phosphor-icons/react'

export type Item = {
  href: string
  label: string
  icon: React.ReactNode
  /** Otras direcciones que también la marcan (las pestañas que agrupa). */
  tambien?: string[]
  /** Para cuando no basta con la dirección exacta. */
  es?: (pathname: string, search: string) => boolean
  /** Palabras para el buscador, además del nombre. */
  claves?: string
}
export type Grupo = { titulo: string; items: Item[] }

const I = (C: React.ElementType, extra: Record<string, any> = {}) => <C size={18} weight="fill" {...extra} />

const INICIO: Item = {
  href: '/dash',
  label: 'Inicio',
  icon: I(House),
  es: (p, s) => /\/dash\/?$/.test(p) && !s.includes('tab='),
  claves: 'portada resumen hoy',
}

/** El Estudio (10/11/2026): la pizarra, el banco de ideas y los prompts. */
const ESTUDIO: Item = {
  href: '/dash/estadisticas?tab=estudio',
  label: 'Estudio',
  icon: I(Lightbulb),
  claves: 'pizarra notas ideas contenido reels carrusel blog prompts apuntes',
}

export const GRUPOS_DEL_PANEL: Grupo[] = [
  { titulo: '', items: [INICIO, ESTUDIO] },
  {
    titulo: 'Vender',
    items: [
      { href: '/dash/estadisticas?tab=matriculas', label: 'Matrículas', icon: I(Kanban), claves: 'tablero leads ventas kanban crm' },
      { href: '/dash/estadisticas?tab=llamadas', label: 'Llamadas', icon: I(PhoneCall), claves: 'calendly agenda whatsapp citas' },
      { href: '/dash/estadisticas?tab=contactos', label: 'Contactos', icon: I(AddressBook), claves: 'leads personas lista' },
      { href: '/dash/estadisticas?tab=tareas', label: 'Tareas', icon: I(ListChecks), claves: 'pendientes equipo' },
      {
        // Guion, Enfoque y Recursos en una entrada (04/11): eran tres sueltas.
        href: '/dash/estadisticas?tab=guion',
        label: 'Material de venta',
        icon: I(FolderSimple),
        tambien: ['/dash/estadisticas?tab=enfoque', '/dash/estadisticas?tab=recursos'],
        claves: 'guion enfoque recursos llamada pdf',
      },
    ],
  },
  {
    titulo: 'Números',
    items: [
      {
        href: '/dash/estadisticas',
        label: 'Estadísticas',
        icon: I(ChartBar),
        es: (p, s) => p.includes('/dash/estadisticas') && (!s.includes('tab=') || s.includes('tab=numeros')),
        claves: 'ventas embudo resumen numeros',
      },
      { href: '/dash/estadisticas?tab=kpis', label: 'KPIs', icon: I(Gauge), claves: 'cierre no show embudo visitas' },
      { href: '/dash/estadisticas?tab=vision', label: 'Visión', icon: I(Binoculars), claves: 'mapa campañas tablero trabajo' },
      { href: '/dash/estadisticas?tab=anuncios', label: 'Anuncios', icon: I(Megaphone), claves: 'meta facebook instagram campañas utm coste lead' },
    ],
  },
  {
    // El dinero aparte de las ventas: lo cobrado (facturas) y lo gastado.
    titulo: 'Dinero',
    items: [
      // Clientes y Pagos a plazos en una entrada, con sus pestañas (08/11/2026).
      {
        href: '/dash/estadisticas?tab=clientes',
        label: 'Clientes',
        icon: I(UserCheck),
        tambien: ['/dash/estadisticas?tab=plazos'],
        claves: 'pagos comisiones alumnos que pagaron plazos cuotas suscripcion fallidos',
      },
      { href: '/dash/estadisticas?tab=facturas', label: 'Facturas', icon: I(Receipt), claves: 'stripe dar de alta a mano gestoria' },
      { href: '/dash/estadisticas?tab=gastos', label: 'Gastos', icon: I(Wallet), claves: 'margen coste software' },
    ],
  },
  {
    titulo: 'Alumnos',
    items: [
      { href: '/dash/estadisticas?tab=progreso', label: 'Progreso', icon: I(ChartLineUp), claves: 'recordatorio sin entrar modulos' },
      // Seguimiento semanal y Camino de 16 semanas en una entrada (08/11/2026).
      {
        href: '/dash/estadisticas?tab=seguimiento',
        label: 'Seguimiento',
        icon: I(ClipboardText),
        tambien: ['/dash/estadisticas?tab=camino'],
        claves: 'tareas corregir check-in deberes camino 16 semanas asistencia directo',
      },
      { href: '/dash/estadisticas?tab=tandas', label: 'Tandas y grupos', icon: I(Tag), claves: 'beta programa nuevo quien ve que' },
      { href: '/dash/users/settings/users', label: 'Usuarios', icon: I(UserCircle), es: (p) => p.includes('/dash/users') && !p.includes('/usergroups'), claves: 'cuentas roles' },
    ],
  },
  {
    titulo: 'Comunicación',
    items: [
      { href: '/dash/communities', label: 'Comunidad', icon: I(ChatsCircle), claves: 'canales chat' },
      { href: '/dash/consultas', label: 'Consultas', icon: I(Question), claves: 'dudas responder' },
      {
        // Una sola entrada para los correos (04/11): antes «Avisos y correos»
        // (Alumnos) y «Correos» (Captación) eran dos.
        href: '/dash/avisos',
        label: 'Correos y avisos',
        icon: I(EnvelopeSimple),
        tambien: ['/dash/estadisticas?tab=correos'],
        es: (p) => p.includes('/dash/avisos'),
        claves: 'email newsletter black friday ebook campaña systeme reserva',
      },
    ],
  },
  {
    titulo: 'Formación',
    items: [
      { href: '/dash/courses', label: 'Cursos', icon: I(BookOpen), claves: 'formacion clases modulos' },
      // El tablero de los profes (04/11), el mismo que ven ellos en la escuela.
      { href: '/dash/estadisticas?tab=profes', label: 'Clases de los profes', icon: I(ChalkboardTeacher), claves: 'profesores masterclass spreekclub presentacion grabacion' },
      { href: '/dash/workflows', label: 'Automatizaciones', icon: I(Lightning), claves: 'workflows' },
    ],
  },
  {
    titulo: 'Web',
    items: [
      {
        // Una sola entrada para la web (08/11/2026): las páginas, los enlaces
        // cortos, la lista técnica y los UTM, como pestañas de /dash/webs.
        href: '/dash/webs',
        label: 'Web',
        icon: I(Globe),
        tambien: ['/dash/estadisticas?tab=paginas'],
        es: (p) => p.includes('/dash/webs'),
        claves: 'paginas landing embudo admision redirecciones utm enlaces cortos',
      },
    ],
  },
  {
    titulo: 'Escuela',
    items: [
      { href: '/dash/users/settings/usergroups', label: 'Equipo y grupos', icon: I(UsersThree), es: (p) => p.includes('/usergroups'), claves: 'profes closers testers' },
      { href: '/dash/org/settings/general', label: 'Ajustes', icon: I(GearSix), es: (p) => p.includes('/dash/org'), claves: 'logo favicon organizacion' },
    ],
  },
]

/**
 * Lo que ve el closer: lo de vender, sus KPIs y las páginas de la web. Nada
 * de "Estadísticas" salvo que el administrador le abra los Números: con esa
 * entrada delante no sabía qué era cada cosa.
 */
export function gruposDelCloser(veNumeros: boolean): Grupo[] {
  const todos = GRUPOS_DEL_PANEL.flatMap((g) => g.items)
  const por = (label: string) => todos.find((i) => i.label === label) as Item
  // Contactos otra vez (03/11, usuario: "lo deberían ver los closers
  // también"), los mismos que el administrador. Del 08/10 al 03/11 no lo tenía.
  const numeros: Item[] = [por('KPIs')]
  if (veNumeros) {
    numeros.push({ ...por('Estadísticas'), href: '/dash/estadisticas?tab=numeros', label: 'Números', es: undefined })
  }
  return [
    { titulo: '', items: [INICIO] },
    { titulo: 'Vender', items: [por('Matrículas'), por('Llamadas'), por('Contactos'), por('Tareas'), por('Material de venta'), { ...ESTUDIO, label: 'Apuntes de ventas' }] },
    { titulo: 'Números', items: numeros },
    // El closer no entra en /dash/webs: ve solo las páginas de la web, en Estadísticas.
    { titulo: 'Web', items: [{ href: '/dash/estadisticas?tab=paginas', label: 'Páginas de la web', icon: I(Globe), claves: 'landing embudo admision' }] },
  ]
}

export function activo(item: Item, pathname: string, search: string): boolean {
  const completo = `${pathname}${search}`
  const igual = (h: string) => completo === h || completo.startsWith(h + '&')
  if (item.href.includes('?') && igual(item.href)) return true
  if (item.tambien?.some(igual)) return true
  if (item.es) return item.es(pathname, search)
  if (item.href.includes('?')) return false
  return !search.includes('tab=') && (pathname === item.href || pathname.startsWith(item.href + '/'))
}

function sinAcentos(t: string): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Las entradas que casan con lo buscado (por el nombre o sus palabras clave). */
export function buscarEnPanel(grupos: Grupo[], q: string): Item[] {
  const t = sinAcentos(q.trim())
  if (!t) return []
  return grupos
    .flatMap((g) => g.items)
    .filter((it) => sinAcentos(`${it.label} ${it.claves || ''}`).includes(t))
}

const CLAVE_PLEGADOS = 'nawar.panel.plegados'

export default function NawarSidebar() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const [search, setSearch] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [plegados, setPlegados] = useState<string[]>([])
  const { isCloser } = useAdminStatus()
  const closerVeNumeros = useCloserVeNumeros(isCloser)

  useEffect(() => {
    // Los enlaces a pestañas llevan ?tab=; la ruta sola no lo sabe.
    const leer = () => setSearch(typeof window !== 'undefined' ? window.location.search : '')
    leer()
    window.addEventListener('popstate', leer)
    const id = window.setInterval(leer, 400)
    return () => {
      window.removeEventListener('popstate', leer)
      window.clearInterval(id)
    }
  }, [pathname])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dash-menu-collapsed')
      if (saved !== null) setIsCollapsed(saved === 'true')
      const p = JSON.parse(localStorage.getItem(CLAVE_PLEGADOS) || '[]')
      if (Array.isArray(p)) setPlegados(p.filter((x) => typeof x === 'string'))
    } catch {}
  }, [])

  const toggle = () => {
    const v = !isCollapsed
    setIsCollapsed(v)
    try {
      localStorage.setItem('dash-menu-collapsed', String(v))
    } catch {}
  }

  const plegar = (titulo: string) => {
    const nuevos = plegados.includes(titulo) ? plegados.filter((t) => t !== titulo) : [...plegados, titulo]
    setPlegados(nuevos)
    try {
      localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(nuevos))
    } catch {}
  }

  const salir = async () => {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org?.slug, '/login') })
  }

  if (!org || !session) return null

  // El closer: lo suyo (gruposDelCloser), y Números si se los abren.
  const grupos = isCloser ? gruposDelCloser(closerVeNumeros) : GRUPOS_DEL_PANEL
  const encontrados = buscarEnPanel(grupos, buscar)

  const fila = (it: Item) => {
    const on = activo(it, pathname, search)
    return (
      <li key={it.href + it.label}>
        <Link
          href={it.href}
          title={isCollapsed ? it.label : undefined}
          onClick={() => setBuscar('')}
          className={cn(
            'flex items-center rounded-lg text-[14px] transition-colors',
            isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-[7px]',
            on ? 'text-white font-semibold' : 'text-white font-medium hover:bg-white/[0.08]'
          )}
          style={on ? { backgroundColor: ACTIVO_SOBRE_MARCA } : undefined}
        >
          <span className={on ? 'text-[#9CCBFF]' : 'text-white/85'}>{it.icon}</span>
          {!isCollapsed && <span className="truncate">{it.label}</span>}
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="Panel"
      className={cn(
        'flex flex-col h-screen sticky top-0 z-overlay text-white transition-all duration-200 shrink-0',
        isCollapsed ? 'w-[68px]' : 'w-[252px]'
      )}
      style={FONDO_MARCA}
    >
      {/* Cabecera: la escuela */}
      <div className={cn('flex items-center h-16 px-3 shrink-0', isCollapsed ? 'justify-center' : 'justify-between')}>
        <Link href="/dash" className={cn('flex items-center min-w-0', isCollapsed ? '' : 'gap-2.5')}>
          {org?.logo_image ? (
            <img src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)} alt={org?.name} className="h-8 w-8 object-contain rounded-lg shrink-0" />
          ) : (
            <span className="h-8 w-8 rounded-lg bg-white/15 text-white text-[13px] font-bold flex items-center justify-center shrink-0">N</span>
          )}
          {!isCollapsed && (
            <span className="flex flex-col min-w-0">
              <span className="text-[13.5px] font-semibold text-white truncate">{org?.name}</span>
              <span className="text-[11px] text-white/75">Panel de control</span>
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <button aria-label="Plegar la barra" onClick={toggle} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
            <SidebarSimple size={17} />
          </button>
        )}
      </div>

      {/* Buscador: "da pereza encontrar todo" (04/11). */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <label className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white/10 focus-within:bg-white/15 border border-white/10 focus-within:border-white/30 transition-colors">
            <MagnifyingGlass size={15} className="text-white/80 shrink-0" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar en el panel"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder:text-white/70 outline-none"
            />
            {buscar ? (
              <button aria-label="Borrar" onClick={() => setBuscar('')} className="text-white/60 hover:text-white">
                <X size={13} weight="bold" />
              </button>
            ) : null}
          </label>
        </div>
      )}

      {/* Grupos */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]">
        {buscar.trim() && !isCollapsed ? (
          encontrados.length ? (
            <ul className="space-y-0.5">{encontrados.map(fila)}</ul>
          ) : (
            <p className="px-3 py-2 text-[12.5px] text-white/60">Nada con «{buscar.trim()}».</p>
          )
        ) : (
          grupos.map((g) => {
            const tieneActivo = g.items.some((it) => activo(it, pathname, search))
            const cerrado = !!g.titulo && plegados.includes(g.titulo) && !tieneActivo && !isCollapsed
            return (
              <div key={g.titulo || 'inicio'}>
                {g.titulo && !isCollapsed ? (
                  <button
                    onClick={() => plegar(g.titulo)}
                    className="w-full flex items-center justify-between px-3 mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/70 hover:text-white"
                    aria-expanded={!cerrado}
                  >
                    {g.titulo}
                    <CaretDown size={11} weight="bold" className={cn('transition-transform', cerrado ? '-rotate-90' : '')} />
                  </button>
                ) : null}
                {cerrado ? null : <ul className="space-y-0.5">{g.items.map(fila)}</ul>}
              </div>
            )
          })
        )}
      </div>

      {/* Pie: la escuela y la persona */}
      <div className="border-t border-white/10 p-2 space-y-0.5">
        <Link
          href="/"
          className={cn('flex items-center rounded-lg text-[13px] text-white font-medium hover:bg-white/[0.08]', isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2')}
          title="Ver la escuela como la ve un alumno"
        >
          <ArrowSquareOut size={18} className="text-white/85" />
          {!isCollapsed && <span>Ver la escuela</span>}
        </Link>
        <div className={cn('flex items-center', isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2')}>
          {/* En su caja: sin ella el avatar salía más grande y pisaba el nombre. */}
          <span className="w-7 h-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center [&_img]:w-7 [&_img]:h-7 [&>*]:!w-7 [&>*]:!h-7">
            <UserAvatar width={28} rounded="rounded-full" shadow="shadow-none" />
          </span>
          {!isCollapsed && (
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-white truncate">{session?.data?.user?.username}</span>
              <span className="block text-[11px] text-white/75 truncate">{session?.data?.user?.email}</span>
            </span>
          )}
          <button onClick={salir} aria-label="Salir" title="Salir" className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
            <SignOut size={17} />
          </button>
        </div>
        {isCollapsed && (
          <button aria-label="Desplegar la barra" onClick={toggle} className="w-full flex justify-center p-2 text-white/60 hover:text-white">
            <SidebarSimple size={17} />
          </button>
        )}
      </div>
    </nav>
  )
}
