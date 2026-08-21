'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  DirectAttachment,
  DirectMessage,
  DirectThread,
  DirectThreadDetail,
  DirectoryEntry,
  getDirectory,
  getMyThread,
  getThread,
  getThreads,
  mediaSrc,
  openThreadWith,
  sendDirectMessage,
  updateDirectWelcome,
  updateStaffTitles,
  uploadMessageAttachment,
} from '@services/messages/direct'
import VoiceRecorder from './VoiceRecorder'
import ComposerButton from '@components/Objects/Communities/ComposerButton'
import { COMPOSER_EMOJIS } from '@/lib/chat/emojis'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  PenSquare,
  Mic,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

/** "1,4 MB" — para que un archivo diga lo que pesa antes de abrirlo. */
function prettySize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Mensajes directos.
 *
 * - Alumno: su conversación con el equipo + las que abra con un moderador
 *   concreto desde el buscador.
 * - Equipo: la bandeja de alumnos, y el buscador para escribir el primero.
 *
 * **La página ES el chat**, igual que un canal de la comunidad: ocupa la
 * pantalla entera, no se desplaza (solo la lista de mensajes) y el compositor
 * vive pegado abajo. Antes era una tarjeta con bordes redondeados flotando en
 * medio de una página que se desplazaba, con las tarjetas de administración
 * empujándola hacia abajo: en móvil la conversación quedaba en un recuadro
 * pequeño con medio hueco en blanco.
 *
 * Los ajustes del equipo (bienvenida automática y cargos) ya no van en el
 * camino de la conversación: viven detrás de la rueda dentada de la bandeja.
 *
 * En móvil es una sola columna: bandeja → conversación a pantalla completa,
 * con flecha para volver.
 */
