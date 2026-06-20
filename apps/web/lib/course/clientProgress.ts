'use client'
import React from 'react'

/**
 * Progreso de cliente para el gating por fases.
 *
 * El desbloqueo NO debe depender solo del "trail" del servidor: cuando el
 * alumno ve el vídeo o termina un ejercicio queremos abrir la fase AL INSTANTE,
 * y que siga abierta aunque la llamada al backend vaya lenta o falle (Bunny a
 * veces tarda en confirmar). Guardamos las actividades completadas en
 * localStorage (por curso) y avisamos por un evento para que la barra lateral y
 * el botón "Siguiente" se actualicen a la vez. Se UNE al trail del servidor
 * (que sigue siendo la verdad entre dispositivos), nunca lo sustituye.
 */

const PREFIX = 'lh_done_'

function keyFor(courseUuid?: string): string {
  return PREFIX + (courseUuid || '').replace('course_', '')
}

export function getClientComplete(courseUuid?: string): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(keyFor(courseUuid))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(Number).filter((n) => isFinite(n)) : [])
  } catch {
    return new Set()
  }
}

export function addClientComplete(courseUuid: string | undefined, activityId?: number): void {
  if (typeof window === 'undefined' || !activityId) return
  try {
    const s = getClientComplete(courseUuid)
    if (s.has(activityId)) return
    s.add(activityId)
    window.localStorage.setItem(keyFor(courseUuid), JSON.stringify([...s]))
    window.dispatchEvent(new CustomEvent('lh-progress'))
  } catch {
    /* localStorage no disponible */
  }
}

/** Hook reactivo: devuelve el set de completados de cliente para un curso. */
export function useClientComplete(courseUuid?: string): Set<number> {
  const [set, setSet] = React.useState<Set<number>>(() => new Set())
  React.useEffect(() => {
    const refresh = () => setSet(getClientComplete(courseUuid))
    refresh()
    window.addEventListener('lh-progress', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('lh-progress', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [courseUuid])
  return set
}
