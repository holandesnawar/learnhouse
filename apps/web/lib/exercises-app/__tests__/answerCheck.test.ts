import { describe, expect, test } from 'bun:test'
import { aciertaEnEspanol, respuestasValidasEs } from '../answerCheck'

describe('traducción al español sin pronombre', () => {
  test('acepta la respuesta tal cual', () => {
    expect(aciertaEnEspanol('Nosotras vamos a Amberes', 'Nosotras vamos a Amberes')).toBe(true)
  })

  test('acepta la misma frase sin su pronombre de sujeto', () => {
    expect(aciertaEnEspanol('Vamos a Amberes', 'Nosotras vamos a Amberes')).toBe(true)
    expect(aciertaEnEspanol('Es médica', 'Ella es médica')).toBe(true)
    expect(aciertaEnEspanol('Tomáis café', 'Vosotros tomáis café')).toBe(true)
  })

  test('NO acepta un pronombre distinto puesto por el alumno', () => {
    // Las fichas traen distractores: "Ellos vamos a Amberes" no es español.
    expect(aciertaEnEspanol('Ellos vamos a Amberes', 'Nosotras vamos a Amberes')).toBe(false)
  })

  test('no toca el artículo "el" ni el posesivo "tu"', () => {
    expect(respuestasValidasEs('El árbol es grande')).toEqual(['el árbol es grande'])
    expect(aciertaEnEspanol('árbol es grande', 'El árbol es grande')).toBe(false)
    expect(aciertaEnEspanol('hermano trabaja hoy', 'Tu hermano trabaja hoy')).toBe(false)
  })

  test('"él" y "tú" con tilde sí son sujeto', () => {
    expect(aciertaEnEspanol('es alto', 'Él es alto')).toBe(true)
    expect(aciertaEnEspanol('trabajas mucho', 'Tú trabajas mucho')).toBe(true)
  })

  test('ignora mayúsculas y espacios de sobra', () => {
    expect(aciertaEnEspanol('  vamos   a Amberes ', 'Nosotras vamos a Amberes')).toBe(true)
  })

  test('una respuesta que es solo el pronombre no se queda vacía', () => {
    expect(respuestasValidasEs('Ella')).toEqual(['ella'])
    expect(aciertaEnEspanol('', 'Ella')).toBe(false)
  })

  test('la frase incorrecta sigue siendo incorrecta', () => {
    expect(aciertaEnEspanol('Vamos a casa', 'Nosotras vamos a Amberes')).toBe(false)
  })
})
