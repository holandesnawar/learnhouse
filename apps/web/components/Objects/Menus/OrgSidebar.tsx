'use client'
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { HeaderProfileBox } from '@components/Security/HeaderProfileBox'
import { DASHBOARD_MENU_ITEMS, DashboardMenuItem } from '@/lib/dashboard-menu-items'
import { isFeatureAvailable } from '@services/plans/plans'
import {
  Books,
  House,
  CalendarBlank,
  Barbell,
  SquaresFour,
  ChatsCircle,
  Headphones,
  Cube,
  ShoppingBag,
  Signpost,
  ChalkboardSimple,
  ChatCircle,
  Question,
  VideoCamera,
  NotePencil,
  ChatCircleDots,
  List,
  X,
} from '@phosphor-icons/react'
// Iconos del "modo enfoque" — los mismos que el sidebar de lecciones del curso,
// para que abrir/cerrar la barra se vea igual dentro y fuera de una lección.
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

// Holandés Nawar — superficie de la barra: AZUL NAVY profundo (no morado).
// El #1D0084 de marca tira a violeta en plano; aquí usamos un azul más
// limpio + glow azul (#0b6df0) como las secciones oscuras de holandesnawar.com.
// Si hay que afinar el tono, se cambian estos valores.
const SIDE_BASE = '#1D0084' // azul Nawar — base sólida (SIEMPRE este)
const SIDE_SOLID = '#1D0084' // superficies finas (botón flotante)
const ACTIVE_BG = 'rgba(77,163,255,0.20)' // #4da3ff (ítem activo)
const THEME_DARK = SIDE_BASE // color oscuro para subcomponentes (texto blanco)

type NavItem = {
  key: string
  href: string
  label: string
  icon: React.ReactNode
  show: boolean
}

