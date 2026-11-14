import { describe, expect, test } from 'bun:test'
import { canalGeneral, canalVictorias, comoPublicacion } from '../canales'

const CANALES = [
  { community_uuid: 'c1', name: '📌 Lo esencial', kind: 'posts' },
  { community_uuid: 'c2', name: '💬 General', kind: 'chat' },
  { community_uuid: 'c3', name: '🏆 Victorias', kind: 'posts' },
]

describe('canales por lo que son', () => {
  test('el general y el de victorias, sin mirar emoji ni mayúsculas', () => {
    expect(canalGeneral(CANALES)?.community_uuid).toBe('c2')
    expect(canalVictorias(CANALES)?.community_uuid).toBe('c3')
    expect(canalGeneral([CANALES[0]])).toBeNull()
  })
  test('sin «General», el de alumnos (Comunidad Alumnos), nunca el Spreekclub ni victorias', () => {
    const escuela = [
      { community_uuid: 's', name: '🎙️ Spreek Club Chat', kind: 'chat' },
      { community_uuid: 'v', name: 'Victorias', kind: 'posts' },
      { community_uuid: 'a', name: 'Comunidad Alumnos', kind: 'chat' },
    ]
    expect(canalGeneral(escuela)?.community_uuid).toBe('a')
  })
  test('el texto pasa a título y documento', () => {
    const p = comoPublicacion('Hoy pedí un café en neerlandés\n\nY me entendieron')
    expect(p.title).toBe('Hoy pedí un café en neerlandés')
    const doc = JSON.parse(p.content)
    expect(doc.content.length).toBe(3)
    expect(doc.content[0].content[0].text).toBe('Hoy pedí un café en neerlandés')
    expect(comoPublicacion('texto', 'Módulo 1 superado').title).toBe('Módulo 1 superado')
  })
})
