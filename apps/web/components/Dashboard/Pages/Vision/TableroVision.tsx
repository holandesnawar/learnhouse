'use client'

/**
 * El tablero de Visión (20/10/2026): las MISMAS tarjetas del mapa, vistas como
 * trabajo. Pedido del usuario: "el mapa es un coñazo de llevar al día"; quería
 * columnas tipo kanban, encargados con su nombre y una línea de tiempo por
 * semanas "para ver qué voy haciendo y qué tengo pendiente".
 *
 * - Columnas: Ideas · Por hacer · En curso · Bloqueado · Hecho (el `estado` de
 *   la tarjeta). En el ordenador se arrastran; en el móvil, una columna cada
 *   vez y se cambia desde la página de la tarjeta.
 * - Semanas: en el ordenador, una línea de tiempo con una barra por tarjeta
 *   (de su inicio a su fin o fecha límite); en el móvil, una lista por semanas.
 * - Al pasar algo a Hecho sin fecha de fin, el servidor le pone la de hoy: así
 *   sale en la semana en que se terminó.
 * - Qué tarjetas salen y su área: `apps/api/src/services/vision/trabajo.py`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { AlertTriangle, CalendarDays, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Columns3, Loader2, Plus, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  TIPO,
  abrirSubmapa,
  cambiarNodo,
  crearTarea,
  fechaCorta,
  getNodo,
  getTrabajo,
  type EstadoNodo,
  type MetricaInfo,
  type NodoVision,
  type TarjetaTrabajo,
  type Trabajo,
} from '@services/vision/vision'
import {
  agruparPorSemana,
  atrasada,
  diasEntre,
  limiteDe,
  lunesDe,
  lunesSeguidos,
  numeroSemana,
  personasDe,
  rangoDe,
  sumarDias,
} from '@lib/nawar/semanasTrabajo'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA, filtro } from '../Panel/ui'
import PaginaNodo from './PaginaNodo'
import PersonasCampo, { Avatar, Avatares } from './Personas'

const COLUMNAS: { id: EstadoNodo; nombre: string; color: string }[] = [
  { id: 'idea', nombre: 'Ideas', color: '#9CA3AF' },
  { id: 'pendiente', nombre: 'Por hacer', color: '#D97706' },
  { id: 'en-curso', nombre: 'En curso', color: '#2563EB' },
  { id: 'bloqueado', nombre: 'Bloqueado', color: '#DC2626' },
  { id: 'hecho', nombre: 'Hecho', color: '#16A34A' },
]
const COLUMNA = Object.fromEntries(COLUMNAS.map((c) => [c.id, c])) as Record<EstadoNodo, (typeof COLUMNAS)[number]>

/** Las barras de la línea de tiempo: fondo y letra por estado. */
const BARRA: Record<EstadoNodo, { fondo: string; letra: string }> = {
  idea: { fondo: '#E5E7EB', letra: '#4B5563' },
  pendiente: { fondo: '#D6E4F7', letra: '#1D3A6E' },
  'en-curso': { fondo: '#025dc7', letra: '#FFFFFF' },
  bloqueado: { fondo: '#FEE2E2', letra: '#991B1B' },
  hecho: { fondo: '#DCFCE7', letra: '#166534' },
}

/** Lo hecho hace más de esto, plegado en la columna Hecho. */
const DIAS_HECHO_A_LA_VISTA = 14
const SEMANAS_LINEA = 10
/** Un grupo de la línea de tiempo con más filas que esto nace plegado. */
const PLEGAR_DESDE = 10
/** Cuántas tarjetas enseña cada columna antes de «Ver más». */
const POR_COLUMNA = 12
const CLAVE = 'nawar.vision.tablero'
const CLAVE_PLEGADOS = 'nawar.vision.semanas.plegados'

type Vista = 'columnas' | 'semanas'
type Filtros = { vista: Vista; area: string; persona: string }

function leerFiltros(): Filtros {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE) || '{}')
    return {
      vista: v.vista === 'semanas' ? 'semanas' : 'columnas',
      area: typeof v.area === 'string' ? v.area : 'todas',
      persona: typeof v.persona === 'string' ? v.persona : 'todas',
    }
  } catch {
    return { vista: 'columnas', area: 'todas', persona: 'todas' }
  }
}

/** «1 atrasada», «3 atrasadas». */
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function diaCorto(iso: string) {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
}

/** Lo que se ve de la fecha en una tarjeta. */
function textoFecha(t: TarjetaTrabajo, hoy: string): { texto: string; tono: 'rojo' | 'ambar' | 'gris' | 'verde' } | null {
  if (t.estado === 'hecho') return t.fin ? { texto: `Hecho el ${fechaCorta(t.fin)}`, tono: 'verde' } : null
  const l = limiteDe(t)
  if (!l) return t.inicio ? { texto: `Empieza ${diaCorto(t.inicio)}`, tono: 'gris' } : null
  if (l < hoy) return { texto: `Atrasada · ${diaCorto(l)}`, tono: 'rojo' }
  if (l === hoy) return { texto: 'Hoy', tono: 'rojo' }
  if (lunesDe(l) === lunesDe(hoy)) return { texto: diaCorto(l), tono: 'ambar' }
  return { texto: diaCorto(l), tono: 'gris' }
}

const TONO_FECHA = { rojo: 'text-[#DC2626]', ambar: 'text-[#B45309]', gris: 'text-[#6B7280]', verde: 'text-[#15803D]' }

