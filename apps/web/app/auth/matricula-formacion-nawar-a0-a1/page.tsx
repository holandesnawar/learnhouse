import type { Metadata } from 'next'
import MatriculaClient from './matricula'

export const metadata: Metadata = {
  title: 'Matrícula — Formación Nawar A0-A1',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function MatriculaPage() {
  return <MatriculaClient />
}
