import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import SalaProfes from '@components/Pages/Equipo/SalaProfes'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Sala de profes' }

/**
 * `/equipo`: la sala de profes (08/11/2026). Es también el Inicio del equipo;
 * esta dirección sirve para enlazar una pestaña (`?vista=tareas`, `manual`…).
 * El servidor solo deja ver sus datos al equipo de clases.
 */
export default async function Equipo() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/equipo')}`)
  }
  return <SalaProfes />
}
