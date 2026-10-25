import { describe, expect, test } from 'bun:test'
import { CURSO_CLASE_SEMANAL_UUID, CURSO_FORMACION_UUID, cursosEnDirecto } from '../cursos'

describe('las clases en directo de cada alumno', () => {
  const formacion = { course_uuid: `course_${CURSO_FORMACION_UUID}`, name: 'Formación', published: true }
  const semanal = { course_uuid: `course_${CURSO_CLASE_SEMANAL_UUID}`, name: 'Clases Nawar', published: true }
  const master = { course_uuid: 'course_abc', name: 'Masterclass y Spreekuren', published: true }

  test('la beta ve la clase semanal; la formación nunca sale', () => {
    expect(cursosEnDirecto([formacion, semanal])).toEqual([{ uuid: CURSO_CLASE_SEMANAL_UUID, nombre: 'Clase semanal' }])
  })

  test('el programa nuevo ve su curso con su nombre', () => {
    expect(cursosEnDirecto([master, formacion])).toEqual([{ uuid: 'abc', nombre: 'Masterclass y Spreekuren' }])
  })

  test('el equipo ve los dos, la clase semanal primero, y no los borradores', () => {
    const borrador = { course_uuid: 'course_zzz', name: 'Borrador', published: false }
    expect(cursosEnDirecto([master, borrador, semanal, formacion]).map((c) => c.nombre)).toEqual([
      'Clase semanal',
      'Masterclass y Spreekuren',
    ])
  })

  test('sin lista, nada', () => {
    expect(cursosEnDirecto(undefined as any)).toEqual([])
  })
})
