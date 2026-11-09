'use client'
import { haceCuanto } from '@/lib/nawar/haceCuanto'
import React from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
import { Edit, Trash2, MoreVertical, Merge } from 'lucide-react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { confirmar } from '@/lib/nawar/confirmar'
import toast from 'react-hot-toast'
import UserAvatar from '@components/Objects/UserAvatar'
import { useRouter } from 'next/navigation'
import { getUriWithOrg } from '@services/config/config'
import { DiscussionWithAuthor, DiscussionAuthor, deleteDiscussion, getLabelInfo, juntarConLaAnterior } from '@services/communities/discussions'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { CommentSection } from './CommentSection'
import { DiscussionContent } from './DiscussionContent'
import { useDiscussions } from '@components/Hooks/useDiscussions'
import { adjuntosDe, docSinTitulo, hiloDe, sinTituloRepetido } from '@/lib/communities/delChat'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"

interface DiscussionDetailProps {
  discussion: DiscussionWithAuthor
  communityUuid: string
  orgslug: string
  onEdit?: () => void
}

/**
 * Parse discussion content - handles both JSON (tiptap) and plain text (legacy)
 */
function parseDiscussionContent(content: string | null): any {
  if (!content) return null

  // Try to parse as JSON (tiptap content)
  try {
    const parsed = JSON.parse(content)
    // Verify it looks like tiptap content
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed
    }
    // Not tiptap format, return as string
    return content
  } catch {
    // Not JSON, return as plain text
    return content
  }
}

/**
 * Get the proper avatar URL for a user
 */
function getAvatarUrl(author: DiscussionAuthor | null): string | null {
  if (!author?.avatar_image) return null

  // If it's already a full URL (external auth like Google), use directly
  if (author.avatar_image.startsWith('http://') || author.avatar_image.startsWith('https://')) {
    return author.avatar_image
  }

  // Otherwise construct the media URL
  return getUserAvatarMediaDirectory(author.user_uuid, author.avatar_image)
}

/**
 * Las fotos, notas de voz y archivos de la publicación (09/11/2026): la página
 * del post no los enseñaba, ni en los posts de los tablones ni en los mensajes
 * que vienen del chat (las presentaciones).
 */
