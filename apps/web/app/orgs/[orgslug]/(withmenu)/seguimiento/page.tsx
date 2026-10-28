import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import SeguimientoEscuela from '@components/Pages/Tareas/SeguimientoEscuela'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Seguimiento semanal' }

/**
 * `/seguimiento`: el seguimiento semanal y las tareas por corregir, para el
 * equipo desde la escuela (los profes no entran al panel). Lo mismo que el
 * administrador ve en Panel → Alumnos → Seguimiento semanal.
 */
export default async function Seguimiento() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/seguimiento')}`)
  }
  return <SeguimientoEscuela />
}
