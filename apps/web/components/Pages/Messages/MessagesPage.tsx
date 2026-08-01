'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import {
  DirectMessage,
  DirectThread,
  audioSrc,
  getMyThread,
  getThread,
  getThreads,
  sendDirectMessage,
  updateDirectWelcome,
} from '@services/messages/direct'
import VoiceRecorder from './VoiceRecorder'
import toast from 'react-hot-toast'
import { Loader2, Send, MessageSquare, Sparkles, Check, X, Pencil } from 'lucide-react'

/**
 * Mensajes directos.
 *
 * - Alumno: una sola conversación con el equipo. Nada que elegir.
 * - Equipo: la bandeja entera, un hilo por alumno, y arriba el texto de
 *   bienvenida que recibe cada alumno nuevo automáticamente.
 */
export default function MessagesPage() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  const [isStaff, setIsStaff] = useState(false)
  const [threads, setThreads] = useState<DirectThread[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshBadge = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] })
  }, [queryClient])

  // Carga inicial: el alumno abre su hilo; el equipo, la lista.
  useEffect(() => {
    if (!accessToken) return
    let alive = true
    ;(async () => {
      const detail = await getMyThread(accessToken)
      if (!alive) return
      if (detail?.is_staff) {
        setIsStaff(true)
        const list = await getThreads(accessToken)
        if (!alive) return
        setThreads(list)
        setLoading(false)
      } else if (detail) {
        setMessages(detail.messages)
        setActiveId(detail.thread.id)
        setLoading(false)
      } else {
        setLoading(false)
      }
      refreshBadge()
    })()
    return () => {
      alive = false
    }
  }, [accessToken, refreshBadge])

  const openThread = async (id: number) => {
    setActiveId(id)
    setMessages([])
    const detail = await getThread(id, accessToken)
    if (detail) setMessages(detail.messages)
    setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, unread: 0 } : t)))
    refreshBadge()
  }

  // Refresco en segundo plano de la conversación abierta.
  useEffect(() => {
    if (!activeId || !accessToken) return
    const id = setInterval(async () => {
      const detail = await getThread(activeId, accessToken)
      if (detail) setMessages(detail.messages)
    }, 10_000)
    return () => clearInterval(id)
  }, [activeId, accessToken])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const push = (m: DirectMessage | null) => {
    if (!m) {
      toast.error('No se pudo enviar. Inténtalo otra vez.')
      return
    }
    setMessages((cur) => [...cur, m])
  }

  const sendText = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const m = await sendDirectMessage({ threadId: activeId, body }, accessToken)
    setSending(false)
    if (m) setText('')
    push(m)
  }

  const sendVoice = async (audio: Blob, seconds: number) => {
    setSending(true)
    const m = await sendDirectMessage(
      { threadId: activeId, audio, audioSeconds: seconds },
      accessToken
    )
    setSending(false)
    push(m)
  }

  if (!accessToken) {
    return <p className="p-8 text-sm text-gray-500">Entra a tu cuenta para ver tus mensajes.</p>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
        <Loader2 size={18} className="animate-spin" /> Cargando tus mensajes…
      </div>
    )
  }

  const conversation = (
    <div className="flex flex-col h-[70vh] min-h-[440px] bg-white border border-[#DDE6F5] rounded-2xl overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto lh-thin-scroll p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            Aquí no hay nada todavía. Escribe lo que necesites.
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} mine={isStaff ? m.from_staff : !m.from_staff} />)
        )}
      </div>

      <div className="border-t border-[#EEF2FB] p-3 flex items-end gap-2">
        <VoiceRecorder onSend={sendVoice} sending={sending} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendText()
            }
          }}
          rows={1}
          placeholder="Escribe tu mensaje…"
          className="flex-1 resize-none bg-gray-50 rounded-xl px-3 py-2.5 text-[15px] sm:text-sm text-gray-900 placeholder:text-gray-400 outline-none max-h-32 focus:ring-2 focus:ring-[#025dc7]/20"
        />
        <button
          onClick={sendText}
          disabled={!text.trim() || sending}
          aria-label="Enviar"
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-white bg-[#025dc7] hover:bg-[#0b6df0] transition-colors disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )

  if (!isStaff) {
    return (
      <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto">
        <h1 className="text-[24px] sm:text-[30px] font-bold text-[#1D0084] leading-tight">
          Mensajes
        </h1>
        <p className="text-[14px] text-gray-600 mt-1 mb-5">
          Tu canal directo con el equipo de Holandés Nawar. Puedes escribir o
          mandar una nota de voz — para pronunciación va de lujo.
        </p>
        {conversation}
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <h1 className="text-[24px] sm:text-[30px] font-bold text-[#1D0084] leading-tight">
        Mensajes
      </h1>
      <p className="text-[14px] text-gray-600 mt-1 mb-5">
        Las conversaciones privadas con tus alumnos. Contesta con texto o con
        una nota de voz.
      </p>

      <WelcomeEditor orgId={org?.id} accessToken={accessToken} stored={org?.config?.config?.direct_welcome?.message} />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 mt-5">
        <div className="space-y-1.5 max-h-[70vh] overflow-y-auto lh-thin-scroll">
          {threads.length === 0 ? (
            <p className="text-sm text-gray-500 px-1">
              Todavía no hay conversaciones. Se crean solas en cuanto un alumno
              entra por primera vez.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  activeId === t.id
                    ? 'bg-white border-[#4da3ff] ring-[3px] ring-[#4da3ff]/20'
                    : 'bg-white border-[#DDE6F5] hover:border-[#4da3ff]/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[#0a1656] truncate flex-1">
                    {t.student_name}
                  </span>
                  {t.unread > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {t.unread}
                    </span>
                  )}
                </span>
                {t.last_message_preview && (
                  <span className="block mt-0.5 text-[12.5px] text-gray-500 truncate">
                    {t.last_message_preview}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="min-w-0">
          {activeId ? (
            conversation
          ) : (
            <div className="h-[70vh] min-h-[440px] flex flex-col items-center justify-center text-center bg-white border border-[#DDE6F5] rounded-2xl px-6">
              <MessageSquare size={26} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 max-w-xs">
                Elige un alumno de la izquierda para ver vuestra conversación.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Bubble({ m, mine }: { m: DirectMessage; mine: boolean }) {
  const when = m.created_at ? new Date(m.created_at) : null
  const time = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            mine ? 'bg-[#025dc7] text-white rounded-tr-sm' : 'bg-[#F0F5FF] text-gray-800 rounded-tl-sm'
          }`}
        >
          {!mine && (
            <p className="text-[11.5px] font-bold mb-0.5 text-[#025dc7]">{m.author_name}</p>
          )}
          {m.body && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>}
          {m.audio_url && (
            <audio
              src={audioSrc(m.audio_url)}
              controls
              className={`mt-1.5 h-9 w-[240px] max-w-full ${mine ? 'invert-[.05]' : ''}`}
            />
          )}
        </div>
        <p className={`mt-0.5 text-[11px] text-gray-400 ${mine ? 'text-right' : ''}`}>{time}</p>
      </div>
    </div>
  )
}

/** Texto que recibe automáticamente cada alumno nuevo. */
function WelcomeEditor({
  orgId,
  accessToken,
  stored,
}: {
  orgId?: number
  accessToken?: string
  stored?: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(stored || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    const ok = await updateDirectWelcome(orgId, value, accessToken)
    setSaving(false)
    if (ok) {
      setEditing(false)
      toast.success('Mensaje de bienvenida guardado')
    } else {
      toast.error('No se pudo guardar')
    }
  }

  return (
    <div className="bg-[#F0F5FF] rounded-xl px-4 py-3.5">
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-[#4da3ff] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#0a1656]">
            Bienvenida automática
          </p>
          <p className="text-[12.5px] text-[#0a1656]/75 leading-relaxed">
            Es el primer mensaje que le llega a cada alumno nuevo, sin que tengas
            que hacer nada.
          </p>
          {editing ? (
            <>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={4}
                placeholder="¡Hola! Soy del equipo de Holandés Nawar…"
                className="w-full mt-2 rounded-lg border border-[#DDE6F5] bg-white px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-[#025dc7] resize-y"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#0a1656] text-[13px] font-bold hover:bg-[#6cb5ff] disabled:opacity-50"
                >
                  <Check size={14} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setValue(stored || '')
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:text-[#1D0084]"
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#025dc7] hover:underline"
            >
              <Pencil size={12} /> {stored ? 'Cambiar el texto' : 'Escribir el mío'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
