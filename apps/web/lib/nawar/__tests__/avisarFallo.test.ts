import { describe, expect, test } from 'bun:test'
import { resumirError } from '../avisarFallo'

describe('Avisar de una pantalla rota', () => {
  test('el mensaje lleva el tipo de error y la primera línea de la pila', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'tema')")
    e.stack = "TypeError: Cannot read properties of undefined (reading 'tema')\n    at Semana (https://x/_next/static/chunks/a.js:1:2)\n    at div"
    const r = resumirError(e)
    expect(r.mensaje).toBe("TypeError: Cannot read properties of undefined (reading 'tema')")
    expect(r.pila).toBe('at Semana (https://x/_next/static/chunks/a.js:1:2)')
  })

  test('un Error a secas no repite «Error:» y lo que no es un error también vale', () => {
    expect(resumirError(new Error('se rompió')).mensaje).toBe('se rompió')
    expect(resumirError('texto suelto').mensaje).toBe('texto suelto')
    expect(resumirError(null).mensaje).toBe('')
  })

  test('la pila de Safari (sin «at») también se lee', () => {
    const e = new Error('x')
    e.stack = 'Semana@https://x/_next/static/chunks/a.js:1:2\ndiv@[native code]'
    expect(resumirError(e).pila).toBe('Semana@https://x/_next/static/chunks/a.js:1:2')
  })
})
