/**
 * La visita guiada de la escuela nueva (09/11/2026).
 *
 * Pedido: "un popup tipo bienvenido a tu nueva escuela, estilo onboarding,
 * como un software… aquí tienes esto, siguiente, saltar… tu formación
 * grabada, tu clase semanal, el grupo de conversación… para los nuevos y los
 * que ya están".
 *
 * Aquí solo se decide QUÉ pasos hay y qué dicen (lógica pura, con test). La
 * pantalla (`VisitaGuiada.tsx`) ilumina en cada paso la parte de la escuela
 * marcada con `data-visita="<clave>"`: prueba las claves de `objetivo` en
 * orden y se queda con la primera que se vea (el bloque o la fila de la
 * barra; con la barra cerrada, el enlace de arriba). Los bloques se marcan
 * `bloque-<título sin tildes>` (`claveDeBloque`). En el móvil la
 * barra está escondida: se ilumina el botón del menú (`movil`).
 *
 * Los pasos de las clases salen de las clases en directo que ve ESTE alumno
 * (la beta ve la clase semanal; el programa nuevo, la masterclass y el
 * Spreekclub), así nadie lee de una clase que no tiene.
 */

export type ClaseVisita = { uuid: string; nombre: string }

export type PasoVisita = {
  id: string
  titulo: string
  texto: string
  /** Claves `data-visita` a iluminar en el ordenador, en orden de preferencia. */
  objetivo: string[]
  /** Lo mismo en el móvil (vacío = tarjeta sola, sin iluminar nada). */
  movil: string[]
}

