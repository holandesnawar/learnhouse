import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import GrabacionesEscuela from '@components/Pages/Grabaciones/GrabacionesEscuela'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Grabaciones de las clases' }

/**
 * `/grabaciones`: lo que ha grabado la sala de cada clase en directo, para
 * recortarlo y publicarlo en su semana (10/11/2026). Para el equipo (también
 * los profes, que no entran al panel). `?clase=<uuid>` abre esa clase.
 */
export default async function Grabaciones() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/grabaciones')}`)
  }
  return <GrabacionesEscuela />
}
