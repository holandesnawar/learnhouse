import { describe, expect, test } from 'bun:test'
import {
  aParte,
  aReal,
  aVisible,
  complemento,
  cortar,
  corteEn,
  cortesDe,
  deParte,
  dondeSeguir,
  duracionCorta,
  duracionDePartes,
  duracionVisible,
  empiezaEn,
  limpiarTrozos,
  pasoDeRegla,
  reloj,
  sinCorte,
  terminaEn,
  trozosDe,
  type Parte,
} from '../recorte'

describe('recorte de una grabación', () => {
  test('los trozos se limpian: orden, solapes, duración y mínimo de un segundo', () => {
    expect(limpiarTrozos([[100, 200], [10, 50], [40, 60], [199.8, 400], [70, 70.5]], 300)).toEqual([[10, 60], [100, 300]])
    expect(limpiarTrozos([], 120)).toEqual([[0, 120]])
    expect(limpiarTrozos(null, 0)).toEqual([])
    expect(limpiarTrozos([[-5, 10]], 60)).toEqual([[0, 10]])
  })

  test('de lo que se ve a lo que se quita, ida y vuelta', () => {
    const trozos: [number, number][] = [[60, 1500], [1560, 3400]]
    const cortes = cortesDe(trozos, 3600)
    expect(cortes).toEqual([[0, 60], [1500, 1560], [3400, 3600]])
    expect(trozosDe(cortes, 3600)).toEqual(trozos)
    // Sin nada guardado (entera) no hay cortes.
    expect(cortesDe([], 3600)).toEqual([])
    expect(cortesDe(null, 3600)).toEqual([])
    // Cortarlo todo no deja nada que ver.
    expect(complemento([[0, 100]], 100)).toEqual([])
  })

  test('quitar un trozo de en medio, y se funde con el de al lado', () => {
    let cortes = cortar([], 600, 660, 3600)
    expect(cortes).toEqual([[600, 660]])
    cortes = cortar(cortes, 700, 650, 3600) // marcado al revés y pisando al anterior
    expect(cortes).toEqual([[600, 700]])
    expect(sinCorte(cortes, 0)).toEqual([])
    expect(corteEn(cortes, 650)).toBe(0)
    expect(corteEn(cortes, 700)).toBe(-1)
  })

  test('«Empieza aquí» y «Termina aquí» sustituyen al de antes', () => {
    let cortes = empiezaEn([], 90, 3600)
    expect(cortes).toEqual([[0, 90]])
    // Me pasé: empieza antes. El principio de antes ya no cuenta.
    cortes = empiezaEn(cortes, 30, 3600)
    expect(cortes).toEqual([[0, 30]])
    cortes = terminaEn(cortes, 3300, 3600)
    expect(cortes).toEqual([[0, 30], [3300, 3600]])
    cortes = terminaEn(cortes, 3500, 3600)
    expect(cortes).toEqual([[0, 30], [3500, 3600]])
    // Al segundo 0, o al final, no hay nada que quitar.
    expect(empiezaEn(cortes, 0, 3600)).toEqual([[3500, 3600]])
    expect(terminaEn(cortes, 3600, 3600)).toEqual([[0, 30]])
    // Un corte de en medio no se pierde al mover el principio.
    expect(empiezaEn([[0, 30], [600, 660]], 45, 3600)).toEqual([[0, 45], [600, 660]])
  })

  test('tiempo visible y tiempo de la grabación', () => {
    const trozos: [number, number][] = [[10, 60], [100, 300]]
    expect(duracionVisible(trozos)).toBe(250)
    expect(duracionVisible([], 90)).toBe(90)
    expect(aReal(trozos, 0)).toBe(10)
    expect(aReal(trozos, 49)).toBe(59)
    expect(aReal(trozos, 51)).toBe(101)
    expect(aReal(trozos, 9999)).toBe(300)
    expect(aVisible(trozos, 5)).toBe(0)
    expect(aVisible(trozos, 30)).toBe(20)
    expect(aVisible(trozos, 80)).toBe(50)
    expect(aVisible(trozos, 150)).toBe(100)
    expect(aVisible(trozos, 999)).toBe(250)
    expect(aReal([], 42)).toBe(42)
    expect(aVisible(null, 42)).toBe(42)
  })

  test('el reproductor se salta los cortes', () => {
    const trozos: [number, number][] = [[10, 60], [100, 300]]
    expect(dondeSeguir(trozos, 0)).toBe(10) // el principio está cortado
    expect(dondeSeguir(trozos, 30)).toBe(30)
    expect(dondeSeguir(trozos, 60)).toBe(100) // llega al corte: salta
    expect(dondeSeguir(trozos, 75)).toBe(100)
    expect(dondeSeguir(trozos, 300)).toBeNull() // se acabó
    expect(dondeSeguir([], 75)).toBe(75) // sin recorte, nada que saltar
  })

  test('varias partes: una sola línea de tiempo para el alumno', () => {
    const partes: Parte[] = [
      { id: 'a', dur: 2000, trozos: [[60, 2000]] }, // 1940 s
      { id: 'b', dur: 1500, trozos: [[0, 1500]] }, // 1500 s
    ]
    expect(duracionDePartes(partes)).toBe(3440)
    expect(aParte(partes, 0)).toEqual({ parte: 0, real: 60 })
    expect(aParte(partes, 1939)).toEqual({ parte: 0, real: 1999 })
    expect(aParte(partes, 1940)).toEqual({ parte: 1, real: 0 })
    expect(aParte(partes, 99999)).toEqual({ parte: 1, real: 1500 })
    expect(deParte(partes, 1, 100)).toBe(2040)
    expect(deParte(partes, 0, 30)).toBe(0)
    // Una parte sin duración conocida ni trozos se toma entera.
    expect(aParte([{ id: 'x', dur: 0, trozos: [] }], 50)).toEqual({ parte: 0, real: 0 })
  })

  test('para pintar', () => {
    expect(reloj(75)).toBe('1:15')
    expect(reloj(3725)).toBe('1:02:05')
    expect(reloj(-3)).toBe('0:00')
    expect(duracionCorta(40)).toBe('40 s')
    expect(duracionCorta(3480)).toBe('58 min')
    expect(duracionCorta(4500)).toBe('1 h 15 min')
    expect(duracionCorta(7200)).toBe('2 h')
    // Una hora en 900 px: una marca cada 5 minutos.
    expect(pasoDeRegla(900 / 3600)).toBe(300)
    // Con mucho zoom, cada pocos segundos.
    expect(pasoDeRegla(20)).toBe(5)
  })
})

