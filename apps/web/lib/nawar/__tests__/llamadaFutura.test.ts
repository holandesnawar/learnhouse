import { describe, expect, it } from 'bun:test'
import { llamadaFuturaDe } from '../llamadaFutura'

const ahora = new Date('2026-11-16T12:00:00Z')

describe('llamadaFuturaDe', () => {
  const citas = [
    { email: 'ana@x.com', inicio: '2026-11-10T17:00:00Z', estado: 'activa' },
    { email: 'Ana@x.com', inicio: '2026-11-25T17:00:00Z', estado: 'activa' },
    { email: 'ana@x.com', inicio: '2026-11-20T17:00:00Z', estado: 'activa' },
    { email: 'ana@x.com', inicio: '2026-11-18T17:00:00Z', estado: 'cancelada' },
    { email: 'eva@x.com', inicio: '2026-11-17T17:00:00Z', estado: 'activa' },
  ]

  it('da la próxima activa de ese correo', () => {
    expect(llamadaFuturaDe(citas, ' ANA@x.com ', ahora)?.inicio).toBe('2026-11-20T17:00:00Z')
  })

  it('sin llamadas por delante, o sin correo, nada', () => {
    expect(llamadaFuturaDe(citas, 'sol@x.com', ahora)).toBeNull()
    expect(llamadaFuturaDe(citas, '', ahora)).toBeNull()
    expect(llamadaFuturaDe(citas, 'ana', ahora)).toBeNull()
  })
})
