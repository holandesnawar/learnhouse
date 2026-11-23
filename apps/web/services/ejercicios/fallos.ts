'use client'
import { getAPIUrl } from '@services/config/config'
import type { DatosDelFallo, GrupoDeFallos, MotivoFallo } from '@/lib/nawar/fallosEjercicios'

/**
 * «¿Ves un fallo? Avísanos» (23/11/2026). El servidor, en
 * `apps/api/src/services/ejercicios/avisos.py`.
 */

type Resp<T> = { ok: true; datos: T } | { ok: false; error: string }

async function pedir<T>(ruta: string, metodo: string, cuerpo: unknown, token: string): Promise<Resp<T>> {
  try {
    const res = await fetch(`${getAPIUrl()}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: cuerpo === null ? undefined : JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detalle = (datos as any)?.detail
      return { ok: false, error: typeof detalle === 'string' && detalle ? detalle : 'No se ha podido enviar' }
    }
    return { ok: true, datos: datos as T }
  } catch {
    return { ok: false, error: 'No se ha podido conectar' }
  }
}

export const avisarFallo = (
  orgId: number,
  aviso: { lesson_id: string; exercise_id: string; motivo: MotivoFallo; comentario: string; datos: DatosDelFallo },
  token: string
) => pedir<{ ok: boolean }>(`fallos/org/${orgId}`, 'POST', aviso, token)

export type ListaDeFallos = { abiertos: GrupoDeFallos[]; cerrados: GrupoDeFallos[]; admin: boolean }

export const listarFallos = (orgId: number, token: string) => pedir<ListaDeFallos>(`fallos/org/${orgId}`, 'GET', null, token)

export const cerrarFallo = (orgId: number, g: { lesson_id: string; exercise_id: string }, estado: 'arreglado' | 'no-era' | 'nuevo', token: string) =>
  pedir<{ ok: boolean }>(`fallos/org/${orgId}/cerrar`, 'PUT', { lesson_id: g.lesson_id, exercise_id: g.exercise_id, estado }, token)
