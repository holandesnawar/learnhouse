'use client'

/**
 * Borrar a una persona (o quitarla de los números), con sus avisos. Una sola
 * regla para todo el panel, la misma que Contactos:
 * - Quien NO ha pagado (lead, pidió plaza, llegó al pago): se BORRA su rastro
 *   (guías, llamadas, solicitudes, notas y matrículas sin pagar).
 * - Quien ya es alumno: NO se borra (hay un cobro y una factura detrás); se
 *   quita de los números y sigue pudiendo entrar. Se puede deshacer.
 * - Quien ya estaba fuera de los números: vuelve a contar.
 * Solo administradores (el servidor lo comprueba).
 */

import { avisoTrasBorrar, borrarContacto, quitarDeMetricas, volverAContar } from '@services/stats/contactos'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'

export type Resultado = 'borrado' | 'fuera' | 'vuelve' | null

export async function quitarPersona(
  orgId: number,
  accessToken: string,
  p: { email: string; nombre?: string; esAlumno: boolean; fuera?: boolean }
): Promise<Resultado> {
  const quien = p.nombre || p.email
  if (p.fuera) {
    const r = await volverAContar(orgId, p.email, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return null
    }
    toast.success('Vuelve a contar en los números')
    return 'vuelve'
  }
  if (p.esAlumno) {
    if (
      !(await confirmar(
        `${quien} ya ha pagado, así que no se borra: se quita de los números (estadísticas, gastos y plazas). Su cuenta, su acceso y su pago siguen igual. ¿Seguimos?`
      ))
    )
      return null
    const r = await quitarDeMetricas(orgId, p.email, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return null
    }
    toast.success('Quitado de los números')
    return 'fuera'
  }
  if (!(await confirmar(`¿Borrar la matrícula de ${quien}? Se borran sus guías, llamadas, solicitudes, notas y matrículas sin pagar. No se puede deshacer.`)))
    return null
  const r = await borrarContacto(orgId, p.email, accessToken)
  if (!r.ok) {
    toast.error(r.error || 'No se ha podido borrar')
    return null
  }
  const aviso = avisoTrasBorrar(r.quedan)
  if (aviso === 'Borrado') toast.success('Borrado')
  else toast(aviso, { duration: 7000 })
  return 'borrado'
}
