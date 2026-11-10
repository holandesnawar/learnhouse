/**
 * Reseñas en vídeo (10/11/2026): las cuentas pequeñas de las dos pantallas
 * (la del alumno y la del panel). Puras, con test en
 * `__tests__/resenas.test.ts`. La lógica de verdad, en el servidor:
 * apps/api/src/services/resenas/resenas.py.
 */

export type EstadoResena = 'invitada' | 'grabada' | 'aprobada' | 'descartada'

/** «1:12» a partir de los segundos. */
export function minutos(seg: number): string {
  const s = Math.max(0, Math.floor(seg || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** «48 MB», «920 KB». */
export function peso(bytes: number): string {
  const b = Math.max(0, bytes || 0)
  if (b >= 1024 * 1024) {
    const mb = b / (1024 * 1024)
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`.replace('.', ',')
  }
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

/**
 * Qué decirle al alumno sobre lo que dura su vídeo. Se pide de 60 a 90
 * segundos, pero no se impone: uno de 40 o de 2 minutos también vale.
 */
export function avisoDuracion(seg: number): { tono: 'bien' | 'aviso'; texto: string } | null {
  if (!seg) return null
  if (seg < 30) return { tono: 'aviso', texto: 'Ha quedado muy corto. Si puedes, cuéntanos un poco más (lo ideal son 60-90 segundos).' }
  if (seg > 150) return { tono: 'aviso', texto: 'Ha quedado largo. Vale igual, pero lo ideal son 60-90 segundos.' }
  return { tono: 'bien', texto: 'Buena duración.' }
}

/**
 * El formato en el que graba el navegador: el primero de la lista que sepa
 * hacer. Safari (iPhone) graba mp4; Chrome y Firefox, webm.
 */
export const FORMATOS_GRABAR = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

export function formatoParaGrabar(sabe: (tipo: string) => boolean): string {
  for (const t of FORMATOS_GRABAR) {
    try {
      if (sabe(t)) return t
    } catch {}
  }
  return ''
}

/** La extensión para el nombre del archivo que se manda (el servidor mira el contenido). */
export function extensionDe(tipo: string): string {
  const t = (tipo || '').toLowerCase()
  if (t.includes('webm')) return 'webm'
  if (t.includes('quicktime')) return 'mov'
  return 'mp4'
}

/** Lo que el alumno lee del plazo: se enseña, no se impone. */
export function textoPlazo(quedan: number | null | undefined): string {
  if (quedan === null || quedan === undefined) return ''
  if (quedan > 1) return `Si puedes, en los próximos ${quedan} días.`
  if (quedan === 1) return 'Si puedes, antes de mañana.'
  if (quedan === 0) return 'Si puedes, hoy.'
  return 'Cuando puedas: nos sigue haciendo la misma ilusión.'
}

export const NOMBRE_ESTADO: Record<EstadoResena, string> = {
  invitada: 'Invitada, sin grabar',
  grabada: 'Por revisar',
  aprobada: 'Aprobada',
  descartada: 'Descartada',
}

/** El orden de la lista del panel: primero lo que espera una decisión. */
const ORDEN: Record<EstadoResena, number> = { grabada: 0, invitada: 1, aprobada: 2, descartada: 3 }

export function ordenarResenas<T extends { estado: EstadoResena; grabada_at: string; invitada_at: string }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => {
    if (ORDEN[a.estado] !== ORDEN[b.estado]) return ORDEN[a.estado] - ORDEN[b.estado]
    const fa = a.grabada_at || a.invitada_at || ''
    const fb = b.grabada_at || b.invitada_at || ''
    return fa < fb ? 1 : fa > fb ? -1 : 0
  })
}

/** Cuánto lleva en la escuela, en palabras. */
export function haceDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return ''
  if (dias < 14) return dias === 1 ? '1 día en la escuela' : `${dias} días en la escuela`
  const semanas = Math.floor(dias / 7)
  return `${semanas} semanas en la escuela`
}
