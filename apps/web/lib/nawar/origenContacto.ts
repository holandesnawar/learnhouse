/**
 * De dónde viene cada contacto, en las columnas del tablero de Contactos
 * (04/11/2026, usuario: "estilo kanban para saber de dónde viene el tráfico y
 * de ahí poder dividir o filtrar quién viene por esto, quién está en esta
 * etapa").
 *
 * La escuela ya manda con cada contacto su `canal` («Ads» / «Orgánico» y el
 * detalle: "Meta · VSL A", "Instagram · DM", "Guía", "Web · inicio"…), la misma
 * cuenta que la etiqueta de arriba de la ficha (`pipeline.canal_de`). Aquí solo
 * se reparte en seis columnas. Puras, con test (`__tests__/origenContacto.test.ts`).
 */

export type OrigenId = 'anuncios' | 'redes' | 'guias' | 'web' | 'correo' | 'otros'

export const ORIGENES: { id: OrigenId; nombre: string; color: string; que: string }[] = [
  { id: 'anuncios', nombre: 'Anuncios', color: '#025dc7', que: 'Llegaron alguna vez por un anuncio de pago' },
  { id: 'redes', nombre: 'Instagram y redes', color: '#C2477F', que: 'Bio, historias, reels, DM o un setter' },
  { id: 'guias', nombre: 'Guías gratis', color: '#0F8B8D', que: 'Entraron bajando una guía' },
  { id: 'web', nombre: 'Web', color: '#1D0084', que: 'Entraron por una página de la web, sin anuncio' },
  { id: 'correo', nombre: 'Correo', color: '#7C5CC4', que: 'Volvieron por el botón de un correo' },
  { id: 'otros', nombre: 'Google y otras webs', color: '#6B7280', que: 'Buscadores, otras webs o no se sabe' },
]

export type ConOrigen = {
  canal?: { canal?: string; detalle?: string } | null
  pasos?: string[]
  utm_source?: string
  primer_contacto?: { kind?: string }
}

const REDES = ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'meta', 'setter']

/**
 * La columna y el detalle ("Meta · VSL A", "Instagram · DM"…) de un contacto.
 * Manda el sitio del que llegó, no la página por la que entró: quien bajó una
 * guía viniendo de Google va a «Google y otras webs».
 */
export function origenDe(c: ConOrigen): { id: OrigenId; detalle: string } {
  const detalle = (c.canal?.detalle || '').trim()
  const d = detalle.toLowerCase()
  if (c.canal?.canal === 'ads') return { id: 'anuncios', detalle: detalle || 'Anuncio' }
  if (REDES.some((r) => d.startsWith(r))) return { id: 'redes', detalle }
  if (d.startsWith('correo')) return { id: 'correo', detalle }
  if (d === 'guía' || d === 'guia') return { id: 'guias', detalle }
  if (d.startsWith('web') || d.includes('black friday')) return { id: 'web', detalle }
  if (detalle) return { id: 'otros', detalle }
  // Sin detalle: por lo primero que hizo.
  const primera = (c.pasos || [])[0] || ''
  const kind = c.primer_contacto?.kind || ''
  if (primera.startsWith('guia-') || primera.startsWith('gracias-') || kind.startsWith('guia')) return { id: 'guias', detalle: 'Guía' }
  if (kind === 'instagram') return { id: 'redes', detalle: 'Instagram · DM' }
  return { id: 'otros', detalle: 'Sin saber' }
}

/** El color de una columna. */
export function colorDeOrigen(id: OrigenId): string {
  return ORIGENES.find((o) => o.id === id)?.color || '#6B7280'
}

/** La campaña de un contacto (su `utm_campaign`, o Black Friday si pasó por sus páginas). */
export function campanaDe(c: { utm_campaign?: string; pasos?: string[] }): string {
  const u = (c.utm_campaign || '').trim().toLowerCase()
  if (u && !u.includes('{{')) return u
  if ((c.pasos || []).some((p) => p.startsWith('bf-') || p === 'black-friday')) return 'black-friday'
  return ''
}

const NOMBRES_CAMPANA: Record<string, string> = {
  'black-friday': 'Black Friday',
  'vsl-matricula-oct26': 'Anuncio VSL · oct',
}

/** "black-friday" → "Black Friday"; "bases-sept" → "Bases sept". */
export function nombreCampana(id: string): string {
  if (!id) return ''
  if (NOMBRES_CAMPANA[id]) return NOMBRES_CAMPANA[id]
  const t = id.replace(/[-_]+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Las iniciales para el círculo de cada persona ("Ana Ruiz" → "AR"; sin nombre, del correo). */
export function iniciales(nombre: string, email: string): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (email || '?').slice(0, 2).toUpperCase()
}
