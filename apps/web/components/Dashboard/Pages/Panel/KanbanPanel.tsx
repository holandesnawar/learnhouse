'use client'

/**
 * Matrículas en kanban: en qué punto está cada persona que pidió plaza, llegó
 * al pago o pidió una llamada. Nuevo → Contactado → En revisión → Propuesta →
 * Alumno, y Perdido aparte.
 *
 * Se arrastra la tarjeta de una columna a otra (ordenador) o se abre y se elige
 * la columna (móvil). "Alumno" no se arrastra: sale sola al pagar.
 * La lógica de qué va en cada columna vive en el servidor
 * (`apps/api/src/services/panel/pipeline.py`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  CANALES,
  getTablero,
  haceCuanto,
  moverTarjeta,
  NOMBRE_CANAL,
  type EtapaTablero,
  type Tablero,
  type Tarjeta,
} from '@services/panel/panel'
import FichaCliente from './FichaCliente'
import { quitarPersona } from './quitarPersona'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { CheckSquare, Eye, Loader2, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const COLOR: Record<EtapaTablero, string> = {
  nuevo: '#4da3ff',
  contactado: '#025dc7',
  revision: '#E4B252',
  propuesta: '#1D0084',
  alumno: '#0E9F6E',
  perdido: '#9CA3AF',
}

const QUE_ES: Record<EtapaTablero, string> = {
  nuevo: 'Todavía nadie le ha escrito',
  contactado: 'Ya le hemos escrito o llamado',
  revision: 'Lo está pensando o falta un dato',
  propuesta: 'Tiene el precio o el enlace de pago',
  alumno: 'Ha pagado',
  perdido: 'No sigue, por ahora',
}

function TarjetaVista({ t, onAbrir, onBorrar }: { t: Tarjeta; onAbrir: () => void; onBorrar?: () => void }) {
  return (
    <div className="group relative">
    {onBorrar ? (
      // Solo administradores. Siempre a la vista: escondida hasta pasar el ratón
      // no se veía (ya pasó con los botones de borrar de Contactos).
      <button
        onClick={onBorrar}
        aria-label={t.etapa === 'alumno' ? 'Quitar de los números' : 'Borrar matrícula'}
        title={t.etapa === 'alumno' ? 'Quitar de los números' : 'Borrar matrícula'}
        className="absolute right-1.5 top-1.5 z-10 p-1.5 rounded-md text-[#B9C6DC] hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    ) : null}
    <button
      onClick={onAbrir}
      className="w-full text-left rounded-xl bg-white border border-[#E6EBF5] hover:border-[#4da3ff] shadow-[0_1px_2px_rgba(16,24,40,0.04)] px-3 py-2.5 transition-colors"
    >
      <p className="text-[13.5px] font-semibold text-gray-900 truncate pr-6">{t.nombre || t.email}</p>
      <p className="text-[11.5px] text-[#5A6480] truncate">{t.que_hizo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {t.canal ? (
          <span className="rounded-full bg-[#EAF3FF] text-[#025dc7] px-2 py-0.5 text-[10.5px] font-semibold">{NOMBRE_CANAL[t.canal]}</span>
        ) : null}
        {t.vio_precio ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E8FBF3] text-[#0E9F6E] px-2 py-0.5 text-[10.5px] font-semibold">
            <Eye size={10} /> precio
          </span>
        ) : null}
        {t.tareas ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFFBF2] text-[#8A6A2A] px-2 py-0.5 text-[10.5px] font-semibold">
            <CheckSquare size={10} /> {t.tareas}
          </span>
        ) : null}
        <span className="ml-auto text-[10.5px] text-[#8A96AB]">{haceCuanto(t.desde)}</span>
      </div>
    </button>
    </div>
  )
}

export default function KanbanPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Tablero | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [canal, setCanal] = useState<string>('')
  const [abierta, setAbierta] = useState<string | null>(null)
  // En el móvil se ve una columna cada vez.
  const [columnaMovil, setColumnaMovil] = useState<EtapaTablero>('nuevo')
  const { isAdmin } = useAdminStatus()

  async function borrar(t: Tarjeta) {
    const r = await quitarPersona(org?.id, accessToken, { email: t.email, nombre: t.nombre, esAlumno: t.etapa === 'alumno', fuera: t.fuera_de_metricas })
    if (r) cargar()
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getTablero(org.id, accessToken)
    if (r.ok && r.datos) setDatos(r.datos)
    else setError(r.error || 'No se ha podido cargar el tablero')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (datos?.tarjetas ?? []).filter(
      (c) =>
        (!canal || c.canal === canal) &&
        (!t || c.email.includes(t) || c.nombre.toLowerCase().includes(t) || c.telefono.includes(t))
    )
  }, [datos, q, canal])

  const porColumna = useMemo(() => {
    const m: Record<string, Tarjeta[]> = {}
    for (const e of datos?.etapas ?? []) m[e.id] = []
    for (const c of filtradas) (m[c.etapa] ??= []).push(c)
    // Lo que lleva más tiempo parado, arriba: es lo que se enfría.
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.desde || '').localeCompare(b.desde || ''))
    return m
  }, [datos, filtradas])

  async function alSoltar(r: DropResult) {
    if (!r.destination || !datos) return
    const destino = r.destination.droppableId as EtapaTablero
    const email = r.draggableId
    const tarjeta = datos.tarjetas.find((t) => t.email === email)
    if (!tarjeta || tarjeta.etapa === destino) return
    if (destino === 'alumno' || tarjeta.etapa === 'alumno') {
      toast('La columna Alumno se llena sola cuando alguien paga.')
      return
    }
    // Se mueve ya en pantalla y, si el servidor dice que no, se deshace.
    const antes = datos
    setDatos({
      ...datos,
      tarjetas: datos.tarjetas.map((t) => (t.email === email ? { ...t, etapa: destino, desde: new Date().toISOString() } : t)),
    })
    const res = await moverTarjeta(org?.id, { email, etapa: destino }, accessToken)
    if (!res.ok) {
      setDatos(antes)
      toast.error(res.error || 'No se ha podido mover')
    }
  }

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={24} />}
      </div>
    )
  }

  const total = filtradas.length
  const abiertos = filtradas.filter((c) => c.etapa !== 'alumno' && c.etapa !== 'perdido').length

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#5A6480] leading-relaxed max-w-3xl">
        Cada persona que pidió plaza, llegó al pago o pidió una llamada, en el punto en el que está. Ábrela para ver todo de
        esa persona y cambiarla de columna<span className="hidden lg:inline"> (o arrástrala)</span>. Arriba de cada columna, lo
        que lleva más tiempo parado.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96AB]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            className="w-full bg-white border border-[#DDE6F5] rounded-lg pl-9 pr-3 py-2 text-[13.5px] text-gray-900 outline-none focus:border-[#4da3ff]"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setCanal('')}
            className={`shrink-0 px-3 py-2 rounded-lg text-[12.5px] font-semibold ${!canal ? 'bg-[#1D0084] text-white' : 'bg-white border border-[#DDE6F5] text-[#5A6480]'}`}
          >
            Todos los canales
          </button>
          {CANALES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCanal(canal === c.id ? '' : c.id)}
              className={`shrink-0 px-3 py-2 rounded-lg text-[12.5px] font-semibold ${canal === c.id ? 'bg-[#1D0084] text-white' : 'bg-white border border-[#DDE6F5] text-[#5A6480]'}`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-[#8A96AB]">
        {total} {total === 1 ? 'persona' : 'personas'} · {abiertos} en curso
      </p>

      {/* Móvil: una columna cada vez, con pestañas */}
      <div className="lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {datos.etapas.map((e) => (
            <button
              key={e.id}
              onClick={() => setColumnaMovil(e.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${
                columnaMovil === e.id ? 'bg-[#1D0084] text-white' : 'bg-white border border-[#DDE6F5] text-[#5A6480]'
              }`}
            >
              {e.nombre} <span className="opacity-70">{porColumna[e.id]?.length ?? 0}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[#8A96AB] mt-2">{QUE_ES[columnaMovil]}. Ábrela para cambiarla de columna.</p>
        <div className="mt-2 space-y-2">
          {(porColumna[columnaMovil] ?? []).map((t) => (
            <TarjetaVista key={t.email} t={t} onAbrir={() => setAbierta(t.email)} onBorrar={isAdmin ? () => borrar(t) : undefined} />
          ))}
          {!porColumna[columnaMovil]?.length ? <p className="text-[13px] text-[#8A96AB] py-6 text-center">Nadie en esta columna.</p> : null}
        </div>
      </div>

      {/* Ordenador: el tablero entero */}
      <div className="hidden lg:block overflow-x-auto pb-2">
        <DragDropContext onDragEnd={alSoltar}>
          <div className="grid grid-flow-col auto-cols-[minmax(188px,1fr)] gap-2.5 min-w-[1180px]">
            {datos.etapas.map((e) => (
              <Droppable droppableId={e.id} key={e.id} isDropDisabled={e.id === 'alumno'}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={`rounded-2xl p-2.5 min-h-[420px] transition-colors ${snap.isDraggingOver ? 'bg-[#EAF3FF]' : 'bg-[#EEF2F9]'}`}
                  >
                    <div className="px-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR[e.id] }} />
                        <p className="text-[13px] font-bold text-gray-900">{e.nombre}</p>
                        <span className="ml-auto text-[12px] font-semibold text-[#5A6480] tabular-nums">{porColumna[e.id]?.length ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-[#8A96AB] mt-0.5">{QUE_ES[e.id]}</p>
                    </div>
                    <div className="space-y-2">
                      {(porColumna[e.id] ?? []).map((t, i) => (
                        <Draggable draggableId={t.email} index={i} key={t.email} isDragDisabled={t.etapa === 'alumno'}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <TarjetaVista t={t} onAbrir={() => setAbierta(t.email)} onBorrar={isAdmin ? () => borrar(t) : undefined} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} onCambio={cargar} /> : null}
    </div>
  )
}
