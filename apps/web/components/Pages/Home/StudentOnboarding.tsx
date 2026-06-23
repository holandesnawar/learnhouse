'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { getUriWithOrg } from '@services/config/config'
import { Check, Video, User, MessagesSquare, BookOpen, ArrowRight, Rocket, ChevronUp, ChevronDown } from 'lucide-react'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'
import { getCommunities } from '@services/communities/communities'
import { getDiscussions } from '@services/communities/discussions'

interface StepItem {
  id: string
  title: string
  cta: string
  href: string
  icon: React.ReactNode
  isDone: boolean
}

// Pasos que se marcan al hacer clic (visitar). El de comunidad NO está aquí:
// se marca solo cuando el alumno publica de verdad en el canal de presentaciones.
const VISITABLE: string[] = ['welcome_video', 'profile']
const COLLAPSE_KEY = 'nawar_student_onboarding_collapsed'
const WELCOME_SEEN_KEY = 'nawar_student_onboarding_welcome_seen'

// Ruta del vídeo de bienvenida. Cuando exista, cambia esto por la ruta de la
// lección/actividad del vídeo (p. ej. `/course/<uuid>/activity/<uuid>`). El paso
// se marca cuando el alumno hace clic en "Ver".
const WELCOME_VIDEO_PATH = '/courses'

