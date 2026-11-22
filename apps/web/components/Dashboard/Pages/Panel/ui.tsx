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
 *
 * Repaso del 22/11/2026 (usuario: «diseño más clean general, de software
 * caro, no tan IA»). Lo que hacía que pareciera hecho por una IA: una caja
 * blanca con borde redondo para cada bloque sobre fondo azulado, rótulos en
 * MAYÚSCULAS con espaciado, cifras en morado, baldosas de icono y pastillas de
 * color. El lenguaje nuevo (referencia: Stripe, Linear, Attio):
 * - Página BLANCA. Las secciones se separan con aire y un filete de 1 px, no
 *   con cajas. Caja con borde solo para objetos de verdad (una tarjeta del
 *   tablero, una ventana, el aviso de «siguiente paso»).
 * - Cifras en casi negro, tabulares; rótulos en frase normal, 13 px gris.
 * - Una TIRA de cifras de una pieza con filetes (`Tira` + `Cifra`), no cuatro
 *   tarjetas.
 * - Estado = punto + texto (`Estado`), nunca pastilla.
 * - Botón principal casi negro; secundario, borde fino; terciario, solo texto.
 * - Inter para todo; Poppins solo en el título de la página.
 * La barra lateral azul no cambia.
 */

import React from 'react'
import Link from 'next/link'

/** Los colores del panel. Un solo sitio: si se cambia uno, cambia en todas partes. */
export const TINTA = '#0B1020'
export const TINTA_2 = '#4B5565'
export const TINTA_3 = '#8A93A3'
export const LINEA = '#E6E8EE'
export const LINEA_2 = '#F0F1F5'
export const FONDO_2 = '#F7F8FA'
export const MARCA = '#1D0084'
export const AZUL_ENLACE = '#1F3FD0'
export const VERDE = '#0E8A4F'
export const ROJO = '#C8322B'
export const AMBAR = '#9A6B12'

/** Caja con borde: solo para objetos de verdad (una tarjeta, un aviso, una ventana). */
export const TARJETA = 'rounded-[10px] border border-[#E6E8EE] bg-white'
export const META = 'text-[12.5px] text-[#6B7384]'
const BASE_BOTON =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium whitespace-nowrap disabled:opacity-50 transition-colors'
/** Secundario: blanco con borde fino. */
export const BOTON = `${BASE_BOTON} border border-[#E6E8EE] bg-white text-[#0B1020] hover:bg-[#F7F8FA] hover:border-[#D3D8E2]`
/** Principal: relleno casi negro. Uno por pantalla, como mucho dos. */
export const BOTON_PRINCIPAL = `${BASE_BOTON} border border-[#0B1020] bg-[#0B1020] text-white hover:bg-[#232A3D] hover:border-[#232A3D]`
/** Terciario: solo texto. */
export const BOTON_TEXTO = `${BASE_BOTON} border border-transparent text-[#4B5565] hover:bg-[#F7F8FA] hover:text-[#0B1020]`
export const BOTON_PELIGRO = `${BASE_BOTON} border border-[#F1C9C6] bg-white text-[#C8322B] hover:bg-[#FDF3F2]`
export const ENLACE = 'text-[13px] font-medium text-[#1F3FD0] hover:underline'
/** Filtro (Todos, WhatsApp…): blanco; el elegido, en casi negro. */
export const filtro = (activo: boolean) =>
  `shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium border whitespace-nowrap transition-colors ${
    activo ? 'bg-[#0B1020] border-[#0B1020] text-white' : 'bg-white border-[#E6E8EE] text-[#4B5565] hover:border-[#D3D8E2] hover:text-[#0B1020]'
  }`

/** Tablas limpias: sin marco, cabecera pequeña gris, filas con filete fino. */
export const TABLA = 'w-full border-collapse text-[14px] text-[#0B1020]'
export const TH = 'text-left text-[12px] font-medium text-[#8A93A3] py-2 pr-4 border-b border-[#E6E8EE] whitespace-nowrap'
export const TH_NUM = 'text-right text-[12px] font-medium text-[#8A93A3] py-2 pl-4 border-b border-[#E6E8EE] whitespace-nowrap'
export const TD = 'py-[11px] pr-4 border-b border-[#F0F1F5] align-middle'
export const TD_NUM = 'py-[11px] pl-4 border-b border-[#F0F1F5] align-middle text-right tabular-nums whitespace-nowrap'
/** La segunda línea, pequeña y gris, dentro de una celda o de una fila. */
export const SUB = 'block text-[12.5px] text-[#8A93A3]'
/** Un número: tabular y un punto más apretado. */
export const NUM = 'tabular-nums tracking-[-0.01em]'

export type Tono = 'gris' | 'verde' | 'rojo' | 'azul' | 'ambar'
const PUNTO: Record<Tono, string> = {
  gris: '#C5CAD6',
  verde: VERDE,
  rojo: ROJO,
  azul: '#2F6FED',
  ambar: '#C28A1A',
}
export const colorDeTono = (tono: Tono) => PUNTO[tono]

