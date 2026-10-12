import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { getCourseMetadata } from '@services/courses/courses'
import { CURSO_FORMACION_UUID, RUTA_FORMACION } from '@/lib/nawar/cursos'
import { claseDeLaLeccion } from '@/lib/nawar/leccionEnElCurso'

export const dynamic = 'force-dynamic'

/**
 * `/leccion/<lección>/<parte>` → la clase de esa lección dentro de la
 * formación. Es la dirección de los QR del Werkboek: no cambia aunque se
 * rehagan las clases en el panel (por qué, en `lib/nawar/leccionEnElCurso.ts`).
 */
export default async function LeccionPage(props: {
  params: Promise<{ lessonId: string; parte?: string[] }>
}) {
  const { lessonId, parte } = await props.params
  const session = await getServerSession()
  const token = session?.tokens?.access_token

  if (!token) {
    const aqui = `/leccion/${encodeURIComponent(lessonId)}${parte?.[0] ? `/${encodeURIComponent(parte[0])}` : ''}`
    redirect(`/login?redirect=${encodeURIComponent(aqui)}`)
  }

  let clase: string | null = null
  try {
    const curso = await getCourseMetadata(CURSO_FORMACION_UUID, null, token)
    clase = claseDeLaLeccion(curso, lessonId, parte?.[0])
  } catch {
    clase = null
  }

  // Si no se encuentra (o el curso no carga), a la portada de la formación:
  // mejor eso que un error con el cuaderno en la mano.
  redirect(clase ? `${RUTA_FORMACION}/activity/${clase}` : RUTA_FORMACION)
}
