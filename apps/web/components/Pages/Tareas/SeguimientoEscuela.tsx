'use client'

/**
 * El seguimiento semanal dentro de la escuela, para el equipo que no entra al
 * panel (los profes). La API ya comprueba que sea del equipo
 * (`STAFF_ROLE_IDS`); a un alumno le contestaría 403 y aquí se dice.
 */

import React from 'react'
import { ClipboardCheck } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import SeguimientoPanel from '@components/Dashboard/Pages/Panel/SeguimientoPanel'

export default function SeguimientoEscuela() {
  const { isStaff, loading } = useAdminStatus() as any
  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pb-4">
        <ClipboardCheck size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Seguimiento semanal</h1>
      </div>
      {loading ? null : isStaff ? (
        <SeguimientoPanel enEscuela />
      ) : (
        <p className="py-10 text-center text-[14px] text-[#6B7280]">Esta página es para el equipo de la escuela.</p>
      )}
    </GeneralWrapperStyled>
  )
}
