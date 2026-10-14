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
 * «3 plazos» (14/10/2026): el plan de pagos propio, para quien no conoce
 * Klarna o a quien Klarna le falla. Cobra el primer mes al pagar (y ya entra
 * en la escuela) y los otros dos solos, al mes; al tercero se acaba solo.
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { crearEnlacePago, type CondicionesPlazos } from '@services/stats/contactos'
import { Copy, CreditCard, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, BOTON_PRINCIPAL, META } from './ui'
import { numeroWhatsApp } from '@/lib/nawar/telefono'

export default function EnlacePago({ email, nombre: nombreCompleto, telefono }: { email: string; nombre?: string; telefono?: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [url, setUrl] = useState('')
  const [dias, setDias] = useState(0)
  const [creando, setCreando] = useState(false)
  const [plan, setPlan] = useState<'' | 'plazos'>('')
  const [condiciones, setCondiciones] = useState<CondicionesPlazos | null>(null)

  const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  const nombre = partes[0] || ''
  const apellidos = partes.slice(1).join(' ')

  async function crear() {
    setCreando(true)
    const r = await crearEnlacePago(
      org?.id,
      // Sin nombre, la parte del correo antes de la @: el backend pide uno.
      { email, first_name: nombre || email.split('@')[0] || email, last_name: apellidos, phone: telefono || '', plan },
      accessToken
    )
    setCreando(false)
    if (!r.url) {
      toast.error(r.error || 'No se ha podido crear el enlace')
      return
    }
    setUrl(r.url)
    setDias(r.dias || 0)
    setCondiciones(r.plan || null)
  }

  const euros = (c: number) => `${(c / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`
  const textoPlazos = condiciones
    ? `${condiciones.cuotas} pagos de ${euros(condiciones.cuota_cents)} al mes (${euros(condiciones.total_cents)} en total)`
    : ''

  const num = numeroWhatsApp(telefono)
  const textoWa = encodeURIComponent(
    `Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu enlace para apuntarte a la formación${
      textoPlazos ? ` en ${textoPlazos}` : ''
    }: ${url}`
  )

  if (!url) {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {/* Pago único (con Klarna dentro) o el plan propio en 3 plazos. */}
        <div className="inline-flex rounded-md border border-[#E5E7EB] p-0.5 bg-white">
          {(
            [
              ['', 'Pago único'],
              ['plazos', '3 plazos'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id || 'unico'}
              onClick={() => setPlan(id)}
              className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors ${
                plan === id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-[#F9FAFB]'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <button onClick={crear} disabled={creando || !email} className={`${BOTON} disabled:opacity-50`}>
          {creando ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Crear enlace de pago
        </button>
      </div>
    )
  }
  return (
    <div className="w-full rounded-md border border-[#E5E7EB] px-3 py-2.5 space-y-2">
      {textoPlazos ? (
        <p className={META}>
          Enlace <strong className="text-gray-900 font-semibold">en {textoPlazos}</strong>, con sus datos puestos. Vale {dias} días.
          Con el primer pago entra en la escuela; los otros se cobran solos cada mes y al último se acaba.
        </p>
      ) : (
        <p className={META}>Enlace listo, con sus datos puestos. Vale {dias} días. Al pagar se le crea la cuenta y le llega la factura.</p>
      )}
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
    </div>
  )
}
