// Cuaderno de repaso de un módulo, para imprimir (12/10/2026).
//
// Una alumna pidió algo en papel para consultar y repasar. Esto saca de
// `courseData.ts` todo lo de cada lección de un módulo (teoría, vocabulario,
// frases, lectura, diálogo) y una selección de los ejercicios que se pueden
// hacer en papel, con las SOLUCIONES al final: el alumno se corrige solo. Los
// de escuchar se quedan en la escuela (cada lección lleva su QR).
//
// El resultado es el CONTENIDO del encargo para Claude Design; las reglas de
// diseño y la estructura van delante (ver CLAUDE.md, «Cuadernos de repaso»).
//
// Uso (desde apps/web):  bun scripts/cuaderno-repaso.ts over-jou contenido.md
//   módulos: over-jou, familie-vrienden, boodschappen, het-werk
import { writeFileSync } from 'fs'
import { LESSONS, MODULES } from '../lib/exercises-app/courseData'

const moduleId = process.argv[2] || 'over-jou'
const salida = process.argv[3] || 'contenido.md'
const modulo = MODULES.find((m) => m.id === moduleId)!
const lecciones = LESSONS.filter((l) => l.moduleId === moduleId).sort(
  (a, b) => Number(!!a.isExtra) - Number(!!b.isExtra) || a.order - b.order
)

