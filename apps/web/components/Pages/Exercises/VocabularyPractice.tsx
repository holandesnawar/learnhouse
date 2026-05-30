'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  isExercisesEnabled,
  getFirstVocabLesson,
  saveItemResult,
  type ExVocab,
  type ExLesson,
} from '@/lib/exercises/exercises'
import { Volume2, RotateCcw, Check, X, Loader2, BookOpen, Eye } from 'lucide-react'

export default function VocabularyPractice({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const userUuid: string = session?.data?.user?.user_uuid || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lesson, setLesson] = useState<ExLesson | null>(null)
  const [vocab, setVocab] = useState<ExVocab[]>([])

  // Practice state
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isExercisesEnabled()) {
        setError('Los ejercicios no están configurados (faltan las claves de Supabase).')
        setLoading(false)
        return
      }
      try {
        const found = await getFirstVocabLesson()
        if (cancelled) return
        if (!found) {
          setError('No se encontró vocabulario (0 filas). Revisa que la tabla vocabulary_items tenga datos y permita lectura (RLS) al rol anon.')
          return
        }
        setLesson(found.lesson)
        setVocab(found.vocab)
      } catch (e: any) {
        if (!cancelled) setError(`No se pudo cargar el vocabulario. Detalle: ${e?.message || e}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const current = vocab[index]
  const total = vocab.length

  const playAudio = () => {
    if (current?.audio_url && audioRef.current) {
      audioRef.current.src = current.audio_url
      audioRef.current.play().catch(() => {})
    }
  }

  const answer = async (correct: boolean) => {
    if (!current) return
    setResults((r) => ({ ...r, [current.id]: correct }))
    if (lesson) saveItemResult(userUuid, lesson.id, current.id, correct).catch(() => {})
    if (index + 1 >= total) {
      setFinished(true)
    } else {
      setIndex((i) => i + 1)
      setRevealed(false)
    }
  }

  const restart = (onlyFailed = false) => {
    if (onlyFailed) {
      const failed = vocab.filter((v) => results[v.id] === false)
      if (failed.length > 0) setVocab(failed)
    }
    setIndex(0)
    setRevealed(false)
    setResults({})
    setFinished(false)
  }

  const correctCount = useMemo(() => Object.values(results).filter(Boolean).length, [results])
  const failedCount = useMemo(() => Object.values(results).filter((v) => v === false).length, [results])

  if (loading) {
    return (
      <GeneralWrapperStyled>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      </GeneralWrapperStyled>
    )
  }

  if (error || total === 0) {
    return (
      <GeneralWrapperStyled>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="text-gray-300 mb-3" size={32} />
          <p className="text-gray-500">{error || 'No hay vocabulario en esta lección todavía.'}</p>
        </div>
      </GeneralWrapperStyled>
    )
  }

  return (
    <GeneralWrapperStyled>
      <audio ref={audioRef} className="hidden" />
      <div className="max-w-xl mx-auto pt-2">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-[#025dc7]">Vocabulario</p>
          <h1 className="text-2xl font-bold text-gray-900">{lesson?.title || 'Les 1'}</h1>
        </div>

        {finished ? (
          <div className="bg-white nice-shadow rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-600" size={28} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">¡Vocabulario completado!</h2>
            <p className="text-gray-500 mt-1">
              {correctCount} bien · {failedCount} para repasar · {total} en total
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
              {failedCount > 0 && (
                <button
                  onClick={() => restart(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] font-bold text-sm hover:bg-[#6cb5ff]"
                >
                  <RotateCcw size={16} /> Repasar los que fallé
                </button>
              )}
              <button
                onClick={() => restart(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{index + 1} / {total}</span>
              <span>{correctCount} bien</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-[#025dc7] rounded-full transition-all" style={{ width: `${((index) / total) * 100}%` }} />
            </div>

            {/* Card */}
            <div className="bg-white nice-shadow rounded-2xl p-8 min-h-[260px] flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-bold text-gray-900">
                {current?.article ? <span className="text-gray-400">{current.article} </span> : null}
                {current?.word_nl}
              </div>
              {current?.audio_url && (
                <button onClick={playAudio} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#025dc7] font-medium hover:underline">
                  <Volume2 size={16} /> Escuchar
                </button>
              )}

              {revealed ? (
                <div className="mt-5 pt-5 border-t border-gray-100 w-full">
                  <div className="text-xl font-semibold text-gray-700">{current?.translation_es}</div>
                </div>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4da3ff] text-[#1D0084] font-bold text-sm hover:bg-[#6cb5ff]"
                >
                  <Eye size={16} /> Mostrar significado
                </button>
              )}
            </div>

            {/* Answer buttons (after reveal) */}
            {revealed && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => answer(false)}
                  className="inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100"
                >
                  <X size={16} /> Repasar
                </button>
                <button
                  onClick={() => answer(true)}
                  className="inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
                >
                  <Check size={16} /> Lo sé
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </GeneralWrapperStyled>
  )
}
