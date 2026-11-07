import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { ClasesEstaSemana } from '@components/Pages/Clases/MisClasesAlumno'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Esta semana' }

/** `/clases`: «Mis clases» del alumno (rediseño, rama diseno). */
export default async function Pagina() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/clases')}`)
  }
  return <ClasesEstaSemana />
}
