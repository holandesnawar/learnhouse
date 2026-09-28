'use client'

/**
 * Tareas del equipo: lo que hay que hacer, para quién y para cuándo. Se crean
 * para uno mismo o para otro del equipo, y pueden ir colgadas de una persona
 * (se abre su ficha desde la tarea).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getTareas, type Tarea } from '@services/panel/panel'
import { hoyISO } from '@services/stats/contactos'
import FichaCliente from './FichaCliente'
import { FilaTarea, TareaForm, useEquipo } from './Tareas'
import { Loader2 } from 'lucide-react'

type Vista = 'mias' | 'equipo' | 'hechas'

function Grupo({ titulo, tareas, children, tono }: { titulo: string; tareas: Tarea[]; children: React.ReactNode; tono?: 'rojo' }) {
  if (!tareas.length) return null
  return (
    <section className="rounded-2xl border border-[#DDE6F5] bg-white px-4 py-2">
      <p className={`text-[12px] font-semibold uppercase tracking-[0.08em] pt-2 ${tono === 'rojo' ? 'text-red-700' : 'text-[#8A96AB]'}`}>
        {titulo} · {tareas.length}
      </p>
      <div className="divide-y divide-[#EEF2F9]">{children}</div>
    </section>
  )
}

export default function TareasPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const equipo = useEquipo()
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [yo, setYo] = useState<number>(0)
  const [vista, setVista] = useState<Vista>('mias')
  const [persona, setPersona] = useState<number>(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getTareas(org.id, accessToken)
    if (r.ok && r.datos) {
      setTareas(r.datos.tareas)
      setEsAdmin(r.datos.es_admin)
      setYo(r.datos.yo)
    }
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const todas = tareas ?? []
    if (vista === 'hechas') return todas.filter((t) => t.estado === 'hecha')
    const pend = todas.filter((t) => t.estado !== 'hecha')
    if (vista === 'mias') return pend.filter((t) => t.asignado_id === yo)
    return persona ? pend.filter((t) => t.asignado_id === persona) : pend
  }, [tareas, vista, yo, persona])

  const hoy = hoyISO()
  const vencidas = visibles.filter((t) => t.estado !== 'hecha' && t.fecha && t.fecha < hoy)
  const deHoy = visibles.filter((t) => t.estado !== 'hecha' && t.fecha === hoy)
  const proximas = visibles.filter((t) => t.estado !== 'hecha' && t.fecha && t.fecha > hoy)
  const sinFecha = visibles.filter((t) => t.estado !== 'hecha' && !t.fecha)

  function cambio(t: Tarea) {
    setTareas((ts) => {
      const lista = ts ?? []
      return lista.some((x) => x.id === t.id) ? lista.map((x) => (x.id === t.id ? t : x)) : [t, ...lista]
    })
  }
  const fila = (t: Tarea) => (
    <FilaTarea
      key={t.id}
      tarea={t}
      onCambio={cambio}
      onBorrada={(id) => setTareas((ts) => (ts ?? []).filter((x) => x.id !== id))}
      onAbrirPersona={setAbierta}
    />
  )

  const mias = (tareas ?? []).filter((t) => t.estado !== 'hecha' && t.asignado_id === yo).length

  return (
    <div className="space-y-4 max-w-4xl">
      <TareaForm onCreada={cambio} />

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['mias', `Mis tareas${mias ? ` · ${mias}` : ''}`],
            ['equipo', esAdmin ? 'Todo el equipo' : 'Las que he mandado'],
            ['hechas', 'Hechas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${vista === id ? 'bg-[#1D0084] text-white' : 'bg-white border border-[#DDE6F5] text-[#5A6480]'}`}
          >
            {label}
          </button>
        ))}
        {vista === 'equipo' && esAdmin ? (
          <select
            value={persona}
            onChange={(e) => setPersona(Number(e.target.value))}
            className="ml-auto bg-white border border-[#DDE6F5] rounded-lg px-2.5 py-1.5 text-[12.5px] text-gray-800"
          >
            <option value={0}>Todos</option>
            {(equipo?.equipo ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {!tareas ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={22} />
        </div>
      ) : !visibles.length ? (
        <p className="text-[13.5px] text-[#8A96AB] py-10 text-center">
          {vista === 'hechas' ? 'Todavía no hay tareas hechas.' : 'Nada pendiente por aquí.'}
        </p>
      ) : vista === 'hechas' ? (
        <Grupo titulo="Hechas" tareas={visibles}>
          {visibles.map(fila)}
        </Grupo>
      ) : (
        <div className="space-y-3">
          <Grupo titulo="Vencidas" tareas={vencidas} tono="rojo">
            {vencidas.map(fila)}
          </Grupo>
          <Grupo titulo="Hoy" tareas={deHoy}>
            {deHoy.map(fila)}
          </Grupo>
          <Grupo titulo="Próximas" tareas={proximas}>
            {proximas.map(fila)}
          </Grupo>
          <Grupo titulo="Sin fecha" tareas={sinFecha}>
            {sinFecha.map(fila)}
          </Grupo>
        </div>
      )}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} onCambio={cargar} /> : null}
    </div>
  )
}
