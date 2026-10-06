'use client'

/**
 * Reservar plaza con señal y cobrar el resto (06/10/2026).
 *
 * "Manuel está en llamada, tuvo problemas con Klarna o su tarjeta y no pudo
 * cerrar. Se le pasa un enlace de 50 € como señal para guardarse la plaza.
 * Queda en su ficha lo que pagó y lo que falta. Con la señal NO entra; cuando
 * complete lo que falta, ahí se le da acceso."
 *
 * Cada enlace abre la caja de pago de la escuela de siempre, por ese importe.
 * El servidor recorta el importe a lo pendiente al abrirlo y solo da acceso
 * cuando lo pagado llega al total (services/payments/reservas.py).
 *
 * El total distinto del precio, cambiarlo y cancelar: solo administradores.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  cambiarTotalReserva,
  cancelarReserva,
  crearEnlaceReserva,
  getPrecioReserva,
  type Reserva,
} from '@services/stats/contactos'
import { Copy, Loader2, Lock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, BOTON_PELIGRO, BOTON_PRINCIPAL, META } from './ui'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { confirmar } from '@lib/nawar/confirmar'
import { euros } from '@services/panel/panel'

/** "50" o "50,5" → céntimos. NaN si no es un número. */
function aCentimos(texto: string): number {
  const limpio = (texto || '').trim().replace(/\s|€/g, '').replace(',', '.')
  if (!limpio) return NaN
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

function fecha(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  } catch {
    return ''
  }
}

const INPUT = 'h-8 w-24 text-[13px] border border-[#E5E7EB] rounded-md px-2.5 text-gray-900 tabular-nums'

