/**
 * La sesión que no se queda «a medias» (16/11/2026).
 *
 * Síntoma: al volver al ordenador (portátil dormido, pestaña en segundo plano)
 * la escuela decía «sesión iniciada» pero faltaban «Mis clases» y «Comunidad»
 * en la barra y el chat salía vacío; con recargar, todo volvía.
 *
 * Causa: el permiso (access token, 8 h) caducaba sin renovarse, porque el
 * reloj que lo renovaba no corre con el portátil dormido. Y la API NO contesta
 * 401 a un permiso caducado en casi ninguna ruta: lo trata como a un visitante
 * anónimo (`get_current_user` → AnonymousUser) y devuelve solo lo público. Por
 * eso no fallaba nada «en rojo»: la lista de cursos llegaba sin las clases
 * cerradas a un grupo y la de canales, vacía.
 *
 * Aquí está la lógica pura (con tests en __tests__/sesion.test.ts); la usa
 * `components/Contexts/AuthContext.tsx`.
 */

/** Renovar si quedan menos de 5 minutos de permiso. */
export const MARGEN_RENOVAR_MS = 5 * 60_000

/** Antes de mandar una petición: renovar si al permiso le queda menos de esto. */
export const MARGEN_PETICION_MS = 30_000

/** Tras un 401, no volver a forzar una renovación antes de este rato. */
export const ESPERA_ENTRE_FORZADAS_MS = 30_000

/** Cuándo caduca un JWT (ms), leído de su `exp`. Sin verificar la firma. */
export function expiraDelJwt(token: string | null | undefined): number | null {
  if (!token || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const relleno = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = JSON.parse(atob(b64 + relleno))
    return typeof json?.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/** ¿Toca renovar? Sin fecha de caducidad conocida, no. */
export function tocaRenovar(
  expiraMs: number | null | undefined,
  ahora: number = Date.now(),
  margenMs: number = MARGEN_RENOVAR_MS
): boolean {
  if (typeof expiraMs !== 'number' || !Number.isFinite(expiraMs)) return false
  return ahora + margenMs >= expiraMs
}

/**
 * Qué hacer con la respuesta de `/api/auth/refresh`:
 *  - 'ok': hay permiso nuevo.
 *  - 'fuera': la sesión ya no vale de verdad (401/403): se cierra, como siempre.
 *  - 'reintentar': cualquier otra cosa (sin red, 429, 500, 502 de un
 *    despliegue…). Eso NO saca a nadie: se vuelve a probar.
 */
export function queHacerConRefresco(status: number): 'ok' | 'fuera' | 'reintentar' {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403) return 'fuera'
  return 'reintentar'
}

/** Espera antes del intento N (desde 0) tras un fallo de red: 2, 4, 8, 16, 30 s… */
export function esperaReintento(intento: number): number {
  return Math.min(2_000 * 2 ** Math.max(0, intento), 30_000)
}

/** El permiso que lleva una petición, si es un JWT nuestro («Bearer x.y.z»). */
export function tokenDeCabeceras(headers: HeadersInit | undefined | null): string | null {
  if (!headers) return null
  let valor: string | null = null
  try {
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      valor = headers.get('Authorization')
    } else if (Array.isArray(headers)) {
      const par = headers.find(([k]) => String(k).toLowerCase() === 'authorization')
      valor = par ? String(par[1]) : null
    } else {
      const clave = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization')
      valor = clave ? String((headers as Record<string, string>)[clave]) : null
    }
  } catch {
    return null
  }
  const m = /^Bearer\s+(.+)$/i.exec((valor || '').trim())
  if (!m) return null
  const token = m[1].trim()
  // Las claves de API («lh_…») no se renuevan: solo los JWT de la sesión.
  return token.split('.').length === 3 && !token.startsWith('lh_') ? token : null
}

/** ¿Va esta dirección a la API de la escuela? */
export function esDeLaApi(url: string, baseApi: string, origen: string = ''): boolean {
  if (!url) return false
  if (baseApi && url.startsWith(baseApi)) return true
  if (url.startsWith('/api/v1/')) return true
  if (origen && url.startsWith(`${origen}/api/v1/`)) return true
  return false
}

/**
 * ¿Se puede repetir sola una petición tras renovar el permiso? Solo las que
 * leen (GET/HEAD): un POST que dio 401 puede ser «contraseña actual
 * incorrecta», y repetirlo contaría otro intento fallido.
 */
export function sePuedeRepetir(method: string | undefined): boolean {
  const m = (method || 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}
