import { describe, expect, test } from 'bun:test'
import { rutaParaVolver } from '../volver'

describe('rutaParaVolver', () => {
  test('rutas de la escuela', () => {
    expect(rutaParaVolver('/leccion/les-1-voorstellen/flashcards')).toBe('/leccion/les-1-voorstellen/flashcards')
    expect(rutaParaVolver('/course/x/activity/y?tab=1')).toBe('/course/x/activity/y?tab=1')
  })

  test('nada que salga de la escuela', () => {
    expect(rutaParaVolver('https://otro.com')).toBeNull()
    expect(rutaParaVolver('//otro.com/x')).toBeNull()
    expect(rutaParaVolver('/\\otro.com')).toBeNull()
    expect(rutaParaVolver('/x\n/y')).toBeNull()
  })

  test('sin vueltas en círculo ni el Inicio', () => {
    expect(rutaParaVolver('/')).toBeNull()
    expect(rutaParaVolver('/login?redirect=/x')).toBeNull()
    expect(rutaParaVolver('/redirect_from_auth')).toBeNull()
    expect(rutaParaVolver(null)).toBeNull()
    expect(rutaParaVolver('')).toBeNull()
  })
})
