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
