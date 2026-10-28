'use client'

/**
 * La tarea de una semana (28/10/2026): el alumno escribe y/o graba una nota de
 * voz sin salir de la escuela, la entrega, y aquí mismo le llega la corrección
 * (texto y/o nota de voz). Mientras no esté corregida la puede cambiar.
 * La lógica, en apps/api/src/services/tareas/tareas.py.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Check, Loader2, Mic, Trash2 } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import VoiceRecorder from '@components/Pages/Messages/VoiceRecorder'
import AudioPrivado from './AudioPrivado'
import { diaCorto, entregarTarea, getTarea, marcarVista, type TareaDetalle } from '@services/tareas/tareas'

function fechaHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).replace('.', '')
}

export default function TareaPage({ tareaId }: { tareaId: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const orgslug = org?.slug || ''
  const queryClient = useQueryClient()
  const clave = ['tareas', 'tarea', String(tareaId)]
  const { data, error, isLoading } = useQuery<TareaDetalle>({
    queryKey: clave,
    queryFn: () => getTarea(tareaId, token),
    enabled: !!token && !!tareaId,
    retry: 1,
  })

  const [texto, setTexto] = useState('')
  const [audio, setAudio] = useState<{ blob: Blob; seg: number; url: string } | null>(null)
  const [quitarAudio, setQuitarAudio] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [editando, setEditando] = useState(false)

  const entrega = data?.entrega || null
  const corregida = entrega?.estado === 'corregida'

  // Lo que ya había entregado, en el formulario.
  useEffect(() => {
    if (data) setTexto(data.entrega?.texto || '')
  }, [data?.entrega?.id, data?.entrega?.actualizada_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al abrir una corrección nueva, se da por vista (apaga el aviso de la campana).
  useEffect(() => {
    if (data && corregida && !entrega?.vista_at && !data.equipo) {
      marcarVista(data.id, token)
        .then(() => queryClient.invalidateQueries({ queryKey: ['tareas'] }))
        .catch(() => {})
    }
  }, [data?.id, corregida, entrega?.vista_at]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (audio?.url) URL.revokeObjectURL(audio.url)
  }, [audio?.url])

  const rutaClase = useMemo(() => (data ? getUriWithOrg(orgslug, `/course/${data.course_uuid}`) : '#'), [data, orgslug])

  async function entregar() {
    if (!data) return
    if (!texto.trim() && !audio && !(entrega?.tiene_audio && !quitarAudio)) {
      toast.error('Escribe algo o graba una nota de voz antes de entregar')
      return
    }
    setEnviando(true)
    try {
      await entregarTarea(data.id, { texto, audio: audio?.blob || null, audioSeg: audio?.seg || 0, quitarAudio }, token)
      setAudio(null)
      setQuitarAudio(false)
      setEditando(false)
      await queryClient.invalidateQueries({ queryKey: ['tareas'] })
      toast.success(entrega ? 'Cambios guardados' : '¡Tarea entregada!')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo entregar')
    } finally {
      setEnviando(false)
    }
  }

  if (isLoading || (!data && !error)) {
    return (
      <GeneralWrapperStyled>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </GeneralWrapperStyled>
    )
  }
  if (error || !data) {
    return (
      <GeneralWrapperStyled>
        <p className="py-16 text-center text-[14px] text-[#6B7280]">{(error as any)?.message || 'No se ha encontrado la tarea.'}</p>
      </GeneralWrapperStyled>
    )
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const fueraDePlazo = data.limite && data.limite < hoy
  const formulario = !corregida && (!entrega || editando)

  return (
    <GeneralWrapperStyled>
      <div className="max-w-2xl">
        <Link href={rutaClase} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5A6480] hover:text-[#025dc7]">
          <ArrowLeft size={14} /> {data.curso}
        </Link>
        <div className="flex items-center gap-2 pt-3">
          <Mic size={24} className="text-[#025dc7] shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tarea · {data.tema}</h1>
        </div>
        <p className="mt-1 text-[14px] text-[#6B7280] first-letter:uppercase">
          {corregida ? 'Corregida' : `Entrega hasta el ${diaCorto(data.limite)}`}
          {fueraDePlazo && !entrega ? ' · el plazo ya pasó, pero puedes entregarla igual' : ''}
        </p>

        {data.equipo ? (
          <p className="mt-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-[12.5px] text-[#5A6480]">
            Así la ve el alumno. Para corregir las entregas, ve a Seguimiento semanal.
          </p>
        ) : null}

        <div className="mt-5 rounded-xl bg-[#F0F5FF] px-4 py-3.5 text-[14.5px] leading-relaxed text-[#0a1656] whitespace-pre-wrap">
          {data.enunciado || 'Esta semana no hay tarea.'}
        </div>

        {/* Lo que entregó (sin formulario abierto). */}
        {entrega && !formulario ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-[#0a1656]">Tu entrega</p>
              <p className="text-[12.5px] text-[#6B7280]">Entregada el {fechaHora(entrega.entregada_at)}</p>
            </div>
            {entrega.texto ? (
              <div className="mt-2 rounded-xl border border-[#DDE6F5] px-4 py-3 text-[14.5px] leading-relaxed whitespace-pre-wrap text-gray-900">
                {entrega.texto}
              </div>
            ) : null}
            {entrega.tiene_audio ? (
              <div className="mt-2">
                <AudioPrivado entregaId={entrega.id} cual="alumno" token={token} segundos={entrega.audio_seg} />
              </div>
            ) : null}
            {!corregida ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#025dc7]">
                  <Check size={14} strokeWidth={3} /> Entregada: tu profe la corregirá pronto
                </span>
                <button onClick={() => setEditando(true)} className="text-[13px] font-semibold text-[#5A6480] hover:text-[#025dc7] underline">
                  Cambiar algo
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* La corrección. */}
        {corregida && entrega ? (
          <div className="mt-6 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-4">
            <p className="flex items-center gap-1.5 text-[14px] font-bold text-[#15803D]">
              <Check size={15} strokeWidth={3} /> Corregida{entrega.corregida_por ? ` por ${entrega.corregida_por.split(' ')[0]}` : ''} ·{' '}
              {fechaHora(entrega.corregida_at)}
            </p>
            {entrega.correccion_texto ? (
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#1F2937] whitespace-pre-wrap">{entrega.correccion_texto}</p>
            ) : null}
            {entrega.tiene_correccion_audio ? (
              <div className="mt-3">
                <AudioPrivado entregaId={entrega.id} cual="correccion" token={token} segundos={entrega.correccion_audio_seg} />
              </div>
            ) : null}
            {!entrega.correccion_texto && !entrega.tiene_correccion_audio ? (
              <p className="mt-2 text-[14px] text-[#1F2937]">¡Todo bien! Sigue así.</p>
            ) : null}
          </div>
        ) : null}

        {/* El formulario: escribir y grabar. */}
        {formulario && data.tiene_tarea ? (
          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-[#0a1656]">Tu respuesta por escrito</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder="Escribe aquí en neerlandés…"
                className="w-full rounded-xl border border-[#DDE6F5] px-4 py-3 text-[15px] leading-relaxed text-gray-900 outline-none focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 resize-y"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-[#0a1656]">Tu nota de voz</p>
              {audio ? (
                <div className="flex items-center gap-2">
                  <audio src={audio.url} controls className="h-10 flex-1 min-w-0" />
                  <button
                    onClick={() => setAudio(null)}
                    title="Quitar esta grabación"
                    className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-[#F9FAFB]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : entrega?.tiene_audio && !quitarAudio ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <AudioPrivado entregaId={entrega.id} cual="alumno" token={token} segundos={entrega.audio_seg} />
                    </div>
                    <button
                      onClick={() => setQuitarAudio(true)}
                      title="Quitar la nota de voz"
                      className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-[#F9FAFB]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <VoiceRecorder
                    textoGrabar="Volver a grabar"
                    etiqueta="Usar esta grabación"
                    sending={false}
                    onSend={async (blob, seg) => setAudio({ blob, seg, url: URL.createObjectURL(blob) })}
                  />
                </div>
              ) : (
                <VoiceRecorder
                  textoGrabar="Grabar nota de voz"
                  etiqueta="Usar esta grabación"
                  sending={false}
                  onSend={async (blob, seg) => setAudio({ blob, seg, url: URL.createObjectURL(blob) })}
                />
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={entregar}
                disabled={enviando}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4da3ff] px-8 py-3.5 text-[15px] font-bold text-[#0a1656] hover:bg-[#5eb4ff] disabled:opacity-60"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                {entrega ? 'Guardar cambios' : 'Entregar la tarea'}
              </button>
              {editando ? (
                <button
                  onClick={() => {
                    setEditando(false)
                    setAudio(null)
                    setQuitarAudio(false)
                    setTexto(entrega?.texto || '')
                  }}
                  className="text-[13px] font-semibold text-[#5A6480] hover:text-gray-900"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </GeneralWrapperStyled>
  )
}
