import { describe, expect, test } from 'bun:test'
import { cuantosAlumnos, datosDelEjercicio, nombreDeTipo, textoParaCopiar, type GrupoDeFallos } from '../fallosEjercicios'

describe('«¿Ves un fallo? Avísanos»', () => {
  test('lo que se manda del ejercicio', () => {
    const d = datosDelEjercicio(
      { id: 'm2l1e-7', type: 'order_sentence', prompt: 'Ordena: «Él es mi amigo»', options: ['Hij', 'is', 'mijn', 'vriend'], correctAnswer: 'Hij is mijn vriend', alsoAccept: ['Hij is een vriend'] },
      '  Hij is een vriend ',
      { leccion: 'Les 1 · Familie', modulo: 'Familie & vrienden', activityUuid: 'activity_x' }
    )
    expect(d.respuesta_alumno).toBe('Hij is een vriend')
    expect(d.correcta).toBe('Hij is mijn vriend')
    expect(d.tambien).toEqual(['Hij is een vriend'])
    expect(d.activity_uuid).toBe('activity_x')
    expect(d.course_uuid).toBe('')
    // Emparejar: las parejas, con nombres que se entienden.
    const p = datosDelEjercicio({ id: 'x', type: 'match_pairs', prompt: 'Empareja', correctAnswer: '', pairs: [{ left: 'de naam', right: 'el nombre' }] }, undefined)
    expect(p.parejas).toEqual([{ izquierda: 'de naam', derecha: 'el nombre' }])
    expect(p.respuesta_alumno).toBe('')
  })

  test('el texto para copiar no lleva nombres de alumnos', () => {
    const g: GrupoDeFallos = {
      lesson_id: 'm2-les-1-familie',
      exercise_id: 'm2l1e-7',
      datos: { tipo: 'order_sentence', enunciado: 'Ordena: «Él es mi amigo»', opciones: ['Hij', 'is', 'mijn', 'vriend'], correcta: 'Hij is mijn vriend', leccion: 'Les 1 · Familie', modulo: 'Familie & vrienden' },
      avisos: [
        { nombre: 'Ana López', motivo: 'respuesta', motivo_texto: 'La respuesta buena no es esa', comentario: 'Según la lección es «mi novio»', respuesta_alumno: 'Hij is een vriend', estado: 'nuevo', at: '' },
        { nombre: 'Luis', motivo: 'otra', motivo_texto: 'Otra cosa', comentario: '', respuesta_alumno: '', estado: 'nuevo', at: '' },
      ],
      abiertos: 2,
      alumnos: 2,
      ultimo: '',
      estado: 'nuevo',
      cerrado_at: '',
      cerrado_por: '',
    }
    const t = textoParaCopiar(g)
    expect(t).toContain('Lección: Familie & vrienden · Les 1 · Familie (m2-les-1-familie)')
    expect(t).toContain('Ejercicio: m2l1e-7 · Ordenar la frase (order_sentence)')
    expect(t).toContain('Respuesta que da por buena la escuela: Hij is mijn vriend')
    expect(t).toContain('1. La respuesta buena no es esa · contestó «Hij is een vriend» · «Según la lección es «mi novio»»')
    expect(t).toContain('2. Otra cosa')
    expect(t).not.toContain('Ana')
    expect(t).not.toContain('Luis')
  })

  test('palabras', () => {
    expect(cuantosAlumnos(1)).toBe('1 alumno')
    expect(cuantosAlumnos(3)).toBe('3 alumnos')
    expect(nombreDeTipo('true_false')).toBe('Verdadero o falso')
    expect(nombreDeTipo('nuevo_tipo')).toBe('nuevo_tipo')
  })
})
