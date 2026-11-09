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
 *   Comunidad   → cada canal, con su icono y sus mensajes sin leer
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
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { getCommunities, type Community } from '@services/communities/communities'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import { IconoCanal } from '@components/Objects/Communities/IconoCanal'
import { esCanalDeInicio, ordenDeInicio } from '@/lib/nawar/empiezaAqui'
import { CURSO_FORMACION_UUID as FORMACION_UUID, ajustesDirecto } from '@/lib/nawar/cursos'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import MenuPerfil from '@components/Objects/Menus/MenuPerfil'
import { FranjaVerComo } from '@components/Objects/VerComo/VerComo'
import VisitaGuiada from '@components/Objects/VisitaGuiada/VisitaGuiada'
import { claveDeBloque, tipoDeClase } from '@/lib/nawar/visitaGuiada'
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
  ChartBar,
  List,
  CaretDown,
  X,
  ChalkboardTeacher,
  SquaresFour,
  SidebarSimple,
  CircleHalf,
  Gauge,
  PresentationChart,
  ChatsCircle,
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
  /** Dirección entera (el panel), sin pasar por la escuela. */
  fuera?: boolean
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
  // ¿Es monitor? (grupo «Monitores», 08/11/2026): solo tiene la sala de
  // profes con su Spreekclub dentro. Lo dice el servidor.
  const [monitor, setMonitor] = useState(false)
  const tokenSesion: string = session?.data?.tokens?.access_token || ''
  useEffect(() => {
    if (!autenticado || !isStaff || !org?.id || !tokenSesion) return
    let vivo = true
    fetch(`${getAPIUrl()}equipo/org/${org.id}/yo`, { headers: { Authorization: `Bearer ${tokenSesion}` }, credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setMonitor(!!d?.monitor))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [autenticado, isStaff, org?.id, tokenSesion])
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
    if (it.fuera) return !it.href.includes('?') && pathname.includes(it.href)
    const h = it.href.split('#')[0].split('?')[0]
    if (h === '/') return actual === '/'
    return it.exacta ? actual === h : actual === h || actual.startsWith(h + '/')
  }

  const sinLeerDe = (uuid: string) => (sinLeer || []).find((r) => r.community_uuid === uuid)
  const tieneClases = (enDirecto || []).length > 0 || isStaff

  // Sin emojis de Apple en la barra (10/11/2026: "está como mix, deja solo los
  // nuestros"): cada canal lleva un icono de la escuela según su nombre.
  const iconoCanal = (texto: string) => <IconoCanal nombre={texto} />
  const itemCanal = (c: Community): Item => {
    const { text } = splitChannelEmoji(c.name)
    const u = sinLeerDe(c.community_uuid)
    return {
      key: c.community_uuid,
      href: `/community/${canalId(c.community_uuid)}`,
      label: text,
      icon: iconoCanal(text),
      badge: u?.unread || 0,
      alerta: (u?.mentions || 0) > 0,
    }
  }
  const canalesInicio = (canales || []).filter((c) => esCanalDeInicio(c.name)).sort((a, b) => ordenDeInicio(a.name) - ordenDeInicio(b.name))
  const canalesComunidad = (canales || []).filter((c) => !esCanalDeInicio(c.name))

  // La barra según quién entra (08/11/2026: «para admin, profe y closer
  // también debería ser más fácil»). Alumno: su camino. Profe: dar clase.
  // Closer: ventas. Administrador: organizar la escuela y todas las clases.
  const esProfe = autenticado && isStaff && !isAdmin
  const esCloser = autenticado && isCloser && !isAdmin && !isStaff
  const conEtiqueta = (c: { uuid: string; nombre: string }) => {
    const et = ajustesDirecto(org?.config?.config, c.uuid).etiqueta
    // «Clase semanal · rood»: entero no cabía en la barra.
    return et ? `${c.nombre} · ${et.replace(/^groep\s+/i, '')}` : c.nombre
  }
  const itemsClases: Item[] = (enDirecto || []).map((c) => ({
    key: `clase-${c.uuid}`,
    href: `/course/${String(c.uuid).replace(/^course_/, '')}`,
    label: isStaff || isAdmin ? conEtiqueta(c) : c.nombre,
    // Un icono por tipo de clase (10/11/2026: la Masterclass no lleva el del Spreken Club).
    icon:
      tipoDeClase(c.nombre) === 'masterclass' ? (
        <PresentationChart size={20} weight="fill" />
      ) : tipoDeClase(c.nombre) === 'conversacion' ? (
        <ChatsCircle size={20} weight="fill" />
      ) : (
        <ChalkboardTeacher size={20} weight="fill" />
      ),
  }))
  const panel = isAdmin
    ? PANEL_EN_LA_ESCUELA.filter((item: DashboardMenuItem) => {
        if (!item.featureKey) return true
        if (rf?.[item.featureKey]) return rf[item.featureKey].enabled
        return isFeatureAvailable(item.featureKey)
      })
    : []
  const inicio: Bloque = { items: [{ key: 'inicio', href: '/', label: 'Inicio', icon: <House size={20} weight="fill" /> }] }
  const empieza: Bloque = {
    titulo: 'Empieza aquí',
    items: [
      { key: 'bienvenida', href: '/empieza-aqui', label: 'Bienvenida', icon: <Flag size={20} weight="fill" /> },
      ...canalesInicio.map(itemCanal),
      { key: 'recursos', href: '/recursos', label: 'Recursos', icon: <FolderSimple size={20} weight="fill" /> },
    ],
  }
  const comunidad: Bloque[] = canalesComunidad.length ? [{ titulo: 'Comunidad', items: canalesComunidad.map(itemCanal) }] : []
  const verFormacion: Item = { key: 'formacion', href: `/course/${FORMACION_UUID}`, label: 'Formación A0-A1', icon: <Books size={20} weight="fill" /> }

  let bloques: Bloque[]
  if (isAdmin) {
    bloques = [
      inicio,
      {
        titulo: 'Gestión',
        items: [
          // El panel entero, como en la escuela de antes (08/11/2026: «falta el general con todo, llamado Panel»).
          { key: 'panel', href: '/dash', label: 'Panel', icon: <Gauge size={20} weight="fill" />, fuera: true },
          { key: 'organizar', href: '/organizar', label: 'Organizar clases', icon: <SquaresFour size={20} weight="fill" /> },
          { key: 'sala', href: '/equipo', label: 'Sala de profesores', icon: <ChalkboardTeacher size={20} weight="fill" /> },
          { key: 'seguimiento', href: '/seguimiento', label: 'Seguimiento', icon: <ChartBar size={20} weight="fill" /> },
          { key: 'responder', href: '/responder-consultas', label: 'Responder consultas', icon: <Question size={20} weight="fill" /> },
          ...panel.map((item) => {
            const Icon = item.icon as any
            return { key: `panel-${item.id}`, href: item.href, label: item.label || ({ estadisticas: 'Estadísticas', users: 'Usuarios', courses: 'Cursos' } as Record<string, string>)[item.id] || item.id, icon: <Icon size={20} weight="fill" />, fuera: true } as Item
          }),
        ],
      },
      { titulo: 'Clases', items: [...itemsClases, { key: 'calendario', href: '/calendario', label: 'Calendario', icon: <CalendarBlank size={20} weight="fill" /> }] },
      { titulo: 'Formación', items: [verFormacion] },
      empieza,
      ...comunidad,
      { titulo: 'Ayuda', items: [{ key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={20} weight="fill" /> }] },
    ]
  } else if (esProfe) {
    // Profes y monitores (08/11/2026, segunda vuelta: "quita que vean tantos
    // links en la barra, solo Sala de profesores y ahí dentro ya ir tocando").
    // Su Inicio ES la sala. El monitor (grupo «Monitores») solo la sala y
    // los mensajes: solo tiene el Spreekclub.
    const sala: Bloque = { items: [{ key: 'inicio', href: '/', label: 'Sala de profesores', icon: <ChalkboardTeacher size={20} weight="fill" /> }] }
    const ayuda: Bloque = { titulo: 'Ayuda', items: [{ key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={20} weight="fill" /> }] }
    // El monitor (10/11/2026, "no puede ver nada… no es así el monitor"):
    // como un profe, más su Spreekclub a la vista.
    const susClases: Bloque[] = monitor && itemsClases.length ? [{ titulo: 'Mis clases', items: itemsClases }] : []
    bloques = [sala, ...susClases, { titulo: 'Formación', items: [verFormacion] }, ...comunidad, ayuda]
  } else if (esCloser) {
    // Solo «Panel» (10/11/2026, usuario: "que ponga solo Panel, para cuando
    // enseñen la escuela por encima no se vea ventas"). Dentro del panel el
    // closer tiene Matrículas, Llamadas, Contactos y lo demás.
    bloques = [
      inicio,
      { items: [{ key: 'panel', href: '/dash', label: 'Panel', icon: <Gauge size={20} weight="fill" />, fuera: true }] },
      { titulo: 'La escuela', items: [verFormacion, ...itemsClases] },
      ...comunidad,
      { titulo: 'Ayuda', items: [{ key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={20} weight="fill" /> }] },
    ]
  } else {
    bloques = [
      inicio,
      empieza,
      {
        titulo: 'Formación',
        items: [
          verFormacion,
          { key: 'progreso', href: '/ejercicios/progreso', label: 'Mi progreso', icon: <ChartLineUp size={20} weight="fill" /> },
          { key: 'notas', href: '/mis-notas', label: 'Mis notas', icon: <NotePencil size={20} weight="fill" /> },
        ],
      },
      ...(tieneClases
        ? [
            {
              titulo: 'Mis clases',
              items: [
                // La página de cada clase, a un clic (08/11: «es difícil llegar hasta ella»).
                ...itemsClases,
                // Una sola página por clase (08/11): «Esta semana», «Tareas» y
                // «Clases grabadas» ya están dentro de la página de cada clase.
                { key: 'calendario', href: '/calendario', label: 'Calendario', icon: <CalendarBlank size={20} weight="fill" /> },
              ] as Item[],
            },
          ]
        : []),
      ...comunidad,
      {
        titulo: 'Ayuda',
        items: [
          { key: 'consultas', href: '/consultas', label: 'Consultas', icon: <Question size={20} weight="fill" /> },
          { key: 'mensajes', href: '/mensajes', label: 'Mensajes', icon: <Envelope size={20} weight="fill" /> },
        ],
      },
    ]
  }

  // Las secciones de arriba: lo mismo que la barra, en grande.
  const arriba: Item[] = [
    { key: 'inicio', href: '/', label: 'Inicio' },
    { key: 'formacion', href: `/course/${FORMACION_UUID}`, label: 'Formación' },
    ...(tieneClases ? [{ key: 'clases', href: itemsClases[0]?.href || '/clases', label: 'Clases' }] : []),
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
  // Lo elige cada uno en su menú de perfil (arriba a la derecha, «Barra
  // lateral»), o con ?barra=azul|blanca. Se guarda en ese navegador.
  const [estilo, setEstilo] = useState<'azul' | 'blanca'>('azul')
  useEffect(() => {
    const leer = () => {
      try {
        const q = new URLSearchParams(window.location.search).get('barra')
        const v = q === 'azul' || q === 'blanca' ? q : localStorage.getItem('nawar.barra.estilo')
        if (v === 'azul' || v === 'blanca') setEstilo(v)
        if (q === 'azul' || q === 'blanca') localStorage.setItem('nawar.barra.estilo', q)
      } catch {}
    }
    leer()
    const alCambiar = (e: Event) => {
      const v = (e as CustomEvent).detail
      if (v === 'azul' || v === 'blanca') setEstilo(v)
    }
    window.addEventListener('nawar-barra', alCambiar)
    return () => window.removeEventListener('nawar-barra', alCambiar)
  }, [])
  const azul = estilo === 'azul'
  // Un clic para cambiar el color de la barra (arriba, al lado de los avisos).
  const cambiarColor = () => {
    const v = azul ? 'blanca' : 'azul'
    setEstilo(v)
    try {
      localStorage.setItem('nawar.barra.estilo', v)
    } catch {}
  }

  // Cerrar la barra en el ordenador (como en la escuela de antes). Se recuerda.
  const [cerrada, setCerrada] = useState(false)
  useEffect(() => {
    try {
      setCerrada(localStorage.getItem('nawar.barra.cerrada') === 'si')
    } catch {}
  }, [])
  const alternarBarra = () =>
    setCerrada((c) => {
      try {
        localStorage.setItem('nawar.barra.cerrada', c ? 'no' : 'si')
      } catch {}
      return !c
    })
  const BotonBarra = ({ claro }: { claro: boolean }) => (
    <button
      type="button"
      onClick={alternarBarra}
      aria-label={cerrada ? 'Abrir la barra lateral' : 'Cerrar la barra lateral'}
      title={cerrada ? 'Abrir la barra lateral' : 'Cerrar la barra lateral'}
      className={`p-2 rounded-lg shrink-0 transition-colors ${claro ? 'text-[#5B6382] hover:text-[#0B1033]' : 'text-white/85 hover:text-white'}`}
    >
      <SidebarSimple size={20} weight="fill" />
    </button>
  )
  const BotonColor = ({ claro }: { claro: boolean }) => (
    <button
      type="button"
      onClick={cambiarColor}
      data-visita="color"
      aria-label="Cambiar el color de la barra"
      title={azul ? 'Barra blanca' : 'Barra azul'}
      className={`p-2 rounded-lg shrink-0 transition-colors ${claro ? 'text-[#5B6382] hover:text-[#0B1033]' : 'text-white/85 hover:text-white'}`}
    >
      <CircleHalf size={20} weight="fill" />
    </button>
  )

  const filaCls = (on: boolean) =>
    azul
      ? `group flex items-center gap-3 h-10 px-3 rounded-lg text-[15px] transition-colors ${on ? 'text-white font-semibold' : 'text-white/95 hover:text-white font-medium'}`
      : `group flex items-center gap-3 h-10 px-3 rounded-lg text-[15px] transition-colors ${on ? 'text-white font-semibold' : 'text-[#2B3150] hover:text-[#0b2da0] font-medium'}`
  const filaStyle = (on: boolean): React.CSSProperties | undefined =>
    on ? (azul ? { backgroundColor: ACTIVO_SOBRE_MARCA } : { ...FONDO_MARCA }) : undefined
  const iconoCls = (on: boolean) =>
    `w-5 shrink-0 flex justify-center ${on ? 'text-white' : azul ? 'text-white' : 'text-[#0b2da0]'}`
  const tituloCls = azul
    ? 'group w-full flex items-center justify-between px-3 pb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-white/95 hover:text-white'
    : 'group w-full flex items-center justify-between px-3 pb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0b2da0]/80 hover:text-[#0b2da0]'

  const Fila = ({ it }: { it: Item }) => {
    const on = activo(it)
    return (
      <Link href={it.fuera ? it.href : ruta(it.href)} className={filaCls(on)} style={filaStyle(on)} data-visita={it.key}>
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
        <div className="h-16 shrink-0 flex items-center justify-between pl-3.5 pr-2">
          <Link href={ruta('/')} className="flex items-center h-9">
            <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
          </Link>
          <BotonBarra claro={false} />
        </div>
      ) : null}
      <nav className={`${azul ? 'lh-scroll-light' : ''} flex-1 overflow-y-auto px-3 ${conLogo ? 'pt-2' : 'pt-5'} pb-5 space-y-6`}>
        {bloques.map((b, i) => {
          const cerrado = !!b.titulo && plegados.includes(b.titulo) && !b.items.some(activo)
          return (
            <div key={b.titulo || i} data-visita={b.titulo ? claveDeBloque(b.titulo) : undefined}>
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
      </nav>
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
          data-visita={`top-${it.key}`}
          href={ruta(it.href)}
          className={`h-9 px-4 rounded-lg text-[14px] font-semibold flex items-center transition-colors ${
            claro
              ? on
                ? 'bg-[#EAF0FE] text-[#0b2da0]'
                : 'text-[#3B4262] hover:text-[#0B1033]'
              : on
                ? 'bg-white text-[#0b2da0]'
                : 'text-white/90 hover:text-white'
          }`}
        >
          {it.label}
        </Link>
      )
    })

  return (
    <>
      {/* Mirando la escuela como un alumno (08/11): para volver a tu cuenta. */}
      <FranjaVerComo />
      {/* Visita guiada (09/11): sola una vez a cada alumno, al entrar al Inicio. */}
      <VisitaGuiada
        clases={(enDirecto || []).map((c: any) => ({ uuid: c.uuid, nombre: c.nombre }))}
        esAlumno={autenticado && !isStaff && !isAdmin && !isCloser}
        enInicio={actual === '/'}
        onMenu={setAbierta}
      />
      {/* Franja de arriba en el móvil (08/11: con el botón de color, como en el
          ordenador): con la barra azul, la franja blanca; con la blanca, azul. */}
      <header
        className={`md:hidden fixed top-0 inset-x-0 h-14 flex items-center gap-3 px-3 ${azul ? 'bg-white border-b border-[#E6EAF3]' : ''}`}
        style={azul ? { zIndex: 'var(--z-nav)' } : { ...FONDO_MARCA, zIndex: 'var(--z-nav)' }}
      >
        <button
          onClick={() => setAbierta(true)}
          data-visita="menu"
          aria-label="Menú"
          className={`p-1.5 -ml-1 rounded-lg ${azul ? 'text-[#3B4262] hover:text-[#0B1033]' : 'text-white/85 hover:text-white'}`}
        >
          <List size={22} weight="bold" />
        </button>
        <Link href={ruta('/')} className="flex items-center h-8 shrink-0">
          <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
        </Link>
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <BotonColor claro={azul} />
          <MessagesBell orgslug={orgslug} claro={azul} />
          <NotificationsBell orgslug={orgslug} claro={azul} />
          <MenuPerfil claro={azul} />
        </div>
      </header>

      {/* Franja de arriba en el ordenador: blanca al lado de la barra azul, o azul de lado a lado con la barra blanca. */}
      {azul ? (
        <header
          className={`hidden md:flex fixed top-0 right-0 ${cerrada ? 'left-0 pl-2.5' : 'left-[260px] pl-5'} h-14 items-center gap-3 pr-5 bg-white border-b border-[#E6EAF3]`}
          style={{ zIndex: 'var(--z-nav)' }}
        >
          {cerrada ? (
            <div className="flex items-center gap-1 shrink-0">
              <BotonBarra claro />
              <Link href={ruta('/')} className="flex items-center h-8">
                <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
              </Link>
            </div>
          ) : null}
          <nav className="flex-1 flex items-center justify-center gap-2.5">{enlacesArriba(true)}</nav>
          <div className="flex items-center gap-1 shrink-0">
            <BotonColor claro />
            <MessagesBell orgslug={orgslug} claro />
            <NotificationsBell orgslug={orgslug} claro />
            <MenuPerfil claro />
          </div>
        </header>
      ) : (
        <header className="hidden md:flex fixed top-0 inset-x-0 h-14 items-center gap-3 pl-2.5 pr-5" style={{ ...FONDO_MARCA, zIndex: 'var(--z-nav)' }}>
          <div className="flex items-center gap-1 shrink-0 w-[246px]">
            <BotonBarra claro={false} />
            <Link href={ruta('/')} className="flex items-center h-8">
              <img src={logo} alt="" onError={sinRomper} className="h-full w-auto rounded-md" />
            </Link>
          </div>
          <nav className="flex-1 flex items-center justify-center gap-2.5">{enlacesArriba(false)}</nav>
          <div className="flex items-center gap-1 shrink-0">
            <BotonColor claro={false} />
            <MessagesBell orgslug={orgslug} />
            <NotificationsBell orgslug={orgslug} />
            <MenuPerfil />
          </div>
        </header>
      )}

      {/* La barra del ordenador (nada si está cerrada). */}
      {cerrada ? null : azul ? (
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
