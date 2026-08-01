'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { AtSign, ArrowDown, BarChart3, Loader2, Mail, MessageCircle, Pin, PinOff, Search, SmilePlus, Reply, X, Pencil, Trash2 } from 'lucide-react'
import { COMPOSER_EMOJIS, QUICK_EMOJIS } from '@/lib/chat/emojis'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  createDiscussion,
  pinDiscussion,
  toggleReaction,
  updateDiscussion,
  deleteDiscussion,
  DiscussionWithAuthor,
  DiscussionAuthor,
} from '@services/communities/discussions'

// Ventana en la que el autor puede editar/eliminar su propio mensaje (12 h).
const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000

// Para arrancar la conversación cuando el canal está vacío: un chat en blanco
// intimida, y en una comunidad pequeña el primer mensaje es el más caro.
const ICEBREAKERS = [
  '¡Hola! Me presento: ',
  '¿Alguien me echa una mano con esto? ',
  'Hoy he aprendido una palabra nueva: ',
]
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useQueryClient } from '@tanstack/react-query'
import { broadcastNotification } from '@services/notifications/broadcast'
import {
  getPollResults,
  getReadStates,
  markChannelRead,
  readPoll,
  votePoll,
  type PollResults,
} from '@services/communities/engagement'
import { useOrg } from '@components/Contexts/OrgContext'

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

