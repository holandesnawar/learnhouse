/**
 * Los ejercicios de la lectura semanal (14/11/2026).
 *
 * Usuario: "en la lectura de la semana, un botón para ir a los ejercicios y
 * ahí mismo hacerlos y ver la respuesta". El equipo los pega en «Nueva
 * lectura» con este formato, una línea por ejercicio (es lo que entrega el
 * proyecto de contenido):
 *
 *   VF | Anna fietst naar haar werk. | niet waar >> Ze gaat met de bus.
 *   OP | Hoe laat staat Anna op? | om zeven uur | om acht uur | om zes uur
 *   HU | Anna drinkt ___ bij het ontbijt. | koffie | thee | melk
 *   HU | Ik sta om zeven uur ___. | op
 *   AB | Hoe laat sta jij op? | Ik sta om half zeven op.
 *
 * - VF: verdadero o falso. La respuesta, «waar» o «niet waar».
 * - OP: elegir. La PRIMERA es la buena; se barajan al enseñarlas.
 * - HU: completar el hueco (___). La primera es la buena; con otras, se
 *   elige; sin otras, se escribe.
 * - AB: escribir tú. Lo de detrás es un ejemplo de respuesta (no se corrige).
 * - «>> …» al final: la explicación que sale al contestar.
 *
 * Lo que no se entiende no se pierde en silencio: `leerEjercicios` lo
 * devuelve aparte y el editor lo enseña.
 */

export type TipoEjercicio = 'vf' | 'op' | 'hu' | 'ab'

export interface EjercicioLectura {
  tipo: TipoEjercicio
  pregunta: string
  correcta: string
  opciones: string[]
  explicacion?: string
}

const TIPOS: Record<string, TipoEjercicio> = {
  vf: 'vf',
  'v/f': 'vf',
  verdadero: 'vf',
  waar: 'vf',
  op: 'op',
  opcion: 'op',
  opción: 'op',
  elegir: 'op',
  hu: 'hu',
  hueco: 'hu',
  completa: 'hu',
  ab: 'ab',
  abierta: 'ab',
  escribe: 'ab',
}

export const TITULO_TIPO: Record<TipoEjercicio, string> = {
  vf: '¿Verdadero o falso?',
  op: 'Elige la respuesta',
  hu: 'Completa la frase',
  ab: 'Escribe tú',
}

function vf(valor: string): string {
  const v = valor.trim().toLowerCase()
  return v.includes('niet') || v === 'falso' || v === 'f' || v === 'no' || v === 'onwaar' ? 'niet waar' : 'waar'
}

export function leerEjercicios(texto: string): { ejercicios: EjercicioLectura[]; noEntendidas: string[] } {
  const ejercicios: EjercicioLectura[] = []
  const noEntendidas: string[] = []
  for (const cruda of (texto || '').split('\n')) {
    const linea = cruda.trim().replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '')
    if (!linea) continue
    const [cuerpo, ...resto] = linea.split('>>')
    const explicacion = resto.join('>>').trim()
    const partes = cuerpo.split('|').map((p) => p.trim()).filter(Boolean)
    const tipo = TIPOS[(partes[0] || '').toLowerCase()]
    if (!tipo || partes.length < 2 || (tipo !== 'ab' && partes.length < 3)) {
      noEntendidas.push(cruda.trim())
      continue
    }
    const pregunta = partes[1]
    let correcta = partes[2] || ''
    let opciones = partes.slice(3)
    if (tipo === 'vf') {
      correcta = vf(correcta)
      opciones = []
    }
    if (tipo === 'ab') opciones = []
    ejercicios.push({ tipo, pregunta, correcta, opciones, ...(explicacion ? { explicacion } : {}) })
  }
  return { ejercicios: ejercicios.slice(0, 30), noEntendidas }
}

/** Para volver a enseñarlos en el editor, con el mismo formato. */
export function aTexto(ejercicios: EjercicioLectura[] | undefined): string {
  return (ejercicios || [])
    .map((e) => {
      const partes = [e.tipo.toUpperCase(), e.pregunta, e.correcta, ...(e.opciones || [])].filter((p) => p !== '')
      return partes.join(' | ') + (e.explicacion ? ` >> ${e.explicacion}` : '')
    })
    .join('\n')
}

/** Para comparar lo escrito: sin mayúsculas, espacios de más ni puntuación
 *  final (las tildes sí cuentan, como en la formación). */
export function normalizar(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[.,!?¡¿;:"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function esCorrecta(e: EjercicioLectura, respuesta: string): boolean {
  if (e.tipo === 'ab') return true
  return normalizar(respuesta) === normalizar(e.correcta)
}

/** Las opciones de un ejercicio de elegir, siempre en el mismo orden para
 *  ese ejercicio (no salta al volver a pintar) y casi nunca con la buena
 *  primero. */
export function opcionesDe(e: EjercicioLectura, semilla = 0): string[] {
  if (e.tipo === 'vf') return ['waar', 'niet waar']
  const todas = [e.correcta, ...(e.opciones || [])]
  if (todas.length < 2) return []
  let h = semilla
  for (const c of e.pregunta) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const giro = 1 + (h % (todas.length - 1))
  return [...todas.slice(giro), ...todas.slice(0, giro)]
}
