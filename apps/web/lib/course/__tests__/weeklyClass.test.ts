import { describe, expect, test } from 'bun:test'
import { nextBroadcastLabel, humanDate, mesDelCapitulo, sesionesVisibles } from '../weeklyClass'

// Miércoles 5 de agosto de 2026, para que las cuentas sean comprobables.
const MIERCOLES = new Date('2026-08-05T10:00:00')

describe('próxima clase semanal', () => {
  test('la fecha concreta manda sobre todo lo demás', () => {
    expect(nextBroadcastLabel('4', '2026-08-20', 'Por confirmar', MIERCOLES)).toBe(
      'Jueves 20 de agosto'
    )
  })

  test('con día de la semana calcula la próxima vez que cae', () => {
    // Del miércoles 5 al jueves 6: mañana.
    expect(nextBroadcastLabel('4', '', 'Por confirmar', MIERCOLES)).toBe('Jueves 6 de agosto')
    // Del miércoles 5 al martes 11: la semana que viene.
    expect(nextBroadcastLabel('2', '', 'Por confirmar', MIERCOLES)).toBe('Martes 11 de agosto')
  })

  test('si hoy es ese día, hoy mismo', () => {
    expect(nextBroadcastLabel('3', '', 'Por confirmar', MIERCOLES)).toBe('Miércoles 5 de agosto')
  })

  test('cruza el cambio de mes sin despeinarse', () => {
    const lunes31 = new Date('2026-08-31T10:00:00')
    expect(nextBroadcastLabel('4', '', 'Por confirmar', lunes31)).toBe('Jueves 3 de septiembre')
  })

  test('sin día ni fecha se queda el texto libre', () => {
    expect(nextBroadcastLabel('', '', 'Por confirmar', MIERCOLES)).toBe('Por confirmar')
  })

  test('una fecha inválida no rompe: cae al día de la semana', () => {
    expect(nextBroadcastLabel('4', 'no-es-fecha', 'Por confirmar', MIERCOLES)).toBe(
      'Jueves 6 de agosto'
    )
  })

  test('el día sale en mayúscula', () => {
    expect(humanDate(new Date('2026-08-06T12:00:00'))).toBe('Jueves 6 de agosto')
  })
})

describe('sesiones grabadas: los meses vacíos que ya pasaron no salen', () => {
  const OCTUBRE = new Date('2026-10-11T10:00:00')
  const cap = (name: string, n = 0) => ({ name, activities: Array.from({ length: n }, (_, i) => i) })

  test('lee el mes del nombre del capítulo', () => {
    expect(mesDelCapitulo('SEPTIEMBRE - 2026')).toEqual({ anio: 2026, mes: 9 })
    expect(mesDelCapitulo('Octubre 2026')).toEqual({ anio: 2026, mes: 10 })
    expect(mesDelCapitulo('Clase de bienvenida')).toBeNull()
  })

  test('septiembre vacío se va; octubre (el mes en curso) se queda', () => {
    const vistos = sesionesVisibles([cap('SEPTIEMBRE - 2026'), cap('OCTUBRE - 2026')], OCTUBRE)
    expect(vistos.map((c) => c.name)).toEqual(['OCTUBRE - 2026'])
  })

  test('un mes pasado CON grabaciones se queda, y lo que no es un mes también', () => {
    const vistos = sesionesVisibles(
      [cap('AGOSTO - 2026', 3), cap('SEPTIEMBRE - 2026'), cap('Bienvenida'), cap('NOVIEMBRE - 2026')],
      OCTUBRE
    )
    expect(vistos.map((c) => c.name)).toEqual(['AGOSTO - 2026', 'Bienvenida', 'NOVIEMBRE - 2026'])
  })

  test('diciembre del año pasado vacío también se va', () => {
    expect(sesionesVisibles([cap('DICIEMBRE - 2025')], new Date('2026-01-05T10:00:00'))).toEqual([])
  })
})
