'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import {
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  createDiscussion,
  deleteDiscussion,
  getCommentCount,
  uploadChatAttachment,
  toggleReaction,
  type ChatAttachment,
  type DiscussionWithAuthor,
} from '@services/communities/discussions'
import { getUriWithOrg } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import VoiceRecorder from '@components/Pages/Messages/VoiceRecorder'
import ComposerButton from './ComposerButton'
import ConfirmDialog from './ConfirmDialog'
import { QUICK_EMOJIS } from '@/lib/chat/emojis'

dayjs.extend(relativeTime)
dayjs.extend(utc)

/**
 * Un canal de tipo tablón: cada aportación es un post con su título, su
 * cuerpo, sus fotos y sus comentarios.
 *
 * Para qué sirve esto y no el chat: las victorias, las presentaciones o los
 * retos merecen quedarse. En un chat, a los dos días están treinta mensajes
 * más abajo y no las encuentra nadie; en un tablón siguen ahí, con su título,
 * y la gente puede reaccionar y comentar días después.
 *
 * Reutiliza lo que ya había: los posts son `Discussion` (que ya tenían título,
 * cuerpo y comentarios) y los adjuntos viajan dentro igual que en el chat.
 */

function localDay(date: string) {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date)
  return hasTz ? dayjs(date) : dayjs.utc(date).local()
}

