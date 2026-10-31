'use client'

/**
 * Repartir las llamadas entre los closers (22/10/2026): «Para mí» o «Para
 * <otro closer>». Lo usan la columna «Por asignar» del tablero de Ventas y la
 * ficha de cada persona. Al closer que la recibe le llega un correo (salvo que
 * se la quede quien reparte); ver `apps/api/src/services/panel/reparto.py`.
 *
 * Desde el 31/10 también en Leads: cada tarjeta lleva una etiqueta pequeña con
 * el nombre del closer, de su color (`EtiquetaCloser`), y las que no tiene
 * nadie, «Asignarme».
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { asignarCloser, getReparto, type MiembroEquipo } from '@services/panel/panel'
import { colorCloser } from '@lib/nawar/colorCloser'
import toast from 'react-hot-toast'

export interface Reparto {
  equipo: MiembroEquipo[]
  yo: number
  repartidorId: number
  recargar: () => void
}

/** El equipo del panel, quién soy y quién reparte. */
export function useReparto(): Reparto {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<{ equipo: MiembroEquipo[]; yo: number; repartidorId: number }>({
    equipo: [],
    yo: 0,
    repartidorId: 0,
  })
  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getReparto(org.id, accessToken)
    if (r.ok && r.datos) setDatos({ equipo: r.datos.equipo, yo: r.datos.yo, repartidorId: r.datos.repartidor_id })
  }, [org?.id, accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { ...datos, recargar: cargar }
}

/** A quién se le puede pasar una llamada: los closers, y yo aunque no lo sea
 *  (un administrador también puede quedarse una). Yo primero. */
export function aQuienRepartir(equipo: MiembroEquipo[], yo: number): MiembroEquipo[] {
  const closers = equipo.filter((m) => m.rol === 'Closer' || m.id === yo)
  return [...closers.filter((m) => m.id === yo), ...closers.filter((m) => m.id !== yo)]
}

/** El nombre de pila, para que los botones quepan en la tarjeta. */
export const nombreCorto = (nombre: string) => (nombre || '').trim().split(/\s+/)[0] || nombre

export function BotonesReparto({
  email,
  closerId,
  reparto,
  onHecho,
  pequeno = false,
  mesa = '',
}: {
  email: string
  closerId: number
  reparto: Reparto
  onHecho: (closerId: number, closer: string) => void
  pequeno?: boolean
  mesa?: 'leads' | 'ventas' | ''
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [enviando, setEnviando] = useState(0)
  const opciones = aQuienRepartir(reparto.equipo, reparto.yo)
  if (!opciones.length) return null

  async function dar(m: MiembroEquipo | null) {
    const id = m?.id ?? 0
    setEnviando(id || -1)
    const r = await asignarCloser(org?.id, email, id, accessToken, mesa)
    setEnviando(0)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido asignar')
      return
    }
    if (!m) toast.success(mesa === 'leads' ? 'Sin closer' : 'Vuelve a «Por asignar»')
    else if (m.id === reparto.yo) toast.success('Para ti')
    else toast.success(r.datos?.avisado ? `Para ${nombreCorto(m.nombre)}: le ha llegado un correo` : `Para ${nombreCorto(m.nombre)}`)
    onHecho(id, m?.nombre ?? '')
  }

  const clase = pequeno
    ? 'h-7 px-2 rounded-md text-[12px] font-semibold'
    : 'h-8 px-2.5 rounded-md text-[12.5px] font-semibold'
  return (
    <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {opciones.map((m) => {
        const suyo = closerId === m.id
        return (
          <button
            key={m.id}
            type="button"
            disabled={Boolean(enviando) || suyo}
            onClick={() => dar(m)}
            className={`${clase} ${
              suyo ? 'bg-gray-900 text-white' : 'border border-[#E5E7EB] bg-white text-gray-800 hover:bg-[#F9FAFB]'
            } disabled:opacity-100`}
          >
            {enviando === m.id ? '…' : m.id === reparto.yo ? 'Para mí' : `Para ${nombreCorto(m.nombre)}`}
          </button>
        )
      })}
      {closerId ? (
        <button
          type="button"
          disabled={Boolean(enviando)}
          onClick={() => dar(null)}
          className={`${clase} border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]`}
        >
          Sin asignar
        </button>
      ) : null}
    </div>
  )
}

