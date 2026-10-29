/**
 * Los dos cursos de la escuela, en UN solo sitio.
 *
 * Estos identificadores estaban copiados a mano en la barra lateral, en el
 * onboarding y en el Inicio. Copiados significa que se separan: el onboarding
 * mandaba a `/courses` —el listado genérico de LearnHouse— mientras la barra
 * lateral ya llevaba directo a la Formación, así que el alumno acababa en una
 * pantalla que no debía ver justo en su primer paso.
 *
 * Si algún día se crea otro curso (A1-A2), se añade aquí y se enlaza desde
 * donde toque. El listado `/courses` NO vuelve: mientras haya un solo camino
 * que hacer, enseñar un índice de cursos es dar a elegir donde no hay elección.
 */

export const CURSO_FORMACION_UUID = '8a1d1fab-ffbb-44ef-8f21-04ef63676d6e'
export const CURSO_CLASE_SEMANAL_UUID = 'bfbcb42b-7dc3-4448-9df8-5d7b96135859'

/** La formación A0-A1: el camino del alumno. */
export const RUTA_FORMACION = `/course/${CURSO_FORMACION_UUID}`
/** La clase semanal en vivo y sus grabaciones. */
export const RUTA_CLASE_SEMANAL = `/course/${CURSO_CLASE_SEMANAL_UUID}`

/** Un curso de la lista sin el prefijo `course_` de la base de datos. */
export const uuidDeCurso = (c: { course_uuid?: string } | null | undefined) =>
  String(c?.course_uuid || '').replace(/^course_/, '')

/**
 * Lo que la escuela guarda de cada curso de clases en directo: org_config
 * `salas` = { uuid del curso (sin `course_`): { activo, grabar, directo,
 * banner } }. Lo escribe la API (`services/salas/salas.py`); el navegador lo
 * lee de la configuración de la escuela, que ya tiene cargada.
 */
export type AjustesDirecto = {
  activo: boolean
  grabar: boolean
  directo: boolean
  /** Si la página enseña las clases grabadas; null = sin decidir (`conGrabadas`). */
  grabadas: boolean | null
  banner: Record<string, string> | null
  /** Rótulo que solo ven los administradores («Groep rood»), 29/10/2026. */
  etiqueta: string
}

export function ajustesDirecto(config: any, curso: string | null | undefined): AjustesDirecto {
  const uuid = String(curso || '').replace(/^course_/, '')
  const todas = config && typeof config === 'object' ? config.salas : null
  const propia = todas && typeof todas === 'object' ? todas[uuid] : null
  const p = propia && typeof propia === 'object' ? propia : {}
  return {
    activo: !!p.activo,
    grabar: !!p.grabar,
    directo: !!p.directo,
    grabadas: typeof p.grabadas === 'boolean' ? p.grabadas : null,
    banner: p.banner && typeof p.banner === 'object' ? p.banner : null,
    etiqueta: typeof p.etiqueta === 'string' ? p.etiqueta.trim() : '',
  }
}

/**
 * El color de la etiqueta de un curso, por la palabra (29/10/2026: «Groep
 * rood» / «Groep blauw»): rojo, azul, verde, amarillo o morado, en neerlandés,
 * español o inglés. Lo demás, gris. Solo es una pista para el administrador.
 */
export function colorDeEtiqueta(texto: string): 'rojo' | 'azul' | 'verde' | 'amarillo' | 'morado' | 'gris' {
  const t = String(texto || '').toLowerCase()
  if (/\b(rood|rojo|roja|red)\b/.test(t)) return 'rojo'
  if (/\b(blauw|azul|blue)\b/.test(t)) return 'azul'
  if (/\b(groen|verde|green)\b/.test(t)) return 'verde'
  if (/\b(geel|amarillo|amarilla|yellow)\b/.test(t)) return 'amarillo'
  if (/\b(paars|morado|morada|lila|purple)\b/.test(t)) return 'morado'
  return 'gris'
}

/**
 * ¿Enseña esta clase en directo sus clases grabadas? (27/10/2026: "en
 * Spreekclub lo de clases grabadas no va, y por ahora en Masterclass
 * tampoco"). Lo decide el administrador en la página del curso; sin decidir,
 * solo la clase semanal de siempre, que es la única que tiene grabaciones. Una
 * copia de la clase semanal (otro grupo) se enciende a mano.
 */
export function conGrabadas(config: any, curso: string | null | undefined): boolean {
  const uuid = String(curso || '').replace(/^course_/, '')
  const elegido = ajustesDirecto(config, uuid).grabadas
  return elegido ?? uuid === CURSO_CLASE_SEMANAL_UUID
}

/**
 * ¿Es un curso de clases en directo? (27/10/2026, la clase semanal partida en
 * dos grupos.) La clase semanal de siempre, y cualquier curso al que se le ha
 * encendido alguna vez la sala (`directo` se queda puesto al apagarla, para
 * que el curso no vuelva a parecer una formación). Estos cursos se pintan como
 * la clase semanal: su recuadro con día y hora, las grabaciones por meses y
 * sin progreso ni «Empezar curso».
 */
export function esCursoEnDirecto(curso: string | null | undefined, config: any): boolean {
  const uuid = String(curso || '').replace(/^course_/, '')
  if (!uuid) return false
  if (uuid === CURSO_CLASE_SEMANAL_UUID) return true
  const a = ajustesDirecto(config, uuid)
  return a.activo || a.directo
}

export type CursoEnDirecto = { uuid: string; nombre: string }

/**
 * Las clases en directo que ve ESTE alumno (25/10/2026): los cursos de su
 * lista que no son la formación. La lista ya viene filtrada por el servidor
 * según sus grupos, así que la beta ve «Clase semanal» y el programa nuevo
 * ve su masterclass y sus spreekuren, sin escribir aquí ningún id más.
 * Sin publicar no salen (el equipo los ve en la lista, pero son borradores).
 * La clase semanal, primero y con su nombre de siempre.
 */
export function cursosEnDirecto(lista: any[]): CursoEnDirecto[] {
  return (Array.isArray(lista) ? lista : [])
    .filter((c) => c && c.published !== false && uuidDeCurso(c) && uuidDeCurso(c) !== CURSO_FORMACION_UUID)
    .map((c) => ({
      uuid: uuidDeCurso(c),
      nombre: uuidDeCurso(c) === CURSO_CLASE_SEMANAL_UUID ? 'Clase semanal' : String(c.name || 'Clases en directo'),
    }))
    .sort((a, b) =>
      a.uuid === CURSO_CLASE_SEMANAL_UUID ? -1 : b.uuid === CURSO_CLASE_SEMANAL_UUID ? 1 : a.nombre.localeCompare(b.nombre, 'es')
    )
}
