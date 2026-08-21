'use client'

import React, { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import toast from 'react-hot-toast'
import { Pin, PinOff, Loader2 } from 'lucide-react'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  DiscussionWithAuthor,
  DiscussionAuthor,
  pinDiscussion,
} from '@services/communities/discussions'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'

dayjs.extend(relativeTime)
dayjs.extend(utc)

function relativeFromNow(date: string): string {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date)
  const d = hasTz ? dayjs(date) : dayjs.utc(date).local()
  return d.locale('es').fromNow()
}

function avatarUrl(author: DiscussionAuthor | null): string | null {
  if (!author?.avatar_image) return null
  if (author.avatar_image.startsWith('http')) return author.avatar_image
  return getUserAvatarMediaDirectory(author.user_uuid, author.avatar_image)
}

function authorName(author: DiscussionAuthor | null): string {
  if (!author) return '—'
  if (author.first_name || author.last_name) {
    return `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim()
  }
  return `@${author.username}`
}

function plainText(d: DiscussionWithAuthor): string {
  if (!d.content) return d.title
  try {
    const doc = JSON.parse(d.content)
    if (doc?.type === 'doc' && Array.isArray(doc.content)) {
      const lines = doc.content
        .map((block: any) =>
          Array.isArray(block?.content)
            ? block.content.map((n: any) => n?.text || '').join('')
            : ''
        )
        .filter(Boolean)
      return lines.join('\n')
    }
  } catch {
    /* fall through */
  }
  return d.content
}

/**
 * Side-feed of pinned messages for the current channel. Same react-query cache
 * as ChannelChat, so no extra network call.
 */
export default function PinnedFeed({ communityUuid }: { communityUuid: string }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus() as any
  const mutateDiscussions = useMutateDiscussions()
  const [unpinningUuid, setUnpinningUuid] = useState<string | null>(null)

  const { discussions } = useDiscussions({
    communityUuid,
    sortBy: 'recent',
    page: 1,
    limit: 50,
  })

  const pinned = useMemo(
    () => discussions.filter((d) => d.is_pinned),
    [discussions]
  )

  const unpin = async (uuid: string) => {
    if (!accessToken || unpinningUuid) return
    setUnpinningUuid(uuid)
    try {
      await pinDiscussion(uuid, false, accessToken)
      mutateDiscussions(communityUuid)
    } catch {
      toast.error('No se pudo desfijar el mensaje.')
    } finally {
      setUnpinningUuid(null)
    }
  }

  return (
    <aside className="bg-white nice-shadow rounded-2xl overflow-y-auto max-h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Pin size={16} className="text-[#025dc7]" />
        <h3 className="text-sm font-bold text-gray-900">Fijados</h3>
      </div>

      <div className="max-h-[68vh] overflow-y-auto">
        {pinned.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              Aún no hay mensajes fijados en este canal.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pinned.map((m) => (
              <li key={m.discussion_uuid} className="group/pin relative px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserAvatar
                    width={22}
                    rounded="rounded-full"
                    avatar_url={avatarUrl(m.author) || undefined}
                    predefined_avatar={m.author?.avatar_image ? undefined : 'empty'}
                  />
                  <span className="text-xs font-semibold text-gray-900 truncate">
                    {authorName(m.author)}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                    {relativeFromNow(m.creation_date)}
                  </span>
                </div>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
                  {plainText(m)}
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => unpin(m.discussion_uuid)}
                    disabled={unpinningUuid === m.discussion_uuid}
                    title="Desfijar"
                    aria-label="Desfijar mensaje"
                    className={`absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 transition-all opacity-0 group-hover/pin:opacity-100 ${
                      unpinningUuid === m.discussion_uuid ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {unpinningUuid === m.discussion_uuid ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <PinOff size={14} />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
