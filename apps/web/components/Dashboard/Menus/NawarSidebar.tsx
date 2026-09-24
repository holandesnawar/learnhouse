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
 * Quitado a propósito: Tareas (no se usan), Analytics (muerta, era de
 * Tinybird), Boards, Podcasts, Playgrounds, Pagos de LearnHouse (el cobro va
 * por Stripe, las facturas están en Estadísticas → Facturas), la paleta de
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
import {
  ArrowSquareOut,
  BookOpen,
  ChartBar,
  ChatsCircle,
  EnvelopeSimple,
  FolderSimple,
  GearSix,
  Lightning,
  Question,
  Receipt,
  SidebarSimple,
  SignOut,
  UserCircle,
  UsersThree,
  AddressBook,
  Globe,
  LinkSimple,
  PhoneCall,
  Scroll,
  Wallet,
} from '@phosphor-icons/react'

type Item = { href: string; label: string; icon: React.ReactNode; match?: (p: string) => boolean }
type Grupo = { titulo: string; items: Item[] }

export const GRUPOS_DEL_PANEL: Grupo[] = [
  {
    titulo: 'Ventas',
    items: [
      { href: '/dash/estadisticas', label: 'Estadísticas', icon: <ChartBar size={18} weight="fill" />, match: (p) => p.includes('/dash/estadisticas') && !p.includes('tab=') },
      { href: '/dash/estadisticas?tab=contactos', label: 'Contactos', icon: <AddressBook size={18} weight="fill" /> },
      { href: '/dash/estadisticas?tab=llamadas', label: 'Llamadas', icon: <PhoneCall size={18} weight="fill" /> },
      { href: '/dash/estadisticas?tab=facturas', label: 'Facturas', icon: <Receipt size={18} weight="fill" /> },
      { href: '/dash/estadisticas?tab=gastos', label: 'Gastos', icon: <Wallet size={18} weight="fill" /> },
      { href: '/dash/estadisticas?tab=guion', label: 'Guion de llamada', icon: <Scroll size={18} weight="fill" /> },
    ],
  },
  {
    titulo: 'Alumnos',
    items: [
      { href: '/dash/users/settings/users', label: 'Usuarios', icon: <UserCircle size={18} weight="fill" />, match: (p) => p.includes('/dash/users') },
      { href: '/dash/communities', label: 'Comunidad', icon: <ChatsCircle size={18} weight="fill" /> },
      { href: '/dash/consultas', label: 'Consultas', icon: <Question size={18} weight="fill" /> },
      { href: '/dash/avisos', label: 'Avisos y correos', icon: <EnvelopeSimple size={18} weight="fill" /> },
    ],
  },
  {
    titulo: 'Formación',
    items: [
      { href: '/dash/courses', label: 'Cursos', icon: <BookOpen size={18} weight="fill" /> },
      { href: '/dash/recursos', label: 'Recursos y documentos', icon: <FolderSimple size={18} weight="fill" /> },
      { href: '/dash/workflows', label: 'Automatizaciones', icon: <Lightning size={18} weight="fill" /> },
    ],
  },
  {
    titulo: 'Web',
    items: [
      { href: '/dash/webs', label: 'Enlaces y redirecciones', icon: <LinkSimple size={18} weight="bold" />, match: (p) => p.includes('/dash/webs') && !p.includes('tab=') },
      { href: '/dash/webs?tab=paginas', label: 'Páginas', icon: <Globe size={18} weight="fill" /> },
      { href: '/dash/webs?tab=utm', label: 'Enlaces UTM', icon: <Globe size={18} weight="regular" /> },
    ],
  },
  {
    titulo: 'Escuela',
    items: [
      { href: '/dash/users/settings/usergroups', label: 'Equipo y grupos', icon: <UsersThree size={18} weight="fill" />, match: (p) => p.includes('/usergroups') },
      { href: '/dash/org/settings/general', label: 'Ajustes', icon: <GearSix size={18} weight="fill" />, match: (p) => p.includes('/dash/org') },
    ],
  },
]

/**
 * Lo que ve el closer: Contactos (solo las matrículas) y Llamadas. Nada de
 * "Estadísticas" salvo que el administrador le abra los Números: con esa
 * entrada delante no sabía qué era cada cosa.
 */
