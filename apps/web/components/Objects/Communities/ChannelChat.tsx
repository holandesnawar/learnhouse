'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/es'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { AtSign, ArrowDown, BarChart3, FileText, ImageIcon, Loader2, Mail, MessageCircle, MessageSquare, Mic, Paperclip, Pin, PinOff, Search, SmilePlus, Reply, X, Pencil, Trash2 } from 'lucide-react'
import { COMPOSER_EMOJIS, QUICK_EMOJIS } from '@/lib/chat/emojis'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useDiscussions, useMutateDiscussions } from '@components/Hooks/useDiscussions'
import {
  createDiscussion,
  pinDiscussion,
  toggleReaction,
  updateDiscussion,
  deleteDiscussion,
  uploadChatAttachment,
  DiscussionWithAuthor,
  DiscussionAuthor,
  type ChatAttachment,
} from '@services/communities/discussions'
import VoiceRecorder from '@components/Pages/Messages/VoiceRecorder'
import ComposerButton from './ComposerButton'
import MessageAction from './MessageAction'

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

export function getAvatarUrl(author: DiscussionAuthor | null): string | null {
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

/**
 * Los adjuntos viajan dentro del propio mensaje (`doc.attachments`), igual que
 * la encuesta o la cita. Así no hace falta ninguna tabla nueva y los mensajes
 * antiguos siguen leyéndose igual.
 */
function attachmentsOf(d: DiscussionWithAuthor): ChatAttachment[] {
  if (!d.content) return []
  try {
    const doc = JSON.parse(d.content)
    return Array.isArray(doc?.attachments) ? (doc.attachments as ChatAttachment[]) : []
  } catch {
    return []
  }
}

/**
 * ¿Este mensaje es la respuesta de un hilo? Devuelve el mensaje del que
 * cuelga.
 *
 * Igual que los adjuntos o las encuestas, el hilo va dentro del propio
 * mensaje (`doc.threadParent`). Sin tablas nuevas: una respuesta de hilo es
 * un mensaje normal que sabe de quién cuelga, y el canal simplemente no la
 * enseña suelta.
 */
function threadParentOf(d: DiscussionWithAuthor): string | null {
  if (!d.content) return null
  try {
    const doc = JSON.parse(d.content)
    return typeof doc?.threadParent === 'string' ? doc.threadParent : null
  } catch {
    return null
  }
}

/** Un tamaño legible: «2,4 MB». */
function prettySize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
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
  threadUuid = null,
  onOpenThread,
  searching = false,
  onSearchingChange,
}: {
  communityUuid: string
  channelName: string
  /** La lupa vive en la cabecera de la página. */
  searching?: boolean
  onSearchingChange?: (open: boolean) => void
  /** El hilo abierto ahora (lo gobierna la página: cambia la columna derecha). */
  threadUuid?: string | null
  onOpenThread?: (uuid: string | null) => void
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
  // Adjuntos ya subidos que saldrán con el próximo mensaje.
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [atBottom, setAtBottom] = useState(true)
  const [unseenBelow, setUnseenBelow] = useState(0)
  const [flashUuid, setFlashUuid] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const currentUserId = session?.data?.user?.id

  // El autor puede editar/eliminar su propio mensaje durante las primeras 12 h.
  /** Editar: solo tu propio mensaje y dentro de las primeras 12 h. Un
   *  administrador NO edita mensajes ajenos: eso sería escribir por otro. */
  const canEdit = (m: DiscussionWithAuthor) =>
    !!currentUserId &&
    m.author?.id === currentUserId &&
    Date.now() - msOf(m.creation_date) < EDIT_WINDOW_MS

  /** Borrar: tu mensaje reciente, o cualquiera si eres administrador — sin
   *  límite de tiempo. Moderar una comunidad es justo eso, y el servidor ya
   *  lo permitía: era la pantalla la que escondía el botón. */
  const canDelete = (m: DiscussionWithAuthor) => isAdmin || canEdit(m)

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
  // Las respuestas de un hilo NO salen sueltas en el canal: viven dentro de su
  // hilo. Es justo la gracia de los hilos — sacar una conversación larga de en
  // medio sin perderla.
  const threadReplies = useMemo(() => {
    const byParent = new Map<string, DiscussionWithAuthor[]>()
    for (const m of messages) {
      const parent = threadParentOf(m)
      if (!parent) continue
      const list = byParent.get(parent) ?? []
      list.push(m)
      byParent.set(parent, list)
    }
    return byParent
  }, [messages])

  const channelMessages = useMemo(
    () => messages.filter((m) => !threadParentOf(m)),
    [messages]
  )

  const visibleMessages = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return channelMessages
    return channelMessages.filter(
      (m) =>
        messageText(m).toLowerCase().includes(q) ||
        authorName(m.author).toLowerCase().includes(q)
    )
  }, [channelMessages, query])

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

  /**
   * Solo una herramienta abierta a la vez (grabadora, emojis, encuesta).
   * Abrir una cierra la anterior: si no, se apilan tres cajas encima del
   * compositor y ninguna dice cómo cerrarse.
   */
  const openTool = (tool: 'voz' | 'emoji' | 'encuesta' | null) => {
    setRecording(tool === 'voz')
    setEmojiOpen(tool === 'emoji')
    if (tool === 'encuesta') {
      setPollDraft((cur) => cur ?? { question: '', options: ['', ''] })
    } else {
      setPollDraft(null)
    }
  }

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

  /**
   * El botón de la arroba: escribe una @ al final y abre las sugerencias, que
   * es lo que pasaría si la escribiera a mano. Así el botón no hace nada
   * distinto de lo que ya sabe hacer el teclado.
   */
  const mentionSomeone = () => {
    setText((cur) => {
      const next = cur.length === 0 || cur.endsWith(' ') ? `${cur}@` : `${cur} @`
      return next
    })
    setMentionQuery('')
  }

  /** Sube lo que el alumno acaba de elegir y lo deja listo para enviar. */
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

  /** La nota de voz grabada en el propio chat. */
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

  const send = async (threadTarget?: string) => {
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
    } else if (pending.length && !msg) {
      // Una foto o un audio tampoco necesitan texto.
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
      if (pending.length) doc.attachments = pending
      if (threadTarget) doc.threadParent = threadTarget
      if (replyingTo) {
        doc.replyToAuthor = replyingTo.author
        doc.replyToText = replyingTo.text
        doc.replyToUuid = replyingTo.uuid
      }
      const content = JSON.stringify(doc)

      await createDiscussion(
        communityUuid,
        {
          title:
            (poll ? poll.question : title) ||
            msg.slice(0, 100) ||
            (pending.length ? pending[0].name : '') ||
            'Encuesta',
          content,
          label: 'general',
          emoji: null,
        },
        accessToken
      )
      setText('')
      setPending([])
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
    // Se estira a lo que le dé la página, que es quien manda: aquí no hay
    // alto fijo ni marco propio. La página ES el chat.
    <div className="relative flex flex-col h-full min-h-0">
      {/* Cinta de búsqueda: solo cuando la página la pide. La lupa vive en la
          cabecera del canal, no dentro del chat. */}
      {searching && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#EEF3FB] bg-[#FCFDFF]">
          <Search size={15} className="shrink-0 text-[#8A96AB]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en ${channelName}…`}
            className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-[#9CA3AF]"
          />
          <span className="shrink-0 text-[12px] text-[#8A96AB] tabular-nums">
            {query.trim()
              ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? '' : 's'}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onSearchingChange?.(false)
            }}
            aria-label="Cerrar la búsqueda"
            className="shrink-0 text-[#9CA3AF] hover:text-[#025dc7] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overflow-x-hidden py-3">
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
                      <div className={`relative flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
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
                            {(() => {
                              const files = attachmentsOf(m)
                              if (!files.length) return null
                              return (
                                <span className="block mb-1.5 space-y-1.5">
                                  {files.map((f, fi) => {
                                    if (f.kind === 'image') {
                                      return (
                                        <a
                                          key={fi}
                                          href={f.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img
                                            src={f.url}
                                            alt={f.name}
                                            loading="lazy"
                                            className="rounded-lg max-h-72 w-auto max-w-full object-cover"
                                          />
                                        </a>
                                      )
                                    }
                                    if (f.kind === 'audio') {
                                      return (
                                        <audio
                                          key={fi}
                                          src={f.url}
                                          controls
                                          preload="none"
                                          className="w-full max-w-[280px] h-9"
                                        />
                                      )
                                    }
                                    return (
                                      <a
                                        key={fi}
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        // `max-w-full` + `min-w-0`: un nombre de
                                        // archivo largo se corta con puntos
                                        // suspensivos en vez de estirar el globo
                                        // y sacar el texto fuera de la pantalla.
                                        className={`inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                                          isOwn
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7]'
                                        }`}
                                      >
                                        <FileText size={14} className="shrink-0" />
                                        <span className="truncate min-w-0">{f.name}</span>
                                        <span className="shrink-0 opacity-70 tabular-nums">
                                          {prettySize(f.size)}
                                        </span>
                                      </a>
                                    )
                                  })}
                                </span>
                              )
                            })()}
                            {renderMessageBody(messageText(m), isOwn)}
                            {m.edit_count > 0 && (
                              <span className="text-[10px] opacity-60 ml-1.5">· editado</span>
                            )}
                          </p>
                        </div>
                        {/* Barra de acciones: una pastilla que aparece encima del
                            mensaje al pasar el ratón, como en cualquier chat
                            moderno. Antes eran iconos sueltos al lado, que
                            empujaban el globo y se veían siempre a medias. */}
                        {accessToken && (
                          <div
                            // La barra se ancla al MISMO lado en el que está el
                            // globo y crece hacia dentro. Al revés (que es como
                            // estaba) un mensaje corto la lanzaba fuera del
                            // chat y la página se podía arrastrar a los lados.
                            className={`absolute -top-3.5 z-10 flex items-center gap-0.5 rounded-lg border border-[#E3E8EF] bg-white px-0.5 py-0.5 shadow-sm transition-opacity ${
                              isOwn ? 'right-0' : 'left-0'
                            } ${
                              pickerUuid === m.discussion_uuid || activeUuid === m.discussion_uuid
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100'
                            }`}
                          >
                            <MessageAction
                              label="Reaccionar"
                              align={isOwn ? 'right' : 'left'}
                              onClick={() =>
                                setPickerUuid((cur) =>
                                  cur === m.discussion_uuid ? null : m.discussion_uuid
                                )
                              }
                            >
                              <SmilePlus size={15} />
                            </MessageAction>
                            <MessageAction
                              label="Responder en un hilo"
                              align={isOwn ? 'right' : 'left'}
                              onClick={() => onOpenThread?.(m.discussion_uuid)}
                            >
                              <MessageSquare size={15} />
                            </MessageAction>
                            <MessageAction
                              label="Citar en el canal"
                              align={isOwn ? 'right' : 'left'}
                              onClick={() =>
                                setReplyingTo({
                                  author: authorName(m.author),
                                  text: messageText(m).slice(0, 140),
                                  uuid: m.discussion_uuid,
                                })
                              }
                            >
                              <Reply size={15} />
                            </MessageAction>
                            {canEdit(m) && (
                              <MessageAction
                                label="Editar"
                                align={isOwn ? 'right' : 'left'}
                                onClick={() => startEdit(m)}
                              >
                                <Pencil size={14} />
                              </MessageAction>
                            )}
                            {canDelete(m) && (
                              <MessageAction
                                label="Eliminar"
                                danger
                                align={isOwn ? 'right' : 'left'}
                                onClick={() => removeMessage(m.discussion_uuid)}
                              >
                                <Trash2 size={14} />
                              </MessageAction>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Si el mensaje tiene hilo, se dice y se entra desde aquí */}
                      {(() => {
                        const replies = threadReplies.get(m.discussion_uuid)
                        if (!replies?.length) return null
                        const open = threadUuid === m.discussion_uuid
                        return (
                          <button
                            type="button"
                            onClick={() => onOpenThread?.(open ? null : m.discussion_uuid)}
                            className={`mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors ${
                              open
                                ? 'bg-[#025dc7]/10 text-[#025dc7]'
                                : 'text-[#025dc7] hover:bg-[#F0F5FF]'
                            }`}
                          >
                            <MessageSquare size={13} />
                            {replies.length}{' '}
                            {replies.length === 1 ? 'respuesta' : 'respuestas'}
                          </button>
                        )
                      })()}

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

      {/* Volver abajo (con cuántos te has perdido mientras leías arriba).
          Va dentro de la zona de mensajes y pegado a su borde inferior: así
          queda justo encima del compositor, mida este lo que mida. */}
      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#DDE6F5] text-[#025dc7] text-[12px] font-semibold shadow-md hover:border-[#4da3ff] transition-colors"
        >
          <ArrowDown size={14} />
          {unseenBelow > 0
            ? `${unseenBelow} mensaje${unseenBelow === 1 ? '' : 's'} nuevo${unseenBelow === 1 ? '' : 's'}`
            : 'Ir al final'}
        </button>
      )}

      </div>

      {/* Composer */}
      <AuthenticatedClientElement checkMethod="authentication">
        <div className="shrink-0 border-t border-[#EEF3FB] px-4 sm:px-6 py-3">
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
          {/* Grabadora de voz, abierta desde el micrófono */}
          {recording && (
            <div className="mb-2 rounded-xl bg-white border border-[#E3E8EF] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold text-[#5A6480]">Nota de voz</span>
                <button
                  type="button"
                  onClick={() => openTool(null)}
                  aria-label="Cerrar la grabadora"
                  className="text-[#9CA3AF] hover:text-[#025dc7] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <VoiceRecorder onSend={attachVoice} sending={uploading} />
            </div>
          )}

          {/* Lo que va a salir con el mensaje */}
          {(pending.length > 0 || uploading) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((f, i) => (
                <div
                  key={i}
                  className="relative group/att rounded-lg border border-[#DDE6F5] bg-white overflow-hidden"
                >
                  {f.kind === 'image' ? (
                    <img src={f.url} alt={f.name} className="h-16 w-16 object-cover" />
                  ) : (
                    <div className="h-16 px-3 flex items-center gap-2 text-[12px] text-[#5A6480] max-w-[200px]">
                      {f.kind === 'audio' ? (
                        <Mic size={14} className="text-[#025dc7] shrink-0" />
                      ) : (
                        <FileText size={14} className="text-[#025dc7] shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))}
                    title="Quitar"
                    aria-label="Quitar adjunto"
                    className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/55 text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="h-16 w-16 rounded-lg border border-dashed border-[#DDE6F5] flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-[#025dc7]" />
                </div>
              )}
            </div>
          )}

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

          {/* La caja: el texto arriba, los iconos debajo — como en Circle.
              Borde suave que no compite con el contenido y foco en azul. */}
          <div className="rounded-xl border border-[#E3E8EF] bg-white transition-colors focus-within:border-[#4da3ff] focus-within:ring-[3px] focus-within:ring-[#4da3ff]/15">
            <textarea
              value={text}
              onChange={(e) => onComposerChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={`Escribe en ${channelName}…`}
              className="w-full resize-none bg-transparent text-base sm:text-[14.5px] text-gray-900 placeholder:text-[#9CA3AF] outline-none max-h-40 px-3.5 pt-3 pb-1.5"
            />

            <div className="flex items-center gap-0.5 px-2 pb-2">
              {/* Archivo */}
              <input ref={fileInputRef} type="file" hidden onChange={(e) => attach(e.target.files)} />
              <ComposerButton
                label="Adjuntar un archivo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip size={17} />
              </ComposerButton>

              {/* Foto */}
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
                <ImageIcon size={17} />
              </ComposerButton>

              {/* Nota de voz — en una escuela de idiomas es la estrella */}
              <ComposerButton
                label="Grabar una nota de voz"
                onClick={() => openTool(recording ? null : 'voz')}
                active={recording}
              >
                <Mic size={17} />
              </ComposerButton>

              {/* Emojis */}
              <ComposerButton
                label="Emojis"
                onClick={() => openTool(emojiOpen ? null : 'emoji')}
                active={emojiOpen}
              >
                <SmilePlus size={17} />
              </ComposerButton>

              {/* Mencionar: escribe la arroba y abre las sugerencias */}
              <ComposerButton label="Mencionar a alguien" onClick={mentionSomeone}>
                <AtSign size={17} />
              </ComposerButton>

              {isAdmin && (
                <ComposerButton
                  label="Crear una encuesta"
                  onClick={() => openTool(pollDraft ? null : 'encuesta')}
                  active={!!pollDraft}
                >
                  <BarChart3 size={17} />
                </ComposerButton>
              )}

              <div className="flex-1" />

              <button
                onClick={() => send()}
                disabled={(!text.trim() && pending.length === 0 && !pollDraft) || sending}
                title="Enviar"
                aria-label={t('communities.create_discussion.submit')}
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
          <p className="mt-1.5 text-[11px] text-[#9CA3AF] hidden sm:block">
            Enter envía · Shift + Enter salta de línea
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
