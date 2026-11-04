'use client'

/**
 * Las piezas de estilo del panel de ventas (closer y administrador).
 *
 * Decidido el 29/09 mirando Calendly: "tiene que parecer un software, no IA".
 * Lo que lo hacía parecer barato eran las etiquetas en cajitas pastel, las
 * sombras y los fondos tintados. Eso sigue fuera.
 *
 * Repaso del 04/11/2026 (usuario: "colores y diseños sin vida, mira nuestra
 * escuela por dentro, cómo tiene vida"): el gris y negro de entonces se pasa
 * a los colores de la escuela, sin volver a las cajitas pastel:
 * - Bordes con un punto de azul (#E2E8F4) y esquinas como las de la escuela.
 * - Lo elegido (un filtro, una pestaña) en el azul oscuro de la marca, no en negro.
 * - Los títulos de sección en Poppins y azul muy oscuro, como en la escuela.
 * - El color, como antes, solo para lo que se toca (el azul) y para lo que
 *   importa de verdad: rojo si algo está vencido, verde si ya pagó.
 * - Las "etiquetas" siguen siendo texto pequeño separado por puntos, no
 *   cajitas. Si hace falta señalar un estado, un punto de color de 6 px.
 */

import React from 'react'

export const TARJETA = 'rounded-xl border border-[#E2E8F4] bg-white'
export const META = 'text-[12.5px] text-[#6B7280]'
export const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-[#D5DDEC] bg-white text-[13px] font-medium text-[#1F2A44] hover:bg-[#F3F6FD] hover:border-[#B9CBEA] disabled:opacity-50 transition-colors'
export const BOTON_PRINCIPAL =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-[#025dc7] text-white text-[13px] font-semibold hover:bg-[#014fa9] disabled:opacity-50 transition-colors'
export const BOTON_PELIGRO =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-[#FCA5A5] bg-white text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors'
export const ENLACE = 'text-[13px] font-medium text-[#025dc7] hover:underline'
/** Filtro tipo "pastilla" (Todos, WhatsApp…): blanco; el elegido, en el azul de la marca. */
export const filtro = (activo: boolean) =>
  `shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors ${
    activo ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#E2E8F4] text-[#374151] hover:border-[#B9CBEA] hover:text-[#1D0084]'
  }`

export type Tono = 'gris' | 'verde' | 'rojo' | 'azul' | 'ambar'
const PUNTO: Record<Tono, string> = {
  gris: '#9CA3AF',
  verde: '#16A34A',
  rojo: '#DC2626',
  azul: '#2563EB',
  ambar: '#D97706',
}

/** Estado con un punto de color y texto gris: lo único con color en una fila. */
export function Estado({ tono = 'gris', children, className = '' }: { tono?: Tono; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] text-[#4B5563] ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PUNTO[tono] }} />
      {children}
    </span>
  )
}

/** Una línea de datos separados por " · ", saltándose los vacíos. */
export function Meta({ partes, className = '' }: { partes: React.ReactNode[]; className?: string }) {
  const llenas = partes.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  return (
    <p className={`${META} truncate ${className}`}>
      {llenas.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span className="text-[#D1D5DB]"> · </span> : null}
          {p}
        </React.Fragment>
      ))}
    </p>
  )
}

/** Título de sección: en Poppins y azul muy oscuro, como los de la escuela. */
export function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[#0a1656]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

/**
 * Una sección que se abre y se cierra con un clic (04/11/2026, usuario: "que
 * se puedan esconder con un clic como otras secciones"). Plegada, queda una
 * línea con el título, la cifra y `resumen`. Lo que elige cada uno se
 * recuerda en su navegador (`recordarComo`).
 */
export function Plegable({
  titulo,
  icono,
  cifra,
  resumen,
  extra,
  recordarComo,
  abiertoDeSerie = false,
  color = '#025dc7',
  aviso = false,
  children,
}: {
  titulo: string
  icono?: React.ReactNode
  cifra?: React.ReactNode
  /** Lo que se lee con la sección plegada. */
  resumen?: React.ReactNode
  /** Algo a la derecha que no pliega (un enlace, un botón). */
  extra?: React.ReactNode
  recordarComo: string
  abiertoDeSerie?: boolean
  /** El color del icono. */
  color?: string
  /** Punto rojo junto al título: hay algo que toca ya. */
  aviso?: boolean
  children: React.ReactNode
}) {
  const clave = `nawar.plegable.${recordarComo}`
  const [abierto, setAbierto] = React.useState(abiertoDeSerie)
  React.useEffect(() => {
    try {
      const g = localStorage.getItem(clave)
      if (g === 'abierto' || g === 'plegado') setAbierto(g === 'abierto')
    } catch {}
  }, [clave])
  function alternar() {
    const v = !abierto
    setAbierto(v)
    try {
      localStorage.setItem(clave, v ? 'abierto' : 'plegado')
    } catch {}
  }
  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="flex items-center gap-2 pr-3 sm:pr-4">
        <button onClick={alternar} aria-expanded={abierto} className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 sm:px-4 py-3 text-left hover:bg-[#F7F9FE] transition-colors">
          {icono ? (
            <span className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>
              {icono}
              {aviso ? <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#DC2626] ring-2 ring-white" /> : null}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[14.5px] font-bold text-[#0a1656] truncate" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
                {titulo}
              </span>
              {cifra !== undefined && cifra !== null && cifra !== '' ? (
                <span className="shrink-0 rounded-full bg-[#EEF3FD] px-2 py-0.5 text-[11.5px] font-bold text-[#1D0084] tabular-nums">{cifra}</span>
              ) : null}
            </span>
            {!abierto && resumen ? <span className="block text-[12.5px] text-[#6B7280] truncate mt-0.5">{resumen}</span> : null}
          </span>
          <span className="shrink-0 text-[12.5px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
            {abierto ? 'Ocultar' : 'Ver'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>
      {abierto ? <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-[#EEF2F9]">{children}</div> : null}
    </section>
  )
}
