'use client'
/**
 * La dirección vieja de una grabación de una clase en directo
 * (`/course/<curso>/activity/<clase de vídeo>`: avisos ya enviados, enlaces
 * guardados) lleva a su página nueva, `/grabacion/<curso>/<clase>`
 * (23/11/2026). Solo si esa clase es una grabación de una clase en directo
 * que la escuela sabe reproducir: en la formación no cambia nada.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useSemanasClase } from '@components/Pages/Courses/SemanasClase'
import { getUriWithOrg } from '@services/config/config'
import { esCursoEnDirecto } from '@/lib/nawar/cursos'
import { claveDeLaVieja, rutaGrabacion } from '@/lib/nawar/verGrabacion'

export function useIrALaGrabacion(courseUuid: string | undefined, activity: any, orgslug: string) {
  const org = useOrg() as any
  const router = useRouter()
  const esPdf = activity?.activity_type === 'TYPE_DOCUMENT'
  const directo = !!courseUuid && !!activity?.activity_uuid && !esPdf && esCursoEnDirecto(courseUuid, org?.config?.config)
  const { data } = useSemanasClase(courseUuid || '', directo)
  const uuid: string = activity?.activity_uuid || ''
  useEffect(() => {
    if (!directo || !data || !uuid || !courseUuid) return
    const clave = claveDeLaVieja(data, uuid)
    if (clave) router.replace(getUriWithOrg(orgslug, rutaGrabacion(courseUuid, clave)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directo, data, uuid, orgslug])
}
