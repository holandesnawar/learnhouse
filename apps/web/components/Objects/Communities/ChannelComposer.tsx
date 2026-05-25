'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createDiscussion } from '@services/communities/discussions'
import { useMutateDiscussions } from '@components/Hooks/useDiscussions'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { PaperPlaneRight } from '@phosphor-icons/react'

/**
 * Inline "chat-style" composer for a community channel. Lets members post a
 * message without opening the full create-discussion modal: they just type and
 * send. The title is derived from the first line and the body is wrapped in the
 * same Tiptap doc format the modal uses, so posts render identically.
 */
export function ChannelComposer({
  communityUuid,
  channelName,
}: {
  communityUuid: string
  channelName: string
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const mutateDiscussions = useMutateDiscussions()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const firstLine = msg.split('\n')[0].trim()
      const title = firstLine.length > 90 ? firstLine.slice(0, 90).trim() + '…' : firstLine
      const docContent = msg.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.trim() ? [{ type: 'text', text: line }] : [],
      }))
      const content = JSON.stringify({ type: 'doc', content: docContent })

      const result = await createDiscussion(
        communityUuid,
        { title, content, label: 'general', emoji: null },
        accessToken
      )
      if (result) {
        mutateDiscussions(communityUuid)
        setText('')
      }
    } catch (e: any) {
      toast.error(
        (e?.detail && typeof e.detail === 'object' && e.detail.message) ||
          (typeof e?.detail === 'string' && e.detail) ||
          e?.message ||
          'No se pudo publicar el mensaje'
      )
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      send()
    }
  }

  return (
    <AuthenticatedClientElement checkMethod="authentication">
      <div className="bg-white nice-shadow rounded-lg p-3 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={`Escribe algo en ${channelName}…`}
          className="w-full resize-none px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none rounded-md bg-transparent"
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400 px-1 hidden sm:inline">⌘/Ctrl + Enter para enviar</span>
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#025dc7] hover:bg-[#0b6df0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperPlaneRight size={16} weight="fill" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </AuthenticatedClientElement>
  )
}

export default ChannelComposer
