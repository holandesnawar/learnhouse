import { describe, expect, test } from 'bun:test'
import { paraPreparar, type SemanaEquipo } from '../salaProfes'

const s = (o: Partial<SemanaEquipo>): SemanaEquipo => ({
  key: o.key || 'k', semanaId: 1, courseUuid: 'a', curso: 'Clase semanal', color: '#000', tema: 't', fecha: '', hora: '', profe: '',
  presentaciones: [], grabaciones: [], ejercicios: [], tieneTarea: false, enunciado: '', lista: { pasada: false, vinieron: 0 }, porCorregir: 0, ...o,
})
const HOY = '2026-11-08' // domingo

describe('para preparar', () => {
  test('el domingo, la siguiente es la del martes y la anterior la del martes pasado', () => {
    const r = paraPreparar(
      [{ uuid: 'a', nombre: 'A' }],
      [s({ key: '1', fecha: '2026-11-03', grabaciones: [{ activity_uuid: 'g', nombre: 'g' }] }), s({ key: '2', fecha: '2026-11-10' }), s({ key: '3', fecha: '2026-11-17' })],
      HOY
    )[0]
    expect(r.siguiente?.key).toBe('2')
    expect(r.despues?.key).toBe('3')
    expect(r.anterior?.key).toBe('1')
    expect(r.pendiente).toEqual(['lista'])
  })

  test('hoy cuenta como la siguiente', () => {
    const r = paraPreparar([{ uuid: 'a', nombre: 'A' }], [s({ key: 'h', fecha: HOY })], HOY)[0]
    expect(r.siguiente?.key).toBe('h')
    expect(r.anterior).toBeNull()
  })

  test('lo de hace más de 10 días no sale como pendiente; grabaciones sueltas no cuentan', () => {
    const r = paraPreparar([{ uuid: 'a', nombre: 'A' }], [s({ key: 'v', fecha: '2026-10-20' }), s({ key: 'x', fecha: '2026-11-05', suelta: true })], HOY)[0]
    expect(r.anterior).toBeNull()
    expect(r.siguiente).toBeNull()
  })

  test('la clase con la próxima más cerca, arriba; sin próxima, al final', () => {
    const r = paraPreparar(
      [{ uuid: 'a', nombre: 'A' }, { uuid: 'b', nombre: 'B' }, { uuid: 'c', nombre: 'C' }],
      [s({ courseUuid: 'a', fecha: '2026-11-12' }), s({ courseUuid: 'b', fecha: '2026-11-10' })],
      HOY
    )
    expect(r.map((x) => x.clase.uuid)).toEqual(['b', 'a', 'c'])
  })

  test('corregir y grabación pendientes de la anterior', () => {
    const r = paraPreparar([{ uuid: 'a', nombre: 'A' }], [s({ fecha: '2026-11-05', porCorregir: 2, lista: { pasada: true, vinieron: 4 } })], HOY)[0]
    expect(r.pendiente).toEqual(['grabacion', 'corregir'])
  })
})
