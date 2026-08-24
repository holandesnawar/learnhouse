'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  Check,
  CalendarDays,
  User,
  MessagesSquare,
  BookOpen,
  ArrowRight,
} from 'lucide-react'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'

interface Props {
  orgslug: string
  hasStartedCourse: boolean
}

interface StepItem {
  id: string
  title: string
  description: string
  cta: string
  href: string
  icon: React.ReactNode
  isDone: boolean
}

// Items the user marks "done" by visiting (vs. auto-detected from real state).
const VISITABLE: string[] = ['welcome_video', 'community']

export default function OnboardingCard({ orgslug, hasStartedCourse }: Props) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const hasAvatar = !!user?.avatar_image
  const [loaded, setLoaded] = useState(false)
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
      setVisited(new Set(Array.isArray(state.visited) ? state.visited : []))
      setLoaded(true)
    })
    return () => { active = false }
  }, [accessToken])

  const steps: StepItem[] = [
    {
      id: 'clase_en_vivo',
      title: 'Mira cuándo es tu clase en vivo',
      description: 'Cada semana hay una clase online con un profe. Mira la próxima.',
      cta: 'Ver el calendario',
      href: getUriWithOrg(orgslug, '/calendario'),
      icon: <CalendarDays size={16} />,
      isDone: visited.has('clase_en_vivo'),
    },
    {
      id: 'profile',
      title: 'Completa tu perfil',
      description: 'Añade tu foto y datos para que el resto te conozca.',
      cta: 'Ir a mi perfil',
      href: getUriWithOrg(orgslug, '/account/profile'),
      icon: <User size={16} />,
      isDone: hasAvatar,
    },
    {
      id: 'community',
      title: 'Preséntate en Comunidad',
      description: 'Salta al canal de presentaciones y dinos quién eres.',
      cta: 'Entrar a Comunidad',
      href: getUriWithOrg(orgslug, '/communities'),
      icon: <MessagesSquare size={16} />,
      isDone: visited.has('community'),
    },
    {
      id: 'first_lesson',
      title: 'Haz tu primera lección',
      description: 'Arranca con la primera clase del curso y rompe el hielo.',
      cta: 'Empezar curso',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <BookOpen size={16} />,
      isDone: hasStartedCourse,
    },
  ]

  const done = steps.filter((s) => s.isDone).length
  const total = steps.length
  const allDone = done === total

  if (!loaded || allDone) return null

  function markVisited(id: string) {
    if (!VISITABLE.includes(id) || !accessToken) return
    const next = new Set(visited)
    next.add(id)
    setVisited(next)
    patchStudentProgress(
      { onboarding_state: { visited: Array.from(next) } },
      accessToken,
    )
  }

  return (
    <div className="mb-8 bg-white dark:bg-white/5 rounded-2xl border border-[#DDE6F5] dark:border-white/10 nice-shadow overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-5 text-white relative"
        style={{
          backgroundColor: '#1D0084',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
            'radial-gradient(circle 400px at 100% 0%, rgba(11,109,240,0.4) 0%, transparent 65%)',
          backgroundSize: '28px 28px, auto',
          backgroundRepeat: 'repeat, no-repeat',
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xl leading-none">👋</span>
          <h2 className="text-lg font-bold leading-tight">Empieza aquí</h2>
        </div>
        <p className="text-sm text-white/70">
          {done} de {total} pasos completados
        </p>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#4da3ff] transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-[#DDE6F5]">
        {steps.map((s, idx) => (
          <li
            key={s.id}
            className={`px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 transition-colors ${
              s.isDone
                ? 'bg-[#F0F5FF]/40 dark:bg-white/[0.03]'
                : 'hover:bg-[#F0F5FF]/60 dark:hover:bg-white/[0.04]'
            }`}
          >
            {/* Number / Check badge */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-[14px] transition-colors ${
                s.isDone
                  ? 'bg-[#4da3ff] text-[#1D0084]'
                  : 'bg-white text-[#025dc7] border-2 border-[#025dc7]/30'
              }`}
            >
              {s.isDone ? <Check size={16} strokeWidth={3} /> : idx + 1}
            </div>

            {/* Title + description */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-[14px] sm:text-[15px] font-bold leading-tight ${
                  s.isDone
                    ? 'text-gray-400 dark:text-white/35 line-through'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {s.title}
              </p>
              <p
                className={`text-[12px] sm:text-[13px] leading-snug mt-0.5 ${
                  s.isDone
                    ? 'text-gray-300 dark:text-white/25'
                    : 'text-gray-500 dark:text-white/60'
                }`}
              >
                {s.description}
              </p>
            </div>

            {/* CTA */}
            {s.isDone ? (
              <span className="hidden sm:inline-flex items-center text-[11px] font-bold uppercase tracking-wider text-[#4da3ff] shrink-0">
                Hecho
              </span>
            ) : (
              <Link
                href={s.href}
                onClick={() => markVisited(s.id)}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] font-bold text-[12px] sm:text-[13px] transition-colors whitespace-nowrap"
              >
                <span className="hidden sm:inline">{s.cta}</span>
                <span className="sm:hidden">Ir</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
