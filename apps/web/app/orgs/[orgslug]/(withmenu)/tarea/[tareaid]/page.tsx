import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import TareaPage from '@components/Pages/Tareas/TareaPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tarea' }

/**
 * `/tarea/<id>`: la tarea de una semana de la clase, para entregarla con texto
 * y nota de voz, y ver la corrección. Sin sesión, a entrar y de vuelta aquí.
 */
export default async function Tarea(props: { params: Promise<{ tareaid: string }> }) {
  const { tareaid } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent(`/tarea/${tareaid}`)}`)
  }
  return <TareaPage tareaId={tareaid} />
}
