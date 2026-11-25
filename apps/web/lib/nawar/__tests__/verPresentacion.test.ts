import { describe, expect, test } from 'bun:test'
import { opcionesDe, opcionInicial, tienePresentacion, vecinas } from '../verPresentacion'

const S = (id: number, fecha: string, extra: any = {}): any => ({ id, fecha, tema: `Tema ${id}`, course_uuid: 'c', clases: [], ...extra })
const PDF = (uuid: string, hecha = false) => ({ activity_uuid: uuid, nombre: 'Presentación', tipo: 'presentacion', hecha })

describe('qué presentación se abre', () => {
  test('el alumno, antes de la clase, la de antes', () => {
    const o = opcionesDe(S(1, '2026-11-25', { clases: [PDF('activity_1', true)] }), false)
    expect(o.map((x) => [x.tipo, x.actividad, x.hecha])).toEqual([['antes', 'activity_1', true]])
  })
  test('el alumno, con la versión de su clase guardada, SOLO esa', () => {
    const o = opcionesDe(S(1, '2026-11-18', { clases: [PDF('activity_1')], notas_clase: { at: 't', paginas: 9 } }), false)
    expect(o.map((x) => [x.tipo, x.semanaPdf])).toEqual([['clase', 1]])
  })
  test('el alumno que esa semana fue a la clase del otro grupo ve la de esa clase', () => {
    const o = opcionesDe(S(1, '2026-11-18', { notas_clase: { at: 't', paginas: 9, semana_id: 77 } }), false)
    expect(o[0].semanaPdf).toBe(77)
  })
  test('el equipo ve todas las de la clase y la versión de los alumnos', () => {
    const material_profe = {
      pizarra: {
        presentaciones: [
          { id: 'profe:a', de: 'equipo', nombre: 'Dossier.pdf', por: 'Rida', en_pizarra: true, notas: { at: 't', por: 'Luna', paginas: 2 } },
          { id: 'clase:activity_1', de: 'alumnos', nombre: 'Para antes.pdf', por: '', en_pizarra: false, notas: null },
          { id: 'blanco', de: 'blanco', nombre: 'Pizarra en blanco', por: '', en_pizarra: false, notas: null },
        ],
        publicada: { at: 't2', por: 'Luna', paginas: 12 },
      },
    }
    const semana = S(1, '2026-11-18', { clases: [PDF('activity_1')], material_profe })
    const o = opcionesDe(semana, true)
    expect(o.map((x) => x.tipo)).toEqual(['equipo', 'antes', 'clase'])
    expect(o[0].detalle).toBe('Solo el equipo · la subió Rida · con notas de la pizarra')
    expect(o[1].actividad).toBe('activity_1')
    // De entrada, lo que ven ahora los alumnos: ya dada, la versión de la clase.
    expect(opcionInicial(o, semana, true, '2026-11-20')?.tipo).toBe('clase')
    // Antes de la clase, la de antes.
    expect(opcionInicial(o, semana, true, '2026-11-10')?.tipo).toBe('antes')
  })
  test('sin nada, nada', () => {
    expect(opcionesDe(S(1, '2026-11-18'), false)).toEqual([])
    expect(opcionInicial([], S(1, '2026-11-18'), false, '2026-11-20')).toBeNull()
  })
})

describe('anterior y siguiente', () => {
  const semanas = [
    S(1, '2026-11-04', { clases: [PDF('a')] }),
    S(2, '2026-11-11'), // sin presentación
    S(3, '2026-11-18', { clases: [PDF('b')] }),
    S(4, '2026-11-25', { clases: [PDF('c')] }),
  ]
  test('salta las semanas sin presentación', () => {
    const v = vecinas(semanas, 3, false, false, '2026-11-20')
    expect(v.anterior?.id).toBe(1)
    expect(v.siguiente?.id).toBe(4)
  })
  test('la primera no tiene anterior; la última, siguiente', () => {
    expect(vecinas(semanas, 1, false, false, '2026-11-20').anterior).toBeNull()
    expect(vecinas(semanas, 4, false, false, '2026-11-20').siguiente).toBeNull()
  })
  test('en la Masterclass y el Spreek Club el alumno no ve la de una sesión que aún no se ha dado', () => {
    expect(tienePresentacion(semanas[3], false, true, '2026-11-20')).toBe(false)
    expect(vecinas(semanas, 3, false, true, '2026-11-20').siguiente).toBeNull()
    // El equipo sí.
    expect(vecinas(semanas, 3, true, true, '2026-11-20').siguiente?.id).toBe(4)
  })
})

describe('Spreek Club: con notas y sin notas (25/11/2026)', () => {
  test('el alumno elige entre las dos, de la misma semana', () => {
    const o = opcionesDe(S(1, '2026-11-18', { notas_clase: { at: 't', paginas: 9, limpia: true, semana_id: 77 } }), false)
    expect(o.map((x) => [x.tipo, x.semanaPdf])).toEqual([
      ['clase', 77],
      ['limpia', 77],
    ])
  })
  test('sin la versión limpia, como siempre: una sola', () => {
    const o = opcionesDe(S(1, '2026-11-18', { notas_clase: { at: 't', paginas: 9, limpia: false } }), false)
    expect(o.map((x) => x.tipo)).toEqual(['clase'])
  })
})
