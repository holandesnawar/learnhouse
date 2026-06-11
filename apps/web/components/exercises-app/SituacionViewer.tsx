'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronDown, FileText, RotateCcw, CheckCircle2, Dumbbell, Lock } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { ExerciseRunner } from './LessonViewer'
import { CATEGORY_META, toEmbedSrc, type Situacion } from '@/lib/exercises-app/situaciones'

// Renders one "situación real": the Bunny/YouTube video on top, an optional
// transcript toggle, and the dynamic exercises below (same engine as lessons).
//
// Used in two places:
//   • standalone library page (/ejercicios/situaciones/<id>) → inCourse=false
//   • embedded in a course activity (embed_url "nawar-video:<id>") → inCourse=true
//     with onComplete so the course progress bar marks it done.
export default function SituacionViewer({
  situacion,
  orgslug,
  inCourse = false,
  onComplete,
  titleOverride,
  contextOverride,
}: {
  situacion: Situacion
  orgslug: string
  inCourse?: boolean
  onComplete?: () => void
  /** Optional per-embed overrides set by the admin in the course editor. */
  titleOverride?: string
  contextOverride?: string
}) {
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [lockHint, setLockHint] = useState(false)
  const [runnerKey, setRunnerKey] = useState(0)
  const completeFired = useRef(false)

  const embedSrc = toEmbedSrc(situacion.video)
  const cat = CATEGORY_META[situacion.category]
  const hasTranscript = Boolean(situacion.transcriptNl || situacion.transcriptEs)
  // La transcripción se desbloquea al terminar los ejercicios (aunque se fallen).
  const transcriptUnlocked = situacion.exercises.length === 0 || done
  const title = (titleOverride && titleOverride.trim()) || situacion.title
  const context = contextOverride !== undefined ? contextOverride : situacion.context

  function handleDone() {
    setDone(true)
    if (!completeFired.current) {
      completeFired.current = true
      onComplete?.()
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function restart() {
    setDone(false)
    setStarted(true)
    setRunnerKey((k) => k + 1)
  }

  const content = (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back to library (only standalone) */}
      {!inCourse && (
        <Link
          href={getUriWithOrg(orgslug, '/ejercicios/situaciones')}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#025dc7] hover:text-[#1D0084] transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2.5} />
          Echt Nederlands
        </Link>
      )}

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2.5 py-1 rounded-full">
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </span>
          {situacion.durationLabel && (
            <span className="text-[12px] font-medium text-[#9CA3AF]">{situacion.durationLabel}</span>
          )}
        </div>
        <h1
          className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {title}
        </h1>
        {context && (
          <p className="text-[14px] sm:text-[15px] text-gray-500 mt-1.5 leading-relaxed">{context}</p>
        )}
      </div>

      {/* Video */}
      {embedSrc ? (
        <div style={{ position: 'relative', paddingTop: '56.25%' }} className="rounded-2xl overflow-hidden bg-black nice-shadow">
          <iframe
            src={embedSrc}
            loading="lazy"
            style={{ border: 0, position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-[#DDE6F5] bg-[#F0F5FF] py-16 text-center text-sm text-gray-500">
          No se pudo cargar el vídeo.
        </div>
      )}

      {/* Portada de ejercicios / ejercicios / done */}
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-6">
        {!done && situacion.exercises.length > 0 && !started ? (
          // Mini portada: el alumno ve el vídeo primero y arranca los ejercicios
          // cuando quiere, con un botón.
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF4FF] flex items-center justify-center">
              <Dumbbell size={26} className="text-[#025dc7]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
              ¿List@ para practicar?
            </h2>
            <p className="text-[14px] text-gray-500 max-w-sm leading-relaxed">
              Mira el vídeo con calma y, cuando quieras, pon a prueba lo que has entendido con{' '}
              {situacion.exercises.length} ejercicio{situacion.exercises.length !== 1 ? 's' : ''} rápido
              {situacion.exercises.length !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={() => setStarted(true)}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[15px] font-bold transition-colors mt-1"
            >
              Empezar ejercicios
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 size={44} className="text-green-500" />
            <h2 className="text-xl font-bold text-gray-900">¡Bien hecho!</h2>
            <p className="text-[14px] text-gray-500 max-w-sm">
              Has terminado los ejercicios. Puedes repetirlos cuando quieras para soltarte más el oído.
            </p>
            {hasTranscript && (
              <div className="flex items-start gap-2.5 bg-[#F0F5FF] rounded-xl px-4 py-3 text-left max-w-sm">
                <FileText size={18} className="text-[#4da3ff] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#0a1656] leading-relaxed">
                  Ya puedes ver la <strong>transcripción</strong> de este vídeo, con su traducción al español, aquí abajo.
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={restart}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-sm font-bold transition-colors"
              >
                <RotateCcw size={15} strokeWidth={2.5} /> Repetir
              </button>
              {!inCourse && (
                <Link
                  href={getUriWithOrg(orgslug, '/ejercicios/situaciones')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-[#DDE6F5] hover:bg-gray-50 transition-colors"
                >
                  Más vídeos
                </Link>
              )}
            </div>
          </div>
        ) : situacion.exercises.length > 0 ? (
          <>
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
              Ejercicios — comprueba lo que has entendido
            </p>
            <ExerciseRunner
              key={runnerKey}
              exercises={situacion.exercises}
              onDone={handleDone}
              onBack={() => {}}
              hasBackStep={false}
              cacheKey={`situacion-${situacion.id}-${runnerKey}`}
            />
          </>
        ) : (
          <p className="text-center text-sm text-gray-500 py-6">Esta situación todavía no tiene ejercicios.</p>
        )}
      </div>

      {/* Transcript — locked until the exercises are finished (even if failed). */}
      {hasTranscript && (
        transcriptUnlocked ? (
          <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F0F5FF]/60 transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-[14px] font-bold text-gray-900">
                <FileText size={16} className="text-[#025dc7]" />
                Ver transcripción
              </span>
              <ChevronDown size={18} className={`text-[#025dc7] transition-transform ${showTranscript ? 'rotate-180' : ''}`} />
            </button>
            {showTranscript && (
              <div className="px-4 pb-4 pt-1 grid gap-4 sm:grid-cols-2">
                {situacion.transcriptNl && (
                  <div>
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Holandés</p>
                    <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-line">{situacion.transcriptNl}</p>
                  </div>
                )}
                {situacion.transcriptEs && (
                  <div>
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Español</p>
                    <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">{situacion.transcriptEs}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#DDE6F5] bg-[#F0F5FF]/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setLockHint(true)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2 text-[14px] font-bold text-gray-400">
                <Lock size={16} className="text-gray-400" />
                Ver transcripción
              </span>
              <span className="text-[11px] font-semibold text-gray-400">Bloqueada</span>
            </button>
            {lockHint && (
              <p className="px-4 pb-3 -mt-1 text-[13px] text-[#0a1656] leading-relaxed">
                Completa los ejercicios para ver la transcripción.
              </p>
            )}
          </div>
        )
      )}
    </div>
  )

  if (inCourse) return content
  return <GeneralWrapperStyled>{content}</GeneralWrapperStyled>
}
