import { describe, expect, test } from 'bun:test'
import { bloquesDeTexto, loQueToca, misTareas, porMeses, proximaClase, semanaDeCadaClase, trozosNegrita, type SemanaEquipo } from '../salaProfes'

const s = (o: Partial<SemanaEquipo>): SemanaEquipo => ({
  key: o.key || 'k',
  semanaId: 1,
  courseUuid: 'a',
  curso: 'Clase semanal',
  color: '#000',
  tema: 'De kleding',
  fecha: '',
  hora: '',
  profe: '',
  presentaciones: [],
  grabaciones: [],
  ejercicios: [],
  tieneTarea: false,
  enunciado: '',
  lista: { pasada: false, vinieron: 0 },
  porCorregir: 0,
  ...o,
})

const HOY = '2026-11-08' // domingo

describe('lo que toca', () => {
  test('presentación, lista y grabación según el día', () => {
    const semanas = [
      s({ key: 'futura', fecha: '2026-11-10' }),
      s({ key: 'lejos', fecha: '2026-11-20' }),
      s({ key: 'ayer', fecha: '2026-11-07', presentaciones: [{ activity_uuid: 'p', nombre: 'P' }] }),
      s({ key: 'vieja', fecha: '2026-11-01', presentaciones: [{ activity_uuid: 'p', nombre: 'P' }], lista: { pasada: true, vinieron: 4 } }),
      s({ key: 'lista-ok', fecha: '2026-11-05', presentaciones: [{ activity_uuid: 'p', nombre: 'P' }], grabaciones: [{ activity_uuid: 'g', nombre: 'G' }], lista: { pasada: true, vinieron: 5 } }),
    ]
    const t = loQueToca(semanas, HOY, 3, 1)
    const ids = t.map((p) => p.id)
    expect(ids).toContain('p-futura')
    expect(ids).not.toContain('p-lejos')
    // Pasar lista ya no es tarea: la sala cuenta sola (09/11).
    expect(ids).not.toContain('l-ayer')
    expect(ids).toContain('g-ayer')
    expect(ids).toContain('g-vieja')
    expect(ids).not.toContain('l-vieja')
    expect(ids.some((i) => i.endsWith('lista-ok'))).toBe(false)
    expect(ids).toContain('corregir')
    expect(ids).toContain('checkin')
    // Urgente arriba: la presentación del martes (en 2 días) y la grabación de hace 7 días.
    expect(t.filter((p) => p.urgente).map((p) => p.id)).toEqual(['g-vieja', 'p-futura'])
    expect(t.find((p) => p.id === 'p-futura')?.detalle).toBe('Clase semanal · el martes 10 nov')
  })

  test('próxima clase y la de cada clase esta semana', () => {
    const semanas = [s({ key: 'x', fecha: '2026-11-12' }), s({ key: 'y', fecha: '2026-11-09', courseUuid: 'b' }), s({ key: 'z', fecha: '2026-11-03' })]
    expect(proximaClase(semanas, HOY)?.key).toBe('y')
    expect(semanaDeCadaClase(semanas, HOY, '2026-11-09').map((x) => x.key)).toEqual(['y', 'x'])
  })
})

test('el archivo por meses, lo más nuevo arriba', () => {
  const g = porMeses([{ fecha: '2026-10-14' }, { fecha: '2026-11-03' }, { fecha: '' }, { fecha: '2026-11-07' }])
  expect(g.map((x) => x.titulo)).toEqual(['noviembre 2026', 'octubre 2026', 'Sin fecha'])
  expect(g[0].items.map((x) => x.fecha)).toEqual(['2026-11-07', '2026-11-03'])
})

test('el formato del manual', () => {
  const b = bloquesDeTexto('## Antes\n1. Uno\n2. Dos\n\n- a\n- b\nTexto suelto\n### Sub')
  expect(b.map((x) => x.tipo)).toEqual(['h2', 'ol', 'ul', 'p', 'h3'])
  expect((b[1] as any).items).toEqual(['Uno', 'Dos'])
  expect(trozosNegrita('Sube y **publícala** ya')).toEqual([
    { t: 'Sube y ', negrita: false },
    { t: 'publícala', negrita: true },
    { t: ' ya', negrita: false },
  ])
})

test('mis tareas', () => {
  const t = [
    { id: 1, estado: 'por-hacer', asignado_id: 0, fecha: '', prioridad: 'normal', orden: 0 },
    { id: 2, estado: 'por-hacer', asignado_id: 5, fecha: '2026-11-09', prioridad: 'normal', orden: 0 },
    { id: 3, estado: 'hecho', asignado_id: 5, fecha: '2026-11-01', prioridad: 'normal', orden: 0 },
    { id: 4, estado: 'en-curso', asignado_id: 6, fecha: '2026-11-01', prioridad: 'alta', orden: 0 },
    { id: 5, estado: 'en-curso', asignado_id: 5, fecha: '2026-11-01', prioridad: 'normal', orden: 0 },
  ]
  expect(misTareas(t, 5).map((x) => x.id)).toEqual([5, 2, 1])
})

test('mis clases: la semana de esta semana y la de la que viene', async () => {
  const { porClase } = await import('../salaProfes')
  const clases = [
    { uuid: 'a', nombre: 'Clase semanal · rood' },
    { uuid: 'b', nombre: 'Spreekclub' },
    { uuid: 'c', nombre: 'Clase semanal · blauw' },
  ]
  const semanas = [
    s({ key: 'a1', courseUuid: 'a', fecha: '2026-11-10' }),
    s({ key: 'a2', courseUuid: 'a', fecha: '2026-11-17' }),
    s({ key: 'c1', courseUuid: 'c', fecha: '2026-11-12' }),
    s({ key: 'viejo', courseUuid: 'b', fecha: '2026-11-03' }),
  ]
  const r = porClase(clases, semanas, '2026-11-09')
  expect(r.map((x) => [x.clase.uuid, x.esta?.key || null, x.proxima?.key || null])).toEqual([
    ['a', 'a1', 'a2'],
    ['c', 'c1', null],
    ['b', null, null],
  ])
})
