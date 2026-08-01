'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getUnreadMessages } from '@services/messages/direct'
import { Mail } from 'lucide-react'

/**
 * El sobre del menú: mensajes directos sin leer.
 *
 * Es un enlace, no un desplegable: la conversación se lee en su página. La
 * primera consulta también crea la conversación del alumno en el servidor, con
 * la bienvenida dentro — por eso el punto se enciende sin que nadie escriba.
 */
export default function MessagesBell(props: { orgslug: string }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  const { data: unread } = useQuery<number>({
    queryKey: ['messages', 'unread'],
    queryFn: () => getUnreadMessages(accessToken),
    enabled: !!accessToken,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  if (!accessToken) return null

  return (
    <Link
      href={getUriWithOrg(props.orgslug, '/mensajes')}
      aria-label="Mensajes"
      title="Mensajes"
      className="relative p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors inline-flex"
    >
      <Mail size={19} />
      {!!unread && unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
