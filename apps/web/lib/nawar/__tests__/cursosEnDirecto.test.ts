import { describe, expect, test } from 'bun:test'
import {
  CURSO_CLASE_SEMANAL_UUID,
  CURSO_FORMACION_UUID,
  ajustesDirecto,
  colorDeEtiqueta,
  conGrabadas,
  cursosEnDirecto,
  esCursoEnDirecto,
} from '../cursos'

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

describe('qué curso se pinta como clase en directo', () => {
  test('la clase semanal de siempre, aunque no tenga nada guardado', () => {
    expect(esCursoEnDirecto(`course_${CURSO_CLASE_SEMANAL_UUID}`, {})).toBe(true)
    expect(esCursoEnDirecto(CURSO_CLASE_SEMANAL_UUID, undefined)).toBe(true)
  })

  test('otro curso, en cuanto tiene la sala encendida, y lo sigue siendo al apagarla', () => {
    const config = { salas: { 'grupo-2': { activo: true }, viejo: { activo: false, directo: true } } }
    expect(esCursoEnDirecto('course_grupo-2', config)).toBe(true)
    expect(esCursoEnDirecto('viejo', config)).toBe(true)
  })

  test('la formación y los cursos sin sala, no', () => {
    expect(esCursoEnDirecto(`course_${CURSO_FORMACION_UUID}`, { salas: {} })).toBe(false)
    expect(esCursoEnDirecto('otro', { salas: { otro: { activo: false } } })).toBe(false)
    expect(esCursoEnDirecto('', null)).toBe(false)
  })

  test('los ajustes, con el recuadro de cada curso', () => {
    const config = { salas: { abc: { activo: true, grabar: true, banner: { teacher: 'Paul' } } } }
    expect(ajustesDirecto(config, 'course_abc')).toEqual({
      activo: true, grabar: true, directo: false, grabadas: null, banner: { teacher: 'Paul' }, etiqueta: '',
    })
    expect(ajustesDirecto(null, 'abc')).toEqual({ activo: false, grabar: true, directo: false, grabadas: null, banner: null, etiqueta: '' })
  })

  test('las clases grabadas: sin decidir, solo en la clase semanal de siempre', () => {
    const config = { salas: { spreek: { directo: true }, master: { directo: true, grabadas: false }, copia: { grabadas: true } } }
    expect(conGrabadas(config, CURSO_CLASE_SEMANAL_UUID)).toBe(true)
    expect(conGrabadas(config, 'course_spreek')).toBe(false)
    expect(conGrabadas(config, 'master')).toBe(false)
    expect(conGrabadas(config, 'copia')).toBe(true)
    // Se pueden quitar también de la de siempre.
    expect(conGrabadas({ salas: { [CURSO_CLASE_SEMANAL_UUID]: { grabadas: false } } }, CURSO_CLASE_SEMANAL_UUID)).toBe(false)
  })
})

describe('etiqueta de un curso (29/10/2026)', () => {
  test('se lee de sus ajustes y su color sale de la palabra', () => {
    expect(ajustesDirecto({ salas: { abc: { etiqueta: ' Groep rood ' } } }, 'course_abc').etiqueta).toBe('Groep rood')
    expect(ajustesDirecto({}, 'abc').etiqueta).toBe('')
    expect(colorDeEtiqueta('Groep rood')).toBe('rojo')
    expect(colorDeEtiqueta('Groep Blauw')).toBe('azul')
    expect(colorDeEtiqueta('Grupo verde')).toBe('verde')
    expect(colorDeEtiqueta('Martes')).toBe('gris')
    // «roodborst» no es rojo: palabra entera.
    expect(colorDeEtiqueta('roodborst')).toBe('gris')
  })
})
