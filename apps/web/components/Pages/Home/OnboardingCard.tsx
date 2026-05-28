'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { Check, Video, User, MessagesSquare, BookOpen, X } from 'lucide-react'

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

const DISMISS_KEY = 'nawar-onboarding-dismissed'
const VISITED_KEY = 'nawar-onboarding-visited'
// Items the user marks "done" by visiting (vs auto-detected from real state).
const VISITABLE: string[] = ['welcome_video', 'community']

function readVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function writeVisited(set: Set<string>) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

export default function OnboardingCard({ orgslug, hasStartedCourse }: Props) {
  const session = useLHSession() as any
  const user = session?.data?.user
  const hasAvatar = !!user?.avatar_image
  const [dismissed, setDismissed] = useState(true) // start hidden until we know
  const [visited, setVisited] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    setVisited(readVisited())
  }, [])

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

  if (dismissed || allDone) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  function markVisited(id: string) {
    if (!VISITABLE.includes(id)) return
    const next = new Set(visited)
    next.add(id)
    setVisited(next)
    writeVisited(next)
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
