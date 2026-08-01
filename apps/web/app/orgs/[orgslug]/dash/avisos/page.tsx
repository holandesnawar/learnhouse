import React from 'react'
import type { Metadata } from 'next'
import AvisosComposer from '@components/Dashboard/Pages/Avisos/AvisosComposer'

export const metadata: Metadata = {
  title: 'Avisos',
}

export default function AvisosPage() {
  return <AvisosComposer />
}
