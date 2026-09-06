'use client'

import React, { useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import toast from 'react-hot-toast'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { FileText, ImageIcon, Loader2, MessageSquare, Mic, Paperclip, Pencil, Trash2, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  uploadChatAttachment,
  type ChatAttachment,
  type DiscussionWithAuthor,
} from '@services/communities/discussions'
import UserAvatar from '@components/Objects/UserAvatar'
import VoiceRecorder from '@components/Pages/Messages/VoiceRecorder'
import ComposerButton from './ComposerButton'
import { getAvatarUrl } from './ChannelChat'

dayjs.extend(relativeTime)
dayjs.extend(utc)

/**
 * El hilo de un mensaje, en la columna de la derecha.
 *
 * Sustituye al panel de fijados mientras está abierto, como en Circle: una
 * conversación larga se saca de en medio del canal sin perderla, y quien no
 * participa no la sufre.
 *
 * Usa el mismo `useDiscussions` que el canal, así que comparte la caché: abrir
 * un hilo no cuesta ni una petición más.
 */

/**
 * Las mismas 12 h que en el canal (`ChannelChat`).
 *
 * Una respuesta de un hilo es un mensaje como cualquier otro: si en el canal se
 * puede corregir una errata durante las primeras horas, aquí también. Hasta
 * ahora **no se podía ni editar ni borrar una respuesta de un hilo**, ni
 * siquiera la tuya, ni siendo del equipo: la pantalla no pintaba los botones.
 * Quien metía la pata en un hilo se quedaba con la errata para siempre.
 */
const VENTANA_EDICION_MS = 12 * 60 * 60 * 1000

function localDay(date: string) {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date)
  return hasTz ? dayjs(date) : dayjs.utc(date).local()
}

function textOf(d: DiscussionWithAuthor): string {
  if (!d.content) return d.title
  try {
    const doc = JSON.parse(d.content)
    if (!Array.isArray(doc?.content)) return d.title
    const lines = doc.content.map((block: any) => {
      const parts: string[] = []
      const walk = (n: any) => {
        if (!n) return
        if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
        if (Array.isArray(n.content)) n.content.forEach(walk)
      }
      walk(block)
      return parts.join('')
    })
    return lines.join('\n').trim() || d.title
  } catch {
    return d.title
  }
}

function attachmentsOf(d: DiscussionWithAuthor): ChatAttachment[] {
  if (!d.content) return []
  try {
    const doc = JSON.parse(d.content)
    return Array.isArray(doc?.attachments) ? (doc.attachments as ChatAttachment[]) : []
  } catch {
    return []
  }
}

function parentOf(d: DiscussionWithAuthor): string | null {
  if (!d.content) return null
  try {
    const doc = JSON.parse(d.content)
    return typeof doc?.threadParent === 'string' ? doc.threadParent : null
  } catch {
    return null
  }
}

function nameOf(author: any): string {
  if (!author) return 'Alguien'
  const full = [author.first_name, author.last_name].filter(Boolean).join(' ').trim()
  return full || author.username || 'Alguien'
}

