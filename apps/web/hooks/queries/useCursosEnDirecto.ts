'use client'
import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getOrgCourses } from '@services/courses/courses'
import { cursosEnDirecto, type CursoEnDirecto } from '@/lib/nawar/cursos'

/**
 * Las clases en directo que ve este alumno (25/10/2026, la beta y el programa
 * nuevo): la clase semanal para unos, la masterclass y los spreekuren para
 * otros. Sale de la lista de cursos del servidor, que ya filtra por grupos.
 */
export function useCursosEnDirecto() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<CursoEnDirecto[]>({
    queryKey: ['cursos', 'en-directo', org?.slug],
    queryFn: async () => cursosEnDirecto(await getOrgCourses(org.slug, null, accessToken)),
    enabled: !!org?.slug && !!accessToken,
    staleTime: 5 * 60_000,
  })
}
