'use client'

/**
 * Enlace de pago personal: el checkout de la escuela con sus datos ya puestos.
 * Para cerrar en la llamada o mandárselo por WhatsApp después. Paga por el
 * camino de siempre, así que la cuenta, el correo y la factura salen solos
 * (con un Payment Link de Stripe no pasaba y había que dar de alta a mano).
 *
 * Una sola pieza para todos los sitios (03/10: "a veces puedo crear el enlace
 * y otras no"): antes solo existía en la lista de solicitudes de Llamadas, y
 * no en la cita del calendario ni en la ficha.
 *
 * Precios (20/10/2026; desde el 01/11/2026, los del panel): dos botones
 * claros, uno por forma de pago, que crean el enlace al pulsarlos.
 *  - «Pago único o Klarna · 597 €»: la caja de siempre; Klarna va dentro. La
 *    caja de la web sigue en 435 €: este precio es solo el de los enlaces del
 *    panel (`precio_panel_cents` en payments.py).
 *  - «A plazos · 3 meses»: el plan de pagos propio, 3 pagos de 230 € (690 €),
 *    sin elegir nada; con el primero entra en la escuela y al último se acaba
 *    solo (`PLAZOS_PANEL` en apps/api/src/services/payments/plazos.py). Del
 *    20/10 al 01/11 la persona elegía 3 (497 €) o 4 pagos (540 €).
 *  - «Otro importe», pequeño y en gris a propósito ("que se vea menos, así el
 *    closer no se lía"): un pago único a otro precio, p. ej. 397 € para quien
 *    ya lo tenía prometido. Va por la reserva de plaza con el total = lo que
 *    se cobra, así que al pagar entra en la escuela como con el pago normal.
 *    O a plazos (22/10/2026, "poner 435 y que salga a plazos"): el total y de
 *    2 a 6 pagos los pone el equipo y la persona va directa a la caja, sin
 *    elegir nada. Es el mismo plan propio (`a_medida` en plazos.py).
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { crearEnlacePago, crearEnlaceReserva, type CondicionesPlazos } from '@services/stats/contactos'
import { CalendarClock, Copy, CreditCard, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'
import { numeroWhatsApp } from '@/lib/nawar/telefono'

/** El pago único, para el rótulo del botón. El que cobra de verdad es
 *  `precio_panel_cents` en apps/api/src/services/payments/payments.py, y
 *  después de crear el enlace se enseña el que devuelve el servidor. */
const PRECIO_UNICO_CENTS = 59700

/** Las cuotas de un total, como `reparto` en plazos.py: los céntimos que
 *  sobran van en las primeras (497 € → 165,67 · 165,67 · 165,66). */
function repartoPlazos(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => (i < resto ? base + 1 : base))
}

const euros = (c: number) => `${(c / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`

/** «3 pagos de 165,67 € (497 €) o 4 de 135 € (540 €)». */
function textoOpciones(opciones: CondicionesPlazos[]): string {
  return opciones
    .map((o, i) => `${o.cuotas}${i === 0 ? ' pagos' : ''} de ${euros(repartoPlazos(o.total_cents, o.cuotas)[0])} (${euros(o.total_cents)})`)
    .join(' o ')
}

/** «Otro importe»: en cuántos pagos. 1 = pago único; de 2 a 6, a plazos
 *  (los límites de `a_medida` en plazos.py). */
const PAGOS_A_MEDIDA = [1, 2, 3, 4, 5, 6]

type Hecho = {
  url: string
  dias: number
  tipo: 'unico' | 'plazos' | 'otro' | 'medida'
  importe: number
  opciones: CondicionesPlazos[]
}

