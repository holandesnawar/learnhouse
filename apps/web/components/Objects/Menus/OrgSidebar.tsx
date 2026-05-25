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
import { SearchBar } from '@components/Objects/Search/SearchBar'
import { DASHBOARD_MENU_ITEMS, DashboardMenuItem } from '@/lib/dashboard-menu-items'
import { isFeatureAvailable } from '@services/plans/plans'
import {
  Books,
  SquaresFour,
  ChatsCircle,
  Headphones,
  Cube,
  ShoppingBag,
  Signpost,
  ChalkboardSimple,
  ChatCircle,
  List,
  X,
} from '@phosphor-icons/react'

type NavItem = {
  key: string
  href: string
  label: string
  icon: React.ReactNode
  show: boolean
}

const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const OrgSidebar = (props: { orgslug: string }) => {
  const orgslug = props.orgslug
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname()
  const { t } = useTranslation()
  const { rights } = useAdminStatus()
  const [isOpen, setIsOpen] = useState(false) // mobile drawer
  const [isFocusMode, setIsFocusMode] = useState(false)

  const config = org?.config?.config
  const primaryColor = config?.customization?.general?.color || config?.general?.color || ''
  const accent = primaryColor || '#111111'
  const rf = config?.resolved_features
  const isEnabled = (f: string) => rf?.[f]?.enabled === true
  const isAuthenticated = session?.status === 'authenticated'
  const isAdmin = isAuthenticated && rights?.dashboard?.action_access

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
    { key: 'courses', href: '/courses', label: t('courses.courses'), icon: <Books size={20} weight="fill" />, show: isEnabled('courses') },
    { key: 'collections', href: '/collections', label: t('collections.collections'), icon: <SquaresFour size={20} weight="fill" />, show: isEnabled('collections') },
    { key: 'podcasts', href: '/podcasts', label: t('podcasts.podcasts'), icon: <Headphones size={20} weight="fill" />, show: isEnabled('podcasts') },
    { key: 'communities', href: '/communities', label: t('communities.title'), icon: <ChatsCircle size={20} weight="fill" />, show: isEnabled('communities') },
    { key: 'playgrounds', href: '/playgrounds', label: 'Playgrounds', icon: <Cube size={20} weight="fill" />, show: isEnabled('playgrounds') },
    { key: 'store', href: '/store', label: 'Store', icon: <ShoppingBag size={20} weight="fill" />, show: isEnabled('payments') },
  ]

  const authItems: NavItem[] = [
    { key: 'trail', href: '/trail', label: t('courses.progress'), icon: <Signpost size={20} weight="fill" />, show: isAuthenticated },
    { key: 'boards', href: '/boards', label: 'Boards', icon: <ChalkboardSimple size={20} weight="fill" />, show: isAuthenticated && isEnabled('boards') },
    { key: 'copilot', href: '/copilot', label: 'Copilot', icon: <ChatCircle size={20} weight="fill" />, show: isAuthenticated && isEnabled('ai') && config?.admin_toggles?.ai?.copilot_enabled !== false },
  ]

  const dashItems = DASHBOARD_MENU_ITEMS.filter((item: DashboardMenuItem) => {
    if (!item.featureKey) return true
    if (rf?.[item.featureKey]) return rf[item.featureKey].enabled
    return isFeatureAvailable(item.featureKey)
  })

  const isActive = (href: string) => {
    if (!pathname || href === '/') return false
    return pathname.includes(href)
  }

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
      active ? '' : 'text-gray-500 hover:text-gray-900 hover:bg-black/[0.03]'
    }`
  const activeStyle = (active: boolean) =>
    active ? { color: accent, backgroundColor: hexToRgba(accent, 0.1) } : undefined

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    return (
      <Link href={getUriWithOrg(orgslug, item.href)} className={itemClass(active)} style={activeStyle(active)}>
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
        <Image src="/lrn-text.svg" alt="LearnHouse" width={120} height={32} style={{ height: 'auto', maxHeight: height }} />
      )}
    </Link>
  )

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4">
        <Logo height={36} />
      </div>
      <div className="px-3 pb-3">
        <SearchBar orgslug={orgslug} className="w-full" primaryColor={primaryColor} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
        {navItems.filter((i) => i.show).map((i) => (
          <NavLink key={i.key} item={i} />
        ))}
        {authItems.some((i) => i.show) && <div className="my-2 border-t border-black/5" />}
        {authItems.filter((i) => i.show).map((i) => (
          <NavLink key={i.key} item={i} />
        ))}
        {isAdmin && dashItems.length > 0 && (
          <>
            <div className="my-2 border-t border-black/5" />
            <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t('common.dashboard')}
            </p>
            {dashItems.map((item) => {
              const Icon = item.icon
              const active = !!pathname?.includes(item.href)
              return (
                <Link key={item.id} href={item.href} className={itemClass(active)} style={activeStyle(active)}>
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
      <div className="px-3 py-3 border-t border-black/5">
        <HeaderProfileBox primaryColor={primaryColor} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen bg-white border-r border-black/5">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 inset-x-0 h-14 bg-white/90 backdrop-blur-lg border-b border-black/5 flex items-center justify-between px-4"
        style={{ zIndex: 'var(--z-nav)' }}
      >
        <Logo height={32} />
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Menu"
          className="p-2 rounded-lg text-gray-600 hover:bg-black/[0.03]"
        >
          <List size={24} weight="bold" />
        </button>
      </header>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 'var(--z-nav-menu)' }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-xl flex flex-col">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="p-2 rounded-lg text-gray-600 hover:bg-black/[0.03]"
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
