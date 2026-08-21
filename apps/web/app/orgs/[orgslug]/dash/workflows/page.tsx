import React from 'react'
import type { Metadata } from 'next'
import WorkflowsPage from '@components/Dashboard/Pages/Workflows/WorkflowsPage'

export const metadata: Metadata = {
  title: 'Automatizaciones',
}

export default function DashWorkflowsPage() {
  return <WorkflowsPage />
}
