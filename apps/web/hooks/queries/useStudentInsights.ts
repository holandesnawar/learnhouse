'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getStudentInsights } from '@services/student/insights'
import { onAttemptSaved } from '@/lib/exercises-app/lastAttempts'

/**
 * Insights del alumno con caché: la primera visita hace la llamada; al volver
 * al Inicio (o a Progreso) los datos aparecen AL INSTANTE desde la caché y se
 * refrescan en segundo plano. Adiós al spinner en cada navegación.
 */
export function useStudentInsights() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  // Cada intento guardado (nota de una sección, repaso…) invalida la caché:
  // la próxima vista de Inicio/Progreso trae la versión recién corregida.
  useEffect(() => {
    return onAttemptSaved(() => {
      queryClient.invalidateQueries({ queryKey: ['student', 'insights'] })
    })
  }, [queryClient])

  return useQuery({
    queryKey: ['student', 'insights'],
    queryFn: () => getStudentInsights(accessToken),
    enabled: !!accessToken,
    // La caché pinta AL INSTANTE, pero siempre se refresca en segundo plano al
    // entrar — así "Mi progreso" nunca enseña una versión vieja de tus notas.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Mantén los datos anteriores visibles mientras se refresca.
    placeholderData: (prev: any) => prev,
  })
}
