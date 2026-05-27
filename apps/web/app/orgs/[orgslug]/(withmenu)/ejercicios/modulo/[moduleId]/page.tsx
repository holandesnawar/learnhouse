import { notFound } from 'next/navigation'
import {
  getModuleAsync,
  getLessonsForModuleAsync,
  getExtrasForModuleAsync,
} from '@/lib/exercises-app/courseService'
import LessonList from '@components/exercises-app/LessonList'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'

export const dynamic = 'force-dynamic'

export default async function ModulePage({
  params,
}: {
  params: Promise<{ orgslug: string; moduleId: string }>
}) {
  const { orgslug, moduleId } = await params
  const module = await getModuleAsync(moduleId)
  if (!module) notFound()

  const [lessons, extras] = await Promise.all([
    getLessonsForModuleAsync(module.id),
    getExtrasForModuleAsync(module.id),
  ])

  return (
    <GeneralWrapperStyled>
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
      </div>
    </GeneralWrapperStyled>
  )
}
