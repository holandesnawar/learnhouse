'use client'

/**
 * Visión (17/10/2026): el mapa del negocio y el centro de campañas, solo para
 * administradores. Tres partes: Mapa (las tarjetas y sus submapas), Campañas
 * (el cuadro de mando y cada campaña con sus números) y Ajustes.
 *
 * En el móvil arranca en Campañas: el mapa se usa en el ordenador.
 */

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getTablero, type Tablero } from '@services/vision/vision'
import { TARJETA, filtro } from '../Panel/ui'
import CampanasVision from './CampanasVision'
import CampanaDetalle from './CampanaDetalle'
import AjustesVision from './AjustesVision'

// React Flow mide el navegador: el mapa solo se pinta en el cliente.
const MapasVision = dynamic(() => import('./MapaVision'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-gray-400" size={26} />
    </div>
  ),
})

type Parte = 'mapa' | 'campanas' | 'ajustes'
const CLAVE_PARTE = 'nawar.vision.parte'

export default function VisionPage() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string | undefined = session?.data?.tokens?.access_token
  const { isAdmin, loading } = useAdminStatus()

  const [parte, setParte] = useState<Parte>('campanas')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [error, setError] = useState('')
  const [ir, setIr] = useState<{ mapaId: number | null; foco?: number; vez: number } | null>(null)

  // La última parte abierta; la primera vez, Mapa en el ordenador y Campañas en el móvil.
  useEffect(() => {
    let guardada: string | null = null
    try {
      guardada = window.localStorage.getItem(CLAVE_PARTE)
    } catch {
      /* sin almacenamiento */
    }
    if (guardada === 'mapa' || guardada === 'campanas' || guardada === 'ajustes') setParte(guardada)
    else setParte(window.innerWidth >= 1024 ? 'mapa' : 'campanas')
  }, [])

  const elegir = (p: Parte) => {
    setParte(p)
    try {
      window.localStorage.setItem(CLAVE_PARTE, p)
    } catch {
      /* sin almacenamiento */
    }
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getTablero(org.id, token)
    if (!r.ok || !r.datos) return setError(r.error || 'No se han podido cargar las campañas')
    setError('')
    setTablero(r.datos)
  }, [org?.id, token])

  useEffect(() => {
    if (isAdmin) cargar()
  }, [cargar, isAdmin])

  if (loading || !org?.id || !token) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )
  }
  if (!isAdmin) {
    return <p className="text-[14px] text-gray-600">Visión es solo para administradores.</p>
  }

  const campanas = (tablero?.campanas ?? []).map((c) => ({ id: c.id, titulo: c.titulo }))

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        {(
          [
            ['mapa', 'Mapa'],
            ['campanas', 'Campañas'],
            ['ajustes', 'Ajustes'],
          ] as const
        ).map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => {
              elegir(id)
              setIr(null)
              if (id === 'campanas') setAbierta(null)
            }}
            className={filtro(parte === id)}
          >
            {nombre}
          </button>
        ))}
      </div>

      {parte === 'mapa' ? (
        <MapasVision
          orgId={org.id}
          token={token}
          campanas={campanas}
          metricas={tablero?.metricas ?? {}}
          ir={ir}
          onVerCampana={(id) => {
            setAbierta(id)
            elegir('campanas')
          }}
          onCambioCampanas={cargar}
        />
      ) : parte === 'ajustes' ? (
        <AjustesVision orgId={org.id} token={token} onGuardado={cargar} />
      ) : abierta ? (
        <CampanaDetalle
          orgId={org.id}
          token={token}
          id={abierta}
          onVolver={() => setAbierta(null)}
          onVerEnMapa={(mapaId, foco) => {
            setIr({ mapaId, foco, vez: Date.now() })
            elegir('mapa')
          }}
          onCambio={cargar}
        />
      ) : error ? (
        <div className={`${TARJETA} p-5`}>
          <p className="text-[14px] text-gray-700">{error}</p>
        </div>
      ) : !tablero ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={26} />
        </div>
      ) : (
        <CampanasVision tablero={tablero} onAbrir={setAbierta} onIrAlMapa={() => elegir('mapa')} />
      )}
    </div>
  )
}
