/** El vídeo de bienvenida en Progreso (24/11/2026). */
export function textoBienvenida(v?: string): string {
  if (!v) return 'Aún no lo ha visto'
  if (v === 'curso') return 'Visto en la introducción de la formación'
  const d = new Date(v)
  return isNaN(d.getTime()) ? 'Visto' : `Visto el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })}`
}
