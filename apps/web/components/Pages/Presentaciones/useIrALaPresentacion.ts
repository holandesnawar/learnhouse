'use client'
/**
 * La dirección vieja de la presentación de una clase en directo
 * (`/course/<curso>/activity/<clase PDF>`: avisos ya enviados, enlaces
 * guardados) lleva a su página nueva, `/presentacion/<semana>` (22/11/2026).
 * Solo si esa clase PDF es la presentación de una semana de una clase en
 * directo: en la formación (los Werkboek…) no cambia nada.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useSemanasClase } from '@components/Pages/Courses/SemanasClase'
import { getUriWithOrg } from '@services/config/config'
import { esCursoEnDirecto } from '@/lib/nawar/cursos'

export function useIrALaPresentacion(courseUuid: string | undefined, activity: any, orgslug: string) {
  const org = useOrg() as any
  const router = useRouter()
  const esPdf = activity?.activity_type === 'TYPE_DOCUMENT' && activity?.activity_sub_type === 'SUBTYPE_DOCUMENT_PDF'
  const directo = !!courseUuid && esPdf && esCursoEnDirecto(courseUuid, org?.config?.config)
  const { data } = useSemanasClase(courseUuid || '', directo)
  const uuid: string = activity?.activity_uuid || ''
  useEffect(() => {
    if (!directo || !data || !uuid) return
    const semana = (data.semanas || []).find((s) => (s.clases || []).some((c) => c.tipo === 'presentacion' && c.activity_uuid === uuid))
    if (semana) router.replace(getUriWithOrg(orgslug, `/presentacion/${semana.id}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directo, data, uuid, orgslug])
}
