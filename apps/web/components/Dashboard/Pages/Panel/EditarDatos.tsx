'use client'

/**
 * «Editar» en la cabecera de la ficha (06/11/2026): corregir el nombre y el
 * teléfono de una persona, p. ej. un móvil mal escrito. Lo de antes no se
 * borra: queda en su línea de tiempo con quién lo cambió. El correo no se
 * cambia aquí, porque es lo que une todo lo de esa persona.
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { corregirDatos } from '@services/stats/contactos'
import { BOTON, BOTON_PRINCIPAL } from './ui'

const CAMPO =
  'w-full h-9 px-3 rounded-lg border border-[#D5DDEC] bg-white text-[14px] text-gray-900 outline-none focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20'

export default function EditarDatos({
  email,
  nombre,
  telefono,
  onGuardado,
  onCancelar,
}: {
  email: string
  nombre: string
  telefono: string
  onGuardado: () => void
  onCancelar: () => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [n, setN] = useState(nombre || '')
  const [t, setT] = useState(telefono || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!org?.id || !accessToken || guardando) return
    setGuardando(true)
    setError('')
    const r = await corregirDatos(org.id, { email, nombre: n, telefono: t }, accessToken)
    setGuardando(false)
    if (!r.ok) {
      setError(r.error || 'No se ha podido guardar')
      return
    }
    toast.success(r.datos?.cambios?.length ? 'Datos guardados' : 'No había nada que cambiar')
    onGuardado()
  }

  return (
    <form onSubmit={guardar} className="mt-3 rounded-xl border border-[#E2E8F4] bg-[#F9FBFF] p-3 space-y-2.5">
      <label className="block">
        <span className="block text-[12px] font-semibold text-[#0a1656] mb-1">Nombre y apellidos</span>
        <input className={CAMPO} value={n} onChange={(e) => setN(e.target.value)} autoFocus />
      </label>
      <label className="block">
        <span className="block text-[12px] font-semibold text-[#0a1656] mb-1">Teléfono (WhatsApp)</span>
        <input
          className={CAMPO}
          value={t}
          onChange={(e) => setT(e.target.value)}
          inputMode="tel"
          placeholder="+31 6 12345678"
        />
        <span className="block text-[11.5px] text-[#6B7280] mt-1">Con el prefijo del país: +31, +32, +34…</span>
      </label>
      <p className="text-[11.5px] text-[#6B7280]">
        El correo ({email}) no se cambia aquí. Lo de antes queda apuntado en su historial.
      </p>
      {error ? <p className="text-[12.5px] text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className={BOTON_PRINCIPAL} disabled={guardando}>
          {guardando ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
        </button>
        <button type="button" className={BOTON} onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
