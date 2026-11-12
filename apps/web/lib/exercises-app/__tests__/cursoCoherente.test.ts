/**
 * El curso, comprobado entero cada vez que se toca (12/11/2026).
 *
 * Un alumno encontró dos fallos en el módulo 2: una traducción a la que le
 * faltaba una palabra que no estaba entre las fichas, y un «Ordena: "Él es mi
 * amigo"» → «Hij is mijn vriend», cuando la lección enseña que «mijn vriend»
 * es «mi novio». El repaso de todo el curso sacó además siete huecos que
 * pintaban dos cajas y no se podían contestar.
 *
 * Esto NO sabe neerlandés: no ve una palabra que falta ni una frase poco
 * natural (eso lo ve un profe). Sí corta lo que una máquina puede ver: un
 * ejercicio que no se puede resolver y la regla de vriend rota.
 */
import { describe, expect, test } from 'bun:test'
import { LESSONS } from '../courseData'

type Ej = {
  id: string
  type: string
  prompt: string
  options?: string[]
  correctAnswer: string
  alsoAccept?: string[]
  pairs?: { left: string; right: string }[]
}

const TIPOS = new Set([
  'multiple_choice', 'listen_and_choose', 'order_sentence', 'write_answer', 'fill_blank', 'word_scramble', 'match_pairs',
  'true_false', 'emoji_choice', 'odd_one_out', 'letter_dash', 'pair_memory', 'listen_translate', 'spreken_choose', 'listen_choose_image',
])
const ejercicios: { les: string; ex: Ej }[] = []
const pares: { les: string; id: string; nl: string; es: string }[] = []

function andar(o: any, les: string) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o)) return o.forEach((x) => andar(x, les))
  if (o.id && TIPOS.has(o.type) && typeof o.prompt === 'string') ejercicios.push({ les, ex: o })
  if (typeof o.dutch === 'string' && typeof o.spanish === 'string') pares.push({ les, id: o.id || '', nl: o.dutch, es: o.spanish })
  if (typeof o.exampleNl === 'string' && typeof o.exampleEs === 'string') pares.push({ les, id: `${o.id}:ejemplo`, nl: o.exampleNl, es: o.exampleEs })
  if (typeof o.nl === 'string' && typeof o.es === 'string') pares.push({ les, id: 'resumen', nl: o.nl, es: o.es })
  for (const k of Object.keys(o)) andar(o[k], les)
}
for (const l of LESSONS as any[]) andar(l, l.id)