function Message({
  m,
  puedeEditar,
  puedeBorrar,
  onEditar,
  onBorrar,
}: {
  m: DiscussionWithAuthor
  puedeEditar: boolean
  puedeBorrar: boolean
  onEditar: (m: DiscussionWithAuthor) => void
  onBorrar: (uuid: string) => void
}) {
  const files = attachmentsOf(m)
  return (
    <div className="group/resp relative flex gap-2.5">
      {(puedeEditar || puedeBorrar) && (
        <div className="absolute -top-1 right-0 z-10 hidden group-hover/resp:flex items-center gap-0.5 rounded-lg bg-white border border-[#E3E8EF] shadow-sm px-0.5 py-0.5">
          {puedeEditar && (
            <button
              type="button"
              onClick={() => onEditar(m)}
              aria-label="Editar"
              title="Editar"
              className="p-1.5 rounded-md text-[#8A96AB] hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
          {puedeBorrar && (
            <button
              type="button"
              onClick={() => onBorrar(m.discussion_uuid)}
              aria-label="Borrar"
              title="Borrar"
              className="p-1.5 rounded-md text-[#8A96AB] hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <UserAvatar
        width={30}
        rounded="rounded-full"
        avatar_url={getAvatarUrl(m.author) || undefined}
        predefined_avatar={m.author?.avatar_image ? undefined : 'empty'}
        userId={m.author?.id?.toString()}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-gray-900 truncate">
            {nameOf(m.author)}
          </span>
          <span className="text-[11px] text-[#8A96AB] shrink-0">
            {localDay(m.creation_date).locale('es').format('HH:mm')}
          </span>
        </div>
        <p className="text-[14px] text-[#3F4A61] leading-relaxed whitespace-pre-wrap break-words">
          {textOf(m)}
        </p>
        {files.map((f, i) =>
          f.kind === 'image' ? (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
              <img src={f.url} alt={f.name} loading="lazy" className="rounded-lg max-h-48 w-auto" />
            </a>
          ) : f.kind === 'audio' ? (
            <audio key={i} src={f.url} controls preload="none" className="mt-1.5 w-full h-9" />
          ) : (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-[#F0F5FF] px-2.5 py-1.5 text-[12.5px] text-[#025dc7]"
            >
              <FileText size={14} /> <span className="truncate max-w-[160px]">{f.name}</span>
            </a>
          )
        )}
      </div>
    </div>
  )
}

export default function ThreadPanel({
  communityUuid,
  parentUuid,
  onClose,
}: {
  communityUuid: string
  parentUuid: string
  onClose: () => void
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const mutateDiscussions = useMutateDiscussions()
  const { discussions } = useDiscussions({
    communityUuid,
    sortBy: 'recent',
    page: 1,
    limit: 50,
  })

  const { isStaff } = useAdminStatus() as any
  const currentUserId = session?.data?.user?.id
  const [editandoUuid, setEditandoUuid] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [borrandoUuid, setBorrandoUuid] = useState<string | null>(null)

  /** Editar: solo lo tuyo y dentro de las primeras 12 h. Un administrador NO
   *  edita mensajes ajenos — eso sería escribir por otro. Mismo criterio que
   *  en el canal. */
  const puedeEditar = (m: DiscussionWithAuthor) =>
    !!currentUserId &&
    m.author?.id === currentUserId &&
    Date.now() - localDay(m.creation_date).valueOf() < VENTANA_EDICION_MS

  /** Borrar: lo tuyo reciente, o cualquier cosa si atiendes alumnos. `isStaff`
   *  y no `isAdmin` porque el profe modera la comunidad sin entrar al panel. */
  const puedeBorrar = (m: DiscussionWithAuthor) => !!isStaff || puedeEditar(m)

  const empezarEdicion = (m: DiscussionWithAuthor) => {
    setEditandoUuid(m.discussion_uuid)
    setTextoEdicion(textOf(m))
  }

  const guardarEdicion = async () => {
    const msg = textoEdicion.trim()
    if (!msg || !editandoUuid || !accessToken) return
    try {
      // Se reconstruye el documento CONSERVANDO `threadParent`: sin eso la
      // respuesta editada se saldría del hilo y aparecería suelta en el canal.
      const doc: any = {
        type: 'doc',
        content: msg.split('\n').map((line) => ({
          type: 'paragraph',
          content: line.trim() ? [{ type: 'text', text: line }] : [],
        })),
        threadParent: parentUuid,
      }
      const original = replies.find((x) => x.discussion_uuid === editandoUuid)
      const adjuntos = original ? attachmentsOf(original) : []
      if (adjuntos.length) doc.attachments = adjuntos
      await updateDiscussion(
        editandoUuid,
        { title: msg.slice(0, 100) || 'Respuesta', content: JSON.stringify(doc) },
        accessToken
      )
      setEditandoUuid(null)
      setTextoEdicion('')
      mutateDiscussions(communityUuid)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo editar la respuesta.')
    }
  }

  const borrar = async (uuid: string) => {
    if (!accessToken) return
    try {
      await deleteDiscussion(uuid, accessToken)
      setBorrandoUuid(null)
      mutateDiscussions(communityUuid)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar la respuesta.', { duration: 8000 })
    }
  }

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parent = useMemo(
    () => discussions.find((d: DiscussionWithAuthor) => d.discussion_uuid === parentUuid),
    [discussions, parentUuid]
  )

  const replies = useMemo(
    () =>
      discussions
        .filter((d: DiscussionWithAuthor) => parentOf(d) === parentUuid)
        .sort((a, b) => localDay(a.creation_date).valueOf() - localDay(b.creation_date).valueOf()),
    [discussions, parentUuid]
  )

  const attach = async (files: FileList | null) => {
    if (!files?.length || !accessToken) return
    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const uploaded = await uploadChatAttachment(communityUuid, file, accessToken)
        setPending((cur) => [...cur, uploaded])
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir el archivo')
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const attachVoice = async (audio: Blob, seconds: number) => {
    if (!accessToken) return
    setUploading(true)
    try {
      const file = new File([audio], `nota-de-voz-${seconds}s.webm`, {
        type: audio.type || 'audio/webm',
      })
      const uploaded = await uploadChatAttachment(communityUuid, file, accessToken)
      setPending((cur) => [...cur, uploaded])
      setRecording(false)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir la nota de voz')
    } finally {
      setUploading(false)
    }
  }

  const send = async () => {
    const msg = text.trim()
    if ((!msg && pending.length === 0) || sending || !accessToken) return
    setSending(true)
    try {
      const doc: any = {
        type: 'doc',
        content: msg.split('\n').map((line) => ({
          type: 'paragraph',
          content: line.trim() ? [{ type: 'text', text: line }] : [],
        })),
        // De qué mensaje cuelga. Es lo que lo saca del canal y lo mete aquí.
        threadParent: parentUuid,
      }
      if (pending.length) doc.attachments = pending
      await createDiscussion(
        communityUuid,
        {
          title: msg.slice(0, 100) || pending[0]?.name || 'Respuesta',
          content: JSON.stringify(doc),
          label: 'general',
          emoji: null,
        },
        accessToken
      )
      setText('')
      setPending([])
      mutateDiscussions(communityUuid)
    } catch {
      toast.error('No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    // Sin tarjeta ni sombra: el hilo es una parte de la pantalla del canal,
    // no una cajita flotando dentro de ella.
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EEF3FB]">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-[#025dc7] shrink-0" />
          <h2 className="text-[14px] font-bold text-gray-900">Hilo</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar el hilo"
          title="Cerrar el hilo"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3">
        {parent ? (
          <>
            {/* El mensaje del que cuelga el hilo se enseña, pero sus botones
                viven en el canal, que es donde está de verdad. Borrarlo desde
                aquí dejaría el hilo colgando de nada. */}
            <Message
              m={parent}
              puedeEditar={false}
              puedeBorrar={false}
              onEditar={() => {}}
              onBorrar={() => {}}
            />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11.5px] font-medium text-[#8A96AB] shrink-0">
                {replies.length === 0
                  ? 'Sin respuestas todavía'
                  : `${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}`}
              </span>
              <span className="flex-1 h-px bg-[#EEF3FB]" />
            </div>
            {replies.map((r) =>
              editandoUuid === r.discussion_uuid ? (
                <div key={r.discussion_uuid} className="pl-[42px]">
                  <textarea
                    value={textoEdicion}
                    onChange={(e) => {
                      setTextoEdicion(e.target.value)
                      e.currentTarget.style.height = 'auto'
                      e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 320)}px`
                    }}
                    ref={(el) => {
                      if (!el) return
                      el.style.height = 'auto'
                      el.style.height = `${Math.min(el.scrollHeight, 320)}px`
                    }}
                    autoFocus
                    className="w-full resize-y min-h-[72px] rounded-xl bg-white border border-[#4da3ff] px-3 py-2 text-[14px] leading-relaxed text-gray-900 outline-none focus:ring-2 focus:ring-[#4da3ff]/25"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={guardarEdicion}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#025dc7] text-white text-xs font-semibold hover:bg-[#0b6df0]"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditandoUuid(null); setTextoEdicion('') }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : borrandoUuid === r.discussion_uuid ? (
                /* Confirmación en el sitio, sin abrir otra ventana encima: el
                   hilo ya vive dentro de un panel y apilar modales en el móvil
                   deja al alumno sin saber qué está cerrando. */
                <div
                  key={r.discussion_uuid}
                  className="ml-[42px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5"
                >
                  <p className="text-[13px] text-rose-800">¿Borrar esta respuesta?</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => borrar(r.discussion_uuid)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setBorrandoUuid(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <Message
                  key={r.discussion_uuid}
                  m={r}
                  puedeEditar={puedeEditar(r)}
                  puedeBorrar={puedeBorrar(r)}
                  onEditar={empezarEdicion}
                  onBorrar={setBorrandoUuid}
                />
              )
            )}
          </>
        ) : (
          <p className="text-[13px] text-[#8A96AB] py-6 text-center">
            Ese mensaje ya no está.
          </p>
        )}
      </div>

      {accessToken && parent && (
        <div className="px-3 pb-3 pt-1">
          {recording && (
            <div className="mb-2 rounded-xl bg-white border border-[#E3E8EF] px-3 py-2.5">
              <VoiceRecorder onSend={attachVoice} sending={uploading} />
            </div>
          )}

          {(pending.length > 0 || uploading) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((f, i) => (
                <div
                  key={i}
                  className="relative group/att rounded-lg border border-[#DDE6F5] bg-white overflow-hidden"
                >
                  {f.kind === 'image' ? (
                    <img src={f.url} alt={f.name} className="h-14 w-14 object-cover" />
                  ) : (
                    <div className="h-14 px-2.5 flex items-center gap-1.5 text-[11.5px] text-[#5A6480] max-w-[150px]">
                      {f.kind === 'audio' ? (
                        <Mic size={13} className="text-[#025dc7] shrink-0" />
                      ) : (
                        <FileText size={13} className="text-[#025dc7] shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))}
                    aria-label="Quitar adjunto"
                    className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/55 text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="h-14 w-14 rounded-lg border border-dashed border-[#DDE6F5] flex items-center justify-center">
                  <Loader2 size={15} className="animate-spin text-[#025dc7]" />
                </div>
              )}
            </div>
          )}

          {/* La misma caja que abajo en el canal, para que no haya que aprender
              dos compositores distintos. */}
          <div className="rounded-xl border border-[#E3E8EF] bg-white transition-colors focus-within:border-[#4da3ff] focus-within:ring-[3px] focus-within:ring-[#4da3ff]/15">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder="Responder en el hilo…"
              className="w-full resize-none bg-transparent text-base sm:text-[14px] text-gray-900 placeholder:text-[#9CA3AF] outline-none max-h-32 px-3 pt-2.5 pb-1.5"
            />
            <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
              <input ref={fileInputRef} type="file" hidden onChange={(e) => attach(e.target.files)} />
              <ComposerButton
                label="Adjuntar un archivo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip size={16} />
              </ComposerButton>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => attach(e.target.files)}
              />
              <ComposerButton
                label="Enviar una foto"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
              >
                <ImageIcon size={16} />
              </ComposerButton>
              <ComposerButton
                label="Grabar una nota de voz"
                onClick={() => setRecording((v) => !v)}
                active={recording}
              >
                <Mic size={16} />
              </ComposerButton>

              <div className="flex-1" />

              <button
                onClick={send}
                disabled={(!text.trim() && pending.length === 0) || sending}
                title="Enviar"
                aria-label="Enviar"
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors bg-[#025dc7] text-white hover:bg-[#0b6df0] disabled:bg-[#EFF1F6] disabled:text-[#B6BECC] disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <PaperPlaneRight size={15} weight="fill" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
