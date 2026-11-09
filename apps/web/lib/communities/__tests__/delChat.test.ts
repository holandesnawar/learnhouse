import { describe, expect, test } from 'bun:test'
import { adjuntosDe, docSinTitulo, hiloDe, sinTituloRepetido } from '../delChat'

const doc = (o: any) => JSON.stringify({ type: 'doc', content: [], ...o })

describe('mensajes del chat en un tablón', () => {
  test('respuesta en hilo', () => {
    expect(hiloDe(doc({ threadParent: 'discussion_x' }))).toBe('discussion_x')
    expect(hiloDe(doc({}))).toBe('')
    expect(hiloDe('texto viejo')).toBe('')
    expect(hiloDe(null)).toBe('')
  })
  test('adjuntos', () => {
    expect(adjuntosDe(doc({ attachments: [{ url: 'u', name: 'n', kind: 'image', size: 1 }, null] }))).toHaveLength(1)
    expect(adjuntosDe(doc({}))).toEqual([])
  })
  test('el título no se repite', () => {
    expect(sinTituloRepetido('Hola, soy Ana', 'Hola, soy Ana\nVivo en Utrecht')).toBe('Vivo en Utrecht')
    expect(sinTituloRepetido('Mi presentación', 'Hola, soy Ana')).toBe('Hola, soy Ana')
    const largo = 'a'.repeat(100)
    expect(sinTituloRepetido(largo, largo + 'bbb\nfin')).toBe('fin')
  })
  test('el documento tampoco', () => {
    const d = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola, soy Ana' }] }, { type: 'paragraph' }] }
    expect(docSinTitulo(d, 'Hola, soy Ana').content).toHaveLength(1)
    expect(docSinTitulo(d, 'Otra cosa').content).toHaveLength(2)
  })
})