function ordenColumna(a: TarjetaTrabajo, b: TarjetaTrabajo) {
  if (a.estado === 'hecho' && b.estado === 'hecho') return (b.fin || b.updated_at).localeCompare(a.fin || a.updated_at)
  // Urgente arriba; luego lo que vence antes (lo atrasado, lo primero); a igual fecha, lo importante.
  if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
  const la = limiteDe(a) || '9999'
  const lb = limiteDe(b) || '9999'
  if (la !== lb) return la < lb ? -1 : 1
  if (a.importante !== b.importante) return a.importante ? -1 : 1
  return a.titulo.localeCompare(b.titulo, 'es')
}

export default function TableroVision({
  orgId,
  token,
  campanas,
  metricas,
  onIrAlMapa,
  onVerCampana,
}: {
  orgId: number
  token: string
  campanas: { id: number; titulo: string }[]
  metricas: Record<string, MetricaInfo>
  /** Ir al mapa (y abrir la página de una tarjeta, si se dice cuál). */
  onIrAlMapa: (mapaId: number, foco?: number) => void
  onVerCampana: (id: number) => void
}) {
  const [datos, setDatos] = useState<Trabajo | null>(null)
  const [error, setError] = useState('')
  const [f, setF] = useState<Filtros>({ vista: 'columnas', area: 'todas', persona: 'todas' })
  const [soloUrgente, setSoloUrgente] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [abierta, setAbierta] = useState<{ nodo: NodoVision; nueva: boolean } | null>(null)
  const [nueva, setNueva] = useState<EstadoNodo | null>(null)
  const pedida = useRef(0)

  useEffect(() => setF(leerFiltros()), [])
  const cambiarFiltros = (cambios: Partial<Filtros>) =>
    setF((v) => {
      const n = { ...v, ...cambios }
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(n))
      } catch {
        /* sin almacenamiento */
      }
      return n
    })

  const cargar = useCallback(async () => {
    const vez = ++pedida.current
    const r = await getTrabajo(orgId, token)
    if (vez !== pedida.current) return // llegó tarde: ya se pidió otra
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido cargar el tablero')
    setError('')
    setDatos(r.datos)
  }, [orgId, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const hoy = datos?.hoy ?? new Date().toISOString().slice(0, 10)

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (datos?.tarjetas ?? []).filter((t) => {
      if (f.area === 'inicio' ? t.area_id !== null : f.area !== 'todas' && String(t.area_id) !== f.area) return false
      if (f.persona === 'nadie' ? t.personas.length > 0 : f.persona !== 'todas' && !t.personas.some((p) => p.toLowerCase() === f.persona.toLowerCase()))
        return false
      if (soloUrgente && !t.urgente) return false
      if (q && !`${t.titulo} ${t.ruta} ${t.personas.join(' ')} ${t.etiquetas.join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [datos, f.area, f.persona, soloUrgente, buscar])

  const resumen = useMemo(() => {
    const lunes = lunesDe(hoy)
    const domingo = sumarDias(lunes, 6)
    let abiertas = 0
    let atrasadas = 0
    let semana = 0
    let hechas = 0
    for (const t of visibles) {
      if (t.estado === 'hecho') {
        if (t.fin >= lunes && t.fin <= domingo) hechas++
        continue
      }
      if (t.estado !== 'idea') abiertas++
      if (atrasada(t, hoy)) atrasadas++
      else {
        const l = limiteDe(t)
        if (l && l <= domingo) semana++
      }
    }
    return { abiertas, atrasadas, semana, hechas }
  }, [visibles, hoy])

  // ── cambios ──────────────────────────────────────────────────────────────

  async function mover(id: number, estado: EstadoNodo) {
    const antes = datos?.tarjetas.find((t) => t.id === id)
    if (!antes || antes.estado === estado) return
    pedida.current++ // una lectura que estuviera en camino ya no vale
    setDatos(
      (d) =>
        d && {
          ...d,
          tarjetas: d.tarjetas.map((t) => (t.id === id ? { ...t, estado, fin: estado === 'hecho' && !t.fin ? hoy : t.fin } : t)),
        }
    )
    const r = await cambiarNodo(orgId, id, { estado }, token)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido mover')
      setDatos((d) => d && { ...d, tarjetas: d.tarjetas.map((t) => (t.id === id ? antes : t)) })
      return
    }
    const n = r.datos
    setDatos((d) => d && { ...d, tarjetas: d.tarjetas.map((t) => (t.id === id ? { ...t, estado: n.estado, fin: n.fin, updated_at: n.updated_at } : t)) })
  }

  async function abrir(id: number, recien = false) {
    const r = await getNodo(orgId, id, token)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido abrir')
    setAbierta({ nodo: r.datos, nueva: recien })
  }

  async function abrirMapaDe(n: NodoVision) {
    let destino = n.submapa_id
    if (!destino) {
      const r = await abrirSubmapa(orgId, n.id, token)
      if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido crear su mapa')
      destino = r.datos.mapa_id
    }
    setAbierta(null)
    onIrAlMapa(destino)
  }

  if (error && !datos) {
    return (
      <div className={`${TARJETA} p-5`}>
        <p className="text-[14px] text-gray-700">{error}</p>
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )
  }

  const areaPorDefecto = /^\d+$/.test(f.area) ? Number(f.area) : null
  const personaPorDefecto = f.persona !== 'todas' && f.persona !== 'nadie' ? f.persona : ''

  return (
    <div className="space-y-4">
      {/* Barra: columnas o semanas, filtros y nueva tarjeta. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-[#E5E7EB] p-0.5 bg-white">
          {(
            [
              ['columnas', 'Columnas', Columns3],
              ['semanas', 'Semanas', CalendarDays],
            ] as const
          ).map(([id, nombre, Icono]) => (
            <button
              key={id}
              onClick={() => cambiarFiltros({ vista: id })}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[13px] font-medium ${
                f.vista === id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-[#F9FAFB]'
              }`}
            >
              <Icono size={14} /> {nombre}
            </button>
          ))}
        </div>
        <select
          value={f.area}
          onChange={(e) => cambiarFiltros({ area: e.target.value })}
          className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-[13px] text-gray-800 outline-none"
          aria-label="Área"
        >
          <option value="todas">Todas las áreas</option>
          {datos.areas.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.titulo}
            </option>
          ))}
          <option value="inicio">Sin área (Inicio)</option>
        </select>
        <button onClick={() => setSoloUrgente((v) => !v)} className={filtro(soloUrgente)}>
          Solo urgente
        </button>
        <label className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar"
            className="h-8 w-36 sm:w-44 rounded-md border border-[#E5E7EB] bg-white pl-8 pr-2 text-[13px] outline-none focus:border-gray-900"
          />
        </label>
        <div className="flex-1" />
        <button onClick={() => setNueva('pendiente')} className={BOTON_PRINCIPAL}>
          <Plus size={14} /> Nueva tarea
        </button>
      </div>

      {/* Quién: para ver solo lo de cada uno. */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button onClick={() => cambiarFiltros({ persona: 'todas' })} className={filtro(f.persona === 'todas')}>
          Todos
        </button>
        {datos.personas.map((p) => (
          <button key={p} onClick={() => cambiarFiltros({ persona: p })} className={`${filtro(f.persona.toLowerCase() === p.toLowerCase())} inline-flex items-center gap-1.5 pl-1.5`}>
            <Avatar nombre={p} tam={20} /> {p}
          </button>
        ))}
        <button onClick={() => cambiarFiltros({ persona: 'nadie' })} className={filtro(f.persona === 'nadie')}>
          Sin encargado
        </button>
      </div>

      {/* Cómo va la semana, con los filtros puestos. */}
      <p className={META}>
        <span className="text-gray-900 font-medium">{resumen.abiertas}</span> por hacer o en curso
        <span className="text-[#D1D5DB]"> · </span>
        <span className={resumen.atrasadas ? 'text-[#DC2626] font-medium' : ''}>{plural(resumen.atrasadas, 'atrasada', 'atrasadas')}</span>
        <span className="text-[#D1D5DB]"> · </span>
        {resumen.semana} para esta semana
        <span className="text-[#D1D5DB]"> · </span>
        <span className="text-[#15803D]">{plural(resumen.hechas, 'hecha', 'hechas')} esta semana</span>
      </p>

      {f.vista === 'columnas' ? (
        <Columnas tarjetas={visibles} hoy={hoy} onMover={mover} onAbrir={(id) => abrir(id)} onNueva={setNueva} />
      ) : (
        <Semanas tarjetas={visibles} hoy={hoy} onAbrir={(id) => abrir(id)} />
      )}

      {!datos.tarjetas.length ? (
        <div className={`${TARJETA} p-5`}>
          <p className="text-[14px] text-gray-800 font-medium">Todavía no hay nada en el tablero.</p>
          <p className={`${META} mt-1`}>
            Crea la primera con «Nueva tarea». Las tareas, campañas, anuncios, contenidos y pasos del embudo del mapa salen aquí solos; las notas, si les
            pones encargado o fecha.
          </p>
        </div>
      ) : null}

      {nueva ? (
        <VentanaNueva
          estado={nueva}
          areas={datos.areas}
          personas={datos.personas}
          area={areaPorDefecto}
          persona={personaPorDefecto}
          onCancelar={() => setNueva(null)}
          onCrear={async (campos, abrirla) => {
            const r = await crearTarea(orgId, campos, token)
            if (!r.ok || !r.datos) {
              toast.error(r.error || 'No se ha podido crear')
              return false
            }
            await cargar()
            if (abrirla) {
              setNueva(null)
              setAbierta({ nodo: r.datos, nueva: false })
            } else toast.success('Creada')
            return true
          }}
        />
      ) : null}

      {abierta ? (
        <PaginaNodo
          key={abierta.nodo.id}
          orgId={orgId}
          token={token}
          nodo={abierta.nodo}
          nueva={abierta.nueva}
          campanas={campanas}
          metricas={metricas}
          personas={datos.personas}
          onCambio={(n) =>
            setDatos(
              (d) =>
                d && {
                  ...d,
                  tarjetas: d.tarjetas.map((t) => (t.id === n.id ? { ...t, ...n, area: t.area, area_id: t.area_id, ruta: t.ruta, personas: personasDe(n.responsable) } : t)),
                }
            )
          }
          onBorrado={() => {
            setAbierta(null)
            cargar()
          }}
          onAbrirMapa={(n) => abrirMapaDe(n)}
          onVerEnMapa={(n) => {
            setAbierta(null)
            onIrAlMapa(n.mapa_id, n.id)
          }}
          onVerCampana={(n) => {
            setAbierta(null)
            onVerCampana(n.id)
          }}
          onClose={() => {
            setAbierta(null)
            cargar()
          }}
        />
      ) : null}
    </div>
  )
}

