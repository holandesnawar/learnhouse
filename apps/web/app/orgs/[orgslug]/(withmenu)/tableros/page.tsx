import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import TablerosPage from '@components/Pages/Produccion/TablerosPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tableros de la formación' }

/**
 * `/tableros`: los tableros de producción de la formación (19/11/2026), como
 * el Deck de Nextcloud, separados por curso. Para el equipo; la API comprueba
 * quién entra. `?t=<id>` abre ese tablero; `?ver=proximas`, las próximas.
 */
export default async function Tableros() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/tableros')}`)
  }
  return <TablerosPage />
}
