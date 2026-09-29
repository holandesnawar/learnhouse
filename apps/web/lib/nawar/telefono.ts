/**
 * El número para WhatsApp (wa.me/…): solo cifras, sin el + ni el 00.
 *
 * NO se adivina el país (29/09): un 06… puede ser de otro país y ponerle 31
 * a ciegas abriría el chat de otra persona. Si falta el prefijo, el closer
 * lo ve en la ficha y lo añade él.
 */
export function numeroWhatsApp(tel: string | null | undefined): string {
  const d = (tel || '').replace(/\D/g, '')
  return d.startsWith('00') ? d.slice(2) : d
}