export default function EnlacePago({ email, nombre: nombreCompleto, telefono }: { email: string; nombre?: string; telefono?: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [hecho, setHecho] = useState<Hecho | null>(null)
  const [creando, setCreando] = useState<'' | 'unico' | 'plazos' | 'otro'>('')
  const [otroAbierto, setOtroAbierto] = useState(false)
  const [otro, setOtro] = useState('397')
  const [pagosOtro, setPagosOtro] = useState(1)

  const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  const nombre = partes[0] || ''
  const apellidos = partes.slice(1).join(' ')
  // Sin nombre, la parte del correo antes de la @: el backend pide uno.
  const persona = { email, first_name: nombre || email.split('@')[0] || email, last_name: apellidos, phone: telefono || '' }

  async function crear(plan: '' | 'plazos') {
    setCreando(plan || 'unico')
    const r = await crearEnlacePago(org?.id, { ...persona, plan }, accessToken)
    setCreando('')
    if (!r.url) {
      toast.error(r.error || 'No se ha podido crear el enlace')
      return
    }
    setHecho({
      url: r.url,
      dias: r.dias || 0,
      tipo: plan === 'plazos' ? 'plazos' : 'unico',
      importe: r.precio_cents || PRECIO_UNICO_CENTS,
      opciones: r.opciones || [],
    })
  }

  const centsOtro = Math.round(parseFloat(otro.replace(',', '.')) * 100)

  async function crearOtro() {
    const cents = centsOtro
    if (!Number.isFinite(cents) || cents < 50 * pagosOtro) {
      toast.error('Pon un importe en euros, por ejemplo 397')
      return
    }
    setCreando('otro')
    if (pagosOtro > 1) {
      const r = await crearEnlacePago(org?.id, { ...persona, plan: 'plazos', total_cents: cents, cuotas: pagosOtro }, accessToken)
      setCreando('')
      if (!r.url) {
        toast.error(r.error || 'No se ha podido crear el enlace')
        return
      }
      setHecho({ url: r.url, dias: r.dias || 0, tipo: 'medida', importe: cents, opciones: r.opciones || [] })
      setOtroAbierto(false)
      return
    }
    const r = await crearEnlaceReserva(org?.id, { ...persona, importe_cents: cents, total_cents: cents }, accessToken)
    setCreando('')
    if (!r.ok || !r.datos?.url) {
      toast.error(r.error || 'No se ha podido crear el enlace')
      return
    }
    setHecho({ url: r.datos.url, dias: r.datos.dias || 0, tipo: 'otro', importe: r.datos.importe_cents, opciones: [] })
    setOtroAbierto(false)
  }

  if (!hecho) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => crear('')} disabled={!!creando || !email} className={`${BOTON_PRINCIPAL} disabled:opacity-50`}>
            {creando === 'unico' ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
            Pago único o Klarna · {euros(PRECIO_UNICO_CENTS)}
          </button>
          <button onClick={() => crear('plazos')} disabled={!!creando || !email} className={`${BOTON} disabled:opacity-50`}>
            {creando === 'plazos' ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
            A plazos · 3 meses
          </button>
        </div>
        {otroAbierto ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="inline-flex items-center gap-1 h-8 rounded-md border border-[#D1D5DB] px-2 bg-white">
              <input
                value={otro}
                onChange={(e) => setOtro(e.target.value)}
                inputMode="decimal"
                aria-label="Importe en euros"
                autoFocus
                className="w-16 text-[13px] font-medium tabular-nums text-gray-900 outline-none"
              />
              <span className="text-[12.5px] text-gray-500">€</span>
            </label>
            <select
              value={pagosOtro}
              onChange={(e) => setPagosOtro(Number(e.target.value))}
              aria-label="En cuántos pagos"
              className="h-8 rounded-md border border-[#D1D5DB] bg-white px-2 text-[13px] text-gray-900"
            >
              {PAGOS_A_MEDIDA.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'En 1 pago' : `En ${n} plazos`}
                </option>
              ))}
            </select>
            <button onClick={crearOtro} disabled={!!creando || !email} className={`${BOTON} disabled:opacity-50`}>
              {creando === 'otro' ? <Loader2 size={13} className="animate-spin" /> : null}
              {pagosOtro > 1 ? 'Crear enlace a plazos' : 'Crear enlace de pago único'}
            </button>
            <button onClick={() => setOtroAbierto(false)} className="text-[12px] text-gray-500 hover:text-gray-900 px-1">
              Cancelar
            </button>
            {pagosOtro > 1 && Number.isFinite(centsOtro) && centsOtro >= 50 * pagosOtro ? (
              <p className={`${META} w-full`}>
                {textoOpciones([{ cuotas: pagosOtro, total_cents: centsOtro } as CondicionesPlazos])}: el primero al
                pagar y los demás cada mes, solos.
              </p>
            ) : null}
          </div>
        ) : (
          <button onClick={() => setOtroAbierto(true)} className="text-[12px] text-gray-400 hover:text-gray-700 underline underline-offset-2">
            Otro importe
          </button>
        )}
      </div>
    )
  }

  const { url, dias, tipo, importe, opciones } = hecho
  const queEs =
    tipo === 'plazos' || tipo === 'medida'
      ? `a plazos: ${textoOpciones(opciones)}`
      : tipo === 'otro'
        ? `de ${euros(importe)} en un solo pago`
        : `de ${euros(importe)}: pago único o, si lo prefiere, con Klarna`
  const num = numeroWhatsApp(telefono)
  const textoWa = encodeURIComponent(
    `Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu enlace para apuntarte a la formación${
      tipo === 'plazos' || tipo === 'medida'
        ? ` a plazos (${textoOpciones(opciones)}: el primero hoy y los demás cada mes)`
        : tipo === 'otro'
          ? ` (${euros(importe)})`
          : ` (${euros(importe)}; en la página puedes pagarlo de una vez o con Klarna)`
    }: ${url}`
  )

  return (
    <div className="w-full rounded-md border border-[#E5E7EB] px-3 py-2.5 space-y-2">
      <p className={META}>
        Enlace <strong className="text-gray-900 font-semibold">{queEs}</strong>, con sus datos puestos. Vale {dias} días.{' '}
        {tipo === 'plazos' || tipo === 'medida'
          ? 'Con el primer pago entra en la escuela; los otros se cobran solos cada mes y al último se acaba.'
          : 'Al pagar se le crea la cuenta y le llega la factura.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-[180px] h-8 text-[12.5px] border border-[#E5E7EB] rounded-md px-2.5 text-gray-700" />
        <button onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Copiado'))} className={BOTON}>
          <Copy size={13} /> Copiar
        </button>
        {num ? (
          <a href={`https://wa.me/${num}?text=${textoWa}`} target="_blank" rel="noreferrer" className={BOTON_PRINCIPAL}>
            Mandar por WhatsApp
          </a>
        ) : null}
      </div>
      <button onClick={() => setHecho(null)} className="text-[12px] text-gray-400 hover:text-gray-700 underline underline-offset-2">
        Crear otro enlace
      </button>
    </div>
  )
}