export const OrgSidebar = (props: { orgslug: string }) => {
  const orgslug = props.orgslug
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname()
  const { t } = useTranslation()
  const { rights } = useAdminStatus()
  const [isOpen, setIsOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop collapse
  const [isFocusMode, setIsFocusMode] = useState(false)

  const config = org?.config?.config

  const surfaceStyle: React.CSSProperties = {
    // "Azul Nawar con fade": base sólida #1D0084 + 2 glows #0b6df0 en esquinas
    // + patrón de puntos blancos al 6%.
    backgroundColor: SIDE_BASE,
    backgroundImage:
      'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
      'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
      'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
    backgroundSize: '28px 28px, auto, auto',
    backgroundRepeat: 'repeat, no-repeat, no-repeat',
  }

  const rf = config?.resolved_features
  const isEnabled = (f: string) => rf?.[f]?.enabled === true
  const isAuthenticated = session?.status === 'authenticated'
  const isAdmin = isAuthenticated && rights?.dashboard?.action_access

  // Load the collapse preference (desktop only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(localStorage.getItem('lh-sidebar-collapsed') === 'true')
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('lh-sidebar-collapsed', String(next))
      } catch {}
      return next
    })
  }

  // Focus mode (desktop): when the sidebar is collapsed, reserve a little space
  // on the left so the floating "show sidebar" button doesn't cover the page
  // title. The layout reads --org-collapsed-pad for the content padding.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.setProperty('--org-collapsed-pad', collapsed ? '56px' : '0px')
    return () => root.style.setProperty('--org-collapsed-pad', '0px')
  }, [collapsed])

  // Hide the nav while reading an activity in focus mode (mirrors OrgMenu behaviour)
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname?.includes('/activity/')) {
      setIsFocusMode(localStorage.getItem('globalFocusMode') === 'true')
    } else {
      setIsFocusMode(false)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'globalFocusMode' && pathname?.includes('/activity/')) {
        setIsFocusMode(e.newValue === 'true')
      }
    }
    const onFocus = (e: any) => {
      if (pathname?.includes('/activity/')) setIsFocusMode(e.detail.isFocusMode)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focusModeChange', onFocus as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focusModeChange', onFocus as EventListener)
    }
  }, [pathname])

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  if (pathname?.includes('/activity/') && isFocusMode) return null

  const navItems: NavItem[] = [
    { key: 'home', href: '/', label: 'Inicio', icon: <House size={20} weight="fill" />, show: true },
    { key: 'courses', href: '/course/8a1d1fab-ffbb-44ef-8f21-04ef63676d6e', label: 'Formación', icon: <Books size={20} weight="fill" />, show: isEnabled('courses') },
    { key: 'ejercicios', href: '/ejercicios', label: 'Ejercicios', icon: <Barbell size={20} weight="fill" />, show: true },
    { key: 'calendario', href: '/calendario', label: 'Eventos', icon: <CalendarBlank size={20} weight="fill" />, show: true },
    { key: 'clase-semanal', href: '/course/bfbcb42b-7dc3-4448-9df8-5d7b96135859', label: 'Clase semanal', icon: <VideoCamera size={20} weight="fill" />, show: true },
    { key: 'collections', href: '/collections', label: t('collections.collections'), icon: <SquaresFour size={20} weight="fill" />, show: isEnabled('collections') },
    { key: 'podcasts', href: '/podcasts', label: t('podcasts.podcasts'), icon: <Headphones size={20} weight="fill" />, show: isEnabled('podcasts') },
    { key: 'communities', href: '/communities', label: t('communities.title'), icon: <ChatsCircle size={20} weight="fill" />, show: isEnabled('communities') },
    { key: 'playgrounds', href: '/playgrounds', label: 'Playgrounds', icon: <Cube size={20} weight="fill" />, show: false },
    { key: 'store', href: '/store', label: 'Store', icon: <ShoppingBag size={20} weight="fill" />, show: isEnabled('payments') },
    { key: 'consultas', href: '/consultas', label: 'Consultas', icon: <Question size={20} weight="fill" />, show: true },
  ]

  // "Tu espacio" — zona personal del alumno (separada de las páginas generales).
  const personalItems: NavItem[] = [
    { key: 'mis-consultas', href: '/mis-consultas', label: 'Mis consultas', icon: <ChatCircleDots size={20} weight="fill" />, show: isAuthenticated },
    { key: 'mis-notas', href: '/mis-notas', label: 'Mis notas', icon: <NotePencil size={20} weight="fill" />, show: isAuthenticated },
  ]

  const authItems: NavItem[] = [
    { key: 'trail', href: '/trail', label: t('courses.progress'), icon: <Signpost size={20} weight="fill" />, show: isAuthenticated },
    { key: 'boards', href: '/boards', label: 'Boards', icon: <ChalkboardSimple size={20} weight="fill" />, show: false },
    { key: 'copilot', href: '/copilot', label: 'Copilot', icon: <ChatCircle size={20} weight="fill" />, show: false },
  ]

  const dashItems = DASHBOARD_MENU_ITEMS.filter((item: DashboardMenuItem) => {
    if (!item.featureKey) return true
    if (rf?.[item.featureKey]) return rf[item.featureKey].enabled
    return isFeatureAvailable(item.featureKey)
  })

  const isActive = (href: string) => {
    if (!pathname) return false
    if (href === '/') return pathname === '/' || pathname === getUriWithOrg(orgslug, '/')
    return pathname.includes(href)
  }

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'text-white' : 'text-white/85 hover:text-white hover:bg-white/[0.06]'
    }`
  const itemStyle = (active: boolean) => (active ? { backgroundColor: ACTIVE_BG } : undefined)

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    return (
      <Link href={getUriWithOrg(orgslug, item.href)} className={itemClass(active)} style={itemStyle(active)}>
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  const Logo = ({ height }: { height: number }) => (
    <Link href={getUriWithOrg(orgslug, '/')} className="flex items-center" style={{ height }}>
      {org?.logo_image ? (
        <img
          src={`${getOrgLogoMediaDirectory(org.org_uuid, org?.logo_image)}`}
          alt={org?.name || 'Logo'}
          style={{ height: '100%', width: 'auto' }}
          className="rounded-md"
        />
      ) : (
        <img
          src="https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png"
          alt="Holandés Nawar"
          style={{ height: '100%', width: 'auto' }}
          className="rounded-md"
        />
      )}
    </Link>
  )

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <Logo height={34} />
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Ocultar barra lateral"
          title="Modo enfoque"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-3 pt-1">
        {navItems.filter((i) => i.show).map((i) => (
          <NavLink key={i.key} item={i} />
        ))}
        {personalItems.some((i) => i.show) && (
          <>
            <div className="my-2 border-t border-white/10" />
            <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              Tu espacio
            </p>
            {personalItems.filter((i) => i.show).map((i) => (
              <NavLink key={i.key} item={i} />
            ))}
          </>
        )}
        {authItems.some((i) => i.show) && <div className="my-2 border-t border-white/10" />}
        {authItems.filter((i) => i.show).map((i) => (
          <NavLink key={i.key} item={i} />
        ))}
        {isAdmin && dashItems.length > 0 && (
          <>
            <div className="my-2 border-t border-white/10" />
            <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              {t('common.dashboard')}
            </p>
            {dashItems.map((item) => {
              const Icon = item.icon
              const active = !!pathname?.includes(item.href)
              return (
                <Link key={item.id} href={item.href} className={itemClass(active)} style={itemStyle(active)}>
                  <span className="shrink-0">
                    <Icon size={20} weight="fill" />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              )
            })}
          </>
        )}
      </nav>
      <div className="px-3 py-3 border-t border-white/10">
        <HeaderProfileBox primaryColor={THEME_DARK} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`${collapsed ? 'hidden' : 'hidden md:flex'} flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-white/10`}
        style={surfaceStyle}
      >
        <SidebarInner />
      </aside>

      {/* Desktop "show sidebar" button (visible when collapsed) — same look and
          icon as the course lesson focus mode. */}
      {collapsed && (
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex fixed top-4 left-4 items-center justify-center text-[#025dc7] hover:text-[#4da3ff] transition-colors"
          style={{ zIndex: 'var(--z-nav)' }}
          aria-label="Mostrar barra lateral"
          title="Salir del modo enfoque"
        >
          <PanelLeftOpen size={22} />
        </button>
      )}

      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 inset-x-0 h-14 flex items-center justify-between px-4 border-b border-white/10"
        style={{ ...surfaceStyle, zIndex: 'var(--z-nav)' }}
      >
        <Logo height={32} />
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Menu"
          className="p-2 rounded-lg text-white/80 hover:bg-white/[0.06]"
        >
          <List size={24} weight="bold" />
        </button>
      </header>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 'var(--z-nav-menu)' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <aside
            className="absolute left-0 top-0 h-full w-72 max-w-[80%] shadow-xl flex flex-col"
            style={surfaceStyle}
          >
            <div className="flex justify-end p-2">
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="p-2 rounded-lg text-white/80 hover:bg-white/[0.06]"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarInner />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

export default OrgSidebar
