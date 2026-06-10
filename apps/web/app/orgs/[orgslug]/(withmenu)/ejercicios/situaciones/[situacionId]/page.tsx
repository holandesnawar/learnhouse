import { notFound } from 'next/navigation'
import SituacionViewer from '@components/exercises-app/SituacionViewer'
import { getSituacion } from '@/lib/exercises-app/situaciones'

export default async function SituacionPage({
  params,
}: {
  params: Promise<{ orgslug: string; situacionId: string }>
}) {
  const { orgslug, situacionId } = await params
  const situacion = getSituacion(situacionId)
  if (!situacion) notFound()

  return (
    <main className="min-h-screen">
      <SituacionViewer situacion={situacion} orgslug={orgslug} />
    </main>
  )
}
