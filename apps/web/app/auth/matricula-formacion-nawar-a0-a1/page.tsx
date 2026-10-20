import type { Metadata } from 'next'
import CheckoutClient from './checkout'
import ElegirPlazos from './elegir'
import MatriculaClient from './matricula'

export const metadata: Metadata = {
  title: 'Matrícula — Formación Nawar A0-A1',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// Two-step flow lives on one route so the page is always served by Next
// (new auth subpaths kept 404ing in the Railway image even after
// cache-bumps). When the backend has redirected back with the Stripe
// client_secret + publishable_key, we mount the embedded checkout;
// otherwise we show the matricula form.
export default async function MatriculaPage({
  searchParams,
}: {
  searchParams: Promise<{ cs?: string; pk?: string; ei?: string; elegir?: string; t?: string }>
}) {
  const params = await searchParams
  // El enlace «A plazos» del equipo: primero se elige 3 o 4 pagos (elegir.tsx).
  if (params.elegir === 'plazos' && params.t) {
    return <ElegirPlazos />
  }
  if (params.cs && params.pk) {
    return <CheckoutClient />
  }
  return <MatriculaClient />
}
