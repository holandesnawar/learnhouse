'use client'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  dismissNotification,
  getNotifications,
  markNotificationsSeen,
  type NotificationFeed,
} from '@services/communities/engagement'
import { Bell, AtSign, Pin, Megaphone, Unlock, Trash2, MessagesSquare, UserCheck, Mic, ClipboardCheck, PhoneCall, Presentation, PlayCircle } from 'lucide-react'

/**
 * Campana del alumno. Recoge lo que se puede perder si no entra ese día:
 * menciones en la comunidad, cuántos mensajes nuevos hay en cada canal, avisos
 * de la escuela y módulos que se le acaban de abrir.
 *
 * Nada de esto manda correo. Abrir la campana apaga el punto rojo, pero NO
 * marca los canales como leídos: el mensaje sigue sin leer hasta que entre.
 */

// `pinned` ya no lo manda el backend: los "Mensaje importante en …" se
// cambiaron por el recuento de mensajes nuevos de cada canal. Se deja la
// entrada por si queda alguno servido por una versión anterior mientras el
// despliegue termina — un aviso sin icono se vería roto.
const KIND_STYLE: Record<string, { icon: any; color: string }> = {
  mention: { icon: AtSign, color: 'text-[#0b2da0]' },
  channel: { icon: MessagesSquare, color: 'text-[#0b2da0]' },
  pinned: { icon: Pin, color: 'text-[#0b2da0]' },
  announcement: { icon: Megaphone, color: 'text-[#0b2da0]' },
  module: { icon: Unlock, color: 'text-emerald-500' },
  // Solo administradores: un alumno que ha pagado espera que se elija si va al
  // programa nuevo o a la beta (Tandas y grupos).
  decidir: { icon: UserCheck, color: 'text-[#0b2da0]' },
  // Las tareas de las clases (28/10): al alumno, la presentación nueva de su
  // clase y su corrección; al equipo, lo que queda por corregir y los
  // check-in de la semana.
  semana: { icon: Presentation, color: 'text-[#0b2da0]' },
  // La grabación de su clase, ya subida (05/11).
  grabacion: { icon: PlayCircle, color: 'text-[#0b2da0]' },
  // «Avisar a la clase» desde una semana (06/11/2026).
  clase: { icon: Megaphone, color: 'text-[#0b2da0]' },
  tarea: { icon: Mic, color: 'text-emerald-500' },
  corregir: { icon: ClipboardCheck, color: 'text-[#0b2da0]' },
  checkin: { icon: PhoneCall, color: 'text-[#0b2da0]' },
}

