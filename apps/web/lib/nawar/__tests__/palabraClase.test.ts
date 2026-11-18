import { describe, expect, test } from 'bun:test'
import { comoSesion, textosDeClase } from '../palabraClase'

describe('palabra clase', () => {
  test('cambia clase por sesión respetando la mayúscula', () => {
    expect(comoSesion('Ven a la clase, es hoy')).toBe('Ven a la sesión, es hoy')
    expect(comoSesion('Clases anteriores')).toBe('Sesiones anteriores')
    expect(comoSesion('Repasa la presentación de la clase')).toBe('Repasa la presentación de la sesión')
    expect(comoSesion('Entrar a la clase')).toBe('Entrar a la sesión')
  })
  test('solo en el Spreek Club', () => {
    expect(textosDeClase('Spreek Club')('La clase')).toBe('La sesión')
    expect(textosDeClase('Masterclass')('La clase')).toBe('La clase')
    expect(textosDeClase('Conversatieles')('La clase')).toBe('La clase')
    expect(textosDeClase(undefined)('La clase')).toBe('La clase')
  })
})
