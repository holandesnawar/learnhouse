'use client'

/**
 * Un correo de la campaña de Black Friday tal cual llega, con los datos de un
 * ejemplo (`vistaEbook`, el mismo «Ver cómo queda» de Avisos). Lo usan
 * Panel → Correos y las tarjetas de correo del mapa de Visión (29/10/2026).
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { vistaEbook } from '@services/ebook/ebook'
import { BOTON, META } from './ui'

/** Donde se cambian los textos de los correos. */
export const EDITAR_CORREOS = '/dash/avisos?tab=ebook'

/** El correo tal cual llega, con los datos de un ejemplo. */
export default function VistaCorreo({ id, asunto, onClose }: { id: string; asunto: string; onClose: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!org?.id || !token) return
    vistaEbook(org.id, id, false, token).then((r) => (r.ok ? setHtml(r.datos.html) : setError(r.error)))
  }, [org?.id, token, id])
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-[680px] max-h-[92vh] flex flex-col rounded-xl bg-white border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#F3F4F6]">
          <div className="min-w-0">
            <p className={META}>Así le llega (con un nombre de ejemplo)</p>
            <p className="text-[15px] font-semibold text-gray-900 truncate">{asunto}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={EDITAR_CORREOS} className={BOTON}>
              Editar <ArrowRight size={13} />
            </Link>
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-[#F9FAFB]">
          {error ? (
            <p className="p-6 text-[13.5px] text-red-600">{error}</p>
          ) : html === null ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-gray-400" size={22} />
            </div>
          ) : (
            <iframe title="Vista del correo" srcDoc={html} sandbox="" className="w-full h-[70vh] bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}

