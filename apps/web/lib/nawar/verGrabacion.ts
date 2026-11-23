/**
 * La grabación de una clase en directo, en su propia página (23/11/2026).
 *
 * Antes, una grabación que es una clase de vídeo del curso se abría «como un
 * curso» (barra de capítulos, «46 % completado», «Anterior / Siguiente»), y la
 * que grabó la sala, en una ventana. Ahora todas se abren igual, en
 * `/grabacion/<curso>/<clave>`, con la grabación anterior y la siguiente
 * debajo. Lo mismo que se hizo con las presentaciones (verPresentacion.ts).
 *
 * La `clave` de la dirección:
 * - `semana-<id>`: lo que grabó la sala ese día, o el enlace pegado
 *   (`grabacion_sala` de la semana).
 * - el uuid de la clase de vídeo sin `activity_`: una grabación subida como
 *   clase del curso, esté en una semana o en los meses de antes.
 *
 * Aquí, sin pantalla: qué grabaciones hay (el servidor ya le quita al alumno
 * lo que todavía no puede ver), cuál es cada una y cuáles van antes y después.
 */
import type { ClaseSemana, Semana, SemanasClase, VideoGrabacion } from '@services/tareas/tareas'
import type { GrabacionSala } from '@services/grabaciones/grabaciones'

export type GrabacionDeClase = {
  clave: string
  /** sala = lo que grabó la sala (con su recorte); enlace = pegado a mano; clase = una clase de vídeo del curso. */
  de: 'sala' | 'enlace' | 'clase'
  tema: string
  fecha: string
  profe: string
  vista: boolean
  /** La semana de la que es (las de los meses de antes no tienen). */
  semanaId?: number
  /** La clase de vídeo del curso (para marcarla como vista). */
  actividad?: string
  video?: (VideoGrabacion & { archivo?: string }) | null
  sala?: GrabacionSala
}

const sinPrefijo = (uuid: string) => String(uuid || '').replace(/^course_/, '')

/** La clave de una clase de vídeo: su uuid sin `activity_`. */
export const claveDeClase = (activityUuid: string) => String(activityUuid || '').replace(/^activity_/, '')
export const claveDeSemana = (semanaId: number) => `semana-${semanaId}`

/** `/grabacion/<curso>/<clave>` (sin la escuela delante). */
export const rutaGrabacion = (courseUuid: string, clave: string) => `/grabacion/${sinPrefijo(courseUuid)}/${clave}`

/**
 * A dónde lleva una clase de una semana: una grabación que la escuela sabe
 * reproducir, a su página; todo lo demás (y un vídeo que no reconoce), a la
 * pantalla del curso de siempre.
 */
export function rutaDeClase(courseUuid: string, c: Pick<ClaseSemana, 'activity_uuid' | 'tipo' | 'video'>): string {
  if (c.tipo === 'grabacion' && c.video) return rutaGrabacion(courseUuid, claveDeClase(c.activity_uuid))
  return `/course/${sinPrefijo(courseUuid)}/activity/${claveDeClase(c.activity_uuid)}`
}

function deSemana(s: Semana): GrabacionDeClase[] {
  const out: GrabacionDeClase[] = []
  const sala = s.grabacion_sala
  if (sala && (sala.enlace?.url || sala.partes?.length))
    out.push({
      clave: claveDeSemana(s.id),
      de: sala.enlace?.url ? 'enlace' : 'sala',
      tema: s.tema || '',
      fecha: s.fecha || '',
      profe: (s.material_profe?.profe || '').trim(),
      vista: !!sala.vista,
      semanaId: s.id,
      sala,
    })
  for (const c of s.clases || []) {
    if (c.tipo !== 'grabacion' || !c.video) continue
    out.push({
      clave: claveDeClase(c.activity_uuid),
      de: 'clase',
      // Una grabación de los meses de antes colocada en esta semana trae su día y su profe.
      tema: (c.suelta ? c.tema : '') || s.tema || '',
      fecha: (c.suelta ? c.fecha : '') || s.fecha || '',
      profe: ((c.suelta ? c.profe : '') || s.material_profe?.profe || '').trim(),
      vista: !!c.hecha,
      semanaId: s.id,
      actividad: c.activity_uuid,
      video: c.video,
    })
  }
  return out
}

/**
 * Todas las grabaciones de una clase, de la más antigua a la más nueva.
 * `conArchivo`: si esa clase enseña sus grabaciones de los meses de antes
 * (el Spreekclub y la Masterclass, no).
 */
export function grabacionesDe(datos: Pick<SemanasClase, 'semanas' | 'archivo'> | null | undefined, conArchivo = true): GrabacionDeClase[] {
  if (!datos) return []
  const lista: GrabacionDeClase[] = []
  for (const s of datos.semanas || []) lista.push(...deSemana(s))
  if (conArchivo)
    for (const c of datos.archivo || []) {
      if (c.tipo !== 'grabacion' || !c.video) continue
      lista.push({
        clave: claveDeClase(c.activity_uuid),
        de: 'clase',
        tema: c.tema || c.nombre || '',
        fecha: c.fecha || '',
        profe: (c.profe || '').trim(),
        vista: !!c.hecha,
        actividad: c.activity_uuid,
        video: c.video,
      })
    }
  const vistas = new Set<string>()
  return lista
    .filter((g) => (vistas.has(g.clave) ? false : (vistas.add(g.clave), true)))
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      // Sin día, al principio (son las más viejas y no se sabe de cuándo).
      if (!a.g.fecha !== !b.g.fecha) return a.g.fecha ? 1 : -1
      return a.g.fecha.localeCompare(b.g.fecha) || a.i - b.i
    })
    .map((x) => x.g)
}

/** La grabación de esa dirección (acepta la clave con o sin `activity_`). */
export function grabacionDe(lista: GrabacionDeClase[], clave: string): GrabacionDeClase | null {
  const limpia = claveDeClase(String(clave || ''))
  return lista.find((g) => g.clave === limpia) || null
}

/** La grabación anterior y la siguiente, por fecha. */
export function vecinasDe(lista: GrabacionDeClase[], clave: string): { anterior: GrabacionDeClase | null; siguiente: GrabacionDeClase | null } {
  const limpia = claveDeClase(String(clave || ''))
  const i = lista.findIndex((g) => g.clave === limpia)
  if (i < 0) return { anterior: null, siguiente: null }
  return { anterior: lista[i - 1] || null, siguiente: lista[i + 1] || null }
}

/**
 * La clase de vídeo de la dirección vieja (`/course/<curso>/activity/<clase>`):
 * su clave si es una grabación de esa clase en directo, o '' si no lo es (y
 * entonces se queda donde está).
 */
export function claveDeLaVieja(datos: Pick<SemanasClase, 'semanas' | 'archivo'> | null | undefined, activityUuid: string): string {
  const clave = claveDeClase(activityUuid)
  return clave && grabacionesDe(datos, true).some((g) => g.de === 'clase' && g.clave === clave) ? clave : ''
}
