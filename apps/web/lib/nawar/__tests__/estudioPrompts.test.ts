import { describe, expect, test } from 'bun:test'
import { GENERADORES, materialDeLeccion, promptBlog, promptClase, promptComunidad, promptGuion, promptIdeas, promptRecurso } from '../estudioPrompts'

describe('los prompts del Estudio', () => {
  test('todos llevan el contexto y las reglas de la casa, y ninguno nombra un precio', () => {
    const todos = [
      promptIdeas({ objetivo: 'alcance', formato: 'reel' }),
      promptGuion({ idea: 'La g holandesa', formato: 'carrusel' }),
      promptBlog({ tema: 'Cómo pedir cita en el huisarts' }),
      promptComunidad({}),
      promptClase({ tipo: 'semanal', tema: 'Mijn huis' }),
      promptClase({ tipo: 'masterclass', tema: 'Las 500 palabras que ya sabes' }),
      promptClase({ tipo: 'spreekclub', tema: 'Boodschappen doen' }),
      promptRecurso({ tema: 'DigiD', tipo: 'guia' }),
    ]
    for (const p of todos) {
      expect(p).toContain('16 semanas')
      expect(p).toContain('No inventes nada')
      expect(p).not.toMatch(/\d+\s?€/)
      expect(p).not.toContain('academia»,')
    }
    expect(GENERADORES.length).toBe(6)
  })

  test('las ideas salen una por línea, con su objetivo, y no repiten las que ya hay', () => {
    const p = promptIdeas({ objetivo: 'ventas', formato: 'mezcla', tema: 'Black Friday', cuantas: 100, yaTenemos: ['Reel · la g', ' '] })
    expect(p).toContain('VENTAS:')
    expect(p).toContain('30 ideas') // tope
    expect(p).toContain('TEMA DE ESTA TANDA\nBlack Friday')
    expect(p).toContain('- Reel · la g')
    expect(p).toContain('UNA sola línea')
  })

  test('la clase lleva el formato de su tipo, los minutos y lo que ya enseña la escuela', () => {
    const material = materialDeLeccion('Mijn huis', [
      { type: 'vocabulary', items: [{ dutch: 'woonkamer', spanish: 'el salón', article: 'de' }, { dutch: 'het huis', spanish: 'la casa', article: 'het' }] },
      { type: 'phrases', items: [{ dutch: 'Ik woon in Utrecht.', spanish: 'Vivo en Utrecht.' }] },
      { type: 'practice', exercises: [] },
    ])
    expect(material).toContain('de woonkamer = el salón')
    expect(material).toContain('het huis = la casa') // sin repetir el artículo
    expect(material).toContain('Ik woon in Utrecht. = Vivo en Utrecht.')
    const semanal = promptClase({ tipo: 'semanal', tema: 'Mijn huis', minutos: 60, alumnos: 7, material })
    expect(semanal).toContain('CONVERSATIELES')
    expect(semanal).toContain('unos 7 alumnos')
    expect(semanal).toContain('de woonkamer = el salón')
    expect(semanal).toContain('HUECOS EN BLANCO')
    expect(promptClase({ tipo: 'masterclass', tema: 'x' })).toContain('16:9')
    expect(promptClase({ tipo: 'spreekclub', tema: 'x', minutos: 45 })).toContain('sumar 45 minutos')
    // Sin vocabulario ni frases, no hay material que pegar.
    expect(materialDeLeccion('x', [{ type: 'practice', exercises: [] }])).toBe('')
  })
})
