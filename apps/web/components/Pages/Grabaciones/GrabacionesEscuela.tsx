'use client'

/**
 * `/grabaciones`: las grabaciones de la sala de cada clase en directo, para el
 * equipo (10/11/2026). Arriba se elige la clase; debajo, su estudio
 * (`EstudioGrabaciones`). La API ya comprueba que sea del equipo; a un alumno
 * se le dice aquí.
 */

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Video } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getClasesEnDirecto } from '@services/tareas/tareas'
import EstudioGrabaciones from './EstudioGrabaciones'

const sin = (u: string) => String(u || '').replace(/^course_/, '')

export default function GrabacionesEscuela() {
  const { isStaff, loading } = useAdminStatus() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const [clase, setClase] = useState('')

  const { data } = useQuery({
    queryKey: ['tareas', 'clases-en-directo', org?.id],
    queryFn: () => getClasesEnDirecto(org.id, token),
    enabled: !!org?.id && !!token && !!isStaff,
    staleTime: 60_000,
  })
  const clases = data?.clases || []

  // La clase de la dirección (`?clase=`) o, si no, la primera.
  useEffect(() => {
    if (clase || !clases.length) return
    let pedida = ''
    try {
      pedida = sin(new URLSearchParams(window.location.search).get('clase') || '')
    } catch {
      /* sin dirección que leer */
    }
    setClase(clases.some((c) => sin(c.uuid) === pedida) ? pedida : sin(clases[0].uuid))
  }, [clase, clases])

  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pb-4">
        <Video size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Grabaciones de las clases</h1>
      </div>
      {loading ? null : !isStaff ? (
        <p className="py-10 text-center text-[14px] text-[#6B7280]">Esta página es para el equipo de la escuela.</p>
      ) : (
        <>
          {clases.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {clases.map((c) => {
                const elegida = sin(c.uuid) === clase
                return (
                  <button
                    key={c.uuid}
                    onClick={() => setClase(sin(c.uuid))}
                    className={`h-9 rounded-lg border px-3.5 text-[13.5px] font-semibold ${
                      elegida ? 'border-[#0b2da0] bg-[#0b2da0] text-white' : 'border-[#D5DEEE] bg-white text-[#0B1033] hover:border-[#0b2da0]'
                    }`}
                  >
                    {c.nombre}
                  </button>
                )
              })}
            </div>
          ) : null}
          {clase ? (
            <EstudioGrabaciones key={clase} courseUuid={clase} />
          ) : data ? (
            <p className="py-8 text-[14px] text-[#6B7280]">Aún no hay ninguna clase en directo.</p>
          ) : null}
        </>
      )}
    </GeneralWrapperStyled>
  )
}
