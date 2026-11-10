import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import PizarraClase from '@components/Pages/Pizarra/PizarraClase'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pizarra de clase' }

/**
 * `/pizarra/<semana>`: la pizarra de clase (10/11/2026). El profe abre aquí la
 * presentación de esa semana, escribe encima mientras comparte pantalla y la
 * guarda para los alumnos. El servidor solo deja entrar al equipo.
 */
export default async function Pizarra(props: { params: Promise<{ semanaid: string }> }) {
  const { semanaid } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent(`/pizarra/${semanaid}`)}`)
  }
  return <PizarraClase semanaId={semanaid} />
}
