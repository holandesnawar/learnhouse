'use client'

/**
 * El acceso en pausa por una cuota sin pagar (23/11/2026, la regla de los
 * plazos sin pagar: apps/api/src/services/payments/pausa.py). La regla nace
 * APAGADA: entonces `GET /student/acceso` dice siempre «no» y aquí no se pinta
 * nada. Encendida, la formación y las clases enseñan `PantallaPausa` en vez de
 * su contenido (el servidor ya las cierra; esto es para que se entienda), y el
 * Inicio lleva `AvisoPausa`. Tono tranquilo: qué pasa, cómo se arregla y que
 * vuelve solo.
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { comprobarMiPago, eurosDe, getAcceso, type Acceso } from '@services/student/acceso'

const CLAVE = ['student', 'acceso']

export function useAcceso(activo = true): Acceso | null {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data } = useQuery({
    queryKey: CLAVE,
    queryFn: () => getAcceso(token),
    enabled: activo && !!token,
    staleTime: 60 * 1000,
    retry: false,
  })
  return data || null
}

function fechaLarga(d?: string) {
  if (!d) return ''
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
}

function Acciones({ acceso, orgslug }: { acceso: Acceso; orgslug: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const cliente = useQueryClient()
  const [comprobando, setComprobando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function comprobar() {
    setComprobando(true)
    setMensaje('')
    const r = await comprobarMiPago(token)
    setComprobando(false)
    if (!r.ok) {
      setMensaje(r.error || 'No hemos podido comprobarlo ahora mismo.')
      return
    }
    if (r.acceso && !r.acceso.pausado) {
      cliente.setQueryData(CLAVE, r.acceso)
      // Que la barra, el Inicio y los cursos se vuelvan a pedir ya con acceso.
      cliente.invalidateQueries()
      return
    }
    setMensaje('Todavía no nos consta el pago. Si acabas de pagar, espera unos minutos y vuelve a probar.')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {acceso.pagar_url ? (
          <a
            href={acceso.pagar_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0a2690]"
          >
            Pagar ahora
          </a>
        ) : null}
        <button
          onClick={comprobar}
          disabled={comprobando}
          className="inline-flex items-center justify-center rounded-lg border border-[#DDE6F5] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2da0] hover:bg-[#F0F5FF] disabled:opacity-60"
        >
          {comprobando ? 'Comprobando…' : 'Ya he pagado: comprobar'}
        </button>
        <Link
          href={getUriWithOrg(orgslug, '/mensajes')}
          className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#0b2da0] hover:underline"
        >
          Escribir al equipo
        </Link>
      </div>
      {mensaje ? <p className="text-[13.5px] text-[#5B6382]">{mensaje}</p> : null}
    </div>
  )
}

function Texto({ acceso }: { acceso: Acceso }) {
  const cual = acceso.numero && acceso.cuotas ? `el pago ${acceso.numero} de ${acceso.cuotas}` : 'un pago'
  return (
    <>
      Falta {cual} de tu formación ({eurosDe(acceso.debe_cents)}). Por eso, desde el {fechaLarga(acceso.desde)}, la formación y
      las clases en directo están en pausa. No has perdido nada: tu avance y tus tareas siguen ahí, y en cuanto el pago entre,
      vuelven solas.
    </>
  )
}

/** En lugar de la formación o de una clase, mientras el acceso está en pausa. */
export function PantallaPausa({ acceso, orgslug }: { acceso: Acceso; orgslug: string }) {
  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 sm:p-8">
        <h1
          className="text-[24px] sm:text-[28px] font-bold text-[#0B1033] tracking-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          Tu acceso está en pausa
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#2B3150]">
          <Texto acceso={acceso} />
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5B6382]">
          La comunidad, los mensajes y tus consultas siguen abiertos. Si hay algún problema con el pago, cuéntanoslo y lo vemos
          contigo.
        </p>
        <div className="mt-6">
          <Acciones acceso={acceso} orgslug={orgslug} />
        </div>
      </div>
    </div>
  )
}

/** Arriba del Inicio, solo si está en pausa. */
export function AvisoPausa({ orgslug }: { orgslug: string }) {
  const acceso = useAcceso()
  if (!acceso?.pausado) return null
  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-6">
      <p className="text-[16px] font-semibold text-[#0B1033]">
        Tu acceso está en pausa: falta un pago de {eurosDe(acceso.debe_cents)}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B6382]">
        <Texto acceso={acceso} />
      </p>
      <div className="mt-4">
        <Acciones acceso={acceso} orgslug={orgslug} />
      </div>
    </div>
  )
}
