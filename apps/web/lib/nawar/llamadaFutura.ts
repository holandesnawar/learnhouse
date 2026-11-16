/**
 * «Nueva llamada» avisa si esa persona ya tiene una llamada por delante
 * (16/11/2026). No bloquea: puede ser que quiera otra, pero así no se le
 * agendan dos sin darse cuenta.
 */

export type CitaMinima = { email: string; inicio: string; estado: string }

/** La próxima llamada activa (que aún no ha empezado) de ese correo, o null. */
export function llamadaFuturaDe<T extends CitaMinima>(citas: T[], email: string, ahora: Date = new Date()): T | null {
  const clave = (email || '').trim().toLowerCase()
  if (!clave.includes('@')) return null
  const futuras = citas
    .filter((c) => (c.email || '').trim().toLowerCase() === clave && c.estado === 'activa')
    .filter((c) => {
      const t = new Date(c.inicio).getTime()
      return Number.isFinite(t) && t > ahora.getTime()
    })
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
  return futuras[0] || null
}
