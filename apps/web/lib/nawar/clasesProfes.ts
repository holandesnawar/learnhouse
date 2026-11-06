/**
 * Las cuentas del tablero de los profes, «Mis clases» (04/11/2026).
 *
 * Pedido del usuario: "una sección para los profesores dentro de la escuela,
 * donde puedan ver la siguiente clase, la presentación, algunos recursos, estilo
 * kanban, para que vean su siguiente clase con antelación y llevarlo por ahí,
 * más profesional, y no por WhatsApp".
 *
 * No guarda nada: cada tarjeta es una SEMANA de una clase en directo (la misma
 * que se crea con «Nueva semana» en la página de la clase) y su columna sale de
 * la fecha. Lo que falta por preparar sale de lo que la semana ya tiene dentro:
 * la presentación (un PDF), la grabación (un vídeo) y la tarea.
 *
 * Fechas como "AAAA-MM-DD", sin horas (las de la semana), como en
 * `semanasTrabajo.ts`. Puras, con test (`__tests__/clasesProfes.test.ts`).
 */

import { diasEntre, lunesDe, sumarDias } from './semanasTrabajo'

export type Columna = 'esta' | 'proxima' | 'luego' | 'dadas'

/** `corto`: el nombre en las pestañas del móvil, donde no cabe el largo. */
export const COLUMNAS: { id: Columna; titulo: string; corto: string; vacio: string }[] = [
  { id: 'esta', titulo: 'Esta semana', corto: 'Esta semana', vacio: 'No hay clases esta semana.' },
  { id: 'proxima', titulo: 'La semana que viene', corto: 'Próxima', vacio: 'Aún no hay clases preparadas para la semana que viene.' },
  { id: 'luego', titulo: 'Más adelante', corto: 'Luego', vacio: 'Nada más adelante todavía.' },
  { id: 'dadas', titulo: 'Ya dadas', corto: 'Dadas', vacio: 'Todavía no se ha dado ninguna.' },
]

/** En qué columna va una clase según su día. Sin día, «Más adelante». */
export function columnaDe(fecha: string, hoy: string): Columna {
  if (!fecha || fecha.length < 10) return 'luego'
  const lunes = lunesDe(hoy)
  if (fecha < lunes) return 'dadas'
  if (fecha <= sumarDias(lunes, 6)) return 'esta'
  if (fecha <= sumarDias(lunes, 13)) return 'proxima'
  return 'luego'
}

/** «Hoy», «Mañana», «Ayer», «En 3 días», «Hace 2 días», o nada si queda lejos. */
export function cuandoCae(fecha: string, hoy: string): string {
  if (!fecha || fecha.length < 10) return ''
  const d = diasEntre(hoy, fecha)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d === -1) return 'Ayer'
  if (d > 1 && d <= 6) return `En ${d} días`
  if (d < -1 && d >= -6) return `Hace ${-d} días`
  return ''
}

export type Preparacion = {
  /** Lo que se comprueba en esta tarjeta, en orden. */
  pasos: { id: 'presentacion' | 'tarea' | 'grabacion' | 'correcciones' | 'lista'; hecho: boolean; texto: string }[]
  hechos: number
  total: number
  /** Lo primero que falta, para el aviso de la tarjeta. */
  falta: string
}

/**
 * Qué está listo de una clase y qué falta:
 * - Presentación: antes de la clase, que los alumnos la puedan mirar.
 * - Tarea: si la semana la lleva (sin ella, no cuenta: hay semanas sin tarea).
 * - Grabación: solo cuando la clase ya pasó.
 * - Correcciones: solo cuando hay tareas entregadas sin corregir.
 * - Lista: desde el día de la clase, si se sabe (07/11/2026): quién vino.
 */
export function preparacion(
  s: {
    fecha: string
    presentaciones: number
    grabaciones: number
    tieneTarea: boolean
    porCorregir: number
    lista?: { pasada: boolean; vinieron: number } | null
  },
  hoy: string
): Preparacion {
  const pasos: Preparacion['pasos'] = []
  pasos.push({
    id: 'presentacion',
    hecho: s.presentaciones > 0,
    texto: s.presentaciones > 0 ? 'Presentación subida' : 'Falta la presentación',
  })
  if (s.tieneTarea) pasos.push({ id: 'tarea', hecho: true, texto: 'Tarea puesta' })
  const yaPaso = !!s.fecha && s.fecha < hoy
  if (yaPaso) {
    pasos.push({
      id: 'grabacion',
      hecho: s.grabaciones > 0,
      texto: s.grabaciones > 0 ? 'Grabación subida' : 'Falta subir la grabación',
    })
  }
  if (s.lista && !!s.fecha && s.fecha <= hoy) {
    pasos.push({
      id: 'lista',
      hecho: s.lista.pasada,
      texto: s.lista.pasada
        ? `Lista pasada · ${s.lista.vinieron === 1 ? 'vino 1' : `vinieron ${s.lista.vinieron}`}`
        : 'Falta pasar lista',
    })
  }
  if (s.porCorregir > 0) {
    pasos.push({
      id: 'correcciones',
      hecho: false,
      texto: s.porCorregir === 1 ? '1 tarea por corregir' : `${s.porCorregir} tareas por corregir`,
    })
  }
  const hechos = pasos.filter((p) => p.hecho).length
  return { pasos, hechos, total: pasos.length, falta: pasos.find((p) => !p.hecho)?.texto || '' }
}

function sinAcentos(t: string): string {
  return (t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Si una clase es de esa persona: el profe del recuadro de la clase (texto
 * libre, «Paul» o «Paul y Luna») contiene su nombre de pila. Sin profe puesto,
 * no es de nadie en concreto.
 */
export function esDe(profeDelRecuadro: string, nombre: string): boolean {
  const n = sinAcentos(nombre).split(/\s+/)[0] || ''
  if (n.length < 2) return false
  const palabras = sinAcentos(profeDelRecuadro).split(/[^a-z0-9]+/).filter(Boolean)
  return palabras.includes(n)
}

/** Orden dentro de una columna: lo que viene antes, arriba; en «Ya dadas», lo último. */
export function ordenar<T extends { fecha: string }>(lista: T[], columna: Columna): T[] {
  const copia = [...lista]
  copia.sort((a, b) => (columna === 'dadas' ? (b.fecha || '').localeCompare(a.fecha || '') : (a.fecha || '9999').localeCompare(b.fecha || '9999')))
  return copia
}
