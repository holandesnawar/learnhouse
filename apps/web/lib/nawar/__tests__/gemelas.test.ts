import { describe, expect, test } from 'bun:test'
import { familiaDe, gemelaDe, grupoDe, sinRepetirGemelas, type ClaseEnAgenda, type SemanaEquipo } from '../salaProfes'

const semana = (key: string, courseUuid: string, curso: string, tema: string, fecha: string): SemanaEquipo =>
  ({ key, semanaId: 1, courseUuid, curso, color: '#000', tema, fecha, hora: '', profe: '', presentaciones: [], grabaciones: [], ejercicios: [], tieneTarea: false, enunciado: '', lista: null, porCorregir: 0 }) as SemanaEquipo

const rood = semana('r1', 'a', 'Clase semanal · Groep rood', 'Mijn huis', '2026-11-10')
const blauw = semana('b1', 'b', 'Clase semanal · Groep blauw', 'Mijn huis', '2026-11-12')
const master = semana('m1', 'c', 'Masterclass', 'Mijn huis', '2026-11-11')
const rood2 = semana('r2', 'a', 'Clase semanal · Groep rood', 'Boodschappen', '2026-11-17')
const todas = [rood, blauw, master, rood2]
const item = (s: SemanaEquipo): ClaseEnAgenda => ({ semana: s, profe: '', mia: false, hora: '' })

describe('la misma semana en los dos grupos', () => {
  test('dos clases con el mismo nombre son la misma clase; la masterclass, otra', () => {
    expect(familiaDe(rood.curso)).toBe(familiaDe(blauw.curso))
    expect(familiaDe(master.curso)).not.toBe(familiaDe(rood.curso))
    expect(grupoDe(blauw.curso)).toBe('Groep blauw')
  })

  test('la gemela es la del otro grupo con el mismo tema esa semana', () => {
    expect(gemelaDe(rood, todas)?.key).toBe('b1')
    expect(gemelaDe(blauw, todas)?.key).toBe('r1')
    expect(gemelaDe(master, todas)).toBeNull()
    expect(gemelaDe(rood2, todas)).toBeNull()
  })

  test('en la agenda de quien lo ve todo salen como una sola línea', () => {
    const out = sinRepetirGemelas([rood, master, blauw, rood2].map(item), todas)
    expect(out.map((o) => o.semana.key)).toEqual(['r1', 'm1', 'r2'])
    expect(out[0].gemela?.key).toBe('b1')
  })
})
