'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Dumbbell, Info, Check } from 'lucide-react'
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
      <p className="text-sm text-gray-500 mt-1 mb-4 max-w-lg">
        Aquí repasas lo que ya has aprendido, en el orden que prefieras.
      </p>
      <div className="flex items-start gap-2.5 rounded-xl bg-[#F0F5FF] border border-[#DDE6F5] px-4 py-3 mb-6 max-w-2xl">
        <Info size={18} className="text-[#4da3ff] shrink-0 mt-0.5" />
        <p className="text-[13px] text-[#0a1656] leading-relaxed">
          Recuerda: primero completa el módulo en <strong>Formación</strong>. Una vez lo termines, podrás repasarlo aquí cuando quieras.
        </p>
      </div>

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

            const done = unlocked && total > 0 && completed === total
            const inner = (
              <div className="p-5 flex flex-col gap-3 h-full">
                {/* Cabecera limpia: chip con emoji + estado (minimalista, sin fondo grande) */}
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-[24px] shrink-0 border ${unlocked ? 'bg-[#F0F5FF] border-[#DDE6F5]' : 'bg-[#F3F4F6] border-[#E5E7EB]'}`}>
                    {unlocked ? <span className="select-none leading-none">{m.emoji}</span> : <Lock size={20} className="text-[#9CA3AF]" />}
                  </div>
                  {done && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <Check size={12} className="stroke-[3]" /> Completado
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-bold text-[#025dc7] uppercase tracking-wider">Módulo {m.order}</span>
                  <h2
                    className="text-[18px] font-bold text-gray-900 leading-tight mt-0.5"
                    style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                  >
                    {m.title}
                  </h2>
                  {m.subtitle && <p className="text-[12px] font-semibold text-[#025dc7] mt-0.5">{m.subtitle}</p>}
                  {m.description && <p className="text-[13px] text-[#9CA3AF] mt-1 leading-snug line-clamp-2">{m.description}</p>}
                </div>

                <div className="mt-auto pt-1">
                  {unlocked ? (
                    <>
                      {completed > 0 && (
                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center justify-between text-[11px] font-medium text-[#9CA3AF]">
                            <span>{completed}/{total}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#4da3ff] transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#025dc7]">
                        {done ? 'Repasar' : completed > 0 ? 'Continuar' : 'Practicar'}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#9CA3AF]">
                      <Lock size={13} />
                      Termina el módulo anterior para desbloquearlo
                    </div>
                  )}
                </div>
              </div>
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
