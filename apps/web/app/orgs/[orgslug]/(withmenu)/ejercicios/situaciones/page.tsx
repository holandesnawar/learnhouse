import SituacionesLibrary from '@components/exercises-app/SituacionesLibrary'

export default async function SituacionesPage({
  params,
}: {
  params: Promise<{ orgslug: string }>
}) {
  const { orgslug } = await params
  return (
    <main className="min-h-screen">
      <SituacionesLibrary orgslug={orgslug} />
    </main>
  )
}
