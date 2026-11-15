import { describe, expect, test } from 'bun:test'
import { aTexto, esCorrecta, leerEjercicios, opcionesDe } from '../ejerciciosLectura'

const PEGADO = `1. VF | Anna fietst naar haar werk. | niet waar >> Ze gaat met de bus.
OP | Hoe laat staat Anna op? | om zeven uur | om acht uur | om zes uur
HU | Anna drinkt ___ bij het ontbijt. | koffie | thee | melk
HU | Ik sta om zeven uur ___. | op
AB | Hoe laat sta jij op? | Ik sta om half zeven op.
esto no vale`

describe('ejercicios de la lectura', () => {
  test('lee las líneas pegadas y aparta lo que no entiende', () => {
    const { ejercicios, noEntendidas } = leerEjercicios(PEGADO)
    expect(ejercicios.map((e) => e.tipo)).toEqual(['vf', 'op', 'hu', 'hu', 'ab'])
    expect(ejercicios[0].correcta).toBe('niet waar')
    expect(ejercicios[0].explicacion).toBe('Ze gaat met de bus.')
    expect(ejercicios[1].opciones).toEqual(['om acht uur', 'om zes uur'])
    expect(ejercicios[3].opciones).toEqual([])
    expect(noEntendidas).toEqual(['esto no vale'])
  })

  test('vuelve al mismo texto para editar', () => {
    const { ejercicios } = leerEjercicios(PEGADO)
    expect(leerEjercicios(aTexto(ejercicios)).ejercicios).toEqual(ejercicios)
  })

  test('corrige sin mayúsculas ni punto final', () => {
    const { ejercicios } = leerEjercicios(PEGADO)
    expect(esCorrecta(ejercicios[3], ' Op. ')).toBe(true)
    expect(esCorrecta(ejercicios[3], 'af')).toBe(false)
    expect(esCorrecta(ejercicios[0], 'niet waar')).toBe(true)
  })

  test('la buena nunca sale la primera y están todas', () => {
    const { ejercicios } = leerEjercicios(PEGADO)
    const ops = opcionesDe(ejercicios[1])
    expect(ops[0]).not.toBe('om zeven uur')
    expect([...ops].sort()).toEqual(['om acht uur', 'om zes uur', 'om zeven uur'].sort())
    expect(opcionesDe(ejercicios[0])).toEqual(['waar', 'niet waar'])
  })
})
