'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { avisarPantallaRota } from '@/lib/nawar/avisarFallo'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
    // Que la escuela se entere (Panel → Estado). Nunca lanza.
    avisarPantallaRota(error, 'pagina')
  }, [error])

  return (
    <div>
      
    </div>
  )
}
