import { describe, expect, test } from 'bun:test'
import { claveDeLaVieja, grabacionDe, grabacionesDe, rutaDeClase, vecinasDe } from '../verGrabacion'

const BUNNY = { tipo: 'bunny', url: 'https://iframe.mediadelivery.net/embed/1/a' }
const VID = (uuid: string, extra: any = {}) => ({ activity_uuid: uuid, nombre: 'Grabación', tipo: 'grabacion', hecha: false, video: BUNNY, ...extra })
const S = (id: number, fecha: string, extra: any = {}): any => ({ id, fecha, tema: `Tema ${id}`, course_uuid: 'c', clases: [], ...extra })
const SALA = (vista = false) => ({ partes: [{ id: 'p1', desde: 0, hasta: 60 }], titulo: 'Clase', segundos: 60, vista })

describe('las grabaciones de una clase', () => {
  const datos: any = {
    semanas: [
      S(3, '2026-11-17', { grabacion_sala: SALA(true) }),
      S(2, '2026-11-10', { clases: [VID('activity_b'), { activity_uuid: 'activity_p', tipo: 'presentacion', nombre: 'P', hecha: false }] }),
      S(4, '2026-11-24'), // sin grabación todavía
    ],
    archivo: [VID('activity_a', { fecha: '2026-10-14', tema: 'Het weer', profe: 'Paul', suelta: true })],
  }
  test('juntas y de la más antigua a la más nueva, sin las semanas sin grabación', () => {
    expect(grabacionesDe(datos).map((g) => [g.clave, g.de])).toEqual([
      ['a', 'clase'],
      ['b', 'clase'],
      ['semana-3', 'sala'],
    ])
  })
  test('sin las de los meses de antes si la clase no las enseña (Spreekclub, Masterclass)', () => {
    expect(grabacionesDe(datos, false).map((g) => g.clave)).toEqual(['b', 'semana-3'])
  })
  test('anterior y siguiente', () => {
    const l = grabacionesDe(datos)
    const v = vecinasDe(l, 'activity_b')
    expect([v.anterior?.clave, v.siguiente?.clave]).toEqual(['a', 'semana-3'])
    expect(vecinasDe(l, 'a').anterior).toBeNull()
    expect(vecinasDe(l, 'nada')).toEqual({ anterior: null, siguiente: null })
  })
  test('la suelta trae su día y su profe; la de la sala, si ya la vio', () => {
    const l = grabacionesDe(datos)
    expect([grabacionDe(l, 'a')?.tema, grabacionDe(l, 'a')?.profe]).toEqual(['Het weer', 'Paul'])
    expect(grabacionDe(l, 'semana-3')?.vista).toBe(true)
  })
  test('un enlace pegado cuenta como enlace; una sala sin nada, no sale', () => {
    const d: any = { semanas: [S(5, '2026-11-01', { grabacion_sala: { partes: [], enlace: { tipo: 'bunny', url: 'u', original: 'u' }, titulo: '', segundos: 0, vista: false } }), S(6, '2026-11-02', { grabacion_sala: { partes: [], titulo: '', segundos: 0, vista: false } })] }
    expect(grabacionesDe(d).map((g) => [g.clave, g.de])).toEqual([['semana-5', 'enlace']])
  })
  test('lo que el servidor no le da al alumno (aún no ve la grabación) no sale', () => {
    expect(grabacionesDe({ semanas: [S(7, '2026-12-01')] } as any)).toEqual([])
  })
})

describe('a dónde lleva cada clase', () => {
  test('una grabación que se sabe reproducir, a su página; lo demás, al curso', () => {
    expect(rutaDeClase('course_x', VID('activity_b') as any)).toBe('/grabacion/x/b')
    expect(rutaDeClase('x', VID('activity_b', { video: null }) as any)).toBe('/course/x/activity/b')
    expect(rutaDeClase('x', { activity_uuid: 'activity_e', tipo: 'ejercicios' } as any)).toBe('/course/x/activity/e')
  })
  test('la dirección vieja solo redirige si es una grabación de esa clase', () => {
    const d: any = { semanas: [S(2, '2026-11-10', { clases: [VID('activity_b')] })], archivo: [VID('activity_a', { fecha: '2026-10-14' })] }
    expect(claveDeLaVieja(d, 'activity_b')).toBe('b')
    expect(claveDeLaVieja(d, 'activity_a')).toBe('a')
    expect(claveDeLaVieja(d, 'activity_z')).toBe('')
  })
})
