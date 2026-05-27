import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Globe, PuzzlePiece } from '@phosphor-icons/react'
import NativeExercisePicker from '@components/exercises-app/NativeExercisePicker'

function EmbedActivityModal({ submitActivity, chapterId, course }: any) {
  const [activityName, setActivityName] = useState('')
  const [activityDescription, setActivityDescription] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mode: web embed (URL) vs native Nawar exercise (module/lesson/part picker)
  const [mode, setMode] = useState<'web' | 'nawar'>('web')
  const [exModuleId, setExModuleId] = useState('')
  const [exLessonId, setExLessonId] = useState('')
  const [exSection, setExSection] = useState('vocabulary')

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    const content =
      mode === 'nawar'
        ? { embed_url: `nawar:${exModuleId}/${exLessonId}/${exSection}` }
        : { embed_url: embedUrl }
    if (mode === 'nawar' && (!exModuleId || !exLessonId)) return
    setIsSubmitting(true)
    await submitActivity({
      name: activityName,
      chapter_id: chapterId,
      activity_type: 'TYPE_DYNAMIC',
      activity_sub_type: 'SUBTYPE_DYNAMIC_EMBED',
      content,
      published_version: 1,
      version: 1,
      course_id: course.id,
    })
    setIsSubmitting(false)
  }

  return (
    <Form.Root onSubmit={handleSubmit} className="space-y-4">
      <div
        className="relative flex items-center justify-center h-20 rounded-xl overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(165,243,252,0.25) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <span className="flex items-center gap-2 bg-white nice-shadow rounded-full px-4 py-1.5 text-sm font-medium text-gray-600">
          <Globe size={18} weight="duotone" className="text-cyan-400" />
          Embed
        </span>
      </div>

      <div className="rounded-xl nice-shadow p-4 space-y-4">
        <Form.Field name="embed-activity-name" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            Activity name
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            Please provide a name
          </Form.Message>
          <Form.Control asChild>
            <input
              onChange={(e) => setActivityName(e.target.value)}
              type="text"
              required
              placeholder="Enter a name..."
              className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
            />
          </Form.Control>
        </Form.Field>

        {/* Mode toggle: web embed vs native Nawar exercise */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            type="button"
            onClick={() => setMode('web')}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md transition-colors ${mode === 'web' ? 'bg-white text-gray-900 nice-shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe size={16} weight="duotone" /> Web
          </button>
          <button
            type="button"
            onClick={() => setMode('nawar')}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md transition-colors ${mode === 'nawar' ? 'bg-white text-gray-900 nice-shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <PuzzlePiece size={16} weight="duotone" /> Ejercicio Nawar
          </button>
        </div>

        {mode === 'web' ? (
          <Form.Field name="embed-activity-url" className="space-y-1.5">
            <Form.Label className="text-sm font-medium text-gray-700">
              Embed URL
            </Form.Label>
            <Form.Message match="valueMissing" className="text-xs text-red-500">
              Please provide an embed URL
            </Form.Message>
            <Form.Message match="typeMismatch" className="text-xs text-red-500">
              Please provide a valid URL
            </Form.Message>
            <Form.Control asChild>
              <input
                onChange={(e) => setEmbedUrl(e.target.value)}
                type="url"
                required
                placeholder="https://docs.google.com/document/d/..."
                className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
              />
            </Form.Control>
          </Form.Field>
        ) : (
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Ejercicio Nawar</span>
            <NativeExercisePicker
              moduleId={exModuleId}
              lessonId={exLessonId}
              section={exSection}
              onChange={(m, l, s) => {
                setExModuleId(m)
                setExLessonId(l)
                setExSection(s)
              }}
            />
          </div>
        )}

        <Form.Field name="embed-activity-desc" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            Description
          </Form.Label>
          <Form.Control asChild>
            <textarea
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors resize-none"
            />
          </Form.Control>
        </Form.Field>
      </div>

      <div className="flex justify-end">
        <Form.Submit asChild>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center h-9 px-5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Create activity'
            )}
          </button>
        </Form.Submit>
      </div>
    </Form.Root>
  )
}

export default EmbedActivityModal
