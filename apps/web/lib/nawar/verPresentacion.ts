/**
 * La presentación de una clase, en su propia página (22/11/2026).
 *
 * Usuario, con la clase PDF abierta con la pantalla de un curso (barra de
 * capítulos, «46 % completado», «Anterior / Siguiente» que se llaman los dos
 * «Presentación»): «la interfaz sigue siendo la misma, como un curso; no se
 * sabe cuál presentación es la primera que se subió y cuál es la siguiente».
 *
 * Aquí, sin pantalla: qué se le enseña a cada uno (las MISMAS reglas que la
 * semana: `pasosDeSemana`) y cuáles son la semana anterior y la siguiente.
 */
import type { Semana } from '@services/tareas/tareas'

export type OpcionPresentacion = {
  id: string
  /** antes = la que los alumnos ven antes de la clase; clase = la versión guardada desde la pizarra; equipo = solo del equipo. */
  tipo: 'antes' | 'clase' | 'limpia' | 'equipo'
  titulo: string
  detalle: string
  /** La clase PDF del curso (para pedirla y para marcarla como vista). */
  actividad?: string
  /** De qué semana se pide la versión de la clase (la del otro grupo, si esa semana fue a su clase). */
  semanaPdf?: number
  /** El id en la lista de presentaciones de la clase (equipo). */
  fuente?: string
  hecha?: boolean
  enPizarra?: boolean
}

/**
 * Lo que se puede abrir de esa semana.
 * - El alumno: UNA. La versión de su clase si el profe ya la guardó (y ya se
 *   le enseña: lo decide el servidor, `notas_clase`); si no, la de antes.
 * - El equipo: todas las de la clase (con quién la ve y si tiene notas) y, si
 *   existe, la versión que ven los alumnos.
 */
export function opcionesDe(semana: Semana, equipo: boolean): OpcionPresentacion[] {
  const pres = (semana.clases || []).filter((c) => c.tipo === 'presentacion')
  const notas = semana.notas_clase
  if (!equipo) {
    if (notas) {
      const out: OpcionPresentacion[] = [
        {
          id: 'clase',
          tipo: 'clase',
          titulo: notas.limpia ? 'Con las notas de la clase' : 'La presentación de tu clase',
          detalle: `Con lo que se escribió en ella${notas.paginas ? ` · ${notas.paginas} páginas` : ''}`,
          semanaPdf: notas.semana_id || semana.id,
        },
      ]
      // También sin las notas (25/11/2026): para repasarla limpia.
      if (notas.limpia)
        out.push({ id: 'limpia', tipo: 'limpia', titulo: 'Sin notas', detalle: 'La misma presentación, limpia, sin lo que se escribió en la clase', semanaPdf: notas.semana_id || semana.id })
      // Guardada antes de que hubiera versión limpia: la de antes de la clase hace de «sin notas».
      else if (pres.length) {
        out[0].titulo = 'Con las notas de la clase'
        for (const c of pres)
          out.push({ id: `antes:${c.activity_uuid}`, tipo: 'antes' as const, titulo: 'Sin notas', detalle: 'La presentación de antes de la clase', actividad: c.activity_uuid, hecha: c.hecha })
      }
      return out
    }
    return pres.map((c) => ({ id: `antes:${c.activity_uuid}`, tipo: 'antes' as const, titulo: 'La presentación', detalle: 'Para mirar antes de la clase', actividad: c.activity_uuid, hecha: c.hecha }))
  }
  const out: OpcionPresentacion[] = []
  const lista = semana.material_profe?.pizarra?.presentaciones
  if (Array.isArray(lista)) {
    for (const x of lista) {
      if (x.de === 'blanco') continue
      const notasDe = x.notas ? ' · con notas de la pizarra' : ''
      out.push({
        id: x.id,
        tipo: x.de === 'alumnos' ? 'antes' : 'equipo',
        titulo: x.nombre,
        detalle: (x.de === 'alumnos' ? 'Los alumnos la ven antes de la clase' : 'Solo el equipo') + (x.por ? ` · la subió ${x.por}` : '') + notasDe,
        actividad: x.de === 'alumnos' ? x.id.replace(/^clase:/, '') : undefined,
        fuente: x.id,
        enPizarra: x.en_pizarra,
      })
    }
  } else {
    for (const c of pres) out.push({ id: `clase:${c.activity_uuid}`, tipo: 'antes', titulo: c.nombre || 'Presentación de los alumnos', detalle: 'Los alumnos la ven antes de la clase', actividad: c.activity_uuid, fuente: `clase:${c.activity_uuid}` })
  }
  const pub = semana.material_profe?.pizarra?.publicada || (notas ? { paginas: notas.paginas } : null)
  if (pub)
    out.push({
      id: 'clase',
      tipo: 'clase',
      titulo: 'La versión de la clase',
      detalle: `Lo que ven los alumnos después de la clase, con lo escrito en la pizarra${pub.paginas ? ` · ${pub.paginas} páginas` : ''}`,
      semanaPdf: semana.id,
    })
  if ((pub as any)?.limpia || notas?.limpia)
    out.push({
      id: 'limpia',
      tipo: 'limpia',
      titulo: 'La versión sin notas',
      detalle: 'Los alumnos también la tienen sin lo escrito en la pizarra',
      semanaPdf: semana.id,
    })
  return out
}

/** La que se abre de entrada: para el equipo, lo que ven AHORA los alumnos. */
export function opcionInicial(opciones: OpcionPresentacion[], semana: Semana, equipo: boolean, hoy: string): OpcionPresentacion | null {
  if (!opciones.length) return null
  if (!equipo) return opciones[0]
  const yaFue = !!semana.fecha && semana.fecha <= hoy
  return (
    (yaFue ? opciones.find((o) => o.tipo === 'clase') : null) ||
    opciones.find((o) => o.tipo === 'antes') ||
    opciones.find((o) => o.enPizarra) ||
    opciones[0]
  )
}

/**
 * Si esa semana tiene presentación que enseñarle. La Masterclass y el Spreek
 * Club (`sencilla`) no enseñan la semana al alumno antes de la sesión: la
 * misma regla que la página de la clase (`seVe` en SemanasClase.tsx).
 */
export function tienePresentacion(semana: Semana, equipo: boolean, sencilla: boolean, hoy: string): boolean {
  if (!opcionesDe(semana, equipo).length) return false
  if (equipo || !sencilla) return true
  return (!!semana.fecha && semana.fecha < hoy) || !!semana.notas_clase || !!semana.grabacion_sala || (semana.clases || []).some((c) => c.tipo === 'grabacion')
}

/** La semana anterior y la siguiente QUE TIENEN presentación, por fecha. */
export function vecinas(semanas: Semana[], id: number, equipo: boolean, sencilla: boolean, hoy: string): { anterior: Semana | null; siguiente: Semana | null } {
  const orden = semanas
    .filter((s) => s.id === id || tienePresentacion(s, equipo, sencilla, hoy))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.id - b.id)
  const i = orden.findIndex((s) => s.id === id)
  if (i < 0) return { anterior: null, siguiente: null }
  return { anterior: orden[i - 1] || null, siguiente: orden[i + 1] || null }
}
