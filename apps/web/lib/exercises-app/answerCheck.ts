// Corrección de las traducciones al español que el alumno compone con fichas
// (el ejercicio "Escucha y traduce": suena la frase en neerlandés y se toca
// palabra a palabra la traducción).
//
// El problema que resuelve: el neerlandés OBLIGA a poner el sujeto ("Wij gaan
// naar Antwerpen") y el español lo deja caer ("Vamos a Amberes"). Comparando la
// frase compuesta con una sola respuesta buena, "Vamos a Amberes" salía mal
// siendo la traducción más natural de las dos.
//
// La regla es de una sola dirección, y eso importa: se acepta la respuesta tal
// cual y la MISMA respuesta sin SU pronombre inicial. No se aceptan pronombres
// que el alumno añada por su cuenta, porque las fichas traen distractores y
// "Ellos vamos a Amberes" no es español.
//
// Además, un ejercicio puede traer `alsoAccept` con otras traducciones que
// también valen ("con una Z" además de "con Z"); reciben el mismo trato.

// Solo pronombres de SUJETO, y con tilde donde la lleva.
// Ojo con lo que NO está: "el" sin tilde es artículo ("El árbol es grande") y
// "tu" sin tilde es posesivo ("Tu hermano trabaja"). Quitarlos dejaría frases
// rotas dadas por buenas.
const PRONOMBRES_SUJETO = [
  'yo',
  'tú',
  'él',
  'ella',
  'usted',
  'nosotros',
  'nosotras',
  'vosotros',
  'vosotras',
  'ellos',
  'ellas',
  'ustedes',
]

function normalizar(texto: string): string {
  // Se conservan las tildes a propósito: sin ellas, "tu" (posesivo) pasaría por
  // "tú" (pronombre) y se aceptaría "Hermano trabaja el fin de semana".
  return texto.trim().toLowerCase().replace(/\s+/g, ' ')
}

function variantes(respuesta: string): string[] {
  const base = normalizar(respuesta)
  if (!base) return []
  const lista = [base]
  const [primera, ...resto] = base.split(' ')
  if (PRONOMBRES_SUJETO.includes(primera) && resto.length > 0) {
    lista.push(resto.join(' '))
  }
  return lista
}

/** Las formas que damos por buenas para una traducción al español. */
export function respuestasValidasEs(correcta: string, otras: string[] = []): string[] {
  const todas = [correcta, ...otras].flatMap(variantes)
  return Array.from(new Set(todas))
}

/** ¿La frase que ha compuesto el alumno vale como traducción? */
export function aciertaEnEspanol(compuesta: string, correcta: string, otras: string[] = []): boolean {
  return respuestasValidasEs(correcta, otras).includes(normalizar(compuesta))
}

// ── Escribir en neerlandés ────────────────────────────────────────────────
// Antes se comparaba el texto tal cual, así que "Ik eet brood met kaas." con
// punto salía MAL, y cada pista tenía que avisar "sin punto final". Ahora da
// igual la puntuación del final (. ! ? …), los ¿¡ del principio, los espacios
// de más, las mayúsculas y el apóstrofo tipográfico (’ en vez de ', que es lo
// que pone el teclado del iPhone en "'s avonds"). Las tildes SÍ cuentan:
// "één" y "een" no son la misma palabra.
function normalizarEscrito(texto: string): string {
  return texto
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/^[¿¡\s]+/, '')
    .replace(/[.!?…\s]+$/, '')
    .replace(/\s+/g, ' ')
}

/** ¿Lo que ha escrito el alumno vale? `otras` = respuestas alternativas. */
export function aciertaEscrito(escrito: string, correcta: string, otras: string[] = []): boolean {
  const dado = normalizarEscrito(escrito)
  if (!dado) return false
  return [correcta, ...otras].some((r) => normalizarEscrito(r) === dado)
}
