import { describe, expect, test } from 'bun:test'
import { trozosParaEscuchar } from '../escucharLectura'

describe('trozosParaEscuchar', () => {
  test('una línea por trozo, sin vacías ni espacios de sobra', () => {
    const t = `Elke woensdag is er een taalcafé.\n\n  Het is gratis.   Aanmelden is niet nodig.\n\nWie komt er?\n`
    expect(trozosParaEscuchar(t)).toEqual([
      'Elke woensdag is er een taalcafé.',
      'Het is gratis. Aanmelden is niet nodig.',
      'Wie komt er?',
    ])
  })
  test('una línea larga se parte por frases sin pasar del tope', () => {
    const frase = 'Dit is een zin met een paar woorden.'
    const linea = Array.from({ length: 30 }, () => frase).join(' ')
    const trozos = trozosParaEscuchar(linea, 200)
    expect(trozos.length).toBeGreaterThan(1)
    for (const t of trozos) expect(t.length).toBeLessThanOrEqual(200)
    expect(trozos.join(' ')).toBe(linea)
  })
  test('una frase sola más larga que el tope se corta por palabras', () => {
    const linea = Array.from({ length: 80 }, () => 'woord').join(' ')
    const trozos = trozosParaEscuchar(linea, 100)
    for (const t of trozos) expect(t.length).toBeLessThanOrEqual(100)
    expect(trozos.join(' ')).toBe(linea)
  })
  test('vacío', () => {
    expect(trozosParaEscuchar('')).toEqual([])
  })
})
