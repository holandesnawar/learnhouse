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
 * Última revisión: 22/09/2026.
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
    que: 'Nombre, correo, teléfono. NO cobra: la venta se cierra hablando. Sale en Matrículas nuevas.',
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