/** El aviso puede traer una ruta de la escuela o una dirección completa. */
function buildHref(orgslug: string, url: string): string {
  if (!url) return getUriWithOrg(orgslug, '/')
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return getUriWithOrg(orgslug, url.startsWith('/') ? url : `/${url}`)
}
export default function NotificationsBell(props: { orgslug: string; claro?: boolean }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // Quitadas en esta pantalla: se ocultan sin esperar al servidor.
  const [hidden, setHidden] = useState<string[]>([])
  const [filtro, setFiltro] = useState<'todas' | 'nuevas'>('todas')
  const boxRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // El panel se coloca a mano (position: fixed) en vez de colgar del botón:
  // la campana vive dentro de la barra lateral (256 px), así que un panel de
  // 340 px anclado a la derecha se salía de la pantalla por la izquierda.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const { data } = useQuery<NotificationFeed>({
    queryKey: ['community', 'notifications'],
    queryFn: () => getNotifications(accessToken),
    enabled: !!accessToken,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const items = (data?.items || []).filter((n) => !hidden.includes(n.id))
  const lista = filtro === 'nuevas' ? items.filter((n) => n.is_new) : items
  const unseen = data?.unseen || 0

  /** Debajo de la campana, pegado a su derecha y siempre dentro de la pantalla. */
  const place = React.useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const margin = 12
    const width = Math.min(360, window.innerWidth - margin * 2)
    const left = Math.min(
      Math.max(margin, r.right - width),
      window.innerWidth - width - margin
    )
    setPos({ top: r.bottom + 8, left, width })
  }, [])

  // Cerrar al pulsar fuera — en móvil el panel tapa media pantalla.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (boxRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onMove = () => place()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, place])

  /** Quitar una: desaparece al instante y se guarda para que no vuelva. */
  const dismiss = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setHidden((cur) => [...cur, id])
    await dismissNotification(id, accessToken)
    queryClient.invalidateQueries({ queryKey: ['community', 'notifications'] })
  }

  const toggle = async () => {
    const next = !open
    if (next) place()
    setOpen(next)
    if (next && unseen > 0) {
      await markNotificationsSeen(accessToken)
      queryClient.invalidateQueries({ queryKey: ['community', 'notifications'] })
    }
  }

  if (!accessToken) return null

  return (
    <div className="relative" ref={boxRef}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Notificaciones"
        title="Notificaciones"
        className={`relative p-1.5 rounded-lg transition-colors ${props.claro ? 'text-[#3B4262] hover:text-[#0B1033] hover:bg-[#F2F5FB]' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
      >
        <Bell size={19} />
        {unseen > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 ring-2 ${props.claro ? 'ring-white' : 'ring-[#0b2da0]'} text-white text-[10px] font-bold flex items-center justify-center`}>
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {/* El panel se cuelga del <body>: dentro de la barra lateral (que es
          sticky, y por tanto su propio contexto de apilado) quedaba POR DETRÁS
          de las tarjetas del Inicio por mucho z-index que le pusiéramos. */}
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="lh-thin-scroll fixed overflow-y-auto bg-white rounded-xl shadow-[0_12px_40px_rgba(10,22,86,0.16)] border border-[#E4E8F2]"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: `calc(100vh - ${pos.top + 16}px)`,
            zIndex: 'var(--z-modal-content, 220)',
          }}
        >
          <div className="px-4 pt-3.5 pb-2 border-b border-[#EEF1F7]">
            <p className="text-[15px] font-bold text-[#0B1033]">Notificaciones</p>
            <div className="mt-2 flex gap-1">
              {(['todas', 'nuevas'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`h-7 px-2.5 rounded-md text-[12.5px] font-semibold ${filtro === f ? 'bg-[#EAF0FE] text-[#0b2da0]' : 'text-[#6B7393] hover:bg-[#F2F5FB]'}`}
                >
                  {f === 'todas' ? 'Todas' : 'Sin leer'}
                </button>
              ))}
            </div>
          </div>

          {lista.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13.5px] text-[#6B7393] leading-relaxed">
                {filtro === 'nuevas' ? 'No tienes nada sin leer.' : 'Todavía no hay nada. Aquí te avisamos de mensajes nuevos, menciones, avisos de la escuela y módulos que se abren.'}
              </p>
            </div>
          ) : (
            <ul>
              {lista.map((n) => {
                const style = KIND_STYLE[n.kind] || KIND_STYLE.mention
                const Icon = style.icon
                return (
                  <li key={n.id} className="group/notif relative border-b border-[#F3F6FC] last:border-0">
                    {/* Papelera: quitar esta novedad de la lista */}
                    <button
                      type="button"
                      onClick={(e) => dismiss(e, n.id)}
                      title="Quitar de las notificaciones"
                      aria-label="Quitar de las notificaciones"
                      className="absolute top-2 right-2 z-10 w-7 h-7 inline-flex items-center justify-center rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-100 sm:opacity-0 sm:group-hover/notif:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                    <Link
                      href={buildHref(props.orgslug, n.url)}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 pl-4 pr-10 py-3 hover:bg-[#F7F9FD] transition-colors"
                    >
                      <span className="mt-0.5 w-6 flex justify-center shrink-0 text-[#6B7393]">
                        <Icon size={20} strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13.5px] leading-snug ${n.is_new ? 'font-semibold text-[#0B1033]' : 'font-medium text-[#3B4262]'}`}>
                          {n.title}
                        </span>
                        {n.excerpt && (
                          <span className="block mt-0.5 text-[13px] text-[#6B7393] leading-snug line-clamp-2">
                            {n.excerpt}
                          </span>
                        )}
                        <span className="block mt-1 text-[12px] text-[#A3AAC2]">
                          {formatWhen(n.date)}
                        </span>
                      </span>
                      {n.is_new ? <span className="mt-2 w-2 h-2 rounded-full bg-[#0b2da0] shrink-0" aria-label="Sin leer" /> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

/** "hace 3 h", "ayer", o la fecha corta. */
function formatWhen(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
