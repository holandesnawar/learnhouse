import { describe, expect, test } from 'bun:test'
import { avisaATodos, mencionEnCurso, ponerMencion, sugerencias, trozosConMenciones } from '../menciones'

describe('mencionEnCurso', () => {
  test('la @ que se está escribiendo', () => {
    expect(mencionEnCurso('Hola @')).toBe('')
    expect(mencionEnCurso('Hola @al')).toBe('al')
    expect(mencionEnCurso('@')).toBe('')
    expect(mencionEnCurso('Hola @all ')).toBeNull()
    expect(mencionEnCurso('correo@ejem')).toBeNull()
  })
})

describe('ponerMencion', () => {
  test('al final del texto', () => {
    expect(ponerMencion('Hola @al', 8, 'all')).toEqual({ texto: 'Hola @all ', cursor: 10 })
  })
  test('en medio, sin tocar lo de después', () => {
    const texto = 'Hola @ ya está el Werkboek'
    expect(ponerMencion(texto, 6, 'all')).toEqual({ texto: 'Hola @all  ya está el Werkboek', cursor: 10 })
  })
  test('al principio', () => {
    expect(ponerMencion('@', 1, 'all')).toEqual({ texto: '@all ', cursor: 5 })
  })
})

describe('avisaATodos', () => {
  test('como el servidor', () => {
    expect(avisaATodos('@all mirad esto')).toBe(true)
    expect(avisaATodos('Hola @Todos')).toBe(true)
    expect(avisaATodos('Hola a todos')).toBe(false)
  })
})

describe('sugerencias', () => {
  test('all primero y sin repetidos', () => {
    expect(sugerencias('', ['Lucía', 'lucía', 'Pedro'])).toEqual(['all', 'Lucía', 'Pedro'])
    expect(sugerencias('a', ['Ana'])).toEqual(['all', 'Ana'])
    expect(sugerencias('p', ['Pedro'])).toEqual(['Pedro'])
  })
})

describe('trozosConMenciones', () => {
  test('resalta las menciones y no los correos', () => {
    expect(trozosConMenciones('@all ya está. Escribe a info@holandesnawar.com')).toEqual([
      { texto: '@all', mencion: true },
      { texto: ' ya está. Escribe a info@holandesnawar.com', mencion: false },
    ])
  })
  test('el punto final no es parte del nombre', () => {
    expect(trozosConMenciones('Gracias @lucía.')).toEqual([
      { texto: 'Gracias ', mencion: false },
      { texto: '@lucía', mencion: true },
      { texto: '.', mencion: false },
    ])
  })
})
