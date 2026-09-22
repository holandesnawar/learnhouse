import React from 'react'
import type { Metadata } from 'next'
import RecursosAdmin from '@components/Dashboard/Pages/Recursos/RecursosAdmin'

export const metadata: Metadata = {
  title: 'Recursos',
}

export default function RecursosDashPage() {
  return <RecursosAdmin />
}
