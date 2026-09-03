'use client'

import { useEffect } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { setUsuarioRepaso } from '@/lib/exercises-app/progress'

/**
 * Ata el progreso de Repasar al usuario que está dentro.
 *
 * El progreso de repaso vive en el navegador, no en el servidor, y hasta ahora
 * usaba UNA sola clave: dos cuentas en el mismo ordenador compartían progreso.
 * Se entraba con una cuenta nueva y las lecciones ya salían repasadas.
 *
 * Va en el layout de la escuela y no en cada pantalla a propósito: puesto en
 * una pantalla suelta, la primera que se olvide vuelve a mezclar cuentas sin
 * que nadie se entere.
 */
export default function AmbitoRepaso() {
  const session = useLHSession() as any
  const userId = session?.data?.user?.id ?? session?.data?.user?.user_uuid ?? null

  useEffect(() => {
    setUsuarioRepaso(userId)
  }, [userId])

  return null
}
