// Barajar las piezas de los ejercicios.
//
// Por qué existe: casi todos los ejercicios se escribieron en `courseData.ts`
// con la respuesta buena la PRIMERA (en elegir opción, 492 de 529) y las
// frases con sus fichas en el orden correcto. Así que si la pantalla no baraja,
// o baraja mal, el ejercicio se resuelve solo.
//
// Y barajaba mal: `sort(() => Math.random() - 0.5)` no es un barajado de
// verdad. Con cuatro elementos deja el orden de partida muchas más veces que
// una de cada 24, y en "Empareja" la columna de la derecha salía alineada con
// la de la izquierda. Aquí va Fisher-Yates y, donde el orden de partida ES la
// solución, se vuelve a barajar hasta que no lo sea.

/** Fisher-Yates sobre una copia. No toca el array de entrada. */
export function barajar<T>(items: readonly T[], azar: () => number = Math.random): T[] {
  const copia = [...items]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

const INTENTOS = 30

/**
 * Baraja evitando que salga ya resuelto: `resuelto(orden)` dice si ese orden
 * es la solución (la frase montada, la palabra deletreada). Si todas las
 * permutaciones lo son (una sola ficha, o todas iguales), devuelve la última.
 */
export function barajarSinResolver<T>(
  items: readonly T[],
  resuelto: (orden: T[]) => boolean,
  azar: () => number = Math.random,
): T[] {
  let orden = barajar(items, azar)
  for (let i = 0; i < INTENTOS && resuelto(orden); i++) orden = barajar(items, azar)
  return orden
}

/**
 * Para "Empareja": ningún elemento se queda en su posición de partida, o sea,
 * ninguna traducción justo al lado de su palabra. Con dos o más elementos
 * distintos siempre existe un orden así.
 */
export function barajarSinCoincidir<T>(items: readonly T[], azar: () => number = Math.random): T[] {
  if (items.length < 2) return [...items]
  return barajarSinResolver(items, (orden) => orden.some((x, i) => x === items[i]), azar)
}
