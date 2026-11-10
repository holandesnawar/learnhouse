import { describe, expect, test } from 'bun:test'
import { ajustarAlPdf, docInicial, hayAlgoEscrito, lineasDe, paraLosAlumnos, simplificar, tocaLinea, type DocPizarra } from '../pizarra'

describe('la pizarra de clase', () => {
  test('sin nada guardado, una página por cada página del PDF', () => {
    const d = docInicial(3)
    expect(d.paginas.map((p) => p.origen)).toEqual([1, 2, 3])
    expect(hayAlgoEscrito(d)).toBe(false)
  })

  test('si el PDF crece, las páginas nuevas van al final y lo escrito se queda', () => {
    const viejo: DocPizarra = {
      v: 1,
      paginas: [
        { origen: 1, trazos: [{ t: 'lapiz', color: '#000', grosor: 0.004, p: [0.1, 0.1, 0.2, 0.2] }] },
        { origen: null, titulo: 'Notas', trazos: [] },
        { origen: 2, trazos: [] },
      ],
    }
    const d = ajustarAlPdf(viejo, 4)
    expect(d.paginas.map((p) => p.origen)).toEqual([1, null, 2, 3, 4])
    expect(d.paginas[0].trazos).toHaveLength(1)
  })

  test('si el PDF encoge, una página con notas no se pierde: pasa a página en blanco', () => {
    const viejo: DocPizarra = {
      v: 1,
      paginas: [
        { origen: 1, trazos: [] },
        { origen: 5, trazos: [{ t: 'texto', x: 0.1, y: 0.1, texto: 'het huis', color: '#000', tam: 0.03, estilo: 'texto' }] },
        { origen: 6, trazos: [] },
      ],
    }
    const d = ajustarAlPdf(viejo, 2)
    expect(d.paginas.map((p) => p.origen)).toEqual([1, null, 2])
    expect(d.paginas[1].trazos).toHaveLength(1)
  })

  test('un trazo roto no rompe la pizarra', () => {
    const d = ajustarAlPdf({ v: 1, paginas: [{ origen: 1, trazos: [{ t: 'lapiz' } as any, null as any] }] }, 1)
    expect(d.paginas[0].trazos).toEqual([])
  })

  test('los alumnos no ven las páginas escondidas', () => {
    const d: DocPizarra = { v: 1, paginas: [{ origen: 1, trazos: [] }, { origen: 2, oculta: true, trazos: [] }, { origen: null, trazos: [] }] }
    expect(paraLosAlumnos(d).map((p) => p.origen)).toEqual([1, null])
    expect(hayAlgoEscrito(d)).toBe(true)
  })

  test('simplificar conserva el principio y el final y quita lo que sobra', () => {
    const p: number[] = []
    for (let i = 0; i <= 1000; i++) p.push(i / 1000, 0.5)
    const s = simplificar(p)
    expect(s.length).toBeLessThan(p.length * 0.6)
    expect(s.slice(0, 2)).toEqual([0, 0.5])
    expect(s.slice(-2)).toEqual([1, 0.5])
  })

  test('el borrador toca la línea por la que pasa y no la que está lejos', () => {
    const linea = { t: 'lapiz' as const, color: '#000', grosor: 0.004, p: [0.1, 0.5, 0.9, 0.5] }
    expect(tocaLinea(linea, 0.5, 0.505, 0.01, 0.5625)).toBe(true)
    expect(tocaLinea(linea, 0.5, 0.7, 0.01, 0.5625)).toBe(false)
  })

  test('las líneas de un texto son las que se escribieron con Intro', () => {
    expect(lineasDe('het huis\nde kamer')).toEqual(['het huis', 'de kamer'])
  })
})
