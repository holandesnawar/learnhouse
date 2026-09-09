import { describe, expect, test } from 'bun:test'
import { textoParaVoz } from '../pronunciacion'

describe('lo que se le manda a la voz', () => {
  test('las abreviaturas se dicen enteras', () => {
    expect(textoParaVoz('Gesloten i.v.m. vakantie.')).toBe('Gesloten in verband met vakantie.')
    expect(textoParaVoz('Wij zijn open van maandag t/m vrijdag.')).toBe('Wij zijn open van maandag tot en met vrijdag.')
    expect(textoParaVoz('Idd, dat klopt!')).toBe('inderdaad, dat klopt!')
    expect(textoParaVoz('Mss kom ik wat later, iig tot straks!')).toBe('misschien kom ik wat later, in ieder geval tot straks!')
    expect(textoParaVoz('Bank z.g.a.n., prijs n.o.t.k.')).toBe('Bank zo goed als nieuw, prijs nader overeen te komen')
    expect(textoParaVoz('M.i.v. 1 maart werk ik hier.')).toBe('met ingang van 1 maart werk ik hier.')
  })

  test('la abreviatura sola (la flashcard) también', () => {
    expect(textoParaVoz('i.v.m.')).toBe('in verband met')
    expect(textoParaVoz('ff')).toBe('even')
  })

  test('no toca las palabras que las contienen', () => {
    expect(textoParaVoz('Ik drink koffie.')).toBe('Ik drink koffie.')
    expect(textoParaVoz('Ik ga naar Mallorca.')).toBe('Ik ga naar Mallorca.')
    expect(textoParaVoz('Het duurt ca. twee uur.')).toBe('Het duurt circa twee uur.')
  })

  test('deletrear con guiones pasa a comas', () => {
    expect(textoParaVoz('Mijn naam is C-A-R-L-O-S.')).toBe('Mijn naam is C, A, R, L, O, S.')
  })

  test('las palabras con guion de verdad se quedan', () => {
    expect(textoParaVoz('Wat is je e-mailadres?')).toBe('Wat is je e-mailadres?')
    expect(textoParaVoz('een T-shirt')).toBe('een T-shirt')
  })

  test('lo que no tiene nada especial sale igual', () => {
    expect(textoParaVoz('Goedemorgen! Hoe gaat het?')).toBe('Goedemorgen! Hoe gaat het?')
  })
})
