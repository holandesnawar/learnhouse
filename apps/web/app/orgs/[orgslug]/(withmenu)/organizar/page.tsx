import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import OrganizarPage from '@components/Pages/Organizar/OrganizarPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Organizar clases' }

/** `/organizar`: la parte académica en un sitio (rediseño, rama diseno). */
export default async function Pagina() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/organizar')}`)
  }
  return <OrganizarPage />
}
