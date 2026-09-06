'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Hash, MoreHorizontal, Pin, Search, X } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { ChannelChat } from '@components/Objects/Communities/ChannelChat'
import ChannelPosts from '@components/Objects/Communities/ChannelPosts'
import ThreadPanel from '@components/Objects/Communities/ThreadPanel'
import PinnedFeed from '@components/Objects/Communities/PinnedFeed'
import { getUriWithOrg } from '@services/config/config'
import { Community } from '@services/communities/communities'
import { DiscussionWithAuthor } from '@services/communities/discussions'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'

interface CommunityClientProps {
  community: Community
  initialDiscussions: DiscussionWithAuthor[]
  orgslug: string
  org_id: number
}

/**
 * La pantalla de un canal.
 *
 * Un canal puede ser de dos formas, y se elige al crearlo:
 *   chat  → conversación seguida. **La página ES el chat**: ocupa la pantalla
 *           entera, no se desplaza (solo la lista de mensajes), y el
 *           compositor vive abajo del todo. Nada de una tarjeta con bordes
 *           redondeados flotando en medio de una página que se desplaza.
 *   posts → tablón: título, cuerpo, fotos y comentarios. Ese sí es una página
 *           normal que se desplaza, porque es una lista de publicaciones.
 *
 * A la derecha hay un panel que enseña una cosa cada vez: los mensajes
 * fijados (por defecto) o el hilo que se acaba de abrir. Se cierra desde su
 * propia X y se vuelve a abrir desde el menú «…» de la cabecera; la
 * preferencia se recuerda en el navegador.
 */

const PINNED_PREF_KEY = 'nawar_channel_pinned_open'

