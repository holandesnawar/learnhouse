'use client'
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  getNotifications,
  markNotificationsSeen,
  type NotificationFeed,
} from '@services/communities/engagement'
import { Bell, AtSign, Pin, Megaphone, Unlock } from 'lucide-react'

/**
 * Campana del alumno. Recoge lo que se puede perder si no entra ese día:
 * menciones en la comunidad, mensajes fijados como importantes, avisos de la
 * academia y módulos que se le acaban de abrir.
 *
 * Nada de esto manda correo. Abrir la campana apaga el punto rojo, pero NO
 * marca los canales como leídos: el mensaje sigue sin leer hasta que entre.
 */

const KIND_STYLE: Record<string, { icon: any; color: string }> = {
  mention: { icon: AtSign, color: 'text-[#025dc7]' },
  pinned: { icon: Pin, color: 'text-amber-500' },
  announcement: { icon: Megaphone, color: 'text-[#4da3ff]' },
  module: { icon: Unlock, color: 'text-emerald-500' },
}

/** El aviso puede traer una ruta de la academia o una dirección completa. */
function buildHref(orgslug: string, url: string): string {
  if (!url) return getUriWithOrg(orgslug, '/')
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return getUriWithOrg(orgslug, url.startsWith('/') ? url : `/${url}`)
}
export default function NotificationsBell(props: { orgslug: string }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<NotificationFeed>({
    queryKey: ['community', 'notifications'],
    queryFn: () => getNotifications(accessToken),
    enabled: !!accessToken,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const items = data?.items || []
  const unseen = data?.unseen || 0

  // Cerrar al pulsar fuera — en móvil el panel tapa media pantalla.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = async () => {
    const next = !open
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
        onClick={toggle}
        aria-label="Notificaciones"
        title="Notificaciones"
        className="relative p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        <Bell size={19} />
        {unseen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[300px] sm:w-[340px] max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-[#DDE6F5]"
          style={{ zIndex: 'var(--z-modal, 60)' }}
        >
          <div className="px-4 py-3 border-b border-[#EEF2FB]">
            <p className="text-[14px] font-bold text-[#0a1656]">Notificaciones</p>
            <p className="text-[12px] text-gray-500">Lo que ha pasado en la academia</p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={22} className="mx-auto text-[#4da3ff] mb-2" />
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Todavía no hay nada. Aquí te avisamos cuando te mencionen en un
                canal, se fije un mensaje importante, la academia mande un aviso
                o se te abra un módulo nuevo.
              </p>
            </div>
          ) : (
            <ul>
              {items.map((n) => {
                const style = KIND_STYLE[n.kind] || KIND_STYLE.mention
                const Icon = style.icon
                return (
                  <li key={n.id} className="border-b border-[#F3F6FC] last:border-0">
                    <Link
                      href={buildHref(props.orgslug, n.url)}
                      onClick={() => setOpen(false)}
                      className={`flex gap-3 px-4 py-3 hover:bg-[#F7FAFF] transition-colors ${
                        n.is_new ? 'bg-[#F0F5FF]' : ''
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 ${style.color}`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-bold text-[#0a1656] leading-snug">
                          {n.title}
                        </span>
                        {n.excerpt && (
                          <span className="block mt-0.5 text-[13px] text-gray-600 leading-snug line-clamp-2">
                            {n.excerpt}
                          </span>
                        )}
                        <span className="block mt-1 text-[11.5px] text-gray-400">
                          {formatWhen(n.date)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
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
