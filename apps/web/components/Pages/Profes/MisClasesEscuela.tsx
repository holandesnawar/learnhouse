'use client'

/**
 * «Mis clases» dentro de la escuela, para el equipo (los profes no entran al
 * panel). Las llamadas que usa ya comprueban que sea del equipo
 * (`STAFF_ROLE_IDS`); a un alumno le contestarían 403, así que ni se intenta.
 */

import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import ClasesProfes, { CabeceraMisClases } from './ClasesProfes'

export default function MisClasesEscuela() {
  const { isStaff, loading } = useAdminStatus() as any
  return (
    <GeneralWrapperStyled>
      <CabeceraMisClases />
      {loading ? null : isStaff ? (
        <ClasesProfes />
      ) : (
        <p className="py-10 text-center text-[14px] text-[#6B7280]">Esta página es para el equipo de la escuela.</p>
      )}
    </GeneralWrapperStyled>
  )
}
