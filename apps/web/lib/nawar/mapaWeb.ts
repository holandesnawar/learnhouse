/**
 * El mapa del embudo: qué páginas hay en holandesnawar.com, en qué etapa
 * está cada una, si enseña el precio, a dónde manda su botón y con qué
 * etiqueta entra la persona en systeme.io.
 *
 * ⚠️ Está escrito A MANO, porque las páginas viven en OTRO repo
 * (holandesnawar/nawar-web) y la escuela no puede leerlas. Cuando se cree,
 * se cambie o se retire una página allí, hay que tocar esto aquí, o el panel
 * mentirá. La fuente de verdad para comprobarlo:
 *   - rutas:      nawar-web/src/pages/
 *   - redirects:  nawar-web/astro.config.mjs
 *   - etiquetas:  cada página (`ETIQUETA_CRM`, `tagName`), waitlist.ts
 *                 (`TAG_NAME`) e inro-systeme.ts (`ETIQUETA_POR_DEFECTO`).
 * Última revisión: 24/09/2026 (/agendar al día: nueve preguntas y sin precio).
 */

export type Etapa = 'captar' | 'convencer' | 'matricular' | 'pagar'

export interface PaginaWeb {
  ruta: string
  nombre: string
  etapa: Etapa
  /** Qué hace la página, en una frase. */
  que: string
  /** A dónde manda su botón principal. */
  boton: string
  /** Si la persona ve la cifra del precio en esta página. */
  precio: boolean
  /** Etiqueta(s) que recibe en systeme.io al rellenarla. Vacío = no da de alta. */
  etiquetas: string[]
  /** Solo se llega por anuncios. */
  ads?: boolean
  /** Redirige a otra: existe solo para no romper enlaces viejos. */
  redirigeA?: string
}

export const ETAPAS: { id: Etapa; nombre: string; que: string }[] = [
  { id: 'captar', nombre: '1 · Captar', que: 'Dejan el correo a cambio de algo gratis. No ven precio.' },
  { id: 'convencer', nombre: '2 · Convencer', que: 'La landing de la formación. Unas enseñan el precio y otras no.' },
  { id: 'matricular', nombre: '3 · Matricular', que: 'Formularios: el que cobra y los que solo recogen el contacto.' },
  { id: 'pagar', nombre: '4 · Pagar', que: 'La caja de pago, dentro de la escuela.' },
]

