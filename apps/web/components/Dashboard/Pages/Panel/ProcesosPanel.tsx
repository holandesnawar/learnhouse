'use client'
/**
 * Panel → Procesos (24/11/2026): los SOP de todo el equipo, closers
 * incluidos. Es la misma pieza que la pestaña «Procesos» de la sala de
 * profesores (`ManualEquipo`): los mismos procesos, en los dos sitios.
 * `?p=<id>` abre uno (lo pone el aviso de la campana).
 * Servidor: apps/api/src/services/equipo/procesos.py.
 */
import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import ManualEquipo from '@components/Pages/Equipo/ManualEquipo'
import { getProcesos, type DocManual, type Miembro } from '@services/equipo/equipo'

export default function ProcesosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [procesos, setProcesos] = useState<DocManual[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [admin, setAdmin] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [abrir] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    return Number(new URLSearchParams(window.location.search).get('p')) || null
  })

  useEffect(() => {
    if (!org?.id || !token) return
    getProcesos(org.id, token)
      .then((d) => {
        setProcesos(d.procesos)
        setMiembros(d.miembros)
        setAdmin(d.yo.admin)
        setCargado(true)
      })
      .catch((e) => setError(e?.message || 'No se han podido cargar los procesos'))
  }, [org?.id, token])

  if (error) return <p className="text-[14px] text-red-700">{error}</p>
  if (!cargado) return <p className="text-[14px] text-[#6B7393]">Cargando los procesos…</p>
  return <ManualEquipo orgId={org.id} token={token} manual={procesos} setManual={setProcesos} admin={admin} abrir={abrir} miembros={miembros} />
}
