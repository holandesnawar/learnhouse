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
 *
 * 17/10 ("pantalla completa, más orden, más simple para ideas, y con un plus
 * crear algo dentro sin estar deslizando y uniendo flechas"):
 * - «+» en el borde de cada tarjeta: otra unida a ella (con su flecha), o
 *   dentro de su mapa si es una vertical o una campaña. Con una tarjeta
 *   elegida, Tab crea una unida y Intro una hermana (como en los programas de
 *   mapas mentales). Lo nuevo se escribe en la propia tarjeta.
 * - Doble clic en el fondo: una nota (idea) ahí mismo.
 * - «Ordenar» coloca todo como un mapa mental (`lib/nawar/ordenarMapa.ts`),
 *   con «Deshacer». Al arrastrar, las tarjetas se ajustan a una rejilla.
 * - Pantalla completa de verdad: el mapa ocupa toda la ventana (y el
 *   navegador pasa a pantalla completa si lo deja). El botón de las esquinas
 *   que parecía de pantalla completa era «encajar»: ahora se llama «Ver todo».
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
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
import { AlertTriangle, ChevronRight, Loader2, Maximize2, Minimize2, Network, Plus, X, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  TIPOS,
  abrirSubmapa,
  borrarFlecha,
  cambiarFlecha,
  cambiarNodo,
  crearClaseGratuita,
  utmDeClase,
  crearFlecha,
  crearNodo,
  getMapa,
  getUrgente,
  guardarVista,
  moverNodos,
  fechaCorta,
  type FlechaVision,
  type MapaVision,
  type MetricaInfo,
  type NodoVision,
  type TipoNodo,
} from '@services/vision/vision'
import TarjetaNodo, { type DatosTarjeta, type NodoFlow } from './TarjetaNodo'
import PaginaNodo from './PaginaNodo'
import { ordenarMapa } from '@lib/nawar/ordenarMapa'
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

/** Dónde poner una tarjeta nueva unida a `padre`: hacia fuera (del lado
 *  contrario a su propio padre, o del lado donde ya tiene las suyas), debajo
 *  de las que ya cuelgan de ella por ese lado y sin pisar ninguna. */
function sitioAlLado(padre: NodoFlow, nodos: NodoFlow[], hijos: string[], abuelo?: NodoFlow): { x: number; y: number } {
  const W = 236
  const H = 110
  const centro = (n: NodoFlow) => n.position.x + (n.measured?.width ?? 236) / 2
  const suyos = nodos.filter((n) => hijos.includes(n.id))
  let lado = 1
  if (suyos.length) lado = suyos.filter((n) => centro(n) >= centro(padre)).length * 2 >= suyos.length ? 1 : -1
  else if (abuelo) lado = centro(padre) >= centro(abuelo) ? 1 : -1
  const x = lado === 1 ? padre.position.x + (padre.measured?.width ?? 236) + 110 : padre.position.x - W - 110
  const ocupados = nodos.map((n) => ({ x: n.position.x, y: n.position.y, w: n.measured?.width ?? 236, h: n.measured?.height ?? 100 }))
  const libre = (y: number) => ocupados.every((o) => x + W + 16 < o.x || o.x + o.w + 16 < x || y + H + 16 < o.y || o.y + o.h + 16 < y)
  const deEseLado = suyos.filter((n) => (lado === 1 ? centro(n) >= centro(padre) : centro(n) < centro(padre)))
  let y = deEseLado.length ? Math.max(...deEseLado.map((n) => n.position.y + (n.measured?.height ?? 100))) + 28 : padre.position.y
  for (let i = 0; i < 60 && !libre(y); i++) y += 30
  return { x: Math.round(x / 12) * 12, y: Math.round(y / 12) * 12 }
}

/** Las que se escriben en la propia tarjeta; campaña y métrica abren su página (hay que configurarlas). */
const CON_PAGINA: TipoNodo[] = ['campana', 'metrica']
const NOMBRE_EN_MENU: Partial<Record<TipoNodo, string>> = { nota: 'Nota / idea' }

type Ir = { mapaId: number | null; foco?: number; vez: number }
type Foco = { id: number; vez: number; editar?: boolean }

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
  const [foco, setFoco] = useState<Foco | null>(null)
  // Pantalla completa: el mapa ocupa toda la ventana y, si el navegador lo
  // deja, la pantalla entera (en el iPhone no: ahí solo la ventana).
  const [completa, setCompleta] = useState(false)
  const nativa = useRef(false)
  const ponerCompleta = useCallback(async (si: boolean) => {
    setCompleta(si)
    try {
      if (si && document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        nativa.current = true
      } else if (!si && document.fullscreenElement) {
        nativa.current = false
        await document.exitFullscreen()
      }
    } catch {
      /* el navegador no deja: se queda en la ventana entera, que ya sirve */
    }
  }, [])
  useEffect(() => {
    // Salir con Esc de la pantalla completa del navegador sale también de aquí.
    const alCambiar = () => {
      if (!document.fullscreenElement && nativa.current) {
        nativa.current = false
        setCompleta(false)
      }
    }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar)
      if (document.fullscreenElement && nativa.current) document.exitFullscreen().catch(() => {})
    }
  }, [])
  useEffect(() => {
    if (!completa) return
    // Sin la del navegador (iPhone), Esc también sale, salvo con una ventana abierta.
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) ponerCompleta(false)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [completa, ponerCompleta])

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_PESTANAS, JSON.stringify(estado))
    } catch {
      /* sin almacenamiento: las pestañas no se recuerdan, y ya */
    }
  }, [estado])

  const activa = estado.pestanas.find((p) => p.id === estado.activa) ?? estado.pestanas[0]

  const irA = useCallback((mapaId: number | null, opciones: { nueva?: boolean; foco?: number; editar?: boolean } = {}) => {
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
    setFoco(opciones.foco ? { id: opciones.foco, vez: Date.now(), editar: opciones.editar } : null)
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
    <div className={completa ? 'fixed inset-0 z-[999] flex flex-col bg-[#F3F4F6] p-2 sm:p-3' : ''}>
      <div className="shrink-0 flex items-end gap-1 overflow-x-auto border-b border-[#E5E7EB] -mb-px">
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
          completa={completa}
          onCompleta={ponerCompleta}
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
  completa,
  onCompleta,
}: {
  orgId: number
  token: string
  mapaId: number | null
  foco: Foco | null
  campanas: { id: number; titulo: string }[]
  metricas: Record<string, MetricaInfo>
  onIr: (mapaId: number | null, opciones?: { nueva?: boolean; foco?: number; editar?: boolean }) => void
  onNombre: (nombre: string) => void
  onVerCampana: (id: number) => void
  onCambioCampanas: () => void
  completa: boolean
  onCompleta: (si: boolean) => void
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
  // La tarjeta en la que se está escribiendo el título, y el menú del «+».
  const [editando, setEditando] = useState<number | null>(null)
  const [mas, setMas] = useState<{ nodo: NodoVision; x: number; y: number } | null>(null)
  const [plantilla, setPlantilla] = useState(false)
  // La recién creada sale ya elegida, para seguir con Tab / Intro.
  const seleccionar = useRef<string | null>(null)

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
    if (!foco || !datos?.nodos.some((n) => n.id === foco.id)) return
    if (foco.editar) {
      seleccionar.current = String(foco.id)
      setEditando(foco.id)
    } else setAbierto({ id: foco.id, nueva: false })
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

  // Las tarjetas van memorizadas: sus funciones no cambian (llaman a la última versión).
  const masRef = useRef((n: NodoVision, x: number, y: number) => setMas({ nodo: n, x, y }))
  const onMasTarjeta = useCallback((n: NodoVision, x: number, y: number) => masRef.current(n, x, y), [])
  const tituloRef = useRef<(n: NodoVision, t: string | null) => void>(() => {})
  const onTituloTarjeta = useCallback((n: NodoVision, t: string | null) => tituloRef.current(n, t), [])
  tituloRef.current = (n, texto) => {
    setEditando(null)
    const t = (texto ?? '').trim()
    if (!t || t === n.titulo) return
    setDatos((d) => d && { ...d, nodos: d.nodos.map((x) => (x.id === n.id ? { ...x, titulo: t } : x)) })
    cambiarNodo(orgId, n.id, { titulo: t }, token).then((r) => {
      if (!r.ok) toast.error(r.error || 'No se ha podido guardar el título')
      else if (n.tipo === 'campana') onCambioCampanas()
    })
  }

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
        editando: editando === n.id,
        onAbrir: onAbrirTarjeta,
        onMas: onMasTarjeta,
        onTitulo: onTituloTarjeta,
      }
    }
    return m
  }, [datos?.nodos, datos?.cifras, tituloCampana, metricas, soloUrgente, editando, onAbrirTarjeta, onMasTarjeta, onTituloTarjeta])

  // Las tarjetas de React Flow siguen a los datos; la posición manda la de pantalla.
  useEffect(() => {
    setNodes((prev) => {
      const porId = new Map(prev.map((p) => [p.id, p]))
      const elegir = seleccionar.current
      const lista = (datos?.nodos ?? []).map((n) => {
        const id = String(n.id)
        const p = porId.get(id)
        const data = datosPorId[id]
        if (p) return p.data === data ? p : { ...p, data }
        return { id, type: 'tarjeta' as const, position: { x: n.x, y: n.y }, data, selected: id === elegir }
      })
      if (elegir && lista.some((n) => n.id === elegir)) {
        seleccionar.current = null
        return lista.map((n) => (n.selected && n.id !== elegir ? { ...n, selected: false } : n))
      }
      return lista
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
    await nuevaEn(huecoLibre(centro, rf.getNodes()), tipo)
  }

  /** Una tarjeta suelta en ese sitio: se escribe en ella (o se abre su página). */
  async function nuevaEn(sitio: { x: number; y: number }, tipo: TipoNodo) {
    if (!datos) return
    const res = await crearNodo(orgId, { mapa_id: datos.mapa.id, tipo, x: sitio.x, y: sitio.y }, token)
    if (!res.ok || !res.datos) return toast.error(res.error || 'No se ha podido crear')
    recienCreada(res.datos)
  }

  function recienCreada(nodo: NodoVision, flecha?: FlechaVision) {
    seleccionar.current = String(nodo.id)
    setDatos((d) => d && { ...d, nodos: [...d.nodos, nodo], flechas: flecha ? [...d.flechas, flecha] : d.flechas })
    if (CON_PAGINA.includes(nodo.tipo)) setAbierto({ id: nodo.id, nueva: true })
    else setEditando(nodo.id)
    if (nodo.tipo === 'campana') onCambioCampanas()
  }

  /** El «+» (o Tab / Intro): otra tarjeta unida a `padreId`, con su flecha. */
  async function crearUnida(padreId: string, tipo: TipoNodo) {
    setMas(null)
    const padre = rf.getNode(padreId)
    if (!padre || !datos) return
    const hijos = datos.flechas.filter((f) => String(f.origen) === padreId).map((f) => String(f.destino))
    const sube = datos.flechas.find((f) => String(f.destino) === padreId)
    const sitio = sitioAlLado(padre, rf.getNodes(), hijos, sube ? rf.getNode(String(sube.origen)) : undefined)
    const res = await crearNodo(orgId, { mapa_id: datos.mapa.id, tipo, x: sitio.x, y: sitio.y }, token)
    if (!res.ok || !res.datos) return toast.error(res.error || 'No se ha podido crear')
    const f = await crearFlecha(orgId, { mapa_id: datos.mapa.id, origen: Number(padreId), destino: res.datos.id }, token)
    recienCreada(res.datos, f.ok ? f.datos : undefined)
  }

  /** El «+» de una vertical o una campaña: algo DENTRO de su mapa, y se entra. */
  async function crearDentro(padre: NodoVision, tipo: TipoNodo) {
    setMas(null)
    let sub = padre.submapa_id
    if (!sub) {
      const r = await abrirSubmapa(orgId, padre.id, token)
      if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido crear su mapa')
      sub = r.datos.mapa_id
    }
    // Debajo de lo que ya haya dentro, para no pisar nada.
    const m = await getMapa(orgId, sub, token)
    const hay = m.ok && m.datos ? m.datos.nodos : []
    const x = hay.length ? Math.min(...hay.map((n) => n.x)) : 0
    const y = hay.length ? Math.max(...hay.map((n) => n.y)) + 170 : 0
    const res = await crearNodo(orgId, { mapa_id: sub, tipo, x, y }, token)
    if (!res.ok || !res.datos) return toast.error(res.error || 'No se ha podido crear')
    if (tipo === 'campana') onCambioCampanas()
    onIr(sub, { foco: res.datos.id, editar: !CON_PAGINA.includes(tipo) })
  }

  /** «Ordenar»: todo como un mapa mental, con «Deshacer». */
  function ordenar() {
    const ns = rf.getNodes()
    if (!ns.length) return
    const antes = Object.fromEntries(ns.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
    const despues = ordenarMapa(
      ns.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, w: n.measured?.width ?? 236, h: n.measured?.height ?? 100 })),
      (datos?.flechas ?? []).map((f) => ({ origen: String(f.origen), destino: String(f.destino) }))
    )
    const aplicar = (pos: Record<string, { x: number; y: number }>) => {
      setNodes((lista) => lista.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)))
      moverNodos(
        orgId,
        Object.entries(pos).map(([id, p]) => ({ id: Number(id), x: Math.round(p.x), y: Math.round(p.y) })),
        token
      ).then((r) => !r.ok && toast.error('No se ha podido guardar el orden'))
      window.setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 60)
    }
    aplicar(despues)
    toast(
      (t) => (
        <span className="flex items-center gap-3 text-[13px]">
          Mapa ordenado
          <button
            onClick={() => {
              aplicar(antes)
              toast.dismiss(t.id)
            }}
            className="font-semibold text-[#025dc7] hover:underline"
          >
            Deshacer
          </button>
        </span>
      ),
      { duration: 7000 }
    )
  }

  // Tab: una unida a la elegida · Intro: una hermana · F2: cambiar el título.
  const teclasRef = useRef<(e: KeyboardEvent) => void>(() => {})
  teclasRef.current = (e) => {
    if (abierto || editando || mas || flechaSel || !datos) return
    const el = e.target as HTMLElement | null
    if (el?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
    const elegidas = rf.getNodes().filter((n) => n.selected)
    if (elegidas.length !== 1) return
    const n = elegidas[0]
    if (e.key === 'Tab') {
      e.preventDefault()
      crearUnida(n.id, 'nota')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const sube = datos.flechas.find((f) => String(f.destino) === n.id)
      crearUnida(sube ? String(sube.origen) : n.id, 'nota')
    } else if (e.key === 'F2') {
      e.preventDefault()
      setEditando(Number(n.id))
    }
  }
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclasRef.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

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

  const ICONO = 'w-7 h-7 rounded-md flex items-center justify-center text-gray-700 hover:bg-[#F3F4F6]'

  return (
    <div className={`rounded-b-lg rounded-tr-lg border border-[#E5E7EB] bg-white ${completa ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
      {/* Barra: migas de pan, añadir, lo urgente, ordenar, pantalla completa. */}
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
        <button onClick={ordenar} className={BOTON} title="Colocar todo como un mapa mental (se puede deshacer)">
          <Network size={14} /> <span className="hidden md:inline">Ordenar</span>
        </button>
        <button
          onClick={() => onCompleta(!completa)}
          className={BOTON}
          title={completa ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
        >
          {completa ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden md:inline">{completa ? 'Salir' : 'Pantalla completa'}</span>
        </button>
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
                <p className="px-2.5 pt-2.5 pb-1 mt-1 border-t border-[#F3F4F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                  Plantillas
                </p>
                <button
                  onClick={() => {
                    setMenu(false)
                    setPlantilla(true)
                  }}
                  className="w-full text-left rounded-md px-2.5 py-2 hover:bg-[#F9FAFB]"
                >
                  <span className="flex items-center gap-2 text-[13.5px] font-medium text-gray-900">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#025dc7' }} />
                    Campaña de clase gratuita
                  </span>
                  <span className={`${META} block pl-4`}>El embudo entero, con fechas: anuncio, reels, página, clase, llamadas…</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div ref={caja} className={completa ? 'relative flex-1 min-h-0' : 'relative h-[calc(100vh-290px)] min-h-[460px]'}>
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
            onPaneClick={(e) => {
              setFlechaSel(null)
              // Doble clic en el fondo: una idea ahí mismo.
              if (e.detail === 2) {
                const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
                nuevaEn({ x: Math.round((p.x - 110) / 12) * 12, y: Math.round((p.y - 30) / 12) * 12 }, 'nota')
              }
            }}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: '#025dc7', strokeWidth: 1.5 }}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            edgesReconnectable={false}
            snapToGrid
            snapGrid={[12, 12]}
            minZoom={0.15}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#D9DEE7" />
            <Panel position="bottom-left">
              <div className="flex items-center gap-0.5 rounded-lg border border-[#E5E7EB] bg-white p-1">
                <button onClick={() => rf.zoomOut({ duration: 150 })} className={ICONO} title="Alejar" aria-label="Alejar">
                  <ZoomOut size={15} />
                </button>
                <button onClick={() => rf.zoomIn({ duration: 150 })} className={ICONO} title="Acercar" aria-label="Acercar">
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 250 })}
                  className="h-7 px-2 rounded-md text-[12px] font-medium text-gray-700 hover:bg-[#F3F4F6]"
                  title="Ver todo el mapa"
                >
                  Ver todo
                </button>
              </div>
            </Panel>
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
                Haz doble clic en cualquier sitio para escribir la primera idea, o pulsa «Añadir». Luego, con el «+» de cada tarjeta, le cuelgas lo
                demás.
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

      <p className={`${META} shrink-0 px-3 py-2 border-t border-[#F3F4F6] hidden sm:block`}>
        Doble clic en el fondo: una idea · «+» de una tarjeta: añadir algo unido (o dentro) · Tab: unida · Intro: hermana · doble clic en una
        tarjeta: su página
      </p>

      {plantilla && datos ? (
        <VentanaClaseGratuita
          enInicio={!datos.mapa.nodo_padre_id}
          onClose={() => setPlantilla(false)}
          onCrear={async (v) => {
            const r = await crearClaseGratuita(orgId, { mapa_id: datos.mapa.id, ...v }, token)
            if (!r.ok || !r.datos) {
              toast.error(r.error || 'No se ha podido crear la campaña')
              return false
            }
            setPlantilla(false)
            toast.success('Campaña creada: este es su embudo')
            onCambioCampanas()
            onIr(r.datos.submapa_id)
            return true
          }}
        />
      ) : null}

      {/* El menú del «+»: qué añadir unido a esta tarjeta, o dentro de su mapa. */}
      {mas ? (
        <>
          <button aria-label="Cerrar" className="fixed inset-0 z-[64] cursor-default" onClick={() => setMas(null)} />
          <div
            className="fixed z-[65] w-[300px] rounded-lg border border-[#E5E7EB] bg-white p-2"
            style={{
              left: Math.min(mas.x + 10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 312),
              top: Math.max(8, Math.min(mas.y - 24, (typeof window !== 'undefined' ? window.innerHeight : 800) - 330)),
            }}
          >
            <p className="px-1 pb-1.5 text-[12px] text-[#6B7280] truncate">
              Unida a <span className="font-semibold text-gray-900">{mas.nodo.titulo || 'esta tarjeta'}</span>
            </p>
            <div className="grid grid-cols-2 gap-0.5">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => crearUnida(String(mas.nodo.id), t.id)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-gray-900 hover:bg-[#F3F4F6]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="truncate">{NOMBRE_EN_MENU[t.id] ?? t.nombre}</span>
                </button>
              ))}
            </div>
            {mas.nodo.tipo === 'vertical' || mas.nodo.tipo === 'campana' ? (
              <>
                <p className="px-1 pt-2.5 pb-1.5 mt-1.5 border-t border-[#F3F4F6] text-[12px] text-[#6B7280] truncate">
                  Dentro de <span className="font-semibold text-gray-900">{mas.nodo.titulo}</span> (en su mapa)
                </p>
                <div className="grid grid-cols-2 gap-0.5">
                  {TIPOS.filter((t) => t.id !== 'vertical').map((t) => (
                    <button
                      key={t.id}
                      onClick={() => crearDentro(mas.nodo, t.id)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-gray-900 hover:bg-[#F3F4F6]"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="truncate">{NOMBRE_EN_MENU[t.id] ?? t.nombre}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}

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


/** La plantilla «Campaña de clase gratuita»: el día (y la hora) de la clase;
 *  el nombre y el utm_campaign salen solos y se pueden cambiar. */
function VentanaClaseGratuita({
  enInicio,
  onClose,
  onCrear,
}: {
  enInicio: boolean
  onClose: () => void
  onCrear: (v: { fecha: string; hora: string; titulo: string; utm_campaign: string }) => Promise<boolean>
}) {
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('19:00')
  const [titulo, setTitulo] = useState('')
  const [utm, setUtm] = useState('')
  const [utmTocado, setUtmTocado] = useState(false)
  const [creando, setCreando] = useState(false)
  const CAMPO = 'w-full h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13.5px] text-gray-900 outline-none focus:border-gray-900'
  const ROTULO = 'block text-[12px] font-medium text-[#6B7280] mb-1'
  const utmFinal = utmTocado ? utm : utmDeClase(fecha)

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/30 p-3" role="dialog" aria-modal="true">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!fecha) return toast.error('Pon el día de la clase')
          setCreando(true)
          const ok = await onCrear({ fecha, hora, titulo: titulo.trim(), utm_campaign: utmFinal.trim() })
          if (!ok) setCreando(false)
        }}
        className="w-full max-w-[460px] rounded-lg border border-[#E5E7EB] bg-white p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-gray-900">Campaña de clase gratuita</h3>
            <p className={`${META} mt-0.5`}>
              Crea la campaña con todo su embudo: anuncio UGC, reels, historias, DMs del setter, página de la clase, recordatorios, la
              clase, la oferta, las llamadas y el cierre. Cada paso con lo que hace falta y su fecha límite.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={ROTULO}>Día de la clase</span>
            <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} autoFocus />
          </label>
          <label>
            <span className={ROTULO}>Hora (Países Bajos)</span>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={CAMPO} />
          </label>
        </div>
        <label className="block">
          <span className={ROTULO}>Nombre (opcional)</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Clase gratuita · vie 6 nov" className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>utm_campaign de todos sus enlaces</span>
          <input
            value={utmFinal}
            onChange={(e) => {
              setUtmTocado(true)
              setUtm(e.target.value)
            }}
            placeholder="clase-gratis-06nov"
            className={CAMPO}
          />
        </label>
        <p className={META}>
          {enInicio ? 'Se crea dentro de la vertical «Campañas». ' : 'Se crea en este mapa. '}
          Todo nace «Pendiente»: marca lo que ya tengas hecho.
        </p>
        <div className="flex gap-2">
          <button type="submit" disabled={creando} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-gray-900 text-white text-[13.5px] font-medium hover:bg-black disabled:opacity-50">
            {creando ? <Loader2 size={14} className="animate-spin" /> : null} Crear campaña
          </button>
          <button type="button" onClick={onClose} className={BOTON}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
