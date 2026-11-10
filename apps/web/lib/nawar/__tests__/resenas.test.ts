import { describe, expect, test } from 'bun:test'
import { avisoDuracion, extensionDe, formatoParaGrabar, haceDias, minutos, ordenarResenas, peso, textoPlazo } from '../resenas'

describe('reseñas en vídeo', () => {
  test('minutos y peso', () => {
    expect(minutos(72.9)).toBe('1:12')
    expect(minutos(5)).toBe('0:05')
    expect(minutos(0)).toBe('0:00')
    expect(peso(48 * 1024 * 1024)).toBe('48 MB')
    expect(peso(2.5 * 1024 * 1024)).toBe('2,5 MB')
    expect(peso(920 * 1024)).toBe('920 KB')
  })

  test('la duración se comenta, no se impone', () => {
    expect(avisoDuracion(0)).toBeNull()
    expect(avisoDuracion(20)?.tono).toBe('aviso')
    expect(avisoDuracion(75)?.tono).toBe('bien')
    expect(avisoDuracion(200)?.tono).toBe('aviso')
  })

  test('el formato en el que graba cada navegador', () => {
    // Safari: sabe mp4.
    expect(formatoParaGrabar((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1,mp4a')
    // Chrome sin mp4: webm con vp9.
    expect(formatoParaGrabar((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus')
    // Uno que no dice nada o que revienta: el que elija el navegador.
    expect(formatoParaGrabar(() => false)).toBe('')
    expect(
      formatoParaGrabar(() => {
        throw new Error('no')
      })
    ).toBe('')
    expect(extensionDe('video/webm;codecs=vp9')).toBe('webm')
    expect(extensionDe('video/quicktime')).toBe('mov')
    expect(extensionDe('')).toBe('mp4')
  })

  test('el plazo se enseña sin apretar', () => {
    expect(textoPlazo(7)).toBe('Si puedes, en los próximos 7 días.')
    expect(textoPlazo(0)).toBe('Si puedes, hoy.')
    expect(textoPlazo(-3)).toContain('Cuando puedas')
    expect(textoPlazo(null)).toBe('')
  })

  test('en el panel, primero lo que espera una decisión', () => {
    const filas = [
      { id: 1, estado: 'aprobada' as const, grabada_at: '2026-11-09', invitada_at: '2026-11-01' },
      { id: 2, estado: 'invitada' as const, grabada_at: '', invitada_at: '2026-11-08' },
      { id: 3, estado: 'grabada' as const, grabada_at: '2026-11-07', invitada_at: '2026-11-01' },
      { id: 4, estado: 'grabada' as const, grabada_at: '2026-11-10', invitada_at: '2026-11-01' },
      { id: 5, estado: 'descartada' as const, grabada_at: '', invitada_at: '2026-11-02' },
    ]
    expect(ordenarResenas(filas).map((f) => f.id)).toEqual([4, 3, 2, 1, 5])
  })

  test('cuánto lleva en la escuela', () => {
    expect(haceDias(1)).toBe('1 día en la escuela')
    expect(haceDias(9)).toBe('9 días en la escuela')
    expect(haceDias(40)).toBe('5 semanas en la escuela')
    expect(haceDias(null)).toBe('')
  })
})
