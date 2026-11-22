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
  'w-full bg-white rounded-lg px-3 py-2 text-[13.5px] text-[#0B1020] placeholder:text-[#8A93A3] border border-[#E6E8EE] outline-none focus:border-[#0B1020] transition-colors'

/**
 * El color de cada tipo: el de la marca para flotar y verde para mover. Solo
 * se usa en un punto y en la barra del medidor (22/11/2026: sin pastillas de
 * color; `fondo` y `texto` se quedan por quien los use).
 */
export const COLOR_TIPO: Record<'flotar' | 'mover', { fondo: string; texto: string; barra: string }> = {
  flotar: { fondo: '#F7F8FA', texto: '#0B1020', barra: '#1D0084' },
  mover: { fondo: '#F7F8FA', texto: '#0B1020', barra: '#23A26D' },
}

/** «● Flotar» / «● Mover», o «Flotar / Mover» en gris si aún no tiene tipo. */
export function EtiquetaTipo({ tipo, onClick, title }: { tipo?: TipoTarea; onClick?: () => void; title?: string }) {
  const contenido = tipo ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4B5565]">
      <span className="w-[7px] h-[7px] rounded-full" style={{ background: COLOR_TIPO[tipo].barra }} />
      {tipo === 'flotar' ? 'Flotar' : 'Mover'}
    </span>
  ) : (
    <span className="text-[12px] text-[#B4BAC6]">Flotar / Mover</span>
  )
  if (!onClick) return contenido
  return (
    <button type="button" onClick={onClick} title={title} className="rounded outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[#0B1020]">
      {contenido}
    </button>
  )
}

/** Dos botones para elegir el tipo (o ninguno, tocando el elegido otra vez). */
export function ElegirTipo({ tipo, onChange }: { tipo: TipoTarea; onChange: (t: TipoTarea) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E6E8EE] bg-white p-0.5" role="group" aria-label="Tipo de tarea">
      {TIPOS_TAREA.map((t) => {
        const activo = tipo === t.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.ayuda}
            onClick={() => onChange(activo ? '' : t.id)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12.5px] font-medium ${activo ? 'bg-[#0B1020] text-white' : 'text-[#4B5565] hover:text-[#0B1020]'}`}
          >
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: COLOR_TIPO[t.id].barra }} />
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
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px] text-[#4B5565]">
        <span className="min-w-0 truncate">
          {total ? (
            <>
              <b className="font-semibold text-[#0B1020]">
                {balance.hechas.flotar} flotar · {balance.hechas.mover} mover
              </b>{' '}
              hechas esta semana
            </>
          ) : (
            'Esta semana aún no has terminado ninguna tarea con tipo'
          )}
        </span>
        {total ? (
          <span className="shrink-0 tabular-nums">
            {balance.flotar_pct} / {balance.mover_pct}
          </span>
        ) : null}
      </div>
      <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[#EDEFF4] mt-2.5" aria-hidden title={textoBalance(balance)}>
        {total ? (
          <>
            <span style={{ width: `${balance.flotar_pct}%`, background: COLOR_TIPO.flotar.barra }} />
            <span style={{ width: `${balance.mover_pct}%`, background: COLOR_TIPO.mover.barra }} />
          </>
        ) : null}
        <span className="absolute left-1/2 top-0 h-full w-px bg-white" />
      </div>
      <p className="mt-2 text-[12.5px] text-[#8A93A3]">
        Pendientes: {balance.pendientes.flotar} flotar · {balance.pendientes.mover} mover
        {balance.pendientes.sin ? ` · ${balance.pendientes.sin} sin tipo` : ''}
        {consejo ? ` · ${consejo}` : compacto ? '' : ' · La raya del centro es el 50/50'}
      </p>
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
  // En el inicio (compacto) se ve solo la línea para escribir; la fecha, para
  // quién y el tipo salen al empezar a escribir, para no llenar la pantalla.
  const conOpciones = !compacto || titulo.trim().length > 0

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
    <div className={compacto ? 'space-y-2' : 'rounded-[10px] border border-[#E6E8EE] bg-white p-3.5 sm:p-4 space-y-2'}>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        placeholder={compacto ? '+ Nueva tarea' : email ? 'Nueva tarea con esta persona: «Mandarle el enlace de pago»' : 'Nueva tarea: «Llamar a Laura», «Subir el vídeo del módulo 5»'}
        className={compacto ? 'w-full bg-transparent py-2 text-[14px] text-[#0B1020] placeholder:text-[#8A93A3] outline-none border-b border-transparent focus:border-[#E6E8EE]' : INPUT}
      />
      <div className={`flex flex-wrap items-center gap-2 ${conOpciones ? '' : 'hidden'}`}>
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
              className={`h-8 px-2.5 rounded-lg text-[12.5px] font-medium border ${fecha === f ? 'bg-[#0B1020] border-[#0B1020] text-white' : 'border-[#E6E8EE] bg-white text-[#4B5565]'}`}
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
          className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12.5px] font-medium border ${alta ? 'border-[#F1C9C6] text-[#C8322B]' : 'border-[#E6E8EE] bg-white text-[#4B5565]'}`}
        >
          <Flag size={12} /> Importante
        </button>
        <ElegirTipo tipo={tipo} onChange={setTipo} />
        <button
          onClick={guardar}
          disabled={guardando || !titulo.trim()}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0B1020] hover:bg-[#232A3D] text-white text-[13px] font-medium disabled:opacity-40"
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
    <div className={`flex items-start gap-3 py-[11px] ${hecha ? 'opacity-55' : ''}`}>
      <button
        onClick={alternar}
        aria-label={hecha ? 'Marcar pendiente' : 'Marcar hecha'}
        className={`mt-[3px] shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
          hecha ? 'bg-[#0E8A4F] border-[#0E8A4F]' : 'border-[#C5CAD6] hover:border-[#0B1020]'
        }`}
      >
        {hecha ? <Check size={11} className="text-white" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] text-[#0B1020] leading-snug ${hecha ? 'line-through' : ''}`}>
          {tarea.prioridad === 'alta' && !hecha ? <Flag size={12} className="inline text-[#C8322B] mr-1 -mt-0.5" /> : null}
          {tarea.titulo}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#8A93A3]">
          <EtiquetaTipo tipo={tarea.tipo} onClick={cambiarTipo} title="Toca para cambiar: flotar → mover → sin tipo" />
          {f && !hecha ? (
            <span className={f.tono === 'rojo' ? 'font-medium text-[#C8322B]' : f.tono === 'azul' ? 'text-[#4B5565]' : ''}>{f.texto}</span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <User size={11} /> {tarea.asignado || 'Sin asignar'}
          </span>
          {tarea.email ? (
            onAbrirPersona ? (
              <button onClick={() => onAbrirPersona(tarea.email)} className="text-[#1F3FD0] font-medium hover:underline truncate max-w-[220px]">
                {nombrePersona || tarea.email}
              </button>
            ) : (
              <span className="truncate max-w-[220px]">{nombrePersona || tarea.email}</span>
            )
          ) : null}
          {tarea.creado_por && tarea.creado_por !== tarea.asignado ? <span>· de {tarea.creado_por}</span> : null}
        </div>
      </div>
      <button onClick={quitar} aria-label="Borrar tarea" className="shrink-0 mt-0.5 text-[#C5CAD6] hover:text-[#C8322B]">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