export function gruposDelCloser(veNumeros: boolean): Grupo[] {
  const ventas = GRUPOS_DEL_PANEL[0].items
  const por = (label: string) => ventas.find((i) => i.label === label) as Item
  const items = [por('Contactos'), por('Llamadas'), por('Guion de llamada')]
  if (veNumeros) {
    items.push({ ...por('Estadísticas'), href: '/dash/estadisticas?tab=numeros', label: 'Números', match: undefined })
  }
  return [{ titulo: 'Tu panel', items }]
}

export function activo(item: Item, pathname: string, search: string): boolean {
  const completo = `${pathname}${search}`
  if (item.href.includes('?')) return completo === item.href || completo.startsWith(item.href + '&')
  if (item.match) return item.match(completo) && !completo.includes('tab=')
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function NawarSidebar() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const [search, setSearch] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
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
    } catch {}
  }, [])

  const toggle = () => {
    const v = !isCollapsed
    setIsCollapsed(v)
    try {
      localStorage.setItem('dash-menu-collapsed', String(v))
    } catch {}
  }

  const salir = async () => {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org?.slug, '/login') })
  }

  if (!org || !session) return null

  // El closer: solo Ventas → Contactos (y Estadísticas si se lo abren).
  const grupos = isCloser ? gruposDelCloser(closerVeNumeros) : GRUPOS_DEL_PANEL

  return (
    <nav
      aria-label="Panel"
      className={cn(
        'flex flex-col h-screen sticky top-0 z-overlay bg-white border-r border-[#E6EBF5] transition-all duration-200',
        isCollapsed ? 'w-[68px]' : 'w-[248px]'
      )}
    >
      {/* Cabecera: la escuela */}
      <div className={cn('flex items-center h-16 px-3 shrink-0', isCollapsed ? 'justify-center' : 'justify-between')}>
        <Link href="/dash" className={cn('flex items-center min-w-0', isCollapsed ? '' : 'gap-2.5')}>
          {org?.logo_image ? (
            <img src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)} alt={org?.name} className="h-8 w-8 object-contain rounded-lg shrink-0" />
          ) : (
            <span className="h-8 w-8 rounded-lg bg-[#1D0084] text-white text-[13px] font-bold flex items-center justify-center shrink-0">N</span>
          )}
          {!isCollapsed && (
            <span className="flex flex-col min-w-0">
              <span className="text-[13.5px] font-semibold text-gray-900 truncate">{org?.name}</span>
              <span className="text-[11px] text-gray-400">Panel</span>
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <button aria-label="Plegar" onClick={toggle} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-[#F3F6FC]">
            <SidebarSimple size={17} />
          </button>
        )}
      </div>

      {/* Grupos */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {grupos.map((g) => (
          <div key={g.titulo}>
            {!isCollapsed && (
              <p className="px-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gray-400">{g.titulo}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const on = activo(it, pathname, search)
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      title={isCollapsed ? it.label : undefined}
                      className={cn(
                        'flex items-center rounded-lg text-[13.5px] transition-colors',
                        isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2',
                        on ? 'bg-[#EEF3FF] text-[#1D0084] font-semibold' : 'text-gray-600 hover:bg-[#F5F7FB] hover:text-gray-900'
                      )}
                    >
                      <span className={on ? 'text-[#025dc7]' : 'text-gray-400'}>{it.icon}</span>
                      {!isCollapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Pie: la escuela y la persona */}
      <div className="border-t border-[#E6EBF5] p-2 space-y-0.5">
        <Link
          href="/"
          className={cn('flex items-center rounded-lg text-[13px] text-gray-600 hover:bg-[#F5F7FB] hover:text-gray-900', isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2')}
          title="Ver la escuela como la ve un alumno"
        >
          <ArrowSquareOut size={18} className="text-gray-400" />
          {!isCollapsed && <span>Ver la escuela</span>}
        </Link>
        <div className={cn('flex items-center', isCollapsed ? 'justify-center h-10' : 'gap-2.5 px-3 py-2')}>
          <UserAvatar width={24} rounded="rounded-full" shadow="shadow-none" />
          {!isCollapsed && (
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-gray-900 truncate">{session?.data?.user?.username}</span>
              <span className="block text-[11px] text-gray-400 truncate">{session?.data?.user?.email}</span>
            </span>
          )}
          <button onClick={salir} aria-label="Salir" title="Salir" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
            <SignOut size={17} />
          </button>
        </div>
        {isCollapsed && (
          <button aria-label="Desplegar" onClick={toggle} className="w-full flex justify-center p-2 text-gray-400 hover:text-gray-700">
            <SidebarSimple size={17} />
          </button>
        )}
      </div>
    </nav>
  )
}
