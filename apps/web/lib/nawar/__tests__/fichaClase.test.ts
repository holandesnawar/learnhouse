import { describe, expect, test } from 'bun:test'
import { clasesDadasPorProfe, estadoDeClase, tieneDocumento, type SemanaEquipo } from '../salaProfes'
import { diaQueToca } from '../../../components/Pages/Equipo/NuevaClase'

const s = (o: Partial<SemanaEquipo>): SemanaEquipo => ({
  key: o.key || 'k', semanaId: 1, courseUuid: 'a', curso: 'Clase semanal', color: '#000', tema: '', fecha: '', hora: '', profe: '',
  presentaciones: [], grabaciones: [], ejercicios: [], tieneTarea: false, enunciado: '', lista: null, porCorregir: 0, ...o,
})
const HOY = '2026-11-12' // jueves
const pdf = { id: '1', tipo: 'archivo' as const, nombre: 'Mijn huis.pdf', por: 'Rida', at: '' }

describe('la ficha de la clase', () => {
  test('el documento de la pizarra: un PDF del profe o la presentación de los alumnos', () => {
    expect(tieneDocumento(s({}))).toBe(false)
    expect(tieneDocumento(s({ material: { notas: '', archivos: [pdf] } }))).toBe(true)
    expect(tieneDocumento(s({ material: { notas: '', archivos: [{ ...pdf, nombre: 'clase.pptx' }] } }))).toBe(false)
    expect(tieneDocumento(s({ material: { notas: '', archivos: [{ ...pdf, tipo: 'enlace', nombre: 'guia.pdf' }] } }))).toBe(false)
    expect(tieneDocumento(s({ presentaciones: [{ activity_uuid: 'x', nombre: 'Presentación' }] }))).toBe(true)
  })

  test('el estado sale de lo que lleva dentro', () => {
    // Recién creada desde el calendario: sin nada.
    expect(estadoDeClase(s({ fecha: '2026-11-17' }), HOY)).toEqual({ estado: 'por-preparar', texto: 'Por preparar', faltan: ['quién la da', 'el tema', 'el documento'] })
    // Con el profe de la clase ya solo faltan el tema y el documento.
    expect(estadoDeClase(s({ fecha: '2026-11-17' }), HOY, 'Paul').faltan).toEqual(['el tema', 'el documento'])
    const completa = s({ fecha: '2026-11-17', tema: 'Mijn huis', material: { notas: '', archivos: [pdf], profe: 'Luna' } })
    expect(estadoDeClase(completa, HOY).estado).toBe('lista')
    expect(estadoDeClase({ ...completa, fecha: HOY }, HOY)).toEqual({ estado: 'hoy', texto: 'Hoy', faltan: [] })
    expect(estadoDeClase(s({ fecha: HOY }), HOY).faltan.length).toBe(3)
    // Ya dada: no se le pide nada.
    expect(estadoDeClase(s({ fecha: '2026-11-05' }), HOY)).toEqual({ estado: 'dada', texto: 'Dada', faltan: [] })
  })

  test('quién ha dado qué, por mes', () => {
    const r = clasesDadasPorProfe(
      [
        s({ key: '1', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-03' }),
        s({ key: '2', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-10' }),
        s({ key: '3', courseUuid: 'mc', curso: 'Masterclass', fecha: '2026-11-06', material: { notas: '', archivos: [], profe: 'Luna' } }),
        s({ key: '4', courseUuid: 'mc', curso: 'Masterclass', fecha: '2026-10-30' }),
        s({ key: '5', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: HOY }), // hoy: aún no cuenta
        s({ key: '6', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-19' }),
        s({ key: '7', courseUuid: 'rood', curso: 'x', fecha: '2026-11-01', suelta: true }),
      ],
      { rood: 'Paul', mc: '' },
      HOY
    )
    expect(r.map((m) => [m.mes, m.total])).toEqual([['2026-11', 3], ['2026-10', 1]])
    expect(r[0].titulo).toBe('noviembre 2026')
    expect(r[0].profes).toEqual([
      { nombre: 'Paul', clases: 2, porClase: [{ curso: 'Clase semanal · Groep rood', clases: 2 }] },
      { nombre: 'Luna', clases: 1, porClase: [{ curso: 'Masterclass', clases: 1 }] },
    ])
    expect(r[1].profes[0].nombre).toBe('Sin profe')
  })

  test('«Nueva clase» propone el día que toca', () => {
    const semanas = [s({ courseUuid: 'rood', fecha: '2026-11-03' }), s({ courseUuid: 'rood', fecha: '2026-11-10' }), s({ courseUuid: 'mc', fecha: '2026-11-20' })]
    // La última fue el martes 10: toca el martes 17.
    expect(diaQueToca('rood', semanas, HOY)).toBe('2026-11-17')
    // Ya tiene una por delante: la siguiente.
    expect(diaQueToca('mc', semanas, HOY)).toBe('2026-11-27')
    // Llevaba semanas sin clase: su próximo día de siempre, no una fecha pasada.
    expect(diaQueToca('rood', [s({ courseUuid: 'rood', fecha: '2026-10-06' })], HOY)).toBe('2026-11-17')
    // Sin ninguna clase todavía: hoy.
    expect(diaQueToca('nueva', semanas, HOY)).toBe(HOY)
  })
})