// "Hoy" / "Ayer" / "1 de junio" — meses en español fijos (sin depender del locale).
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function dayLabel(date: string): string {
  const d = localDay(date)
  const today = dayjs()
  if (d.isSame(today, 'day')) return 'Hoy'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Ayer'
  return `${d.date()} de ${MESES[d.month()]}`
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

// Reply reference is stored inside the message's own content JSON (replyToAuthor
// / replyToText), so quoting works with zero DB schema changes.
function replyMeta(
  d: DiscussionWithAuthor
): { author: string; text: string; uuid: string | null } | null {
  if (!d.content) return null
  try {
    const doc = JSON.parse(d.content)
    if (doc?.replyToAuthor || doc?.replyToText) {
      return {
        author: doc.replyToAuthor || '',
        text: doc.replyToText || '',
        // Los mensajes viejos no lo llevan: entonces la cita no salta.
        uuid: doc.replyToUuid || null,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Texto del mensaje con las direcciones web pinchables y las menciones
 * resaltadas. Antes un enlace pegado en el chat era texto muerto: había que
 * copiarlo a mano.
 */
function renderMessageBody(text: string, isOwn: boolean): React.ReactNode[] {
  const TOKEN = /(https?:\/\/[^\s]+|www\.[^\s]+|@[\wáéíóúüñ.\-]{2,40})/g
  return text.split(TOKEN).map((part, i) => {
    if (!part) return <React.Fragment key={i} />
    if (part.startsWith('@')) {
      return (
        <span key={i} className={`font-bold ${isOwn ? 'text-white underline' : 'text-[#025dc7]'}`}>
          {part}
        </span>
      )
    }
    if (/^(https?:\/\/|www\.)/.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline break-all ${isOwn ? 'text-white' : 'text-[#025dc7]'} font-semibold`}
        >
          {part}
        </a>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
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
  const org = useOrg() as any
  // Solo para el equipo: publicar un mensaje Y avisar por email. Es para las
  // novedades que de verdad importan (un cambio de horario, el arranque de un
  // módulo), no para el día a día del chat.
  const [alsoEmail, setAlsoEmail] = useState(false)
  const mutateDiscussions = useMutateDiscussions()
  const [pinningUuid, setPinningUuid] = useState<string | null>(null)
  const [pickerUuid, setPickerUuid] = useState<string | null>(null)
  // En el móvil no existe el "pasar el ratón": sin esto, responder, reaccionar,
  // editar y borrar eran invisibles e inalcanzables desde el teléfono. Al tocar
  // un mensaje se marca como activo y aparecen sus acciones.
  const queryClient = useQueryClient()
  const [activeUuid, setActiveUuid] = useState<string | null>(null)
  // Hasta dónde había leído el alumno cuando abrió el canal: sirve para pintar
  // la línea "mensajes nuevos" SIN que se mueva al llegar mensajes nuevos.
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  // Menciones: sugerencias al escribir @ y encuestas.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [polls, setPolls] = useState<Record<string, PollResults>>({})
  const [pollDraft, setPollDraft] = useState<{ question: string; options: string[] } | null>(null)
  const [replyingTo, setReplyingTo] = useState<
    { author: string; text: string; uuid: string } | null
  >(null)
  // Buscador dentro del canal y estado del scroll (ver más abajo).
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [unseenBelow, setUnseenBelow] = useState(0)
  const [flashUuid, setFlashUuid] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const currentUserId = session?.data?.user?.id

  // El autor puede editar/eliminar su propio mensaje durante las primeras 12 h.
  const canModify = (m: DiscussionWithAuthor) =>
    !!currentUserId &&
    m.author?.id === currentUserId &&
    Date.now() - msOf(m.creation_date) < EDIT_WINDOW_MS

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

  const startEdit = (m: DiscussionWithAuthor) => {
    setEditingUuid(m.discussion_uuid)
    setEditText(messageText(m))
    setPickerUuid(null)
  }

  // Guardar la edición — reconstruye el JSON conservando la cita (reply) si la había.
  const saveEdit = async () => {
    const msg = editText.trim()
    if (!msg || !editingUuid || !accessToken) return
    const original = messages.find((x) => x.discussion_uuid === editingUuid)
    try {
      const firstLine = msg.split('\n')[0].trim()
      const title = firstLine.length > 100 ? firstLine.slice(0, 100).trim() : firstLine
      const docContent = msg.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.trim() ? [{ type: 'text', text: line }] : [],
      }))
      const doc: any = { type: 'doc', content: docContent }
      const rm = original ? replyMeta(original) : null
      if (rm) {
        doc.replyToAuthor = rm.author
        doc.replyToText = rm.text
      }
      await updateDiscussion(editingUuid, { title: title || msg.slice(0, 100), content: JSON.stringify(doc) }, accessToken)
      setEditingUuid(null)
      setEditText('')
      mutateDiscussions(communityUuid)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo editar el mensaje.')
    }
  }

  const removeMessage = async (uuid: string) => {
    if (!accessToken) return
    if (!window.confirm('¿Eliminar este mensaje? No se puede deshacer.')) return
    try {
      await deleteDiscussion(uuid, accessToken)
      mutateDiscussions(communityUuid)
    } catch {
      toast.error('No se pudo eliminar el mensaje.')
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

  // Un chat es cronológico y punto. La API devuelve PRIMERO los mensajes
  // fijados y luego el resto por fecha, así que al invertir la lista un mensaje
  // recién fijado saltaba al final del chat, fuera de su sitio: parecía que se
  // borraba de la conversación. Se ordena por fecha aquí y los fijados se
  // quedan donde se escribieron (resaltados, y además listados en el panel
  // "Fijados" de al lado).
  const messages = useMemo(
    () => [...discussions].sort((a, b) => msOf(a.creation_date) - msOf(b.creation_date)),
    [discussions]
  )

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Poll for new messages every few seconds.
  useEffect(() => {
    const id = setInterval(() => mutateDiscussions(communityUuid), 5000)
    return () => clearInterval(id)
  }, [communityUuid, mutateDiscussions])

  // Al entrar: se guarda la marca de lectura ANTERIOR (para la línea de nuevos)
  // y se marca el canal como leído. Al salir se vuelve a marcar, por si han
  // llegado mensajes mientras estaba abierto.
  useEffect(() => {
    if (!accessToken) return
    let alive = true
    getReadStates(accessToken).then((states) => {
      if (!alive) return
      setLastReadAt(states?.[communityUuid] || null)
      markChannelRead(communityUuid, accessToken).then(() => {
        queryClient.invalidateQueries({ queryKey: ['community', 'unread'] })
      })
    })
    return () => {
      alive = false
      markChannelRead(communityUuid, accessToken).then(() => {
        queryClient.invalidateQueries({ queryKey: ['community', 'unread'] })
      })
    }
  }, [communityUuid, accessToken, queryClient])

  // Resultados de las encuestas visibles.
  useEffect(() => {
    if (!accessToken) return
    const pollMessages = messages.filter((m) => readPoll(m.content))
    let alive = true
    Promise.all(
      pollMessages.map((m) =>
        getPollResults(m.discussion_uuid, accessToken).then((r) => [m.discussion_uuid, r] as const)
      )
    ).then((pairs) => {
      if (!alive) return
      const next: Record<string, PollResults> = {}
      for (const [uuid, res] of pairs) if (res) next[uuid] = res
      setPolls(next)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.map((m) => m.discussion_uuid).join(','), accessToken])

  // El scroll solo baja solo si YA estabas abajo. Si estás leyendo hacia
  // arriba, un mensaje nuevo ya no te arranca de donde estabas: aparece el
  // botón "mensajes nuevos" y bajas tú cuando quieras.
  const lastCountRef = useRef(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const grew = messages.length - lastCountRef.current
    lastCountRef.current = messages.length
    if (grew <= 0) return
    if (atBottom) {
      el.scrollTop = el.scrollHeight
    } else {
      setUnseenBelow((n) => n + grew)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // ¿Está el usuario pegado al final? (con margen: los navegadores redondean)
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setAtBottom(bottom)
    if (bottom) setUnseenBelow(0)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setUnseenBelow(0)
  }

  /** Llevar al mensaje citado y darle un destello para localizarlo. */
  const jumpTo = (uuid: string) => {
    const el = scrollRef.current?.querySelector(`[data-msg="${uuid}"]`)
    if (!el) {
      toast('Ese mensaje ya no está en la parte cargada del chat.')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashUuid(uuid)
    setTimeout(() => setFlashUuid((cur) => (cur === uuid ? null : cur)), 1600)
  }

  // Buscar dentro del canal: filtra lo que ya está cargado (los últimos 50),
  // que es donde la gente busca de verdad ("¿qué dijo el profe del examen?").
  const visibleMessages = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(
      (m) =>
        messageText(m).toLowerCase().includes(q) ||
        authorName(m.author).toLowerCase().includes(q)
    )
  }, [messages, query])

  // Candidatos a mención: quienes ya han escrito en el canal (así no hace falta
  // un endpoint de miembros que los alumnos no tienen permiso para leer) + all.
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const names = new Set<string>()
    for (const m of messages) {
      const n = authorName(m.author)
      if (n) names.add(n.split(' ')[0])
    }
    const list = ['all', ...Array.from(names)]
    return list.filter((n) => n.toLowerCase().startsWith(q)).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionQuery, messages])

  const onComposerChange = (value: string) => {
    setText(value)
    // ¿Está escribiendo una mención justo ahora? (@ al final de la palabra)
    const match = /(?:^|\s)@([\wáéíóúüñ.\-]*)$/.exec(value)
    setMentionQuery(match ? match[1] : null)
  }

  const applyMention = (name: string) => {
    setText((cur) => cur.replace(/(?:^|\s)@([\wáéíóúüñ.\-]*)$/, (m0) => `${m0.startsWith(' ') ? ' ' : ''}@${name} `))
    setMentionQuery(null)
  }

  const send = async () => {
    const msg = text.trim()
    const poll =
      pollDraft && pollDraft.question.trim() && pollDraft.options.filter((o) => o.trim()).length >= 2
        ? {
            question: pollDraft.question.trim(),
            options: pollDraft.options.map((o) => o.trim()).filter(Boolean),
          }
        : null
    if (poll && !msg) {
      // Una encuesta sin texto es válida: el título es la pregunta.
    } else if (!msg || sending) return
    if (sending) return
    setSending(true)
    try {
      const firstLine = msg.split('\n')[0].trim()
      const title = firstLine.length > 100 ? firstLine.slice(0, 100).trim() : firstLine
      const docContent = msg.split('\n').map((line) => ({
        type: 'paragraph',
        content: line.trim() ? [{ type: 'text', text: line }] : [],
      }))
      const doc: any = { type: 'doc', content: docContent }
      if (poll) doc.poll = poll
      if (replyingTo) {
        doc.replyToAuthor = replyingTo.author
        doc.replyToText = replyingTo.text
        doc.replyToUuid = replyingTo.uuid
      }
      const content = JSON.stringify(doc)

      await createDiscussion(
        communityUuid,
        {
          title: (poll ? poll.question : title) || msg.slice(0, 100) || 'Encuesta',
          content,
          label: 'general',
          emoji: null,
        },
        accessToken
      )
      setText('')
      setReplyingTo(null)
      setPollDraft(null)
      setMentionQuery(null)
      mutateDiscussions(communityUuid)

      if (alsoEmail && isAdmin && org?.id) {
        const res = await broadcastNotification(
          {
            org_id: org.id,
            kind: 'announcement',
            title: `${channelName}: ${title || msg.slice(0, 80)}`,
            body: msg,
            url: typeof window !== 'undefined' ? window.location.href : '',
          },
          accessToken
        )
        setAlsoEmail(false)
        if (res) toast.success(`Publicado y avisado por email a ${res.queued} alumnos.`)
        else toast.error('Publicado, pero no se pudo enviar el aviso por email.')
      }
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
    <div className="relative flex flex-col h-[68vh] min-h-[420px]">
      {/* Barra de búsqueda del canal */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => {
            setSearching((v) => !v)
            if (searching) setQuery('')
          }}
          title="Buscar en el canal"
          aria-label="Buscar en el canal"
          className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            searching ? 'bg-[#025dc7]/10 text-[#025dc7]' : 'text-gray-400 hover:text-[#025dc7] hover:bg-gray-50'
          }`}
        >
          <Search size={16} />
        </button>
        {searching ? (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar palabra o persona…"
              className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#025dc7]/20"
            />
            <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">
              {query.trim() ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? '' : 's'}` : ''}
            </span>
          </>
        ) : (
          <span className="text-[12.5px] text-gray-400 truncate">
            Buscar en {channelName}
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-3">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="p-4 bg-gray-50 rounded-full mb-3">
              <MessageCircle size={26} className="text-gray-300" />
            </div>
            {query.trim() ? (
              <p className="text-sm text-gray-400 max-w-xs">
                Nada con «{query.trim()}» por aquí.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-500 max-w-xs mb-3">
                  Aquí no ha escrito nadie todavía. Empieza tú — con una frase basta.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {ICEBREAKERS.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => setText(phrase)}
                      className="px-3 py-1.5 rounded-full border border-[#DDE6F5] text-[12.5px] text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
                    >
                      {phrase.trim()}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {visibleMessages.map((m, i) => {
              const prev = visibleMessages[i - 1]
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
              // Mensajes propios → a la derecha (estilo WhatsApp).
              const isOwn = !!currentUserId && m.author?.id === currentUserId
              // Primer mensaje que el alumno no había leído al entrar.
              const isFirstUnread =
                !!lastReadAt &&
                !isOwn &&
                msOf(m.creation_date) > msOf(lastReadAt) &&
                (!prev || msOf(prev.creation_date) <= msOf(lastReadAt))
              const bubbleBg = m.is_pinned
                ? 'bg-white ring-1 ring-[#025dc7]/30 text-gray-800'
                : isOwn
                ? 'bg-[#025dc7] text-white'
                : 'bg-[#F0F5FF] text-gray-800'
              return (
                <React.Fragment key={m.discussion_uuid}>
                  {isFirstUnread && (
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="h-px flex-1 bg-rose-300" />
                      <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">
                        Mensajes nuevos
                      </span>
                      <div className="h-px flex-1 bg-rose-300" />
                    </div>
                  )}
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
                    data-msg={m.discussion_uuid}
                    className={`group/msg relative flex gap-2.5 px-4 ${grouped ? 'mt-0.5' : 'mt-2'} ${isOwn ? 'flex-row-reverse' : ''} ${
                      flashUuid === m.discussion_uuid ? 'bg-[#4da3ff]/15 rounded-xl transition-colors' : ''
                    }`}
                  >
                    {/* Avatar a los dos lados: el propio también, para que el chat
                        no parezca vacío de fotos cuando solo escribes tú. */}
                    <div className="w-9 shrink-0 flex justify-center items-start">
                      {!grouped ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gray-100 [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
                          <UserAvatar
                            width={36}
                            rounded="rounded-full"
                            avatar_url={getAvatarUrl(m.author) || undefined}
                            predefined_avatar={m.author?.avatar_image ? undefined : 'empty'}
                            showProfilePopup={true}
                            userId={m.author?.id?.toString()}
                          />
                        </div>
                      ) : (
                        <span className="mt-1.5 text-[10px] text-gray-400 tabular-nums opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          {clockTime(m.creation_date)}
                        </span>
                      )}
                    </div>
                    <div className={`min-w-0 flex-1 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!grouped && (
                        <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <span className="text-sm font-semibold text-gray-900">
                            {isOwn ? 'Tú' : authorName(m.author)}
                          </span>
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
                      {editingUuid === m.discussion_uuid ? (
                        <div className="min-w-0">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            autoFocus
                            className="w-full resize-none rounded-xl bg-white border border-[#4da3ff] px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#4da3ff]/25"
                          />
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#025dc7] text-white text-xs font-semibold hover:bg-[#0b6df0]"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingUuid(null); setEditText('') }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                      <div className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`inline-block max-w-full rounded-2xl px-3 py-2 ${bubbleBg} ${
                            isOwn
                              ? grouped ? 'rounded-tr-md' : 'rounded-tr-sm'
                              : grouped ? 'rounded-tl-md' : 'rounded-tl-sm'
                          }`}
                        >
                          {(() => {
                            const rm = replyMeta(m)
                            return rm ? (
                              <div
                                onClick={(e) => {
                                  if (!rm.uuid) return
                                  e.stopPropagation()
                                  jumpTo(rm.uuid)
                                }}
                                title={rm.uuid ? 'Ir al mensaje original' : undefined}
                                className={`mb-1 border-l-2 pl-2 py-0.5 ${isOwn ? 'border-white/50' : 'border-[#4da3ff]'} ${
                                  rm.uuid ? 'cursor-pointer hover:opacity-80' : ''
                                }`}
                              >
                                <span className={`block text-[11px] font-semibold leading-tight ${isOwn ? 'text-white' : 'text-[#025dc7]'}`}>
                                  {rm.author}
                                </span>
                                <span className={`block text-[11px] line-clamp-1 leading-tight ${isOwn ? 'text-white/75' : 'text-gray-500'}`}>
                                  {rm.text}
                                </span>
                              </div>
                            ) : null
                          })()}
                          {(() => {
                            const poll = readPoll(m.content)
                            if (!poll) return null
                            const res = polls[m.discussion_uuid]
                            const total = res?.total ?? 0
                            return (
                              <div className="mb-1.5">
                                <p className="text-sm font-bold mb-2">📊 {poll.question}</p>
                                <div className="space-y-1.5">
                                  {poll.options.map((opt, oi) => {
                                    const count = res?.counts?.[oi] ?? 0
                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                                    const mine = res?.my_vote === oi
                                    return (
                                      <button
                                        key={oi}
                                        type="button"
                                        onClick={async () => {
                                          const next = await votePoll(m.discussion_uuid, oi, accessToken)
                                          if (next) setPolls((p) => ({ ...p, [m.discussion_uuid]: next }))
                                        }}
                                        className={`relative w-full text-left rounded-lg px-3 py-2 text-[13px] overflow-hidden border transition-colors ${
                                          mine
                                            ? 'border-[#025dc7] bg-white/70'
                                            : 'border-black/10 bg-white/50 hover:border-[#025dc7]/50'
                                        }`}
                                      >
                                        <span
                                          className="absolute inset-y-0 left-0 bg-[#4da3ff]/30"
                                          style={{ width: `${pct}%` }}
                                        />
                                        <span className="relative flex items-center justify-between gap-2">
                                          <span className="font-semibold">
                                            {mine ? '● ' : ''}{opt}
                                          </span>
                                          <span className="tabular-nums opacity-70">{pct}%</span>
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                                <p className="mt-1.5 text-[11px] opacity-60">
                                  {total === 0 ? 'Sé el primero en votar' : `${total} voto${total === 1 ? '' : 's'}`}
                                </p>
                              </div>
                            )
                          })()}
                          <p
                            className="text-sm whitespace-pre-wrap break-words leading-relaxed cursor-pointer"
                            onClick={() =>
                              setActiveUuid((cur) => (cur === m.discussion_uuid ? null : m.discussion_uuid))
                            }
                          >
                            {renderMessageBody(messageText(m), isOwn)}
                            {m.edit_count > 0 && (
                              <span className="text-[10px] opacity-60 ml-1.5">· editado</span>
                            )}
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
                              pickerUuid === m.discussion_uuid || activeUuid === m.discussion_uuid
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/msg:opacity-100'
                            }`}
                          >
                            <SmilePlus size={16} />
                          </button>
                        )}
                        {/* Responder (aparece al pasar el ratón) */}
                        {accessToken && (
                          <button
                            type="button"
                            onClick={() =>
                              setReplyingTo({
                                author: authorName(m.author),
                                text: messageText(m).slice(0, 140),
                                uuid: m.discussion_uuid,
                              })
                            }
                            title="Responder"
                            aria-label="Responder"
                            className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 transition-all ${
                              activeUuid === m.discussion_uuid ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                            }`}
                          >
                            <Reply size={15} />
                          </button>
                        )}
                        {/* Editar (solo el autor, primeras 12 h) */}
                        {canModify(m) && (
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            title="Editar"
                            aria-label="Editar"
                            className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 transition-all ${
                              activeUuid === m.discussion_uuid ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                            }`}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {/* Eliminar (solo el autor, primeras 12 h) */}
                        {canModify(m) && (
                          <button
                            type="button"
                            onClick={() => removeMessage(m.discussion_uuid)}
                            title="Eliminar"
                            aria-label="Eliminar"
                            className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all ${
                              activeUuid === m.discussion_uuid ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                            }`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      )}

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
                            : `text-gray-400 hover:text-[#025dc7] hover:bg-[#025dc7]/10 ${
                                activeUuid === m.discussion_uuid ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                              }`
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

      {/* Volver abajo (con cuántos te has perdido mientras leías arriba) */}
      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#025dc7] text-white text-[12.5px] font-semibold shadow-lg hover:bg-[#0b6df0] transition-colors"
        >
          <ArrowDown size={14} />
          {unseenBelow > 0
            ? `${unseenBelow} mensaje${unseenBelow === 1 ? '' : 's'} nuevo${unseenBelow === 1 ? '' : 's'}`
            : 'Ir al final'}
        </button>
      )}

      {/* Composer */}
      <AuthenticatedClientElement checkMethod="authentication">
        <div className="border-t border-gray-100 p-3">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-[#F0F5FF] rounded-lg border-l-2 border-[#4da3ff]">
              <Reply size={14} className="shrink-0 text-[#025dc7]" />
              <div className="min-w-0 flex-1 text-xs">
                <span className="font-semibold text-[#025dc7]">Respondiendo a {replyingTo.author}</span>
                <p className="text-gray-500 truncate">{replyingTo.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancelar respuesta"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {/* Encuesta en preparación */}
          {pollDraft && (
            <div className="mb-2 rounded-xl border border-[#DDE6F5] bg-[#F8FAFF] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[12px] font-bold text-[#025dc7] flex items-center gap-1.5">
                  <BarChart3 size={14} /> Encuesta
                </p>
                <button
                  type="button"
                  onClick={() => setPollDraft(null)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label="Quitar encuesta"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                value={pollDraft.question}
                onChange={(e) => setPollDraft({ ...pollDraft, question: e.target.value })}
                placeholder="La pregunta — p. ej. ¿de of het huis?"
                className="w-full mb-2 bg-white rounded-lg px-3 py-2 text-sm border border-[#DDE6F5] outline-none focus:border-[#4da3ff]"
              />
              {pollDraft.options.map((opt, oi) => (
                <input
                  key={oi}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollDraft.options]
                    next[oi] = e.target.value
                    setPollDraft({ ...pollDraft, options: next })
                  }}
                  placeholder={`Opción ${oi + 1}`}
                  className="w-full mb-1.5 bg-white rounded-lg px-3 py-2 text-sm border border-[#DDE6F5] outline-none focus:border-[#4da3ff]"
                />
              ))}
              {pollDraft.options.length < 5 && (
                <button
                  type="button"
                  onClick={() => setPollDraft({ ...pollDraft, options: [...pollDraft.options, ''] })}
                  className="text-[12px] font-semibold text-[#025dc7] hover:underline"
                >
                  + Añadir opción
                </button>
              )}
            </div>
          )}

          {/* Sugerencias al escribir @ */}
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="mb-2 rounded-xl border border-[#DDE6F5] bg-white nice-shadow overflow-hidden max-h-44 overflow-y-auto">
              {mentionCandidates.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyMention(name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F0F5FF] flex items-center gap-2"
                >
                  <AtSign size={13} className="text-[#025dc7] shrink-0" />
                  <span className={name === 'all' ? 'font-bold text-[#025dc7]' : ''}>
                    {name === 'all' ? 'all — avisar a todo el canal' : name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {emojiOpen && (
            <div className="mb-2 grid grid-cols-8 gap-1 rounded-xl border border-[#DDE6F5] bg-white p-2 nice-shadow">
              {COMPOSER_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setText((cur) => cur + e)
                    setEmojiOpen(false)
                  }}
                  className="text-lg leading-none p-1 rounded-lg hover:bg-[#F0F5FF] hover:scale-110 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#025dc7]/20">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              title="Emojis"
              aria-label="Emojis"
              className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                emojiOpen ? 'bg-[#025dc7]/10 text-[#025dc7]' : 'text-gray-400 hover:text-[#025dc7] hover:bg-white'
              }`}
            >
              <SmilePlus size={17} />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setPollDraft((cur) => (cur ? null : { question: '', options: ['', ''] }))
                }
                title="Crear encuesta"
                aria-label="Crear encuesta"
                className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  pollDraft ? 'bg-[#025dc7]/10 text-[#025dc7]' : 'text-gray-400 hover:text-[#025dc7] hover:bg-white'
                }`}
              >
                <BarChart3 size={17} />
              </button>
            )}
            <textarea
              value={text}
              onChange={(e) => onComposerChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={`Escribe en ${channelName}…  (@ para avisar a alguien)`}
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
          <p className="mt-1.5 text-[11.5px] text-gray-400 hidden sm:block">
            Enter envía · Shift + Enter salta de línea · @ para avisar a alguien
          </p>
          {isAdmin && (
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-gray-500 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={alsoEmail}
                onChange={(e) => setAlsoEmail(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-[#025dc7] focus:ring-[#025dc7]/30 cursor-pointer"
              />
              <Mail size={13} className={alsoEmail ? 'text-[#025dc7]' : 'text-gray-400'} />
              <span className={alsoEmail ? 'text-[#025dc7] font-semibold' : ''}>
                Avisar por email a todos los alumnos
              </span>
            </label>
          )}
        </div>
      </AuthenticatedClientElement>
    </div>
  )
}

export default ChannelChat
