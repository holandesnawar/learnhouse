'use client'

/**
 * El mapa de Visión: tarjetas que se arrastran y se unen con flechas, cada
 * vertical y cada campaña con su propio mapa dentro (submapa), migas de pan
 * para volver, y varios mapas abiertos a la vez en pestañas (se recuerdan en
 * el navegador).
 *
 * - Arrastrar desde el borde de una tarjeta a otra = flecha. Clic en una
 *   flecha = ponerle texto o borrarla.
 * - Doble clic en una tarjeta = su página (PaginaNodo).
 * - Todo se guarda solo: dónde queda cada tarjeta al soltarla y dónde se
 *   quedó la vista del mapa.
 * - Borrar con el teclado está apagado a propósito: una tarjeta se borra
 *   desde su página, con aviso (puede llevar un mapa entero dentro).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, ChevronRight, Loader2, Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  TIPOS,
  abrirSubmapa,
  borrarFlecha,
  cambiarFlecha,
  crearFlecha,
  crearNodo,
  getMapa,
  getUrgente,
  guardarVista,
  moverNodos,
  fechaCorta,
  type MapaVision,
  type MetricaInfo,
  type NodoVision,
  type TipoNodo,
} from '@services/vision/vision'
import TarjetaNodo, { type DatosTarjeta, type NodoFlow } from './TarjetaNodo'
import PaginaNodo from './PaginaNodo'
import { BOTON, BOTON_PELIGRO, META, filtro } from '../Panel/ui'

const TIPOS_DE_NODO: NodeTypes = { tarjeta: TarjetaNodo }

type Pestana = { id: string; mapaId: number | null; nombre: string }
const CLAVE_PESTANAS = 'nawar.vision.pestanas'

function leerPestanas(): { pestanas: Pestana[]; activa: string } | null {
  try {
    const d = JSON.parse(window.localStorage.getItem(CLAVE_PESTANAS) || 'null')
    if (!d || !Array.isArray(d.pestanas) || !d.pestanas.length) return null
    const pestanas = d.pestanas
      .filter((p: any) => p && typeof p.id === 'string')
      .map((p: any) => ({ id: p.id, mapaId: typeof p.mapaId === 'number' ? p.mapaId : null, nombre: String(p.nombre || 'Mapa') }))
      .slice(0, 12)
    if (!pestanas.length) return null
    return { pestanas, activa: pestanas.some((p: Pestana) => p.id === d.activa) ? d.activa : pestanas[0].id }
  } catch {
    return null
  }
}

/** Por qué lado sale y entra cada flecha: el que mira a la otra tarjeta. */
function lados(a: NodoFlow, b: NodoFlow): { s: string; t: string } {
  const ca = { x: a.position.x + (a.measured?.width ?? 236) / 2, y: a.position.y + (a.measured?.height ?? 100) / 2 }
  const cb = { x: b.position.x + (b.measured?.width ?? 236) / 2, y: b.position.y + (b.measured?.height ?? 100) / 2 }
  const dx = cb.x - ca.x
  const dy = cb.y - ca.y
  if (Math.abs(dx) * 0.6 > Math.abs(dy)) return dx > 0 ? { s: 'r', t: 'l' } : { s: 'l', t: 'r' }
  return dy > 0 ? { s: 'b', t: 't' } : { s: 't', t: 'b' }
}

/** Un sitio libre cerca de `centro` para una tarjeta nueva: no encima de otra. */
function huecoLibre(centro: { x: number; y: number }, nodos: NodoFlow[]): { x: number; y: number } {
  const W = 250
  const H = 140
  const ocupados = nodos.map((n) => ({ x: n.position.x, y: n.position.y, w: n.measured?.width ?? 240, h: n.measured?.height ?? 110 }))
  const libre = (x: number, y: number) =>
    ocupados.every((o) => x + W + 16 < o.x || o.x + o.w + 16 < x || y + H + 16 < o.y || o.y + o.h + 16 < y)
  const x0 = centro.x - W / 2
  const y0 = centro.y - H / 2
  for (let r = 0; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = x0 + dx * (W + 30)
        const y = y0 + dy * (H + 30)
        if (libre(x, y)) return { x: Math.round(x), y: Math.round(y) }
      }
    }
  }
  return { x: Math.round(x0), y: Math.round(y0) }
}

