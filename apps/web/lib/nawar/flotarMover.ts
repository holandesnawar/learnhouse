/**
 * Tareas «flotar» y «mover» (22/11/2026). Flotar = mantener el barco a flote
 * (operaciones, fuegos, soporte, cobros); mover = hacerlo avanzar (contenido,
 * campañas, producto, ventas nuevas). El usuario quiere repartir su día 50/50.
 * El servidor cuenta (`balance_semana` en services/panel/tareas.py); aquí solo
 * los textos y el orden en que se cambia una etiqueta.
 */

export type TipoTarea = '' | 'flotar' | 'mover'

export const TIPOS_TAREA: { id: Exclude<TipoTarea, ''>; nombre: string; ayuda: string }[] = [
  { id: 'flotar', nombre: 'Flotar', ayuda: 'Mantener a flote: operaciones, fuegos, soporte, cobros' },
  { id: 'mover', nombre: 'Mover', ayuda: 'Hacer avanzar: contenido, campañas, producto, ventas nuevas' },
]

/** Sin tipo → flotar → mover → sin tipo. */
export function siguienteTipo(t: TipoTarea | undefined): TipoTarea {
  if (t === 'flotar') return 'mover'
  if (t === 'mover') return ''
  return 'flotar'
}

/** «Esta semana: 6 flotar · 4 mover (60/40)», o que aún no hay nada hecho. */
export function textoBalance(b: { hechas: { flotar: number; mover: number }; flotar_pct: number; mover_pct: number }): string {
  const total = b.hechas.flotar + b.hechas.mover
  if (!total) return 'Esta semana aún no has terminado ninguna tarea con tipo'
  return `Esta semana: ${b.hechas.flotar} flotar · ${b.hechas.mover} mover (${b.flotar_pct}/${b.mover_pct})`
}

/** Una frase de consejo según cómo va el reparto. */
export function consejoBalance(b: { hechas: { flotar: number; mover: number }; mover_pct: number }): string {
  const total = b.hechas.flotar + b.hechas.mover
  if (total < 3) return ''
  if (b.mover_pct < 35) return 'Mucho apagar fuegos: reserva un rato para algo que mueva el barco.'
  if (b.mover_pct > 65) return 'Mucho avanzar: mira que no se quede nada sin atender.'
  return 'Buen equilibrio.'
}
