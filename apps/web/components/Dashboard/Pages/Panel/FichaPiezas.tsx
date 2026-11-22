'use client'

/**
 * Las piezas que comparten la ficha del LEAD y la del ALUMNO (22/11/2026).
 *
 * Usuario: «cuando entra lead es una ficha, pero cuando es alumno debe ser
 * otra; ahora está todo junto y es un lío». Las dos fichas nuevas
 * (`FichaLead.tsx`, `FichaAlumno.tsx`) son un panel ancho con cabecera,
 * pestañas, una columna principal y un lateral de propiedades. Aquí vive el
 * marco y los bloques que salen en las dos (notas, línea de tiempo, llamadas,
 * páginas, respuestas, correos, tareas).
 *
 * Solo las ven los administradores (`Ficha.tsx` decide): los closers siguen
 * con `FichaCliente.tsx`, sin tocar.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { ChevronDown, Copy, Loader2, MoreHorizontal, Trash2, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import {
  anadirNota,
  borrarNota,
  cuandoLlamar,
  hoyISO,
  ponerRecordatorio,
  type Cita,
  type NotaContacto,
  type VolverALlamar,
} from '@services/stats/contactos'
import { fechaCorta, haceCuanto, type FichaCliente as Ficha, type ItemLinea, type Tarea } from '@services/panel/panel'
import SecuenciaWhatsApp, { enlaceCorto } from './SecuenciaWhatsApp'
import { FilaTarea, TareaForm } from './Tareas'
import { AMBAR, BOTON, BOTON_PRINCIPAL, BOTON_TEXTO, ENLACE, Estado, MARCA, ROJO, VERDE } from './ui'

const POPPINS: React.CSSProperties = { fontFamily: 'Poppins, Inter, system-ui, sans-serif' }

export function iniciales(nombre: string): string {
  return (
    (nombre || '')
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '·'
  )
}

/** «jueves 19 nov · 17:40» (sin hora si el dato no la trae). */
export function diaYHora(iso: string): string {
  if (!iso) return ''
  const conHora = iso.length > 10
  const d = new Date(conHora ? (iso.includes('T') && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? `${iso}Z` : iso) : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const dia = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  return conHora ? `${dia} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : dia
}

const mayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

export type Pestana = { id: string; nombre: string; n?: number | null }

/**
 * El marco de la ficha: panel lateral ancho (toda la pantalla en el móvil),
 * cabecera con iniciales, nombre, una línea de estado y pocas acciones;
 * pestañas; y debajo la columna principal y el lateral de propiedades (en el
 * móvil, el lateral va debajo).
 */
export function Marco({
  nombre,
  colorAvatar,
  estado,
  acciones,
  bajoCabecera,
  pestanas,
  pestana,
  onPestana,
  onClose,
  bloqueado = false,
  cargando = false,
  error = '',
  lateral,
  children,
}: {
  nombre: string
  /** [fondo, letra] del círculo de iniciales. */
  colorAvatar?: [string, string]
  estado?: React.ReactNode
  acciones?: React.ReactNode
  /** Algo que se abre bajo la cabecera (editar los datos). */
  bajoCabecera?: React.ReactNode
  pestanas: Pestana[]
  pestana: string
  onPestana: (id: string) => void
  onClose: () => void
  /** Hay otra ventana encima: Escape no cierra la ficha. */
  bloqueado?: boolean
  cargando?: boolean
  error?: string
  lateral?: React.ReactNode
  children?: React.ReactNode
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && !bloqueado && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose, bloqueado])
  const [fondo, letra] = colorAvatar || ['#EEF0FB', MARCA]
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={`Ficha de ${nombre}`}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-[#0B1020]/30" />
      <div className="relative h-full w-full lg:max-w-[980px] bg-white lg:border-l border-[#E6E8EE] flex flex-col text-[14px] text-[#0B1020]">
        <div className="shrink-0 px-4 sm:px-8 pt-4 sm:pt-[22px] border-b border-[#E6E8EE]">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
            <span className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[15px] font-semibold" style={{ background: fondo, color: letra }}>
              {iniciales(nombre)}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[19px] sm:text-[21px] font-semibold tracking-[-0.015em] leading-tight truncate" style={POPPINS}>
                {nombre}
              </h3>
              {estado ? <p className="text-[13.5px] text-[#4B5565] mt-px truncate">{estado}</p> : null}
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="lg:order-last shrink-0 w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center text-[#8A93A3] hover:bg-[#F7F8FA] hover:text-[#0B1020]">
              <X size={18} />
            </button>
            {acciones ? <div className="max-lg:basis-full flex flex-wrap items-center gap-2 lg:shrink-0">{acciones}</div> : null}
          </div>
          {bajoCabecera}
          <div className="mt-4 sm:mt-5 flex gap-6 overflow-x-auto -mb-px" role="tablist">
            {pestanas.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={pestana === p.id}
                onClick={() => onPestana(p.id)}
                className={`shrink-0 pb-[11px] text-[13.5px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                  pestana === p.id ? 'text-[#0B1020] border-[#0B1020]' : 'text-[#8A93A3] border-transparent hover:text-[#4B5565]'
                }`}
              >
                {p.nombre}
                {p.n ? <span className="ml-1.5 font-normal text-[#8A93A3] tabular-nums">{p.n}</span> : null}
              </button>
            ))}
          </div>
        </div>
        {cargando || error ? (
          <div className="flex-1 flex justify-center pt-20">
            {error ? <p className="text-[13.5px] text-[#C8322B] px-6 text-center">{error}</p> : <Loader2 className="animate-spin text-[#8A93A3]" size={22} />}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="lg:overflow-y-auto px-4 sm:px-8 py-5 sm:py-[26px]">{children}</div>
            {lateral ? (
              <aside className="lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-[#E6E8EE] bg-[#F7F8FA] px-4 sm:px-6 py-5 sm:py-[26px] max-lg:pb-24">{lateral}</aside>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/** El rótulo de un grupo del lateral («Venta», «Contacto»). */
export function LadoTitulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mt-[22px] first:mt-0 mb-2.5">
      <span className="text-[12px] font-medium text-[#8A93A3]">{children}</span>
      {extra ? <span className="text-[12.5px]">{extra}</span> : null}
    </div>
  )
}

/** Lista de propiedades del lateral: rótulo gris a la izquierda, valor a la derecha. */
export function Props({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13.5px]">{children}</dl>
}

export function Prop({ t, children }: { t: React.ReactNode; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <>
      <dt className="text-[#8A93A3]">{t}</dt>
      <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  )
}

/** Pregunta y respuesta apiladas (las preguntas no caben en 104 px). */
export function PropLarga({ t, children }: { t: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="text-[13.5px]">
      <div className="text-[12.5px] text-[#8A93A3]">{t}</div>
      <div className="[overflow-wrap:anywhere] whitespace-pre-wrap">{children}</div>
    </div>
  )
}

/** Un desplegable que parece texto: el valor y una flecha. Para etapa, closer y canal. */
export function Eleccion<T extends string | number>({
  valor,
  opciones,
  onChange,
  fuerte = false,
  punto,
  etiqueta,
}: {
  valor: T
  opciones: { id: T; nombre: string }[]
  onChange: (v: T) => void
  fuerte?: boolean
  /** Color del punto de delante (el del closer). */
  punto?: string
  etiqueta: string
}) {
  return (
    <span className="relative inline-flex items-center gap-1.5 max-w-full rounded-md -mx-1.5 px-1.5 py-px hover:bg-[#ECEEF3] transition-colors">
      {punto ? <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: punto }} /> : null}
      <span className={`truncate ${fuerte ? 'font-semibold' : ''}`}>{opciones.find((o) => o.id === valor)?.nombre ?? '—'}</span>
      <ChevronDown size={13} className="shrink-0 text-[#8A93A3]" />
      <select
        aria-label={etiqueta}
        value={String(valor)}
        onChange={(e) => {
          const o = opciones.find((x) => String(x.id) === e.target.value)
          if (o) onChange(o.id)
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {opciones.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.nombre}
          </option>
        ))}
      </select>
    </span>
  )
}

/**
 * Un botón que abre un menú debajo. Se cierra al pulsar fuera o con Escape.
 * `children` puede ser una función que recibe `cerrar`.
 */
export function Desplegable({
  boton,
  clase = BOTON,
  ancho = 240,
  alinear = 'derecha',
  titulo,
  onAbierto,
  mantener = false,
  children,
}: {
  boton: React.ReactNode
  clase?: string
  ancho?: number
  alinear?: 'derecha' | 'izquierda'
  titulo?: string
  /** No desmonta lo de dentro al cerrar (un enlace de pago recién creado sigue ahí al volver a abrir). */
  mantener?: boolean
  onAbierto?: (abierto: boolean) => void
  children: React.ReactNode | ((cerrar: () => void) => React.ReactNode)
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const poner = (v: boolean) => {
    setAbierto(v)
    onAbierto?.(v)
  }
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => caja.current && !caja.current.contains(e.target as Node) && poner(false)
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        poner(false)
      }
    }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', tecla, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])
  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => poner(!abierto)} aria-expanded={abierto} aria-label={titulo} title={titulo} className={clase}>
        {boton}
      </button>
      {abierto || mantener ? (
        <div
          hidden={!abierto}
          // En el móvil va de lado a lado de la pantalla (fijo, a su altura): anclado al botón se salía por la derecha.
          className={`absolute z-30 mt-1.5 rounded-[10px] border border-[#E6E8EE] bg-white p-1.5 shadow-[0_8px_28px_rgba(11,16,32,0.12)] max-h-[70vh] overflow-y-auto max-lg:fixed max-lg:left-4 max-lg:right-4 max-lg:!w-auto ${
            alinear === 'derecha' ? 'lg:right-0' : 'lg:left-0'
          }`}
          style={{ width: ancho }}
        >
          {typeof children === 'function' ? children(() => poner(false)) : children}
        </div>
      ) : null}
    </div>
  )
}

/** El menú «⋯» de la cabecera. */
export function MenuMas({ children, onAbierto }: { children: (cerrar: () => void) => React.ReactNode; onAbierto?: (a: boolean) => void }) {
  return (
    <Desplegable boton={<MoreHorizontal size={17} />} clase={`${BOTON_TEXTO} !px-2`} titulo="Más acciones" onAbierto={onAbierto}>
      {children}
    </Desplegable>
  )
}

export function Opcion({
  onClick,
  href,
  peligro = false,
  children,
}: {
  onClick?: () => void
  href?: string
  peligro?: boolean
  children: React.ReactNode
}) {
  const clase = `flex w-full items-center gap-2 rounded-md px-2.5 py-[7px] text-left text-[13.5px] hover:bg-[#F7F8FA] ${peligro ? 'text-[#C8322B]' : 'text-[#0B1020]'}`
  return href ? (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={onClick} className={clase}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={clase}>
      {children}
    </button>
  )
}

/** La caja de «siguiente paso»: lo que toca con esta persona, en una línea. */
export function Paso({
  color,
  titulo,
  detalle,
  children,
  debajo,
}: {
  color: string
  titulo: React.ReactNode
  detalle?: React.ReactNode
  /** Los botones de la derecha. */
  children?: React.ReactNode
  /** Algo más ancho, debajo (los tres WhatsApp de la llamada). */
  debajo?: React.ReactNode
}) {
  return (
    <div className="rounded-[10px] border border-[#E6E8EE] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-[180px]">
          <b className="block font-semibold">{titulo}</b>
          {detalle ? <span className="block text-[13px] text-[#4B5565]">{detalle}</span> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {debajo ? <div className="mt-3 pt-3 border-t border-[#F0F1F5]">{debajo}</div> : null}
    </div>
  )
}

/** Título de una sección de la columna principal. */
export function Sec({
  titulo,
  extra,
  className = '',
  children,
}: {
  titulo: React.ReactNode
  extra?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`mt-7 first:mt-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h4 className="text-[15px] font-semibold tracking-[-0.005em]">{titulo}</h4>
        {extra ? <div className="shrink-0 text-[13px]">{extra}</div> : null}
      </div>
      {children}
    </section>
  )
}

export const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-[13.5px] text-[#8A93A3]">{children}</p>

// ── Notas y volver a llamar ────────────────────────────────────────────────

/**
 * Las notas de la persona (las MISMAS de siempre: `contact_nota`) con el
 * escritorio de la maqueta: caja, atajos de un toque, «Volver a llamar» y
 * «Guardar». Debajo, las notas ya escritas.
 */
export function Notas({
  email,
  notas,
  volver,
  atajos = [],
  conFecha = true,
  marcador = 'Qué le frena, qué le dijiste, qué quedó pendiente…',
  onNotas,
  onFecha,
}: {
  email: string
  notas: NotaContacto[]
  volver: VolverALlamar | null
  atajos?: string[]
  conFecha?: boolean
  marcador?: string
  onNotas: (n: NotaContacto[]) => void
  onFecha: (v: VolverALlamar | null) => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [todas, setTodas] = useState(false)

  async function apuntar(t: string, rapida = false) {
    if (!t.trim()) return
    setGuardando(true)
    const r = await anadirNota(org?.id, email, t, token)
    setGuardando(false)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido guardar la nota')
    onNotas([r.datos as NotaContacto, ...notas])
    if (rapida) toast.success(`Apuntado: ${t}`)
    else setTexto('')
  }
  async function quitar(n: NotaContacto) {
    if (!(await confirmar('¿Borrar esta nota?'))) return
    const r = await borrarNota(org?.id, n.id, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    onNotas(notas.filter((x) => x.id !== n.id))
  }
  const lista = todas ? notas : notas.slice(0, 4)
  return (
    <div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apuntar(texto)
        }}
        rows={2}
        placeholder={marcador}
        aria-label="Nota nueva"
        className="w-full rounded-[10px] border border-[#E6E8EE] px-3.5 py-3 text-[14px] placeholder:text-[#8A93A3] outline-none focus:border-[#0B1020] resize-y min-h-[64px]"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-2">
        {atajos.map((a) => (
          <button key={a} onClick={() => apuntar(a, true)} disabled={guardando} className={`${BOTON_TEXTO} first:-ml-3`} title={`Apunta «${a}» como nota`}>
            {a}
          </button>
        ))}
        <span className="flex-1" />
        {conFecha ? <VolverALlamarBoton email={email} volver={volver} onFecha={onFecha} /> : null}
        <button onClick={() => apuntar(texto)} disabled={guardando || !texto.trim()} className={BOTON_PRINCIPAL}>
          Guardar
        </button>
      </div>
      {notas.length ? (
        <ul className="mt-4">
          {lista.map((n) => (
            <li key={n.id} className="group py-2.5 border-t border-[#F0F1F5] first:border-[#E6E8EE]">
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{n.texto}</p>
              <p className="mt-0.5 text-[12.5px] text-[#8A93A3] flex items-center gap-2">
                <span>
                  {n.autor} · {diaYHora(n.created_at)}
                </span>
                <button onClick={() => quitar(n)} aria-label="Borrar nota" className="text-[#C5CAD6] hover:text-[#C8322B] lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                  <Trash2 size={12} />
                </button>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {notas.length > 4 ? (
        <button onClick={() => setTodas((v) => !v)} className={`${ENLACE} mt-1`}>
          {todas ? 'Ver menos' : `Ver las ${notas.length} notas`}
        </button>
      ) : null}
    </div>
  )
}

/** «Volver a llamar ▾»: mañana, en 3 días, en una semana o una fecha, con su motivo. */
export function VolverALlamarBoton({
  email,
  volver,
  onFecha,
  etiqueta,
  clase = BOTON,
}: {
  email: string
  volver: VolverALlamar | null
  onFecha: (v: VolverALlamar | null) => void
  etiqueta?: string
  clase?: string
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [motivo, setMotivo] = useState(volver?.motivo || '')
  useEffect(() => setMotivo(volver?.motivo || ''), [volver?.motivo])
  async function guardar(fecha: string, cerrar: () => void, m = motivo) {
    const r = await ponerRecordatorio(org?.id, email, fecha, m, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
    const v = r.datos?.volver_a_llamar ?? null
    onFecha(v)
    toast.success(v ? `Volver a llamar ${cuandoLlamar(v.fecha)}` : 'Fecha quitada')
    cerrar()
  }
  return (
    <Desplegable
      boton={
        <>
          {etiqueta || (volver ? `Volver a llamar ${cuandoLlamar(volver.fecha)}` : 'Volver a llamar')} <ChevronDown size={13} className="text-[#8A93A3]" />
        </>
      }
      clase={clase}
      ancho={270}
    >
      {(cerrar) => (
        <div className="p-1.5">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo: «cobra el día 25»…"
            aria-label="Motivo"
            className="w-full h-8 rounded-md border border-[#E6E8EE] px-2.5 text-[13px] placeholder:text-[#8A93A3] outline-none focus:border-[#0B1020]"
          />
          <div className="mt-1.5">
            {[
              { n: 'Mañana', d: 1 },
              { n: 'En 3 días', d: 3 },
              { n: 'En una semana', d: 7 },
            ].map((o) => (
              <Opcion key={o.d} onClick={() => guardar(hoyISO(o.d), cerrar)}>
                {o.n}
                <span className="ml-auto text-[12.5px] text-[#8A93A3]">{cuandoLlamar(hoyISO(o.d))}</span>
              </Opcion>
            ))}
            <label className="flex items-center gap-2 px-2.5 py-[7px] text-[13.5px]">
              Otro día
              <input
                type="date"
                min={hoyISO()}
                defaultValue={volver?.fecha || ''}
                onChange={(e) => e.target.value && guardar(e.target.value, cerrar)}
                className="ml-auto h-7 rounded-md border border-[#E6E8EE] px-1.5 text-[12.5px]"
              />
            </label>
            {volver ? (
              <>
                {motivo !== (volver.motivo || '') ? <Opcion onClick={() => guardar(volver.fecha, cerrar)}>Guardar el motivo</Opcion> : null}
                <Opcion onClick={() => guardar('', cerrar, '')}>Quitar la fecha</Opcion>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Desplegable>
  )
}

// ── Línea de tiempo ────────────────────────────────────────────────────────

const COLOR_LINEA: Record<ItemLinea['tipo'], string> = { evento: MARCA, correo: '#8E98E0', nota: '#C28A1A', tarea: '#C5CAD6' }

export function LineaTiempo({ items, max }: { items: ItemLinea[]; max?: number }) {
  const lista = max ? items.slice(0, max) : items
  if (!lista.length) return <Vacio>Todavía no ha pasado nada.</Vacio>
  return (
    <ol className="relative pl-[22px] before:content-[''] before:absolute before:left-[3px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-[#E6E8EE]">
      {lista.map((i, k) => (
        <li key={k} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[24px] top-[6px] w-[7px] h-[7px] rounded-full ring-2 ring-white" style={{ background: COLOR_LINEA[i.tipo] || '#C5CAD6' }} />
          <p className="[overflow-wrap:anywhere]">
            {i.tipo === 'correo' ? 'Correo: ' : i.tipo === 'nota' ? `Nota de ${i.autor}: ` : i.tipo === 'tarea' ? 'Tarea: ' : ''}
            {i.tipo === 'nota' ? `«${i.texto}»` : i.texto}
            {i.tipo === 'correo' && i.ok === false ? <span className="text-[#C8322B]"> · no salió</span> : null}
          </p>
          <p className="text-[12.5px] text-[#8A93A3]">
            {diaYHora(i.cuando)} · {haceCuanto(i.cuando)}
          </p>
        </li>
      ))}
    </ol>
  )
}

// ── Llamadas ───────────────────────────────────────────────────────────────

export function estadoDeCita(c: Cita): { tono: 'gris' | 'verde' | 'rojo' | 'ambar'; texto: string } {
  const cancelada = c.estado === 'cancelada'
  const pasada = new Date(c.fin || c.inicio).getTime() < Date.now()
  if (cancelada) return { tono: 'gris', texto: c.reprogramada ? 'Reprogramada' : 'Cancelada' }
  if (c.resultado) {
    const r = c.resultado.resultado
    return { tono: r === 'compra' || r === 'pagado' ? 'verde' : r === 'piensa' ? 'ambar' : 'gris', texto: c.resultado.nombre }
  }
  if (pasada) return { tono: 'rojo', texto: 'Sin apuntar qué pasó' }
  return c.confirmada ? { tono: 'verde', texto: 'Confirmada' } : { tono: 'ambar', texto: 'Sin confirmar' }
}

export const citaPorVenir = (c: Cita) => c.estado !== 'cancelada' && new Date(c.fin || c.inicio).getTime() >= Date.now()

export function cuandoCita(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** El enlace de la videollamada de una cita, con «Copiar». */
export function EnlaceVideo({ c }: { c: Cita }) {
  if (!c.enlace) return <span className="text-[12.5px] text-[#8A93A3]">Aún sin enlace de {c.plataforma || 'videollamada'} en Calendly.</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
      <Video size={13} className="text-[#8A93A3] shrink-0" />
      <a href={c.enlace} target="_blank" rel="noreferrer" className="text-[#1F3FD0] hover:underline break-all">
        {enlaceCorto(c.enlace)}
      </a>
      <button onClick={() => navigator.clipboard?.writeText(c.enlace).then(() => toast.success('Enlace copiado'))} className="font-medium text-[#1F3FD0] hover:underline inline-flex items-center gap-1">
        <Copy size={12} /> Copiar
      </button>
    </span>
  )
}

/** Sus llamadas de Calendly, con lo que pasó, el enlace y los tres WhatsApp de las que vienen. */
export function ListaLlamadas({
  ficha,
  onCambiarHora,
  onWhatsapp,
}: {
  ficha: Ficha
  onCambiarHora: (c: Cita) => void
  onWhatsapp: (id: string, w: Cita['whatsapp']) => void
}) {
  if (!ficha.llamadas?.length) return <Vacio>No tiene ninguna llamada en Calendly.</Vacio>
  return (
    <ul>
      {ficha.llamadas.map((c) => {
        const e = estadoDeCita(c)
        const viene = citaPorVenir(c)
        return (
          <li key={c.id || c.inicio} className="py-3 border-t border-[#F0F1F5] first:border-[#E6E8EE]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`w-[150px] shrink-0 tabular-nums ${c.estado === 'cancelada' ? 'text-[#8A93A3] line-through' : ''}`}>{cuandoCita(c.inicio)}</span>
              <Estado tono={e.tono} className="flex-1 min-w-0">
                {e.texto}
                {c.closer ? <span className="text-[#8A93A3]"> · {c.closer}</span> : null}
              </Estado>
              {viene ? (
                <button onClick={() => onCambiarHora({ ...c, nombre: c.nombre || ficha.nombre, telefono: c.telefono || ficha.telefono })} className={ENLACE}>
                  Cambiar hora
                </button>
              ) : null}
            </div>
            {c.resultado?.nota ? <p className="mt-0.5 lg:pl-[162px] text-[13px] text-[#4B5565]">{c.resultado.nota}</p> : null}
            {viene ? (
              <div className="mt-1.5 lg:pl-[162px] space-y-2">
                <EnlaceVideo c={c} />
                <SecuenciaWhatsApp
                  conMeet={false}
                  cita={{ ...c, nombre: ficha.nombre || c.nombre, telefono: c.telefono || ficha.telefono }}
                  onCambio={(w) => onWhatsapp(c.id, w)}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// ── De dónde viene ─────────────────────────────────────────────────────────

/** Las páginas que vio, en orden, marcando la del precio. */
export function Paginas({ ficha }: { ficha: Ficha }) {
  if (!ficha.paginas.length) return <Vacio>No tenemos su recorrido por la web.</Vacio>
  return (
    <ol className="space-y-1.5">
      {ficha.paginas.map((p, i) => (
        <li key={`${p.id}-${i}`} className="flex items-baseline gap-2.5">
          <span className="w-4 shrink-0 text-right text-[12.5px] text-[#8A93A3] tabular-nums">{i + 1}</span>
          <span className="min-w-0">{p.nombre.charAt(0).toUpperCase() + p.nombre.slice(1)}</span>
          {p.precio ? <span className="shrink-0 text-[12.5px] font-medium" style={{ color: VERDE }}>con precio</span> : null}
        </li>
      ))}
    </ol>
  )
}

/** Las propiedades de «De dónde viene» (lateral del lead; pestaña «Cómo llegó» del alumno). */
export function PropsOrigen({ ficha, conPaginas = true }: { ficha: Ficha; conPaginas?: boolean }) {
  const ads = ficha.canal?.canal === 'ads'
  return (
    <Props>
      {ficha.canal ? (
        <Prop t="Canal">
          <Estado color={ads ? '#2F6FED' : VERDE} className="!text-[#0B1020]">
            {ads ? 'Ads' : 'Orgánico'}
          </Estado>
        </Prop>
      ) : null}
      <Prop t="Fuente">{ficha.canal?.detalle || mayuscula(ficha.vino_de || '')}</Prop>
      {ficha.canal?.antes ? <Prop t="Antes">Sin anuncio: {ficha.canal.antes}</Prop> : null}
      <Prop t="Campaña">{ficha.utm.campaign}</Prop>
      {ficha.utm.correo ? (
        <Prop t="Correo">{ficha.utm.correo}</Prop>
      ) : (
        <Prop t="Anuncio">
          {ficha.utm.content && !(ficha.canal?.detalle || '').includes(ficha.utm.content) ? (
            <span title={ficha.utm.content_meta && ficha.utm.content_meta !== ficha.utm.content ? `En Meta: ${ficha.utm.content_meta}` : undefined}>{ficha.utm.content}</span>
          ) : null}
        </Prop>
      )}
      <Prop t="Conjunto">{ficha.utm.term}</Prop>
      <Prop t="Ubicación">{ficha.utm.placement}</Prop>
      <Prop t="Primera vez">
        {ficha.primer_contacto?.when ? fechaCorta(ficha.primer_contacto.when) : ''}
        {ficha.primer_contacto?.que ? <span className="block text-[12.5px] text-[#8A93A3]">{ficha.primer_contacto.que}</span> : null}
      </Prop>
      {conPaginas && ficha.paginas.length ? <Prop t="Páginas">{mayuscula(ficha.paginas.map((p) => p.nombre).join(' → '))}</Prop> : null}
    </Props>
  )
}

/** Las respuestas del proceso de admisión, todas. */
export function Respuestas({ ficha }: { ficha: Ficha }) {
  const a = ficha.admision
  if (!a) return <Vacio>No ha pasado por las preguntas de admisión.</Vacio>
  return (
    <div>
      <Estado tono={a.reservo ? 'verde' : a.terminado ? (a.apto ? 'azul' : 'gris') : 'ambar'} className="!items-start !text-[#0B1020] !text-[14px] [&>span:first-child]:mt-[7px]">
        {a.resumen}
      </Estado>
      {a.cuando ? <p className="text-[12.5px] text-[#8A93A3] mt-0.5 pl-[13px]">{diaYHora(a.cuando)}</p> : null}
      {a.respuestas.length ? (
        <dl className="mt-4">
          {a.respuestas.map((r, i) => (
            <div key={`${r.pregunta}-${i}`} className="py-2.5 border-t border-[#F0F1F5] first:border-[#E6E8EE] sm:grid sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-4">
              <dt className="text-[13px] text-[#8A93A3]">{r.pregunta}</dt>
              <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{r.respuesta}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[13px] text-[#8A93A3] mt-2">No llegó a contestar ninguna pregunta.</p>
      )}
    </div>
  )
}

/** Los correos que le ha mandado la escuela. */
export function Correos({ ficha }: { ficha: Ficha }) {
  return (
    <div>
      {ficha.correos.length ? (
        <ul>
          {ficha.correos.map((c, i) => (
            <li key={i} className="py-2 border-t border-[#F0F1F5] first:border-[#E6E8EE] flex items-baseline justify-between gap-3">
              <span className="min-w-0" style={c.ok ? undefined : { color: ROJO }}>
                {c.asunto}
                {c.ok ? '' : ' · no salió'}
              </span>
              <span className="shrink-0 text-[12.5px] text-[#8A93A3]">{fechaCorta(c.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Vacio>Ninguno registrado todavía.</Vacio>
      )}
      <p className="text-[12.5px] text-[#8A93A3] mt-2">Solo los que manda la escuela, desde el 28 de septiembre. Los de systeme.io se ven en systeme.io.</p>
    </div>
  )
}

/** Lo que systeme.io sabe de esta persona: sus etiquetas (en qué campaña de correos está). */
export function Crm({ ficha }: { ficha: Ficha }) {
  const s = ficha.systeme
  if (!s) return null
  if (!s.ok) return <Vacio>No se ha podido consultar: {s.motivo || 'sin respuesta'}.</Vacio>
  if (s.existe === false) return <Vacio>Este correo no está en systeme.io.</Vacio>
  return (
    <div>
      {s.etiquetas.length ? <p>{s.etiquetas.join(' · ')}</p> : <Vacio>Está en el CRM, pero sin ninguna etiqueta.</Vacio>}
      {s.campos.length ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12.5px]">
          {s.campos.map((c) => (
            <React.Fragment key={c.slug}>
              <dt className="text-[#8A93A3]">{c.slug}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{String(c.valor)}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

/** Las tareas con esta persona: apuntar una y la lista. */
export function TareasDe({ ficha, onTareas }: { ficha: Ficha; onTareas: (t: Tarea[]) => void }) {
  const cambiada = (t: Tarea) => onTareas(ficha.tareas.some((x) => x.id === t.id) ? ficha.tareas.map((x) => (x.id === t.id ? t : x)) : [t, ...ficha.tareas])
  return (
    <div>
      <TareaForm email={ficha.email} compacto onCreada={cambiada} />
      {ficha.tareas.length ? (
        <div className="mt-2 divide-y divide-[#F0F1F5]">
          {ficha.tareas.map((t) => (
            <FilaTarea key={t.id} tarea={t} onCambio={cambiada} onBorrada={(id) => onTareas(ficha.tareas.filter((x) => x.id !== id))} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const tareasPendientes = (ficha: Ficha) => ficha.tareas.filter((t) => t.estado !== 'hecha').length

export { AMBAR, ROJO, VERDE }
