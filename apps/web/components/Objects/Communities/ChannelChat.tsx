'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { Loader2, MessageCircle, Pin, PinOff, SmilePlus } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  createDiscussion,
  pinDiscussion,
  toggleReaction,
  DiscussionWithAuthor,
  DiscussionAuthor,
} from '@services/communities/discussions'

// Quick emoji set for the chat reaction picker.
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🙌', '👏', '🤔']
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import useAdminStatus from '@components/Hooks/useAdminStatus'

dayjs.extend(relativeTime)
dayjs.extend(utc)

// The API serialises creation_date as a naive UTC string (no timezone), which
// dayjs would otherwise read as local time. Treat tz-less strings as UTC, then
// convert to the viewer's local time.
function localDay(date: string) {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date)
  return hasTz ? dayjs(date) : dayjs.utc(date).local()
}

// Clock time (HH:mm) shown per message — the "hora de envío".
function clockTime(date: string): string {
  return localDay(date).locale('es').format('HH:mm')
}

// Epoch ms, to measure the gap between two consecutive messages.
function msOf(date: string): number {
  return localDay(date).valueOf()
}

// "Hoy" / "Ayer" / "3 de junio" — for the day separators between message groups.
function dayLabel(date: string): string {
  const d = localDay(date)
  const today = dayjs()
  if (d.isSame(today, 'day')) return 'Hoy'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Ayer'
  return d.locale('es').format('D [de] MMMM')
}

function dayKey(date: string): string {
  return localDay(date).format('YYYY-MM-DD')
}

function getAvatarUrl(author: DiscussionAuthor | null): string | null {
  if (!author?.avatar_image) return null
  if (author.avatar_image.startsWith('http://') || author.avatar_image.startsWith('https://')) {
    return author.avatar_image
  }
  return getUserAvatarMediaDirectory(author.user_uuid, author.avatar_image)
}