const norm = (s: string) => s.trim().toLowerCase().replace(/[.!?¿¡,;:"«»]/g, '').replace(/\s+/g, ' ')
const entreComillas = (p: string) => p.match(/["«]([^"»]+)["»]/)?.[1] ?? ''

/** ¿Se puede formar la frase usando cada ficha como mucho una vez? */
function sePuedeFormar(frase: string, fichas: string[]): boolean {
  const usar = (resto: string, libres: string[]): boolean => {
    if (!resto) return true
    for (let i = 0; i < libres.length; i++) {
      const f = libres[i]
      if (resto === f || resto.startsWith(f + ' ')) {
        if (usar(resto.slice(f.length).trim(), [...libres.slice(0, i), ...libres.slice(i + 1)])) return true
      }
    }
    return false
  }
  return usar(norm(frase), fichas.map(norm))
}

// De los ejercicios de traducir salen más parejas neerlandés ↔ español.
for (const { les, ex } of ejercicios) {
  const q = entreComillas(ex.prompt)
  if (!q) continue
  if (ex.type === 'order_sentence' && /^(ordena|repaso)/i.test(ex.prompt)) pares.push({ les, id: ex.id, nl: ex.correctAnswer, es: q })
  if (ex.type === 'listen_translate') pares.push({ les, id: ex.id, nl: q, es: ex.correctAnswer })
}

describe('el curso entero', () => {
  test('hay curso que comprobar', () => {
    expect(ejercicios.length).toBeGreaterThan(1000)
    expect(pares.length).toBeGreaterThan(1500)
  })

  test('ningún id de ejercicio repetido', () => {
    const vistos = new Map<string, number>()
    for (const { ex } of ejercicios) vistos.set(ex.id, (vistos.get(ex.id) || 0) + 1)
    expect([...vistos].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([])
  })

  test('la respuesta buena está entre las opciones', () => {
    const mal: string[] = []
    for (const { les, ex } of ejercicios) {
      if (!['multiple_choice', 'listen_and_choose', 'emoji_choice', 'odd_one_out', 'spreken_choose', 'listen_choose_image'].includes(ex.type)) continue
      if (!(ex.options || []).includes(ex.correctAnswer)) mal.push(`${les} ${ex.id}`)
    }
    expect(mal).toEqual([])
  })

  test('ordenar y escuchar-y-traducir: la frase buena (y las alternativas) se forman con las fichas', () => {
    const mal: string[] = []
    for (const { les, ex } of ejercicios) {
      if (ex.type !== 'order_sentence' && ex.type !== 'listen_translate') continue
      for (const frase of [ex.correctAnswer, ...(ex.alsoAccept || [])]) {
        if (!sePuedeFormar(frase, ex.options || [])) mal.push(`${les} ${ex.id}: «${frase}»`)
      }
    }
    expect(mal).toEqual([])
  })

  test('ordenar: ni sobran ni faltan fichas', () => {
    const mal: string[] = []
    for (const { les, ex } of ejercicios) {
      if (ex.type !== 'order_sentence') continue
      const palabras = norm(ex.correctAnswer).split(' ').length
      const enFichas = (ex.options || []).map(norm).join(' ').split(' ').length
      if (palabras !== enFichas) mal.push(`${les} ${ex.id}`)
    }
    expect(mal).toEqual([])
  })

  test('verdadero / falso bien escritos y ningún ejercicio sin respuesta', () => {
    const mal: string[] = []
    for (const { les, ex } of ejercicios) {
      if (ex.type === 'true_false' && !['verdadero', 'falso'].includes(ex.correctAnswer)) mal.push(`${les} ${ex.id}`)
      if (!ex.correctAnswer && !['match_pairs', 'pair_memory'].includes(ex.type)) mal.push(`${les} ${ex.id} (sin respuesta)`)
    }
    expect(mal).toEqual([])
  })

  test('emparejar: ninguna palabra de la izquierda repetida', () => {
    const mal: string[] = []
    for (const { les, ex } of ejercicios) {
      if (!ex.pairs) continue
      const izq = ex.pairs.map((p) => norm(p.left))
      if (new Set(izq).size !== izq.length) mal.push(`${les} ${ex.id}`)
    }
    expect(mal).toEqual([])
  })

  test('«mijn vriend(in)» nunca es «amigo/a» ni «Hij is een vriend» es «novio»', () => {
    // El diálogo m2d6-9 lo dice mal A PROPÓSITO: Anna le corrige en la línea siguiente.
    const BROMA = new Set(['m2d6-9'])
    const mal: string[] = []
    for (const p of pares) {
      if (BROMA.has(p.id)) continue
      const nl = ` ${norm(p.nl)} `
      const es = norm(p.es)
      if (/ (mijn|je|jouw|zijn|haar|onze|hun|uw) vriend(in)? /.test(nl) && /amig[oa]\b/.test(es) && !/novi/.test(es)) mal.push(`${p.les} ${p.id}: «${p.nl}» → «${p.es}»`)
      if (/ (is|ben|bent) een vriend(in)? /.test(nl) && /novi[oa]\b/.test(es) && !/amig/.test(es)) mal.push(`${p.les} ${p.id}: «${p.nl}» → «${p.es}»`)
    }
    expect(mal).toEqual([])
  })

  test('la misma frase no es «novio» en un sitio y «amigo» en otro', () => {
    const porFrase = new Map<string, Set<string>>()
    for (const p of pares) {
      if (p.id === 'm2d6-9') continue
      const es = norm(p.es)
      const que = /novi[oa]/.test(es) ? 'novio' : /amig[oa]/.test(es) ? 'amigo' : ''
      if (!que) continue
      const k = norm(p.nl)
      porFrase.set(k, (porFrase.get(k) || new Set()).add(que))
    }
    expect([...porFrase].filter(([, s]) => s.size > 1).map(([k]) => k)).toEqual([])
  })

  test('un hueco largo (______) es UNA caja, no dos', () => {
    // LessonViewer parte el enunciado por /_{3,}/: seis rayas son un solo hueco.
    for (const { ex } of ejercicios) {
      if (ex.type !== 'fill_blank') continue
      const huecos = ex.prompt.split(/_{3,}/).length - 1
      const palabras = norm(ex.correctAnswer).split(' ').length
      if (huecos > 1) expect(`${ex.id}: ${palabras >= huecos}`).toBe(`${ex.id}: true`)
    }
  })
})