/** Estado con un punto de color y texto gris: lo único con color en una fila. */
export function Estado({ tono = 'gris', color, children, className = '' }: { tono?: Tono; color?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] text-[#4B5565] ${className}`}>
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color || PUNTO[tono] }} />
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
          {i ? <span className="text-[#C5CAD6]"> · </span> : null}
          {p}
        </React.Fragment>
      ))}
    </p>
  )
}

/**
 * Una sección: título de 15 px, algo a la derecha (un enlace, un botón) y
 * debajo lo suyo. Sin caja. Con `filete`, una raya bajo el título (para
 * cuando lo de dentro no es una lista de filas, que ya traen la suya).
 */
export function Seccion({
  titulo,
  extra,
  nota,
  filete = false,
  junto = false,
  className = '',
  children,
}: {
  titulo: React.ReactNode
  extra?: React.ReactNode
  /** Una línea gris bajo el título. */
  nota?: React.ReactNode
  filete?: boolean
  /** Sin aire entre lo de dentro: para una lista de filas, que ya traen su filete. */
  junto?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      <div className={`flex items-baseline justify-between gap-3 ${filete ? 'pb-3 border-b border-[#E6E8EE] mb-1' : 'mb-3'}`}>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#0B1020] tracking-[-0.005em]">{titulo}</h2>
          {nota ? <p className="text-[12.5px] text-[#8A93A3] mt-0.5">{nota}</p> : null}
        </div>
        {extra ? <div className="shrink-0 flex items-center gap-2 text-[13px]">{extra}</div> : null}
      </div>
      {junto ? children : <div className="space-y-3">{children}</div>}
    </section>
  )
}

/** El enlace de la derecha de una sección («Todas», «Ver la analítica»). */
export function EnlaceSeccion({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={ENLACE}>
      {children}
    </Link>
  )
}

const COLS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

/**
 * La tira de cifras: UNA pieza con filete arriba y abajo y filetes verticales
 * entre cifra y cifra. En el móvil, de dos en dos. Dentro van `Cifra`.
 */
export function Tira({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const n = React.Children.toArray(children).filter(Boolean).length
  return (
    <div
      className={`grid grid-cols-2 ${COLS[Math.min(6, Math.max(2, n))]} border-y border-[#E6E8EE]
        [&>*]:min-w-0 [&>*]:border-[#E6E8EE]
        max-lg:[&>*]:py-4 max-lg:[&>*]:pr-4
        max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(even)]:pl-4
        max-lg:[&>*:nth-child(n+3)]:border-t
        lg:[&>*]:py-[18px] lg:[&>*]:pr-5 lg:[&>*]:pl-5 lg:[&>*]:border-l
        lg:[&>*:first-child]:border-l-0 lg:[&>*:first-child]:pl-0 ${className}`}
    >
      {children}
    </div>
  )
}

/** «↑ 18 %» en verde o «↓ 6 %» en rojo. `alReves`: cuando bajar es lo bueno. */
export function Cambio({ sentido, children, alReves = false }: { sentido: number; children: React.ReactNode; alReves?: boolean }) {
  if (!sentido) return <span className="text-[#8A93A3]">{children}</span>
  const bueno = alReves ? sentido < 0 : sentido > 0
  return (
    <span className="font-medium" style={{ color: bueno ? VERDE : ROJO }}>
      {sentido > 0 ? '↑' : '↓'} {children}
    </span>
  )
}

/**
 * Una cifra de la tira: rótulo en frase normal, el número en casi negro y,
 * debajo, una línea gris (la comparación con antes y el detalle).
 */
export function Cifra({
  rotulo,
  valor,
  sufijo,
  nota,
  href,
  color,
  pequena = false,
}: {
  rotulo: React.ReactNode
  valor: React.ReactNode
  /** Junto al número, pequeño y gris: «de 12». */
  sufijo?: React.ReactNode
  nota?: React.ReactNode
  href?: string
  /** Solo si la cifra es un aviso (rojo). De serie, casi negro. */
  color?: string
  /** Para tiras dentro de una ficha o un panel estrecho. */
  pequena?: boolean
}) {
  const dentro = (
    <>
      <div className="text-[13px] text-[#4B5565] truncate">{rotulo}</div>
      <div
        className={`${pequena ? 'text-[20px] h-[22px]' : 'text-[24px] h-[27px] sm:text-[28px] sm:h-[31px]'} flex items-baseline gap-1.5 font-semibold leading-[1.1] mt-1.5 tabular-nums tracking-[-0.025em] whitespace-nowrap overflow-hidden`}
        style={{ color: color || TINTA }}
      >
        <span className="truncate">{valor}</span>
        {sufijo ? <span className={`${pequena ? 'text-[13px]' : 'text-[15px]'} shrink-0 font-medium text-[#8A93A3] tracking-normal`}>{sufijo}</span> : null}
      </div>
      {nota ? <div className="text-[12.5px] text-[#8A93A3] mt-1.5 leading-snug">{nota}</div> : null}
    </>
  )
  return href ? (
    <Link href={href} className="block hover:opacity-80 transition-opacity">
      {dentro}
    </Link>
  ) : (
    <div>{dentro}</div>
  )
}

/**
 * Una fila de lista: punto de color, título con su línea gris, una cifra y la
 * acción a la derecha. La primera de la lista lleva el filete más marcado.
 */
export function Fila({
  tono,
  color,
  titulo,
  detalle,
  n,
  accion,
  href,
  onClick,
}: {
  tono?: Tono
  color?: string
  titulo: React.ReactNode
  detalle?: React.ReactNode
  n?: React.ReactNode
  /** El texto de la derecha («Abrir»). Con `href` u `onClick`, toda la fila se pulsa. */
  accion?: React.ReactNode
  href?: string
  onClick?: () => void
}) {
  const clase =
    'flex items-center gap-3 py-[11px] border-t border-[#F0F1F5] first:border-[#E6E8EE] text-left w-full' +
    (href || onClick ? ' hover:bg-[#F7F8FA] transition-colors' : '')
  const dentro = (
    <>
      {tono || color ? <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color || PUNTO[tono as Tono] }} /> : null}
      <span className="flex-1 min-w-0 text-[14px] text-[#0B1020]">
        <span className="block truncate">{titulo}</span>
        {detalle ? <span className="block text-[12.5px] text-[#8A93A3] truncate">{detalle}</span> : null}
      </span>
      {n !== undefined && n !== null && n !== '' ? <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#0B1020]">{n}</span> : null}
      {accion ? <span className="shrink-0 text-[13px] font-medium text-[#1F3FD0]">{accion}</span> : null}
    </>
  )
  if (href)
    return (
      <Link href={href} className={clase}>
        {dentro}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={clase}>
        {dentro}
      </button>
    )
  return <div className={clase}>{dentro}</div>
}

