import { describe, expect, test } from 'bun:test'
import { parrafos, videoIncrustado, youtubeId } from '../../../services/lecturas/lecturas'

describe('lectura semanal', () => {
  test('el id de YouTube', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=abcDEF12345')).toBe('abcDEF12345')
    expect(youtubeId('https://youtu.be/abcDEF12345?t=3')).toBe('abcDEF12345')
    expect(youtubeId('https://www.youtube.com/shorts/abcDEF12345')).toBe('abcDEF12345')
    expect(youtubeId('https://nos.nl/jeugdjournaal/video/123')).toBe('')
  })
  test('el vídeo se ve dentro: Bunny, YouTube y Vimeo', () => {
    const g = 'f05ad0a5-e742-4dc1-bd3d-64c0574d0271'
    expect(videoIncrustado(`https://iframe.mediadelivery.net/embed/327691/${g}`)).toBe(
      `https://iframe.mediadelivery.net/embed/327691/${g}?autoplay=false&responsive=true&preload=true`,
    )
    expect(videoIncrustado(`https://player.mediadelivery.net/play/327691/${g}`)).toContain(`/embed/327691/${g}`)
    expect(videoIncrustado('https://youtu.be/abcDEF12345')).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345?rel=0')
    expect(videoIncrustado('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456')
    expect(videoIncrustado('https://nos.nl/jeugdjournaal/video/123')).toBe('')
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
