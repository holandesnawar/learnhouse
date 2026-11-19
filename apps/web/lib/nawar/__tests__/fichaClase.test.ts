import { describe, expect, test } from 'bun:test'
import { clasesDadasPorProfe, clasesSinDatos, estadoDeClase, huboClase, quienLaDio, textoAsistencia, tieneDocumento, tituloDeClase, type SemanaEquipo } from '../salaProfes'
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
        s({ key: '1', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-03', lista: { pasada: true, vinieron: 5 } }),
        s({ key: '2', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-10', grabacionSala: true }),
        s({ key: '3', courseUuid: 'mc', curso: 'Masterclass', fecha: '2026-11-06', material: { notas: '', archivos: [], profe: 'Luna', despues: { texto: 'Bien', por: 'Luna', at: '' } } }),
        s({ key: '4', courseUuid: 'mc', curso: 'Masterclass', fecha: '2026-10-30', grabaciones: [{ activity_uuid: 'g', nombre: 'Grabación' }] }),
        // Sin ningún dato de que se diera: no cuenta (16/11/2026).
        s({ key: '8', courseUuid: 'rood', curso: 'Clase semanal · Groep rood', fecha: '2026-11-11', lista: { pasada: true, vinieron: 0 } }),
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

  test('solo cuenta como dada la clase de la que hay algún dato', () => {
    expect(huboClase(s({ fecha: '2026-11-03' }))).toBe(false)
    expect(huboClase(s({ fecha: '2026-11-03', presentaciones: [{ activity_uuid: 'p', nombre: 'P' }] }))).toBe(false)
    expect(huboClase(s({ fecha: '2026-11-03', material: { notas: '', archivos: [], pizarra: { guardada_at: 'x', publicada_at: '', paginas: 3 } } }))).toBe(true)
    const sin = clasesSinDatos([s({ key: 'a', fecha: '2026-11-03' }), s({ key: 'b', fecha: '2026-11-04', grabacionSala: true }), s({ key: 'c', fecha: '2026-11-20' })], HOY)
    expect(sin.map((x) => x.key)).toEqual(['a'])
  })

  test('la sala cuenta sola quién vino y quién la dio (19/11/2026)', () => {
    const luna = { nombre: 'Luna Zegers', segundos: 3000, rol: 5 }
    const rida = { nombre: 'Rida Nawar', segundos: 3600, rol: 1 }
    // Con alumnos o alguien del equipo 10 min en la sala, la clase se dio.
    expect(huboClase(s({ fecha: '2026-11-18', lista: { pasada: false, vinieron: 4, en_sala: 4 } }))).toBe(true)
    expect(huboClase(s({ fecha: '2026-11-18', lista: { pasada: false, vinieron: 0, equipo: [{ ...luna, segundos: 120 }] } }))).toBe(false)
    expect(huboClase(s({ fecha: '2026-11-18', lista: { pasada: false, vinieron: 0, equipo: [luna] } }))).toBe(true)
    // Figura Paul, pero la dio Luna (el profe antes que el administrador).
    const sem = s({ fecha: '2026-11-18', lista: { pasada: false, vinieron: 4, equipo: [rida, luna] } })
    expect(quienLaDio(sem, 'Paul')).toBe('Luna Zegers')
    // Si quien figura estuvo dentro, es esa persona.
    expect(quienLaDio(sem, 'Luna')).toBe('Luna')
    // Sin datos de la sala, quien figura.
    expect(quienLaDio(s({ fecha: '2026-11-18' }), 'Paul')).toBe('Paul')
    // La de hoy cuenta en cuanto hay datos.
    const r = clasesDadasPorProfe([s({ courseUuid: 'rood', curso: 'C', fecha: HOY, lista: { pasada: false, vinieron: 3, equipo: [luna] } })], { rood: 'Paul' }, HOY)
    expect(r[0].profes[0].nombre).toBe('Luna Zegers')
    expect(textoAsistencia({ pasada: false, vinieron: 3 })).toBe('Asistencia: vinieron 3 alumnos (según la sala)')
    expect(textoAsistencia(null)).toBe('Asistencia: la cuenta la sala sola')
  })

  test('una clase sin tema se llama por su día', () => {
    expect(tituloDeClase('', '2026-11-17')).toBe('Clase del 17 nov')
    expect(tituloDeClase('  Mijn huis ', '2026-11-17')).toBe('Mijn huis')
    expect(tituloDeClase('', '')).toBe('Clase')
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
