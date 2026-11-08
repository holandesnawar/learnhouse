'use client'
/**
 * El tablero de tareas del equipo (08/11/2026), como el Planner de Teams: tres
 * columnas (por hacer · en curso · hecho) que se arrastran en el ordenador y,
 * en el móvil, una columna cada vez. La tarjeta dice a quién va, para cuándo
 * (en rojo si se pasó), si es urgente y de qué clase. Al tocarla, se edita.
 * Servidor: apps/api/src/services/equipo/equipo.py.
 */
import React, { useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Plus, X, Flag, Calendar, AlignLeft } from 'lucide-react'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { confirmar } from '@/lib/nawar/confirmar'
import { mediaSrc } from '@services/messages/direct'
import { diaLegible, vencida } from '@/lib/nawar/salaProfes'
import {
  borrarTareaEquipo,
  cambiarTareaEquipo,
  crearTareaEquipo,
  type CambioTarea,
  type EstadoTareaEquipo,
  type Miembro,
  type TareaEquipo,
} from '@services/equipo/equipo'
import type { ClaseEquipo } from './useClasesEquipo'

export const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

export const COLUMNAS_TAREAS: { id: EstadoTareaEquipo; titulo: string; color: string }[] = [
  { id: 'por-hacer', titulo: 'Por hacer', color: '#94A3B8' },
  { id: 'en-curso', titulo: 'En curso', color: '#0b2da0' },
  { id: 'hecho', titulo: 'Hecho', color: '#16A34A' },
]

const DIAS_HECHO = 14

