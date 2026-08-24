'use client'
import React, { useState, useRef, useEffect } from 'react'
import { WarningCircle, Globe, FloppyDisk, SpinnerGap, PuzzlePiece } from '@phosphor-icons/react'
import { updateActivity } from '@services/courses/activities'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import NativeExercisePicker from '@components/exercises-app/NativeExercisePicker'
import SituacionPicker from '@components/exercises-app/SituacionPicker'
import { getSituacion } from '@/lib/exercises-app/situaciones'
import { BookOpen, Clapperboard } from 'lucide-react'
import { GUIDE_OPTIONS } from '@components/Pages/Guides/guidesContent'
import SchoolGuide from '@components/Pages/Guides/SchoolGuide'
import toast from 'react-hot-toast'

// "nawar:<moduleId>/<lessonId>[/<section>]" marks a native Nawar exercise.
function parseNawar(url: string): { moduleId: string; lessonId: string; section: string } | null {
  const m = url.match(/^nawar:([^/]+)\/([^/]+)(?:\/([^/]+))?$/)
  return m ? { moduleId: m[1], lessonId: m[2], section: m[3] || 'vocabulary' } : null
}

// "nawar-video:<situacionId>" marks a native Nawar "situación real" (video + exercises).
function parseNawarVideo(url: string): { situacionId: string } | null {
  const m = url.match(/^nawar-video:(.+)$/)
  return m ? { situacionId: m[1] } : null
}

// "nawar-guia:<uso|estudio>" marca una guía de la escuela (las del módulo 0).
function parseNawarGuide(url: string): { guideId: string } | null {
  const m = url.match(/^nawar-guia:(.+)$/)
  return m ? { guideId: m[1] } : null
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
  const videoInit = parseNawarVideo(embedUrl)
  const guideInit = parseNawarGuide(embedUrl)
  const [mode, setMode] = useState<'web' | 'nawar' | 'video' | 'guia'>(
    guideInit ? 'guia' : videoInit ? 'video' : nawarInit ? 'nawar' : 'web'
  )
  const [exModuleId, setExModuleId] = useState(nawarInit?.moduleId ?? '')
  const [exLessonId, setExLessonId] = useState(nawarInit?.lessonId ?? '')
  const [exSection, setExSection] = useState(nawarInit?.section ?? '')
  const nativeToken = `nawar:${exModuleId}/${exLessonId}/${exSection}`

  const [situacionId, setSituacionId] = useState(videoInit?.situacionId ?? '')
  const [videoTitle, setVideoTitle] = useState<string>(activity.content?.video_title ?? '')
  const [videoDesc, setVideoDesc] = useState<string>(activity.content?.video_desc ?? '')
  const videoToken = `nawar-video:${situacionId}`

  // When the admin picks a situación, prefill the title/description with the
  // situación's own values if the fields are still empty (so they have a
  // starting point they can tweak).
  const handlePickSituacion = (id: string) => {
    setSituacionId(id)
    const s = id ? getSituacion(id) : null
    if (s) {
      setVideoTitle((t) => (t.trim() ? t : s.title))
      setVideoDesc((d) => (d.trim() ? d : s.context))
    }
  }

  const handleSaveVideo = async () => {
    if (!situacionId) return
    setSaving(true)
    try {
      await updateActivity(
        {
          content: {
            embed_url: videoToken,
            video_title: videoTitle.trim(),
            video_desc: videoDesc.trim(),
          },
        },
        activity.activity_uuid,
        access_token
      )
      toast.success('Situación guardada')
      setError(false)
    } catch {
      toast.error('No se pudo guardar la situación')
    } finally {
      setSaving(false)
    }
  }

  const [guideId, setGuideId] = useState(guideInit?.guideId ?? '')

  const handleSaveGuide = async () => {
    if (!guideId) return
    setSaving(true)
    try {
      await updateActivity(
        { content: { embed_url: `nawar-guia:${guideId}` } },
        activity.activity_uuid,
        access_token
      )
      toast.success('Guía guardada')
      setError(false)
    } catch {
      toast.error('No se pudo guardar la guía')
    } finally {
      setSaving(false)
    }
  }

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
  if ((nawarInit || videoInit) && !editable) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={style}>
        {videoInit ? (
          <Clapperboard size={34} className="text-[#025dc7]" />
        ) : (
          <PuzzlePiece size={36} weight="duotone" className="text-[#025dc7]" />
        )}
        <p className="text-sm text-gray-600">
          {videoInit ? 'Vídeo Echt Nederlands' : 'Ejercicio Nawar'} — se muestra dentro del curso.
        </p>
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
            <button
              type="button"
              onClick={() => setMode('video')}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md transition-colors ${mode === 'video' ? 'bg-white text-gray-900 nice-shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Clapperboard size={16} /> Echt Nederlands
            </button>
            <button
              type="button"
              onClick={() => setMode('guia')}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md transition-colors ${mode === 'guia' ? 'bg-white text-gray-900 nice-shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BookOpen size={16} /> Guía de la escuela
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
          ) : mode === 'nawar' ? (
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
                  disabled={saving || !exModuleId || !exLessonId || !exSection || nativeToken === embedUrl}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                  Guardar ejercicio
                </button>
              </div>
            </div>
          ) : mode === 'guia' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">
                  ¿Cuál de las guías?
                </label>
                <select
                  value={guideId}
                  onChange={(e) => setGuideId(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
                >
                  <option value="">Elige una guía…</option>
                  {GUIDE_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  El texto va escrito en la plataforma: se ve igual en móvil y en
                  ordenador, y se actualiza solo cuando lo mejoramos.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveGuide}
                  disabled={saving || !guideId || `nawar-guia:${guideId}` === embedUrl}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                  Guardar guía
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <SituacionPicker situacionId={situacionId} onChange={handlePickSituacion} />
              {situacionId && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Título (lo que ve el alumno)</label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Título de la lección…"
                      className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Descripción</label>
                    <textarea
                      value={videoDesc}
                      onChange={(e) => setVideoDesc(e.target.value)}
                      placeholder="Una línea de contexto…"
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors resize-none"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveVideo}
                  disabled={saving || !situacionId}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                  Guardar situación
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
      ) : editable && mode === 'video' ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-[#DDE6F5] bg-[#F0F5FF]">
          <Clapperboard size={30} className="text-[#025dc7]" />
          <p className="text-sm text-gray-500">
            {situacionId
              ? 'Situación seleccionada. El vídeo y sus ejercicios se mostrarán aquí dentro del curso.'
              : 'Elige una situación (vídeo + ejercicios) para esta lección auditiva.'}
          </p>
        </div>
      ) : editable && mode === 'guia' ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-[#DDE6F5] bg-[#F0F5FF]">
          <BookOpen size={30} className="text-[#025dc7]" />
          <p className="text-sm text-gray-500 text-center max-w-sm">
            {guideId
              ? 'Guía seleccionada. El alumno la verá aquí dentro, con el diseño de la escuela.'
              : 'Elige cuál de las dos guías va en esta clase.'}
          </p>
        </div>
      ) : parseNawarGuide(displayUrl || '') ? (
        // Fuera del curso (o sin permisos de edición): se enseña la guía tal cual.
        <SchoolGuide guideId={parseNawarGuide(displayUrl || '')!.guideId} />
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
