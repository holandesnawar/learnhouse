'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { Check, Video, User, MessagesSquare, BookOpen, X } from 'lucide-react'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'

interface Props {
  orgslug: string
  hasStartedCourse: boolean
}

interface CheckItem {
  id: string
  title: string
  href: string
  icon: React.ReactNode
  isDone: boolean
}

// Items the user marks "done" by visiting (vs auto-detected from real state).
const VISITABLE: string[] = ['welcome_video', 'community']

export default function OnboardingCard({ orgslug, hasStartedCourse }: Props) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const hasAvatar = !!user?.avatar_image
  // Start hidden until we have backend state — avoids flashing the card on
  // first paint for students who have already finished onboarding.
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [visited, setVisited] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!accessToken) {
      setLoaded(true)
      return
    }
    let active = true
    getStudentProgress(accessToken).then((p) => {
      if (!active) return
      const state = (p?.onboarding_state ?? {}) as Record<string, any>
      setDismissed(state.dismissed === true)
      setVisited(new Set(Array.isArray(state.visited) ? state.visited : []))
      setLoaded(true)
    })
    return () => { active = false }
  }, [accessToken])

  const checks: CheckItem[] = [
    {
      id: 'welcome_video',
      title: 'Mira el vídeo de bienvenida',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <Video size={16} />,
      isDone: visited.has('welcome_video'),
    },
    {
      id: 'profile',
      title: 'Completa tu perfil',
      href: getUriWithOrg(orgslug, '/account/settings'),
      icon: <User size={16} />,
      isDone: hasAvatar,
    },
    {
      id: 'community',
      title: 'Preséntate en Comunidad',
      href: getUriWithOrg(orgslug, '/communities'),
      icon: <MessagesSquare size={16} />,
      isDone: visited.has('community'),
    },
    {
      id: 'first_lesson',
      title: 'Haz tu primera lección',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <BookOpen size={16} />,
      isDone: hasStartedCourse,
    },
  ]

  const done = checks.filter((c) => c.isDone).length
  const total = checks.length
  const allDone = done === total

  if (!loaded || dismissed || allDone) return null

  function persist(nextDismissed: boolean, nextVisited: Set<string>) {
    if (!accessToken) return
    patchStudentProgress(
      {
        onboarding_state: {
          dismissed: nextDismissed,
          visited: Array.from(nextVisited),
        },
      },
      accessToken,
    )
  }

  function dismiss() {
    setDismissed(true)
    persist(true, visited)
  }

  function markVisited(id: string) {
    if (!VISITABLE.includes(id)) return
    const next = new Set(visited)
    next.add(id)
    setVisited(next)
    persist(dismissed, next)
  }

  return (
    <div className="mb-8 relative bg-white rounded-2xl border border-[#DDE6F5] nice-shadow overflow-hidden">
      <div
        className="px-5 py-4 text-white relative"
        style={{
          backgroundColor: '#1D0084',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
            'radial-gradient(circle 400px at 100% 0%, rgba(11,109,240,0.4) 0%, transparent 65%)',
          backgroundSize: '28px 28px, auto',
          backgroundRepeat: 'repeat, no-repeat',
        }}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 text-white/50 hover:text-white transition-colors"
          aria-label="Ocultar"
          title="Ocultar para siempre"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl leading-none">👋</span>
          <h2 className="text-lg font-bold leading-tight">Empieza aquí</h2>
        </div>
        <p className="text-sm text-white/70">
          {done} de {total} pasos completados
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#4da3ff] transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-2">
        {checks.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            onClick={() => markVisited(c.id)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#F0F5FF] transition-colors group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                c.isDone
                  ? 'bg-[#4da3ff] text-[#0a1656]'
                  : 'bg-[#F0F5FF] border-2 border-[#DDE6F5] text-[#1D0084] group-hover:border-[#1D0084]/30'
              }`}
            >
              {c.isDone ? <Check size={14} strokeWidth={3} /> : c.icon}
            </div>
            <span
              className={`text-[14px] font-semibold flex-1 ${
                c.isDone ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {c.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
