import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  _vaciarParaTests,
  audioListo,
  colaDePrecarga,
  pedirAudio,
  precargarVoz,
  siguientes,
  urlVoz,
} from '../vozPrecarga'

const fetchDeVerdad = globalThis.fetch
const crearDeVerdad = URL.createObjectURL
let pedidas: string[] = []

beforeEach(() => {
  _vaciarParaTests()
  pedidas = []
  globalThis.fetch = (async (url: string) => {
    pedidas.push(String(url))
    if (String(url).includes('falla')) return new Response('no', { status: 503 })
    return new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 })
  }) as typeof fetch
  let n = 0
  URL.createObjectURL = (() => `blob:audio-${++n}`) as typeof URL.createObjectURL
})

afterEach(() => {
  globalThis.fetch = fetchDeVerdad
  URL.createObjectURL = crearDeVerdad
})

describe('urlVoz', () => {
  test('la dirección de siempre de la lectura, con el texto recortado a 790', () => {
    expect(urlVoz('de kat')).toBe('/api/tts?text=de%20kat')
    expect(urlVoz('a'.repeat(900))).toBe(`/api/tts?text=${'a'.repeat(790)}`)
  })
})

describe('colaDePrecarga y siguientes', () => {
  test('sin vacíos, sin repetir, en orden y con tope', () => {
    expect(colaDePrecarga(['a', '', 'b', 'a', null, '  ', 'c'])).toEqual(['a', 'b', 'c'])
    expect(colaDePrecarga(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
  })
  test('las que vienen a partir de una', () => {
    expect(siguientes([1, 2, 3, 4, 5], 1, 3)).toEqual([2, 3, 4])
    expect(siguientes([1, 2], 1, 3)).toEqual([2])
    expect(siguientes([1, 2], 5, 3)).toEqual([])
    expect(siguientes([1, 2], -2, 1)).toEqual([1])
    expect(siguientes([1, 2], 0, 0)).toEqual([])
  })
})

describe('pedirAudio y audioListo', () => {
  test('se pide una vez y queda listo por su dirección', async () => {
    expect(audioListo('hallo')).toBeUndefined()
    const [a, b] = await Promise.all([pedirAudio('hallo'), pedirAudio('hallo')])
    expect(a).toBe(b)
    expect(pedidas).toEqual([urlVoz('hallo')])
    expect(audioListo('hallo')).toBe(a as string)
    await pedirAudio('hallo')
    expect(pedidas.length).toBe(1)
  })

  test('la misma palabra con otra dirección (otra voz) no se confunde', async () => {
    const leccion = '/api/tts?text=hallo&vt=v6'
    await pedirAudio('hallo', leccion)
    expect(audioListo('hallo', leccion)).toBeDefined()
    expect(audioListo('hallo')).toBeUndefined()
    expect(audioListo('hallo', '/api/tts?text=hallo&vt=v6&voice=B')).toBeUndefined()
  })

  test('si falla, no se guarda y se puede volver a pedir', async () => {
    expect(await pedirAudio('falla')).toBeNull()
    expect(audioListo('falla')).toBeUndefined()
    await pedirAudio('falla')
    expect(pedidas.length).toBe(2)
  })
})

describe('precargarVoz', () => {
  test('pide de uno en uno con la dirección que se le da', async () => {
    const url = (t: string) => `/api/tts?text=${t}&vt=v6`
    precargarVoz(['een', 'twee', 'een'], { url, retraso: 0 })
    await new Promise((r) => setTimeout(r, 20))
    expect(pedidas).toEqual(['/api/tts?text=een&vt=v6', '/api/tts?text=twee&vt=v6'])
    expect(audioListo('twee', url('twee'))).toBeDefined()
  })

  test('cortado antes de empezar, no pide nada', async () => {
    const parar = precargarVoz(['een'], { retraso: 5 })
    parar()
    await new Promise((r) => setTimeout(r, 20))
    expect(pedidas).toEqual([])
  })
})
