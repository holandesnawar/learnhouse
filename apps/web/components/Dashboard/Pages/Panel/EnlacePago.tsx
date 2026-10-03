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
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { crearEnlacePago } from '@services/stats/contactos'
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

  const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  const nombre = partes[0] || ''
  const apellidos = partes.slice(1).join(' ')

  async function crear() {
    setCreando(true)
    const r = await crearEnlacePago(
      org?.id,
      // Sin nombre, la parte del correo antes de la @: el backend pide uno.
      { email, first_name: nombre || email.split('@')[0] || email, last_name: apellidos, phone: telefono || '' },
      accessToken
    )
    setCreando(false)
    if (!r.url) {
      toast.error(r.error || 'No se ha podido crear el enlace')
      return
    }
    setUrl(r.url)
    setDias(r.dias || 0)
  }

  const num = numeroWhatsApp(telefono)
  const textoWa = encodeURIComponent(`Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu enlace para apuntarte a la formación: ${url}`)

  if (!url) {
    return (
      <button onClick={crear} disabled={creando || !email} className={`${BOTON} disabled:opacity-50`}>
        {creando ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Crear enlace de pago
      </button>
    )
  }
  return (
    <div className="w-full rounded-md border border-[#E5E7EB] px-3 py-2.5 space-y-2">
      <p className={META}>Enlace listo, con sus datos puestos. Vale {dias} días. Al pagar se le crea la cuenta y le llega la factura.</p>
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
