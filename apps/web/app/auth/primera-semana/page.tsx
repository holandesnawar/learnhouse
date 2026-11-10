import type { Metadata } from 'next'
import { Suspense } from 'react'
import PrimeraSemana from './primera-semana'

export const metadata: Metadata = {
  title: 'Mijn eerste week · Tu primera semana en neerlandés | Holandés Nawar',
  description: 'Siete días, diez minutos al día, con las frases de tu vida y tus datos ya puestos. Gratis.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * «Mijn eerste week» (10/11/2026): el reto personalizado de 7 días. Vive bajo
 * /auth porque ahí las páginas se ven sin sesión (ver CLAUDE.md, el middleware
 * de /auth/*). Todo lo demás, en `primera-semana.tsx` y, en el servidor,
 * `apps/api/src/services/reto/reto.py`.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PrimeraSemana />
    </Suspense>
  )
}