type Ir = { mapaId: number | null; foco?: number; vez: number }

/** Las pestañas de mapas abiertos y el mapa de la pestaña activa. */
export default function MapasVision({
  orgId,
  token,
  campanas,
  metricas,
  ir,
  onVerCampana,
  onCambioCampanas,
}: {
  orgId: number
  token: string
  campanas: { id: number; titulo: string }[]
  metricas: Record<string, MetricaInfo>
  /** Para abrir un mapa desde fuera (la tabla de campañas). */
  ir?: Ir | null
  onVerCampana: (id: number) => void
  /** Algo de una campaña ha cambiado (título, utm…): que se recargue la lista. */
  onCambioCampanas: () => void
}) {
  const [estado, setEstado] = useState<{ pestanas: Pestana[]; activa: string }>(
    () => leerPestanas() ?? { pestanas: [{ id: 'inicio', mapaId: null, nombre: 'Inicio' }], activa: 'inicio' }
  )
  const [foco, setFoco] = useState<{ id: number; vez: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_PESTANAS, JSON.stringify(estado))
    } catch {
      /* sin almacenamiento: las pestañas no se recuerdan, y ya */
    }
  }, [estado])

  const activa = estado.pestanas.find((p) => p.id === estado.activa) ?? estado.pestanas[0]

  const irA = useCallback((mapaId: number | null, opciones: { nueva?: boolean; foco?: number } = {}) => {
    setEstado((e) => {
      const ya = e.pestanas.find((p) => p.mapaId === mapaId)
      if (opciones.nueva) {
        if (ya) return { ...e, activa: ya.id }
        const id = `p${Date.now()}`
        return { pestanas: [...e.pestanas, { id, mapaId, nombre: '…' }].slice(-12), activa: id }
      }
      return {
        ...e,
        pestanas: e.pestanas.map((p) => (p.id === e.activa ? { ...p, mapaId, nombre: p.mapaId === mapaId ? p.nombre : '…' } : p)),
      }
    })
    setFoco(opciones.foco ? { id: opciones.foco, vez: Date.now() } : null)
  }, [])

  useEffect(() => {
    if (ir) irA(ir.mapaId, { foco: ir.foco })
  }, [ir, irA])

  const nombrar = useCallback((pestanaId: string, nombre: string) => {
    setEstado((e) => ({ ...e, pestanas: e.pestanas.map((p) => (p.id === pestanaId && p.nombre !== nombre ? { ...p, nombre } : p)) }))
  }, [])

  function cerrar(id: string) {
    setEstado((e) => {
      if (e.pestanas.length < 2) return e
      const i = e.pestanas.findIndex((p) => p.id === id)
      const pestanas = e.pestanas.filter((p) => p.id !== id)
      return { pestanas, activa: e.activa === id ? pestanas[Math.max(0, i - 1)].id : e.activa }
    })
  }

  return (
    <div className="space-y-0">
      <div className="flex items-end gap-1 overflow-x-auto border-b border-[#E5E7EB] -mb-px">
        {estado.pestanas.map((p) => {
          const sel = p.id === activa.id
          return (
            <div
              key={p.id}
              className={`group shrink-0 inline-flex items-center gap-1 h-9 pl-3 pr-1.5 rounded-t-md border text-[13px] font-medium cursor-pointer ${
                sel ? 'bg-white border-[#E5E7EB] border-b-white text-gray-900' : 'bg-transparent border-transparent text-[#6B7280] hover:text-gray-900'
              }`}
              onClick={() => setEstado((e) => ({ ...e, activa: p.id }))}
            >
              <span className="max-w-[160px] truncate">{p.nombre}</span>
              {estado.pestanas.length > 1 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    cerrar(p.id)
                  }}
                  className="p-0.5 rounded text-[#9CA3AF] hover:text-gray-900 hover:bg-[#F3F4F6]"
                  aria-label={`Cerrar ${p.nombre}`}
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="w-1" />
              )}
            </div>
          )
        })}
        <button
          onClick={() => irA(null, { nueva: true })}
          className="shrink-0 mb-1 ml-1 p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-gray-900"
          aria-label="Abrir Inicio en otra pestaña"
          title="Abrir Inicio en otra pestaña"
        >
          <Plus size={15} />
        </button>
      </div>

      <ReactFlowProvider key={`${activa.id}-${activa.mapaId ?? 'inicio'}`}>
        <Lienzo
          orgId={orgId}
          token={token}
          mapaId={activa.mapaId}
          foco={foco}
          campanas={campanas}
          metricas={metricas}
          onIr={irA}
          onNombre={(nombre) => nombrar(activa.id, nombre)}
          onVerCampana={onVerCampana}
          onCambioCampanas={onCambioCampanas}
        />
      </ReactFlowProvider>
    </div>
  )
}

