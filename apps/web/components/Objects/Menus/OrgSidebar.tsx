'use client'
/**
 * La barra de la escuela, rediseño de noviembre de 2026 (rama `diseno`).
 *
 * Como Circle o ICO: arriba una franja azul con el logo, las secciones
 * principales y los avisos; a la izquierda una barra CLARA con todo ordenado
 * por bloques, y cada bloque con sus subpáginas a la vista:
 *
 *   Inicio (el feed)
 *   Formación   → la formación, mi progreso, mis notas
 *   Mis clases  → esta semana, tareas, clases grabadas, calendario
 *   Comunidad   → cada canal, con su emoji y sus mensajes sin leer
 *   Ayuda       → consultas, mensajes, recursos
 *   Equipo / Panel, solo a quien le toca.
 *
 * Antes todo lo de la clase en directo vivía dentro de la página del curso
 * (la masterclass, la clase semanal, Groep rood…) y el alumno tenía que saber
 * cuál era la suya. Ahora «Mis clases» enseña SOLO las suyas y nunca el
 * nombre del grupo.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useUnreadCommunity } from '@/hooks/queries/useUnreadCommunity'
import { useCursosEnDirecto } from '@/hooks/queries/useCursosEnDirecto'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { getCommunities, type Community } from '@services/communities/communities'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import { esCanalDeInicio, ordenDeInicio } from '@/lib/nawar/empiezaAqui'
import { CURSO_FORMACION_UUID as FORMACION_UUID } from '@/lib/nawar/cursos'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { HeaderProfileBox } from '@components/Security/HeaderProfileBox'
import NotificationsBell from '@components/Objects/Menus/NotificationsBell'
import MessagesBell from '@components/Objects/Menus/MessagesBell'
import { PANEL_EN_LA_ESCUELA, DashboardMenuItem } from '@/lib/dashboard-menu-items'
import { isFeatureAvailable } from '@services/plans/plans'
import {
  House,
  Flag,
  Books,
  ChartLineUp,
  NotePencil,
  VideoCamera,
  ClipboardText,
  PlayCircle,
  CalendarBlank,
  Question,
  ChatCircleDots,
  Envelope,
  FolderSimple,
  Kanban,
  ChartBar,
  Hash,
  List,
  X,
} from '@phosphor-icons/react'

const NAVY = '#1D0084'

type Item = {
  key: string
  href: string
  label: string
  icon?: React.ReactNode
  emoji?: string | null
  badge?: number
  alerta?: boolean
  /** Activo solo con la ruta exacta (no con las que empiezan igual). */
  exacta?: boolean
}

type Bloque = { titulo?: string; items: Item[] }

const canalId = (uuid: string) => String(uuid || '').replace('community_', '')

/** Los canales que ve esta persona (el servidor ya filtra por grupos). */
function useCanales() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  return useQuery<Community[]>({
    queryKey: ['comunidad', 'canales', org?.id],
    queryFn: async () => {
      const r = await getCommunities(org.id, 1, 50, null, token)
      return Array.isArray(r) ? r : []
    },
    enabled: !!org?.id && !!token,
    staleTime: 5 * 60_000,
  })
}