// ── Una sola línea con todas las partes (12/11/2026) ───────────────────────
import {
  aGlobal,
  cortesDeLaParte,
  cortesGlobales,
  deGlobal,
  descortar,
  horaEn,
  inicios,
  parteMasLarga,
  partesEnteras,
  seVeLaParte,
  totalDe,
  trozosPorParte,
} from '../recorte'

// El día de la captura: 31 s, 1 h 16 min, 2 min y 4 min.
const DIA = [
  { id: 'p1', dur: 31 },
  { id: 'p2', dur: 4560 },
  { id: 'p3', dur: 120 },
  { id: 'p4', dur: 240 },
]

describe('la línea de tiempo con todas las partes', () => {
  test('cada parte empieza donde acaba la anterior', () => {
    expect(inicios(DIA)).toEqual([0, 31, 4591, 4711])
    expect(totalDe(DIA)).toBe(4951)
  })

  test('de la línea a la parte y al revés', () => {
    expect(deGlobal(DIA, 10)).toEqual({ parte: 0, real: 10 })
    expect(deGlobal(DIA, 31)).toEqual({ parte: 1, real: 0 })
    expect(deGlobal(DIA, 631)).toEqual({ parte: 1, real: 600 })
    expect(deGlobal(DIA, 4951)).toEqual({ parte: 3, real: 240 })
    expect(deGlobal(DIA, 99999)).toEqual({ parte: 3, real: 240 })
    expect(aGlobal(DIA, 1, 600)).toBe(631)
    expect(aGlobal(DIA, 3, 0)).toBe(4711)
  })

  test('la parte más larga es donde se abre', () => {
    expect(parteMasLarga(DIA)).toBe(1)
    expect(parteMasLarga([])).toBe(0)
  })

  test('sin nada publicado: lo de menos de un minuto nace fuera', () => {
    const fuera = DIA.map((p) => p.dur < 60)
    const cortes = cortesGlobales(DIA, DIA.map(() => null), fuera)
    expect(cortes).toEqual([[0, 31]])
    expect(seVeLaParte(cortes, DIA, 0)).toBe(false)
    expect(seVeLaParte(cortes, DIA, 1)).toBe(true)
    expect(trozosPorParte(cortes, DIA).map((p) => p.id)).toEqual(['p2', 'p3', 'p4'])
  })

  test('lo publicado se vuelve a pintar igual', () => {
    const cortes = cortesGlobales(DIA, [null, [[300, 4500]], [[0, 120]], null], [true, false, false, true])
    // Parte 1 fuera + principio de la 2 → un solo corte; final de la 2 y la 4 entera.
    expect(cortes).toEqual([
      [0, 331],
      [4531, 4591],
      [4711, 4951],
    ])
    expect(trozosPorParte(cortes, DIA)).toEqual([
      { id: 'p2', trozos: [[300, 4500]] },
      { id: 'p3', trozos: [[0, 120]] },
    ])
  })

  test('«Empieza aquí» en la parte 2 deja fuera la 1 entera', () => {
    const cortes = empiezaEn([], aGlobal(DIA, 1, 600), totalDe(DIA))
    expect(cortes).toEqual([[0, 631]])
    expect(seVeLaParte(cortes, DIA, 0)).toBe(false)
    expect(cortesDeLaParte(cortes, DIA, 1)).toEqual([[0, 600]])
    expect(partesEnteras(DIA, cortes[0])).toEqual([0])
  })

  test('«Termina aquí» en la parte 2 deja fuera la 3 y la 4', () => {
    const cortes = terminaEn([], aGlobal(DIA, 1, 4000), totalDe(DIA))
    expect(trozosPorParte(cortes, DIA)).toEqual([
      { id: 'p1', trozos: [[0, 31]] },
      { id: 'p2', trozos: [[0, 4000]] },
    ])
    expect(partesEnteras(DIA, cortes[0])).toEqual([2, 3])
  })

  test('un trozo de en medio puede abarcar dos partes', () => {
    const cortes = cortar([], aGlobal(DIA, 1, 4500), aGlobal(DIA, 2, 60), totalDe(DIA))
    expect(cortesDeLaParte(cortes, DIA, 1)).toEqual([[4500, 4560]])
    expect(cortesDeLaParte(cortes, DIA, 2)).toEqual([[0, 60]])
    expect(trozosPorParte(cortes, DIA)).toEqual([
      { id: 'p1', trozos: [[0, 31]] },
      { id: 'p2', trozos: [[0, 4500]] },
      { id: 'p3', trozos: [[60, 120]] },
      { id: 'p4', trozos: [[0, 240]] },
    ])
  })

  test('volver a incluir una parte quita solo su corte', () => {
    const total = totalDe(DIA)
    let cortes = empiezaEn([], aGlobal(DIA, 1, 600), total)
    cortes = descortar(cortes, 0, 31, total)
    expect(cortes).toEqual([[31, 631]])
    expect(seVeLaParte(cortes, DIA, 0)).toBe(true)
  })

  test('la hora del reloj de un punto de la grabación', () => {
    expect(horaEn('17:25', 13 * 60 + 40)).toBe('17:38')
    expect(horaEn('23:50', 20 * 60)).toBe('00:10')
    expect(horaEn('', 100)).toBe('')
    expect(reloj(750, true)).toBe('0:12:30')
    expect(reloj(750)).toBe('12:30')
  })
})
