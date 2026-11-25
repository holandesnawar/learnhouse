import { describe, expect, test } from 'bun:test'
import { altoDeCaja } from '../cajaQueCrece'

describe('altoDeCaja', () => {
  test('crece con el texto hasta el tope y luego scroll', () => {
    expect(altoDeCaja(200, 80, 400)).toEqual({ alto: 200, scroll: false })
    expect(altoDeCaja(900, 80, 400)).toEqual({ alto: 400, scroll: true })
  })
  test('nunca más pequeña de lo que nació', () => {
    expect(altoDeCaja(40, 120, 400)).toEqual({ alto: 120, scroll: false })
  })
  test('una caja que ya nació más alta que el tope no se encoge', () => {
    expect(altoDeCaja(300, 500, 400)).toEqual({ alto: 500, scroll: false })
    expect(altoDeCaja(700, 500, 400)).toEqual({ alto: 500, scroll: true })
  })
})
