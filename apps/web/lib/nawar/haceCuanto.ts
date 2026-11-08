/**
 * «hace 2 días», en español y sin depender de que dayjs cargue su idioma
 * (08/11/2026: en la comunidad salía «2 days ago»).
 */
export function haceCuanto(iso: string | null | undefined, ahora: number = Date.now()): string {
  if (!iso) return ''
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  if (Number.isNaN(t)) return ''
  const m = Math.max(0, Math.round((ahora - t) / 60000))
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
