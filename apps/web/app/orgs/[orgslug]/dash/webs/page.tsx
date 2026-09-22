import React from 'react'
import type { Metadata } from 'next'
import WebsPage from '@components/Dashboard/Pages/Webs/WebsPage'

export const metadata: Metadata = {
  title: 'Webs',
}

export default function WebsDashPage() {
  return <WebsPage />
}
