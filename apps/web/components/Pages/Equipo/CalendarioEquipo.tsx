'use client'
/**
 * El calendario de la sala de profes (10/11/2026, "un calendario para que los
 * profes vean las clases siguientes… con quién da cada una"). Las semanas ya
 * creadas de las próximas 6 semanas, por semana y por día, con la hora, la
 * clase, el tema, quién la da (la semana o el «La da» de la clase) y si la
 * presentación está subida. Lo de quien mira, marcado con «Tú».
 *
 * Tocar una clase abre «Preparar la clase»: el administrador pone ahí quién la
 * da ESA semana; el «La da» de toda la clase se cambia en Organizar clases.
 * Las clases sin ninguna semana por delante salen abajo: no se pueden poner en
 * el calendario hasta que se crea la semana.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { esDe } from '@/lib/nawar/clasesProfes'
import { colorPersona, iniciales } from '@/lib/nawar/semanasTrabajo'
import { agendaEquipo, diaLegible, estadoDeClase, porSemanasDeAgenda, sinSemanaPorDelante, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import FichaClase from './FichaClase'
import NuevaClase from './NuevaClase'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'

function Profe({ nombre, tu }: { nombre: string; tu: boolean }) {
  if (!nombre) return <span className="text-[13px] text-[#8A6A2A]">Sin profe</span>
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        className="shrink-0 w-6 h-6 rounded-full text-white text-[10.5px] font-semibold flex items-center justify-center"
        style={{ background: colorPersona(nombre) }}
      >
        {iniciales(nombre)}
      </span>
      <span className="text-[13.5px] font-semibold text-[#0B1033] truncate">{nombre}</span>
      {tu ? <span className="shrink-0 rounded-md bg-[#0b2da0] px-1.5 py-0.5 text-[11px] font-semibold text-white">Tú</span> : null}
    </span>
  )
}

export default function CalendarioEquipo({
  clases,
  semanas,
  hoy,
  ruta,
  miNombre,
  admin,
  monitor,
  token,
  recargar,
  nombres = [],
}: {
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[] | null
  hoy: string
  ruta: (p: string) => string
  miNombre: string
  admin: boolean
  monitor: boolean
  token: string
  recargar: () => void
  /** Los nombres de pila del equipo, para proponer quién da cada clase. */
  nombres?: string[]
}) {
  const [soloMias, setSoloMias] = useState(false)
  // La ficha abierta (por su clave: así sigue al día cuando se recarga).
  const [ficha, setFicha] = useState('')
  const [nueva, setNueva] = useState<{ uuid?: string; fecha?: string } | null>(null)
  if (semanas === null) return <p className="text-[14px] text-[#6B7393]">Cargando el calendario…</p>

  const agenda = agendaEquipo(clases, semanas, hoy, (p) => esDe(p, miNombre), 42)
  const mias = agenda.filter((a) => a.mia).length
  const visibles = soloMias ? agenda.filter((a) => a.mia) : agenda
  const grupos = porSemanasDeAgenda(visibles, hoy)
  const sinSemana = sinSemanaPorDelante(clases, semanas, hoy)
  const abierta: SemanaEquipo | null = (ficha && semanas.find((x) => x.key === ficha)) || null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {!admin && !monitor && mias ? (
          <div className="flex gap-1.5">
            {[
              [false, `Todas · ${agenda.length}`],
              [true, `Las mías · ${mias}`],
            ].map(([v, t]) => (
              <button
                key={String(v)}
                onClick={() => setSoloMias(v as boolean)}
                className={`h-8 px-3 rounded-full text-[13px] font-semibold border ${
                  soloMias === v ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3EF] text-[#3B4262]'
                }`}
              >
                {t as string}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-[13px] text-[#5B6382]">
          {admin ? 'Crea aquí cada clase y di quién la da. Toca una clase para meterle el tema y el documento.' : 'Toca una clase para ver su ficha.'}
          {admin ? (
            <>
              {' '}
              Quien da siempre una clase se pone en{' '}
              <Link href={ruta('/organizar')} className="font-semibold text-[#0b2da0] hover:underline">
                Organizar clases
              </Link>
              .
            </>
          ) : null}
        </p>
        {clases.length ? (
          <button
            onClick={() => setNueva({})}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold hover:bg-[#0a2690]"
          >
            <Plus size={15} /> Nueva clase
          </button>
        ) : null}
      </div>

      {grupos.length ? (
        grupos.map((g) => {
          const dias: Record<string, typeof g.items> = {}
          for (const it of g.items) (dias[it.semana.fecha] = dias[it.semana.fecha] || []).push(it)
          return (
            <section key={g.clave}>
              <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <h2 className="text-[17px] font-bold text-[#0B1033]" style={POPPINS}>
                  {g.titulo}
                </h2>
                <button onClick={() => setNueva({ fecha: g.clave < hoy ? hoy : g.clave })} className="text-[13px] font-semibold text-[#0b2da0] hover:underline">
                  + Añadir clase
                </button>
              </div>
              <div className={`${TARJETA} overflow-hidden`}>
                {Object.keys(dias)
                  .sort()
                  .map((dia, i) => (
                    <div key={dia} className={`flex flex-col sm:flex-row ${i ? 'border-t border-[#EEF1F7]' : ''}`}>
                      <div className="sm:w-[132px] shrink-0 px-4 sm:px-5 pt-3 sm:py-3.5">
                        <p className="text-[13.5px] font-semibold text-[#0B1033] first-letter:uppercase">{diaLegible(dia)}</p>
                        {dia === hoy ? <p className="text-[12px] font-semibold text-[#0b2da0]">Hoy</p> : null}
                      </div>
                      <ul className="flex-1 min-w-0">
                        {dias[dia].map((a) => {
                          const s = a.semana
                          const est = estadoDeClase(s, hoy, clases.find((c) => c.uuid === s.courseUuid)?.profe || '')
                          const bien = est.estado === 'lista' || (est.estado === 'hoy' && !est.faltan.length)
                          return (
                            <li key={s.key}>
                              <button
                                onClick={() => setFicha(s.key)}
                                className={`w-full grid grid-cols-[52px_1fr] sm:grid-cols-[52px_1fr_190px_170px] items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3 text-left hover:bg-[#F8FAFE] ${
                                  a.mia ? 'bg-[#F5F8FF]' : ''
                                }`}
                              >
                                <span className="text-[14px] font-semibold text-[#0B1033] tabular-nums">{a.hora || '—'}</span>
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5 text-[12.5px] text-[#5B6382] truncate">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                                    {s.curso}
                                  </span>
                                  <span className={`block text-[14.5px] font-semibold truncate ${s.tema ? 'text-[#0B1033]' : 'text-[#8A91AD]'}`}>{s.tema || 'Sin tema todavía'}</span>
                                </span>
                                <span className="col-start-2 sm:col-start-auto min-w-0">
                                  <Profe nombre={a.profe} tu={a.mia} />
                                </span>
                                <span className={`col-start-2 sm:col-start-auto inline-flex items-center gap-1 text-[12.5px] ${bien ? 'text-[#3B4262]' : 'text-[#8A6A2A]'}`}>
                                  {bien ? <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> : null}
                                  <span className="truncate">{bien ? 'Lista' : `Falta ${est.faltan.join(', ')}`}</span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          )
        })
      ) : (
        <div className={`${TARJETA} px-5 py-6 text-[14.5px] text-[#3B4262]`}>
          {soloMias ? 'No tienes clases en las próximas semanas.' : 'No hay clases creadas en las próximas semanas. Pulsa «Nueva clase» para poner la primera.'}
        </div>
      )}

      {sinSemana.length ? (
        <section className="rounded-2xl border border-dashed border-[#D5DEEE] px-5 py-4">
          <p className="text-[14px] font-semibold text-[#0B1033]">Sin ninguna clase por delante</p>
          <p className="mt-0.5 text-[13px] text-[#5B6382]">Toca una para crear su próxima clase.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sinSemana.map((c) => (
              <button
                key={c.uuid}
                onClick={() => setNueva({ uuid: c.uuid })}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[#DDE3EF] text-[13px] font-semibold text-[#3B4262] hover:border-[#0b2da0]"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                {c.nombre}
                {c.profe ? <span className="font-normal text-[#6B7393]">· {c.profe}</span> : null}
                <Plus size={13} className="text-[#0b2da0]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {abierta ? (
        <FichaClase
          semana={abierta}
          clase={clases.find((c) => c.uuid === abierta.courseUuid)}
          hoy={hoy}
          ruta={ruta}
          admin={admin}
          nombres={nombres}
          token={token}
          onCerrar={() => setFicha('')}
          onCambio={recargar}
        />
      ) : null}
      {nueva ? (
        <NuevaClase
          clases={clases}
          semanas={semanas}
          hoy={hoy}
          admin={admin}
          nombres={nombres}
          token={token}
          preset={nueva}
          onCerrar={() => setNueva(null)}
          onCreada={(creadas) => {
            setNueva(null)
            recargar()
            // Con una sola clase creada, se abre su ficha para meterle el documento.
            if (creadas.length === 1) setFicha(`${creadas[0].course_uuid}-${creadas[0].semana_id}`)
          }}
        />
      ) : null}
    </div>
  )
}
