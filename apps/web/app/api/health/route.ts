export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'

// Salud de la web (Next.js, puerto 8000). Es la ruta que se puede poner en
// Railway → Settings → Deploy → Healthcheck Path (`/api/health`): Railway
// comprueba el puerto de `PORT` (8000), donde `/api/v1/health` NO existe
// (esa es de la API, detrás de nginx en el 80). El middleware (`proxy.ts`) no
// toca `/api/*`, así que esta respuesta sale tal cual. Sin caché, para que
// cada comprobación pregunte de verdad.
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}
