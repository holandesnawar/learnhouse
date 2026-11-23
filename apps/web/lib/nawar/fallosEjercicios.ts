/**
 * «¿Ves un fallo? Avísanos» (23/11/2026): lo puro del navegador.
 *
 * El alumno avisa desde el propio ejercicio; el equipo lo ve en Panel →
 * Formación → «Fallos avisados». Aquí: qué se manda de lo que el alumno tenía
 * delante (`datosDelEjercicio`) y el texto del botón «Copiar» del panel
 * (`textoParaCopiar`), pensado para pegarlo tal cual a quien arregla el
 * ejercicio en `courseData.ts`. El porqué entero, en
 * `apps/api/src/services/ejercicios/avisos.py`.
 */

export type MotivoFallo = 'respuesta' | 'varias' | 'texto' | 'audio' | 'otra'

/** Lo que el alumno elige, en el orden en que se le enseña. */
export const MOTIVOS_FALLO: { id: MotivoFallo; texto: string }[] = [
  { id: 'respuesta', texto: 'La respuesta buena no es esa' },
  { id: 'varias', texto: 'Hay más de una respuesta buena' },
  { id: 'texto', texto: 'Error en el texto o en la traducción' },
  { id: 'audio', texto: 'El audio' },
  { id: 'otra', texto: 'Otra cosa' },
]

export type DatosDelFallo = {
  tipo: string
  enunciado: string
  enunciado_nl?: string
  opciones: string[]
  correcta: string
  tambien: string[]
  parejas: { izquierda: string; derecha: string }[]
  respuesta_alumno: string
  leccion: string
  modulo: string
  seccion?: string
  course_uuid?: string
  activity_uuid?: string
}

type EjercicioMinimo = {
  id: string
  type: string
  prompt: string
  promptNl?: string
  options?: string[]
  correctAnswer: string
  alsoAccept?: string[]
  pairs?: { left: string; right: string }[]
}

export type DondeEsta = { leccion?: string; modulo?: string; seccion?: string; courseUuid?: string; activityUuid?: string }

/** Lo que se manda con el aviso: lo que el alumno veía y lo que contestó. */
export function datosDelEjercicio(e: EjercicioMinimo, respuesta: string | undefined, donde: DondeEsta = {}): DatosDelFallo {
  return {
    tipo: e.type,
    enunciado: e.prompt || '',
    enunciado_nl: e.promptNl || '',
    opciones: e.options || [],
    correcta: e.correctAnswer || '',
    tambien: e.alsoAccept || [],
    parejas: (e.pairs || []).map((p) => ({ izquierda: p.left, derecha: p.right })),
    respuesta_alumno: (respuesta || '').trim(),
    leccion: donde.leccion || '',
    modulo: donde.modulo || '',
    seccion: donde.seccion || '',
    course_uuid: donde.courseUuid || '',
    activity_uuid: donde.activityUuid || '',
  }
}

/** Los tipos de ejercicio, dichos en cristiano (para el panel). */
const TIPO: Record<string, string> = {
  multiple_choice: 'Elegir una opción',
  write_answer: 'Escribir',
  fill_blank: 'Rellenar el hueco',
  true_false: 'Verdadero o falso',
  order_sentence: 'Ordenar la frase',
  match_pairs: 'Emparejar',
  odd_one_out: 'El intruso',
  letter_dash: 'Letras que faltan',
  word_scramble: 'Ordenar las letras',
  emoji_choice: 'Elegir el dibujo',
  listen_and_choose: 'Escuchar y elegir',
  listen_choose_image: 'Escuchar y tocar el dibujo',
  listen_translate: 'Escuchar y traducir',
  spreken_choose: 'Spreken: qué dirías',
  pair_memory: 'Parejas',
}

export const nombreDeTipo = (tipo: string) => TIPO[tipo] || tipo || 'Ejercicio'

export type AvisoDeAlumno = { nombre: string; motivo: string; motivo_texto: string; comentario: string; respuesta_alumno: string; estado: string; at: string }

export type GrupoDeFallos = {
  lesson_id: string
  exercise_id: string
  datos: Partial<DatosDelFallo>
  avisos: AvisoDeAlumno[]
  abiertos: number
  alumnos: number
  ultimo: string
  estado: 'nuevo' | 'arreglado' | 'no-era'
  cerrado_at: string
  cerrado_por: string
}

/** «3 alumnos» / «1 alumno». */
export const cuantosAlumnos = (n: number) => (n === 1 ? '1 alumno' : `${n} alumnos`)

/**
 * El texto del botón «Copiar»: todo lo que hace falta para encontrar el
 * ejercicio en `courseData.ts` y saber qué le pasa, sin nombres de alumnos
 * (es para pegarlo fuera de la escuela).
 */
export function textoParaCopiar(g: GrupoDeFallos): string {
  const d = g.datos || {}
  const lineas: string[] = []
  lineas.push(`Fallo avisado en un ejercicio (${cuantosAlumnos(g.alumnos)})`)
  lineas.push(`Lección: ${[d.modulo, d.leccion].filter(Boolean).join(' · ') || '—'}${g.lesson_id ? ` (${g.lesson_id})` : ''}`)
  lineas.push(`Ejercicio: ${g.exercise_id}${d.tipo ? ` · ${nombreDeTipo(d.tipo)} (${d.tipo})` : ''}`)
  if (d.enunciado) lineas.push(`Enunciado: ${d.enunciado}`)
  if (d.enunciado_nl) lineas.push(`Enunciado en neerlandés: ${d.enunciado_nl}`)
  if (d.opciones?.length) lineas.push(`Opciones: ${d.opciones.join(' | ')}`)
  if (d.parejas?.length) lineas.push(`Parejas: ${d.parejas.map((p) => `${p.izquierda} = ${p.derecha}`).join(' | ')}`)
  if (d.correcta) lineas.push(`Respuesta que da por buena la escuela: ${d.correcta}`)
  if (d.tambien?.length) lineas.push(`También acepta: ${d.tambien.join(' | ')}`)
  lineas.push('')
  lineas.push('Lo que dicen los alumnos:')
  g.avisos.forEach((a, i) => {
    const partes = [a.motivo_texto]
    if (a.respuesta_alumno) partes.push(`contestó «${a.respuesta_alumno}»`)
    if (a.comentario) partes.push(`«${a.comentario}»`)
    lineas.push(`${i + 1}. ${partes.join(' · ')}`)
  })
  return lineas.join('\n')
}
