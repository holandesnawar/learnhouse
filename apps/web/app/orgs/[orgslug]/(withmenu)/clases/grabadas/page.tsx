import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { ClasesGrabadas } from '@components/Pages/Clases/MisClasesAlumno'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Clases grabadas' }

/** `/clases/grabadas`: «Mis clases» del alumno (rediseño, rama diseno). */
export default async function Pagina() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/clases/grabadas')}`)
  }
  return <ClasesGrabadas />
}
