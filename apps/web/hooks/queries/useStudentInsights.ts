'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getStudentInsights } from '@services/student/insights'

/**
 * Insights del alumno con caché: la primera visita hace la llamada; al volver
 * al Inicio (o a Progreso) los datos aparecen AL INSTANTE desde la caché y se
 * refrescan en segundo plano. Adiós al spinner en cada navegación.
 */
export function useStudentInsights() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: ['student', 'insights'],
    queryFn: () => getStudentInsights(accessToken),
    enabled: !!accessToken,
    staleTime: 60_000,
    // Mantén los datos anteriores visibles mientras se refresca.
    placeholderData: (prev: any) => prev,
  })
}