export const OrgSidebar = (props: { orgslug: string }) => {
  const orgslug = props.orgslug
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const [abierta, setAbierta] = useState(false)
  const { data: sinLeer } = useUnreadCommunity()
  const { data: enDirecto } = useCursosEnDirecto()
  const { data: canales } = useCanales()
  const { isProfe, isAdmin: puedeEntrarAlPanel, isStaff, isCloser } = useAdminStatus()
  const autenticado = session?.status === 'authenticated'
  const isAdmin = autenticado && puedeEntrarAlPanel
  const rf = org?.config?.config?.resolved_features

  useEffect(() => setAbierta(false), [pathname])

  const ruta = (href: string) => getUriWithOrg(orgslug, href)
  const base = ruta('/').replace(/\/$/, '')
  const actual = pathname.replace(base, '') || '/'
  const activo = (it: Item) => {
    const h = it.href.split('#')[0].split('?')[0]
    if (h === '/') return actual === '/'
    return it.exacta ? actual === h : actual === h || actual.startsWith(h + '/')
  }

  const sinLeerDe = (uuid: string) => (sinLeer || []).find((r) => r.community_uuid === uuid)
  const tieneClases = (enDirecto || []).length > 0 || isStaff

  const itemCanal = (c: Community): Item => {
    const { emoji, text } = splitChannelEmoji(c.name)
    const u = sinLeerDe(c.community_uuid)
    return {
      key: c.community_uuid,
      href: `/community/${canalId(c.community_uuid)}`,
      label: text,
      emoji,
      icon: <Hash size={16} weight="bold" />,
      badge: u?.unread || 0,
      alerta: (u?.mentions || 0) > 0,
    }
  }
  const canalesInicio = (canales || []).filter((c) => esCanalDeInicio(c.name)).sort((a, b) => ordenDeInicio(a.name) - ordenDeInicio(b.name))
  const canalesComunidad = (canales || []).filter((c) => !esCanalDeInicio(c.name))

  const bloques: Bloque[] = [
    { items: [{ key: 'inicio', href: '/', label: 'Inicio', icon: <House size={18} weight="duotone" /> }] },
    {
      titulo: 'Empieza aquí',
      items: [
        { key: 'bienvenida', href: '/empieza-aqui', label: 'Bienvenida', icon: <Flag size={18} weight="duotone" /> },
        ...canalesInicio.map(itemCanal),
      ],
    },
    {
      titulo: 'Formación',
      items: [
        { key: 'formacion', href: `/course/${FORMACION_UUID}`, label: 'Formación A0-A1', icon: <Books size={18} weight="duotone" /> },
        { key: 'progreso', href: '/ejercicios/progreso', label: 'Mi progreso', icon: <ChartLineUp size={18} weight="duotone" /> },
        { key: 'notas', href: '/mis-notas', label: 'Mis notas', icon: <NotePencil size={18} weight="duotone" /> },
      ],
    },
    ...(tieneClases
      ? [
          {
            titulo: 'Mis clases',
            items: [
              { key: 'clases', href: '/clases', label: 'Esta semana', icon: <VideoCamera size={18} weight="duotone" />, exacta: true },
              { key: 'tareas', href: '/clases/tareas', label: 'Tareas', icon: <ClipboardText size={18} weight="duotone" /> },
              { key: 'grabadas', href: '/clases/grabadas', label: 'Clases grabadas', icon: <PlayCircle size={18} weight="duotone" /> },
              { key: 'calendario', href: '/calendario', label: 'Calendario', icon: <CalendarBlank size={18} weight="duotone" /> },
              ...(isStaff && !isAdmin
                ? [
                    { key: 'tablero', href: '/mis-clases', label: 'Preparar clases', icon: <Kanban size={18} weight="duotone" /> },
                    { key: 'seguimiento', href: '/seguimiento', label: 'Seguimiento', icon: <ChartBar size={18} weight="duotone" /> },
                  ]
                : []),
            ] as Item[],
          },
        ]
      : []),
    ...(canalesComunidad.length ? [{ titulo: 'Comunidad', items: canalesComunidad.map(itemCanal) }] : []),
    {
      titulo: 'Ayuda',
      items: [
        { key: 'consultas', href: '/consultas', label: 'Consultas', icon: <Question size={18} weight="duotone" /> },
        { key: 'mis-consultas', href: '/mis-consultas', label: 'Mis consultas', icon: <ChatCircleDots size={18} weight="duotone" /> },
        { key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={18} weight="duotone" /> },
        ...(!isAdmin && !isCloser ? [{ key: 'recursos', href: '/recursos', label: 'Recursos', icon: <FolderSimple size={18} weight="duotone" /> }] : []),
        ...(isStaff ? [{ key: 'responder', href: '/responder-consultas', label: 'Responder consultas', icon: <Question size={18} weight="duotone" /> }] : []),
      ],
    },
  ]

  const panel = isAdmin
    ? PANEL_EN_LA_ESCUELA.filter((item: DashboardMenuItem) => {
        if (isProfe && !item.forProfe) return false
        if (!item.featureKey) return true
        if (rf?.[item.featureKey]) return rf[item.featureKey].enabled
        return isFeatureAvailable(item.featureKey)
      })
    : []

  // Las secciones de arriba: lo mismo que la barra, en grande.
  const arriba: Item[] = [
    { key: 'inicio', href: '/', label: 'Inicio' },
    { key: 'formacion', href: `/course/${FORMACION_UUID}`, label: 'Formación' },
    ...(tieneClases ? [{ key: 'clases', href: '/clases', label: 'Clases' }] : []),
    { key: 'comunidad', href: '/communities', label: 'Comunidad' },
    { key: 'calendario', href: '/calendario', label: 'Calendario' },
  ]
  const arribaActivo = (it: Item) =>
    it.key === 'comunidad' ? actual.startsWith('/communit') : it.key === 'clases' ? actual.startsWith('/clases') : activo(it)

  const Fila = ({ it }: { it: Item }) => {
    const on = activo(it)
    return (
      <Link
        href={ruta(it.href)}
        className={`group flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[14px] transition-colors ${
          on ? 'bg-[#1D0084] text-white font-semibold' : 'text-[#2B3150] hover:bg-[#EEF2FA] font-medium'
        }`}
      >
        <span className={`w-5 shrink-0 flex justify-center ${on ? 'text-white' : 'text-[#6B7393] group-hover:text-[#1D0084]'}`}>
          {it.emoji ? <span className="text-[15px] leading-none">{it.emoji}</span> : it.icon}
        </span>
        <span className="truncate flex-1">{it.label}</span>
        {it.badge ? (
          <span
            className={`shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
              it.alerta ? 'bg-rose-500 text-white' : on ? 'bg-white/20 text-white' : 'bg-[#E3EBFA] text-[#1D0084]'
            }`}
          >
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        ) : null}
      </Link>
    )
  }

  const Barra = () => (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {bloques.map((b, i) => (
          <div key={b.titulo || i}>
            {b.titulo ? (
              <p className="px-2.5 pb-1.5 text-[12px] font-semibold text-[#8A91AD]">{b.titulo}</p>
            ) : null}
            <div className="space-y-0.5">
              {b.items.map((it) => (
                <Fila key={it.key} it={it} />
              ))}
            </div>
          </div>
        ))}
        {panel.length > 0 && (
          <div>
            <p className="px-2.5 pb-1.5 text-[12px] font-semibold text-[#8A91AD]">Panel</p>
            <div className="space-y-0.5">
              {panel.map((item) => {
                const Icon = item.icon
                const on = pathname.includes(item.href)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`group flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[14px] transition-colors ${
                      on ? 'bg-[#1D0084] text-white font-semibold' : 'text-[#2B3150] hover:bg-[#EEF2FA] font-medium'
                    }`}
                  >
                    <span className={`w-5 shrink-0 flex justify-center ${on ? 'text-white' : 'text-[#6B7393]'}`}>
                      <Icon size={18} weight="duotone" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        {autenticado && isCloser && (
          <Fila it={{ key: 'panel-closer', href: '/dash/estadisticas?tab=matriculas', label: 'Panel de ventas', icon: <ChartBar size={18} weight="duotone" /> }} />
        )}
      </nav>
      <div className="px-2 py-2 border-t border-[#E6EAF3]">
        <HeaderProfileBox />
      </div>
    </div>
  )

  const LOGO_NAWAR = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'
  const logo = org?.logo_image ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image) : LOGO_NAWAR
  // Si el logo de la escuela no carga, el de Nawar (nunca el icono roto).
  const sinRomper = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.src !== LOGO_NAWAR) img.src = LOGO_NAWAR
    else img.style.visibility = 'hidden'
  }

  return (
    <>
      {/* Franja de arriba, en todas las pantallas. */}
      <header
        className="fixed top-0 inset-x-0 h-14 flex items-center gap-3 px-3 md:px-5"
        style={{ backgroundColor: NAVY, zIndex: 'var(--z-nav)' }}
      >
        <button
          onClick={() => setAbierta(true)}
          aria-label="Menú"
          className="md:hidden p-1.5 -ml-1 rounded-lg text-white/85 hover:bg-white/10"
        >
          <List size={22} weight="bold" />
        </button>
        <Link href={ruta('/')} className="flex items-center h-8 shrink-0 md:w-[236px]">
          <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
        </Link>
        <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
          {arriba.map((it) => {
            const on = arribaActivo(it)
            return (
              <Link
                key={it.key}
                href={ruta(it.href)}
                className={`h-8 px-3.5 rounded-lg text-[13.5px] font-semibold flex items-center transition-colors ${
                  on ? 'bg-white text-[#1D0084]' : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto md:ml-0 flex items-center gap-1 shrink-0">
          <MessagesBell orgslug={orgslug} />
          <NotificationsBell orgslug={orgslug} />
        </div>
      </header>

      {/* La barra clara del ordenador. */}
      <aside className="hidden md:flex flex-col w-[260px] shrink-0 sticky top-14 h-[calc(100dvh-3.5rem)] bg-white border-r border-[#E6EAF3]">
        {Barra()}
      </aside>

      {/* La misma barra en el móvil, por encima. */}
      {abierta && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 'var(--z-nav-menu)' }}>
          <div className="absolute inset-0 bg-[#0a1656]/40" onClick={() => setAbierta(false)} />
          <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85%] bg-white flex flex-col shadow-xl">
            <div className="h-14 flex items-center justify-between px-3 border-b border-[#E6EAF3]">
              <img src={logo} alt="" onError={sinRomper} className="h-8 w-auto rounded-md" />
              <button onClick={() => setAbierta(false)} aria-label="Cerrar" className="p-2 rounded-lg text-[#6B7393] hover:bg-[#EEF2FA]">
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{Barra()}</div>
          </aside>
        </div>
      )}
    </>
  )
}

export default OrgSidebar
