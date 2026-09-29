/**
 * El número para WhatsApp (wa.me/…): solo cifras, con el prefijo del país.
 *
 * Pasó el 29/09: un lead escribió su móvil como se dice en Países Bajos
 * (06 12 34 56 78) y el botón abría wa.me/0612345678, que no lleva a nadie.
 * Se completa solo lo que no tiene duda (06… holandés, 04… belga, 00…);
 * un número de 9 cifras que empieza por 6 puede ser español u holandés
 * sin el 0, y ese se deja como está. Espejo de nawar-web/src/lib/telefono.ts.
 */
export function numeroWhatsApp(tel: string | null | undefined): string {
  const texto = (tel || '').trim()
  const d = texto.replace(/\D/g, '')
  if (!d) return ''
  if (texto.startsWith('+')) return d
  if (d.startsWith('00')) return d.slice(2)
  if (/^06\d{8}$/.test(d)) return `31${d.slice(1)}`
  if (/^04\d{8}$/.test(d)) return `32${d.slice(1)}`
  return d
}
