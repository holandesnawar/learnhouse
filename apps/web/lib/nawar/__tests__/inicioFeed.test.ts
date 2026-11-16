import { describe, expect, test } from 'bun:test'
import { conMeGusta, meGusta, repartirFeed, rutaContinuar } from '../inicioFeed'

describe('Me gusta del Inicio', () => {
  test('cuenta reacciones y votos, y sabe si el ❤️ es mío', () => {
    const d = { upvote_count: 1, reactions: [{ emoji: '👍', count: 2, has_reacted: true }, { emoji: '❤️', count: 1, has_reacted: false }] }
    expect(meGusta(d)).toEqual({ total: 4, mio: false })
    expect(meGusta({ reactions: [{ emoji: '❤️', count: 3, has_reacted: true }] })).toEqual({ total: 3, mio: true })
    expect(meGusta({})).toEqual({ total: 0, mio: false })
  })
  test('dar y quitar el ❤️', () => {
    const dado = conMeGusta([], true)
    expect(dado).toEqual([{ emoji: '❤️', count: 1, has_reacted: true }])
    expect(conMeGusta(dado, false)).toEqual([])
    const otros = conMeGusta([{ emoji: '❤️', count: 2, has_reacted: false }], true)
    expect(otros[0]).toEqual({ emoji: '❤️', count: 3, has_reacted: true })
    expect(conMeGusta(otros, false)[0]).toEqual({ emoji: '❤️', count: 2, has_reacted: false })
    // dar dos veces no suma dos
    expect(conMeGusta(otros, true)[0].count).toBe(3)
  })
})

describe('Destacado y lo último', () => {
  const ahora = Date.parse('2026-11-16T12:00:00Z')
  const p = (id: string, dia: string, likes = 0, fijada = false) => ({
    discussion_uuid: id,
    creation_date: `2026-11-${dia}T10:00:00`,
    is_pinned: fijada,
    reactions: likes ? [{ emoji: '❤️', count: likes, has_reacted: false }] : [],
  })
  test('lo destacado no se repite abajo', () => {
    const todas = [p('a', '15'), p('b', '14', 5), p('c', '13'), p('d', '01', 9, true), p('e', '01', 50)]
    const { destacadas, ultimas } = repartirFeed(todas, ahora)
    expect(destacadas.map((d) => d.discussion_uuid)).toEqual(['d', 'b'])
    expect(ultimas.map((d) => d.discussion_uuid)).toEqual(['a', 'c', 'e'])
  })
})

describe('Tu siguiente paso', () => {
  test('lección terminada con la siguiente: a esa lección en la formación', () => {
    const r = rutaContinuar({ terminada: true, siguiente: { id: 'les-2', moduleId: 'm1' }, courseUuid: 'abc', activityUuid: 'x' })
    expect(r).toEqual({ ruta: '/leccion/les-2/samenvatting', formacion: true })
  })
  test('a medias: a la clase exacta', () => {
    expect(rutaContinuar({ terminada: false, courseUuid: 'abc', activityUuid: 'x' }).ruta).toBe('/course/abc/activity/x')
  })
  test('terminó la última lección: a la formación', () => {
    expect(rutaContinuar({ terminada: true, siguiente: null, cursoEnMarcha: 'abc' }).ruta).toBe('/course/abc')
  })
  test('sin curso: a los ejercicios', () => {
    expect(rutaContinuar({ terminada: true, siguiente: { id: 'les-2', moduleId: 'm1' } })).toEqual({
      ruta: '/ejercicios/modulo/m1/leccion/les-2',
      formacion: false,
    })
  })
})
