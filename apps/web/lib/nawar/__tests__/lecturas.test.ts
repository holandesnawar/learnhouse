import { describe, expect, test } from 'bun:test'
import { parrafos, youtubeId } from '../../../services/lecturas/lecturas'

describe('lectura semanal', () => {
  test('el id de YouTube', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=abcDEF12345')).toBe('abcDEF12345')
    expect(youtubeId('https://youtu.be/abcDEF12345?t=3')).toBe('abcDEF12345')
    expect(youtubeId('https://www.youtube.com/shorts/abcDEF12345')).toBe('abcDEF12345')
    expect(youtubeId('https://nos.nl/jeugdjournaal/video/123')).toBe('')
  })
  test('párrafos para escuchar', () => {
    expect(parrafos('Hallo.\nIk ben Ana.\n\n  Ik woon in Utrecht. ')).toEqual(['Hallo. Ik ben Ana.', 'Ik woon in Utrecht.'])
    const largo = Array.from({ length: 40 }, (_, i) => `Dit is zin nummer ${i}.`).join(' ')
    const trozos = parrafos(largo, 200)
    expect(trozos.length).toBeGreaterThan(1)
    expect(trozos.every((t) => t.length <= 200)).toBe(true)
    expect(trozos.join(' ')).toBe(largo)
  })
})
