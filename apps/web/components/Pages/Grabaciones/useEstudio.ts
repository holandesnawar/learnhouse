'use client'

/**
 * Lo que grabó la sala de una clase (por día, con su semana) y las acciones
 * del equipo: publicar tal cual y quitar. Lo comparten el estudio entero
 * (`EstudioGrabaciones`) y la pieza pequeña de cada semana (`GrabacionDeSala`):
 * una sola petición por clase aunque haya varias piezas en pantalla.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { confirmar } from '@/lib/nawar/confirmar'
import { duracionCorta } from '@/lib/nawar/recorte'
import { getEstudio, publicarGrabacion, quitarGrabacion, type DiaGrabado } from '@services/grabaciones/grabaciones'

const sin = (u: string) => String(u || '').replace(/^course_/, '')

export function useEstudio(courseUuid: string, activo = true) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const cola = useQueryClient()
  const consulta = useQuery({
    queryKey: ['grabaciones', 'estudio', sin(courseUuid)],
    queryFn: () => getEstudio(courseUuid, token),
    enabled: !!courseUuid && !!token && activo,
    staleTime: 60_000,
    retry: 1,
  })

  /** Tras publicar o quitar: el estudio y las semanas de la clase (lo que ve el alumno). */
  const recargar = useCallback(async () => {
    await Promise.all([
      cola.invalidateQueries({ queryKey: ['grabaciones', 'estudio', sin(courseUuid)] }),
      cola.invalidateQueries({ queryKey: ['tareas'] }),
    ])
  }, [cola, courseUuid])

  /** Publica el día entero, sin recortar, en la semana que le toca. */
  const publicarTalCual = useCallback(
    async (dia: DiaGrabado, semana: { id: number; tema: string }) => {
      const listas = dia.partes.filter((p) => p.lista)
      if (!listas.length) {
        toast.error('La grabación aún se está procesando en la sala. Prueba en unos minutos.')
        return false
      }
      const ok = await confirmar(
        `¿Publicar la grabación entera (${duracionCorta(listas.reduce((n, p) => n + p.dur, 0))}) en «${semana.tema}»?\n\nLos alumnos de esta clase la verán en su semana. Se puede recortar o quitar después.`,
        { boton: 'Publicar', peligro: false }
      )
      if (!ok) return false
      try {
        await publicarGrabacion(semana.id, { partes: listas.map((p) => ({ id: p.id, trozos: [] })) }, token)
        toast.success('Publicada: ya la ven los alumnos en su semana')
        await recargar()
        return true
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo publicar')
        return false
      }
    },
    [recargar, token]
  )

  const quitar = useCallback(
    async (semana: { id: number; tema: string }) => {
      const ok = await confirmar(
        `¿Quitar la grabación de «${semana.tema}»?\n\nLos alumnos dejarán de verla. La grabación sigue guardada en la sala: se puede volver a publicar.`,
        { boton: 'Quitar' }
      )
      if (!ok) return false
      try {
        await quitarGrabacion(semana.id, token)
        toast.success('Quitada. Sigue guardada en la sala')
        await recargar()
        return true
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo quitar')
        return false
      }
    },
    [recargar, token]
  )

  return { ...consulta, token, recargar, publicarTalCual, quitar }
}