export default function MessagesPage() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  const [isStaff, setIsStaff] = useState(false)
  const [threads, setThreads] = useState<DirectThread[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeTitle, setActiveTitle] = useState('')
  const [activeAvatar, setActiveAvatar] = useState('')
  const [activeRole, setActiveRole] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  // La grabadora se abre desde su icono, como en la comunidad.
  const [recording, setRecording] = useState(false)
  // Avisar al alumno por correo con ESTE mensaje. Apagado por defecto: el
  // sobre y la campana ya avisan dentro, el correo es para lo importante.
  const [notify, setNotify] = useState(false)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Móvil: qué se ve ahora mismo.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  // Buscador de personas.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<DirectoryEntry[]>([])
  const [searching, setSearching] = useState(false)
  // Ajustes del equipo (fuera de la conversación).
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Fotos y archivos ya subidos, esperando a salir con el mensaje.
  const [pending, setPending] = useState<DirectAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const refreshBadge = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] })
  }, [queryClient])

  const loadThreads = useCallback(async () => {
    const list = await getThreads(accessToken)
    setThreads(list)
    return list
  }, [accessToken])

  // Carga inicial: quién soy y mis conversaciones.
  useEffect(() => {
    if (!accessToken) return
    let alive = true
    ;(async () => {
      const detail = await getMyThread(accessToken)
      if (!alive) return
      const staff = !!detail?.is_staff
      setIsStaff(staff)
      const list = await loadThreads()
      if (!alive) return
      // El alumno entra directo a su conversación con el equipo; en escritorio
      // el equipo ve la bandeja y elige.
      if (!staff && detail?.thread?.id) {
        setActiveId(detail.thread.id)
        setActiveTitle(detail.thread.title || 'Equipo Nawar')
        setActiveAvatar(detail.thread.title_avatar || '')
        setActiveRole(detail.thread.title_role || '')
        setMessages(detail.messages)
      } else if (!staff && list.length) {
        setActiveId(list[0].id)
        setActiveTitle(list[0].title)
        setActiveAvatar(list[0].title_avatar || '')
        setActiveRole(list[0].title_role || '')
      }
      setLoading(false)
      refreshBadge()
    })()
    return () => {
      alive = false
    }
  }, [accessToken, loadThreads, refreshBadge])

  const openThread = async (id: number, title: string, avatar = '', role = '') => {
    setActiveId(id)
    setActiveTitle(title)
    setActiveAvatar(avatar)
    setActiveRole(role)
    setMessages([])
    // Lo que estuviera preparado era para la otra conversación.
    setPending([])
    setMobileView('chat')
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

  // Buscador de personas (se consulta al abrirlo y al escribir).
  useEffect(() => {
    if (!pickerOpen || !accessToken) return
    let alive = true
    setSearching(true)
    const t = setTimeout(async () => {
      const list = await getDirectory(query, accessToken)
      if (!alive) return
      setPeople(list)
      setSearching(false)
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [pickerOpen, query, accessToken])

  const startWith = async (person: DirectoryEntry) => {
    const detail: DirectThreadDetail | null = await openThreadWith(person.user_id, accessToken)
    if (!detail) {
      toast.error('No se pudo abrir la conversación')
      return
    }
    setPickerOpen(false)
    setQuery('')
    await loadThreads()
    setActiveId(detail.thread.id)
    setActiveTitle(detail.thread.title || person.name)
    setActiveAvatar(detail.thread.title_avatar || person.avatar || '')
    setActiveRole(detail.thread.title_role || '')
    setMessages(detail.messages)
    setPending([])
    setMobileView('chat')
  }

  /** Sube lo que se acaba de elegir y lo deja listo para enviar. */
  const attach = async (files: FileList | null) => {
    if (!files?.length || !accessToken) return
    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const uploaded = await uploadMessageAttachment(file, accessToken)
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

  const push = (m: DirectMessage | null) => {
    if (!m) {
      toast.error('No se pudo enviar. Inténtalo otra vez.')
      return
    }
    setMessages((cur) => [...cur, m])
    loadThreads()
  }

  const sendText = async () => {
    const body = text.trim()
    // Una foto o un archivo se mandan solos, sin escribir nada.
    if ((!body && !pending.length) || sending || !activeId) return
    setSending(true)
    const m = await sendDirectMessage(
      { threadId: activeId, body, notify, attachments: pending },
      accessToken
    )
    setSending(false)
    if (m) {
      setText('')
      setPending([])
    }
    // El aviso se apaga después de cada envío: así escribir tres mensajes
    // seguidos no manda tres correos sin querer. Se vuelve a encender a mano
    // cuando de verdad haga falta.
    if (m && notify) {
      setNotify(false)
      toast.success('Mensaje enviado y aviso por correo')
    }
    push(m)
  }

  const sendVoice = async (audio: Blob, seconds: number) => {
    if (!activeId) return
    setSending(true)
    const m = await sendDirectMessage(
      { threadId: activeId, audio, audioSeconds: seconds, notify },
      accessToken
    )
    setSending(false)
    if (m && notify) {
      setNotify(false)
      toast.success('Nota de voz enviada y aviso por correo')
    }
    push(m)
  }

  // Alto de la pantalla menos la barra superior del móvil, igual que un canal.
  const pageHeight = 'h-[calc(100dvh-3.5rem)] md:h-[100dvh]'

  if (!accessToken) {
    return <p className="p-8 text-sm text-gray-500">Entra a tu cuenta para ver tus mensajes.</p>
  }

  if (loading) {
    return (
      <div className={`${pageHeight} flex items-center justify-center text-gray-500 gap-2`}>
        <Loader2 size={18} className="animate-spin" /> Cargando tus mensajes…
      </div>
    )
  }

  /* ── Bandeja (columna izquierda en escritorio, pantalla entera en móvil) ── */
  const inbox = (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-[#EEF3FB]">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-[#025dc7] shrink-0" />
          <h1 className="text-[19px] font-bold text-gray-900 flex-1 min-w-0 truncate">
            Mis mensajes
          </h1>
          {isStaff && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Ajustes de los mensajes"
              title="Ajustes de los mensajes"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 text-[#4B5563] hover:text-[#025dc7] transition-colors"
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        <button
          onClick={() => setPickerOpen(true)}
          className="mt-3 inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold text-[14px] transition-colors"
        >
          <PenSquare size={15} />
          {isStaff ? 'Escribir a un alumno' : 'Escribir a un moderador'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lh-thin-scroll px-3 py-3 space-y-1.5">
        {threads.length === 0 ? (
          <p className="text-sm text-gray-500 px-1 py-3">
            {isStaff
              ? 'Todavía no hay conversaciones. Usa el botón de arriba para escribir a un alumno.'
              : 'Todavía no tienes conversaciones.'}
          </p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t.id, t.title, t.title_avatar, t.title_role)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                activeId === t.id
                  ? 'bg-[#F7FAFF] border-[#4da3ff]'
                  : 'bg-white border-[#DDE6F5] hover:border-[#4da3ff]/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Avatar src={t.title_avatar} name={t.title || t.student_name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-[#0a1656] truncate leading-tight">
                    {t.title || t.student_name}
                  </span>
                  {t.title_role && (
                    <span className="block text-[11.5px] text-[#025dc7] font-semibold truncate leading-tight">
                      {t.title_role}
                    </span>
                  )}
                </span>
                {t.unread > 0 && (
                  <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {t.unread}
                  </span>
                )}
              </span>
              {t.last_message_preview && (
                <span className="block mt-1 ml-[44px] text-[12.5px] text-gray-500 truncate">
                  {t.last_message_preview}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )

  /* ── Conversación: cabecera, mensajes y compositor pegado abajo ── */
  const conversation = (
    <div className="h-full min-h-0 flex flex-col bg-white">
      {/* Cabecera: en móvil lleva la flecha para volver a la bandeja */}
      <div className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-[#EEF3FB]">
        <button
          onClick={() => setMobileView('list')}
          aria-label="Volver a mis mensajes"
          className="lg:hidden shrink-0 w-8 h-8 inline-flex items-center justify-center text-[#4B5563] hover:text-[#025dc7] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar src={activeAvatar} name={activeTitle || 'Conversación'} size={34} />
        <span className="min-w-0">
          <span className="block text-[14.5px] font-bold text-[#0a1656] truncate leading-tight">
            {activeTitle || 'Conversación'}
          </span>
          {activeRole && (
            <span className="flex items-center gap-1 text-[11.5px] text-[#025dc7] font-semibold leading-tight">
              <BadgeCheck size={12} /> {activeRole}
            </span>
          )}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto lh-thin-scroll px-3 sm:px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            Aquí no hay nada todavía. Escribe lo que necesites.
          </p>
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              mine={isStaff ? m.from_staff : !m.from_staff}
              peerName={activeTitle}
            />
          ))
        )}
      </div>

      {emojiOpen && (
        <div className="shrink-0 mx-3 mb-1 grid grid-cols-8 gap-1 rounded-xl border border-[#DDE6F5] bg-white p-2">
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

      {isStaff && notify && (
        <div className="shrink-0 mx-3 mb-1 flex items-center gap-2 rounded-xl bg-[#F0F5FF] px-3 py-2">
          <BellRing size={14} className="text-[#025dc7] shrink-0" />
          <p className="text-[12px] text-[#0a1656] leading-snug">
            Al enviar, el alumno recibirá un correo avisándole. No se le cuenta lo que dice el
            mensaje, solo que lo tiene.
          </p>
        </div>
      )}

      {/* El mismo compositor que la comunidad: el texto arriba, los iconos
          debajo y sin bolitas grises. Que Mis mensajes y la comunidad se
          escriban igual es lo que hace que la escuela parezca una sola cosa. */}
      <div className="shrink-0 border-t border-[#EEF3FB] px-3 py-3">
        {recording && (
          <div className="mb-2 rounded-xl bg-white border border-[#E3E8EF] px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-[#5A6480]">Nota de voz</span>
              <button
                type="button"
                onClick={() => setRecording(false)}
                aria-label="Cerrar la grabadora"
                className="text-[#9CA3AF] hover:text-[#025dc7] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <VoiceRecorder onSend={sendVoice} sending={sending} />
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(f.url)} alt={f.name} className="h-16 w-16 object-cover" />
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

        <div className="rounded-xl border border-[#E3E8EF] bg-white transition-colors focus-within:border-[#4da3ff] focus-within:ring-[3px] focus-within:ring-[#4da3ff]/15">
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

            <ComposerButton
              label="Grabar una nota de voz"
              onClick={() => {
                setRecording((v) => !v)
                setEmojiOpen(false)
              }}
              active={recording}
            >
              <Mic size={17} />
            </ComposerButton>
            <ComposerButton
              label="Emojis"
              onClick={() => {
                setEmojiOpen((v) => !v)
                setRecording(false)
              }}
              active={emojiOpen}
            >
              <Smile size={17} />
            </ComposerButton>
            {isStaff && (
              <ComposerButton
                label={notify ? 'Se avisará por correo' : 'Avisar por correo al enviar'}
                onClick={() => setNotify((v) => !v)}
                active={notify}
              >
                <BellRing size={17} />
              </ComposerButton>
            )}

            <div className="flex-1" />

            <button
              onClick={sendText}
              disabled={(!text.trim() && !pending.length) || sending || uploading}
              aria-label="Enviar"
              title="Enviar"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors bg-[#025dc7] text-white hover:bg-[#0b6df0] disabled:bg-[#EFF1F6] disabled:text-[#B6BECC] disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-[#9CA3AF] hidden sm:block">
          Enter envía · Shift + Enter salta de línea
        </p>
      </div>
    </div>
  )

  const emptyPane = (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <MessageSquare size={26} className="text-gray-300 mb-2" />
      <p className="text-sm text-gray-500 max-w-xs">
        Elige una conversación de la izquierda, o escribe a alguien nuevo.
      </p>
    </div>
  )

  return (
    <div className={`${pageHeight} flex overflow-hidden bg-white`}>
      {/* Bandeja: columna fija en escritorio, pantalla entera en móvil */}
      <div
        className={`w-full lg:w-[320px] lg:shrink-0 lg:border-r lg:border-[#EEF3FB] ${
          mobileView === 'chat' ? 'hidden lg:block' : ''
        }`}
      >
        {inbox}
      </div>

      {/* Conversación */}
      <div
        className={`flex-1 min-w-0 ${mobileView === 'list' ? 'hidden lg:block' : ''}`}
      >
        {activeId ? conversation : emptyPane}
      </div>

      {pickerOpen && (
        <PeoplePicker
          isStaff={isStaff}
          query={query}
          setQuery={setQuery}
          people={people}
          searching={searching}
          onPick={startWith}
          onClose={() => {
            setPickerOpen(false)
            setQuery('')
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)}>
          <WelcomeEditor
            orgId={org?.id}
            accessToken={accessToken}
            stored={org?.config?.config?.direct_welcome?.message}
          />
          <StaffTitlesEditor
            orgId={org?.id}
            accessToken={accessToken}
            stored={org?.config?.config?.staff_titles?.titles || {}}
          />
        </SettingsPanel>
      )}
    </div>
  )
}

/**
 * Los ajustes del equipo, en un panel aparte.
 *
 * Antes vivían encima de la conversación y la empujaban media pantalla hacia
 * abajo — y son cosas que se tocan una vez, no cada día.
 */
function SettingsPanel({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-0 sm:p-6"
      style={{ zIndex: 'var(--z-modal-content, 220)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:shadow-xl sm:max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[#EEF2FB]">
          <Settings size={17} className="text-[#025dc7] shrink-0" />
          <span className="text-[14px] font-bold text-[#0a1656] flex-1">
            Ajustes de los mensajes
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-[#025dc7] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto lh-thin-scroll p-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}

/** Buscador de personas a pantalla completa (va bien en móvil y en ordenador). */
function PeoplePicker({
  isStaff,
  query,
  setQuery,
  people,
  searching,
  onPick,
  onClose,
}: {
  isStaff: boolean
  query: string
  setQuery: (v: string) => void
  people: DirectoryEntry[]
  searching: boolean
  onPick: (p: DirectoryEntry) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-3 sm:p-6"
      style={{ zIndex: 'var(--z-modal-content, 220)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden mt-10 sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EEF2FB]">
          <Users size={17} className="text-[#025dc7] shrink-0" />
          <span className="text-[14px] font-bold text-[#0a1656] flex-1">
            {isStaff ? 'Escribir a un alumno' : 'Escribir a un moderador'}
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-3 border-b border-[#EEF2FB]">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isStaff ? 'Buscar por nombre o correo…' : 'Buscar por nombre…'}
              className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto lh-thin-scroll">
          {searching ? (
            <p className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
              <Loader2 size={15} className="animate-spin" /> Buscando…
            </p>
          ) : people.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 px-6">
              {query.trim()
                ? `Nadie con «${query.trim()}».`
                : isStaff
                ? 'Todavía no hay alumnos en la escuela.'
                : 'Todavía no hay moderadores disponibles.'}
            </p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.user_id} className="border-b border-[#F3F6FC] last:border-0">
                  <button
                    onClick={() => onPick(p)}
                    className="w-full text-left px-4 py-3 hover:bg-[#F7FAFF] transition-colors flex items-center gap-3"
                  >
                    <Avatar src={p.avatar} name={p.name} size={34} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-[#0a1656] truncate">
                        {p.name}
                      </span>
                      <span className="block text-[12px] text-gray-500 truncate">
                        {p.email || p.role}
                        {p.thread_id ? ' · ya tenéis conversación' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Foto redonda con la inicial de respaldo cuando no hay imagen. */
function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className="relative shrink-0 inline-flex items-center justify-center rounded-full overflow-hidden bg-[#DDE6F5] text-[#025dc7] font-bold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaSrc(src)}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        initial
      )}
    </span>
  )
}

function Bubble({
  m,
  mine,
  peerName,
}: {
  m: DirectMessage
  mine: boolean
  peerName: string
}) {
  // El nombre solo si NO es el de la cabecera: repetir "Team Nawar" en cada
  // burbuja de una conversación con Team Nawar es ruido. Si contesta otra
  // persona del equipo, entonces sí se enseña.
  const showName = !mine && !!m.author_name && m.author_name !== peerName
  const when = m.created_at ? new Date(m.created_at) : null
  const time =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString('es-ES', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
  return (
    <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {/* La foto solo en los mensajes del otro: los tuyos ya sabes quién eres */}
      {!mine && <Avatar src={m.author_avatar} name={m.author_name} />}
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            mine
              ? 'bg-[#025dc7] text-white rounded-tr-sm'
              : 'bg-[#F0F5FF] text-gray-800 rounded-tl-sm'
          }`}
        >
          {showName && (
            <p className="text-[11.5px] font-bold mb-0.5 text-[#025dc7]">
              {m.author_name}
              {m.author_title && (
                <span className="ml-1.5 font-semibold text-[#0a1656]/55">· {m.author_title}</span>
              )}
            </p>
          )}
          {!!m.attachments?.length && (
            <div className="space-y-1.5 mb-1.5">
              {m.attachments.map((f, i) => {
                if (f.kind === 'image') {
                  return (
                    <a
                      key={i}
                      href={mediaSrc(f.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaSrc(f.url)}
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
                      key={i}
                      src={mediaSrc(f.url)}
                      controls
                      preload="none"
                      className="w-full max-w-[280px] h-9"
                    />
                  )
                }
                return (
                  <a
                    key={i}
                    href={mediaSrc(f.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                      mine
                        ? 'bg-white/15 hover:bg-white/25 text-white'
                        : 'bg-white hover:bg-[#e3edff] text-[#025dc7]'
                    }`}
                  >
                    <FileText size={14} className="shrink-0" />
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    {!!f.size && (
                      <span className="opacity-70 tabular-nums">{prettySize(f.size)}</span>
                    )}
                  </a>
                )
              })}
            </div>
          )}
          {m.body && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
          )}
          {m.audio_url && (
            <audio
              src={mediaSrc(m.audio_url)}
              controls
              className="mt-1.5 h-9 w-[240px] max-w-full"
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
          <p className="text-[13px] font-bold text-[#0a1656]">Bienvenida automática</p>
          <p className="text-[12.5px] text-[#0a1656]/75 leading-relaxed">
            Es el primer mensaje que le llega a cada alumno nuevo, sin que tengas que hacer nada.
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


/**
 * Cargos del equipo.
 *
 * Sin esto el alumno recibe un mensaje de "Paul" y no sabe quién es ni por qué
 * le escribe. Con el cargo puesto, "Paul · Director Académico" se explica solo.
 */
function StaffTitlesEditor({
  orgId,
  accessToken,
  stored,
}: {
  orgId?: number
  accessToken?: string
  stored: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [team, setTeam] = useState<DirectoryEntry[]>([])
  const [titles, setTitles] = useState<Record<string, string>>(stored || {})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !accessToken) return
    let alive = true
    setLoading(true)
    getDirectory('', accessToken, 'team').then((list) => {
      if (!alive) return
      setTeam(list)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [open, accessToken])

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    const ok = await updateStaffTitles(orgId, titles, accessToken)
    setSaving(false)
    if (ok) {
      setOpen(false)
      toast.success('Cargos guardados')
    } else {
      toast.error('No se pudieron guardar')
    }
  }

  return (
    <div className="bg-[#F0F5FF] rounded-xl px-4 py-3.5">
      <div className="flex items-start gap-2">
        <BadgeCheck size={16} className="text-[#4da3ff] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#0a1656]">Cargos del equipo</p>
          <p className="text-[12.5px] text-[#0a1656]/75 leading-relaxed">
            Sale junto al nombre en los mensajes y en la comunidad: así el alumno
            sabe quién le escribe.
          </p>

          {open ? (
            <>
              {loading ? (
                <p className="flex items-center gap-2 text-[12.5px] text-gray-500 mt-2">
                  <Loader2 size={14} className="animate-spin" /> Cargando el equipo…
                </p>
              ) : team.length === 0 ? (
                <p className="text-[12.5px] text-gray-500 mt-2">
                  No hay más personas con permisos de equipo todavía.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {team.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-2">
                      <Avatar src={p.avatar} name={p.name} size={28} />
                      <span className="text-[12.5px] text-[#0a1656] w-24 shrink-0 truncate">
                        {p.name}
                      </span>
                      <input
                        value={titles[String(p.user_id)] ?? ''}
                        onChange={(e) =>
                          setTitles({ ...titles, [String(p.user_id)]: e.target.value })
                        }
                        placeholder="Director Académico"
                        className="flex-1 min-w-0 rounded-lg border border-[#DDE6F5] bg-white px-2.5 py-1.5 text-[12.5px] text-gray-800 outline-none focus:border-[#025dc7]"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={save}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] text-[#0a1656] text-[13px] font-bold hover:bg-[#6cb5ff] disabled:opacity-50"
                >
                  <Check size={14} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setOpen(false)
                    setTitles(stored || {})
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:text-[#1D0084]"
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#025dc7] hover:underline"
            >
              <Pencil size={12} />
              {Object.keys(stored || {}).length ? 'Cambiar los cargos' : 'Poner los cargos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
