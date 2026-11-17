/**
 * La dirección de un canal (o de una publicación) puede llegar con el
 * prefijo o sin él: «/community/<uuid>» es la forma de la escuela, pero los
 * avisos de la campana y algunos correos ya enviados llevan
 * «/community/community_<uuid>» (16/11/2026). Antes la página le añadía otra
 * vez el prefijo («community_community_…») y salía «no tienes acceso».
 */
export function conPrefijo(valor: string, prefijo: string): string {
  let v = valor || ''
  try {
    v = decodeURIComponent(v)
  } catch {
    // se queda como venía
  }
  return v.startsWith(prefijo) ? v : `${prefijo}${v}`
}

export function sinPrefijo(valor: string, prefijo: string): string {
  const v = valor || ''
  return v.startsWith(prefijo) ? v.slice(prefijo.length) : v
}

export const uuidCanal = (valor: string) => conPrefijo(valor, 'community_')
export const uuidPublicacion = (valor: string) => conPrefijo(valor, 'discussion_')
