'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Dumbbell, Clapperboard, ArrowRight } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'
import { getModuleStats } from '@/lib/exercises-app/progress'
import { getUriWithOrg } from '@services/config/config'

type ModState = { unlocked: boolean; completed: number; total: number }

// Centre to re-practice the whole curriculum. Modules unlock sequentially: the
// next one opens when the previous is finished (progress kept per device in
// localStorage, same as the rest of the exercises app).
export default function ExerciseCenter({ orgslug }: { orgslug: string }) {
  const modules = getModules()
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<Record<string, ModState>>({})

  useEffect(() => {
    const s: Record<string, ModState> = {}
    for (const m of modules) {
      const lessonIds = getLessonsForModule(m.id).map((l) => l.id)
      const stats = getModuleStats(m.id, lessonIds)
      s[m.id] = { unlocked: true, completed: stats.completed, total: stats.total }
    }
    setState(s)
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <GeneralWrapperStyled>
      {/* Standard section title (consistent with the rest of the app) */}
      <div className="flex items-center gap-2 pt-2">
        <Dumbbell size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Centro de ejercicios</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Repasa cualquier módulo o lección cuando quieras, en el orden que prefieras.
      </p>

      {/* Situaciones reales — biblioteca de vídeos con ejercicios */}
      <Link
        href={getUriWithOrg(orgslug, '/ejercicios/situaciones')}
        className="group flex items-center gap-4 rounded-2xl overflow-hidden mb-6 p-4 sm:p-5 nice-shadow border border-transparent hover:border-[#4da3ff]/40 transition-all"
        style={{
          backgroundColor: '#1D0084',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
            'radial-gradient(circle 360px at 100% 0%, rgba(11,109,240,0.45) 0%, transparent 70%)',
          backgroundSize: '24px 24px, auto',
          backgroundRepeat: 'repeat, no-repeat',
        }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Clapperboard size={24} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] sm:text-[18px] font-bold text-white leading-tight">Situaciones reales</h2>
          <p className="text-[13px] text-white/70 leading-snug mt-0.5">
            Vídeos en holandés —noticias, entrevistas, día a día— con ejercicios para entrenar el oído.
          </p>
        </div>
        <ArrowRight size={20} className="text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </Link>

      <div>
      {!mounted ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const st = state[m.id]
            const unlocked = st?.unlocked ?? false
            const total = st?.total ?? 0
            const completed = st?.completed ?? 0
            const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

            const inner = (
              <>
                <div
                  className="relative flex items-center justify-center py-8 text-5xl overflow-hidden"
                  style={{
                    backgroundColor: '#1D0084',
                    backgroundImage:
                      'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
                      'radial-gradient(circle 280px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 70%)',
                    backgroundSize: '24px 24px, auto',
                    backgroundRepeat: 'repeat, no-repeat',
                  }}
                >
                  <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />
                  {unlocked ? (
                    <span className="relative select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
                      {m.emoji}
                    </span>
                  ) : (
                    <span className="relative w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Lock size={22} className="text-white" />
                    </span>
                  )}
                </div>

                <div className="p-5 flex flex-col gap-2.5">
                  <span className="text-[12px] text-[#9CA3AF] font-medium">
                    {total} lección{total !== 1 ? 'es' : ''}
                  </span>
                  <div>
                    <h2
                      className="text-[18px] font-bold text-gray-900 leading-tight"
                      style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                    >
                      {m.title}
                    </h2>
                    {m.subtitle && <p className="text-[12px] font-semibold text-[#025dc7] mt-0.5">{m.subtitle}</p>}
                    {m.description && <p className="text-[13px] text-[#9CA3AF] mt-1 leading-snug line-clamp-2">{m.description}</p>}
                  </div>

                  {unlocked ? (
                    <>
                      {completed > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-[#9CA3AF]">
                            <span>{completed}/{total} lecciones</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#4da3ff] transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#025dc7] pt-1">
                        {completed === total && total > 0 ? 'Repasar' : completed > 0 ? 'Continuar' : 'Practicar'}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#9CA3AF] pt-1">
                      <Lock size={13} />
                      Termina el módulo anterior para desbloquearlo
                    </div>
                  )}
                </div>
              </>
            )

            const cardClass =
              'flex flex-col rounded-2xl border border-[#DDE6F5] overflow-hidden bg-white transition-all duration-300'

            return unlocked ? (
              <Link
                key={m.id}
                href={getUriWithOrg(orgslug, `/ejercicios/modulo/${m.id}`)}
                className={`${cardClass} hover:border-[#1D0084]/20 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)]`}
              >
                {inner}
              </Link>
            ) : (
              <div key={m.id} className={`${cardClass} opacity-70 grayscale-[0.4] cursor-not-allowed`} aria-disabled>
                {inner}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </GeneralWrapperStyled>
  )
}