function Lienzo({
  orgId,
  token,
  mapaId,
  foco,
  campanas,
  metricas,
  onIr,
  onNombre,
  onVerCampana,
  onCambioCampanas,
}: {
  orgId: number
  token: string
  mapaId: number | null
  foco: { id: number; vez: number } | null
  campanas: { id: number; titulo: string }[]
  metricas: Record<string, MetricaInfo>
  onIr: (mapaId: number | null, opciones?: { nueva?: boolean; foco?: number }) => void
  onNombre: (nombre: string) => void
  onVerCampana: (id: number) => void
  onCambioCampanas: () => void
}) {
  const rf = useReactFlow<NodoFlow>()
  const listas = useNodesInitialized()
  const caja = useRef<HTMLDivElement>(null)
  const [datos, setDatos] = useState<MapaVision | null>(null)
  const [error, setError] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState<NodoFlow>([])
  const [abierto, setAbierto] = useState<{ id: number; nueva: boolean } | null>(null)
  const [flechaSel, setFlechaSel] = useState<number | null>(null)
  const [textoFlecha, setTextoFlecha] = useState('')
  const [soloUrgente, setSoloUrgente] = useState(false)
  const [menu, setMenu] = useState(false)
  const [urgentes, setUrgentes] = useState<(NodoVision & { ruta: string })[] | null>(null)
  const [verUrgentes, setVerUrgentes] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const encuadrado = useRef(false)
  const tocadoCampana = useRef(false)

  const cargar = useCallback(
    async (quieto = false) => {
      const r = await getMapa(orgId, mapaId, token)
      if (!r.ok || !r.datos) {
        if (!quieto) setError(r.error || 'No se ha podido abrir el mapa')
        return
      }
      setError('')
      setDatos(r.datos)
      onNombre(r.datos.mapa.nombre || 'Inicio')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, mapaId, token]
  )

  const cargarUrgentes = useCallback(async () => {
    const r = await getUrgente(orgId, token)
    if (r.ok && r.datos) setUrgentes(r.datos.nodos)
  }, [orgId, token])

  useEffect(() => {
    cargar()
    cargarUrgentes()
  }, [cargar, cargarUrgentes])

  // Venir desde fuera a una tarjeta concreta: se abre su página.
  useEffect(() => {
    if (foco && datos?.nodos.some((n) => n.id === foco.id)) setAbierto({ id: foco.id, nueva: false })
  }, [foco, datos?.mapa.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // La vista guardada, o encuadrar todo la primera vez.
  useEffect(() => {
    if (!listas || !datos || encuadrado.current) return
    encuadrado.current = true
    const v = datos.mapa.vista
    if (v && typeof v.zoom === 'number' && v.zoom > 0) rf.setViewport({ x: v.x ?? 0, y: v.y ?? 0, zoom: v.zoom })
    else rf.fitView({ padding: 0.25, maxZoom: 1 })
  }, [listas, datos, rf])

  const abrirMapaDe = useCallback(
    async (n: NodoVision, nueva: boolean) => {
      let destino = n.submapa_id
      if (!destino) {
        const r = await abrirSubmapa(orgId, n.id, token)
        if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido crear su mapa')
        destino = r.datos.mapa_id
        setDatos((d) => d && { ...d, nodos: d.nodos.map((x) => (x.id === n.id ? { ...x, submapa_id: destino } : x)) })
      }
      setAbierto(null)
      onIr(destino, { nueva })
    },
    [orgId, token, onIr]
  )
  // El botón de la tarjeta necesita una función que no cambie (la tarjeta va memorizada).
  const abrirRef = useRef(abrirMapaDe)
  abrirRef.current = abrirMapaDe
  const onAbrirTarjeta = useCallback((n: NodoVision) => abrirRef.current(n, false), [])

  const tituloCampana = useMemo(() => new Map(campanas.map((c) => [c.id, c.titulo])), [campanas])

  const datosPorId = useMemo(() => {
    const m: Record<string, DatosTarjeta> = {}
    for (const n of datos?.nodos ?? []) {
      const cid = n.tipo === 'campana' ? n.id : n.tipo === 'metrica' ? Number(n.metrica.campana_id || 0) : 0
      m[String(n.id)] = {
        nodo: n,
        cifras: cid ? datos?.cifras[String(cid)] : undefined,
        campanaTitulo: n.tipo === 'metrica' && cid ? tituloCampana.get(cid) : undefined,
        metricas,
        atenuado: soloUrgente && !n.urgente,
        onAbrir: onAbrirTarjeta,
      }
    }
    return m
  }, [datos?.nodos, datos?.cifras, tituloCampana, metricas, soloUrgente, onAbrirTarjeta])

  // Las tarjetas de React Flow siguen a los datos; la posición manda la de pantalla.
  useEffect(() => {
    setNodes((prev) => {
      const porId = new Map(prev.map((p) => [p.id, p]))
      return (datos?.nodos ?? []).map((n) => {
        const id = String(n.id)
        const p = porId.get(id)
        const data = datosPorId[id]
        if (p) return p.data === data ? p : { ...p, data }
        return { id, type: 'tarjeta' as const, position: { x: n.x, y: n.y }, data }
      })
    })
  }, [datos?.nodos, datosPorId, setNodes])

  const edges = useMemo<Edge[]>(() => {
    const porId = new Map(nodes.map((n) => [n.id, n]))
    const urgente = new Set((datos?.nodos ?? []).filter((n) => n.urgente).map((n) => String(n.id)))
    return (datos?.flechas ?? []).flatMap((f) => {
      const a = porId.get(String(f.origen))
      const b = porId.get(String(f.destino))
      if (!a || !b) return []
      const { s, t } = lados(a, b)
      const sel = flechaSel === f.id
      const apagada = soloUrgente && !(urgente.has(a.id) && urgente.has(b.id))
      const color = sel ? '#025dc7' : '#9CA3AF'
      return [
        {
          id: String(f.id),
          source: a.id,
          target: b.id,
          sourceHandle: s,
          targetHandle: t,
          label: f.etiqueta || undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          style: { stroke: color, strokeWidth: sel ? 2 : 1.5, opacity: apagada ? 0.2 : 1 },
          labelStyle: { fontSize: 12, fill: '#374151', fontWeight: 500 },
          labelBgStyle: { fill: '#FFFFFF' },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          interactionWidth: 16,
        },
      ]
    })
  }, [datos?.flechas, datos?.nodos, nodes, flechaSel, soloUrgente])

  const onConnect = useCallback(
    async (c: Connection) => {
      if (!datos || !c.source || !c.target || c.source === c.target) return
      const repetida = datos.flechas.some(
        (f) =>
          (String(f.origen) === c.source && String(f.destino) === c.target) ||
          (String(f.origen) === c.target && String(f.destino) === c.source)
      )
      if (repetida) return
      const r = await crearFlecha(orgId, { mapa_id: datos.mapa.id, origen: Number(c.source), destino: Number(c.target) }, token)
      if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido unir')
      setDatos((d) => d && { ...d, flechas: [...d.flechas, r.datos!] })
    },
    [datos, orgId, token]
  )

  // Soltar la flecha encima de la tarjeta (y no justo en su puntito) también une.
  const onConnectEnd = useCallback(
    (ev: MouseEvent | TouchEvent, estado: FinalConnectionState) => {
      if (estado.isValid || !estado.fromNode) return
      const p = 'changedTouches' in ev ? ev.changedTouches[0] : ev
      if (!p) return
      const destino = document.elementFromPoint(p.clientX, p.clientY)?.closest('.react-flow__node')?.getAttribute('data-id')
      if (destino && destino !== estado.fromNode.id) onConnect({ source: estado.fromNode.id, target: destino, sourceHandle: null, targetHandle: null })
    },
    [onConnect]
  )

  const onDragStop = useCallback(
    async (_: unknown, __: unknown, arrastradas: NodoFlow[]) => {
      if (!arrastradas.length) return
      const r = await moverNodos(
        orgId,
        arrastradas.map((n) => ({ id: Number(n.id), x: Math.round(n.position.x), y: Math.round(n.position.y) })),
        token
      )
      if (!r.ok) toast.error('No se ha podido guardar dónde está')
    },
    [orgId, token]
  )

  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      if (!datos) return
      if (reloj.current) clearTimeout(reloj.current)
      const id = datos.mapa.id
      reloj.current = setTimeout(() => void guardarVista(orgId, id, { x: Math.round(vp.x), y: Math.round(vp.y), zoom: vp.zoom }, token), 900)
    },
    [datos, orgId, token]
  )

  async function anadir(tipo: TipoNodo) {
    setMenu(false)
    if (!datos) return
    const r = caja.current?.getBoundingClientRect()
    const centro = r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 }
    const sitio = huecoLibre(centro, rf.getNodes())
    const res = await crearNodo(orgId, { mapa_id: datos.mapa.id, tipo, x: sitio.x, y: sitio.y }, token)
    if (!res.ok || !res.datos) return toast.error(res.error || 'No se ha podido crear')
    setDatos((d) => d && { ...d, nodos: [...d.nodos, res.datos!] })
    setAbierto({ id: res.datos.id, nueva: true })
    if (tipo === 'campana') onCambioCampanas()
  }

  const flecha = datos?.flechas.find((f) => f.id === flechaSel) ?? null

  async function guardarTextoFlecha() {
    if (!flecha) return
    const r = await cambiarFlecha(orgId, flecha.id, textoFlecha.trim(), token)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido guardar')
    setDatos((d) => d && { ...d, flechas: d.flechas.map((f) => (f.id === flecha.id ? r.datos! : f)) })
    setFlechaSel(null)
  }

  async function quitarFlecha() {
    if (!flecha) return
    const r = await borrarFlecha(orgId, flecha.id, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    setDatos((d) => d && { ...d, flechas: d.flechas.filter((f) => f.id !== flecha.id) })
    setFlechaSel(null)
  }

  const nodoAbierto = abierto ? datos?.nodos.find((n) => n.id === abierto.id) ?? null : null
  const nUrgentes = urgentes?.length ?? 0

  if (error) {
    return (
      <div className="rounded-b-lg rounded-tr-lg border border-[#E5E7EB] bg-white p-8 text-center space-y-3">
        <p className="text-[14px] text-gray-700">{error}</p>
        <button onClick={() => onIr(null)} className={BOTON}>
          Volver a Inicio
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-b-lg rounded-tr-lg border border-[#E5E7EB] bg-white">
      {/* Barra: migas de pan, añadir, lo urgente. */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#F3F4F6]">
        <nav className="flex items-center gap-0.5 min-w-0 text-[13px]">
          {(datos?.migas ?? []).map((m, i, todas) => (
            <React.Fragment key={m.mapa_id}>
              {i ? <ChevronRight size={13} className="text-[#D1D5DB] shrink-0" /> : null}
              {i === todas.length - 1 ? (
                <span className="font-semibold text-gray-900 truncate max-w-[200px]">{m.nombre}</span>
              ) : (
                <button onClick={() => onIr(i === 0 ? null : m.mapa_id)} className="text-[#6B7280] hover:text-gray-900 truncate max-w-[160px]">
                  {m.nombre}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className="flex-1" />
        <button onClick={() => setSoloUrgente((v) => !v)} className={filtro(soloUrgente)}>
          Solo urgente
        </button>
        <div className="relative">
          <button
            onClick={() => {
              setVerUrgentes((v) => !v)
              cargarUrgentes()
            }}
            className={BOTON}
          >
            <AlertTriangle size={14} className={nUrgentes ? 'text-[#DC2626]' : 'text-[#9CA3AF]'} />
            Lo urgente{nUrgentes ? <span className="tabular-nums font-semibold text-[#DC2626]">{nUrgentes}</span> : null}
          </button>
          {verUrgentes ? (
            <>
              <button aria-label="Cerrar" className="fixed inset-0 z-20 cursor-default" onClick={() => setVerUrgentes(false)} />
              <div className="absolute right-0 top-10 z-30 w-[320px] max-h-[360px] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-1.5">
                {!urgentes ? (
                  <p className={`${META} p-3`}>Cargando…</p>
                ) : !urgentes.length ? (
                  <p className={`${META} p-3`}>Nada urgente sin hacer. Marca una tarjeta como Urgente y saldrá aquí, esté en el mapa que esté.</p>
                ) : (
                  urgentes.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setVerUrgentes(false)
                        if (datos && u.mapa_id === datos.mapa.id) setAbierto({ id: u.id, nueva: false })
                        else onIr(u.mapa_id, { foco: u.id })
                      }}
                      className="w-full text-left rounded-md px-2.5 py-2 hover:bg-[#F9FAFB]"
                    >
                      <p className="text-[13.5px] font-medium text-gray-900 truncate">{u.titulo}</p>
                      <p className={`${META} truncate`}>
                        {u.ruta}
                        {u.vence ? ` · vence ${fechaCorta(u.vence)}` : ''}
                        {u.importante ? ' · importante' : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-gray-900 text-white text-[13px] font-medium hover:bg-black">
            <Plus size={14} /> Añadir
          </button>
          {menu ? (
            <>
              <button aria-label="Cerrar" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-10 z-30 w-[280px] rounded-lg border border-[#E5E7EB] bg-white p-1.5">
                {TIPOS.map((t) => (
                  <button key={t.id} onClick={() => anadir(t.id)} className="w-full text-left rounded-md px-2.5 py-2 hover:bg-[#F9FAFB]">
                    <span className="flex items-center gap-2 text-[13.5px] font-medium text-gray-900">
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                      {t.nombre}
                    </span>
                    <span className={`${META} block pl-4`}>{t.que}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div ref={caja} className="relative h-[calc(100vh-290px)] min-h-[460px]">
        {!datos ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" size={26} />
          </div>
        ) : (
          <ReactFlow<NodoFlow>
            nodes={nodes}
            edges={edges}
            nodeTypes={TIPOS_DE_NODO}
            onNodesChange={onNodesChange}
            onNodeDragStop={onDragStop}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onMoveEnd={onMoveEnd}
            onNodeDoubleClick={(_, n) => setAbierto({ id: Number(n.id), nueva: false })}
            onEdgeClick={(_, e) => {
              const f = datos.flechas.find((x) => String(x.id) === e.id)
              setFlechaSel(f?.id ?? null)
              setTextoFlecha(f?.etiqueta ?? '')
            }}
            onPaneClick={() => setFlechaSel(null)}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: '#025dc7', strokeWidth: 1.5 }}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            edgesReconnectable={false}
            minZoom={0.15}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#D9DEE7" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              className="!hidden md:!block"
              pannable
              zoomable
              nodeColor={(n) => TIPOS.find((t) => t.id === (n.data as DatosTarjeta)?.nodo?.tipo)?.color ?? '#9CA3AF'}
              nodeStrokeWidth={0}
              maskColor="rgba(243,244,246,0.7)"
            />
          </ReactFlow>
        )}

        {datos && !datos.nodos.length ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-[340px] text-center">
              <p className="text-[15px] font-semibold text-gray-900">Este mapa está vacío</p>
              <p className={`${META} mt-1`}>
                Pulsa «Añadir» para poner la primera tarjeta. Luego arrastra desde su borde hasta otra para unirlas con una flecha.
              </p>
            </div>
          </div>
        ) : null}

        {flecha ? (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 w-[min(420px,calc(100%-24px))] rounded-lg border border-[#E5E7EB] bg-white p-3 space-y-2">
            <p className="text-[13px] font-semibold text-gray-900">Flecha</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                guardarTextoFlecha()
              }}
              className="flex gap-1.5"
            >
              <input
                autoFocus
                value={textoFlecha}
                onChange={(e) => setTextoFlecha(e.target.value)}
                placeholder="Texto de la flecha (opcional): «lleva a», «paga»…"
                className="flex-1 min-w-0 h-8 rounded-md border border-[#E5E7EB] px-2.5 text-[13px] outline-none focus:border-gray-900"
              />
              <button type="submit" className={BOTON}>
                Guardar
              </button>
            </form>
            <div className="flex justify-between">
              <button onClick={quitarFlecha} className={BOTON_PELIGRO}>
                <Trash2 size={13} /> Borrar flecha
              </button>
              <button onClick={() => setFlechaSel(null)} className={BOTON}>
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className={`${META} px-3 py-2 border-t border-[#F3F4F6] hidden sm:block`}>
        Doble clic en una tarjeta para abrir su página · arrastra desde su borde hasta otra para unirlas · clic en una flecha para ponerle texto o borrarla
      </p>

      {nodoAbierto ? (
        <PaginaNodo
          key={nodoAbierto.id}
          orgId={orgId}
          token={token}
          nodo={nodoAbierto}
          nueva={abierto?.nueva}
          campanas={campanas}
          metricas={metricas}
          onCambio={(n) => {
            if (n.tipo === 'campana' || n.tipo === 'metrica' || nodoAbierto.tipo === 'campana') tocadoCampana.current = true
            setDatos((d) => d && { ...d, nodos: d.nodos.map((x) => (x.id === n.id ? n : x)) })
          }}
          onBorrado={(id) => {
            setAbierto(null)
            if (nodoAbierto.tipo === 'campana') onCambioCampanas()
            setDatos(
              (d) =>
                d && {
                  ...d,
                  nodos: d.nodos.filter((x) => x.id !== id),
                  flechas: d.flechas.filter((f) => f.origen !== id && f.destino !== id),
                }
            )
            cargarUrgentes()
          }}
          onAbrirMapa={abrirMapaDe}
          onVerCampana={(n) => {
            setAbierto(null)
            onVerCampana(n.id)
          }}
          onClose={() => {
            setAbierto(null)
            cargarUrgentes()
            // Las cifras dependen del utm y de la campaña elegida: se piden otra vez.
            if (tocadoCampana.current) {
              tocadoCampana.current = false
              cargar(true)
              onCambioCampanas()
            }
          }}
        />
      ) : null}
    </div>
  )
}
