import { getOrganizationContextInfo } from '@services/organizations/orgs'

/**
 * Pide los datos de la escuela y, si falla, lo vuelve a intentar.
 *
 * Por qué: la primera petición después de un reinicio (o de un despliegue)
 * puede llegar mientras la API todavía está levantándose. Con un solo intento,
 * esa petición fallaba y la página de acceso enseñaba la pantalla equivocada
 * —"Enter Your Organization", en inglés— durante unos segundos, hasta que el
 * alumno recargaba. Con dos reintentos rápidos, ese hueco desaparece: la
 * segunda o tercera llamada ya encuentra la API en pie.
 *
 * Devuelve null solo cuando de verdad no se ha podido, y entonces la página
 * enseña un aviso nuestro (no el de LearnHouse).
 */
const DELAYS_MS = [300, 900]

export async function getOrgWithRetry(
  orgslug: string,
  next: any = { revalidate: 60, tags: ['organizations'] }
): Promise<any | null> {
  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      const org = await getOrganizationContextInfo(orgslug, next)
      if (org) return org
    } catch {
      // Se ignora aquí: si era el último intento, se devuelve null abajo.
    }
    const delay = DELAYS_MS[attempt]
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
  }
  return null
}
