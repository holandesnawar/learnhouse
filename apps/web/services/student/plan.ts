/** El plan de estudio del alumno: su objetivo y sus días.
 *  De dónde sale: apps/api/src/services/plan/plan.py */
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

export interface Plan {
  objetivo: string
  objetivo_texto: string
  /** 0 = lunes … 6 = domingo. */
  dias: number[]
  /** «20:00», hora de Países Bajos. */
  hora: string
  minutos: number
  recordar: boolean
  guardado: string
}

export interface MiPlan {
  plan: Plan
  rellenado: boolean
  objetivo_nombre: string
  semana: { meta: number; hechos: number; cumplida: boolean; dias: string[]; proximo: string; hoy_toca: boolean }
  opciones: { objetivos: { id: string; nombre: string; ejemplo: string }[]; minutos: number[] }
}

export async function getPlan(token: string): Promise<MiPlan | null> {
  try {
    const r = await fetch(`${getAPIUrl()}student/plan`, RequestBodyWithAuthHeader('GET', null, null, token))
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

export async function guardarPlan(datos: Partial<Plan>, token: string): Promise<MiPlan> {
  const r = await fetch(`${getAPIUrl()}student/plan`, RequestBodyWithAuthHeader('PUT', datos, null, token))
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : 'No se pudo guardar')
  return d
}

export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export function diasEnTexto(dias: number[]): string {
  const n = [...dias].sort((a, b) => a - b).map((d) => DIAS_LARGOS[d])
  if (!n.length) return ''
  return n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}