function authorName(author: DiscussionAuthor | null): string {
  if (!author) return '—'
  if (author.first_name || author.last_name) {
    return `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim()
  }
  return `@${author.username}`
}

// Pull plain text out of the stored tiptap JSON (falls back to the title).
function messageText(d: DiscussionWithAuthor): string {
  if (d.content) {
    try {
      const doc = JSON.parse(d.content)
      if (doc?.content && Array.isArray(doc.content)) {
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
        const text = lines.join('\n').trim()
        if (text) return text
      }
    } catch {
      // fall through to title
    }
  }
  return d.title
}

export function ChannelChat({
  communityUuid,
  channelName,
}: {
  communityUuid: string
  channelName: string
}) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus() as any
  const mutateDiscussions = useMutateDiscussions()
  const [pinningUuid, setPinningUuid] = useState<string | null>(null)
  const [pickerUuid, setPickerUuid] = useState<string | null>(null)

  // Toggle an emoji reaction on a message and refresh the list.
  const react = async (uuid: string, emoji: string) => {
    if (!accessToken) return
    setPickerUuid(null)
    try {
      await toggleReaction(uuid, emoji, accessToken)
      mutateDiscussions(communityUuid)
    } catch {
      toast.error('No se pudo reaccionar.')
    }
  }

  const togglePin = async (uuid: string, next: boolean) => {
    if (!accessToken || pinningUuid) return
    setPinningUuid(uuid)
    try {
      await pinDiscussion(uuid, next, accessToken)
      mutateDiscussions(communityUuid)
    } catch (e: any) {
      toast.error('No se pudo cambiar el estado del mensaje.')
    } finally {
      setPinningUuid(null)
    }
  }

  const { discussions, isLoading } = useDiscussions({
    communityUuid,
    sortBy: 'recent',
    page: 1,
    limit: 50,
  })

  // API returns newest first; show oldest at top, newest at the bottom.
  const messages = useMemo(() => [...discussions].reverse(), [discussions])

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Poll for new messages every few seconds.
  useEffect(() => {
    const id = setInterval(() => mutateDiscussions(communityUuid), 5000)
    return () => clearInterval(id)
  }, [communityUuid, mutateDiscussions])

  // Keep the view pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const firstLine = msg.split('\n')[0].trim()
      const title = firstLine.length > 100 ? firstLine.slice(0, 100).trim() : firstLine
      const docContent = msg.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.trim() ? [{ type: 'text', text: line }] : [],
      }))
      const content = JSON.stringify({ type: 'doc', content: docContent })

      await createDiscussion(
        communityUuid,
        { title: title || msg.slice(0, 100), content, label: 'general', emoji: null },
        accessToken
      )
      setText('')
      mutateDiscussions(communityUuid)
    } catch (e: any) {
      toast.error(
        (e?.detail && typeof e.detail === 'object' && e.detail.message) ||
          (typeof e?.detail === 'string' && e.detail) ||
          e?.message ||
          t('communities.create_discussion.failed_to_create')
      )
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[68vh] min-h-[420px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="p-4 bg-gray-50 rounded-full mb-3">
              <MessageCircle size={26} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 max-w-xs">
              {t('communities.discussion_list.no_discussions_description')}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || dayKey(prev.creation_date) !== dayKey(m.creation_date)
              // Group with the previous bubble only if it's the same author, within
              // 5 minutes, the same day, and neither message is pinned. Otherwise we
              // start a fresh block with avatar + name + time (WhatsApp-style).
              const grouped =
                !!prev &&
                !newDay &&
                prev.author?.id === m.author?.id &&
                Math.abs(msOf(m.creation_date) - msOf(prev.creation_date)) < 5 * 60 * 1000 &&
                !m.is_pinned &&
                !prev.is_pinned
              return (
                <React.Fragment key={m.discussion_uuid}>
                  {newDay && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="h-px flex-1 bg-gray-100" />
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {dayLabel(m.creation_date)}
                      </span>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>
                  )}
                  <div
                    className={`group/msg relative flex gap-2.5 px-4 ${grouped ? 'mt-0.5' : 'mt-2'}`}
                  >
                    {/* Avatar (first of a block) — or the clock time on hover when grouped */}
                    <div className="w-9 shrink-0 flex justify-center">
                      {!grouped ? (
                        <UserAvatar
                          width={36}
                          rounded="rounded-full"
                          avatar_url={getAvatarUrl(m.author) || undefined}
                          predefined_avatar={m.author?.avatar_image ? undefined : 'empty'}
                          showProfilePopup={true}
                          userId={m.author?.id?.toString()}
                        />
                      ) : (
                        <span className="mt-1.5 text-[10px] text-gray-400 tabular-nums opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          {clockTime(m.creation_date)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900">{authorName(m.author)}</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">{clockTime(m.creation_date)}</span>
                          {m.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-[#025dc7]">
                              <Pin size={10} /> Fijado
                            </span>
                          )}
                        </div>
                      )}
                      {/* Each message is its own bubble so consecutive ones read as
                          separate messages, not one merged block. */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`inline-block max-w-full rounded-2xl px-3 py-2 ${
                            m.is_pinned
                              ? 'bg-white ring-1 ring-[#025dc7]/30'
                              : 'bg-[#F0F5FF]'
                          } ${grouped ? 'rounded-tl-md' : 'rounded-tl-sm'}`}
                        >
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                            {messageText(m)}
                          </p>
                        </div>
                        {/* Añadir reacción (aparece al pasar el ratón) */}
                        {accessToken && (
                          <button
                            type="button"
                            onClick={() =>
                              setPickerUuid((cur) => (cur === m.discussion_uuid ? null : m.discussion_uuid))
                            }
                            title="Reaccionar"
                            aria-label="Reaccionar"
                            className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 transition-all ${
                              pickerUuid === m.discussion_uuid ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                            }`}
                          >
                            <SmilePlus size={16} />
                          </button>
                        )}
                      </div>

                      {/* Selector rápido de emojis */}
                      {pickerUuid === m.discussion_uuid && (
                        <div className="mt-1 inline-flex gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 py-1 nice-shadow">
                          {QUICK_EMOJIS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => react(m.discussion_uuid, e)}
                              className="text-base leading-none p-1 rounded-full hover:bg-gray-100 hover:scale-110 transition-transform"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Pills de reacciones existentes */}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => accessToken && react(m.discussion_uuid, r.emoji)}
                              disabled={!accessToken}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                                r.has_reacted
                                  ? 'bg-[#025dc7]/10 border-[#025dc7]/40 text-[#025dc7]'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              } ${accessToken ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <span className="leading-none">{r.emoji}</span>
                              <span className="tabular-nums font-semibold">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => togglePin(m.discussion_uuid, !m.is_pinned)}
                        disabled={pinningUuid === m.discussion_uuid}
                        title={m.is_pinned ? 'Desfijar' : 'Fijar mensaje'}
                        aria-label={m.is_pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
                        className={`absolute top-1 right-3 inline-flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                          m.is_pinned
                            ? 'text-[#025dc7] hover:bg-[#025dc7]/10'
                            : 'text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 opacity-0 group-hover/msg:opacity-100'
                        } ${pinningUuid === m.discussion_uuid ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        {pinningUuid === m.discussion_uuid ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : m.is_pinned ? (
                          <PinOff size={14} />
                        ) : (
                          <Pin size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <AuthenticatedClientElement checkMethod="authentication">
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#025dc7]/20">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={`${t('communities.discussion')} en ${channelName}…`}
              className="flex-1 resize-none bg-transparent text-base sm:text-sm text-gray-900 placeholder:text-gray-400 outline-none max-h-32 py-1.5"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-white bg-[#025dc7] hover:bg-[#0b6df0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('communities.create_discussion.submit')}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <PaperPlaneRight size={16} weight="fill" />}
            </button>
          </div>
        </div>
      </AuthenticatedClientElement>
    </div>
  )
}

export default ChannelChat