/** La etiqueta de un closer: su nombre de pila con su color. */
export function PildoraCloser({ nombre, color, title }: { nombre: string; color: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1 h-5 px-1.5 rounded-full border text-[11px] font-semibold leading-none"
      style={{ color, background: `${color}12`, borderColor: `${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="truncate">{nombreCorto(nombre)}</span>
    </span>
  )
}

/**
 * En cada tarjeta del tablero (31/10): quién la lleva, sin abrirla. Con closer,
 * su etiqueta; tocándola (si es tuya o eres administrador) se cambia. Sin
 * closer, «Asignarme» (un toque) y la flecha para pasársela a otro.
 * No abre la tarjeta: el clic se queda aquí.
 */
export function EtiquetaCloser({
  email,
  closerId,
  closer,
  reparto,
  mesa,
  onHecho,
  ofrecer = true,
}: {
  email: string
  closerId: number
  closer: string
  reparto: Reparto
  mesa: 'leads' | 'ventas'
  onHecho: (closerId: number, closer: string) => void
  /** Sin closer: enseñar «Asignarme» (no en Descartado ni en Ganada). */
  ofrecer?: boolean
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const caja = useRef<HTMLDivElement | null>(null)
  const lista = useRef<HTMLDivElement | null>(null)
  const opciones = aQuienRepartir(reparto.equipo, reparto.yo)

  useEffect(() => {
    if (!menu) return
    const cerrar = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'mousedown' && (caja.current?.contains(e.target as Node) || lista.current?.contains(e.target as Node))) return
      setMenu(null)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', cerrar)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', cerrar)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [menu])

  if (!reparto.yo) return null
  const color = closerId ? colorCloser(closerId, reparto.equipo, closer) : ''
  const nombreActual = reparto.equipo.find((m) => m.id === closerId)?.nombre || closer
  const puedeCambiar = !closerId || isAdmin || closerId === reparto.yo

  async function dar(id: number) {
    setMenu(null)
    if (id === closerId) return
    const m = reparto.equipo.find((x) => x.id === id)
    setEnviando(true)
    const r = await asignarCloser(org?.id, email, id, accessToken, mesa)
    setEnviando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido asignar')
      return
    }
    if (!id) toast.success(mesa === 'ventas' ? 'Vuelve a «Por asignar»' : 'Sin closer')
    else if (id === reparto.yo) toast.success('Para ti')
    else toast.success(r.datos?.avisado ? `Para ${nombreCorto(m?.nombre || '')}: le ha llegado un correo` : `Para ${nombreCorto(m?.nombre || '')}`)
    onHecho(id, m?.nombre ?? '')
  }

  function abrir(e: React.MouseEvent<HTMLElement>) {
    if (menu) return setMenu(null)
    const r = e.currentTarget.getBoundingClientRect()
    // Cabe a la derecha del botón o, si no, pegado al borde derecho.
    setMenu({ x: Math.max(8, Math.min(r.left, window.innerWidth - 216)), y: r.bottom + 4 })
  }

  return (
    <div
      ref={caja}
      className="inline-flex max-w-full"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {closerId ? (
        puedeCambiar && opciones.length ? (
          <button type="button" onClick={abrir} disabled={enviando} className="max-w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
            <PildoraCloser nombre={nombreActual} color={color} title={`La lleva ${nombreActual}. Toca para cambiarla.`} />
          </button>
        ) : (
          <PildoraCloser nombre={nombreActual} color={color} title={`La lleva ${nombreActual}`} />
        )
      ) : ofrecer && opciones.length ? (
        <span className="inline-flex h-5 items-stretch rounded-full border border-dashed border-[#C4CAD3] text-[11px] font-semibold text-[#6B7280] leading-none">
          <button
            type="button"
            disabled={enviando}
            onClick={() => dar(reparto.yo)}
            className="inline-flex items-center gap-0.5 pl-1.5 pr-1.5 rounded-l-full hover:text-gray-900 hover:bg-white"
            title="Quedártela: saldrá tu nombre en la tarjeta para todos"
          >
            <Plus size={11} strokeWidth={2.5} />
            {enviando ? '…' : 'Asignarme'}
          </button>
          {opciones.length > 1 ? (
            <button
              type="button"
              disabled={enviando}
              onClick={abrir}
              aria-label="Pasársela a otra persona"
              title="Pasársela a otra persona"
              className="inline-flex items-center pl-1 pr-1.5 rounded-r-full border-l border-dashed border-[#C4CAD3] hover:text-gray-900 hover:bg-white"
            >
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
          ) : null}
        </span>
      ) : null}
      {menu && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={lista}
              className="fixed z-[1000] w-52 rounded-lg border border-[#E5E7EB] bg-white py-1 text-[13px]"
              style={{ left: menu.x, top: menu.y }}
            >
              {opciones.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => dar(m.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-gray-900 hover:bg-[#F9FAFB]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorCloser(m.id, reparto.equipo, m.nombre) }} />
                  <span className="flex-1 truncate">{m.id === reparto.yo ? 'Asignarme a mí' : `Para ${nombreCorto(m.nombre)}`}</span>
                  {m.id === closerId ? <Check size={13} className="text-gray-500" /> : null}
                </button>
              ))}
              {closerId ? (
                <button
                  type="button"
                  onClick={() => dar(0)}
                  className="w-full px-3 py-1.5 text-left text-[#6B7280] hover:bg-[#F9FAFB] border-t border-[#F3F4F6] mt-1 pt-2"
                >
                  {mesa === 'ventas' ? 'Sin asignar (a «Por asignar»)' : 'Quitar el closer'}
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
