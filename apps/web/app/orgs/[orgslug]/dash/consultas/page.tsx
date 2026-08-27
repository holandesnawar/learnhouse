import React from 'react'
import type { Metadata } from 'next'
import ConsultasAdminPage from '@components/Dashboard/Pages/Consultas/ConsultasAdminPage'

export const metadata: Metadata = {
  title: 'Consultas',
}

export default function DashConsultasPage() {
  return <ConsultasAdminPage />
}
