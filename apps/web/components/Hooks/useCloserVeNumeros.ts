'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'

/**
 * ¿Le ha abierto el administrador los Números al closer? (Panel → Contactos →
 * "Qué ve el closer"). Lo usan las barras del panel para decidir si el closer
 * ve la entrada "Estadísticas". El servidor lo exige igual: esto solo evita
 * enseñar una entrada que daría 403.
 */
export default function useCloserVeNumeros(activo: boolean): boolean {
  const org = useOrg() as any
  const [ve, setVe] = useState(false)
  useEffect(() => {
    if (!activo || !org?.id) return
    let vivo = true
    fetch(`${getAPIUrl()}orgs/${org.id}/config/acceso_closer`)
      .then((r) => r.json())
      .then((d) => vivo && setVe(!!d?.numeros))
      .catch(() => vivo && setVe(false))
    return () => {
      vivo = false
    }
  }, [activo, org?.id])
  return ve
}
