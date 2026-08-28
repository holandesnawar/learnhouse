import type { Metadata } from 'next'

/**
 * La marca, en un solo sitio.
 *
 * La escuela es de una sola organización (single-tenancy), así que cuando los
 * datos de la organización todavía no han llegado —o la API está despertando—
 * NO hay que enseñar la marca de LearnHouse: se enseña la nuestra. Antes, en
 * ese hueco de dos segundos, el alumno veía el icono y el nombre de
 * LearnHouse antes de que apareciera el nuestro.
 *
 * El logo se sirve desde CloudFront a propósito: si nuestra API está
 * reiniciándose, el logo guardado en ella tampoco cargaría.
 */
export const BRAND_NAME = 'Holandés Nawar'

export const BRAND_LOGO_URL =
  'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'

export const BRAND_SUPPORT_EMAIL = 'info@holandesnawar.com'

/**
 * El icono de la pestaña, en un solo sitio.
 *
 * Sale del repo a propósito, y no del favicon subido en el panel ni de un CDN
 * de fuera. Dos motivos:
 *
 *  1. El que había ocupaba una parte pequeña del cuadrado, así que a 16-32 px
 *     no se leía "Nawar": se veía un borrón azul.
 *  2. Colgaba de `docs.holandesnawar.com`. Si ese dominio falla, la escuela se
 *     queda con el icono en blanco del navegador.
 *
 * ⚠️ Con esto, **el campo "favicon" del panel ya no cambia la pestaña.** Para
 * cambiar el icono se reemplaza `apps/web/public/nawar-icon*.png`.
 */
export const BRAND_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/nawar-icon-32.png', sizes: '32x32', type: 'image/png' },
    { url: '/nawar-icon.png', sizes: '512x512', type: 'image/png' },
  ],
  shortcut: '/nawar-icon-32.png',
  apple: '/nawar-icon-180.png',
}

/** Azules de marca, para cuando hace falta el color en JS y no en una clase. */
export const BRAND_COLORS = {
  navy: '#1D0084',
  accent: '#025dc7',
  cta: '#4da3ff',
  ctaText: '#0a1656',
  offWhite: '#F0F5FF',
  border: '#DDE6F5',
} as const
