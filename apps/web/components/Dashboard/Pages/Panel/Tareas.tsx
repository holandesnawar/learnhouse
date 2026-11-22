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
  type BalanceTareas,
  type MiembroEquipo,
  type Tarea,
} from '@services/panel/panel'
import { consejoBalance, siguienteTipo, textoBalance, TIPOS_TAREA, type TipoTarea } from '@lib/nawar/flotarMover'
import { hoyISO } from '@services/stats/contactos'
import { Check, Flag, Loader2, Plus, Trash2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'

const INPUT =
  'w-full bg-white rounded-md px-3 py-2 text-[13.5px] text-gray-900 placeholder:text-gray-400 border border-[#D1D5DB] outline-none focus:border-gray-900'

/** Colores de las etiquetas: azul de la marca suave y verde suave. */
export const COLOR_TIPO: Record<'flotar' | 'mover', { fondo: string; texto: string; barra: string }> = {
  flotar: { fondo: '#EAF0FE', texto: '#0b2da0', barra: '#7DA2F0' },
  mover: { fondo: '#E6F6EE', texto: '#0E7A4F', barra: '#5DC596' },
}

export function EtiquetaTipo({ tipo, onClick, title }: { tipo?: TipoTarea; onClick?: () => void; title?: string }) {
  const clase = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none'
  const contenido = tipo ? (
    <span className={clase} style={{ background: COLOR_TIPO[tipo].fondo, color: COLOR_TIPO[tipo].texto }}>
      {tipo === 'flotar' ? 'Flotar' : 'Mover'}
    </span>
  ) : (
    <span className={`${clase} border border-dashed border-[#C4CAD3] text-[#9CA3AF]`}>Flotar / Mover</span>
  )
  if (!onClick) return contenido
  return (
    <button type="button" onClick={onClick} title={title} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
      {contenido}
    </button>
  )
}

/** Dos botones para elegir el tipo (o ninguno, tocando el elegido otra vez). */
export function ElegirTipo({ tipo, onChange }: { tipo: TipoTarea; onChange: (t: TipoTarea) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5" role="group" aria-label="Tipo de tarea">
      {TIPOS_TAREA.map((t) => {
        const activo = tipo === t.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.ayuda}
            onClick={() => onChange(activo ? '' : t.id)}
            className="px-2.5 py-1 rounded-md text-[12px] font-semibold"
            style={activo ? { background: COLOR_TIPO[t.id].fondo, color: COLOR_TIPO[t.id].texto } : { color: '#6B7280' }}
          >
            {t.nombre}
          </button>
        )
      })}
    </div>
  )
}

/**
 * El medidor de la semana: cuántas tareas de cada tipo has terminado desde el
 * lunes (las tuyas), con una barra partida, y lo que te queda pendiente.
 */
export function MedidorSemana({ balance, compacto = false }: { balance?: BalanceTareas | null; compacto?: boolean }) {
  if (!balance) return null
  const total = balance.hechas.flotar + balance.hechas.mover
  const consejo = consejoBalance(balance)
  return (
    <div className={compacto ? 'space-y-1.5' : 'rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 space-y-2'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13.5px] font-semibold text-gray-900">{textoBalance(balance)}</p>
        <p className="text-[12px] text-[#6B7280]">
          Pendientes: {balance.pendientes.flotar} flotar · {balance.pendientes.mover} mover
          {balance.pendientes.sin ? ` · ${balance.pendientes.sin} sin tipo` : ''}
        </p>
      </div>
      <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-[#F1F3F7]" aria-hidden>
        {total ? (
          <>
            <span style={{ width: `${balance.flotar_pct}%`, background: COLOR_TIPO.flotar.barra }} />
            <span style={{ width: `${balance.mover_pct}%`, background: COLOR_TIPO.mover.barra }} />
          </>
        ) : null}
        <span className="absolute left-1/2 top-0 h-full w-px bg-white" />
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-[#6B7280]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: COLOR_TIPO.flotar.barra }} /> Flotar
        </span>
        {compacto ? null : consejo ? <span className="hidden sm:inline">{consejo}</span> : <span>La raya del centro es el 50/50</span>}
        <span className="inline-flex items-center gap-1.5">
          Mover <span className="w-2 h-2 rounded-full" style={{ background: COLOR_TIPO.mover.barra }} />
        </span>
      </div>
      {compacto && consejo ? <p className="text-[11.5px] text-[#6B7280]">{consejo}</p> : null}
    </div>
  )
}

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
  const [tipo, setTipo] = useState<TipoTarea>('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!titulo.trim()) return
    setGuardando(true)
    const r = await crearTarea(
      org?.id,
      { titulo, fecha, asignado_id: para || equipo?.yo, prioridad: alta ? 'alta' : 'normal', email: email || '', tipo },
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
    setTipo('')
    onCreada(r.datos.tarea)
  }

  return (
    <div className={compacto ? 'space-y-2' : 'rounded-lg border border-[#E5E7EB] bg-white p-3.5 sm:p-4 space-y-2'}>
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
              className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold ${fecha === f ? 'bg-gray-900 text-white' : 'border border-[#E5E7EB] bg-white text-gray-800'}`}
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
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold ${alta ? 'text-red-600' : 'border border-[#E5E7EB] bg-white text-gray-600'}`}
        >
          <Flag size={12} /> Importante
        </button>
        <ElegirTipo tipo={tipo} onChange={setTipo} />
        <button
          onClick={guardar}
          disabled={guardando || !titulo.trim()}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#025dc7] hover:bg-[#014fa9] text-white text-[13px] font-bold disabled:opacity-40"
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
  async function cambiarTipo() {
    const r = await cambiarTarea(org?.id, tarea.id, { tipo: siguienteTipo(tarea.tipo) }, accessToken)
    if (r.ok && r.datos) onCambio(r.datos.tarea)
    else toast.error(r.error || 'No se ha podido cambiar')
  }
  async function quitar() {
    if (!(await confirmar('¿Borrar esta tarea?'))) return
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
          hecha ? 'bg-[#0E9F6E] border-[#0E9F6E]' : 'border-[#9CA3AF] hover:border-[#025dc7]'
        }`}
      >
        {hecha ? <Check size={12} className="text-white" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] text-gray-900 leading-snug ${hecha ? 'line-through' : ''}`}>
          {tarea.prioridad === 'alta' && !hecha ? <Flag size={12} className="inline text-red-600 mr-1 -mt-0.5" /> : null}
          {tarea.titulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#6B7280]">
          <EtiquetaTipo tipo={tarea.tipo} onClick={cambiarTipo} title="Toca para cambiar: flotar → mover → sin tipo" />
          {f && !hecha ? (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                f.tono === 'rojo' ? 'text-red-600' : f.tono === 'azul' ? 'text-gray-700' : 'bg-[#F3F4F6] text-[#6B7280]'
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
      <button onClick={quitar} aria-label="Borrar tarea" className="shrink-0 mt-0.5 text-[#9CA3AF] hover:text-red-600">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
