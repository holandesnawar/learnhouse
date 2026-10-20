import { describe, expect, test } from 'bun:test'
import {
  agruparPorSemana,
  atrasada,
  caeEnSemana,
  diasEntre,
  juntarPersonas,
  lunesDe,
  lunesSeguidos,
  numeroSemana,
  personasDe,
  rangoDe,
} from '../semanasTrabajo'

const t = (p: Partial<{ inicio: string; fin: string; vence: string; estado: string; id: number }>) => ({
  inicio: '',
  fin: '',
  vence: '',
  estado: 'pendiente',
  id: 0,
  ...p,
})

describe('semanas', () => {
  test('el lunes de cada día, también el domingo y entre años', () => {
    expect(lunesDe('2026-10-20')).toBe('2026-10-19') // martes
    expect(lunesDe('2026-10-19')).toBe('2026-10-19') // lunes
    expect(lunesDe('2026-10-25')).toBe('2026-10-19') // domingo
    expect(lunesDe('2027-01-01')).toBe('2026-12-28')
    expect(diasEntre('2026-10-19', '2026-10-25')).toBe(6)
    expect(lunesSeguidos('2026-10-22', 3)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })

  test('número de semana como en los calendarios', () => {
    expect(numeroSemana('2026-10-20')).toBe(43)
    expect(numeroSemana('2026-01-01')).toBe(1)
    expect(numeroSemana('2027-01-01')).toBe(53) // 2026 tiene 53 semanas
    expect(numeroSemana('2027-01-04')).toBe(1)
  })
})

describe('tarjetas en el tiempo', () => {
  test('de cuándo a cuándo va', () => {
    expect(rangoDe(t({}))).toBeNull()
    expect(rangoDe(t({ vence: '2026-10-24' }))).toEqual({ desde: '2026-10-24', hasta: '2026-10-24' })
    expect(rangoDe(t({ inicio: '2026-10-20', vence: '2026-11-02' }))).toEqual({ desde: '2026-10-20', hasta: '2026-11-02' })
    expect(rangoDe(t({ inicio: '2026-10-20', fin: '2026-10-30', vence: '2026-11-02' }))).toEqual({ desde: '2026-10-20', hasta: '2026-10-30' })
    // Fechas al revés: se ordenan.
    expect(rangoDe(t({ inicio: '2026-11-02', fin: '2026-10-20' }))).toEqual({ desde: '2026-10-20', hasta: '2026-11-02' })
  })

  test('atrasada: sin hacer y con la fecha pasada', () => {
    expect(atrasada(t({ vence: '2026-10-19' }), '2026-10-20')).toBe(true)
    expect(atrasada(t({ vence: '2026-10-20' }), '2026-10-20')).toBe(false)
    expect(atrasada(t({ vence: '2026-10-19', estado: 'hecho' }), '2026-10-20')).toBe(false)
    expect(atrasada(t({ inicio: '2026-10-01' }), '2026-10-20')).toBe(false)
  })

  test('cae en una semana aunque sea un día', () => {
    const larga = t({ inicio: '2026-10-15', fin: '2026-10-19' })
    expect(caeEnSemana(larga, '2026-10-12')).toBe(true)
    expect(caeEnSemana(larga, '2026-10-19')).toBe(true)
    expect(caeEnSemana(larga, '2026-10-26')).toBe(false)
    expect(caeEnSemana(t({}), '2026-10-19')).toBe(false)
  })

  test('agrupar: atrasadas, cada semana por su fecha límite, lo hecho cuando se terminó, sin fecha', () => {
    const g = agruparPorSemana(
      [
        t({ id: 1, vence: '2026-10-16' }),
        t({ id: 2, vence: '2026-10-23' }),
        t({ id: 3, inicio: '2026-10-20', vence: '2026-11-04' }),
        t({ id: 4, estado: 'hecho', vence: '2026-10-30', fin: '2026-10-14' }),
        t({ id: 5 }),
      ],
      '2026-10-20'
    )
    expect(g.atrasadas.map((x) => x.id)).toEqual([1])
    expect(g.semanas.map((s) => [s.lunes, s.tarjetas.map((x) => x.id)])).toEqual([
      ['2026-10-12', [4]],
      ['2026-10-19', [2]],
      ['2026-11-02', [3]],
    ])
    expect(g.sinFecha.map((x) => x.id)).toEqual([5])
  })
})

describe('encargados', () => {
  test('separados por comas, sin repetir', () => {
    expect(personasDe(' Rida ,laura;  RIDA , ')).toEqual(['Rida', 'laura'])
    expect(personasDe('')).toEqual([])
    expect(juntarPersonas(['Rida', 'Laura'])).toBe('Rida, Laura')
    expect(juntarPersonas(Array.from({ length: 20 }, (_, i) => `Persona número ${i}`)).length).toBeLessThanOrEqual(120)
  })
})
