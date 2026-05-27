'use client'
import React, { useState, useRef, useEffect } from 'react'
import { WarningCircle, Globe, FloppyDisk, SpinnerGap, PuzzlePiece } from '@phosphor-icons/react'
import { updateActivity } from '@services/courses/activities'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import NativeExercisePicker from '@components/exercises-app/NativeExercisePicker'
import toast from 'react-hot-toast'

// "nawar:<moduleId>/<lessonId>[/<section>]" marks a native Nawar exercise.
function parseNawar(url: string): { moduleId: string; lessonId: string; section: string } | null {
  const m = url.match(/^nawar:([^/]+)\/([^/]+)(?:\/([^/]+))?$/)
  return m ? { moduleId: m[1], lessonId: m[2], section: m[3] || 'vocabulary' } : null
}

function toEmbedUrl(url: string): string {
  // Google Docs/Sheets/Slides → preview
  const googleDocMatch = url.match(
    /^(https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[^/]+)/
  )
  if (googleDocMatch) {
    return `${googleDocMatch[1]}/preview`
  }

  // Google Forms → embedded
  const googleFormMatch = url.match(
    /^(https?:\/\/docs\.google\.com\/forms\/d\/[^/]+)/
  )
  if (googleFormMatch) {
    return `${googleFormMatch[1]}/viewform?embedded=true`
  }

  // Figma → embed host
  if (/^https?:\/\/(www\.)?figma\.com\//.test(url)) {
    return `https://www.figma.com/embed?embed_host=learnhouse&url=${encodeURIComponent(url)}`
  }

  // Loom → /share/ to /embed/
  const loomMatch = url.match(/^(https?:\/\/www\.loom\.com)\/share\/(.+)$/)
  if (loomMatch) {
    return `${loomMatch[1]}/embed/${loomMatch[2]}`
  }

  // Canva design → embed
  if (url.includes('canva.com/design/')) {
    return url.includes('?') ? `${url}&embed` : `${url}?embed`
  }

  // Miro → embed
  const miroMatch = url.match(/^(https?:\/\/miro\.com\/app\/board\/)(.+)$/)
  if (miroMatch) {
    return `https://miro.com/app/live-embed/${miroMatch[2]}`
  }

  return url
}

interface EmbedActivityProps {
  activity: any
  editable?: boolean
  style?: React.CSSProperties
}

function EmbedActivity({ activity, editable = false, style }: EmbedActivityProps) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const embedUrl = activity.content?.embed_url || ''

  const [editUrl, setEditUrl] = useState(embedUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(!embedUrl)

  // Native Nawar exercise support
  const nawarInit = parseNawar(embedUrl)
  const [mode, setMode] = useState<'web' | 'nawar'>(nawarInit ? 'nawar' : 'web')
  const [exModuleId, setExModuleId] = useState(nawarInit?.moduleId ?? '')
  const [exLessonId, setExLessonId] = useState(nawarInit?.lessonId ?? '')
  const [exSection, setExSection] = useState(nawarInit?.section ?? 'vocabulary')
  const nativeToken = `nawar:${exModuleId}/${exLessonId}/${exSection}`

  const handleSaveNative = async () => {
    if (!exModuleId || !exLessonId || !exSection) return
    setSaving(true)
    try {
      await updateActivity(
        { content: { embed_url: nativeToken } },
        activity.activity_uuid,
        access_token
      )
      toast.success('Ejercicio guardado')
      setError(false)
    } catch {
      toast.error('No se pudo guardar el ejercicio')
    } finally {
      setSaving(false)
    }
  }

  // When the embedded page reports its own content height (via postMessage),
  // we size the iframe to exactly that height so there's no inner scrollbar
  // (no "double scroll"). Pages that don't report a height keep the 16:9 box.
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [autoHeight, setAutoHeight] = useState<number | null>(null)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      const data = e.data
      // Accept our own protocol and the Nawar exercises app's ('vocab-height').
      const h =
        data?.type === 'lh-embed-height' || data?.type === 'vocab-height' ? data.height : undefined
      if (typeof h === 'number' && isFinite(h)) {
        setAutoHeight(Math.min(Math.max(Math.round(h), 200), 6000))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleSaveUrl = async () => {
    if (!editUrl.trim()) return
    setSaving(true)
    try {
      await updateActivity(
        { content: { embed_url: editUrl.trim() } },
        activity.activity_uuid,
        access_token
      )
      toast.success('Embed URL updated')
      setError(false)
    } catch {
      toast.error('Failed to update URL')
    } finally {
      setSaving(false)
    }
  }

  const displayUrl = editable ? editUrl : embedUrl

  // Native Nawar exercise stored on this activity — the course view renders it
  // natively, so here (non-editable, e.g. the standalone /embed page) we just
  // show a hint instead of a broken iframe.
  if (nawarInit && !editable) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={style}>
        <PuzzlePiece size={36} weight="duotone" className="text-[#025dc7]" />
        <p className="text-sm text-gray-600">Ejercicio Nawar — se muestra dentro del curso.</p>
      </div>
    )
  }

  if (!displayUrl && !editable) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <WarningCircle size={40} className="text-red-400" />
        <p className="text-sm text-gray-600">No embed URL configured</p>
      </div>
    )
  }

  return (
    <div className={editable ? 'w-full px-6 py-6' : 'w-full'} style={style}>
      {editable && (
        <div className="mb-6 space-y-4">
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
            <div className="flex items-center gap-3">
              <Globe size={20} weight="duotone" className="text-cyan-400 flex-shrink-0" />
              <input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                className="flex-1 h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
              />
              <button
                onClick={handleSaveUrl}
                disabled={saving || editUrl.trim() === embedUrl}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                Save
              </button>
            </div>
          ) : (
            <div className="space-y-3">
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
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNative}
                  disabled={saving || !exModuleId || !exLessonId || nativeToken === embedUrl}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                  Guardar ejercicio
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editable && mode === 'nawar' ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-[#DDE6F5] bg-[#F0F5FF]">
          <PuzzlePiece size={32} weight="duotone" className="text-[#025dc7]" />
          <p className="text-sm text-gray-500">
            {exModuleId && exLessonId
              ? 'Ejercicio Nawar seleccionado. Se mostrará aquí dentro del curso.'
              : 'Elige un módulo y una lección para asignar el ejercicio.'}
          </p>
        </div>
      ) : displayUrl ? (
        <div
          className="w-full rounded-xl overflow-hidden"
          style={autoHeight ? { height: autoHeight } : { aspectRatio: '16/9' }}
        >
          <iframe
            ref={iframeRef}
            src={toEmbedUrl(displayUrl)}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border-2 border-dashed border-gray-200">
          <Globe size={32} weight="duotone" className="text-gray-300" />
          <p className="text-sm text-gray-400">Enter an embed URL above to preview</p>
        </div>
      )}
    </div>
  )
}

export default EmbedActivity
