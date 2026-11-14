import { describe, expect, test } from 'bun:test'
import { mensajeAtascado, resumenAtasco } from '../atascados'

describe('WhatsApp a un alumno atascado', () => {
  test('con su nombre de pila, quien escribe, la clase y el enlace', () => {
    const t = mensajeAtascado({ nombre: 'Marta López', yo: 'Rida', clase: '1.4 Lezen', enlace: 'https://x/y', sinEmpezar: false })
    expect(t).toContain('Hola Marta, soy Rida de Holandés Nawar')
    expect(t).toContain('sin avanzar')
    expect(t).toContain('Te toca «1.4 Lezen», son unos minutos: https://x/y')
  })
  test('quien no ha empezado recibe otro texto, y sin nombre de cuenta firma el equipo', () => {
    const t = mensajeAtascado({ nombre: '', yo: '', clase: '', enlace: '', sinEmpezar: true })
    expect(t).toContain('Hola, soy del equipo de Holandés Nawar')
    expect(t).toContain('todavía no has empezado')
    expect(t).not.toContain('Te toca')
  })
  test('resumen', () => {
    expect(resumenAtasco(18, false)).toBe('18 días sin terminar una clase')
    expect(resumenAtasco(20, true)).toBe('Entró hace 20 días y no ha hecho ninguna clase')
    expect(resumenAtasco(null, false)).toBe('')
  })
})
