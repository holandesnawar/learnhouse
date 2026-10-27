import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import SalaPage from '@components/Pages/Sala/SalaPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Sala en directo' }

/**
 * `/sala/<curso>`: la videollamada de ese curso, dentro de la escuela (Daily).
 * Sin sesión, a entrar y de vuelta aquí (lo de `lib/auth/volver.ts`).
 */
export default async function Sala(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent(`/sala/${courseuuid}`)}`)
  }
  return <SalaPage courseUuid={courseuuid} />
}
