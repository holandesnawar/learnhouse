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
