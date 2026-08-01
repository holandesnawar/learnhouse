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
import { Bell, AtSign } from 'lucide-react'

/**
 * Campana del alumno: cuando alguien le menciona en la comunidad (@su-nombre
 * o @all), aquí lo ve aunque no entre al canal.
 *
 * Abrir la campana apaga el punto rojo, pero NO marca los canales como leídos:
 * el mensaje sigue contando como sin leer hasta que entre de verdad.
 */
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
            <p className="text-[12px] text-gray-500">Cuando te mencionan en la comunidad</p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <AtSign size={22} className="mx-auto text-[#4da3ff] mb-2" />
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Aún no te ha mencionado nadie. Cuando alguien escriba tu nombre
                con @ en un canal, te aparecerá aquí.
              </p>
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.discussion_uuid} className="border-b border-[#F3F6FC] last:border-0">
                  <Link
                    href={getUriWithOrg(props.orgslug, `/community/${n.community_uuid}`)}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-[#F7FAFF] transition-colors ${
                      n.is_new ? 'bg-[#F0F5FF]' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#025dc7]">
                      <AtSign size={13} />
                      {n.author_name}
                      <span className="font-normal text-gray-400">· {n.community_name}</span>
                    </span>
                    <span className="block mt-1 text-[13px] text-gray-700 leading-snug line-clamp-3">
                      {n.excerpt || 'Te ha mencionado'}
                    </span>
                    <span className="block mt-1 text-[11.5px] text-gray-400">
                      {formatWhen(n.date)}
                    </span>
                  </Link>
                </li>
              ))}
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
