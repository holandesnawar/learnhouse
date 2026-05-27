import { notFound } from 'next/navigation'
import {
  getModuleAsync,
  getLessonsForModuleAsync,
  getExtrasForModuleAsync,
} from '@/lib/exercises-app/courseService'
import LessonList from '@components/exercises-app/LessonList'

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
    <main className="min-h-screen bg-white">
      {/* Minimal header */}
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-2">
        <div className="flex items-start gap-3">
          <span className="text-4xl">{module.emoji}</span>
          <div>
            <h1
              className="text-[24px] font-bold text-[#1D0084] leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              {module.title}
            </h1>
            {module.subtitle && (
              <p className="text-[13px] font-semibold text-[#025dc7] mt-0.5">{module.subtitle}</p>
            )}
            <p className="text-[13px] text-[#5A6480] mt-1 leading-snug max-w-md">
              {module.description}
            </p>
          </div>
        </div>
      </div>

      {/* Lesson list */}
      <div className="max-w-5xl mx-auto px-6 py-8">
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
    </main>
  )
}