export const MAPA_WEB: PaginaWeb[] = [
  // ── 1 · Captar ──
  {
    ruta: '/guia/bases-neerlandes',
    nombre: 'Guía de las bases',
    etapa: 'captar',
    que: 'Guía gratis. Nombre y correo.',
    boton: 'Descargar → página de gracias',
    precio: false,
    etiquetas: ['Guía Bases', 'Nuevo Bases (solo si no estaba en el CRM)'],
  },
  {
    ruta: '/guia/bases-neerlandes-a',
    nombre: 'Guía de las bases (anuncios)',
    etapa: 'captar',
    que: 'La misma guía, con UTM del anuncio.',
    boton: 'Descargar → página de gracias',
    precio: false,
    etiquetas: ['Guía Bases', 'Nuevo Bases (solo si no estaba en el CRM)'],
    ads: true,
  },
  {
    ruta: '/guia/hebben-zijn',
    nombre: 'Guía hebben / zijn',
    etapa: 'captar',
    que: 'Guía gratis. Nombre y correo.',
    boton: 'Descargar → gracias',
    precio: false,
    etiquetas: ['Hebben / Zijn'],
  },
  {
    ruta: '/guia/hebben-zijn-a',
    nombre: 'Guía hebben / zijn (anuncios)',
    etapa: 'captar',
    que: 'La misma guía desde un anuncio. Su página de gracias manda a la landing de anuncios.',
    boton: 'Gracias → /formacion-a0-a1-sept-ads',
    precio: false,
    etiquetas: ['Hebben / Zijn'],
    ads: true,
  },
  {
    ruta: '/lista-de-espera',
    nombre: 'Lista de espera',
    etapa: 'captar',
    que: 'Para cuando la matrícula está cerrada.',
    boton: 'Apuntarse',
    precio: false,
    etiquetas: ['Lista de espera'],
  },
  {
    ruta: 'Instagram (DM por Inrō)',
    nombre: 'DM de Instagram',
    etapa: 'captar',
    que: 'Comentan «quiero», Inrō pide el correo por DM y lo manda a la web.',
    boton: '—',
    precio: false,
    etiquetas: ['Lista de espera (o la que mande el escenario)'],
  },

  // ── 2 · Convencer ──
  {
    ruta: '/',
    nombre: 'Home',
    etapa: 'convencer',
    que: 'La portada. Sin precio.',
    boton: 'Matricularme → /matricula-formacion-nawar',
    precio: false,
    etiquetas: [],
  },
  {
    ruta: '/formacion-nawar',
    nombre: 'Landing con precio',
    etapa: 'convencer',
    que: 'Para quien ya te conoce. Enseña 397 € y el pago a plazos.',
    boton: 'Matricularme → /matricula-formacion-nawar',
    precio: true,
    etiquetas: [],
  },
  {
    ruta: '/formacion-nawar-a0-a1',
    nombre: 'Landing sin precio',
    etapa: 'convencer',
    que: 'Misma página, para tráfico frío. No enseña cifra.',
    boton: 'Formulario de contacto → /matricula-formacion-nawar-a0-a1-ads',
    precio: false,
    etiquetas: [],
  },
  {
    ruta: '/formacion-a0-a1-sept-ads',
    nombre: 'Landing de anuncios',
    etapa: 'convencer',
    que: 'La de las campañas de Meta. Sin precio.',
    boton: 'Formulario de contacto → /matricula-formacion-nawar-a0-a1-ads',
    precio: false,
    etiquetas: [],
    ads: true,
  },
  {
    ruta: '/formacion-a0-a1',
    nombre: 'Landing larga (precio, garantía, desglose)',
    etapa: 'convencer',
    que: 'Otra landing distinta, con todo el detalle.',
    boton: 'Matricularme',
    precio: true,
    etiquetas: [],
  },
  {
    ruta: '/nuestra-vision',
    nombre: 'Nuestra visión',
    etapa: 'convencer',
    que: 'Quiénes somos. Sin precio.',
    boton: 'Matricularme → /matricula-formacion-nawar',
    precio: false,
    etiquetas: [],
  },

  // ── 3 · Matricular ──
  {
    ruta: '/matricula-formacion-nawar',
    nombre: 'Matrícula (la que cobra)',
    etapa: 'matricular',
    que: 'Nombre, apellidos, correo. Crea la matrícula en la escuela y pasa a la caja.',
    boton: 'Continuar → caja de pago en la escuela',
    precio: true,
    etiquetas: ['Matriculado sin pagar (se quita al pagar)'],
  },
  {
    ruta: '/matricula-formacion-nawar-a0-a1-ads',
    nombre: 'Formulario de contacto (anuncios)',
    etapa: 'matricular',
    que: 'Nombre, correo, teléfono. NO cobra: la venta se cierra hablando. Sale en Contactos como «Pidió plaza».',
    boton: 'Enviar → gracias',
    precio: false,
    etiquetas: ['Matrícula ads'],
    ads: true,
  },
  {
    ruta: '/matricula-a0-a1',
    nombre: 'Formulario de contacto (sin anuncios)',
    etapa: 'matricular',
    que: 'Igual que el de anuncios, para el enlace que se manda a mano.',
    boton: 'Enviar → gracias',
    precio: false,
    etiquetas: ['Matrícula'],
  },
  {
    ruta: '/agendar',
    nombre: 'Agendar llamada (con cualificación)',
    etapa: 'matricular',
    que: 'Nombre, correo y teléfono + nueve preguntas (nivel, dónde vive, para qué, edad, ocupación, qué espera conseguir, horas, dinero y compromiso). Quien encaja confirma que asistirá y elige hora en Calendly; al resto se le ofrece la guía gratis. Todo sale en Llamadas, con las respuestas, aunque se vaya a mitad.',
    boton: 'Elegir día y hora → Calendly (calendly.com/holandesnawar/llamada-de-consultoria)',
    precio: false,
    etiquetas: ['Llamada'],
  },
  {
    ruta: '/matricula-formacion-nawar-a0-a1',
    nombre: '(ruta vieja)',
    etapa: 'matricular',
    que: 'Ya no existe: redirige a la lista de espera. No mandar este enlace.',
    boton: '—',
    precio: false,
    etiquetas: [],
    redirigeA: '/lista-de-espera',
  },

  // ── 4 · Pagar ──
  {
    ruta: 'app.holandesnawar.com/auth/matricula-formacion-nawar-a0-a1',
    nombre: 'Caja de pago',
    etapa: 'pagar',
    que: 'Tarjeta, iDEAL, Klarna, Bancontact. Al pagar: cuenta, correo con la contraseña y factura.',
    boton: 'Pagar → /auth/bienvenido',
    precio: true,
    etiquetas: ['Se quita «Matriculado sin pagar»; se pone la de alumno'],
  },
]

/**
 * Para el closer: qué sabe ya quien viene de cada página, antes de llamarle.
 * Aparte del mapa para no repetir en cada entrada lo que solo importa en la
 * pantalla "Páginas de la web" del closer. Si falta una ruta, no se enseña nada.
 */
export const SABE_POR_RUTA: Record<string, string> = {
  '/guia/bases-neerlandes': 'Ha bajado una guía gratis. No conoce el precio ni la formación a fondo: es un lead frío.',
  '/guia/bases-neerlandes-a': 'Viene de un anuncio y ha bajado la guía. No conoce el precio.',
  '/guia/hebben-zijn': 'Ha bajado la guía de hebben/zijn. No conoce el precio.',
  '/guia/hebben-zijn-a': 'Viene de un anuncio; tras la guía pasa por la landing de anuncios, sin precio.',
  '/lista-de-espera': 'Quería apuntarse cuando la matrícula estaba cerrada. Tiene interés, pero no sabe el precio.',
  '/formacion-nawar': 'Ha visto la landing CON precio (397 €, pago a plazos con Klarna). Ya sabe cuánto cuesta.',
  '/formacion-nawar-a0-a1': 'Ha visto la landing SIN precio. Sabe qué es la formación, pero no cuánto cuesta.',
  '/formacion-a0-a1-sept-ads': 'Viene de anuncios, landing SIN precio. No sabe cuánto cuesta: empieza por su caso.',
  '/formacion-a0-a1': 'Ha visto la landing larga, con precio, garantía y desglose.',
  '/matricula-formacion-nawar': 'Ha rellenado la matrícula que cobra y ha llegado a la caja: conoce el precio. Si no pagó, algo le frenó: pregúntale qué.',
  '/matricula-formacion-nawar-a0-a1-ads': 'Pidió plaza desde un anuncio, sin ver el precio. Espera que le llamemos.',
  '/matricula-a0-a1': 'Pidió plaza por el formulario de contacto (campaña de lanzamiento), sin ver el precio. Espera que le llamemos.',
  '/agendar': 'No ha visto el precio en esta página. Sabe que es una llamada de media hora para ver su caso, sin compromiso. Sus respuestas están en Llamadas.',
  'app.holandesnawar.com/auth/matricula-formacion-nawar-a0-a1': 'Está en la caja de pago: conoce el precio y está a un paso.',
}
