'use client'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUnread, type UnreadCount } from '@services/communities/engagement'

/**
 * Mensajes de comunidad sin leer. Se refresca cada 30 s y al volver a la
 * pestaña: es lo que enciende el punto rojo del menú.
 */
export function useUnreadCommunity() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<UnreadCount[]>({
    queryKey: ['community', 'unread'],
    queryFn: () => getUnread(accessToken),
    enabled: !!accessToken,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}