// ── una tarjeta ──────────────────────────────────────────────────────────────

function Tarjeta({ t, hoy, onAbrir, conEstado = false }: { t: TarjetaTrabajo; hoy: string; onAbrir: () => void; conEstado?: boolean }) {
  const fecha = textoFecha(t, hoy)
  const tipo = TIPO[t.tipo]
  return (
    // Un div y no un <button>: desde un botón no se puede empezar a arrastrar.
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={`${TARJETA} block w-full text-left p-2.5 hover:border-[#9CA3AF] transition-colors cursor-pointer ${
        atrasada(t, hoy) ? 'border-l-2 border-l-[#DC2626]' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tipo?.color ?? '#9CA3AF' }} title={tipo?.nombre} />
        <span className="text-[11.5px] text-[#6B7280] truncate">{t.ruta || 'Inicio'}</span>
        {t.urgente ? <span className="ml-auto shrink-0 text-[11px] font-semibold text-[#DC2626]">Urgente</span> : null}
      </div>
      <p className={`mt-1 text-[13.5px] leading-snug font-medium line-clamp-2 ${t.estado === 'hecho' ? 'text-[#6B7280] line-through decoration-[#D1D5DB]' : 'text-gray-900'}`}>
        {t.importante ? <span className="text-[#1D0084]">★ </span> : null}
        {t.titulo || 'Sin título'}
      </p>
      {fecha || t.checklist.length || t.personas.length || conEstado ? (
        <div className="mt-2 flex items-center gap-2 min-w-0">
          {conEstado ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[#4B5563] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLUMNA[t.estado]?.color }} />
              {COLUMNA[t.estado]?.nombre}
            </span>
          ) : null}
          {fecha ? <span className={`text-[11.5px] font-medium truncate ${TONO_FECHA[fecha.tono]}`}>{fecha.texto}</span> : null}
          {t.checklist.length ? (
            <span className="inline-flex items-center gap-0.5 text-[11.5px] text-[#6B7280] shrink-0">
              <CheckSquare size={12} /> {t.hechas}/{t.checklist.length}
            </span>
          ) : null}
          <span className="ml-auto shrink-0">
            <Avatares personas={t.personas} tam={20} />
          </span>
        </div>
      ) : null}
    </div>
  )
}

// ── columnas ─────────────────────────────────────────────────────────────────

function Columnas({
  tarjetas,
  hoy,
  onMover,
  onAbrir,
  onNueva,
}: {
  tarjetas: TarjetaTrabajo[]
  hoy: string
  onMover: (id: number, estado: EstadoNodo) => void
  onAbrir: (id: number) => void
  onNueva: (estado: EstadoNodo) => void
}) {
  const [movil, setMovil] = useState<EstadoNodo>('pendiente')
  const [verHechoViejo, setVerHechoViejo] = useState(false)
  const [cuantas, setCuantas] = useState<Record<string, number>>({})
  const corte = sumarDias(hoy, -DIAS_HECHO_A_LA_VISTA)

  const porColumna = useMemo(() => {
    const m: Record<string, TarjetaTrabajo[]> = {}
    for (const c of COLUMNAS) m[c.id] = []
    for (const t of tarjetas) (m[t.estado] ?? m.pendiente).push(t)
    for (const c of COLUMNAS) m[c.id].sort(ordenColumna)
    return m
  }, [tarjetas])

  const hechoViejo = porColumna.hecho.filter((t) => (t.fin || t.updated_at.slice(0, 10)) < corte)
  const todas = (id: EstadoNodo) => (id === 'hecho' && !verHechoViejo ? porColumna.hecho.filter((t) => !hechoViejo.includes(t)) : porColumna[id])
  const lista = (id: EstadoNodo) => todas(id).slice(0, cuantas[id] ?? POR_COLUMNA)
  const verMas = (id: EstadoNodo) => {
    const faltan = todas(id).length - lista(id).length
    return faltan > 0 ? (
      <button onClick={() => setCuantas((v) => ({ ...v, [id]: (v[id] ?? POR_COLUMNA) + 20 }))} className="w-full text-[12.5px] font-medium text-[#025dc7] hover:underline py-1.5">
        Ver {faltan > 20 ? `20 más (faltan ${faltan})` : `las ${faltan} que faltan`}
      </button>
    ) : null
  }

  const pieHecho = hechoViejo.length ? (
    <button onClick={() => setVerHechoViejo((v) => !v)} className="w-full text-[12.5px] text-[#6B7280] hover:text-gray-900 py-1.5">
      {verHechoViejo ? 'Esconder lo hecho hace más de 2 semanas' : `Ver ${hechoViejo.length} hechas hace más de 2 semanas`}
    </button>
  ) : null

  return (
    <>
      {/* Móvil: una columna cada vez. */}
      <div className="lg:hidden space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {COLUMNAS.map((c) => (
            <button key={c.id} onClick={() => setMovil(c.id)} className={`${filtro(movil === c.id)} inline-flex items-center gap-1.5`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
              {c.nombre}
              <span className="tabular-nums opacity-70">{porColumna[c.id].length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {lista(movil).map((t) => (
            <Tarjeta key={t.id} t={t} hoy={hoy} onAbrir={() => onAbrir(t.id)} />
          ))}
          {verMas(movil)}
          {movil === 'hecho' ? pieHecho : null}
          {!porColumna[movil].length ? <p className="text-[13px] text-[#9CA3AF] py-6 text-center">Nada en esta columna.</p> : null}
          <button onClick={() => onNueva(movil)} className={`${BOTON} w-full`}>
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>

      {/* Ordenador: todas, y se arrastran. */}
      <div className="hidden lg:block overflow-x-auto pb-2">
        <DragDropContext onDragEnd={(r: DropResult) => r.destination && onMover(Number(r.draggableId), r.destination.droppableId as EstadoNodo)}>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${COLUMNAS.length}, minmax(220px, 1fr))`, minWidth: COLUMNAS.length * 230 }}>
            {COLUMNAS.map((c) => (
              <Droppable droppableId={c.id} key={c.id}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={`rounded-lg border p-2 min-h-[460px] transition-colors ${
                      snap.isDraggingOver ? 'bg-[#F3F4F6] border-[#9CA3AF]' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <p className="text-[13px] font-semibold text-gray-900">{c.nombre}</p>
                      <span className="text-[12px] font-medium text-[#9CA3AF] tabular-nums">{porColumna[c.id].length}</span>
                      <button
                        onClick={() => onNueva(c.id)}
                        className="ml-auto p-1 rounded-md text-[#9CA3AF] hover:text-gray-900 hover:bg-white"
                        title={`Añadir en ${c.nombre}`}
                        aria-label={`Añadir en ${c.nombre}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {lista(c.id).map((t, i) => (
                        <Draggable draggableId={String(t.id)} index={i} key={t.id}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <Tarjeta t={t} hoy={hoy} onAbrir={() => onAbrir(t.id)} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      {verMas(c.id)}
                      {c.id === 'hecho' ? pieHecho : null}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </>
  )
}

// ── semanas ──────────────────────────────────────────────────────────────────

function nombreSemana(lunes: string, hoy: string) {
  const esta = lunesDe(hoy)
  const domingo = sumarDias(lunes, 6)
  const dias = `${new Date(`${lunes}T12:00:00`).getDate()}–${fechaCorta(domingo)}`
  if (lunes === esta) return `Esta semana · ${dias}`
  if (lunes === sumarDias(esta, 7)) return `La semana que viene · ${dias}`
  if (lunes === sumarDias(esta, -7)) return `La semana pasada · ${dias}`
  return `Semana ${numeroSemana(lunes)} · ${dias}`
}

function Semanas({ tarjetas, hoy, onAbrir }: { tarjetas: TarjetaTrabajo[]; hoy: string; onAbrir: (id: number) => void }) {
  return (
    <>
      <div className="lg:hidden">
        <ListaSemanas tarjetas={tarjetas} hoy={hoy} onAbrir={onAbrir} />
      </div>
      <div className="hidden lg:block">
        <LineaTiempo tarjetas={tarjetas} hoy={hoy} onAbrir={onAbrir} />
      </div>
    </>
  )
}

/** Móvil: atrasadas, esta semana, las siguientes; lo pasado y lo sin fecha, plegados. */
function ListaSemanas({ tarjetas, hoy, onAbrir }: { tarjetas: TarjetaTrabajo[]; hoy: string; onAbrir: (id: number) => void }) {
  const [verPasado, setVerPasado] = useState(false)
  const [verSinFecha, setVerSinFecha] = useState(false)
  const g = useMemo(() => agruparPorSemana(tarjetas, hoy), [tarjetas, hoy])
  const esta = lunesDe(hoy)
  const futuras = g.semanas.filter((s) => s.lunes >= esta)
  const pasadas = g.semanas.filter((s) => s.lunes < esta).reverse()

  const bloque = (titulo: React.ReactNode, ts: TarjetaTrabajo[], clave: string) => (
    <section key={clave} className="space-y-2">
      <h3 className="text-[13px] font-semibold text-gray-900">
        {titulo} <span className="text-[#9CA3AF] font-medium tabular-nums">{ts.length}</span>
      </h3>
      {[...ts].sort(ordenColumna).map((t) => (
        <Tarjeta key={t.id} t={t} hoy={hoy} onAbrir={() => onAbrir(t.id)} conEstado />
      ))}
    </section>
  )

  return (
    <div className="space-y-5">
      {g.atrasadas.length
        ? bloque(
            <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
              <AlertTriangle size={14} /> Atrasadas
            </span>,
            g.atrasadas,
            'atrasadas'
          )
        : null}
      {!futuras.some((s) => s.lunes === esta) ? (
        <section className="space-y-1">
          <h3 className="text-[13px] font-semibold text-gray-900">{nombreSemana(esta, hoy)}</h3>
          <p className={META}>Nada con fecha para esta semana.</p>
        </section>
      ) : null}
      {futuras.map((s) => bloque(nombreSemana(s.lunes, hoy), s.tarjetas, s.lunes))}
      {pasadas.length ? (
        <div>
          <button onClick={() => setVerPasado((v) => !v)} className={BOTON}>
            {verPasado ? 'Esconder las semanas pasadas' : `Ver las semanas pasadas (${pasadas.reduce((n, s) => n + s.tarjetas.length, 0)})`}
          </button>
          {verPasado ? <div className="mt-3 space-y-5">{pasadas.map((s) => bloque(nombreSemana(s.lunes, hoy), s.tarjetas, s.lunes))}</div> : null}
        </div>
      ) : null}
      {g.sinFecha.length ? (
        <div>
          <button onClick={() => setVerSinFecha((v) => !v)} className={BOTON}>
            {verSinFecha ? 'Esconder lo que no tiene fecha' : `Sin fecha (${g.sinFecha.length})`}
          </button>
          {verSinFecha ? <div className="mt-3">{bloque('Sin fecha', g.sinFecha, 'sin-fecha')}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

/** Ordenador: una barra por tarjeta, de su inicio a su fin, sobre 10 semanas. */
function LineaTiempo({ tarjetas, hoy, onAbrir }: { tarjetas: TarjetaTrabajo[]; hoy: string; onAbrir: (id: number) => void }) {
  const [desde, setDesde] = useState(() => sumarDias(lunesDe(hoy), -14))
  const [verSinFecha, setVerSinFecha] = useState(false)
  const totalDias = SEMANAS_LINEA * 7
  const hasta = sumarDias(desde, totalDias - 1)
  const semanas = lunesSeguidos(desde, SEMANAS_LINEA)
  const pct = (dias: number) => `${(dias / totalDias) * 100}%`
  const hoyDentro = hoy >= desde && hoy <= hasta

  // Grupos plegados (por su camino). Lo que el usuario no ha tocado: plegado si
  // tiene muchas filas (una campaña con su embudo entero son ~20).
  const [plegados, setPlegados] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CLAVE_PLEGADOS) || '{}')
    } catch {
      return {}
    }
  })
  const plegado = (g: { area: string; tarjetas: unknown[] }) => plegados[g.area] ?? g.tarjetas.length > PLEGAR_DESDE
  const plegar = (area: string, si: boolean) =>
    setPlegados((v) => {
      const n = { ...v, [area]: si }
      try {
        window.localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(n))
      } catch {
        /* sin almacenamiento */
      }
      return n
    })

  const { grupos, fuera, sinFecha, hechasPorSemana } = useMemo(() => {
    const porArea = new Map<string, TarjetaTrabajo[]>()
    let fuera = 0
    const sinFecha: TarjetaTrabajo[] = []
    const hechasPorSemana: Record<string, number> = {}
    for (const t of tarjetas) {
      if (t.estado === 'hecho' && t.fin) {
        const l = lunesDe(t.fin)
        hechasPorSemana[l] = (hechasPorSemana[l] ?? 0) + 1
      }
      const r = rangoDe(t)
      if (!r) {
        sinFecha.push(t)
        continue
      }
      if (r.hasta < desde || r.desde > hasta) {
        fuera++
        continue
      }
      // Por su camino: cada campaña, su propio grupo dentro de «Campañas».
      const area = t.ruta || 'Inicio'
      porArea.set(area, [...(porArea.get(area) ?? []), t])
    }
    const grupos = Array.from(porArea.entries())
      .sort(([a], [b]) => (a === 'Inicio' ? 1 : b === 'Inicio' ? -1 : a.localeCompare(b, 'es')))
      .map(([area, ts]) => ({ area, tarjetas: ts.sort((a, b) => (rangoDe(a)!.desde < rangoDe(b)!.desde ? -1 : 1)) }))
    return { grupos, fuera, sinFecha, hechasPorSemana }
  }, [tarjetas, desde, hasta])

  /** La barra de una tarjeta (o, plegado, la de un grupo entero). Corta: el texto va al lado. */
  // Una función y no un componente: así no se vuelve a montar en cada pintada.
  function barra({ r, estado, tarde, texto, titulo, onClick }: { r: { desde: string; hasta: string }; estado: EstadoNodo; tarde: boolean; texto: string; titulo: string; onClick: () => void }) {
    const ini = r.desde < desde ? desde : r.desde
    const fin = r.hasta > hasta ? hasta : r.hasta
    const dias = diasEntre(ini, fin) + 1
    const color = BARRA[estado] ?? BARRA.pendiente
    const corta = dias <= 4
    return (
      <>
        <button
          onClick={onClick}
          title={titulo}
          className={`absolute top-1.5 h-6 px-1.5 text-[11.5px] font-medium text-left overflow-hidden whitespace-nowrap text-ellipsis ${
            r.desde < desde ? 'rounded-l-none' : 'rounded-l-md'
          } ${r.hasta > hasta ? 'rounded-r-none' : 'rounded-r-md'}`}
          style={{
            left: pct(diasEntre(desde, ini)),
            width: `max(12px, ${pct(dias)})`,
            background: color.fondo,
            color: tarde ? '#B91C1C' : color.letra,
            boxShadow: tarde ? 'inset 0 0 0 1.5px #DC2626' : estado === 'bloqueado' ? 'inset 0 0 0 1px #FCA5A5' : undefined,
          }}
        >
          {corta ? '' : texto}
        </button>
        {corta ? (
          <button
            onClick={onClick}
            className={`absolute top-1.5 h-6 flex items-center pl-1.5 text-[11.5px] whitespace-nowrap ${tarde ? 'text-[#B91C1C] font-medium' : 'text-[#4B5563]'}`}
            style={{ left: `calc(max(12px, ${pct(dias)}) + ${pct(diasEntre(desde, ini))})` }}
          >
            {texto}
          </button>
        ) : null}
      </>
    )
  }

  // El fondo de cada fila: una raya por semana y la de esta semana, tintada.
  const fondo = (
    <>
      {semanas.map((l, i) => (
        <span
          key={l}
          className={`absolute top-0 bottom-0 border-l ${i ? 'border-[#F3F4F6]' : 'border-transparent'} ${l === lunesDe(hoy) ? 'bg-[#F5F8FF]' : ''}`}
          style={{ left: pct(i * 7), width: pct(7) }}
        />
      ))}
      {hoyDentro ? <span className="absolute top-0 bottom-0 w-px bg-[#025dc7]" style={{ left: pct(diasEntre(desde, hoy) + 0.5) }} /> : null}
    </>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button onClick={() => setDesde((d) => sumarDias(d, -28))} className={BOTON} aria-label="Semanas anteriores">
          <ChevronLeft size={14} /> Antes
        </button>
        <button onClick={() => setDesde(sumarDias(lunesDe(hoy), -14))} className={BOTON}>
          Hoy
        </button>
        <button onClick={() => setDesde((d) => sumarDias(d, 28))} className={BOTON} aria-label="Semanas siguientes">
          Después <ChevronRight size={14} />
        </button>
        <p className={`${META} ml-2`}>
          {fechaCorta(desde)} – {fechaCorta(hasta)}
          {fuera ? ` · ${fuera} con fechas fuera de estas semanas` : ''}
        </p>
      </div>

      <div className={`${TARJETA} overflow-x-auto`}>
        <div style={{ minWidth: 280 + SEMANAS_LINEA * 78 }}>
          {/* Cabecera: las semanas. */}
          <div className="grid grid-cols-[280px_minmax(0,1fr)] border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] self-end">Tarea</div>
            <div className="relative h-[52px]">
              {semanas.map((l, i) => {
                const esta = l === lunesDe(hoy)
                return (
                  <div
                    key={l}
                    className={`absolute top-0 bottom-0 px-2 py-1.5 border-l ${i ? 'border-[#E5E7EB]' : 'border-transparent'} ${esta ? 'bg-[#F5F8FF]' : ''}`}
                    style={{ left: pct(i * 7), width: pct(7) }}
                  >
                    <p className={`text-[11.5px] font-semibold ${esta ? 'text-[#025dc7]' : 'text-gray-900'}`}>Sem {numeroSemana(l)}</p>
                    <p className="text-[11px] text-[#6B7280]">{fechaCorta(l)}</p>
                    {hechasPorSemana[l] ? <p className="text-[10.5px] font-medium text-[#15803D]">✓ {plural(hechasPorSemana[l], 'hecha', 'hechas')}</p> : null}
                  </div>
                )
              })}
            </div>
          </div>

          {!grupos.length ? (
            <p className="px-3 py-8 text-center text-[13px] text-[#9CA3AF]">Nada con fecha en estas semanas. Pon fechas a las tarjetas para verlas aquí.</p>
          ) : null}

          {grupos.map((g) => {
            const cerrado = plegado(g)
            // Plegado: una sola barra del grupo, de lo primero a lo último.
            const rangos = g.tarjetas.map((t) => rangoDe(t)!)
            const total = { desde: rangos.reduce((a, r) => (r.desde < a ? r.desde : a), rangos[0].desde), hasta: rangos.reduce((a, r) => (r.hasta > a ? r.hasta : a), rangos[0].hasta) }
            const hechas = g.tarjetas.filter((t) => t.estado === 'hecho').length
            const tardeGrupo = g.tarjetas.filter((t) => atrasada(t, hoy)).length
            return (
            <div key={g.area}>
              <div className="grid grid-cols-[280px_minmax(0,1fr)] bg-[#F9FAFB] border-b border-[#F3F4F6]">
                <button onClick={() => plegar(g.area, !cerrado)} className="min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[#F3F4F6]">
                  {cerrado ? <ChevronRight size={14} className="text-[#6B7280] shrink-0" /> : <ChevronDown size={14} className="text-[#6B7280] shrink-0" />}
                  <span className="text-[12px] font-semibold text-gray-900 truncate">{g.area}</span>
                  <span className="text-[#9CA3AF] text-[12px] font-medium tabular-nums shrink-0">
                    {hechas ? `${hechas}/${g.tarjetas.length}` : g.tarjetas.length}
                  </span>
                  {tardeGrupo ? <span className="text-[11px] font-medium text-[#DC2626] shrink-0">· {plural(tardeGrupo, 'atrasada', 'atrasadas')}</span> : null}
                </button>
                <div className="relative h-9 overflow-hidden">
                  {fondo}
                  {cerrado ? (
                    barra({
                      r: total,
                      estado: hechas === g.tarjetas.length ? 'hecho' : g.tarjetas.some((t) => t.estado === 'en-curso') ? 'en-curso' : 'pendiente',
                      tarde: tardeGrupo > 0,
                      texto: `${plural(g.tarjetas.length, 'tarea', 'tareas')} · ${fechaCorta(total.desde)} – ${fechaCorta(total.hasta)}`,
                      titulo: `${g.area}: ${plural(g.tarjetas.length, 'tarea', 'tareas')}, ${hechas} hechas. Clic para desplegar.`,
                      onClick: () => plegar(g.area, false),
                    })
                  ) : null}
                </div>
              </div>
              {cerrado ? null : g.tarjetas.map((t) => {
                const r = rangoDe(t)!
                const tarde = atrasada(t, hoy)
                const unDia = r.desde === r.hasta
                return (
                  <div key={t.id} className="grid grid-cols-[280px_minmax(0,1fr)] border-b border-[#F3F4F6] hover:bg-[#FCFCFD] group">
                    <button onClick={() => onAbrir(t.id)} className="min-w-0 flex items-center gap-2 px-3 py-1.5 text-left">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLUMNA[t.estado]?.color }} title={COLUMNA[t.estado]?.nombre} />
                      <span className={`text-[13px] truncate group-hover:underline ${t.estado === 'hecho' ? 'text-[#6B7280]' : 'text-gray-900'}`}>{t.titulo || 'Sin título'}</span>
                      <span className="ml-auto shrink-0">
                        <Avatares personas={t.personas} tam={18} />
                      </span>
                    </button>
                    <div className="relative h-9 overflow-hidden">
                      {fondo}
                      {barra({
                        r,
                        estado: t.estado,
                        tarde,
                        texto: t.titulo,
                        titulo: `${t.titulo} · ${fechaCorta(r.desde)}${unDia ? '' : ` – ${fechaCorta(r.hasta)}`} · ${COLUMNA[t.estado]?.nombre}${tarde ? ' · atrasada' : ''}`,
                        onClick: () => onAbrir(t.id),
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {COLUMNAS.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280]">
            <span className="w-4 h-2.5 rounded-sm" style={{ background: BARRA[c.id].fondo }} />
            {c.nombre}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <span className="w-4 h-2.5 rounded-sm" style={{ boxShadow: 'inset 0 0 0 1.5px #DC2626' }} />
          Atrasada
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <span className="w-px h-3 bg-[#025dc7]" />
          Hoy
        </span>
      </div>

      {sinFecha.length ? (
        <div>
          <button onClick={() => setVerSinFecha((v) => !v)} className={BOTON}>
            {verSinFecha ? 'Esconder lo que no tiene fecha' : `Sin fecha (${sinFecha.length})`}
          </button>
          {verSinFecha ? (
            <div className="mt-3 grid grid-cols-2 xl:grid-cols-3 gap-2">
              {[...sinFecha].sort(ordenColumna).map((t) => (
                <Tarjeta key={t.id} t={t} hoy={hoy} onAbrir={() => onAbrir(t.id)} conEstado />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── nueva tarea ──────────────────────────────────────────────────────────────

function VentanaNueva({
  estado: estadoInicial,
  areas,
  personas,
  area: areaInicial,
  persona,
  onCancelar,
  onCrear,
}: {
  estado: EstadoNodo
  areas: { id: number; titulo: string }[]
  personas: string[]
  area: number | null
  persona: string
  onCancelar: () => void
  /** true si se creó. Con `abrirla`, se abre su página para seguir. */
  onCrear: (campos: { titulo: string; area_id: number | null; estado: EstadoNodo; responsable: string; vence: string }, abrirla: boolean) => Promise<boolean>
}) {
  const ULTIMA = 'nawar.vision.tablero.area'
  const [titulo, setTitulo] = useState('')
  const [estado, setEstado] = useState<EstadoNodo>(estadoInicial)
  const [area, setArea] = useState<number | null>(() => {
    if (areaInicial) return areaInicial
    try {
      const v = Number(window.localStorage.getItem(ULTIMA))
      return areas.some((a) => a.id === v) ? v : null
    } catch {
      return null
    }
  })
  const [responsable, setResponsable] = useState(persona)
  const [vence, setVence] = useState('')
  const [creando, setCreando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCancelar])

  async function crear(abrirla: boolean) {
    if (!titulo.trim() || creando) return
    setCreando(true)
    try {
      window.localStorage.setItem(ULTIMA, String(area ?? ''))
    } catch {
      /* sin almacenamiento */
    }
    const ok = await onCrear({ titulo: titulo.trim(), area_id: area, estado, responsable, vence }, abrirla)
    setCreando(false)
    if (ok && !abrirla) {
      // Para seguir apuntando: se queda abierta y vacía.
      setTitulo('')
      setVence('')
      entrada.current?.focus()
    }
  }

  const campo = 'w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13.5px] text-gray-900 outline-none focus:border-gray-900'
  const rotulo = 'block text-[12px] font-medium text-[#6B7280] mb-1'

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-3" role="dialog" aria-modal="true" onClick={onCancelar}>
      <div className="w-full max-w-md rounded-lg bg-white border border-[#E5E7EB] p-5 space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-gray-900">Nueva tarea</h2>
          <button onClick={onCancelar} className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Cerrar">
            <X size={17} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            crear(false)
          }}
          className="space-y-3.5"
        >
          <input
            ref={entrada}
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Qué hay que hacer"
            className="w-full h-10 rounded-md border border-[#E5E7EB] px-3 text-[15px] text-gray-900 outline-none focus:border-gray-900"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <span className={rotulo}>Área</span>
              <select value={area ?? ''} onChange={(e) => setArea(e.target.value ? Number(e.target.value) : null)} className={campo}>
                <option value="">Sin área (Inicio)</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={rotulo}>Columna</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoNodo)} className={campo}>
                {COLUMNAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className={rotulo}>Encargados</span>
            <PersonasCampo valor={responsable} onCambio={setResponsable} sugerencias={personas} />
          </div>
          <label className="block">
            <span className={rotulo}>Para cuándo</span>
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className={campo} />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => crear(true)} disabled={!titulo.trim() || creando} className={BOTON}>
              Crear y abrir
            </button>
            <button type="submit" disabled={!titulo.trim() || creando} className={BOTON_PRINCIPAL}>
              {creando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear
            </button>
          </div>
          <p className={META}>Va al mapa de su área, debajo de lo que haya. «Crear» deja la ventana abierta para apuntar otra.</p>
        </form>
      </div>
    </div>
  )
}
