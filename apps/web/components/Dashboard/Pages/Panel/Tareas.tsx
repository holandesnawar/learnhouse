'use client'

/**
 * Piezas de tareas compartidas: el formulario para crear una y la fila de la
 * lista. Las usan la página Tareas, la ficha del cliente y el inicio del panel.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  borrarTarea,
  cambiarTarea,
  crearTarea,
  fechaCorta,
  getEquipo,
  type MiembroEquipo,
  type Tarea,
} from '@services/panel/panel'
import { hoyISO } from '@services/stats/contactos'
import { Check, Flag, Loader2, Plus, Trash2, User } from 'lucide-react'
import toast from 'react-hot-toast'

const INPUT =
  'w-full bg-[#F0F5FF] rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff]'

let equipoCache: { equipo: MiembroEquipo[]; yo: number } | null = null

export function useEquipo() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState(equipoCache)
  useEffect(() => {
    if (equipoCache || !org?.id || !accessToken) return
    getEquipo(org.id, accessToken).then((r) => {
      if (r.ok && r.datos) {
        equipoCache = r.datos
        setDatos(r.datos)
      }
    })
  }, [org?.id, accessToken])
  return datos
}

/** "hoy", "mañana", "vencida", o la fecha. */
export function etiquetaFecha(fecha: string): { texto: string; tono: 'rojo' | 'azul' | 'gris' } | null {
  if (!fecha) return null
  const hoy = hoyISO()
  if (fecha < hoy) return { texto: `Vencida · ${fechaCorta(fecha)}`, tono: 'rojo' }
  if (fecha === hoy) return { texto: 'Hoy', tono: 'rojo' }
  if (fecha === hoyISO(1)) return { texto: 'Mañana', tono: 'azul' }
  return { texto: fechaCorta(fecha), tono: 'gris' }
}

export function TareaForm({
  email,
  onCreada,
  compacto = false,
}: {
  email?: string
  onCreada: (t: Tarea) => void
  compacto?: boolean
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const equipo = useEquipo()
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [para, setPara] = useState<number>(0)
  const [alta, setAlta] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!titulo.trim()) return
    setGuardando(true)
    const r = await crearTarea(
      org?.id,
      { titulo, fecha, asignado_id: para || equipo?.yo, prioridad: alta ? 'alta' : 'normal', email: email || '' },
      accessToken
    )
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido crear')
      return
    }
    setTitulo('')
    setFecha('')
    setAlta(false)
    onCreada(r.datos.tarea)
  }

  return (
    <div className={compacto ? 'space-y-2' : 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-4 space-y-2'}>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        placeholder={email ? 'Nueva tarea con esta persona: «Mandarle el enlace de pago»' : 'Nueva tarea: «Llamar a Laura», «Subir el vídeo del módulo 5»'}
        className={INPUT}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${INPUT} !w-auto`} aria-label="Fecha" />
        <div className="flex gap-1">
          {[
            ['Hoy', hoyISO()],
            ['Mañana', hoyISO(1)],
          ].map(([l, f]) => (
            <button
              key={l}
              type="button"
              onClick={() => setFecha(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold ${fecha === f ? 'bg-[#1D0084] text-white' : 'bg-[#F0F5FF] text-[#025dc7]'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={para || equipo?.yo || 0}
          onChange={(e) => setPara(Number(e.target.value))}
          className={`${INPUT} !w-auto`}
          aria-label="Para quién"
        >
          {(equipo?.equipo ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === equipo?.yo ? `Para mí (${m.nombre})` : `${m.nombre}${m.rol ? ` · ${m.rol}` : ''}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAlta((a) => !a)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold ${alta ? 'bg-red-50 text-red-700' : 'bg-[#F0F5FF] text-[#5A6480]'}`}
        >
          <Flag size={12} /> Importante
        </button>
        <button
          onClick={guardar}
          disabled={guardando || !titulo.trim()}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[13px] font-bold disabled:opacity-40"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir
        </button>
      </div>
    </div>
  )
}

export function FilaTarea({
  tarea,
  onCambio,
  onBorrada,
  onAbrirPersona,
  nombrePersona,
}: {
  tarea: Tarea
  onCambio: (t: Tarea) => void
  onBorrada: (id: number) => void
  onAbrirPersona?: (email: string) => void
  nombrePersona?: string
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const hecha = tarea.estado === 'hecha'
  const f = etiquetaFecha(tarea.fecha)

  async function alternar() {
    const r = await cambiarTarea(org?.id, tarea.id, { estado: hecha ? 'pendiente' : 'hecha' }, accessToken)
    if (r.ok && r.datos) onCambio(r.datos.tarea)
    else toast.error(r.error || 'No se ha podido cambiar')
  }
  async function quitar() {
    if (!window.confirm('¿Borrar esta tarea?')) return
    const r = await borrarTarea(org?.id, tarea.id, accessToken)
    if (r.ok) onBorrada(tarea.id)
    else toast.error(r.error || 'No se ha podido borrar')
  }

  return (
    <div className={`flex items-start gap-3 py-2.5 ${hecha ? 'opacity-55' : ''}`}>
      <button
        onClick={alternar}
        aria-label={hecha ? 'Marcar pendiente' : 'Marcar hecha'}
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
          hecha ? 'bg-[#0E9F6E] border-[#0E9F6E]' : 'border-[#B9C6DC] hover:border-[#025dc7]'
        }`}
      >
        {hecha ? <Check size={12} className="text-white" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] text-gray-900 leading-snug ${hecha ? 'line-through' : ''}`}>
          {tarea.prioridad === 'alta' && !hecha ? <Flag size={12} className="inline text-red-600 mr-1 -mt-0.5" /> : null}
          {tarea.titulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#5A6480]">
          {f && !hecha ? (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                f.tono === 'rojo' ? 'bg-red-50 text-red-700' : f.tono === 'azul' ? 'bg-[#EAF3FF] text-[#025dc7]' : 'bg-[#F3F4F6] text-[#5A6480]'
              }`}
            >
              {f.texto}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <User size={11} /> {tarea.asignado || 'Sin asignar'}
          </span>
          {tarea.email ? (
            onAbrirPersona ? (
              <button onClick={() => onAbrirPersona(tarea.email)} className="text-[#025dc7] font-semibold hover:underline truncate max-w-[220px]">
                {nombrePersona || tarea.email}
              </button>
            ) : (
              <span className="truncate max-w-[220px]">{nombrePersona || tarea.email}</span>
            )
          ) : null}
          {tarea.creado_por && tarea.creado_por !== tarea.asignado ? <span>· de {tarea.creado_por}</span> : null}
        </div>
      </div>
      <button onClick={quitar} aria-label="Borrar tarea" className="shrink-0 mt-0.5 text-[#B9C6DC] hover:text-red-600">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