/** El cuerpo del post, en texto plano, para el resumen de la tarjeta. */
function bodyOf(d: DiscussionWithAuthor): string {
  if (!d.content) return ''
  try {
    const doc = JSON.parse(d.content)
    if (!Array.isArray(doc?.content)) return ''
    return doc.content
      .map((block: any) => {
        const parts: string[] = []
        const walk = (n: any) => {
          if (!n) return
          if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
          if (Array.isArray(n.content)) n.content.forEach(walk)
        }
        walk(block)
        return parts.join('')
      })
      .join('\n')
      .trim()
  } catch {
    return ''
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

function authorName(d: DiscussionWithAuthor): string {
  const a: any = d.author
  if (!a) return 'Alguien'
  const full = [a.first_name, a.last_name].filter(Boolean).join(' ').trim()
  return full || a.username || 'Alguien'
}

export default function ChannelPosts({
  communityUuid,
  channelName,
  orgslug,
}: {
  communityUuid: string
  channelName: string
  orgslug: string
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isStaff } = (useAdminStatus() as any) || {}
  // Qué post espera confirmación para borrarse.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const currentUserId = session?.data?.user?.id
  const mutateDiscussions = useMutateDiscussions()

  const { discussions, isLoading } = useDiscussions({
    communityUuid,
    sortBy: 'recent',
    page: 1,
    limit: 50,
  })

  const [composing, setComposing] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})

  // Cuántos comentarios tiene cada post (una llamada por post, en paralelo).
  useEffect(() => {
    if (!discussions.length) return
    let alive = true
    Promise.all(
      discussions.map(async (d: DiscussionWithAuthor) => {
        try {
          const n = await getCommentCount(d.discussion_uuid, accessToken)
          return [d.discussion_uuid, typeof n === 'number' ? n : 0] as const
        } catch {
          return [d.discussion_uuid, 0] as const
        }
      })
    ).then((pairs) => {
      if (alive) setCounts(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [discussions, accessToken])

  const confirmRemove = async () => {
    const uuid = pendingDelete
    if (!uuid) return
    setDeleting(true)
    try {
      await deleteDiscussion(uuid, accessToken)
      mutateDiscussions(communityUuid)
      setPendingDelete(null)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el post.', { duration: 10000 })
    } finally {
      setDeleting(false)
    }
  }

  const react = async (uuid: string, emoji: string) => {
    if (!accessToken) return
    try {
      await toggleReaction(uuid, emoji, accessToken)
      mutateDiscussions(communityUuid)
    } catch {
      /* silencioso: una reacción que falla no merece un aviso */
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[13px] text-[#5A6480]">
          {discussions.length === 0
            ? 'Todavía no hay ninguna publicación.'
            : `${discussions.length} ${discussions.length === 1 ? 'publicación' : 'publicaciones'}`}
        </p>
        {accessToken && (
          <button
            onClick={() => setComposing(true)}
            // CTA de marca: #4da3ff con letra #0a1656. El #1D0084 que había es
            // color de FONDO oscuro, no de botón sobre blanco.
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-sm font-bold transition-colors"
          >
            <Plus size={16} /> Publicar
          </button>
        )}
      </div>

      {isLoading && discussions.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDE6F5] bg-white px-6 py-14 text-center">
          <MessageSquare size={26} className="text-[#C6D2E6] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-gray-900">
            Sé el primero en publicar en {channelName}
          </p>
          <p className="text-[13px] text-[#5A6480] mt-1 max-w-sm mx-auto">
            Un título, lo que quieras contar y, si te apetece, una foto o una nota
            de voz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((d: DiscussionWithAuthor) => {
            const files = attachmentsOf(d)
            const cover = files.find((f) => f.kind === 'image')
            const body = bodyOf(d)
            const mine = (d.author as any)?.id === currentUserId
            // La página del post vuelve a añadir los prefijos `community_` y
            // `discussion_`, así que aquí van SIN ellos. Con el identificador
            // entero buscaba `discussion_discussion_…`, no encontraba nada y
            // enseñaba "no tienes acceso" — que además no era verdad.
            const href = getUriWithOrg(
              orgslug,
              `/community/${communityUuid.replace('community_', '')}` +
                `/discussion/${d.discussion_uuid.replace('discussion_', '')}`
            )
            return (
              <article
                key={d.discussion_uuid}
                className="group rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden hover:border-[#4da3ff] transition-colors"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <UserAvatar
                      width={28}
                      avatar_url={
                        (d.author as any)?.avatar_image
                          ? getUserAvatarMediaDirectory(
                              (d.author as any).user_uuid,
                              (d.author as any).avatar_image
                            )
                          : undefined
                      }
                      predefined_avatar={(d.author as any)?.avatar_image ? undefined : 'empty'}
                      userId={String((d.author as any)?.id ?? '')}
                      rounded="rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {authorName(d)}
                      </p>
                      <p className="text-[11.5px] text-[#8A96AB]">
                        {localDay(d.creation_date).locale('es').fromNow()}
                      </p>
                    </div>
                    {(mine || isStaff) && (
                      <button
                        onClick={() => setPendingDelete(d.discussion_uuid)}
                        title="Eliminar"
                        aria-label="Eliminar publicación"
                        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <Link href={href} className="block">
                    <h3
                      className="text-[16px] sm:text-[17px] font-bold text-gray-900 leading-snug hover:text-[#025dc7] transition-colors"
                      style={{
                        fontFamily:
                          'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
                      }}
                    >
                      {d.title}
                    </h3>
                    {body && (
                      <p className="text-[14px] text-[#3F4A61] leading-relaxed mt-1.5 line-clamp-3 whitespace-pre-wrap">
                        {body}
                      </p>
                    )}
                  </Link>

                  {cover && (
                    <Link href={href} className="block mt-3">
                      <img
                        src={cover.url}
                        alt={cover.name}
                        loading="lazy"
                        className="rounded-xl w-full max-h-80 object-cover"
                      />
                    </Link>
                  )}

                  {files
                    .filter((f) => f.kind === 'audio')
                    .map((f, i) => (
                      <audio
                        key={i}
                        src={f.url}
                        controls
                        preload="none"
                        className="mt-3 w-full max-w-[320px] h-9"
                      />
                    ))}
                </div>

                <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-t border-[#EEF3FB] bg-[#FCFDFF]">
                  {QUICK_EMOJIS.slice(0, 4).map((e) => {
                    const mine = (d.reactions || []).find((r: any) => r.emoji === e)
                    return (
                      <button
                        key={e}
                        onClick={() => react(d.discussion_uuid, e)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[13px] transition-colors ${
                          mine?.has_reacted
                            ? 'bg-[#F0F5FF] text-[#025dc7]'
                            : 'hover:bg-[#F0F5FF] text-[#5A6480]'
                        }`}
                      >
                        <span>{e}</span>
                        {mine?.count ? (
                          <span className="text-[11px] font-semibold tabular-nums">
                            {mine.count}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                  <div className="flex-1" />
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12.5px] font-medium text-[#5A6480] hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
                  >
                    <MessageSquare size={14} />
                    {counts[d.discussion_uuid] ?? 0}{' '}
                    {counts[d.discussion_uuid] === 1 ? 'comentario' : 'comentarios'}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {composing && (
        <PostComposer
          communityUuid={communityUuid}
          channelName={channelName}
          onClose={() => setComposing(false)}
          onPublished={() => {
            setComposing(false)
            mutateDiscussions(communityUuid)
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        busy={deleting}
        title="¿Eliminar este post?"
        description="Desaparece para todos, con sus comentarios, y no se puede deshacer."
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

/** La ventana de escribir un post: título, cuerpo y adjuntos. */
function PostComposer({
  communityUuid,
  channelName,
  onClose,
  onPublished,
}: {
  communityUuid: string
  channelName: string
  onClose: () => void
  onPublished: () => void
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  const publish = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const doc: any = {
        type: 'doc',
        content: body.split('\n').map((line) => ({
          type: 'paragraph',
          content: line.trim() ? [{ type: 'text', text: line }] : [],
        })),
      }
      if (pending.length) doc.attachments = pending
      await createDiscussion(
        communityUuid,
        { title: title.trim().slice(0, 200), content: JSON.stringify(doc), label: 'general', emoji: null },
        accessToken
      )
      toast.success('Publicado')
      onPublished()
    } catch {
      toast.error('No se pudo publicar')
    } finally {
      setSaving(false)
    }
  }

  // ⚠️ Va por un portal a la raíz del documento.
  //
  // Pintado donde estaba, el modal quedaba ATRAPADO en el contexto de apilado
  // de la página: por muy alto que fuera su z-index, solo contaba dentro de su
  // trozo, y la barra superior del móvil se le ponía encima y le cortaba la
  // cabecera. Sacándolo a la raíz, su z-index vuelve a valer contra todo lo
  // demás.
  const modal = (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-6"
      style={{ zIndex: 'var(--z-modal-content, 220)' }}
      onClick={onClose}
    >
      {/* En el móvil sube desde abajo y ocupa lo que necesita, con el cuerpo
          desplazándose por dentro; antes crecía hacia arriba hasta meterse
          debajo de la barra. En escritorio se queda centrado como estaba. */}
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#EEF3FB]">
          <h2 className="text-[16px] font-bold text-gray-900">Publicar en {channelName}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            autoFocus
            className="w-full text-[19px] font-bold text-gray-900 placeholder:text-[#C6D2E6] outline-none"
            style={{
              fontFamily:
                'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
            }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Cuenta lo que quieras…"
            className="w-full mt-2 resize-none text-[15px] text-[#3F4A61] leading-relaxed placeholder:text-[#9CA3AF] outline-none"
          />

          {recording && (
            <div className="mt-2 rounded-xl bg-[#F8FAFF] border border-[#DDE6F5] px-3 py-2.5">
              <VoiceRecorder onSend={attachVoice} sending={uploading} />
            </div>
          )}

          {(pending.length > 0 || uploading) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {pending.map((f, i) => (
                <div
                  key={i}
                  className="relative group/att rounded-lg border border-[#DDE6F5] overflow-hidden"
                >
                  {f.kind === 'image' ? (
                    <img src={f.url} alt={f.name} className="h-20 w-20 object-cover" />
                  ) : (
                    <div className="h-20 px-3 flex items-center gap-2 text-[12px] text-[#5A6480] max-w-[200px]">
                      {f.kind === 'audio' ? (
                        <Mic size={14} className="text-[#025dc7] shrink-0" />
                      ) : (
                        <FileText size={14} className="text-[#025dc7] shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))}
                    aria-label="Quitar adjunto"
                    className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/55 text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="h-20 w-20 rounded-lg border border-dashed border-[#DDE6F5] flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-[#025dc7]" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-0.5 px-4 py-3 border-t border-[#EEF3FB]">
          <input ref={fileInputRef} type="file" hidden onChange={(e) => attach(e.target.files)} />
          <ComposerButton
            label="Adjuntar un archivo"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip size={17} />
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
            label="Añadir una foto"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon size={17} />
          </ComposerButton>
          <ComposerButton
            label="Grabar una nota de voz"
            onClick={() => setRecording((v) => !v)}
            active={recording}
          >
            <Mic size={17} />
          </ComposerButton>

          <div className="flex-1" />

          <button
            onClick={publish}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-sm font-bold transition-colors disabled:bg-[#EFF1F6] disabled:text-[#B6BECC]"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
