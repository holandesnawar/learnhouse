/**
 * Escuchar el texto de Lezen (24/11/2026, lo pidieron los alumnos).
 *
 * El texto se lee con el mismo reproductor de Luisteren (la barra con la
 * onda, ±2 s, lento/1×), una sola voz. Ese reproductor pide un audio por
 * línea, así que aquí se parte el texto en trozos que se oyen bien:
 * - cada línea del texto, tal cual (un párrafo o un rótulo como «Eten en
 *   drinken»): así hay una pausa corta donde el texto tiene un salto;
 * - una línea muy larga se parte por frases, sin pasar de `tope` letras
 *   (`/api/tts` no acepta más de 800).
 */
export function trozosParaEscuchar(texto: string, tope = 600): string[] {
  const salida: string[] = []
  for (const linea of (texto || '').split(/\n/)) {
    const limpia = linea.replace(/\s+/g, ' ').trim()
    if (!limpia) continue
    if (limpia.length <= tope) {
      salida.push(limpia)
      continue
    }
    let trozo = ''
    for (const f of limpia.split(/(?<=[.!?])\s+/)) {
      if (trozo && (trozo + ' ' + f).length > tope) {
        salida.push(trozo)
        trozo = f
      } else trozo = trozo ? `${trozo} ${f}` : f
    }
    // Una sola frase más larga que el tope (rarísimo): se corta por palabras.
    while (trozo.length > tope) {
      const corte = trozo.lastIndexOf(' ', tope)
      const i = corte > 0 ? corte : tope
      salida.push(trozo.slice(0, i).trim())
      trozo = trozo.slice(i).trim()
    }
    if (trozo) salida.push(trozo)
  }
  return salida
}
