/**
 * En el Spreek Club no se dice «clase» (usuario, 18/11/2026: "te dije que no
 * quería leer más clase en el Spreek Club"): es una sesión de conversación
 * con un monitor, no una clase. Las pantallas que valen para todas las clases
 * en directo pasan sus textos por aquí con el nombre del curso.
 */
import { tipoDeClase } from './visitaGuiada'

/** «clase» → «sesión», «Clases» → «Sesiones», respetando la mayúscula. */
export function comoSesion(t: string): string {
  return String(t ?? '').replace(/\b([Cc])lase(s)?\b/g, (_m, c: string, s?: string) => (c === 'C' ? 'S' : 's') + (s ? 'esiones' : 'esión'))
}

/** La función que traduce los textos de ese curso: en el Spreek Club, a «sesión»; en los demás, igual. */
export function textosDeClase(nombreCurso?: string | null): (t: string) => string {
  return nombreCurso && tipoDeClase(nombreCurso) === 'conversacion' ? comoSesion : (t: string) => t
}
