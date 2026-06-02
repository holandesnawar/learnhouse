import type { Metadata } from 'next'
import PagoClient from './pago'

export const metadata: Metadata = {
  title: 'Pago — Formación Nawar A0-A1',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function PagoPage() {
  return <PagoClient />
}
