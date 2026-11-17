import { describe, expect, test } from 'bun:test'
import { ajustarAlPdf, cajaDeLinea, docInicial, hayAlgoEscrito, lineasDe, moverTrazo, paraLosAlumnos, simplificar, tocaLinea, trazoEnPunto, type DocPizarra, type Trazo, type TrazoTexto } from '../pizarra'

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

describe('mover lo escrito (16/11/2026)', () => {
  const texto: TrazoTexto = { t: 'texto', x: 0.1, y: 0.1, texto: 'Hallo', color: '#000', tam: 0.026, estilo: 'texto' }
  const linea: Trazo = { t: 'lapiz', color: '#000', grosor: 0.004, p: [0.5, 0.5, 0.6, 0.5] }
  const rot: Trazo = { t: 'rotulador', color: '#ff0', grosor: 0.022, p: [0.5, 0.52, 0.6, 0.52] }
  // La caja del texto la mide la pantalla; aquí, fija.
  const caja = (t: TrazoTexto) => ({ x: t.x, y: t.y, w: 0.1, h: 0.03 })

  test('encuentra el texto por su caja y la línea por su trazo', () => {
    const trazos: Trazo[] = [texto, linea]
    expect(trazoEnPunto(trazos, 0.15, 0.11, 1.4, caja)).toBe(0)
    expect(trazoEnPunto(trazos, 0.55, 0.5, 1.4, caja)).toBe(1)
    expect(trazoEnPunto(trazos, 0.9, 0.9, 1.4, caja)).toBe(-1)
    // Con la herramienta Texto, las líneas no cuentan.
    expect(trazoEnPunto(trazos, 0.55, 0.5, 1.4, caja, { soloTextos: true })).toBe(-1)
  })

  test('el texto gana a lo dibujado, y el lápiz al rotulador', () => {
    const encima: TrazoTexto = { ...texto, x: 0.52, y: 0.49 }
    expect(trazoEnPunto([linea, encima], 0.55, 0.5, 1, caja)).toBe(1)
    expect(trazoEnPunto([linea, rot], 0.55, 0.51, 1, caja)).toBe(0)
  })

  test('mueve un texto sin salirse de la página', () => {
    expect(moverTrazo(texto, 0.2, 0.3)).toMatchObject({ x: 0.3, y: 0.4, texto: 'Hallo' })
    expect(moverTrazo(texto, -1, 2)).toMatchObject({ x: 0, y: 0.98 })
  })

  test('mueve una línea entera, con todos sus puntos dentro', () => {
    expect((moverTrazo(linea, 0.1, -0.2) as any).p).toEqual([0.6, 0.3, 0.7, 0.3])
    // Hacia la derecha solo cabe hasta que su último punto toca el borde.
    expect((moverTrazo(linea, 0.9, 0) as any).p).toEqual([0.9, 0.5, 1, 0.5])
  })

  test('la caja de una línea incluye su grosor', () => {
    const c = cajaDeLinea(linea as any, 1)
    expect(c.x).toBeCloseTo(0.498)
    expect(c.w).toBeCloseTo(0.104)
  })
})
