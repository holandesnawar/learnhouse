import React from 'react'
import type { Metadata } from 'next'
import AvisosTabs from '@components/Dashboard/Pages/Avisos/AvisosTabs'

export const metadata: Metadata = {
  title: 'Avisos',
}

export default function AvisosPage() {
  return <AvisosTabs />
}
