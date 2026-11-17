import { describe, expect, test } from 'bun:test'
import { sinPrefijo, uuidCanal, uuidPublicacion } from '../uuidCanal'

describe('uuidCanal', () => {
  test('sin prefijo, se lo pone', () => {
    expect(uuidCanal('abc-123')).toBe('community_abc-123')
  })
  test('con prefijo, no lo repite', () => {
    expect(uuidCanal('community_abc-123')).toBe('community_abc-123')
  })
  test('publicaciones igual', () => {
    expect(uuidPublicacion('x')).toBe('discussion_x')
    expect(uuidPublicacion('discussion_x')).toBe('discussion_x')
  })
  test('sinPrefijo', () => {
    expect(sinPrefijo('community_a', 'community_')).toBe('a')
    expect(sinPrefijo('a', 'community_')).toBe('a')
  })
})