/** El enlace ya hecho: copiar o mandar por WhatsApp. */
function EnlaceListo({ url, texto, mensaje, telefono }: { url: string; texto: string; mensaje: string; telefono?: string }) {
  const num = numeroWhatsApp(telefono)
  return (
    <div className="w-full rounded-md border border-[#E5E7EB] px-3 py-2.5 space-y-2">
      <p className={META}>{texto}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[180px] h-8 text-[12.5px] border border-[#E5E7EB] rounded-md px-2.5 text-gray-700"
        />
        <button onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Copiado'))} className={BOTON}>
          <Copy size={13} /> Copiar
        </button>
        {num ? (
          <a
            href={`https://wa.me/${num}?text=${encodeURIComponent(`${mensaje} ${url}`)}`}
            target="_blank"
            rel="noreferrer"
            className={BOTON_PRINCIPAL}
          >
            Mandar por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default function ReservaPlaza({
  email,
  nombre,
  telefono,
  reserva,
  esAlumno,
  onCambio,
}: {
  email: string
  nombre?: string
  telefono?: string
  reserva?: Reserva | null
  esAlumno: boolean
  onCambio: (r: Reserva) => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus()

  const abierta = reserva?.estado === 'abierta' ? reserva : null
  const [formulario, setFormulario] = useState(false)
  const [importe, setImporte] = useState('')
  const [total, setTotal] = useState('')
  const [precio, setPrecio] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [enlace, setEnlace] = useState<{ url: string; texto: string; mensaje: string } | null>(null)
  const [editandoTotal, setEditandoTotal] = useState(false)

  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  const primerNombre = partes[0] || ''

  // Al abrir el formulario: el precio de la formación (de Stripe) como total,
  // y la señal de 50 €, o lo que falte si ya hay reserva.
  useEffect(() => {
    if (!formulario) return
    if (abierta) {
      setImporte(String(abierta.pendiente_cents / 100).replace('.', ','))
      return
    }
    setImporte('50')
    if (precio) return
    getPrecioReserva(org?.id, accessToken).then((r) => {
      if (r.ok && r.datos) {
        setPrecio(r.datos.total_cents)
        setTotal(String(r.datos.total_cents / 100).replace('.', ','))
      }
    })
  }, [formulario, abierta, precio, org?.id, accessToken])

  async function crear() {
    const cents = aCentimos(importe)
    if (!Number.isFinite(cents) || cents < 50) return toast.error('Pon un importe de al menos 0,50 €')
    const totalCents = isAdmin && !abierta ? aCentimos(total) : undefined
    if (totalCents !== undefined && (!Number.isFinite(totalCents) || totalCents < cents)) {
      return toast.error('El total no puede ser menor que lo que cobras ahora')
    }
    setOcupado(true)
    const r = await crearEnlaceReserva(
      org?.id,
      {
        email,
        first_name: primerNombre || email.split('@')[0],
        last_name: partes.slice(1).join(' '),
        phone: telefono || '',
        importe_cents: cents,
        total_cents: totalCents,
      },
      accessToken
    )
    setOcupado(false)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido crear el enlace')
    const d = r.datos
    const cuanto = euros(d.importe_cents)
    const completa = d.tipo === 'resto'
    const hola = `Hola${primerNombre ? ` ${primerNombre}` : ''},`
    setEnlace({
      url: d.url,
      mensaje: completa
        ? `${hola} aquí tienes el enlace para pagar lo que falta (${cuanto}) y completar tu matrícula en la formación:`
        : d.tipo === 'senal'
          ? `${hola} aquí tienes el enlace para pagar la señal de ${cuanto} y reservar tu plaza en la formación:`
          : `${hola} aquí tienes el enlace para pagar ${cuanto} a cuenta de tu matrícula:`,
      texto: completa
        ? `Enlace de ${cuanto} listo (vale ${d.dias} días). Con este pago completa la matrícula: al pagarlo se le abre la escuela y le llega el correo para entrar.`
        : `Enlace de ${cuanto} listo (vale ${d.dias} días). Al pagarlo se guarda su plaza, pero NO entra a la escuela hasta pagar el resto.`,
    })
    setFormulario(false)
    onCambio(d.reserva)
  }

  async function guardarTotal() {
    if (!abierta) return
    const cents = aCentimos(total)
    if (!Number.isFinite(cents)) return toast.error('Pon un total válido')
    setOcupado(true)
    const r = await cambiarTotalReserva(org?.id, abierta.id, cents, accessToken)
    setOcupado(false)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido cambiar')
    setEditandoTotal(false)
    onCambio(r.datos)
    toast.success('Total cambiado')
  }

  async function cancelar() {
    if (!abierta) return
    const ok = await confirmar(
      abierta.pagado_cents > 0
        ? `¿Cancelar la reserva? Se libera su plaza y los enlaces que tenga dejan de valer. Ha pagado ${euros(abierta.pagado_cents)}: esto NO se lo devuelve; si hay que devolverlo, se hace en Stripe.`
        : '¿Cancelar la reserva? Se libera la plaza y los enlaces que tenga dejan de valer.',
      { boton: 'Cancelar la reserva', peligro: true }
    )
    if (!ok) return
    const r = await cancelarReserva(org?.id, abierta.id, accessToken)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido cancelar')
    setEnlace(null)
    onCambio(r.datos)
  }

  // ── sin reserva abierta ──
  if (!abierta) {
    if (esAlumno) return null
    return (
      <div className="w-full space-y-2">
        {formulario ? (
          <div className="rounded-md border border-[#E5E7EB] px-3 py-3 space-y-2.5">
            <p className="text-[12.5px] text-gray-800">
              <strong className="font-semibold">Señal para reservar su plaza.</strong> Paga esto ahora y la plaza queda
              guardada; <strong className="font-semibold">no entra a la escuela</strong> hasta que complete el total.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-gray-700">
              <label className="inline-flex items-center gap-1.5">
                Señal
                <input value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" className={INPUT} />€
              </label>
              {isAdmin ? (
                <label className="inline-flex items-center gap-1.5">
                  Total a pagar
                  <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={INPUT} />€
                </label>
              ) : (
                <span>Total a pagar: {precio ? euros(precio) : '…'}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={crear} disabled={ocupado} className={BOTON_PRINCIPAL}>
                {ocupado ? <Loader2 size={13} className="animate-spin" /> : null} Crear enlace de la señal
              </button>
              <button onClick={() => setFormulario(false)} className={BOTON}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setFormulario(true)} className={BOTON}>
            <Lock size={13} /> Cobrar una señal
          </button>
        )}
        {enlace ? <EnlaceListo url={enlace.url} texto={enlace.texto} mensaje={enlace.mensaje} telefono={telefono} /> : null}
      </div>
    )
  }

  // ── reserva abierta ──
  const pct = abierta.total_cents ? Math.min(100, Math.round((abierta.pagado_cents * 100) / abierta.total_cents)) : 0
  return (
    <div className="w-full rounded-md border border-[#E5E7EB] px-3 py-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-gray-900">
          {abierta.pagado_cents > 0 ? 'Plaza reservada · sin acceso todavía' : 'Señal pendiente de pagar'}
        </p>
        <p className="text-[12.5px] tabular-nums text-gray-700">
          {euros(abierta.pagado_cents)} de {euros(abierta.total_cents)}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
        <div className="h-full rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12.5px] text-gray-800">
        Le falta: <strong className="font-semibold tabular-nums">{euros(abierta.pendiente_cents)}</strong>. Entra a la
        escuela cuando lo pague todo.
      </p>
      {esAlumno ? (
        <p className="text-[12.5px] text-[#B91C1C]">
          Ya es alumno: pagó por otro camino. Revisa si hay que devolverle lo pagado aquí (en Stripe) y cancela la
          reserva.
        </p>
      ) : null}

      {abierta.pagos.length ? (
        <ul className="divide-y divide-[#F3F4F6] border-t border-[#F3F4F6]">
          {abierta.pagos.map((p) => (
            <li key={p.id} className="py-1.5 flex items-center justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate text-gray-800">
                {fecha(p.paid_at || p.created_at)} · {p.nombre}
                {p.estado === 'pendiente' ? <span className="text-[#9CA3AF]"> · enlace abierto, sin pagar</span> : null}
              </span>
              <span className={`shrink-0 tabular-nums font-semibold ${p.estado === 'pagado' ? 'text-[#15803D]' : 'text-[#9CA3AF]'}`}>
                {euros(p.importe_cents)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {formulario ? (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-gray-700">
          <label className="inline-flex items-center gap-1.5">
            Cobrar
            <input value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" className={INPUT} />€
          </label>
          <button onClick={crear} disabled={ocupado} className={BOTON_PRINCIPAL}>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : null} Crear enlace
          </button>
          <button onClick={() => setFormulario(false)} className={BOTON}>
            Cancelar
          </button>
          <span className={`${META} w-full`}>Por defecto, todo lo que falta. Puedes poner menos si lo paga en partes.</span>
        </div>
      ) : editandoTotal ? (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-gray-700">
          <label className="inline-flex items-center gap-1.5">
            Total a pagar
            <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={INPUT} />€
          </label>
          <button onClick={guardarTotal} disabled={ocupado} className={BOTON_PRINCIPAL}>
            Guardar
          </button>
          <button onClick={() => setEditandoTotal(false)} className={BOTON}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFormulario(true)} className={BOTON_PRINCIPAL}>
            Enlace por lo que falta
          </button>
          {isAdmin ? (
            <>
              <button
                onClick={() => {
                  setTotal(String(abierta.total_cents / 100).replace('.', ','))
                  setEditandoTotal(true)
                }}
                className={BOTON}
              >
                Cambiar total
              </button>
              <button onClick={cancelar} className={BOTON_PELIGRO}>
                <X size={13} /> Cancelar reserva
              </button>
            </>
          ) : null}
        </div>
      )}
      {enlace ? <EnlaceListo url={enlace.url} texto={enlace.texto} mensaje={enlace.mensaje} telefono={telefono} /> : null}
    </div>
  )
}
