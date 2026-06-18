'use client'

import React, { useState, useEffect } from 'react'
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
const VISITABLE: string[] = ['welcome_video']
const COLLAPSE_KEY = 'nawar_student_onboarding_collapsed'

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

  const { data: trailData } = useTrail(org?.id)
  const hasStartedCourse = (trailData?.runs?.length || 0) > 0
  const currentUserId = user?.id

  const [loaded, setLoaded] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [presented, setPresented] = useState(false)

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
      icon: <Video size={15} />,
      isDone: visited.has('welcome_video'),
    },
    {
      id: 'profile',
      title: 'Completa tu perfil',
      cta: 'Ir',
      href: getUriWithOrg(orgslug, '/account/general'),
      icon: <User size={15} />,
      isDone: hasAvatar,
    },
    {
      id: 'community',
      title: 'Preséntate en Comunidad',
      cta: 'Entrar',
      href: getUriWithOrg(orgslug, '/communities'),
      icon: <MessagesSquare size={15} />,
      isDone: presented,
    },
    {
      id: 'first_lesson',
      title: 'Haz tu primera lección',
      cta: 'Empezar',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <BookOpen size={15} />,
      isDone: hasStartedCourse,
    },
  ]

  const done = steps.filter((s) => s.isDone).length
  const total = steps.length
  const allDone = done === total
  const pct = Math.round((done / total) * 100)

  // No mostrar: sin cargar, todo hecho, sin sesión, o dentro de una lección (modo enfoque).
  const isLessonPage = pathname.includes('/course/') && pathname.includes('/activity/')
  if (!loaded || allDone || !accessToken || isLessonPage) return null

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

  // Pastilla minimizada
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsedPersisted(false)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-3 bg-white rounded-2xl nice-shadow border border-[#DDE6F5] pl-3 pr-3.5 py-2.5 hover:shadow-lg transition-shadow"
        aria-label="Abrir Primeros pasos"
      >
        <Rocket size={20} className="text-[#1D0084] shrink-0" />
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
    )
  }

  // Panel desplegado
  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl nice-shadow border border-[#DDE6F5] overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDE6F5]">
        <div className="flex items-center gap-2 min-w-0">
          <Rocket size={18} className="text-[#1D0084] shrink-0" />
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
      <ol className="divide-y divide-[#F0F5FF]">
        {steps.map((s, idx) => (
          <li key={s.id} className="px-3.5 py-2.5 flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold ${
                s.isDone ? 'bg-emerald-500 text-white' : 'bg-[#F0F5FF] text-[#025dc7]'
              }`}
            >
              {s.isDone ? <Check size={15} strokeWidth={3} /> : idx + 1}
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
    </div>
  )
}
