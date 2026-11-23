import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import VerGrabacion from '@components/Pages/Grabaciones/VerGrabacion'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Grabación de la clase' }

/**
 * `/grabacion/<curso>/<clave>`: la grabación de una clase en directo, en su
 * propia página (23/11/2026). Antes, la que es una clase de vídeo se abría
 * «como un curso» y la de la sala, en una ventana. `clave` = `semana-<id>` (lo
 * que grabó la sala o el enlace pegado) o el uuid de la clase de vídeo. Sin
 * sesión, a entrar y de vuelta aquí. El servidor solo da las grabaciones a
 * quien puede ver esa clase.
 */
export default async function Grabacion(props: { params: Promise<{ courseuuid: string; clave: string }> }) {
  const { courseuuid, clave } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent(`/grabacion/${courseuuid}/${clave}`)}`)
  }
  return <VerGrabacion courseuuid={courseuuid} clave={clave} />
}
