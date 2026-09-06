'use client'

import React, { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import toast from 'react-hot-toast'
import { Pin, PinOff, Loader2, X } from 'lucide-react'
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
export default function PinnedFeed({
  communityUuid,
  hideHeader = false,
}: {
  communityUuid: string
  /** La pantalla del canal pone su propia cabecera y su propio marco. */
  hideHeader?: boolean
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isStaff } = useAdminStatus() as any
  const mutateDiscussions = useMutateDiscussions()
  const [unpinningUuid, setUnpinningUuid] = useState<string | null>(null)
  // El fijado que se está leyendo entero. Ver `abierto` abajo.
  const [leyendoUuid, setLeyendoUuid] = useState<string | null>(null)

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
    // `hideHeader`: dentro de la pantalla del canal, la cabecera y el marco los
    // pone la página (los fijados son una parte de ella, no una tarjeta suelta).
    <aside className={hideHeader ? '' : 'bg-white nice-shadow rounded-2xl overflow-hidden'}>
      {!hideHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Pin size={16} className="text-[#025dc7]" />
          <h3 className="text-sm font-bold text-gray-900">Fijados</h3>
        </div>
      )}

      <div className={hideHeader ? '' : 'max-h-[68vh] overflow-y-auto'}>
        {pinned.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              Aún no hay mensajes fijados en este canal.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pinned.map((m) => (
              <li key={m.discussion_uuid} className="group/pin relative">
                {/* Toda la tarjeta es un botón: el texto se corta a seis
                    líneas para que la lista siga siendo una lista, y un fijado
                    largo —las normas del canal, la plantilla de presentarse—
                    no se podía leer entero por ningún sitio. Ahora se toca y
                    se abre completo. */}
                <button
                  type="button"
                  onClick={() => setLeyendoUuid(m.discussion_uuid)}
                  className="w-full text-left px-4 py-3 hover:bg-[#F7FAFF] transition-colors"
                >
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
                </button>
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => unpin(m.discussion_uuid)}
                    disabled={unpinningUuid === m.discussion_uuid}
                    title="Desfijar"
                    aria-label="Desfijar mensaje"
                    // `lg:opacity-0` y no `opacity-0` a secas: en el móvil no
                    // hay ratón, así que un botón que solo aparece al pasar por
                    // encima **no aparece nunca**. En el teléfono se ve siempre;
                    // en el escritorio sigue saliendo al acercarse.
                    className={`absolute top-2 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 transition-all lg:opacity-0 lg:group-hover/pin:opacity-100 ${
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

      {/* Leer un fijado entero. Se cierra con la X o tocando fuera, y vuelve a
          la lista de fijados sin sacarte del canal. */}
      {(() => {
        const abierto = pinned.find((m) => m.discussion_uuid === leyendoUuid)
        if (!abierto) return null
        return (
          <div
            className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6"
            style={{ zIndex: 'var(--z-modal-content, 220)' }}
            role="dialog"
            aria-modal="true"
            onClick={() => setLeyendoUuid(null)}
          >
            <div
              className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85dvh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[#EEF3FB]">
                <Pin size={15} className="text-[#025dc7] shrink-0" />
                <span className="text-[14px] font-bold text-gray-900">Mensaje fijado</span>
                <button
                  type="button"
                  onClick={() => setLeyendoUuid(null)}
                  aria-label="Cerrar"
                  className="ml-auto -mr-1 inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-[#F0F5FF] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserAvatar
                    width={26}
                    rounded="rounded-full"
                    avatar_url={avatarUrl(abierto.author) || undefined}
                    predefined_avatar={abierto.author?.avatar_image ? undefined : 'empty'}
                  />
                  <span className="text-[13px] font-semibold text-gray-900 truncate">
                    {authorName(abierto.author)}
                  </span>
                  <span className="text-[11px] text-gray-400 ml-auto shrink-0">
                    {relativeFromNow(abierto.creation_date)}
                  </span>
                </div>
                <p className="text-[14.5px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {plainText(abierto)}
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </aside>
  )
}
