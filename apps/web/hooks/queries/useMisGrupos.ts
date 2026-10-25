'use client'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getMisGrupos } from '@services/student/grupos'
import type { MisGrupos } from '@/lib/nawar/eventosGrupo'

/** En qué grupos estoy (para los eventos de cada grupo). */
export function useMisGrupos() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  return useQuery<MisGrupos>({
    queryKey: ['student', 'mis-grupos'],
    queryFn: () => getMisGrupos(accessToken),
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  })
}
