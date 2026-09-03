'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Dumbbell, Info, Check, TrendingUp } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getModules, getLessonsForModule } from '@/lib/exercises-app/courseService'
import { getModuleStats } from '@/lib/exercises-app/progress'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'

type ModState = { unlocked: boolean; completed: number; total: number }
type ModuloCurso = { numero: number; nombre: string; descripcion?: string; bloqueado: boolean }

// Centre to re-practice the whole curriculum. Modules unlock sequentially: the
// next one opens when the previous is finished (progress kept per device in
// localStorage, same as the rest of the exercises app).
export default function ExerciseCenter({ orgslug }: { orgslug: string }) {
  const modules = getModules()
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<Record<string, ModState>>({})
  // Los módulos que el goteo todavía no ha abierto, por NÚMERO. Repasar vive
  // en `courseData.ts` y no sabe nada del curso, así que sin esto enseñaba
  // abierto lo que en la formación está cerrado: se podía hacer en septiembre
  // el contenido de octubre entrando por aquí.
  // La LISTA de módulos viene de la formación y el CONTENIDO del código: en el
  // curso hay diez y con ejercicios escritos hay cuatro. Antes se pintaba la
  // del código y faltaban seis.
  const [delCurso, setDelCurso] = useState<ModuloCurso[] | null>(null)

  useEffect(() => {
    if (!org?.id || !accessToken) {
      setDelCurso([])
      return
    }
    let vivo = true
    fetch(`${getAPIUrl()}student/course-modules?org_id=${org.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { modulos: [] }))
      .then((d) => vivo && setDelCurso(Array.isArray(d?.modulos) ? d.modulos : []))
      // Si falla, se cae a la lista del código: un fallo de red no puede dejar
      // al alumno sin poder repasar lo que ya tiene.
      .catch(() => vivo && setDelCurso([]))
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken])

  useEffect(() => {
    if (delCurso === null) return
    const s: Record<string, ModState> = {}
    modules.forEach((m, i) => {
      const lessonIds = getLessonsForModule(m.id).map((l) => l.id)
      const stats = getModuleStats(m.id, lessonIds)
      const enCurso = delCurso.find((x) => x.numero === i + 1)
      s[m.id] = {
        unlocked: !enCurso?.bloqueado,
        completed: stats.completed,
        total: stats.total,
      }
    })
    setState(s)
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delCurso])

  // Los módulos que existen en la formación pero todavía no tienen ejercicios
  // escritos. Se pintan cerrados: el alumno ve el camino entero y sabe que
  // sigue, pero no hay nada que abrir.
  const sinContenido = (delCurso ?? []).filter((x) => x.numero > modules.length)

  return (
    <GeneralWrapperStyled>
      {/* Standard section title (consistent with the rest of the app) */}
      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Dumbbell size={24} className="text-[#025dc7]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Repasar</h1>
        </div>
        <Link
          href={getUriWithOrg(orgslug, '/ejercicios/progreso')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-[#025dc7] text-sm font-bold hover:bg-[#e0eaff] transition-colors"
        >
          <TrendingUp size={16} /> Mi progreso
        </Link>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-4 max-w-lg">
        Vuelve sobre lo que ya has hecho, en el orden que quieras y las veces que quieras.
      </p>
      <div className="flex items-start gap-2.5 rounded-xl bg-[#F0F5FF] border border-[#DDE6F5] px-4 py-3 mb-6 max-w-2xl">
        <Info size={18} className="text-[#4da3ff] shrink-0 mt-0.5" />
        <p className="text-[13px] text-[#0a1656] leading-relaxed">
          El camino va en <strong>Formación</strong>: ahí avanzas. Esto es para <strong>volver</strong> sobre lo que ya viste, sin perder el sitio.
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
                {/* Cabecera limpia: emoji sin fondo + estado (minimalista) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center h-12 text-[40px] leading-none shrink-0">
                    {unlocked ? <span className="select-none">{m.emoji}</span> : <Lock size={26} className="text-[#9CA3AF]" />}
                  </div>
                  {done && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <Check size={12} className="stroke-[3]" /> Repasado
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-wider">Módulo {m.order}</span>
                  <h2
                    className="text-[18px] font-bold text-gray-900 leading-tight mt-0.5"
                    style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
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
                      Se abre más adelante
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

          {sinContenido.map((m) => (
            <div
              key={`curso-${m.numero}`}
              className="flex flex-col rounded-2xl border border-[#DDE6F5] overflow-hidden bg-white opacity-70 grayscale-[0.4] cursor-not-allowed"
              aria-disabled
            >
              <div className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center h-12 shrink-0">
                    <Lock size={26} className="text-[#9CA3AF]" />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-wider">
                    Módulo {m.numero}
                  </span>
                  <h3 className="text-[17px] font-bold text-gray-900 leading-snug">{m.nombre}</h3>
                  {m.descripcion && (
                    <p className="text-[13px] text-[#5A6480] leading-relaxed mt-1.5">{m.descripcion}</p>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[12px] font-medium text-[#9CA3AF]">
                  <Lock size={13} />
                  Se abre más adelante
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </GeneralWrapperStyled>
  )
}
