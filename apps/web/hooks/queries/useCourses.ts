'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getOrgCourses, getCourseMetadata } from '@services/courses/courses'

export function useCourses(orgSlug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.list(orgSlug),
    queryFn: () => getOrgCourses(orgSlug, {}, accessToken),
    // Esperar a que la sesión esté resuelta: si no, la primera petición sale
    // SIN token, se cachea la respuesta anónima bajo la misma clave y ya no se
    // vuelve a pedir con el usuario ya identificado.
    enabled: !!orgSlug && session.status !== 'loading',
    staleTime: 60_000,
  })
}

export function useCourseMeta(courseUuid: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.meta(courseUuid),
    queryFn: () => getCourseMetadata(courseUuid, {}, accessToken, { slim: true }),
    enabled: !!courseUuid,
    staleTime: 60_000,
  })
}
