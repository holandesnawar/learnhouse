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

/** Azules de marca, para cuando hace falta el color en JS y no en una clase. */
export const BRAND_COLORS = {
  navy: '#1D0084',
  accent: '#025dc7',
  cta: '#4da3ff',
  ctaText: '#0a1656',
  offWhite: '#F0F5FF',
  border: '#DDE6F5',
} as const