/** La ventana para crear o cambiar una tarea. */
export function TareaModal({
  orgId,
  token,
  tarea,
  inicial,
  miembros,
  clases,
  yo,
  admin,
  onCerrar,
  onGuardada,
  onBorrada,
}: {
  orgId: number
  token: string
  tarea: TareaEquipo | null
  inicial?: CambioTarea
  miembros: Miembro[]
  clases: ClaseEquipo[]
  yo: number
  admin: boolean
  onCerrar: () => void
  onGuardada: (t: TareaEquipo) => void
  onBorrada: (id: number) => void
}) {
  const [d, setD] = useState<CambioTarea>(() =>
    tarea
      ? {
          titulo: tarea.titulo,
          notas: tarea.notas,
          estado: tarea.estado,
          prioridad: tarea.prioridad,
          fecha: tarea.fecha,
          asignado_id: tarea.asignado_id,
          course_uuid: tarea.course_uuid,
        }
      : { titulo: '', notas: '', estado: 'por-hacer', prioridad: 'normal', fecha: '', asignado_id: yo, course_uuid: '', ...inicial }
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof CambioTarea, v: any) => setD((x) => ({ ...x, [k]: v }))

  async function guardar() {
    if (!String(d.titulo || '').trim()) return setError('Escribe qué hay que hacer')
    setGuardando(true)
    setError('')
    try {
      const t = tarea ? await cambiarTareaEquipo(orgId, tarea.id, d, token) : await crearTareaEquipo(orgId, d, token)
      onGuardada(t)
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar')
      setGuardando(false)
    }
  }
  async function borrar() {
    if (!tarea) return
    if (!(await confirmar(`¿Borrar la tarea «${tarea.titulo}»?`, { boton: 'Sí, borrar' }))) return
    try {
      await borrarTareaEquipo(orgId, tarea.id, token)
      onBorrada(tarea.id)
    } catch (e: any) {
      setError(e?.message || 'No se pudo borrar')
    }
  }
  const puedeBorrar = !!tarea && (admin || tarea.creado_por_id === yo)
  const campo = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'
  const etiqueta = 'block text-[12.5px] font-semibold text-[#3B4262] mb-1'

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
            {tarea ? 'Tarea del equipo' : 'Nueva tarea'}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-[#6B7393] hover:text-[#0B1033]">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className={etiqueta}>Qué hay que hacer</label>
            <input autoFocus className={campo} value={d.titulo || ''} onChange={(e) => set('titulo', e.target.value)} placeholder="Subir la presentación del martes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta}>Para quién</label>
              <select className={campo} value={d.asignado_id || 0} onChange={(e) => set('asignado_id', Number(e.target.value))}>
                <option value={0}>Todo el equipo</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.id === yo ? ' (tú)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta}>Para cuándo</label>
              <input type="date" className={campo} value={d.fecha || ''} onChange={(e) => set('fecha', e.target.value)} />
            </div>
            <div>
              <label className={etiqueta}>Columna</label>
              <select className={campo} value={d.estado || 'por-hacer'} onChange={(e) => set('estado', e.target.value)}>
                {COLUMNAS_TAREAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta}>De qué clase</label>
              <select className={campo} value={d.course_uuid || ''} onChange={(e) => set('course_uuid', e.target.value)}>
                <option value="">De ninguna</option>
                {clases.map((c) => (
                  <option key={c.uuid} value={c.uuid.replace(/^course_/, '')}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-[14px] text-[#0B1033] cursor-pointer">
            <input type="checkbox" checked={d.prioridad === 'alta'} onChange={(e) => set('prioridad', e.target.checked ? 'alta' : 'normal')} />
            Urgente
          </label>
          <div>
            <label className={etiqueta}>Notas</label>
            <textarea className={`${campo} min-h-[96px]`} value={d.notas || ''} onChange={(e) => set('notas', e.target.value)} placeholder="Lo que haga falta saber para hacerla" />
          </div>
          {tarea ? (
            <p className="text-[12px] text-[#6B7393]">
              La creó {tarea.creado_por || 'alguien del equipo'}
              {tarea.done_at ? ` · hecha el ${diaLegible(tarea.done_at.slice(0, 10))}` : ''}
            </p>
          ) : null}
          {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
        </div>
        <div className="flex items-center gap-2 px-5 pb-5">
          {puedeBorrar ? (
            <button onClick={borrar} className="text-[13.5px] font-semibold text-red-600 hover:text-red-700 mr-auto">
              Borrar
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          <button onClick={onCerrar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
            Cancelar
          </button>
          <button
            disabled={guardando}
            onClick={guardar}
            className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** La tarjeta de una tarea (en el tablero y en «Mis tareas»). */
export function TarjetaTarea({
  t,
  hoy,
  clases,
  miembros,
  onAbrir,
  compacta = false,
}: {
  t: TareaEquipo
  hoy: string
  clases: ClaseEquipo[]
  miembros: Miembro[]
  onAbrir: () => void
  compacta?: boolean
}) {
  const clase = clases.find((c) => c.uuid.replace(/^course_/, '') === t.course_uuid)
  const quien = miembros.find((m) => m.id === t.asignado_id)
  const tarde = vencida(t, hoy)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={compacta ? 'cursor-pointer group' : 'rounded-xl border border-[#E4E8F2] bg-white px-3.5 py-3 cursor-pointer hover:border-[#C9D4EC]'}
    >
      {clase ? (
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#5B6382] mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: clase.color }} />
          {clase.nombre}
        </p>
      ) : null}
      <p className={`text-[14px] font-semibold leading-snug ${t.estado === 'hecho' ? 'text-[#6B7393] line-through' : 'text-[#0B1033] group-hover:text-[#0b2da0]'}`}>{t.titulo}</p>
      <div className={`${compacta ? 'mt-1' : 'mt-2'} flex items-center gap-2.5 text-[12px] text-[#6B7393]`}>
        {t.prioridad === 'alta' && t.estado !== 'hecho' ? (
          <span className="inline-flex items-center gap-1 font-semibold text-[#B42318]">
            <Flag size={12} /> Urgente
          </span>
        ) : null}
        {t.fecha ? (
          <span className={`inline-flex items-center gap-1 ${tarde ? 'font-semibold text-[#B42318]' : ''}`}>
            <Calendar size={12} />
            {t.fecha === hoy ? 'Hoy' : diaLegible(t.fecha)}
          </span>
        ) : null}
        {t.notas ? <AlignLeft size={12} aria-label="Tiene notas" /> : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {quien ? (
            <>
              <AvatarPersona nombre={quien.nombre} src={quien.avatar ? mediaSrc(quien.avatar) : null} size={20} />
              {compacta ? null : <span className="text-[12px] text-[#3B4262]">{quien.nombre.split(' ')[0]}</span>}
            </>
          ) : (
            <span className="text-[12px] text-[#6B7393]">Todo el equipo</span>
          )}
        </span>
      </div>
    </div>
  )
}

export default function TableroEquipo({
  orgId,
  token,
  tareas,
  setTareas,
  miembros,
  clases,
  yo,
  admin,
  hoy,
}: {
  orgId: number
  token: string
  tareas: TareaEquipo[]
  setTareas: React.Dispatch<React.SetStateAction<TareaEquipo[]>>
  miembros: Miembro[]
  clases: ClaseEquipo[]
  yo: number
  admin: boolean
  hoy: string
}) {
  const [filtro, setFiltro] = useState<'todas' | 'mias' | number>('todas')
  const [deClase, setDeClase] = useState('')
  const [abierta, setAbierta] = useState<TareaEquipo | null>(null)
  const [nueva, setNueva] = useState<EstadoTareaEquipo | null>(null)
  const [columnaMovil, setColumnaMovil] = useState<EstadoTareaEquipo>('por-hacer')
  const [verHechas, setVerHechas] = useState(false)
  const [error, setError] = useState('')

  const desde = useMemo(() => {
    const d = new Date(`${hoy}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - DIAS_HECHO)
    return d.toISOString().slice(0, 10)
  }, [hoy])

  const visibles = tareas.filter((t) => {
    if (filtro === 'mias' && t.asignado_id && t.asignado_id !== yo) return false
    if (typeof filtro === 'number' && t.asignado_id !== filtro) return false
    if (deClase && t.course_uuid !== deClase) return false
    return true
  })
  const deColumna = (c: EstadoTareaEquipo) => {
    const lista = visibles.filter((t) => t.estado === c).sort((a, b) => a.orden - b.orden || b.id - a.id)
    if (c !== 'hecho' || verHechas) return lista
    return lista.filter((t) => (t.done_at || t.updated_at || '').slice(0, 10) >= desde)
  }
  const hechasOcultas = visibles.filter((t) => t.estado === 'hecho').length - deColumna('hecho').length

  async function alSoltar(r: DropResult) {
    if (!r.destination) return
    const id = Number(r.draggableId)
    const estado = r.destination.droppableId as EstadoTareaEquipo
    const destino = deColumna(estado).filter((t) => t.id !== id)
    const i = r.destination.index
    const antes = destino[i - 1]?.orden
    const despues = destino[i]?.orden
    const orden =
      antes === undefined && despues === undefined ? 0 : antes === undefined ? despues! - 1 : despues === undefined ? antes + 1 : (antes + despues) / 2
    const previa = tareas
    setTareas((ts) =>
      ts.map((t) => (t.id === id ? { ...t, estado, orden, done_at: estado === 'hecho' ? t.done_at || new Date().toISOString() : '' } : t))
    )
    try {
      const t = await cambiarTareaEquipo(orgId, id, { estado, orden }, token)
      setTareas((ts) => ts.map((x) => (x.id === id ? t : x)))
    } catch (e: any) {
      setTareas(previa)
      setError(e?.message || 'No se pudo mover la tarea')
    }
  }

  const chip = (on: boolean) =>
    `shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors ${
      on ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3EF] text-[#3B4262] hover:border-[#0b2da0]'
    }`

  // Una función, no un componente: si fuera un componente definido aquí, cada
  // render lo montaría de nuevo y el arrastre se cortaría a medias.
  const columna = (c: (typeof COLUMNAS_TAREAS)[number], conArrastre: boolean) => {
    const lista = deColumna(c.id)
    const tarjetas = (p?: any) => (
      <div
        ref={p?.innerRef}
        {...(p?.droppableProps || {})}
        className="flex-1 px-2.5 pb-2.5 space-y-2 min-h-[120px] rounded-b-2xl"
      >
        {lista.map((t, i) =>
          conArrastre ? (
            <Draggable key={t.id} draggableId={String(t.id)} index={i}>
              {(pp) => (
                <div ref={pp.innerRef} {...pp.draggableProps} {...pp.dragHandleProps}>
                  <TarjetaTarea t={t} hoy={hoy} clases={clases} miembros={miembros} onAbrir={() => setAbierta(t)} />
                </div>
              )}
            </Draggable>
          ) : (
            <TarjetaTarea key={t.id} t={t} hoy={hoy} clases={clases} miembros={miembros} onAbrir={() => setAbierta(t)} />
          )
        )}
        {p?.placeholder}
        {!lista.length ? <p className="px-1.5 py-3 text-[13px] text-[#8A91AD]">Nada por aquí.</p> : null}
        {c.id === 'hecho' && hechasOcultas > 0 ? (
          <button onClick={() => setVerHechas(true)} className="px-1.5 text-[12.5px] font-semibold text-[#0b2da0]">
            Ver las {hechasOcultas} hechas hace más de {DIAS_HECHO} días
          </button>
        ) : null}
      </div>
    )
    return (
      <div className="flex flex-col min-w-0 rounded-2xl bg-[#F5F7FC] border border-[#EEF1F7]">
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
          <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
          <h3 className="text-[14px] font-bold text-[#0B1033]" style={POPPINS}>
            {c.titulo}
          </h3>
          <span className="text-[12.5px] text-[#6B7393]">{visibles.filter((t) => t.estado === c.id).length}</span>
          <button
            onClick={() => setNueva(c.id)}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0b2da0] hover:text-[#0B1033]"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
        {conArrastre ? <Droppable droppableId={c.id}>{(p) => tarjetas(p)}</Droppable> : tarjetas()}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button className={chip(filtro === 'todas')} onClick={() => setFiltro('todas')}>
          Todas
        </button>
        <button className={chip(filtro === 'mias')} onClick={() => setFiltro('mias')}>
          Las mías
        </button>
        {miembros
          .filter((m) => m.id !== yo)
          .map((m) => (
            <button key={m.id} className={chip(filtro === m.id)} onClick={() => setFiltro(filtro === m.id ? 'todas' : m.id)}>
              {m.nombre.split(' ')[0]}
            </button>
          ))}
        {clases.length > 1 ? (
          <select
            value={deClase}
            onChange={(e) => setDeClase(e.target.value)}
            className="shrink-0 w-auto max-w-[240px] h-8 rounded-full border border-[#DDE3EF] bg-white px-3 text-[13px] font-semibold text-[#3B4262]"
          >
            <option value="">Todas las clases</option>
            {clases.map((c) => (
              <option key={c.uuid} value={c.uuid.replace(/^course_/, '')}>
                {c.nombre}
              </option>
            ))}
          </select>
        ) : null}
        <button
          onClick={() => setNueva('por-hacer')}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold"
        >
          <Plus size={15} /> Nueva tarea
        </button>
      </div>
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

      {/* Móvil: una columna cada vez. */}
      <div className="sm:hidden flex gap-1.5">
        {COLUMNAS_TAREAS.map((c) => (
          <button key={c.id} className={chip(columnaMovil === c.id)} onClick={() => setColumnaMovil(c.id)}>
            {c.titulo} · {visibles.filter((t) => t.estado === c.id).length}
          </button>
        ))}
      </div>
      <DragDropContext onDragEnd={alSoltar}>
        <div className="hidden sm:grid grid-cols-3 gap-3">
          {COLUMNAS_TAREAS.map((c) => (
            <React.Fragment key={c.id}>{columna(c, true)}</React.Fragment>
          ))}
        </div>
      </DragDropContext>
      {/* En el móvil no se arrastra: la columna se cambia desde la tarea. */}
      <div className="sm:hidden">{columna(COLUMNAS_TAREAS.find((c) => c.id === columnaMovil)!, false)}</div>

      {abierta || nueva ? (
        <TareaModal
          orgId={orgId}
          token={token}
          tarea={abierta}
          inicial={nueva ? { estado: nueva } : undefined}
          miembros={miembros}
          clases={clases}
          yo={yo}
          admin={admin}
          onCerrar={() => {
            setAbierta(null)
            setNueva(null)
          }}
          onGuardada={(t) => {
            setTareas((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [t, ...ts]))
            setAbierta(null)
            setNueva(null)
          }}
          onBorrada={(id) => {
            setTareas((ts) => ts.filter((x) => x.id !== id))
            setAbierta(null)
          }}
        />
      ) : null}
    </div>
  )
}
