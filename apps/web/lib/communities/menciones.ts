/**
 * Menciones en la comunidad (@all, @todos, @nombre).
 *
 * Quien avisa es el servidor: busca las menciones en el texto del mensaje
 * (`engagement.py::mentions_in`) y las pone en la campana de cada uno. Esto es
 * solo lo de la pantalla: la lista de sugerencias mientras se escribe, la
 * línea que dice que @all avisará a todo el canal y el resaltado al pintar.
 *
 * Existe porque los canales de tablón no tenían nada de esto (13/10): solo el
 * chat sugería «all» al escribir la @, y en el tablón se ponía @all sin
 * ninguna señal de que fuera a hacer algo.
 */

/** La @ que se está escribiendo justo antes del cursor. */
const EN_CURSO = /(?:^|\s)@([\wáéíóúüñ.\-]*)$/

/** Lo escrito después de la @ que se está tecleando, o null si no hay ninguna. */
export function mencionEnCurso(hastaElCursor: string): string | null {
  const m = EN_CURSO.exec(hastaElCursor)
  return m ? m[1] : null
}

/** Cambia la @ a medias que hay antes del cursor por `@nombre `. */
export function ponerMencion(
  texto: string,
  cursor: number,
  nombre: string
): { texto: string; cursor: number } {
  const antes = texto.slice(0, cursor)
  const m = EN_CURSO.exec(antes)
  if (!m) return { texto, cursor }
  const inicio = m.index + (m[0].startsWith('@') ? 0 : 1)
  const nuevo = `${antes.slice(0, inicio)}@${nombre} `
  return { texto: nuevo + texto.slice(cursor), cursor: nuevo.length }
}

/** ¿Avisará a todo el canal? Misma regla que el servidor. */
export function avisaATodos(texto: string): boolean {
  const t = (texto || '').toLowerCase()
  return t.includes('@all') || t.includes('@todos')
}

/** Sugerencias para lo que se lleva escrito tras la @: «all» primero. */
export function sugerencias(consulta: string, nombres: string[], max = 6): string[] {
  const q = consulta.toLowerCase()
  const vistos = new Set<string>()
  const lista = ['all', ...nombres].filter((n) => {
    const k = n.toLowerCase()
    if (!n || vistos.has(k)) return false
    vistos.add(k)
    return true
  })
  return lista.filter((n) => n.toLowerCase().startsWith(q)).slice(0, max)
}

/**
 * El texto partido en trozos, marcando las menciones, para pintarlas en
 * negrita. Una @ pegada a otra letra no cuenta: es un correo
 * (`correo@ejemplo.com`), no una mención. El punto final se queda fuera.
 */
export function trozosConMenciones(texto: string): { texto: string; mencion: boolean }[] {
  const out: { texto: string; mencion: boolean }[] = []
  const re = /@[\wáéíóúüñ.\-]{2,40}/g
  let desde = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    const i = m.index
    if (i > 0 && !/[\s(¡¿"'«]/.test(texto[i - 1])) continue
    const palabra = m[0].replace(/[.\-]+$/, '')
    if (palabra.length < 3) continue
    if (i > desde) out.push({ texto: texto.slice(desde, i), mencion: false })
    out.push({ texto: palabra, mencion: true })
    desde = i + palabra.length
  }
  if (desde < texto.length) out.push({ texto: texto.slice(desde), mencion: false })
  return out
}
