'use client'

/**
 * Inicio → «Consulta respondida» (14/11/2026). La última consulta del tablón
 * que el equipo ha respondido, solo si es de esta semana (7 días) y solo una.
 * Al abrirla o cerrarla con la X ya no vuelve a salir esa (se recuerda en el
 * navegador); cuando se responda otra, sale la nueva. Sin ninguna reciente,
 * no se pinta nada.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { X } from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getUltimaRespondida } from '@services/consultas/aviso'
import { htmlToText } from '@/lib/consultas/consultas'

const VISTA = 'nawar.consulta.vista'

export default function UltimaConsulta({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const { data } = useQuery({
    queryKey: ['consultas', 'ultima-respondida', org?.id],
    queryFn: () => getUltimaRespondida(org.id, token),
    enabled: !!org?.id && !!token,
    staleTime: 5 * 60 * 1000,
  })
  const [vista, setVista] = useState<string | null>(null)
  useEffect(() => {
    try {
      setVista(localStorage.getItem(VISTA) || '')
    } catch {
      setVista('')
    }
  }, [])

  if (!data || vista === null || vista === data.id) return null
  const marcar = () => {
    try {
      localStorage.setItem(VISTA, data.id)
    } catch {}
    setVista(data.id)
  }
  const respuesta = htmlToText(data.respuesta).trim()

  return (
    <div className="rounded-2xl border border-[#E4E8F2] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">Consulta respondida</p>
          <p className="mt-1 text-[16px] font-bold text-[#0B1033] leading-snug" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {data.title}
          </p>
          {respuesta ? <p className="mt-1.5 text-[14px] text-[#3B4262] leading-relaxed line-clamp-2">{respuesta}</p> : null}
        </div>
        <button type="button" onClick={marcar} aria-label="Ocultar" className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-[#8A91AD] hover:text-[#0B1033]">
          <X size={16} />
        </button>
      </div>
      <Link
        href={getUriWithOrg(orgslug, `/consultas?id=${encodeURIComponent(data.id)}`)}
        onClick={marcar}
        className="mt-3 inline-flex text-[13.5px] font-semibold text-[#0b2da0] hover:underline"
      >
        Leer la respuesta
      </Link>
    </div>
  )
}
