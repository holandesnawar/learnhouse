import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import MisClasesEscuela from '@components/Pages/Profes/MisClasesEscuela'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mis clases' }

/**
 * `/mis-clases`: el tablero de los profes (04/11/2026). Sus próximas clases
 * con la presentación, lo que falta por preparar y los recursos. Lo ve todo el
 * equipo; el administrador lo tiene también en el panel.
 */
export default async function MisClases() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/mis-clases')}`)
  }
  return <MisClasesEscuela />
}
