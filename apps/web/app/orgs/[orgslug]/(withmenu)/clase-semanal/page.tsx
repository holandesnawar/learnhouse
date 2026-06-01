import type { Metadata } from 'next'
import ClaseSemanalClient from './ClaseSemanalClient'

export const metadata: Metadata = {
  title: 'Clase semanal — Holandés Nawar',
  description:
    'Encuentro semanal en directo con Nawar para resolver dudas, repasar lecciones y avanzar juntos. Las clases se graban y quedan guardadas en la plataforma.',
}

export default async function Page({ params }: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await params
  return <ClaseSemanalClient orgslug={orgslug} />
}
