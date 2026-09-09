// Lo que se escribe y lo que se dice no siempre coinciden. El TTS recibe el
// texto tal cual está en el contenido, y hay dos casos en los que eso suena mal:
//
// 1. Las abreviaturas. "i.v.m." se ESCRIBE así pero se DICE "in verband met";
//    "idd" se dice "inderdaad". Leído letra a letra no lo entiende nadie, y es
//    justo lo contrario de lo que enseña la lección (que en voz alta van
//    enteras). Se sustituyen antes de mandarlo a la voz.
//
// 2. Deletrear. "C-A-R-L-O-S" con guiones se comía la erre. El diálogo de esa
//    misma lección deletrea con comas ("M, A, R, T, I, N, E, Z") y se oye bien,
//    así que se pasa al mismo formato.
//
// Es el diccionario "escrito → lo que se le manda al TTS" que estaba apuntado
// en CLAUDE.md como la forma que escala. Vive aquí, puro y con tests; el único
// que lo llama es `app/api/tts/route.ts`.

const ABREVIATURAS: Array<[string, string]> = [
  // Cartas y correos
  ['a.u.b.', 'alstublieft'],
  ['s.v.p.', 'alstublieft'],
  ['z.s.m.', 'zo spoedig mogelijk'],
  ['i.v.m.', 'in verband met'],
  ['d.w.z.', 'dat wil zeggen'],
  ['m.v.g.', 'met vriendelijke groet'],
  ['t.a.v.', 'ter attentie van'],
  ['i.p.v.', 'in plaats van'],
  ['m.i.v.', 'met ingang van'],
  ['n.v.t.', 'niet van toepassing'],
  ['o.a.', 'onder andere'],
  ['bijv.', 'bijvoorbeeld'],
  ['enz.', 'enzovoort'],
  ['incl.', 'inclusief'],
  ['excl.', 'exclusief'],
  ['ca.', 'circa'],
  ['t/m', 'tot en met'],
  // Marktplaats
  ['z.g.a.n.', 'zo goed als nieuw'],
  ['n.o.t.k.', 'nader overeen te komen'],
  // Chat
  ['idd', 'inderdaad'],
  ['ff', 'even'],
  ['mss', 'misschien'],
  ['iig', 'in ieder geval'],
  ['grtjs', 'groetjes'],
  ['wrs', 'waarschijnlijk'],
]

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

// Solo como palabra suelta: ni "ff" dentro de "koffie" ni "ca." dentro de
// "Mallorca." Las letras y cifras a los lados lo impiden.
const REGLAS = ABREVIATURAS.map(([abrev, entera]) => ({
  re: new RegExp(`(?<![\\p{L}\\p{N}])${escapar(abrev)}(?![\\p{L}\\p{N}])`, 'giu'),
  entera,
}))

// "C-A-R-L-O-S" → "C, A, R, L, O, S". Cada trozo tiene que ser UNA letra, así
// que "e-mail" o "T-shirt" no entran.
const DELETREO = /\b[A-Za-z](?:-[A-Za-z])+\b/g

export function textoParaVoz(texto: string): string {
  let t = texto
  for (const { re, entera } of REGLAS) t = t.replace(re, entera)
  t = t.replace(DELETREO, (m) => m.split('-').join(', '))
  return t
}
