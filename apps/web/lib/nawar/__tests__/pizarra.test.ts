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
    // Las páginas del PDF, en su orden; la de notas (ya sin página), detrás.
    expect(d.paginas.map((p) => p.origen)).toEqual([1, 2, null])
    expect(d.paginas[2].trazos).toHaveLength(1)
  })

  test('las notas pasadas de otra presentación: las páginas que faltan van en su sitio y la de notas, al final', () => {
    // Lo que deja el servidor al pasar notas: solo las páginas con algo escrito.
    const trazo: Trazo = { t: 'lapiz', color: '#000', grosor: 0.004, p: [0.1, 0.1, 0.2, 0.2] }
    const pasadas: DocPizarra = { v: 1, paginas: [{ origen: 1, trazos: [trazo] }, { origen: 4, trazos: [trazo] }, { origen: null, titulo: 'Notas', trazos: [trazo] }] }
    const d = ajustarAlPdf(pasadas, 6)
    expect(d.paginas.map((p) => p.origen)).toEqual([1, 2, 3, 4, 5, 6, null])
    expect(d.paginas[3].trazos).toHaveLength(1)
    // Una página en blanco que el profe puso EN MEDIO se queda donde estaba.
    const enMedio: DocPizarra = { v: 1, paginas: [{ origen: 1, trazos: [] }, { origen: null, trazos: [trazo] }, { origen: 2, trazos: [] }, { origen: 3, trazos: [] }] }
    expect(ajustarAlPdf(enMedio, 3).paginas.map((p) => p.origen)).toEqual([1, null, 2, 3])
    // Notas de la pizarra en blanco pasadas a un PDF: el PDF delante, las notas detrás.
    expect(ajustarAlPdf({ v: 1, paginas: [{ origen: null, trazos: [trazo] }] }, 2).paginas.map((p) => p.origen)).toEqual([1, 2, null])
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

import { cambiarTamano, duplicarTrazo, escalarTrazo, esquinas, factorEscala, recolorear, TAM_TEXTO } from '../pizarra'

describe('cambiar lo ya escrito (18/11/2026)', () => {
  const texto: TrazoTexto = { t: 'texto', x: 0.2, y: 0.3, texto: 'het huis', color: '#0b2da0', tam: 0.03, estilo: 'texto' }
  const linea: Trazo = { t: 'lapiz', color: '#0b2da0', grosor: 0.004, p: [0.2, 0.2, 0.4, 0.4] }

  test('recolorear cambia solo el color', () => {
    expect(recolorear(texto, '#D92D20')).toEqual({ ...texto, color: '#D92D20' })
    expect((recolorear(linea, '#16A34A') as any).p).toEqual(linea.p)
  })

  test('estirar un texto desde la esquina de abajo deja quieta la de arriba y agranda la letra', () => {
    const t = escalarTrazo(texto, 2, 0.2, 0.3) as TrazoTexto
    expect(t.tam).toBeCloseTo(0.06)
    expect(t.x).toBeCloseTo(0.2)
    expect(t.y).toBeCloseTo(0.3)
  })

  test('estirar desde la esquina de arriba mueve el texto para que la de abajo no se mueva', () => {
    const t = escalarTrazo(texto, 0.5, 0.6, 0.5) as TrazoTexto
    expect(t.tam).toBeCloseTo(0.015)
    expect(t.x).toBeCloseTo(0.4)
    expect(t.y).toBeCloseTo(0.4)
  })

  test('la letra no pasa de sus límites', () => {
    expect((escalarTrazo(texto, 50, 0.2, 0.3) as TrazoTexto).tam).toBe(TAM_TEXTO.max)
    expect((escalarTrazo(texto, 0.01, 0.2, 0.3) as TrazoTexto).tam).toBe(TAM_TEXTO.min)
  })

  test('un dibujo escala sus puntos y su grosor y no se sale de la página', () => {
    const l = escalarTrazo(linea, 2, 0.2, 0.2) as any
    expect(l.p).toEqual([0.2, 0.2, 0.6, 0.6])
    expect(l.grosor).toBeCloseTo(0.008)
    const fuera = escalarTrazo(linea, 6, 0.2, 0.2) as any
    expect(Math.max(...fuera.p)).toBeLessThanOrEqual(1)
  })

  test('el factor sale de cuánto se aleja el dedo en la dirección de la esquina', () => {
    expect(factorEscala(0, 0, 0.2, 0.1, 0.4, 0.2, 1)).toBeCloseTo(2)
    expect(factorEscala(0, 0, 0.2, 0.1, 0.1, 0.05, 1)).toBeCloseTo(0.5)
    // Moverse de lado no estira.
    expect(factorEscala(0, 0, 0.2, 0, 0.2, 0.3, 1)).toBeCloseTo(1)
    expect(factorEscala(0, 0, 0, 0, 0.5, 0.5, 1)).toBe(1)
  })

  test('los botones − y + cambian la letra o el grosor', () => {
    expect((cambiarTamano(texto, 1.2) as TrazoTexto).tam).toBeCloseTo(0.036)
    expect((cambiarTamano(linea, 2) as any).grosor).toBeCloseTo(0.008)
  })

  test('duplicar deja una copia un poco más abajo y no toca el original', () => {
    const d = duplicarTrazo(linea) as any
    expect(d.p[0]).toBeCloseTo(0.225)
    expect((linea as any).p[0]).toBe(0.2)
  })

  test('cada esquina tiene la de enfrente como punto fijo', () => {
    const e = esquinas({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
    expect(e.se.fija).toEqual({ x: 0.1, y: 0.2 })
    expect(e.no.fija).toEqual({ x: 0.4, y: 0.30000000000000004 })
  })
})

import { conVersionSinNotas, paginasSinNotas } from '../pizarra'

describe('la versión sin notas (25/11/2026)', () => {
  test('mismas páginas que los alumnos, sin trazos ni páginas en blanco', () => {
    const doc: any = {
      v: 1,
      paginas: [
        { origen: 1, trazos: [{ t: 'lapiz', p: [0, 0, 1, 1] }] },
        { origen: 2, oculta: true, trazos: [] },
        { origen: null, titulo: 'Notas de la clase', trazos: [{ t: 'lapiz', p: [0, 0] }] },
        { origen: 3, trazos: [] },
      ],
    }
    expect(paginasSinNotas(doc).map((p) => [p.origen, p.trazos.length])).toEqual([
      [1, 0],
      [3, 0],
    ])
    expect(doc.paginas[0].trazos.length).toBe(1)
  })
  test('en todas las clases', () => {
    expect(conVersionSinNotas('Spreek Club')).toBe(true)
    expect(conVersionSinNotas('Conversatieles')).toBe(true)
    expect(conVersionSinNotas('Masterclass')).toBe(true)
  })
})
