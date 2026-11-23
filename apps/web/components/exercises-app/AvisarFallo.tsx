'use client'

/**
 * «¿Ves un fallo? Avísanos», debajo de cada ejercicio (23/11/2026).
 *
 * Un alumno encontró dos errores en el módulo 2 y no tenía por dónde decirlo.
 * El enlace es pequeño y gris a propósito: no compite con el ejercicio. Al
 * tocarlo sale una ventana pintada por la escuela (abajo en el móvil, en el
 * centro en el ordenador): qué pasa, de un toque, y un comentario si quiere.
 * Con el aviso viaja lo que tenía delante (enunciado, opciones, la respuesta
 * que la escuela da por buena y lo que él contestó), para que quien lo lea en
 * Panel → Formación → «Fallos avisados» no tenga que ir a buscarlo.
 *
 * La lección y la clase llegan por contexto (`ContextoFallo`, puesto una vez
 * en `LessonViewer`), como `ContextoResaltado`: los ejercicios viven tres
 * componentes más abajo y ninguno de en medio usa ese dato.
 */

import React, { useContext, useEffect, useState } from 'react'
import { Check, Flag, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { avisarFallo } from '@services/ejercicios/fallos'
import { MOTIVOS_FALLO, datosDelEjercicio, type DondeEsta, type MotivoFallo } from '@/lib/nawar/fallosEjercicios'
import type { ExerciseItem } from '@/lib/exercises-app/types'

export type DondeDelFallo = DondeEsta & { lessonId?: string }

export const ContextoFallo = React.createContext<DondeDelFallo | null>(null)

export default function AvisarFallo({ exercise, respuesta }: { exercise: ExerciseItem; respuesta?: string }) {
  const donde = useContext(ContextoFallo)
  const session = useLHSession() as any
  const org = useOrg() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [abierta, setAbierta] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // Sin sesión no hay a quién apuntárselo (la app de ejercicios se puede abrir suelta).
  if (!token || !org?.id) return null

  return (
    <div className="mt-3 flex justify-end">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium text-[#8A93A8] hover:text-[#0b2da0] transition-colors"
      >
        {enviado ? <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> : <Flag size={12} strokeWidth={2.2} />}
        {enviado ? 'Aviso enviado. Gracias.' : '¿Ves un fallo? Avísanos'}
      </button>
      {abierta ? (
        <Ventana
          exercise={exercise}
          respuesta={respuesta}
          donde={donde || {}}
          orgId={org.id}
          token={token}
          onCerrar={(ok) => {
            setAbierta(false)
            if (ok) setEnviado(true)
          }}
        />
      ) : null}
    </div>
  )
}

function Ventana({
  exercise,
  respuesta,
  donde,
  orgId,
  token,
  onCerrar,
}: {
  exercise: ExerciseItem
  respuesta?: string
  donde: DondeDelFallo
  orgId: number
  token: string
  onCerrar: (enviado: boolean) => void
}) {
  const [motivo, setMotivo] = useState<MotivoFallo | ''>('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(false)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar(hecho)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar, hecho])

  // «Gracias» un momento y se cierra sola: no hay nada más que hacer ahí.
  useEffect(() => {
    if (!hecho) return
    const t = window.setTimeout(() => onCerrar(true), 1800)
    return () => window.clearTimeout(t)
  }, [hecho, onCerrar])

  const enviar = async () => {
    if (!motivo || enviando) return
    setEnviando(true)
    setError('')
    const r = await avisarFallo(
      orgId,
      {
        lesson_id: donde.lessonId || '',
        exercise_id: exercise.id,
        motivo,
        comentario: comentario.trim(),
        datos: datosDelEjercicio(exercise, respuesta, donde),
      },
      token
    )
    setEnviando(false)
    if (r.ok) setHecho(true)
    else setError(r.error)
  }

  return (
    <EnElCuerpo>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center bg-[#0B1033]/40 p-0 sm:p-4"
        onClick={() => onCerrar(hecho)}
        role="dialog"
        aria-modal="true"
        aria-label="Avisar de un fallo en este ejercicio"
      >
        <div
          className="w-full sm:max-w-[440px] max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:pb-5"
          onClick={(e) => e.stopPropagation()}
        >
          {hecho ? (
            <div className="py-6 text-center">
              <Check size={30} strokeWidth={2.6} className="mx-auto text-[#16A34A]" />
              <p className="mt-3 text-[17px] font-semibold text-[#0B1033]">Gracias, lo miramos</p>
              <p className="mt-1 text-[14px] text-[#5A6480]">Puedes seguir con la lección.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold text-[#0B1033]">¿Qué fallo ves?</h2>
                  {exercise.prompt ? <p className="mt-1 text-[13.5px] leading-snug text-[#5A6480] line-clamp-2">{exercise.prompt}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onCerrar(false)}
                  aria-label="Cerrar"
                  className="-mr-1.5 -mt-1 shrink-0 p-1.5 text-[#8A93A8] hover:text-[#0B1033]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {MOTIVOS_FALLO.map((m) => {
                  const elegido = motivo === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMotivo(m.id)}
                      aria-pressed={elegido}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-[14.5px] transition-colors ${
                        elegido ? 'border-[#0b2da0] bg-[#F3F6FF] font-semibold text-[#0B1033]' : 'border-[#DDE6F5] text-[#0B1033] hover:border-[#B9C6E4]'
                      }`}
                    >
                      <span
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                          elegido ? 'border-[#0b2da0]' : 'border-[#C3CDE3]'
                        }`}
                      >
                        {elegido ? <span className="h-2 w-2 rounded-full bg-[#0b2da0]" /> : null}
                      </span>
                      {m.texto}
                    </button>
                  )
                })}
              </div>

              <label className="mt-4 block text-[13px] font-semibold text-[#0B1033]" htmlFor={`fallo-${exercise.id}`}>
                ¿Quieres contarnos algo más? <span className="font-normal text-[#8A93A8]">(opcional)</span>
              </label>
              <textarea
                id={`fallo-${exercise.id}`}
                value={comentario}
                onChange={(e) => setComentario(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Por ejemplo: también vale «een vriend»."
                className="mt-1.5 w-full resize-none rounded-lg border border-[#DDE6F5] px-3 py-2.5 text-[14.5px] text-[#0B1033] placeholder:text-[#9AA3B8] outline-none focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/15"
              />

              {error ? <p className="mt-3 text-[13.5px] text-[#B4413C]">{error}</p> : null}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => onCerrar(false)}
                  className="rounded-lg border border-[#DDE6F5] px-4 py-2.5 text-[14.5px] font-semibold text-[#5A6480] hover:text-[#0B1033]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!motivo || enviando}
                  className="rounded-lg bg-[#0b2da0] px-5 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#0a2689] disabled:opacity-45"
                >
                  {enviando ? 'Enviando…' : 'Enviar aviso'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </EnElCuerpo>
  )
}
