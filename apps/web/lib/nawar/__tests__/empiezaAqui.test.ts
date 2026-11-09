import { describe, expect, test } from 'bun:test'
import { esCanalDeInicio, esCanalDePresentarse, esCanalEsencial, ordenDeInicio } from '../empiezaAqui'

describe('empiezaAqui', () => {
  test('reconoce los canales de quien acaba de llegar', () => {
    expect(esCanalDeInicio('👋 Preséntate')).toBe(true)
    expect(esCanalDeInicio('📢 Noticias')).toBe(true)
    expect(esCanalDeInicio('📌 Empieza aquí')).toBe(true)
    expect(esCanalDeInicio('🏆 Victorias')).toBe(false)
    expect(esCanalDeInicio('💬 General')).toBe(false)
    expect(esCanalDePresentarse('👋 Presentaciones')).toBe(true)
    expect(esCanalEsencial('📌 Lo esencial')).toBe(true)
    expect(esCanalEsencial('👋 Preséntate')).toBe(false)
    const orden = ['📢 Noticias', '👋 Preséntate', '📌 Lo esencial'].sort((a, b) => ordenDeInicio(a) - ordenDeInicio(b))
    expect(orden).toEqual(['📌 Lo esencial', '👋 Preséntate', '📢 Noticias'])
  })
})