/** Selector segmentado: el elegido, en casi negro. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  className = '',
}: {
  opciones: { id: T; label: React.ReactNode }[]
  valor: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-lg border border-[#E6E8EE] bg-white p-0.5 ${className}`}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={`h-7 px-3 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
            valor === o.id ? 'bg-[#0B1020] text-white' : 'text-[#4B5565] hover:text-[#0B1020]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Una barra de embudo: nombre, barra proporcional, la cifra y el % sobre el
 * paso anterior. La última (`fuerte`) va en el color de la marca.
 */
export function BarraEmbudo({ nombre, n, max, pct, fuerte = false }: { nombre: React.ReactNode; n: number; max: number; pct?: React.ReactNode; fuerte?: boolean }) {
  const ancho = max > 0 ? Math.max(n > 0 ? 1.5 : 0, (n / max) * 100) : 0
  return (
    <div className="grid grid-cols-[132px_1fr_36px_52px] sm:grid-cols-[150px_1fr_70px_80px] items-center gap-2.5 sm:gap-3.5 py-[7px] text-[13.5px] sm:text-[14px]">
      <span className="truncate text-[#0B1020]">{nombre}</span>
      <span className="block h-[22px]">
        <span className="block h-full rounded-[4px]" style={{ width: `${ancho}%`, background: fuerte ? MARCA : '#DCE1F5' }} />
      </span>
      <b className="text-right font-semibold tabular-nums text-[#0B1020]">{n.toLocaleString('es-ES')}</b>
      <span className="text-right text-[12.5px] text-[#8A93A3] tabular-nums">{pct}</span>
    </div>
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
  /** Ya no se usa (el icono va en gris, sin baldosa). Se deja para no romper a quien lo pasa. */
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
        <button onClick={alternar} aria-expanded={abierto} className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 sm:px-4 py-3 text-left hover:bg-[#F7F8FA] transition-colors">
          {icono ? (
            <span className="relative flex items-center justify-center shrink-0 text-[#8A93A3]">
              {icono}
              {aviso ? <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white" style={{ background: ROJO }} /> : null}
            </span>
          ) : aviso ? (
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: ROJO }} />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2 min-w-0">
              <span className="text-[14.5px] font-semibold text-[#0B1020] truncate">{titulo}</span>
              {cifra !== undefined && cifra !== null && cifra !== '' ? (
                <span className="shrink-0 text-[13px] font-medium text-[#8A93A3] tabular-nums">{cifra}</span>
              ) : null}
            </span>
            {!abierto && resumen ? <span className="block text-[12.5px] text-[#8A93A3] truncate mt-0.5">{resumen}</span> : null}
          </span>
          <span className="shrink-0 text-[13px] font-medium text-[#4B5565] inline-flex items-center gap-1">
            {abierto ? 'Ocultar' : 'Ver'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>
      {abierto ? <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-[#F0F1F5]">{children}</div> : null}
    </section>
  )
}