// ── Barajado determinista (mismo resultado cada vez) ──
function semilla(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
function barajar<T>(xs: T[], clave: string): T[] {
  const a = [...xs]
  let s = semilla(clave) || 1
  const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
/** Baraja hasta que no quede igual que el original (para ordenar frases y letras). */
function desordenar<T>(xs: T[], clave: string): T[] {
  for (let k = 0; k < 20; k++) {
    const b = barajar(xs, clave + k)
    if (b.join('|') !== xs.join('|')) return b
  }
  return [...xs].reverse()
}

const LETRAS = 'abcdefghij'
const limpio = (t: string) => (t || '').replace(/\s+/g, ' ').trim()

function huecos(palabra: string): string {
  // Las vocales se quitan; la primera letra se deja de pista.
  return palabra
    .split('')
    .map((c, i) => (i > 0 && /[aeiouáéíóúë]/i.test(c) ? '_' : c))
    .join(' ')
}

type Ej = { tipo: string; enunciado: string; cuerpo: string[]; solucion: string; explicacion?: string }

function aPapel(e: any): Ej | null {
  const exp = e.explanation ? limpio(e.explanation) : undefined
  switch (e.type) {
    case 'multiple_choice':
    case 'emoji_choice':
    case 'odd_one_out':
    case 'spreken_choose': {
      const ops = barajar<string>(e.options || [], e.id)
      const i = ops.indexOf(e.correctAnswer)
      return {
        tipo: e.type === 'odd_one_out' ? 'El intruso' : e.type === 'spreken_choose' ? '¿Qué dirías?' : 'Elige',
        enunciado: limpio(e.prompt),
        cuerpo: ops.map((o: string, k: number) => `${LETRAS[k]}) ${o}`),
        solucion: `${LETRAS[i]}) ${e.correctAnswer}`,
        explicacion: exp,
      }
    }
    case 'true_false':
      return { tipo: 'Verdadero o falso', enunciado: limpio(e.prompt), cuerpo: ['V / F'], solucion: e.correctAnswer === 'verdadero' ? 'Verdadero' : 'Falso', explicacion: exp }
    case 'fill_blank':
      return { tipo: 'Completa', enunciado: limpio(e.prompt) + (e.hint ? ` — pista: ${e.hint}` : ''), cuerpo: [], solucion: e.correctAnswer, explicacion: exp }
    case 'write_answer':
      return { tipo: 'Escribe en neerlandés', enunciado: limpio(e.prompt).replace(/^Escribe en neerlandés:\s*/i, ''), cuerpo: ['______________________________'], solucion: e.correctAnswer, explicacion: exp }
    case 'order_sentence': {
      const palabras = e.options || e.correctAnswer.split(' ')
      return { tipo: 'Ordena la frase', enunciado: limpio(e.prompt).replace(/^Ordena:\s*/i, ''), cuerpo: [desordenar(palabras, e.id).join('  /  ')], solucion: e.correctAnswer, explicacion: exp }
    }
    case 'word_scramble':
      return { tipo: 'Letras desordenadas', enunciado: limpio(e.prompt), cuerpo: [desordenar(e.correctAnswer.split(''), e.id).join(' ').toUpperCase()], solucion: e.correctAnswer, explicacion: exp }
    case 'letter_dash':
      return { tipo: 'Completa las letras', enunciado: limpio(e.prompt) + (e.hint ? ` (${e.hint})` : ''), cuerpo: [huecos(e.correctAnswer)], solucion: e.correctAnswer, explicacion: exp }
    case 'match_pairs':
    case 'pair_memory': {
      const pares = e.pairs || []
      if (!pares.length) return null
      let derecha = barajar<string>(pares.map((p: any) => p.right), e.id)
      for (let k = 0; k < 20 && derecha.some((r: string, i: number) => r === pares[i].right); k++) derecha = barajar(derecha, e.id + k)
      return {
        tipo: 'Une con flechas',
        enunciado: limpio(e.prompt),
        cuerpo: pares.map((p: any, i: number) => `${i + 1}. ${p.left}   ·   ${LETRAS[i]}) ${derecha[i]}`),
        solucion: pares.map((p: any, i: number) => `${i + 1}–${LETRAS[derecha.indexOf(p.right)]}`).join(', '),
        explicacion: exp,
      }
    }
    default:
      return null // los de escuchar se quedan en la escuela
  }
}

const PRIORIDAD = ['fill_blank', 'write_answer', 'order_sentence', 'match_pairs', 'multiple_choice', 'true_false', 'odd_one_out', 'letter_dash', 'word_scramble', 'emoji_choice', 'pair_memory']
function elegir(ejs: any[], max: number, porTipo = 2): any[] {
  const out: any[] = []
  for (const t of PRIORIDAD) {
    for (const e of ejs.filter((x) => x.type === t).slice(0, porTipo)) if (out.length < max) out.push(e)
  }
  // En el orden en que salen en la lección, no agrupados por tipo.
  return ejs.filter((e) => out.includes(e))
}

const L: string[] = []
const S: string[] = []
const p = (...x: string[]) => L.push(...x)

p(`# Módulo ${modulo.order} · ${modulo.title} — ${modulo.subtitle}`, '', limpio(modulo.description), '')
S.push('# Soluciones', '')

lecciones.forEach((les, li) => {
  const num = les.isExtra ? `Extra ${lecciones.filter((x) => x.isExtra).indexOf(les) + 1}` : `Lección ${les.order}`
  const url = `https://app.holandesnawar.com/ejercicios/modulo/${moduleId}/leccion/${les.id}`
  p('---', '', `## ${num} · ${les.title.replace(/^Les \d+ — /, '').replace(/^Extra \| /, '')}`, `*${les.subtitle}*`, '')
  p(`**Objetivo:** ${limpio(les.learningObjective)}`, '', `**Practicar con audio (código QR):** ${url}`, '')
  S.push(`## ${num} · ${les.title.replace(/^Les \d+ — /, '').replace(/^Extra \| /, '')}`, '')
  let n = 0
  const ejercicios = (titulo: string, lista: any[]) => {
    const enPapel = lista.map((e) => [e, aPapel(e)] as const).filter(([, x]) => x)
    if (!enPapel.length) return
    p(`### ${titulo}`, '')
    S.push(`**${titulo}**`, '')
    for (const [, x] of enPapel) {
      n++
      p(`**${n}. ${x!.tipo}${/[?!]$/.test(x!.tipo) ? "" : "."}** ${x!.enunciado}`)
      for (const c of x!.cuerpo) p(`   ${c}`)
      p('')
      S.push(`${n}. ${x!.solucion}${x!.explicacion ? ` — ${x!.explicacion}` : ''}`)
    }
    S.push('')
  }

  for (const b of les.blocks as any[]) {
    if (b.type === 'summary') {
      p('### Lo que hemos visto', '')
      if (b.intro) p(limpio(b.intro), '')
      if (b.objectives?.length) p('Al terminar sabrás:', ...b.objectives.map((o: string) => `- ${o}`), '')
      for (const s of b.sections || []) {
        p(`#### ${s.heading}`)
        if (s.body) p(limpio(s.body))
        if (s.items?.length) {
          p('', '| Neerlandés | Español |', '|---|---|')
          for (const it of s.items) p(`| ${it.nl ?? ''} | ${it.es} |`)
        }
        p('')
      }
      if (b.tip) p(`> **Consejo:** ${limpio(b.tip)}`, '')
    }
    if (b.type === 'vocabulary') {
      p('### Vocabulario', '', '| Neerlandés | Español | Ejemplo |', '|---|---|---|')
      for (const v of b.items) {
        const palabra = v.article && !v.dutch.startsWith(v.article + ' ') ? `${v.article} ${v.dutch}` : v.dutch
        p(`| ${palabra} | ${v.spanish} | ${v.exampleNl} — *${v.exampleEs}* |`)
      }
      p('')
    }
    if (b.type === 'phrases') {
      p('### Frases útiles', '', '| Neerlandés | Español | Para |', '|---|---|---|')
      for (const f of b.items) p(`| ${f.dutch} | ${f.spanish} | ${f.context ?? ''} |`)
      p('')
    }
    if (b.type === 'lezen') {
      p(`### Lectura · ${b.title ?? 'Lezen'}`, '', ...b.textNl.split('\n').map((x: string) => (x.trim() ? x : '')), '')
      ejercicios('Comprensión de la lectura', elegir(b.exercises || [], 8, 8))
      S.push(`**Traducción de la lectura «${b.title ?? ''}»**`, '', ...b.textEs.split('\n'), '')
    }
    if (b.type === 'dialogue') {
      const d = b.dialogue
      p(`### Diálogo · ${d.title}`, '', `*${limpio(d.context)}*`, '')
      for (const l of d.lines) p(`**${l.speaker}:** ${l.dutch}  `)
      p('')
      ejercicios('Comprensión del diálogo', elegir(b.exercises || [], 5, 5))
      S.push(`**Traducción del diálogo «${d.title}»**`, '', ...d.lines.map((l: any) => `${l.speaker}: ${l.spanish}`), '')
    }
    if (b.type === 'spreken') {
      ejercicios('¿Qué dirías? (después, dilo en voz alta)', (b.exercises || []).slice(0, 4))
    }
    if (b.type === 'practice') {
      ejercicios('Ejercicios', elegir(b.exercises || [], 12))
    }
  }
})

const texto = [...L, '---', '', ...S].join('\n')
writeFileSync(salida, texto)
console.log(`${lecciones.length} lecciones · ${texto.length} caracteres · ${texto.split('\n').length} líneas`)
