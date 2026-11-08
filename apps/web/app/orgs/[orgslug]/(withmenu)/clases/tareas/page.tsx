import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { IrAMiClase } from '@components/Pages/Clases/MisClasesAlumno'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tareas' }

/** `/clases/tareas`: «Mis clases» del alumno (rediseño, rama diseno). */
export default async function Pagina() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/clases/tareas')}`)
  }
  return <IrAMiClase />
}
