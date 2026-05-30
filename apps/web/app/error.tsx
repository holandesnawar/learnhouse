'use client'

import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)

    if (
      error.message.includes('Failed to find Server Action') ||
      error.message.includes('older or newer deployment')
    ) {
      window.location.reload()
    }
  }, [error])

  return <ErrorUI />
}
