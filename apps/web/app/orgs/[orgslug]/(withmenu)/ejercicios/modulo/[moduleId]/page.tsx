import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getModuleAsync,
  getLessonsForModuleAsync,
  getExtrasForModuleAsync,
  getModulesAsync,
} from '@/lib/exercises-app/courseService'
import LessonList from '@components/exercises-app/LessonList'
import SituacionCard from '@components/exercises-app/SituacionCard'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { getSituacionesForModule } from '@/lib/exercises-app/situaciones'
import { Clapperboard, Dumbbell } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ModulePage({
  params,
}: {
  params: Promise<{ orgslug: string; moduleId: string }>
}) {
  const { orgslug, moduleId } = await params
  const module = await getModuleAsync(moduleId)
  if (!module) notFound()

  const [lessons, extras, allModules] = await Promise.all([
    getLessonsForModuleAsync(module.id),
    getExtrasForModuleAsync(module.id),
    getModulesAsync(),
  ])
  // Echt Nederlands videos attached to this module (rendered as extra lessons).
  const situaciones = getSituacionesForModule(module.id)

  return (
    <GeneralWrapperStyled>
      {/* Module switcher — quick jump to other modules without going up */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-min">
          <Link
            href={getUriWithOrg(orgslug, '/ejercicios')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DDE6F5] text-[12px] font-semibold text-[#5A6480] hover:text-[#1D0084] hover:border-[#1D0084]/30 transition-colors"
          >
            <Dumbbell size={13} />
            <span>Todos</span>
          </Link>
          {allModules.map((m) => {
            const isCurrent = m.id === module.id
            return (
              <Link
                key={m.id}
                href={getUriWithOrg(orgslug, `/ejercicios/modulo/${m.id}`)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border ${
                  isCurrent
                    ? 'bg-[#1D0084] text-white border-[#1D0084]'
                    : 'bg-white border-[#DDE6F5] text-[#5A6480] hover:text-[#1D0084] hover:border-[#1D0084]/30'
                }`}
              >
                <span aria-hidden>{m.emoji}</span>
                <span className="max-w-[120px] truncate">{m.title}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Header — standard left-aligned title (consistent with the app) */}
      <div className="flex items-start gap-3 pt-2 pb-1">
        <span className="text-4xl">{module.emoji}</span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{module.title}</h1>
          {module.subtitle && (
            <p className="text-[13px] font-semibold text-[#025dc7] mt-0.5">{module.subtitle}</p>
          )}
          <p className="text-sm text-gray-500 mt-1 leading-snug max-w-md">{module.description}</p>
        </div>
      </div>

      {/* Lesson list */}
      <div className="py-6">
        <LessonList lessons={lessons} moduleId={module.id} orgslug={orgslug} />

        {extras.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[13px] font-bold text-[#5A6480] uppercase tracking-widest">Lecciones extra</span>
              <div className="flex-1 h-px bg-[#DDE6F5]" />
            </div>
            <LessonList lessons={extras} moduleId={module.id} orgslug={orgslug} />
          </div>
        )}

        {situaciones.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <Clapperboard size={16} className="text-[#025dc7] shrink-0" />
              <span className="text-[13px] font-bold text-[#5A6480] uppercase tracking-widest">Echt Nederlands · lección extra</span>
              <div className="flex-1 h-px bg-[#DDE6F5]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {situaciones.map((s) => (
                <SituacionCard key={s.id} situacion={s} orgslug={orgslug} />
              ))}
            </div>
          </div>
        )}
      </div>
    </GeneralWrapperStyled>
  )
}
