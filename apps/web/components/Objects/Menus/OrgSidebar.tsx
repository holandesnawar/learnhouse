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
  CaretDown,
  X,
  ChalkboardTeacher,
} from '@phosphor-icons/react'

import { FONDO_MARCA, ACTIVO_SOBRE_MARCA } from '@/lib/nawar/marca'

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

  // Bloques plegados: abiertos de serie; cada uno decide y se recuerda en el navegador.
  const [plegados, setPlegados] = useState<string[]>([])
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem('nawar.barra.plegados') || '[]')
      if (Array.isArray(v)) setPlegados(v)
    } catch {}
  }, [])
  const plegar = (t: string) =>
    setPlegados((p) => {
      const n = p.includes(t) ? p.filter((x) => x !== t) : [...p, t]
      try {
        localStorage.setItem('nawar.barra.plegados', JSON.stringify(n))
      } catch {}
      return n
    })

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
    { items: [{ key: 'inicio', href: '/', label: 'Inicio', icon: <House size={20} weight="regular" /> }] },
    {
      titulo: 'Empieza aquí',
      items: [
        { key: 'bienvenida', href: '/empieza-aqui', label: 'Bienvenida', icon: <Flag size={20} weight="regular" /> },
        ...canalesInicio.map(itemCanal),
        { key: 'recursos', href: '/recursos', label: 'Recursos', icon: <FolderSimple size={20} weight="regular" /> },
      ],
    },
    {
      titulo: 'Formación',
      items: [
        { key: 'formacion', href: `/course/${FORMACION_UUID}`, label: 'Formación A0-A1', icon: <Books size={20} weight="regular" /> },
        { key: 'progreso', href: '/ejercicios/progreso', label: 'Mi progreso', icon: <ChartLineUp size={20} weight="regular" /> },
        { key: 'notas', href: '/mis-notas', label: 'Mis notas', icon: <NotePencil size={20} weight="regular" /> },
      ],
    },
    ...(tieneClases
      ? [
          {
            titulo: 'Mis clases',
            items: [
              // La página de cada clase, a un clic (08/11: «es difícil llegar hasta ella»).
              ...(enDirecto || []).map((c) => ({
                key: `clase-${c.uuid}`,
                href: `/course/${String(c.uuid).replace(/^course_/, '')}`,
                label: c.nombre,
                icon: <ChalkboardTeacher size={20} weight="regular" />,
              })),
              { key: 'clases', href: '/clases', label: 'Esta semana', icon: <VideoCamera size={20} weight="regular" />, exacta: true },
              { key: 'tareas', href: '/clases/tareas', label: 'Tareas', icon: <ClipboardText size={20} weight="regular" /> },
              { key: 'grabadas', href: '/clases/grabadas', label: 'Clases grabadas', icon: <PlayCircle size={20} weight="regular" /> },
              { key: 'calendario', href: '/calendario', label: 'Calendario', icon: <CalendarBlank size={20} weight="regular" /> },
              ...(isStaff && !isAdmin
                ? [
                    { key: 'tablero', href: '/mis-clases', label: 'Preparar clases', icon: <Kanban size={20} weight="regular" /> },
                    { key: 'seguimiento', href: '/seguimiento', label: 'Seguimiento', icon: <ChartBar size={20} weight="regular" /> },
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
        { key: 'consultas', href: '/consultas', label: 'Consultas', icon: <Question size={20} weight="regular" /> },
        { key: 'mis-consultas', href: '/mis-consultas', label: 'Mis consultas', icon: <ChatCircleDots size={20} weight="regular" /> },
        { key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={20} weight="regular" /> },
        ...(isStaff ? [{ key: 'responder', href: '/responder-consultas', label: 'Responder consultas', icon: <Question size={20} weight="regular" /> }] : []),
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
    it.key === 'comunidad' ? actual.startsWith('/communit') : it.key === 'clases'
      ? actual.startsWith('/clases') || (enDirecto || []).some((c) => actual.startsWith(`/course/${String(c.uuid).replace(/^course_/, '')}`))
      : activo(it)

  // Dos estilos de barra para comparar en la escuela de pruebas (08/11/2026):
  //  - «azul»: la de la escuela de siempre (fondo de marca, letra blanca), de
  //    arriba abajo, con la franja de arriba en blanco a su lado.
  //  - «blanca»: blanca, con toques del azul (lo elegido con el fondo de marca,
  //    iconos y títulos en azul) y la franja de arriba azul.
  // Se cambia abajo en la barra («Probar la barra…») o con ?barra=azul|blanca.
  const [estilo, setEstilo] = useState<'azul' | 'blanca'>('azul')
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('barra')
      const v = q === 'azul' || q === 'blanca' ? q : localStorage.getItem('nawar.barra.estilo')
      if (v === 'azul' || v === 'blanca') setEstilo(v)
      if (q === 'azul' || q === 'blanca') localStorage.setItem('nawar.barra.estilo', q)
    } catch {}
  }, [])
  const cambiarEstilo = () => {
    const n = estilo === 'azul' ? 'blanca' : 'azul'
    setEstilo(n)
    try {
      localStorage.setItem('nawar.barra.estilo', n)
    } catch {}
  }
  const azul = estilo === 'azul'

  const filaCls = (on: boolean) =>
    azul
      ? `group flex items-center gap-3 h-10 px-3 rounded-lg text-[15px] transition-colors ${on ? 'text-white font-semibold' : 'text-white/95 hover:text-white hover:bg-white/[0.07] font-medium'}`
      : `group flex items-center gap-3 h-10 px-3 rounded-lg text-[15px] transition-colors ${on ? 'text-white font-semibold' : 'text-[#2B3150] hover:bg-[#EEF3FF] font-medium'}`
  const filaStyle = (on: boolean): React.CSSProperties | undefined =>
    on ? (azul ? { backgroundColor: ACTIVO_SOBRE_MARCA } : { ...FONDO_MARCA }) : undefined
  const iconoCls = (on: boolean) =>
    `w-5 shrink-0 flex justify-center ${on ? 'text-white' : azul ? 'text-white/80 group-hover:text-white' : 'text-[#0b2da0]'}`
  const tituloCls = azul
    ? 'group w-full flex items-center justify-between px-3 pb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-white/70 hover:text-white'
    : 'group w-full flex items-center justify-between px-3 pb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0b2da0]/80 hover:text-[#0b2da0]'

  const Fila = ({ it }: { it: Item }) => {
    const on = activo(it)
    return (
      <Link href={ruta(it.href)} className={filaCls(on)} style={filaStyle(on)}>
        <span className={iconoCls(on)}>{it.emoji ? <span className="text-[16px] leading-none">{it.emoji}</span> : it.icon}</span>
        <span className="truncate flex-1">{it.label}</span>
        {it.badge ? (
          <span
            className={`shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
              it.alerta ? 'bg-rose-500 text-white' : on ? 'bg-white/25 text-white' : azul ? 'bg-[#4da3ff] text-[#0a1656]' : 'bg-[#E6ECFA] text-[#0b2da0]'
            }`}
          >
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        ) : null}
      </Link>
    )
  }

  const Barra = ({ conLogo = false }: { conLogo?: boolean }) => (
    <div className="flex flex-col h-full">
      {conLogo ? (
        <div className="h-16 shrink-0 flex items-center px-5">
          <Link href={ruta('/')} className="flex items-center h-9">
            <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
          </Link>
        </div>
      ) : null}
      <nav className={`${azul ? 'lh-scroll-light' : ''} flex-1 overflow-y-auto px-3 ${conLogo ? 'pt-2' : 'pt-5'} pb-5 space-y-6`}>
        {bloques.map((b, i) => {
          const cerrado = !!b.titulo && plegados.includes(b.titulo) && !b.items.some(activo)
          return (
            <div key={b.titulo || i}>
              {b.titulo ? (
                <button type="button" onClick={() => plegar(b.titulo!)} aria-expanded={!cerrado} className={tituloCls}>
                  <span>{b.titulo}</span>
                  <CaretDown size={13} weight="bold" className={`transition-transform ${cerrado ? '-rotate-90' : ''} opacity-70 group-hover:opacity-100`} />
                </button>
              ) : null}
              {!cerrado && (
                <div className="space-y-0.5">
                  {b.items.map((it) => (
                    <Fila key={it.key} it={it} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {panel.length > 0 && (
          <div>
            <p className={tituloCls.replace('group w-full flex items-center justify-between', 'block')}>Panel</p>
            <div className="space-y-0.5">
              {panel.map((item) => {
                const Icon = item.icon
                const on = pathname.includes(item.href)
                return (
                  <Link key={item.id} href={item.href} className={filaCls(on)} style={filaStyle(on)}>
                    <span className={iconoCls(on)}>
                      <Icon size={20} weight="regular" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        {autenticado && isCloser && (
          <Fila it={{ key: 'panel-closer', href: '/dash/estadisticas?tab=matriculas', label: 'Panel de ventas', icon: <ChartBar size={20} weight="regular" /> }} />
        )}
      </nav>
      <div className={`px-2 pt-2 pb-1 border-t ${azul ? 'border-white/10' : 'border-[#E6EAF3]'}`}>
        <HeaderProfileBox primaryColor={azul ? '#0b2da0' : ''} />
        <button
          type="button"
          onClick={cambiarEstilo}
          className={`mt-1 w-full text-left px-2 py-1 text-[11.5px] ${azul ? 'text-white/55 hover:text-white' : 'text-[#8A91AD] hover:text-[#0b2da0]'}`}
        >
          Probar la barra {azul ? 'blanca' : 'azul'}
        </button>
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

  const enlacesArriba = (claro: boolean) =>
    arriba.map((it) => {
      const on = arribaActivo(it)
      return (
        <Link
          key={it.key}
          href={ruta(it.href)}
          className={`h-9 px-4 rounded-lg text-[14px] font-semibold flex items-center transition-colors ${
            claro
              ? on
                ? 'bg-[#EAF0FE] text-[#0b2da0]'
                : 'text-[#3B4262] hover:text-[#0B1033] hover:bg-[#F2F5FB]'
              : on
                ? 'bg-white text-[#0b2da0]'
                : 'text-white/90 hover:text-white hover:bg-white/10'
          }`}
        >
          {it.label}
        </Link>
      )
    })

  return (
    <>
      {/* Franja de arriba en el móvil: siempre azul, con el menú. */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 flex items-center gap-3 px-3" style={{ ...FONDO_MARCA, zIndex: 'var(--z-nav)' }}>
        <button onClick={() => setAbierta(true)} aria-label="Menú" className="p-1.5 -ml-1 rounded-lg text-white/85 hover:bg-white/10">
          <List size={22} weight="bold" />
        </button>
        <Link href={ruta('/')} className="flex items-center h-8 shrink-0">
          <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
        </Link>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <MessagesBell orgslug={orgslug} />
          <NotificationsBell orgslug={orgslug} />
        </div>
      </header>

      {/* Franja de arriba en el ordenador: blanca al lado de la barra azul, o azul de lado a lado con la barra blanca. */}
      {azul ? (
        <header
          className="hidden md:flex fixed top-0 right-0 left-[260px] h-14 items-center gap-3 px-5 bg-white border-b border-[#E6EAF3]"
          style={{ zIndex: 'var(--z-nav)' }}
        >
          <nav className="flex-1 flex items-center justify-center gap-2.5">{enlacesArriba(true)}</nav>
          <div className="flex items-center gap-1 shrink-0">
            <MessagesBell orgslug={orgslug} claro />
            <NotificationsBell orgslug={orgslug} claro />
          </div>
        </header>
      ) : (
        <header className="hidden md:flex fixed top-0 inset-x-0 h-14 items-center gap-3 px-5" style={{ ...FONDO_MARCA, zIndex: 'var(--z-nav)' }}>
          <Link href={ruta('/')} className="flex items-center h-8 shrink-0 w-[236px]">
            <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
          </Link>
          <nav className="flex-1 flex items-center justify-center gap-2.5">{enlacesArriba(false)}</nav>
          <div className="flex items-center gap-1 shrink-0">
            <MessagesBell orgslug={orgslug} />
            <NotificationsBell orgslug={orgslug} />
          </div>
        </header>
      )}

      {/* La barra del ordenador. */}
      {azul ? (
        <aside className="hidden md:flex flex-col w-[260px] shrink-0 sticky top-0 -mt-14 h-[100dvh] border-r border-white/10" style={FONDO_MARCA}>
          {Barra({ conLogo: true })}
        </aside>
      ) : (
        <aside className="hidden md:flex flex-col w-[260px] shrink-0 sticky top-14 h-[calc(100dvh-3.5rem)] bg-white border-r border-[#E6EAF3]">
          {Barra({})}
        </aside>
      )}

      {/* La misma barra en el móvil, por encima. */}
      {abierta && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 'var(--z-nav-menu)' }}>
          <div className="absolute inset-0 bg-[#0a1656]/40" onClick={() => setAbierta(false)} />
          <aside
            className={`absolute left-0 top-0 h-full w-[280px] max-w-[85%] flex flex-col shadow-xl ${azul ? '' : 'bg-white'}`}
            style={azul ? FONDO_MARCA : undefined}
          >
            <div className={`h-14 flex items-center justify-between px-3 border-b ${azul ? 'border-white/10' : 'border-[#E6EAF3]'}`}>
              <img src={logo} alt="" onError={sinRomper} className="h-8 w-auto rounded-md" />
              <button
                onClick={() => setAbierta(false)}
                aria-label="Cerrar"
                className={`p-2 rounded-lg ${azul ? 'text-white/80 hover:bg-white/10' : 'text-[#6B7393] hover:bg-[#EEF2FA]'}`}
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{Barra({})}</div>
          </aside>
        </div>
      )}
    </>
  )
}

export default OrgSidebar
