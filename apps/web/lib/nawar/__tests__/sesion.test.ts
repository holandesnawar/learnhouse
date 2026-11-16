import { describe, expect, test } from 'bun:test'
import {
  esDeLaApi,
  esperaReintento,
  expiraDelJwt,
  queHacerConRefresco,
  sePuedeRepetir,
  tocaRenovar,
  tokenDeCabeceras,
} from '../sesion'

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: object) => `${b64url({ alg: 'HS256' })}.${b64url(payload)}.firma`

describe('expiraDelJwt', () => {
  test('lee el exp en milisegundos', () => {
    expect(expiraDelJwt(jwt({ sub: 'a@b.c', exp: 1_800_000_000 }))).toBe(1_800_000_000_000)
  })
  test('lo que no es un JWT da null', () => {
    expect(expiraDelJwt('lh_abc')).toBeNull()
    expect(expiraDelJwt('a.b.c')).toBeNull()
    expect(expiraDelJwt(jwt({ sub: 'x' }))).toBeNull()
    expect(expiraDelJwt(null)).toBeNull()
  })
})

describe('tocaRenovar', () => {
  const ahora = 1_000_000_000_000
  test('a más de 5 minutos, no', () => {
    expect(tocaRenovar(ahora + 6 * 60_000, ahora)).toBe(false)
  })
  test('a menos de 5 minutos o ya caducado, sí', () => {
    expect(tocaRenovar(ahora + 4 * 60_000, ahora)).toBe(true)
    expect(tocaRenovar(ahora - 3 * 3600_000, ahora)).toBe(true)
  })
  test('sin fecha, no (no se renueva a ciegas)', () => {
    expect(tocaRenovar(null, ahora)).toBe(false)
    expect(tocaRenovar(undefined, ahora)).toBe(false)
  })
  test('con otro margen', () => {
    expect(tocaRenovar(ahora + 20_000, ahora, 30_000)).toBe(true)
    expect(tocaRenovar(ahora + 40_000, ahora, 30_000)).toBe(false)
  })
})

describe('queHacerConRefresco', () => {
  test('solo un 401/403 saca a la persona', () => {
    expect(queHacerConRefresco(200)).toBe('ok')
    expect(queHacerConRefresco(401)).toBe('fuera')
    expect(queHacerConRefresco(403)).toBe('fuera')
  })
  test('sin red, 429 o un despliegue: reintentar', () => {
    for (const s of [0, 429, 500, 502, 503, 504]) expect(queHacerConRefresco(s)).toBe('reintentar')
  })
})

describe('esperaReintento', () => {
  test('crece y tiene tope', () => {
    expect(esperaReintento(0)).toBe(2_000)
    expect(esperaReintento(1)).toBe(4_000)
    expect(esperaReintento(10)).toBe(30_000)
  })
})

describe('tokenDeCabeceras', () => {
  const t = jwt({ exp: 1 })
  test('objeto, Headers y lista', () => {
    expect(tokenDeCabeceras({ Authorization: `Bearer ${t}` })).toBe(t)
    expect(tokenDeCabeceras({ authorization: `bearer ${t}` })).toBe(t)
    expect(tokenDeCabeceras(new Headers({ Authorization: `Bearer ${t}` }))).toBe(t)
    expect(tokenDeCabeceras([['Authorization', `Bearer ${t}`]])).toBe(t)
  })
  test('sin permiso, o con clave de API, nada', () => {
    expect(tokenDeCabeceras(undefined)).toBeNull()
    expect(tokenDeCabeceras({ 'Content-Type': 'application/json' })).toBeNull()
    expect(tokenDeCabeceras({ Authorization: 'Bearer lh_abc' })).toBeNull()
    expect(tokenDeCabeceras({ Authorization: 'Bearer undefined' })).toBeNull()
  })
})

describe('esDeLaApi', () => {
  test('la API de la escuela sí, lo demás no', () => {
    const base = 'https://app.holandesnawar.com/api/v1/'
    expect(esDeLaApi(`${base}courses/x`, base)).toBe(true)
    expect(esDeLaApi('/api/v1/users/session', base)).toBe(true)
    expect(esDeLaApi('/api/auth/refresh', base)).toBe(false)
    expect(esDeLaApi('https://iframe.mediadelivery.net/x', base)).toBe(false)
  })
})

describe('sePuedeRepetir', () => {
  test('solo las lecturas', () => {
    expect(sePuedeRepetir(undefined)).toBe(true)
    expect(sePuedeRepetir('get')).toBe(true)
    expect(sePuedeRepetir('POST')).toBe(false)
    expect(sePuedeRepetir('PUT')).toBe(false)
  })
})
