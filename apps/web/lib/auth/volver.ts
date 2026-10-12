/**
 * A dónde volver después de entrar (12/10/2026).
 *
 * Quien abre un enlace de la escuela sin haber entrado (un QR del Werkboek
 * escaneado con la cámara, que abre Safari y no la app instalada) iba a
 * `/login` y, tras poner la contraseña, al Inicio: el enlace se perdía. Ahora
 * `proxy.ts` manda a `/login?redirect=<ruta>`, el login lo pasa a
 * `/redirect_from_auth` y ese puente lleva a la ruta.
 *
 * Solo rutas de ESTA escuela: empieza por una sola `/`. Un `//otro.com` o un
 * `https://…` convertiría el login en un trampolín hacia cualquier web.
 */
export function rutaParaVolver(valor: string | null | undefined): string | null {
  if (!valor) return null
  const ruta = valor.trim()
  if (!ruta.startsWith('/') || ruta.startsWith('//') || ruta.startsWith('/\\')) return null
  if (/[\u0000-\u001f]/.test(ruta)) return null
  const camino = ruta.split(/[?#]/)[0]
  // Volver al login o al propio puente sería dar vueltas en círculo.
  if (camino === '/' || camino === '/login' || camino === '/redirect_from_auth') return null
  return ruta
}
