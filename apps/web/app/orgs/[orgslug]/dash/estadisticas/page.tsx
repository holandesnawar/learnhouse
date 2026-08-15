import React from 'react'
import type { Metadata } from 'next'
import EstadisticasPage from '@components/Dashboard/Pages/Estadisticas/EstadisticasPage'

export const metadata: Metadata = {
  title: 'Estadísticas',
}

export default function DashEstadisticasPage() {
  return <EstadisticasPage />
}
