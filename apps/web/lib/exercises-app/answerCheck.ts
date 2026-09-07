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

/** Las formas que damos por buenas para una traducción al español. */
export function respuestasValidasEs(correcta: string): string[] {
  const base = normalizar(correcta)
  if (!base) return []

  const validas = [base]
  const [primera, ...resto] = base.split(' ')
  if (PRONOMBRES_SUJETO.includes(primera) && resto.length > 0) {
    validas.push(resto.join(' '))
  }
  return validas
}

/** ¿La frase que ha compuesto el alumno vale como traducción? */
export function aciertaEnEspanol(compuesta: string, correcta: string): boolean {
  return respuestasValidasEs(correcta).includes(normalizar(compuesta))
}
