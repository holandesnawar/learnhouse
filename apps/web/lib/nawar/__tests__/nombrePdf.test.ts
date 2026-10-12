import { describe, expect, test } from 'bun:test'
import { capituloDeLaClase, nombreParaDescargar, numeroDeModulo } from '../nombrePdf'

describe('numeroDeModulo', () => {
  test('como se llaman los capítulos', () => {
    expect(numeroDeModulo('MODULE 1 - OVER JOU')).toBe(1)
    expect(numeroDeModulo('Module 10 - Dagelijks leven')).toBe(10)
    expect(numeroDeModulo('Módulo 3')).toBe(3)
    expect(numeroDeModulo('Introducción')).toBeNull()
    expect(numeroDeModulo(undefined)).toBeNull()
  })
})

describe('nombreParaDescargar', () => {
  test('el Werkboek de cada módulo no se pisa con el de otro', () => {
    expect(nombreParaDescargar('2.7 Werkboek', 'MODULE 1 - OVER JOU')).toBe('Werkboek - Módulo 1 - Lección 2.pdf')
    expect(nombreParaDescargar('2.7 Werkboek', 'MODULE 2 - FAMILIE & VRIENDEN')).toBe('Werkboek - Módulo 2 - Lección 2.pdf')
  })

  test('un PDF sin número de lección lleva solo el módulo', () => {
    expect(nombreParaDescargar('Vocabulario del módulo', 'Module 3 - Eten en drinken')).toBe(
      'Vocabulario del módulo - Módulo 3.pdf'
    )
  })

  test('si la clase ya dice su módulo, no se repite', () => {
    expect(nombreParaDescargar('Cuaderno de repaso · Módulo 1', 'MODULE 1 - OVER JOU')).toBe('Cuaderno de repaso - Módulo 1.pdf')
  })

  test('fuera de un módulo, el nombre de la clase', () => {
    expect(nombreParaDescargar('Cuaderno de repaso · Módulo 1', 'Introducción')).toBe('Cuaderno de repaso - Módulo 1.pdf')
    expect(nombreParaDescargar('', null)).toBe('documento.pdf')
    expect(nombreParaDescargar('guia.pdf')).toBe('guia.pdf')
  })
})

describe('capituloDeLaClase', () => {
  const curso = {
    chapters: [
      { name: 'Introducción', activities: [{ activity_uuid: 'activity_a' }] },
      { name: 'MODULE 1 - OVER JOU', activities: [{ activity_uuid: 'activity_b' }] },
    ],
  }
  test('encuentra el capítulo', () => {
    expect(capituloDeLaClase(curso, 'activity_b')).toBe('MODULE 1 - OVER JOU')
    expect(capituloDeLaClase(curso, 'activity_x')).toBeNull()
    expect(capituloDeLaClase(null, 'activity_b')).toBeNull()
  })
})
