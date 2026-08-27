'use client'

import React from 'react'
import { ClipboardList, ExternalLink } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import useAdminStatus from '@components/Hooks/useAdminStatus'

/**
 * Responder consultas, sin pasar por el panel de administración.
 *
 * El tablón que ve el alumno (`/consultas`) lee las consultas y sus respuestas,
 * pero NO las escribe: la respuesta se redacta en la aplicación de Consultas,
 * que es un producto aparte con su propia cuenta. Hasta ahora el único sitio
 * desde donde se llegaba era `/dash/consultas`, o sea el panel — y el profe ya
 * no entra al panel.
 *
 * Ojo con el marco: la aplicación de Consultas se identifica con Supabase, y
 * hay navegadores que bloquean esa sesión dentro de un marco de otro dominio.
 * Por eso el botón de abrir en una pestaña nueva no es un adorno: es la salida
 * cuando el marco se queda en blanco.
 */
const CONSULTAS_ADMIN_URL = 'https://consultas-tau.vercel.app/admin.html'

export default function ResponderConsultasPage() {
  const { isStaff, loading } = useAdminStatus()

  if (loading) return null

  if (!isStaff) {
    return (
      <GeneralWrapperStyled>
        <div className="flex items-center space-x-3 py-4">
          <ClipboardList size={24} className="text-[#025dc7]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Responder consultas</h1>
        </div>
        <p className="text-[15px] text-gray-600">
          Esta parte es para el equipo. Tus consultas están en{' '}
          <span className="font-semibold text-[#025dc7]">Mis consultas</span>.
        </p>
      </GeneralWrapperStyled>
    )
  }

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center space-x-3">
          <ClipboardList size={24} className="text-[#025dc7]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Responder consultas</h1>
        </div>
        <a
          href={CONSULTAS_ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-sm font-bold transition-colors"
        >
          Abrir en pestaña nueva
          <ExternalLink size={15} strokeWidth={2.5} />
        </a>
      </div>

      <p className="text-[13.5px] text-gray-500 mb-4 leading-relaxed">
        Si el recuadro se queda en blanco, es que tu navegador no deja iniciar
        sesión aquí dentro. Ábrelo en una pestaña nueva con el botón de arriba.
      </p>

      <div className="bg-white rounded-2xl border border-[#DDE6F5] overflow-hidden">
        <iframe
          src={CONSULTAS_ADMIN_URL}
          title="Responder consultas"
          className="w-full border-0 h-[calc(100vh-260px)] min-h-[520px]"
          allow="clipboard-write; fullscreen"
        />
      </div>
    </GeneralWrapperStyled>
  )
}
