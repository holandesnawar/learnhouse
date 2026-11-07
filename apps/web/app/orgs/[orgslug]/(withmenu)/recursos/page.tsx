import type { Metadata } from 'next'
import RecursosPage from '@components/Pages/Recursos/RecursosPage'

export const metadata: Metadata = {
  title: 'Recursos',
}

export default function RecursosRoute() {
  return <RecursosPage />
}
