'use client'

import React from 'react'
import { ClipboardList } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import ConsultasAdminPage from '@components/Dashboard/Pages/Consultas/ConsultasAdminPage'

/**
 * Responder consultas, sin pasar por el panel de administración.
 *
 * Es la MISMA pantalla que `/dash/consultas`, montada también fuera del panel.
 * Hace falta porque el profe ya no entra al panel: si esto viviera solo ahí, la
 * pantalla existiría y él no podría abrirla.
 *
 * Antes esto era un marco con la aplicación de Consultas de fuera, que pedía una
 * segunda contraseña — se veía una pantalla de acceso dentro de la escuela
 * habiendo entrado ya. Eso lo resolvió la otra sesión rehaciendo la pantalla por
 * dentro; aquí solo se le abre la puerta al profe.
 */
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

  return <ConsultasAdminPage />
}