// Widget flotante "Primeros pasos" para el alumno (abajo-derecha, plegable).
// Sustituye a la tarjeta grande del Inicio: aparece al entrar, se puede minimizar
// a una pastilla y desaparece solo cuando se completan todos los pasos.
export default function StudentOnboarding({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const pathname = usePathname() || ''
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const hasAvatar = !!user?.avatar_image
  const hasBio = !!(user?.bio && String(user.bio).trim())

  const { data: trailData } = useTrail(org?.id)
  const hasStartedCourse = (trailData?.runs?.length || 0) > 0
  const currentUserId = user?.id

  const [loaded, setLoaded] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [presented, setPresented] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // Oculta el widget flotante cuando hay otro popup a pantalla completa abierto
  // (p. ej. el modal "Abre una nueva consulta"), para que no tape sus botones.
  // Detecta overlays Tailwind `fixed inset-0` que NO sean del propio onboarding.
  const [overlayOpen, setOverlayOpen] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const check = () => {
      const els = document.querySelectorAll('[class~="fixed"][class~="inset-0"]:not([data-onboarding])')
      let open = false
      els.forEach((el) => {
        const s = window.getComputedStyle(el as Element)
        if (s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0) open = true
      })
      setOverlayOpen(open)
    }
    check()
    const mo = new MutationObserver(check)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    return () => mo.disconnect()
  }, [])

  // Detecta si el alumno YA ha publicado en el canal de presentaciones (de verdad,
  // no solo al hacer clic). Marca el paso "Preséntate en Comunidad".
  useEffect(() => {
    if (!accessToken || !org?.id || !currentUserId) return
    let active = true
    ;(async () => {
      try {
        const comms: any[] = await getCommunities(org.id, 1, 100, null, accessToken)
        if (!active || !Array.isArray(comms) || comms.length === 0) return
        const target = comms.find((c) => /present/i.test(c?.name || '')) || comms[0]
        const discussions: any[] = await getDiscussions(target.community_uuid, 'recent', 1, 100, null, accessToken)
        if (!active) return
        setPresented(Array.isArray(discussions) && discussions.some((d) => d?.author?.id === currentUserId))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      active = false
    }
  }, [accessToken, org?.id, currentUserId])

  useEffect(() => {
    try {
      // Primera vez → desplegado; luego respetamos la elección del alumno.
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
      // Primera vez de todas → mostramos el popup de bienvenida (una sola vez).
      setShowWelcome(localStorage.getItem(WELCOME_SEEN_KEY) !== '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setLoaded(true)
      return
    }
    let active = true
    getStudentProgress(accessToken)
      .then((p) => {
        if (!active) return
        const state = (p?.onboarding_state ?? {}) as Record<string, any>
        setVisited(new Set(Array.isArray(state.visited) ? state.visited : []))
        setLoaded(true)
      })
      .catch(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [accessToken])

  const steps: StepItem[] = [
    {
      id: 'welcome_video',
      title: 'Mira el vídeo de bienvenida',
      cta: 'Ver',
      href: getUriWithOrg(orgslug, WELCOME_VIDEO_PATH),
      icon: <Video size={19} />,
      isDone: visited.has('welcome_video'),
    },
    {
      id: 'profile',
      title: 'Completa tu perfil',
      cta: 'Ir',
      href: getUriWithOrg(orgslug, '/account/general'),
      icon: <User size={19} />,
      isDone: hasAvatar || hasBio || visited.has('profile'),
    },
    {
      id: 'community',
      title: 'Preséntate en Comunidad',
      cta: 'Entrar',
      href: getUriWithOrg(orgslug, '/communities'),
      icon: <MessagesSquare size={19} />,
      isDone: presented,
    },
    {
      id: 'first_lesson',
      title: 'Haz tu primera lección',
      cta: 'Empezar',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <BookOpen size={19} />,
      isDone: hasStartedCourse,
    },
  ]

  const done = steps.filter((s) => s.isDone).length
  const total = steps.length
  const allDone = done === total
  const pct = Math.round((done / total) * 100)

  // No mostrar: sin cargar, todo hecho, sin sesión, o dentro de una lección (modo enfoque).
  // Páginas "de enfoque" donde el widget estorba: dentro de una lección, en la
  // configuración de la cuenta/perfil y en consultas (su barra/modal inferior).
  const isFocusPage =
    (pathname.includes('/course/') && pathname.includes('/activity/')) ||
    pathname.includes('/account') ||
    pathname.includes('consulta')
  if (!loaded || allDone || !accessToken || isFocusPage) return null

  function setCollapsedPersisted(v: boolean) {
    setCollapsed(v)
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  function markVisited(id: string) {
    if (!VISITABLE.includes(id) || !accessToken) return
    const next = new Set(visited)
    next.add(id)
    setVisited(next)
    patchStudentProgress({ onboarding_state: { visited: Array.from(next) } }, accessToken)
  }

  // Lista de pasos (reutilizada en el panel y en el popup de bienvenida).
  const stepsList = (
    <ol className="divide-y divide-[#F0F5FF]">
      {steps.map((s) => (
        <li key={s.id} className="px-3.5 py-2.5 flex items-center gap-3">
          <div
            className={`w-8 h-8 flex items-center justify-center shrink-0 ${
              s.isDone ? 'text-emerald-500' : 'text-[#025dc7]'
            }`}
          >
            {s.isDone ? <Check size={20} strokeWidth={3} /> : s.icon}
          </div>
          <span
            className={`flex-1 min-w-0 text-[13px] leading-snug ${
              s.isDone ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'
            }`}
          >
            {s.title}
          </span>
          {!s.isDone && (
            <Link
              href={s.href}
              onClick={() => markVisited(s.id)}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-white font-semibold text-[12px] transition-colors"
            >
              {s.cta}
              <ArrowRight size={13} />
            </Link>
          )}
        </li>
      ))}
    </ol>
  )

  function dismissWelcome() {
    setShowWelcome(false)
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  // Popup de bienvenida — solo la primera vez (tamaño grande, centrado).
  const welcomeModal =
    showWelcome && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-onboarding
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
            onClick={dismissWelcome}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 mx-auto mb-2 flex items-center justify-center">
                  <Rocket size={40} className="text-[#025dc7]" />
                </div>
                <h2
                  className="text-[22px] font-bold text-gray-900"
                  style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                >
                  ¡Te damos la bienvenida!
                </h2>
                <p className="text-[14px] text-gray-500 mt-1">
                  Completa estos primeros pasos para sacarle el máximo a tu formación.
                </p>
              </div>
              <div className="border-t border-[#DDE6F5]">{stepsList}</div>
              <div className="px-6 py-4">
                <button
                  onClick={dismissWelcome}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold text-[15px] transition-colors"
                >
                  ¡Vamos allá!
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  // Pastilla minimizada
  if (collapsed) {
    return (
      <>
        {welcomeModal}
        {!overlayOpen && (
        <button
          onClick={() => setCollapsedPersisted(false)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 bg-white rounded-2xl nice-shadow border border-[#DDE6F5] pl-3 pr-3.5 py-2.5 hover:shadow-lg transition-shadow"
          aria-label="Abrir Primeros pasos"
        >
          <Rocket size={20} className="text-[#025dc7] shrink-0" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[13px] font-bold text-gray-900 leading-none text-left">Primeros pasos</span>
            <div className="flex items-center gap-2">
              <span className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <span className="block h-full bg-[#4da3ff] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-[12px] text-gray-400 tabular-nums">{done}/{total}</span>
            </div>
          </div>
          <ChevronUp size={16} className="text-gray-400 shrink-0 ml-1" />
        </button>
        )}
      </>
    )
  }

  // Panel desplegado
  return (
    <>
      {welcomeModal}
      {!overlayOpen && (
      <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl nice-shadow border border-[#DDE6F5] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDE6F5]">
          <div className="flex items-center gap-2 min-w-0">
            <Rocket size={18} className="text-[#025dc7] shrink-0" />
            <span className="text-[14px] font-bold text-gray-900">Primeros pasos</span>
            <span className="text-[12px] text-gray-400 tabular-nums shrink-0">{done}/{total}</span>
          </div>
          <button
            onClick={() => setCollapsedPersisted(true)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Minimizar"
          >
            <ChevronDown size={18} />
          </button>
        </div>
        {/* Barra de progreso */}
        <div className="h-1.5 bg-gray-100">
          <div className="h-full bg-[#4da3ff] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {/* Pasos */}
        {stepsList}
      </div>
      )}
    </>
  )
}
