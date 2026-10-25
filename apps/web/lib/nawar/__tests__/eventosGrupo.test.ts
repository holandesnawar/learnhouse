import { describe, expect, test } from 'bun:test'
import { eventoParaMi, paraQuien } from '../eventosGrupo'

const beta = { grupos: [1, 9], equipo: false, todos: [] }
const nuevo = { grupos: [2], equipo: false, todos: [] }
const equipo = { grupos: [], equipo: true, todos: [{ id: 1, nombre: 'Beta' }, { id: 2, nombre: 'Programa nuevo' }] }

describe('qué eventos ve cada uno', () => {
  test('sin grupos, todos', () => {
    expect(eventoParaMi({ grupos: [] }, nuevo)).toBe(true)
    expect(eventoParaMi({}, undefined)).toBe(true)
  })
  test('la clase semanal, solo la beta y el equipo', () => {
    const clase = { grupos: [1] }
    expect(eventoParaMi(clase, beta)).toBe(true)
    expect(eventoParaMi(clase, nuevo)).toBe(false)
    expect(eventoParaMi(clase, equipo)).toBe(true)
  })
  test('sin saber aún sus grupos, el de grupo no se enseña', () => {
    expect(eventoParaMi({ grupos: [2] }, null)).toBe(false)
  })
  test('el rótulo para el equipo', () => {
    expect(paraQuien({ grupos: [1] }, equipo.todos)).toBe('Solo Beta')
    expect(paraQuien({}, equipo.todos)).toBe('Para todos')
    expect(paraQuien({ grupos: [7] }, equipo.todos)).toBe('Solo un grupo')
  })
})
