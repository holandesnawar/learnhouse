import { describe, expect, test } from 'bun:test'
import { claseDeLaLeccion, parteDelCurso } from '../leccionEnElCurso'

const clase = (uuid: string, embed: string) => ({
  activity_uuid: `activity_${uuid}`,
  content: { embed_url: embed },
})

const curso = {
  chapters: [
    { activities: [clase('intro', 'nawar-guia:uso')] },
    {
      activities: [
        clase('l1-video', ''),
        clase('l1-resumen', 'nawar:over-jou/les-1-voorstellen/resumen'),
        clase('l1-oef', 'nawar:over-jou/les-1-voorstellen/vocabulary'),
        clase('l1-flash', 'nawar:over-jou/les-1-voorstellen/flashcards'),
        clase('l1-luis', 'nawar:over-jou/les-1-voorstellen/luisteren'),
        clase('l2-resumen', 'nawar:over-jou/les-2-voornaamwoorden/resumen'),
        clase('l2-lezen', 'nawar:over-jou/les-2-voornaamwoorden/lezen'),
        clase('extra', 'https://x/ejercicios/modulo/over-jou/leccion/extra-kleuren'),
      ],
    },
  ],
}

describe('parteDelCurso', () => {
  test('los nombres de la escuela y los del curso', () => {
    expect(parteDelCurso('Samenvatting')).toBe('resumen')
    expect(parteDelCurso('oefeningen')).toBe('vocabulary')
    expect(parteDelCurso('diálogo')).toBe('luisteren')
    expect(parteDelCurso('flashcards')).toBe('flashcards')
    expect(parteDelCurso('cualquiera')).toBeNull()
    expect(parteDelCurso(undefined)).toBeNull()
  })
})

describe('claseDeLaLeccion', () => {
  test('la parte pedida', () => {
    expect(claseDeLaLeccion(curso, 'les-1-voorstellen', 'luisteren')).toBe('l1-luis')
    expect(claseDeLaLeccion(curso, 'les-1-voorstellen', 'samenvatting')).toBe('l1-resumen')
    expect(claseDeLaLeccion(curso, 'les-1-voorstellen', 'oefeningen')).toBe('l1-oef')
  })

  test('sin parte, las flashcards', () => {
    expect(claseDeLaLeccion(curso, 'les-1-voorstellen')).toBe('l1-flash')
  })

  test('si la lección no tiene esa parte, su primera clase', () => {
    expect(claseDeLaLeccion(curso, 'les-2-voornaamwoorden', 'flashcards')).toBe('l2-resumen')
    expect(claseDeLaLeccion(curso, 'les-2-voornaamwoorden', 'no-existe')).toBe('l2-resumen')
  })

  test('también las clases enlazadas a la app de ejercicios', () => {
    expect(claseDeLaLeccion(curso, 'extra-kleuren', 'flashcards')).toBe('extra')
  })

  test('una lección que no está en el curso', () => {
    expect(claseDeLaLeccion(curso, 'les-9-nada', 'flashcards')).toBeNull()
    expect(claseDeLaLeccion(null, 'les-1-voorstellen')).toBeNull()
  })
})
