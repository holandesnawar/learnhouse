/**
 * Las piezas de marca que comparten la escuela y el panel (04/11/2026).
 *
 * El fondo de la barra de la escuela (`OrgSidebar`: la imagen azul de la marca,
 * una capa de azul encima y la trama de puntos) es lo que el usuario ve "con
 * vida". El panel lo usa también en su barra y en la cabecera del inicio, para
 * que panel y escuela parezcan lo mismo. Si se cambia aquí, cambia en los dos.
 */
import type { CSSProperties } from 'react'

export const FONDO_MARCA: CSSProperties = {
  backgroundColor: '#0b2da0',
  backgroundImage:
    'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px), ' +
    'linear-gradient(rgba(9,30,150,0.45), rgba(9,30,150,0.45)), ' +
    "url('/fondo-barra.png')",
  backgroundSize: '22px 22px, cover, cover',
  backgroundPosition: '0 0, center, center',
  backgroundRepeat: 'repeat, no-repeat, no-repeat',
}

/** El azul del elemento elegido sobre ese fondo (el mismo de la barra de la escuela). */
export const ACTIVO_SOBRE_MARCA = 'rgba(77,163,255,0.22)'

/** Poppins para los títulos, como en la escuela. */
export const POPPINS: CSSProperties = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