const CommunityClient = ({ community, orgslug }: CommunityClientProps) => {
  const { emoji, text } = splitChannelEmoji(community.name)
  const isBoard = community.kind === 'posts'

  // Qué enseña la columna derecha. El hilo manda sobre los fijados: si abres
  // uno, ocupa el panel; al cerrarlo vuelven los fijados si los tenías.
  const [threadUuid, setThreadUuid] = React.useState<string | null>(null)
  const [pinnedOpen, setPinnedOpen] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  // Los fijados en el móvil van en su propio estado, y arrancan CERRADOS.
  // `pinnedOpen` vale `true` por defecto porque en el escritorio es una columna
  // al lado del chat, que no molesta; en el móvil sería una hoja tapando el
  // canal nada más entrar. Son dos cosas distintas aunque se llamen igual.
  const [fijadosMovil, setFijadosMovil] = React.useState(false)

  // ¿Estamos por debajo del corte `lg` de Tailwind (1024 px)? Hace falta para
  // que el menú diga "Ver" u "Ocultar" según lo que el alumno tenga DELANTE:
  // en el móvil la columna de la derecha no existe, así que mirar `pinnedOpen`
  // daba un "Ocultar los fijados" con los fijados sin aparecer por ningún lado.
  const [esMovil, setEsMovil] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 1023px)')
    if (!mq) return
    const aplicar = () => setEsMovil(mq.matches)
    aplicar()
    mq.addEventListener?.('change', aplicar)
    return () => mq.removeEventListener?.('change', aplicar)
  }, [])

  // La preferencia del panel se recuerda: quien prefiere el chat a pantalla
  // completa no tiene que cerrarlo cada vez que entra.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_PREF_KEY)
      if (saved !== null) setPinnedOpen(saved === '1')
    } catch {
      /* sin localStorage: se queda abierto, que es el valor por defecto */
    }
  }, [])

  const togglePinned = (open: boolean) => {
    setPinnedOpen(open)
    try {
      localStorage.setItem(PINNED_PREF_KEY, open ? '1' : '0')
    } catch {
      /* da igual: solo se pierde la preferencia */
    }
  }

  // Cerrar el menú al pulsar fuera.
  React.useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen])

  const backLink = (
    <Link
      href={getUriWithOrg(orgslug, '/communities')}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5A6480] hover:text-[#1D0084] transition-colors"
    >
      <ArrowLeft size={15} /> Canales
    </Link>
  )

  const title = (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 flex items-center justify-center shrink-0">
        {emoji ? (
          <span className="text-[22px] leading-none" aria-hidden>
            {emoji}
          </span>
        ) : (
          <Hash size={19} className="text-[#025dc7]" />
        )}
      </span>
      <div className="min-w-0">
        <h1 className="text-[17px] sm:text-[19px] font-bold text-gray-900 leading-tight truncate">
          {text}
        </h1>
        {community.description && (
          <p className="text-[12.5px] text-[#8A96AB] truncate">{community.description}</p>
        )}
      </div>
    </div>
  )

  /* ── Tablón: una página normal, que se desplaza como cualquier lista ── */
  if (isBoard) {
    return (
      <GeneralWrapperStyled>
        <div className="mb-3">{backLink}</div>
        <div className="mb-5">{title}</div>
        <ChannelPosts
          communityUuid={community.community_uuid}
          channelName={text}
          orgslug={orgslug}
        />
      </GeneralWrapperStyled>
    )
  }

  /* ── Chat: la página entera, sin desplazamiento ── */
  const sidePanelOpen = Boolean(threadUuid) || pinnedOpen

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-[100dvh] flex flex-col overflow-hidden bg-white">
      {/* Cabecera del canal */}
      <header className="shrink-0 border-b border-[#EEF3FB] px-4 sm:px-6 py-3">
        <div className="mb-2">{backLink}</div>
        <div className="flex items-center gap-3">
          {title}
          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearching((v) => !v)}
            aria-label="Buscar en el canal"
            title="Buscar en el canal"
            className={`shrink-0 inline-flex items-center justify-center w-9 h-9 transition-colors ${
              searching ? 'text-[#025dc7]' : 'text-[#4B5563] hover:text-[#025dc7]'
            }`}
          >
            <Search size={18} />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              aria-label="Opciones del canal"
              title="Opciones del canal"
              className={`inline-flex items-center justify-center w-9 h-9 transition-colors ${
                menuOpen ? 'text-[#025dc7]' : 'text-[#4B5563] hover:text-[#025dc7]'
              }`}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-[#E3E8EF] bg-white py-1 shadow-lg"
              >
                {/* Aquí había también "Buscar en el canal", y la lupa está
                    justo al lado: dos botones para lo mismo, uno de ellos
                    escondido bajo un menú. Fuera. El menú queda para lo que NO
                    tiene botón propio, que es esto. */}
                <button
                  type="button"
                  onClick={() => {
                    if (esMovil) {
                      setFijadosMovil((v) => !v)
                    } else {
                      togglePinned(!pinnedOpen)
                    }
                    setThreadUuid(null)
                    setMenuOpen(false)
                  }}
                  className="w-full text-left px-3.5 py-2 text-[13.5px] text-[#3F4A61] hover:bg-[#F0F5FF] hover:text-[#025dc7] transition-colors flex items-center gap-2.5"
                >
                  <Pin size={15} />
                  {(esMovil ? fijadosMovil : pinnedOpen) ? 'Ocultar los fijados' : 'Ver los fijados'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cuerpo: el chat y, si toca, el panel de la derecha */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <ChannelChat
            communityUuid={community.community_uuid}
            channelName={text}
            threadUuid={threadUuid}
            onOpenThread={setThreadUuid}
            searching={searching}
            onSearchingChange={setSearching}
          />
        </div>

        {/* Móvil: el hilo ocupa la pantalla, que no hay sitio para dos columnas */}
        {threadUuid && (
          <div className="lg:hidden fixed inset-0 z-30 bg-white flex flex-col">
            <ThreadPanel
              communityUuid={community.community_uuid}
              parentUuid={threadUuid}
              onClose={() => setThreadUuid(null)}
            />
          </div>
        )}

        {/* Los fijados en el móvil. Hasta ahora NO SE VEÍAN: el panel de la
            derecha es `hidden lg:flex`, así que por debajo de 1024 px no se
            pintaba, y los mensajes que el equipo fija —los importantes— no
            llegaban a quien entra desde el teléfono, que son casi todos.
            Va como hoja a pantalla completa, igual que los hilos, y solo
            cuando se pide desde el menú: una barra permanente robaría alto en
            la pantalla donde menos sobra. */}
        {fijadosMovil && !threadUuid && (
          <div className="lg:hidden fixed inset-0 z-30 bg-white flex flex-col">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EEF3FB]">
              <div className="flex items-center gap-2">
                <Pin size={16} className="text-[#025dc7]" />
                <h2 className="text-[15px] font-bold text-gray-900">Fijados</h2>
              </div>
              <button
                type="button"
                onClick={() => setFijadosMovil(false)}
                aria-label="Cerrar los fijados"
                className="inline-flex items-center justify-center w-9 h-9 -mr-2 text-[#9CA3AF] hover:text-[#025dc7] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PinnedFeed communityUuid={community.community_uuid} hideHeader />
            </div>
          </div>
        )}

        {sidePanelOpen && (
          <aside className="hidden lg:flex w-[340px] shrink-0 border-l border-[#EEF3FB] flex-col min-h-0">
            {threadUuid ? (
              <ThreadPanel
                communityUuid={community.community_uuid}
                parentUuid={threadUuid}
                onClose={() => setThreadUuid(null)}
              />
            ) : (
              <>
                <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EEF3FB]">
                  <div className="flex items-center gap-2">
                    <Pin size={15} className="text-[#025dc7]" />
                    <h2 className="text-[14px] font-bold text-gray-900">Fijados</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePinned(false)}
                    aria-label="Ocultar los fijados"
                    title="Ocultar los fijados"
                    className="text-[#9CA3AF] hover:text-[#025dc7] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PinnedFeed communityUuid={community.community_uuid} hideHeader />
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export default CommunityClient