/** «Empieza aquí» → «bloque-empieza-aqui». */
export function claveDeBloque(titulo: string): string {
  return (
    'bloque-' +
    (titulo || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
}

/** La versión de la visita: subirla hace que todos la vuelvan a ver. */
export const VERSION_VISITA = 'v1'

export type TipoClase = 'semanal' | 'masterclass' | 'conversacion'

export function tipoDeClase(nombre: string): TipoClase {
  const n = (nombre || '').toLowerCase()
  if (/spreek|spreken|conversaci/.test(n)) return 'conversacion'
  if (/master/.test(n)) return 'masterclass'
  return 'semanal'
}

const TEXTO_CLASE: Record<TipoClase, (nombre: string) => { titulo: string; texto: string }> = {
  semanal: (nombre) => ({
    titulo: `Tu ${nombre.toLowerCase().startsWith('clase') ? nombre.toLowerCase() : nombre}`,
    texto:
      'La clase en directo de cada semana. Antes de la clase tienes la presentación; después, la grabación, los ejercicios y la tarea. Desde aquí entras a la clase y nos dices si vienes.',
  }),
  masterclass: (nombre) => ({
    titulo: nombre,
    texto:
      'Cada semana, un tema explicado en directo para que lo pongas en práctica esa misma semana. Desde aquí entras a la sesión y tienes la presentación y la grabación.',
  }),
  conversacion: (nombre) => ({
    titulo: nombre,
    texto:
      'El grupo de conversación: practicas hablando en neerlandés con otros alumnos y un profe. Se entra desde aquí, sin instalar nada.',
  }),
}

export function pasosDeLaVisita(opciones: {
  nombre?: string
  clases?: ClaseVisita[]
  /** Si la escuela es nueva para él (alumno nuevo) o solo ha cambiado (de antes). */
  nuevo?: boolean
}): PasoVisita[] {
  const nombre = (opciones.nombre || '').trim()
  const clases = opciones.clases || []
  const pasos: PasoVisita[] = []

  pasos.push({
    id: 'hola',
    titulo: nombre ? `Bienvenido/a a tu escuela, ${nombre}` : 'Bienvenido/a a tu escuela',
    texto: opciones.nuevo
      ? 'En un minuto te enseñamos dónde está cada cosa, para que sepas por dónde empezar.'
      : 'Hemos renovado la escuela: está todo lo de siempre, pero más ordenado. En un minuto te enseñamos dónde está cada cosa.',
    objetivo: [],
    movil: [],
  })

  pasos.push({
    id: 'empieza',
    titulo: 'Empieza aquí',
    texto:
      'La bienvenida con los primeros pasos, las normas de la comunidad y los recursos para descargar. Si es tu primera vez, empieza por aquí.',
    objetivo: ['bloque-empieza-aqui', 'bienvenida', 'top-inicio'],
    movil: ['menu'],
  })

  pasos.push({
    id: 'formacion',
    titulo: 'Tu formación A0-A1',
    texto:
      'Las lecciones grabadas, módulo a módulo y a tu ritmo: vídeo, vocabulario, ejercicios, lectura y audio. En «Mi progreso» ves por dónde vas y qué te conviene repasar.',
    objetivo: ['bloque-formacion', 'formacion', 'top-formacion'],
    movil: ['menu'],
  })

  // Una por tipo, en este orden; si hay dos del mismo tipo, la primera.
  const vistos = new Set<TipoClase>()
  for (const tipo of ['semanal', 'masterclass', 'conversacion'] as TipoClase[]) {
    const c = clases.find((x) => tipoDeClase(x.nombre) === tipo)
    if (!c || vistos.has(tipo)) continue
    vistos.add(tipo)
    const t = TEXTO_CLASE[tipo](c.nombre)
    pasos.push({
      id: `clase-${tipo}`,
      titulo: t.titulo,
      texto: t.texto,
      objetivo: [`clase-${c.uuid}`, 'bloque-mis-clases', 'top-clases'],
      movil: ['menu'],
    })
  }

  pasos.push({
    id: 'comunidad',
    titulo: 'La comunidad',
    texto:
      'Aquí compartes tus avances, preguntas lo que quieras y conoces a los demás alumnos. Cada canal es de un tema.',
    objetivo: ['bloque-comunidad', 'top-comunidad'],
    movil: ['menu'],
  })

  pasos.push({
    id: 'ayuda',
    titulo: '¿Tienes una duda?',
    texto:
      'En «Consultas» preguntas lo que no entiendas del neerlandés y te contesta un profe. En «Mensajes» hablas directamente con el equipo.',
    objetivo: ['bloque-ayuda'],
    movil: ['menu'],
  })

  pasos.push({
    id: 'perfil',
    titulo: 'Tu perfil',
    texto:
      'Arriba a la derecha: tu perfil, tus ajustes y tus consultas. Desde aquí puedes repetir esta visita cuando quieras.',
    objetivo: ['perfil'],
    movil: ['perfil'],
  })

  return pasos
}

/** ¿Ya la vio? Lo guardado en el servidor (`onboarding_state.visita`). */
export function yaLaVio(estado: Record<string, any> | null | undefined): boolean {
  return !!estado && estado.visita === VERSION_VISITA
}

/** Dónde poner la tarjeta junto a lo iluminado (en px, dentro de la pantalla). */
export function colocarTarjeta(
  rect: { top: number; left: number; width: number; height: number } | null,
  pantalla: { ancho: number; alto: number },
  tarjeta: { ancho: number; alto: number }
): { top: number; left: number } {
  const m = 16
  const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  if (!rect) {
    return {
      top: limitar((pantalla.alto - tarjeta.alto) / 2, m, pantalla.alto - tarjeta.alto - m),
      left: limitar((pantalla.ancho - tarjeta.ancho) / 2, m, pantalla.ancho - tarjeta.ancho - m),
    }
  }
  // A la derecha si cabe (la barra lateral); si no, debajo (lo de arriba).
  const derecha = rect.left + rect.width + m
  if (derecha + tarjeta.ancho <= pantalla.ancho - m && rect.left < pantalla.ancho / 2) {
    return {
      top: limitar(rect.top + rect.height / 2 - 40, m, pantalla.alto - tarjeta.alto - m),
      left: derecha,
    }
  }
  return {
    top: limitar(rect.top + rect.height + m, m, pantalla.alto - tarjeta.alto - m),
    left: limitar(rect.left + rect.width - tarjeta.ancho, m, pantalla.ancho - tarjeta.ancho - m),
  }
}
