import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import ResenaPage from '@components/Pages/Resena/ResenaPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tu opinión en vídeo' }

/**
 * `/resena`: el alumno invitado graba su reseña en vídeo sin salir de la
 * escuela (10/11/2026). Las invitaciones se mandan desde Panel → Reseñas.
 */
export default async function Pagina() {
  const session = await getServerSession()
  if (!session?.tokens?.access_token) {
    redirect(`/login?redirect=${encodeURIComponent('/resena')}`)
  }
  return <ResenaPage />
}