function Adjuntos({ content }: { content: string | null }) {
  const archivos = adjuntosDe(content)
  if (!archivos.length) return null
  return (
    <div className="mt-4 space-y-3">
      {archivos.filter((a) => a.kind === 'image').map((a, i) => (
        <a key={`i${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={a.url} alt={a.name} loading="lazy" className="rounded-xl max-h-[520px] w-auto max-w-full object-contain border border-[#EEF1F7]" />
        </a>
      ))}
      {archivos.filter((a) => a.kind === 'audio').map((a, i) => (
        <audio key={`a${i}`} src={a.url} controls preload="none" className="w-full max-w-[360px] h-9" />
      ))}
      {archivos.filter((a) => a.kind === 'file').map((a, i) => (
        <a key={`f${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-[14px] font-semibold text-[#0b2da0] underline break-all">
          {a.name}
        </a>
      ))}
    </div>
  )
}

/** Texto plano de un mensaje (tiptap en JSON o texto viejo). */
function textoDe(content: string | null): string {
  if (!content) return ''
  try {
    const doc = JSON.parse(content)
    const partes: string[] = []
    const walk = (n: any) => {
      if (!n) return
      if (n.type === 'text' && typeof n.text === 'string') partes.push(n.text)
      if (n.type === 'paragraph' && partes.length) partes.push('\n')
      if (Array.isArray(n.content)) n.content.forEach(walk)
    }
    walk(doc)
    return partes.join('').trim()
  } catch {
    return content
  }
}

/**
 * Las respuestas que le dieron en el chat, cuando el canal era chat (las
 * presentaciones, 09/11/2026): siguen siendo mensajes con `threadParent`, y
 * aquí salen debajo de la publicación a la que respondían.
 */
function RespuestasDelChat({
  discussionUuid,
  communityUuid,
  onHay,
}: {
  discussionUuid: string
  communityUuid: string
  onHay: (hay: boolean) => void
}) {
  const { discussions } = useDiscussions({ communityUuid, sortBy: 'recent', page: 1, limit: 100 })
  const suyas = (discussions as DiscussionWithAuthor[])
    .filter((d) => hiloDe(d.content as any) === discussionUuid)
    .sort((a, b) => String(a.creation_date).localeCompare(String(b.creation_date)))
  React.useEffect(() => onHay(suyas.length > 0), [suyas.length, onHay])
  if (!suyas.length) return null
  return (
    <div className="border-t border-gray-100 px-6 py-5">
      <p className="text-[13px] font-semibold text-[#5B6382] mb-3">
        {suyas.length === 1 ? '1 respuesta' : `${suyas.length} respuestas`}
      </p>
      <ul className="space-y-4">
        {suyas.map((r) => {
          const a: any = r.author || {}
          const nombre = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.username || 'Alguien'
          return (
            <li key={r.discussion_uuid} className="flex gap-3">
              <AvatarPersona nombre={nombre} size={32} src={getAvatarUrl(r.author as any)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px]">
                  <span className="font-semibold text-[#0B1033]">{nombre}</span>{' '}
                  <span className="text-[#8A91AD]">· {haceCuanto(r.creation_date)}</span>
                </p>
                <p className="text-[14.5px] text-[#2B3150] leading-relaxed whitespace-pre-wrap">
                  {sinTituloRepetido('', textoDe(r.content as any))}
                </p>
                <Adjuntos content={r.content as any} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function DiscussionDetail({
  discussion,
  communityUuid,
  orgslug,
  onEdit,
}: DiscussionDetailProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const router = useRouter()
  const communityId = communityUuid.replace('community_', '')
  const accessToken = session?.data?.tokens?.access_token
  const currentUserId = session?.data?.user?.id

  const [hayDelChat, setHayDelChat] = React.useState(false)
  const timeAgo = haceCuanto(discussion.creation_date)
  const isAuthor = currentUserId === discussion.author_id
  // Los administradores editan, borran y juntan cualquier publicación (09/11/2026).
  const { isAdmin } = useAdminStatus() as any
  const puedeTocar = isAuthor || !!isAdmin
  const juntar = async () => {
    const ok = await confirmar(
      '¿Juntar con su publicación anterior? Esta se pega debajo de la anterior de la misma persona en este canal, con sus fotos y comentarios. No se puede deshacer.',
      { boton: 'Juntar' }
    )
    if (!ok) return
    try {
      const r = await juntarConLaAnterior(discussion.discussion_uuid, accessToken)
      toast.success('Juntadas')
      router.push(getUriWithOrg(orgslug, `/community/${communityId}/discussion/${r.discussion_uuid.replace('discussion_', '')}`))
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'No se han podido juntar')
    }
  }
  const labelInfo = getLabelInfo(discussion.label || 'general')

  const authorName = discussion.author
    ? `${discussion.author.first_name} ${discussion.author.last_name}`.trim() || discussion.author.username
    : t('common.unknown')

  const handleDelete = async () => {
    try {
      await deleteDiscussion(discussion.discussion_uuid, accessToken)
      router.push(getUriWithOrg(orgslug, `/community/${communityId}`))
      router.refresh()
    } catch (err: any) {
      const message =
        (err?.detail && typeof err.detail === 'object' && err.detail.message) ||
        (typeof err?.detail === 'string' && err.detail) ||
        err?.message ||
        t('communities.discussion_detail.delete_failed')
      toast.error(message)
    }
  }

  return (
    <div className="bg-white nice-shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-0">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 break-words flex items-start gap-3">
              {discussion.emoji && (
                <span className="text-3xl flex-shrink-0">{discussion.emoji}</span>
              )}
              <span>{discussion.title}</span>
            </h1>
          </div>

          {puedeTocar && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Discussion detail" className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('communities.discussion_detail.edit')}
                  </DropdownMenuItem>
                )}
                {isAdmin ? (
                  <DropdownMenuItem onClick={juntar}>
                    <Merge className="mr-2 h-4 w-4" />
                    Juntar con la anterior
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <ConfirmationModal
                    confirmationMessage={t('communities.discussion_detail.delete_confirm')}
                    confirmationButtonText={t('communities.discussion_detail.delete_button')}
                    dialogTitle={t('communities.discussion_detail.delete_title')}
                    dialogTrigger={
                      <button className="w-full text-left flex items-center px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 className="mr-2 h-4 w-4" /> {t('communities.discussion_detail.delete')}
                      </button>
                    }
                    functionToExecute={handleDelete}
                    status="warning"
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Author info - Mobile only */}
        <div className="mt-4 flex items-center gap-3 md:hidden">
          <UserAvatar
            width={36}
            rounded="rounded-full"
            avatar_url={getAvatarUrl(discussion.author) || undefined}
            predefined_avatar={discussion.author?.avatar_image ? undefined : 'empty'}
            showProfilePopup={true}
            userId={discussion.author?.id?.toString()}
            shadow="shadow-none"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">{authorName}</div>
            <div className="text-xs text-gray-500">{timeAgo}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {discussion.content ? (
          <div className="prose prose-gray max-w-none">
            <DiscussionContent content={docSinTitulo(parseDiscussionContent(discussion.content), discussion.title)} />
          </div>
        ) : (
          <p className="text-gray-500 italic">{t('communities.discussion_detail.no_details')}</p>
        )}
        <Adjuntos content={discussion.content as any} />
      </div>

      <RespuestasDelChat discussionUuid={discussion.discussion_uuid} communityUuid={communityUuid} onHay={setHayDelChat} />

      {/* Comments Section */}
      <div className="border-t border-gray-100">
        <CommentSection
          discussionUuid={discussion.discussion_uuid}
          communityUuid={communityUuid}
          isLocked={discussion.is_locked}
          sinVacio={hayDelChat}
        />
      </div>
    </div>
  )
}

export default DiscussionDetail
