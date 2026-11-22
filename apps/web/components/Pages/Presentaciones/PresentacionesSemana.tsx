'use client'
/**
 * Las presentaciones de una semana, EN la página de la clase, para el equipo
 * (22/11/2026).
 *
 * Usuario: «no hay ninguna correlación entre lo que se ve en la semana vs lo
 * que se ve en la pizarra y salas». Aquí va la MISMA lista que en la ficha de
 * la clase y dentro de la pizarra (`ListaPresentaciones`): cuál abre la
 * pizarra, cuál tiene notas y qué ven los alumnos. Y, si la clase ya se dio y
 * lo escrito en la pizarra no se guardó para los alumnos (su caso: «se quedó
 * en pizarra sin guardar»), se dice arriba con el botón para guardarlo.
 *
 * Los datos ya vienen con la semana (`material_profe.pizarra`, PZ.lista en
 * apps/api/src/services/tareas/pizarra.py): sin llamadas nuevas.
 */
import React, { useMemo } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ListaPresentaciones from './ListaPresentaciones'
import { queVenLosAlumnos, sinGuardarParaAlumnos } from '@/lib/nawar/presentaciones'
import type { ListaPresentaciones as Lista } from '@services/pizarra/pizarra'
import type { Semana } from '@services/tareas/tareas'

export default function PresentacionesSemana({
  semana,
  hoy,
  ruta,
  onCambio,
  palabra = (t) => t,
}: {
  semana: Semana
  hoy: string
  /** La dirección dentro de la escuela (con la organización). */
  ruta: (p: string) => string
  onCambio: () => void
  /** «clase» o «sesión» (Spreek Club). */
  palabra?: (t: string) => string
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const pz = semana.material_profe?.pizarra
  const inicial = useMemo<Lista | null>(
    () => (pz && Array.isArray(pz.presentaciones) ? { presentaciones: pz.presentaciones, sueltas: pz.sueltas || [], fuente: pz.fuente || '', publicada: pz.publicada || null } : null),
    [pz]
  )
  const pendiente = inicial ? sinGuardarParaAlumnos(inicial, semana.fecha, hoy) : null
  const pizarra = (extra = '') => ruta(`/pizarra/${semana.id}${extra}`)

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14.5px] font-semibold text-gray-900">Presentaciones</p>
        <Link href={ruta(`/equipo?vista=presentaciones&ficha=${semana.id}`)} prefetch={false} className="text-[13px] font-semibold text-[#0b2da0] hover:underline">
          Todas las opciones
        </Link>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B7280]">
        {palabra('Lo mismo que se ve en la pizarra y en la ficha de la clase.')}
        {inicial ? <> Los alumnos ven ahora: {queVenLosAlumnos(inicial, semana.fecha, hoy)}.</> : null}
      </p>

      {pendiente ? (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[#F0E3C4] bg-[#FFFBF2] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#6B5320]">
            <span className="font-semibold text-[#3F3110]">Lo escrito en la pizarra no está guardado para los alumnos.</span>{' '}
            {inicial?.publicada ? 'Se escribió después de guardar: ven la versión de antes.' : palabra('Está en «' + pendiente.nombre + '»: los alumnos de esta clase aún no lo ven en su semana.')}
          </p>
          <a
            href={pizarra(`?fuente=${encodeURIComponent(pendiente.id)}&guardar=1`)}
            className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0a2690]"
          >
            Guardar para los alumnos
          </a>
        </div>
      ) : null}

      <div className="mt-2">
        <ListaPresentaciones compacta semanaId={semana.id} token={token} chapterId={semana.chapter_id} inicial={inicial} onCambio={(_l, que) => que === 'cambio' && onCambio()} />
      </div>
    </div>
  )
}
