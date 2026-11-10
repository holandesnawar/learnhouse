/**
 * Avisar a la escuela de que una pantalla se ha roto (10/11/2026).
 *
 * Hasta hoy nos enterábamos cuando un alumno mandaba la captura de «¡Algo
 * salió mal!». Ahora el propio navegador lo dice: qué error, en qué página,
 * si la tenía traducida (el traductor de Chrome rompe React: ver «La escuela
 * no se deja traducir» en CLAUDE.md) y si la usa como app instalada. Se ve en
 * Panel → Estado. El servidor limpia correos e identificadores antes de
 * guardarlo (apps/api/src/services/estado/estado.py).
 *
 * Reglas: nunca lanza, nunca espera, nunca cambia lo que se pinta. Como mucho
 * cinco avisos por carga de página, y el mismo error una sola vez.
 */
import { getAPIUrl } from '@services/config/config'

export type DondeFallo = 'global' | 'pagina' | 'trozo'

const vistos = new Set<string>()
const TOPE = 5

/** ¿Está la página pasada por un traductor (Chrome, Edge, una extensión)? */
export function paginaTraducida(): boolean {
  try {
    const h = document.documentElement
    if (h.classList.contains('translated-ltr') || h.classList.contains('translated-rtl')) return true
    const idioma = (h.getAttribute('lang') || 'es').toLowerCase()
    if (idioma && !idioma.startsWith('es')) return true
    // El traductor de Chrome envuelve cada texto en <font><font>…</font></font>.
    return !!document.querySelector('font > font')
  } catch {
    return false
  }
}

/** ¿Va como app instalada en la pantalla de inicio? */
export function comoApp(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/** El mensaje del error y la primera línea útil de su pila. Puro. */
export function resumirError(error: unknown): { mensaje: string; pila: string } {
  const e = (error ?? {}) as { name?: unknown; message?: unknown; stack?: unknown }
  const texto = typeof e.message === 'string' && e.message ? e.message : String(error ?? '')
  const nombre = typeof e.name === 'string' && e.name && e.name !== 'Error' ? `${e.name}: ` : ''
  const mensaje = `${nombre}${texto}`.replace(/\s+/g, ' ').trim().slice(0, 300)
  const pila =
    String(typeof e.stack === 'string' ? e.stack : '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('at ') || /@.+:\d+/.test(l)) ?? ''
  return { mensaje, pila: pila.slice(0, 240) }
}

/** No son fallos: Next recarga solo cuando hay una versión nueva desplegada. */
const NO_SON_FALLOS = /Failed to find Server Action|older or newer deployment/

export function avisarPantallaRota(error: unknown, donde: DondeFallo, nombre?: string): void {
  try {
    if (typeof window === 'undefined') return
    const { mensaje, pila } = resumirError(error)
    if (!mensaje || NO_SON_FALLOS.test(mensaje)) return
    const clave = `${donde}|${nombre ?? ''}|${mensaje}`
    if (vistos.has(clave) || vistos.size >= TOPE) return
    vistos.add(clave)

    let base = '/api/v1/'
    try {
      base = getAPIUrl() || base
    } catch {}
    const url = `${base}estado/pantalla`
    const cuerpo = JSON.stringify({
      m: mensaje,
      p: pila,
      u: window.location.pathname,
      t: paginaTraducida(),
      a: comoApp(),
      d: donde,
      n: (nombre ?? '').slice(0, 40),
    })
    // Como texto: así el navegador no hace consulta previa de CORS.
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, cuerpo)) return
    void fetch(url, {
      method: 'POST',
      body: cuerpo,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      credentials: 'include',
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Avisar es un extra: si falla, no pasa nada.
  }
}
