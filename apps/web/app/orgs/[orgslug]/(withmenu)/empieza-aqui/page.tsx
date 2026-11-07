import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import EmpiezaAqui from '@components/Pages/EmpiezaAqui/EmpiezaAqui'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Empieza aquí' }

/** `/empieza-aqui`: la bienvenida con los primeros pasos (rediseño, rama diseno). */
export default async function Pagina(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/empieza-aqui')}`)
  }
  return <EmpiezaAqui orgslug={orgslug} />
}
