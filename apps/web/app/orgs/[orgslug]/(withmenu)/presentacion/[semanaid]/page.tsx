import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import VerPresentacion from '@components/Pages/Presentaciones/VerPresentacion'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Presentación de la clase' }

/**
 * `/presentacion/<semana>`: la presentación de una clase en directo, en su
 * propia página (22/11/2026). Antes se abría «como un curso» (barra de
 * capítulos, «46 % completado», «Anterior / Siguiente»). Sin sesión, a entrar
 * y de vuelta aquí. El servidor solo se la da a quien puede ver esa clase.
 */
export default async function Presentacion(props: { params: Promise<{ semanaid: string }> }) {
  const { semanaid } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent(`/presentacion/${semanaid}`)}`)
  }
  return <VerPresentacion semanaId={semanaid} />
}
