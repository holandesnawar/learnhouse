import React from 'react'
import type { Metadata } from 'next'
import MyCertificatePage from '@components/Pages/Certificate/MyCertificatePage'

export const metadata: Metadata = {
  title: 'Tu certificado',
}

interface PageProps {
  params: Promise<{ orgslug: string; uuid: string }>
}

export default async function CertificatePage({ params }: PageProps) {
  const { orgslug, uuid } = await params
  return <MyCertificatePage orgslug={orgslug} uuid={uuid} />
}
