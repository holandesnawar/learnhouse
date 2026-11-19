'use client'
/**
 * `/tableros` (19/11/2026): los tableros de producción de la formación, como
 * el Deck de Nextcloud pero dentro de la escuela y separados por curso
 * (A0-A1, A1-A2…). A la izquierda los cursos con sus tableros; a la derecha
 * el tablero en columnas con sus tarjetas, que se arrastran. Cada tarjeta se
 * abre en su ficha (`FichaTarjeta`). Para el equipo: los administradores
 * crean cursos y tableros; los profes trabajan dentro (tarjetas, columnas,
 * enlaces, archivos, comentarios).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import {
  Archive,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChatCircle,
  CheckCircle,
  CloudArrowDown,
  Copy,
  DotsThree,
  FunnelSimple,
  GearSix,
  Kanban,
  LinkSimple,
  List,
  MagnifyingGlass,
  Paperclip,
  PencilSimple,
  Plus,
  TextAlignLeft,
  Trash,
  X,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { confirmar } from '@/lib/nawar/confirmar'
import { estadoFecha, fechaCorta, FILTRO_VACIO, hayFiltro, ordenEntre, pasaFiltro, porColumna, type Filtro } from '@/lib/nawar/produccion'
import {
  borrarColumna,
  borrarTablero,
  buscarTarjetas,
  cambiarColumna,
  cambiarTablero,
  cambiarTarjeta,
  crearColumna,
  crearTarjeta,
  getArchivadas,
  getProximas,
  getTablero,
  getTodo,
  type Curso,
  type Etiqueta,
  type Tarjeta,
  type TarjetaCompleta,
  type TarjetaEnLista,
  type TableroResumen,
  type Todo,
  type VistaTablero,
} from '@services/produccion/produccion'
import FichaTarjeta, { ChipEtiqueta } from './FichaTarjeta'
import { AjustesCurso, CAMPO, Duplicar, ElegirColor, ImportarNextcloud, NuevoCurso, NuevoTablero, PRIMARIO, SECUNDARIO, Ventana } from './Dialogos'
import { POPPINS } from '@components/Pages/Equipo/estilo'

const hoyNL = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

type Dialogo =
  | { tipo: 'curso' }
  | { tipo: 'ajustes'; curso: Curso }
  | { tipo: 'tablero'; cursoId: number }
  | { tipo: 'editar-tablero'; tablero: TableroResumen }
  | { tipo: 'duplicar'; tablero: TableroResumen }
  | { tipo: 'nextcloud' }
  | { tipo: 'archivadas' }

type Vista = { tipo: 'tablero'; id: number } | { tipo: 'proximas' } | { tipo: 'buscar'; q: string } | { tipo: 'nada' }

function leerPlegados(): number[] {
  try {
    return JSON.parse(localStorage.getItem('nawar.tableros.plegados') || '[]')
  } catch {
    return []
  }
}

function guardarPlegados(l: number[]) {
  try {
    localStorage.setItem('nawar.tableros.plegados', JSON.stringify(l))
  } catch {
    /* sin almacenamiento */
  }
}

function MenuFlotante({ abierto, onCerrar, children, derecha }: { abierto: boolean; onCerrar: () => void; children: React.ReactNode; derecha?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    setTimeout(() => document.addEventListener('mousedown', f), 0)
    window.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', f)
      window.removeEventListener('keydown', k)
    }
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div ref={ref} className={`absolute z-30 top-full mt-1 ${derecha ? 'right-0' : 'left-0'} min-w-[220px] rounded-xl border border-[#E2E7F0] bg-white shadow-lg p-1.5`}>
      {children}
    </div>
  )
}

function OpcionMenu({ icono, children, onClick, peligro }: { icono: React.ReactNode; children: React.ReactNode; onClick: () => void; peligro?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] ${peligro ? 'text-[#B42318] hover:bg-[#FEF3F2]' : 'text-[#1A2040] hover:bg-[#F6F8FC]'}`}>
      {icono}
      {children}
    </button>
  )
}

const COLOR_FECHA: Record<string, string> = {
  vencida: 'bg-[#FEE4E2] text-[#B42318]',
  hoy: 'bg-[#FEF0C7] text-[#93370D]',
  pronto: 'bg-[#E8EEFC] text-[#0b2da0]',
  luego: 'bg-[#F1F4FA] text-[#4A5272]',
  hecha: 'bg-[#DCFAE6] text-[#067647]',
}

function ChipFecha({ vence, hecha, hoy }: { vence: string; hecha: string; hoy: string }) {
  const e = estadoFecha(vence, hecha, hoy)
  if (!vence) return null
  return (
    <span className={`inline-flex items-center gap-1 h-[22px] px-1.5 rounded-md text-[11.5px] font-semibold ${COLOR_FECHA[e] || COLOR_FECHA.luego}`}>
      {e === 'hecha' ? <CheckCircle size={13} weight="fill" /> : <CalendarBlank size={13} />}
      {fechaCorta(vence, hoy)}
    </span>
  )
}

function Avatares({ personas }: { personas: { id: number; nombre: string }[] }) {
  if (!personas.length) return null
  const vistos = personas.slice(0, 3)
  return (
    <span className="flex -space-x-1.5" title={personas.map((p) => p.nombre).join(', ')}>
      {vistos.map((p) => (
        <span key={`${p.id}-${p.nombre}`} className="rounded-full ring-2 ring-white">
          <AvatarPersona nombre={p.nombre} size={24} />
        </span>
      ))}
      {personas.length > 3 ? <span className="w-6 h-6 rounded-full ring-2 ring-white bg-[#E2E7F0] text-[10.5px] font-semibold text-[#3B4262] flex items-center justify-center">+{personas.length - 3}</span> : null}
    </span>
  )
}

function TarjetaPequena({ t, etiquetas, hoy }: { t: Tarjeta; etiquetas: Map<number, Etiqueta>; hoy: string }) {
  const suyas = t.etiquetas.map((i) => etiquetas.get(i)).filter(Boolean) as Etiqueta[]
  const hayPie = t.vence || t.tiene_descripcion || t.n_enlaces || t.n_adjuntos || t.n_comentarios || t.asignados.length
  return (
    <>
      {suyas.length ? (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {suyas.map((e) => (
            <ChipEtiqueta key={e.id} e={e} pequena />
          ))}
        </div>
      ) : null}
      <p className={`text-[14px] font-medium leading-snug break-words ${t.hecha_at ? 'text-[#6B7393] line-through decoration-[#6B7393]/40' : 'text-[#0B1033]'}`}>{t.titulo}</p>
      {hayPie ? (
        <div className="mt-2 flex items-center gap-2 min-h-6">
          <ChipFecha vence={t.vence} hecha={t.hecha_at} hoy={hoy} />
          {!t.vence && t.hecha_at ? <CheckCircle size={16} weight="fill" className="text-[#15803D]" /> : null}
          <span className="flex items-center gap-2 text-[#6B7393] text-[12px]">
            {t.tiene_descripcion ? <TextAlignLeft size={15} aria-label="Con descripción" /> : null}
            {t.n_enlaces ? (
              <span className="inline-flex items-center gap-0.5">
                <LinkSimple size={14} />
                {t.n_enlaces}
              </span>
            ) : null}
            {t.n_adjuntos ? (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip size={14} />
                {t.n_adjuntos}
              </span>
            ) : null}
            {t.n_comentarios ? (
              <span className="inline-flex items-center gap-0.5">
                <ChatCircle size={14} />
                {t.n_comentarios}
              </span>
            ) : null}
          </span>
          <span className="ml-auto">
            <Avatares personas={t.asignados} />
          </span>
        </div>
      ) : null}
    </>
  )
}

function AnadirEnLinea({ texto, placeholder, onCrear, ancho }: { texto: string; placeholder: string; onCrear: (v: string) => Promise<boolean>; ancho?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function enviar() {
    const v = valor.trim()
    if (!v || enviando) return
    setEnviando(true)
    const ok = await onCrear(v)
    setEnviando(false)
    if (ok) setValor('')
  }
  if (!abierto)
    return (
      <button onClick={() => setAbierto(true)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-[#4A5272] hover:bg-[#E9EDF5] hover:text-[#0B1033] ${ancho ? 'w-full' : ''}`}>
        <Plus size={15} /> {texto}
      </button>
    )
  return (
    <div className="rounded-xl bg-white border border-[#D6DDEC] p-2">
      <textarea
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            enviar()
          }
          if (e.key === 'Escape') setAbierto(false)
        }}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none text-[14px] outline-none"
      />
      <div className="mt-1 flex items-center gap-1.5">
        <button onClick={enviar} disabled={!valor.trim() || enviando} className="h-8 px-3 rounded-lg bg-[#0b2da0] text-white text-[12.5px] font-semibold disabled:opacity-40">
          Añadir
        </button>
        <button onClick={() => setAbierto(false)} aria-label="Cancelar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7393] hover:bg-[#F1F4FA]">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

function CabeceraColumna({
  titulo,
  cuenta,
  admin,
  arrastre,
  onRenombrar,
  onBorrar,
}: {
  titulo: string
  cuenta: number
  admin: boolean
  arrastre: any
  onRenombrar: (t: string) => void
  onBorrar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(titulo)
  const [menu, setMenu] = useState(false)
  useEffect(() => setValor(titulo), [titulo])
  return (
    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5" {...arrastre}>
      {editando ? (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => {
            setEditando(false)
            if (valor.trim() && valor.trim() !== titulo) onRenombrar(valor.trim())
            else setValor(titulo)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setValor(titulo)
              setEditando(false)
            }
          }}
          className="flex-1 min-w-0 h-8 rounded-md border border-[#0b2da0] px-2 text-[13px] font-bold uppercase tracking-[0.04em] outline-none"
        />
      ) : (
        <button onDoubleClick={() => setEditando(true)} className="flex-1 min-w-0 text-left truncate px-1 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#3B4262]" title="Doble clic para cambiar el nombre">
          {titulo}
        </button>
      )}
      <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-[#E4E8F1] text-[11.5px] font-semibold text-[#4A5272] flex items-center justify-center">{cuenta}</span>
      <div className="relative shrink-0">
        <button onClick={() => setMenu((v) => !v)} aria-label="Opciones de la columna" className="w-7 h-7 rounded-md flex items-center justify-center text-[#6B7393] hover:bg-[#E4E8F1]">
          <DotsThree size={18} weight="bold" />
        </button>
        <MenuFlotante abierto={menu} onCerrar={() => setMenu(false)} derecha>
          <OpcionMenu
            icono={<PencilSimple size={16} />}
            onClick={() => {
              setMenu(false)
              setEditando(true)
            }}
          >
            Cambiar el nombre
          </OpcionMenu>
          {admin ? (
            <OpcionMenu
              icono={<Trash size={16} />}
              peligro
              onClick={() => {
                setMenu(false)
                onBorrar()
              }}
            >
              Borrar la columna
            </OpcionMenu>
          ) : null}
        </MenuFlotante>
      </div>
    </div>
  )
}

function ListaTarjetas({
  titulo,
  vacio,
  tarjetas,
  etiquetas,
  hoy,
  onAbrir,
}: {
  titulo: React.ReactNode
  vacio: string
  tarjetas: TarjetaEnLista[]
  etiquetas: Map<number, Etiqueta>
  hoy: string
  onAbrir: (t: TarjetaEnLista) => void
}) {
  const grupos = useMemo(() => {
    const g: { nombre: string; lista: TarjetaEnLista[] }[] = []
    const add = (n: string, l: TarjetaEnLista[]) => l.length && g.push({ nombre: n, lista: l })
    const conFecha = tarjetas.filter((t) => t.vence)
    const sinFecha = tarjetas.filter((t) => !t.vence)
    if (conFecha.length === tarjetas.length && conFecha.length) {
      const en7 = new Date(Date.parse(hoy) + 7 * 86400000).toISOString().slice(0, 10)
      add('Vencidas', conFecha.filter((t) => !t.hecha_at && t.vence.slice(0, 10) < hoy))
      add('Hoy', conFecha.filter((t) => t.vence.slice(0, 10) === hoy))
      add('Esta semana', conFecha.filter((t) => t.vence.slice(0, 10) > hoy && t.vence.slice(0, 10) <= en7))
      add('Más adelante', conFecha.filter((t) => t.vence.slice(0, 10) > en7))
    } else {
      add('', [...conFecha, ...sinFecha])
    }
    return g
  }, [tarjetas, hoy])
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 py-6">
      {titulo}
      {!tarjetas.length ? <p className="mt-8 text-center text-[14px] text-[#6B7393]">{vacio}</p> : null}
      {grupos.map((g) => (
        <section key={g.nombre} className="mt-6">
          {g.nombre ? (
            <h3 className={`mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] ${g.nombre === 'Vencidas' ? 'text-[#B42318]' : 'text-[#6B7393]'}`}>
              {g.nombre} · {g.lista.length}
            </h3>
          ) : null}
          <ul className="space-y-2">
            {g.lista.map((t) => (
              <li key={t.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onAbrir(t)}
                  onKeyDown={(e) => e.key === 'Enter' && onAbrir(t)}
                  className="rounded-xl border border-[#E2E7F0] bg-white px-4 py-3 cursor-pointer hover:border-[#B9C3DA] focus:outline-none focus:ring-2 focus:ring-[#0b2da0]/30"
                >
                  <p className="mb-1 flex items-center gap-1.5 text-[12px] text-[#6B7393]">
                    <span className="w-2 h-2 rounded-full" style={{ background: t.tablero_color }} />
                    {t.curso} · {t.tablero}
                  </p>
                  <TarjetaPequena t={t} etiquetas={etiquetas} hoy={hoy} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function TablerosPage() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { isStaff, loading } = useAdminStatus() as any
  const orgId: number = org?.id

  const [todo, setTodo] = useState<Todo | null>(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>({ tipo: 'nada' })
  const [tablero, setTablero] = useState<VistaTablero | null>(null)
  const [cargandoTablero, setCargandoTablero] = useState(false)
  const [lista, setLista] = useState<TarjetaEnLista[] | null>(null)
  const [soloMias, setSoloMias] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [ficha, setFicha] = useState<{ tablero: number; id: number } | null>(null)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [archivadas, setArchivadas] = useState<Tarjeta[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO)
  const [menuFiltro, setMenuFiltro] = useState(false)
  const [menuTablero, setMenuTablero] = useState(false)
  const [panel, setPanel] = useState(false)
  const [plegados, setPlegados] = useState<number[]>([])
  const [verArchivados, setVerArchivados] = useState(false)
  const hoy = hoyNL()
  const admin = !!todo?.yo.admin
  const yo = todo?.yo.id || 0

  useEffect(() => setPlegados(leerPlegados()), [])

  const cargarTodo = useCallback(async () => {
    if (!orgId || !token) return
    try {
      setTodo(await getTodo(orgId, token))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'No se han podido cargar los tableros')
    }
  }, [orgId, token])

  useEffect(() => {
    if (isStaff) cargarTodo()
  }, [isStaff, cargarTodo])

  // Lo que pide la dirección (?t=12, ?ver=proximas) o, si no, el primer tablero.
  useEffect(() => {
    if (!todo || vista.tipo !== 'nada') return
    let pedido: Vista | null = null
    try {
      const p = new URLSearchParams(window.location.search)
      const t = Number(p.get('t'))
      if (t && todo.cursos.some((c) => c.tableros.some((b) => b.id === t))) pedido = { tipo: 'tablero', id: t }
      else if (p.get('ver') === 'proximas') pedido = { tipo: 'proximas' }
    } catch {
      /* sin dirección */
    }
    if (!pedido) {
      const primero = todo.cursos.flatMap((c) => c.tableros).find((b) => !b.archivado)
      if (primero) pedido = { tipo: 'tablero', id: primero.id }
    }
    if (pedido) setVista(pedido)
  }, [todo, vista.tipo])

  // La dirección sigue a lo que se ve, para poder recargar o compartir.
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      u.searchParams.delete('t')
      u.searchParams.delete('ver')
      if (vista.tipo === 'tablero') u.searchParams.set('t', String(vista.id))
      if (vista.tipo === 'proximas') u.searchParams.set('ver', 'proximas')
      window.history.replaceState(null, '', u.toString())
    } catch {
      /* nada */
    }
  }, [vista])

  const cargarTablero = useCallback(
    async (id: number, silencio = false) => {
      if (!silencio) setCargandoTablero(true)
      try {
        const v = await getTablero(orgId, id, token)
        setTablero(v)
      } catch (e: any) {
        toast.error(e?.message || 'No se ha podido abrir el tablero')
      }
      setCargandoTablero(false)
    },
    [orgId, token]
  )

  useEffect(() => {
    if (vista.tipo === 'tablero') {
      if (tablero?.tablero.id !== vista.id) setTablero(null)
      cargarTablero(vista.id)
      setFiltro(FILTRO_VACIO)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista.tipo === 'tablero' ? vista.id : 0, cargarTablero])

  useEffect(() => {
    if (vista.tipo === 'proximas') {
      setLista(null)
      getProximas(orgId, soloMias, token)
        .then(setLista)
        .catch((e) => toast.error(e?.message || 'No se han podido cargar'))
    } else if (vista.tipo === 'buscar') {
      setLista(null)
      buscarTarjetas(orgId, vista.q, token)
        .then(setLista)
        .catch((e) => toast.error(e?.message || 'No se ha podido buscar'))
    }
  }, [vista, soloMias, orgId, token])

  const cursos = todo?.cursos || []
  const todosTableros = useMemo(() => cursos.flatMap((c) => c.tableros), [cursos])
  const tableroActual = tablero?.tablero
  const cursoActual = cursos.find((c) => c.id === tableroActual?.curso_id)
  const etiquetasCurso = cursoActual?.etiquetas || []
  const etiquetasPorId = useMemo(() => new Map(cursos.flatMap((c) => c.etiquetas).map((e) => [e.id, e])), [cursos])
  const columnas = tablero?.columnas || []
  const visibles = useMemo(() => (tablero?.tarjetas || []).filter((t) => pasaFiltro(t, filtro, yo)), [tablero, filtro, yo])
  const enColumnas = useMemo(() => porColumna(visibles, columnas), [visibles, columnas])
  const filtrando = hayFiltro(filtro)

  function irA(v: Vista) {
    setVista(v)
    setPanel(false)
  }

  function abrirDesdeLista(t: TarjetaEnLista) {
    setVista({ tipo: 'tablero', id: t.tablero_id })
    setFicha({ tablero: t.tablero_id, id: t.id })
  }

  function plegar(id: number) {
    const n = plegados.includes(id) ? plegados.filter((x) => x !== id) : [...plegados, id]
    setPlegados(n)
    guardarPlegados(n)
  }

  // ── Arrastrar ──
  async function alSoltar(r: DropResult) {
    if (!tablero || !r.destination) return
    const { source, destination, draggableId, type } = r
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    if (type === 'COLUMNA') {
      const id = Number(draggableId.slice(2))
      const resto = columnas.filter((c) => c.id !== id)
      const orden = ordenEntre(resto, destination.index)
      setTablero({ ...tablero, columnas: [...resto.slice(0, destination.index), { ...columnas.find((c) => c.id === id)!, orden }, ...resto.slice(destination.index)] })
      try {
        await cambiarColumna(orgId, id, { orden }, token)
      } catch (e: any) {
        toast.error(e?.message || 'No se ha podido mover')
        cargarTablero(tablero.tablero.id, true)
      }
      return
    }
    const id = Number(draggableId.slice(2))
    const col = Number(destination.droppableId.slice(2))
    const destino = (enColumnas[col] || []).filter((t) => t.id !== id)
    const orden = ordenEntre(destino, destination.index)
    setTablero({ ...tablero, tarjetas: tablero.tarjetas.map((t) => (t.id === id ? { ...t, columna_id: col, orden } : t)) })
    try {
      await cambiarTarjeta(orgId, id, { columna_id: col, orden }, token)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido mover')
      cargarTablero(tablero.tablero.id, true)
    }
  }

  async function nuevaTarjeta(columnaId: number, titulo: string) {
    if (!tablero) return false
    try {
      const t = await crearTarjeta(orgId, tablero.tablero.id, columnaId, titulo, token)
      setTablero((v) => (v ? { ...v, tarjetas: [...v.tarjetas, t] } : v))
      return true
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido crear')
      return false
    }
  }

  async function nuevaColumna(titulo: string) {
    if (!tablero) return false
    try {
      const c = await crearColumna(orgId, tablero.tablero.id, titulo, token)
      setTablero((v) => (v ? { ...v, columnas: [...v.columnas, c] } : v))
      return true
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido crear')
      return false
    }
  }

  async function renombrarColumna(id: number, titulo: string) {
    try {
      const c = await cambiarColumna(orgId, id, { titulo }, token)
      setTablero((v) => (v ? { ...v, columnas: v.columnas.map((x) => (x.id === id ? c : x)) } : v))
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido cambiar')
    }
  }

  async function quitarColumna(id: number, titulo: string) {
    if (!(await confirmar(`¿Borrar la columna «${titulo}»? Solo se puede si no tiene tarjetas.`, { boton: 'Borrar', peligro: true }))) return
    try {
      await borrarColumna(orgId, id, token)
      setTablero((v) => (v ? { ...v, columnas: v.columnas.filter((x) => x.id !== id) } : v))
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido borrar')
    }
  }

  function alCambiarTarjeta(t: TarjetaCompleta) {
    setTablero((v) => {
      if (!v) return v
      const fuera = t.archivada || t.tablero_id !== v.tablero.id
      const esta = v.tarjetas.some((x) => x.id === t.id)
      let tarjetas = v.tarjetas
      if (fuera) tarjetas = tarjetas.filter((x) => x.id !== t.id)
      else if (esta) tarjetas = tarjetas.map((x) => (x.id === t.id ? t : x))
      else tarjetas = [...tarjetas, t]
      const n = v.n_archivadas + (t.archivada && esta ? 1 : !t.archivada && !esta && t.tablero_id === v.tablero.id ? -1 : 0)
      return { ...v, tarjetas, n_archivadas: Math.max(0, n) }
    })
    setArchivadas((l) => (l ? (t.archivada ? l.map((x) => (x.id === t.id ? t : x)) : l.filter((x) => x.id !== t.id)) : l))
  }

  function alEtiquetaNueva(e: Etiqueta) {
    setTodo((v) =>
      v
        ? {
            ...v,
            cursos: v.cursos.map((c) => (c.id === e.curso_id && !c.etiquetas.some((x) => x.id === e.id) ? { ...c, etiquetas: [...c.etiquetas, e] } : c)),
          }
        : v
    )
  }

  async function verLasArchivadas() {
    if (!tablero) return
    setDialogo({ tipo: 'archivadas' })
    setArchivadas(null)
    try {
      setArchivadas(await getArchivadas(orgId, tablero.tablero.id, token))
    } catch (e: any) {
      toast.error(e?.message || 'No se han podido cargar')
      setArchivadas([])
    }
  }

  async function archivarTablero(t: TableroResumen) {
    try {
      await cambiarTablero(orgId, t.id, { archivado: !t.archivado }, token)
      toast.success(t.archivado ? 'Tablero sacado del archivo' : 'Tablero archivado')
      await cargarTodo()
      if (!t.archivado && vista.tipo === 'tablero' && vista.id === t.id) cargarTablero(t.id, true)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido archivar')
    }
  }

  async function quitarTablero(t: TableroResumen) {
    if (!(await confirmar(`¿Borrar el tablero «${t.titulo}» con sus ${t.total} tarjetas, sus archivos y comentarios? No se puede deshacer. Si solo quieres quitarlo de la vista, archívalo.`, { boton: 'Borrar', peligro: true })))
      return
    try {
      await borrarTablero(orgId, t.id, token)
      setTablero(null)
      setVista({ tipo: 'nada' })
      await cargarTodo()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido borrar')
    }
  }

  // ── Pantallas que no son el tablero ──
  if (loading) return null
  if (!isStaff) return <p className="py-16 text-center text-[14px] text-[#6B7280]">Esta página es para el equipo de la escuela.</p>

  const panelIzquierdo = (
    <div className="h-full flex flex-col bg-[#FAFBFD]">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Kanban size={22} className="text-[#0b2da0]" weight="duotone" />
          <h1 className="flex-1 text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
            Tableros
          </h1>
          <button onClick={() => setPanel(false)} aria-label="Cerrar" className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#4A5272] hover:bg-[#EEF1F7]">
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (busqueda.trim().length >= 2) irA({ tipo: 'buscar', q: busqueda.trim() })
          }}
          className="mt-3 relative"
        >
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93B3]" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en todas las tarjetas"
            className="w-full h-9 rounded-lg border border-[#E2E7F0] bg-white pl-8 pr-3 text-[13.5px] outline-none focus:border-[#0b2da0]"
          />
        </form>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <button
          onClick={() => irA({ tipo: 'proximas' })}
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium ${vista.tipo === 'proximas' ? 'bg-[#E8EEFC] text-[#0b2da0]' : 'text-[#1A2040] hover:bg-[#EEF1F7]'}`}
        >
          <CalendarBlank size={18} /> Próximas tarjetas
        </button>
        {cursos.map((c) => {
          const plegado = plegados.includes(c.id)
          const suyos = c.tableros.filter((b) => verArchivados || !b.archivado)
          return (
            <div key={c.id} className="mt-3">
              <div className="group flex items-center gap-1 px-1">
                <button onClick={() => plegar(c.id)} className="flex-1 min-w-0 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-[#EEF1F7]">
                  {plegado ? <CaretRight size={13} className="text-[#8A93B3]" /> : <CaretDown size={13} className="text-[#8A93B3]" />}
                  <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: c.color }} />
                  <span className="truncate text-[12.5px] font-bold uppercase tracking-[0.07em] text-[#3B4262]">{c.nombre}</span>
                </button>
                {admin ? (
                  <>
                    <button onClick={() => setDialogo({ tipo: 'tablero', cursoId: c.id })} aria-label={`Nuevo tablero en ${c.nombre}`} title="Nuevo tablero" className="w-7 h-7 rounded-md flex items-center justify-center text-[#6B7393] hover:bg-[#EEF1F7]">
                      <Plus size={15} />
                    </button>
                    <button onClick={() => setDialogo({ tipo: 'ajustes', curso: c })} aria-label={`Ajustes de ${c.nombre}`} title="Ajustes del curso" className="w-7 h-7 rounded-md flex items-center justify-center text-[#6B7393] hover:bg-[#EEF1F7]">
                      <GearSix size={15} />
                    </button>
                  </>
                ) : null}
              </div>
              {!plegado ? (
                <ul className="mt-0.5">
                  {suyos.map((b) => {
                    const activo = vista.tipo === 'tablero' && vista.id === b.id
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => irA({ tipo: 'tablero', id: b.id })}
                          className={`w-full flex items-center gap-2.5 rounded-lg pl-7 pr-2.5 py-1.5 text-left text-[14px] ${activo ? 'bg-[#E8EEFC] text-[#0b2da0] font-semibold' : 'text-[#1A2040] hover:bg-[#EEF1F7]'} ${b.archivado ? 'opacity-60' : ''}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                          <span className="flex-1 min-w-0 truncate">{b.titulo}</span>
                          {b.vencidas ? <span className="text-[11px] font-semibold text-[#B42318]">{b.vencidas}</span> : null}
                          <span className="text-[11.5px] text-[#8A93B3]">{b.total ? `${b.hechas}/${b.total}` : ''}</span>
                        </button>
                      </li>
                    )
                  })}
                  {!suyos.length ? <li className="pl-7 py-1.5 text-[13px] text-[#8A93B3]">Sin tableros todavía</li> : null}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-[#EEF1F7] px-2 py-2">
        {admin ? (
          <>
            <button onClick={() => setDialogo({ tipo: 'curso' })} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#1A2040] hover:bg-[#EEF1F7]">
              <Plus size={17} /> Nuevo curso
            </button>
            <button
              onClick={() => (cursos.length ? setDialogo({ tipo: 'nextcloud' }) : toast('Crea primero un curso (por ejemplo «A0-A1») para poner ahí los tableros'))}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#1A2040] hover:bg-[#EEF1F7]"
            >
              <CloudArrowDown size={17} /> Traer de Nextcloud
            </button>
          </>
        ) : null}
        {todosTableros.some((b) => b.archivado) ? (
          <button onClick={() => setVerArchivados((v) => !v)} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#4A5272] hover:bg-[#EEF1F7]">
            <Archive size={17} /> {verArchivados ? 'Esconder los archivados' : 'Ver los tableros archivados'}
          </button>
        ) : null}
      </div>
    </div>
  )

  let principal: React.ReactNode
  if (error && !todo) {
    principal = (
      <div className="p-10 text-center">
        <p className="text-[14px] text-[#B42318]">{error}</p>
        <button onClick={cargarTodo} className={`mt-3 ${SECUNDARIO}`}>
          Volver a intentarlo
        </button>
      </div>
    )
  } else if (!todo) {
    principal = <div className="p-6 flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="w-[290px] h-[420px] rounded-xl bg-[#EEF1F7] animate-pulse" />)}</div>
  } else if (!cursos.length) {
    principal = (
      <div className="max-w-[560px] mx-auto px-6 py-16 text-center">
        <Kanban size={44} weight="duotone" className="mx-auto text-[#0b2da0]" />
        <h2 className="mt-3 text-[22px] font-bold text-[#0B1033]" style={POPPINS}>
          Los tableros de la formación
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#4A5272]">
          {admin
            ? 'Como el Deck de Nextcloud, pero dentro de la escuela y separado por curso. Crea el primero (por ejemplo «A0-A1») y luego trae tus tableros de Nextcloud o empieza uno nuevo para el «A1-A2».'
            : 'Aún no hay tableros. Los crea el administrador de la escuela.'}
        </p>
        {admin ? (
          <button onClick={() => setDialogo({ tipo: 'curso' })} className={`mt-5 ${PRIMARIO}`}>
            Crear el primer curso
          </button>
        ) : null}
      </div>
    )
  } else if (vista.tipo === 'proximas') {
    principal = lista ? (
      <ListaTarjetas
        titulo={
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex-1 text-[22px] font-bold text-[#0B1033]" style={POPPINS}>
              Próximas tarjetas
            </h2>
            <div className="inline-flex rounded-lg border border-[#E2E7F0] p-0.5 text-[13px] font-semibold">
              <button onClick={() => setSoloMias(false)} className={`h-8 px-3 rounded-md ${!soloMias ? 'bg-[#0b2da0] text-white' : 'text-[#4A5272]'}`}>
                Todas
              </button>
              <button onClick={() => setSoloMias(true)} className={`h-8 px-3 rounded-md ${soloMias ? 'bg-[#0b2da0] text-white' : 'text-[#4A5272]'}`}>
                Las mías
              </button>
            </div>
          </div>
        }
        vacio={soloMias ? 'No tienes tarjetas con fecha por hacer.' : 'No hay tarjetas con fecha por hacer.'}
        tarjetas={lista}
        etiquetas={etiquetasPorId}
        hoy={hoy}
        onAbrir={abrirDesdeLista}
      />
    ) : (
      <p className="p-8 text-[14px] text-[#6B7393]">Cargando…</p>
    )
  } else if (vista.tipo === 'buscar') {
    principal = lista ? (
      <ListaTarjetas
        titulo={
          <h2 className="text-[22px] font-bold text-[#0B1033]" style={POPPINS}>
            «{vista.q}» · {lista.length} resultado{lista.length === 1 ? '' : 's'}
          </h2>
        }
        vacio="Ninguna tarjeta lleva eso en el título ni en la descripción."
        tarjetas={lista}
        etiquetas={etiquetasPorId}
        hoy={hoy}
        onAbrir={abrirDesdeLista}
      />
    ) : (
      <p className="p-8 text-[14px] text-[#6B7393]">Buscando…</p>
    )
  } else if (vista.tipo === 'tablero' && tableroActual) {
    const personas = todo.miembros
    principal = (
      <div className="h-full flex flex-col min-w-0">
        {/* Cabecera del tablero */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 sm:px-6 pt-4 pb-3 border-b border-[#EEF1F7] bg-white">
          <div className="flex-1 min-w-[200px] flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tableroActual.color }} />
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8A93B3]">{cursoActual?.nombre}</p>
              <h2 className="truncate text-[20px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                {tableroActual.titulo}
                {tableroActual.archivado ? <span className="ml-2 align-middle text-[12px] font-semibold text-[#8A6A2A]">archivado</span> : null}
              </h2>
            </div>
          </div>
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A93B3]" />
            <input
              value={filtro.texto}
              onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
              placeholder="Filtrar"
              className="w-[150px] sm:w-[180px] h-9 rounded-lg border border-[#E2E7F0] pl-8 pr-2 text-[13.5px] outline-none focus:border-[#0b2da0]"
            />
          </div>
          <button
            onClick={() => setFiltro({ ...filtro, soloMias: !filtro.soloMias })}
            className={`h-9 px-3 rounded-lg text-[13.5px] font-medium border ${filtro.soloMias ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'border-[#E2E7F0] text-[#3B4262] hover:bg-[#F6F8FC]'}`}
          >
            Las mías
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuFiltro((v) => !v)}
              className={`h-9 px-3 rounded-lg text-[13.5px] font-medium border inline-flex items-center gap-1.5 ${
                filtro.etiquetas.length || filtro.personas.length || filtro.sinHacer ? 'border-[#0b2da0] text-[#0b2da0] bg-[#F3F6FE]' : 'border-[#E2E7F0] text-[#3B4262] hover:bg-[#F6F8FC]'
              }`}
            >
              <FunnelSimple size={16} /> Filtros
              {filtro.etiquetas.length + filtro.personas.length + (filtro.sinHacer ? 1 : 0) ? ` · ${filtro.etiquetas.length + filtro.personas.length + (filtro.sinHacer ? 1 : 0)}` : ''}
            </button>
            <MenuFlotante abierto={menuFiltro} onCerrar={() => setMenuFiltro(false)} derecha>
              <div className="w-[260px] max-h-[400px] overflow-y-auto p-1">
                <label className="flex items-center gap-2 px-1.5 py-1.5 text-[13.5px]">
                  <input type="checkbox" checked={filtro.sinHacer} onChange={(e) => setFiltro({ ...filtro, sinHacer: e.target.checked })} />
                  Esconder las hechas
                </label>
                {etiquetasCurso.length ? <p className="mt-2 px-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#8A93B3]">Etiquetas</p> : null}
                {etiquetasCurso.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 px-1.5 py-1">
                    <input
                      type="checkbox"
                      checked={filtro.etiquetas.includes(e.id)}
                      onChange={(ev) => setFiltro({ ...filtro, etiquetas: ev.target.checked ? [...filtro.etiquetas, e.id] : filtro.etiquetas.filter((x) => x !== e.id) })}
                    />
                    <ChipEtiqueta e={e} pequena />
                  </label>
                ))}
                {personas.length ? <p className="mt-2 px-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#8A93B3]">Personas</p> : null}
                {personas.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 px-1.5 py-1 text-[13.5px]">
                    <input
                      type="checkbox"
                      checked={filtro.personas.includes(m.id)}
                      onChange={(ev) => setFiltro({ ...filtro, personas: ev.target.checked ? [...filtro.personas, m.id] : filtro.personas.filter((x) => x !== m.id) })}
                    />
                    <AvatarPersona nombre={m.nombre} size={22} />
                    <span className="truncate">{m.nombre}</span>
                  </label>
                ))}
                {filtrando ? (
                  <button onClick={() => setFiltro(FILTRO_VACIO)} className="mt-2 w-full h-8 rounded-lg text-[13px] font-semibold text-[#0b2da0] hover:bg-[#F3F6FE]">
                    Quitar todos los filtros
                  </button>
                ) : null}
              </div>
            </MenuFlotante>
          </div>
          {tablero.n_archivadas ? (
            <button onClick={verLasArchivadas} className="h-9 px-3 rounded-lg text-[13.5px] font-medium border border-[#E2E7F0] text-[#3B4262] hover:bg-[#F6F8FC] inline-flex items-center gap-1.5">
              <Archive size={16} /> Archivadas · {tablero.n_archivadas}
            </button>
          ) : null}
          {admin ? (
            <div className="relative">
              <button onClick={() => setMenuTablero((v) => !v)} aria-label="Opciones del tablero" className="w-9 h-9 rounded-lg border border-[#E2E7F0] flex items-center justify-center text-[#3B4262] hover:bg-[#F6F8FC]">
                <DotsThree size={20} weight="bold" />
              </button>
              <MenuFlotante abierto={menuTablero} onCerrar={() => setMenuTablero(false)} derecha>
                <OpcionMenu
                  icono={<PencilSimple size={16} />}
                  onClick={() => {
                    setMenuTablero(false)
                    setDialogo({ tipo: 'editar-tablero', tablero: tableroActual })
                  }}
                >
                  Nombre, color y curso
                </OpcionMenu>
                <OpcionMenu
                  icono={<Copy size={16} />}
                  onClick={() => {
                    setMenuTablero(false)
                    setDialogo({ tipo: 'duplicar', tablero: tableroActual })
                  }}
                >
                  Duplicar el tablero
                </OpcionMenu>
                <OpcionMenu
                  icono={<Archive size={16} />}
                  onClick={() => {
                    setMenuTablero(false)
                    archivarTablero(tableroActual)
                  }}
                >
                  {tableroActual.archivado ? 'Sacar del archivo' : 'Archivar el tablero'}
                </OpcionMenu>
                <OpcionMenu
                  icono={<Trash size={16} />}
                  peligro
                  onClick={() => {
                    setMenuTablero(false)
                    quitarTablero(tableroActual)
                  }}
                >
                  Borrar el tablero
                </OpcionMenu>
              </MenuFlotante>
            </div>
          ) : null}
        </div>
        {filtrando ? (
          <div className="shrink-0 px-4 sm:px-6 py-2 bg-[#F3F6FE] text-[12.5px] text-[#0b2da0] flex items-center gap-2">
            Con filtros puestos ves {visibles.length} de {tablero.tarjetas.length} tarjetas y no se pueden arrastrar.
            <button onClick={() => setFiltro(FILTRO_VACIO)} className="font-semibold underline">
              Quitar los filtros
            </button>
          </div>
        ) : null}

        {/* Columnas */}
        <DragDropContext onDragEnd={alSoltar}>
          <Droppable droppableId="tablero" direction="horizontal" type="COLUMNA">
            {(prov) => (
              <div ref={prov.innerRef} {...prov.droppableProps} className="flex-1 min-h-0 flex items-start gap-3 overflow-x-auto px-4 sm:px-6 py-4 snap-x scroll-pl-4 md:snap-none">
                {columnas.map((c, i) => {
                  const suyas = enColumnas[c.id] || []
                  return (
                    <Draggable key={c.id} draggableId={`c-${c.id}`} index={i} isDragDisabled={filtrando}>
                      {(pc) => (
                        <div ref={pc.innerRef} {...pc.draggableProps} className="snap-start shrink-0 w-[84vw] sm:w-[300px] max-h-full flex flex-col rounded-2xl bg-[#F1F4F9]">
                          <CabeceraColumna
                            titulo={c.titulo}
                            cuenta={suyas.length}
                            admin={admin}
                            arrastre={pc.dragHandleProps}
                            onRenombrar={(t) => renombrarColumna(c.id, t)}
                            onBorrar={() => quitarColumna(c.id, c.titulo)}
                          />
                          <Droppable droppableId={`c-${c.id}`} type="TARJETA">
                            {(pd, sd) => (
                              <div
                                ref={pd.innerRef}
                                {...pd.droppableProps}
                                className={`flex-1 min-h-[24px] overflow-y-auto px-2 pb-1 space-y-2 rounded-xl transition-colors ${sd.isDraggingOver ? 'bg-[#E6EBF5]' : ''}`}
                              >
                                {suyas.map((t, j) => (
                                  <Draggable key={t.id} draggableId={`t-${t.id}`} index={j} isDragDisabled={filtrando}>
                                    {(pt, st) => (
                                      <div
                                        ref={pt.innerRef}
                                        {...pt.draggableProps}
                                        {...pt.dragHandleProps}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFicha({ tablero: tableroActual.id, id: t.id })}
                                        onKeyDown={(e) => e.key === 'Enter' && setFicha({ tablero: tableroActual.id, id: t.id })}
                                        className={`rounded-xl bg-white border px-3 py-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0b2da0]/30 ${
                                          st.isDragging ? 'border-[#9DB0DD] shadow-lg rotate-[1.5deg]' : 'border-[#E2E7F0] hover:border-[#B9C3DA]'
                                        }`}
                                      >
                                        <TarjetaPequena t={t} etiquetas={etiquetasPorId} hoy={hoy} />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {pd.placeholder}
                              </div>
                            )}
                          </Droppable>
                          <div className="px-2 pt-1 pb-2">
                            <AnadirEnLinea texto="Añadir tarjeta" placeholder="Título de la tarjeta (Intro para añadir)" onCrear={(v) => nuevaTarjeta(c.id, v)} ancho />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {prov.placeholder}
                <div className="snap-start shrink-0 w-[84vw] sm:w-[280px]">
                  <AnadirEnLinea texto="Añadir columna" placeholder="Nombre de la columna" onCrear={nuevaColumna} ancho />
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    )
  } else if (vista.tipo === 'tablero' || cargandoTablero) {
    principal = <div className="p-6 flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="w-[290px] h-[420px] rounded-xl bg-[#EEF1F7] animate-pulse" />)}</div>
  } else {
    principal = (
      <div className="max-w-[520px] mx-auto px-6 py-16 text-center">
        <p className="text-[14.5px] text-[#4A5272]">Elige un tablero a la izquierda{admin ? ' o crea uno nuevo con el «+» de cada curso' : ''}.</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex bg-white">
      <aside className="hidden md:block w-[270px] shrink-0 border-r border-[#EEF1F7]">{panelIzquierdo}</aside>
      {panel ? (
        <div className="md:hidden fixed inset-x-0 bottom-0 top-14 z-[60] flex">
          <div className="w-[86vw] max-w-[320px] h-full shadow-xl">{panelIzquierdo}</div>
          <button aria-label="Cerrar" onClick={() => setPanel(false)} className="flex-1 bg-[#0B1033]/30" />
        </div>
      ) : null}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[#EEF1F7]">
          <button onClick={() => setPanel(true)} className="h-9 px-3 rounded-lg border border-[#E2E7F0] inline-flex items-center gap-2 text-[13.5px] font-medium text-[#1A2040]">
            <List size={17} /> Tableros
          </button>
          <span className="min-w-0 truncate text-[13px] text-[#6B7393]">
            {vista.tipo === 'proximas' ? 'Próximas tarjetas' : vista.tipo === 'buscar' ? 'Búsqueda' : cursoActual ? `${cursoActual.nombre} · ${tableroActual?.titulo || ''}` : ''}
          </span>
        </div>
        <div className={`flex-1 min-h-0 ${vista.tipo === 'tablero' ? 'overflow-hidden bg-[#FAFBFD]' : 'overflow-y-auto bg-[#FAFBFD]'}`}>{principal}</div>
      </main>

      {ficha && tablero && tablero.tablero.id === ficha.tablero && todo ? (
        <FichaTarjeta
          key={ficha.id}
          orgId={orgId}
          token={token}
          tarjetaId={ficha.id}
          etiquetas={etiquetasCurso}
          columnas={columnas}
          tableros={todosTableros}
          miembros={todo.miembros}
          yo={todo.yo}
          cursoId={tablero.tablero.curso_id}
          onCambio={alCambiarTarjeta}
          onBorrada={(id) => setTablero((v) => (v ? { ...v, tarjetas: v.tarjetas.filter((x) => x.id !== id) } : v))}
          onEtiquetaNueva={alEtiquetaNueva}
          onCerrar={() => {
            setFicha(null)
            cargarTodo()
          }}
        />
      ) : null}

      {dialogo?.tipo === 'curso' ? (
        <NuevoCurso
          orgId={orgId}
          token={token}
          onHecho={async () => {
            await cargarTodo()
          }}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === 'ajustes' ? (
        <AjustesCurso
          orgId={orgId}
          token={token}
          curso={dialogo.curso}
          onCambio={cargarTodo}
          onBorrado={async () => {
            if (cursoActual?.id === dialogo.curso.id) {
              setTablero(null)
              setVista({ tipo: 'nada' })
            }
            await cargarTodo()
          }}
          onCerrar={() => {
            setDialogo(null)
            cargarTodo()
          }}
        />
      ) : null}
      {dialogo?.tipo === 'tablero' ? (
        <NuevoTablero
          orgId={orgId}
          token={token}
          cursos={cursos}
          cursoId={dialogo.cursoId}
          onHecho={async (t) => {
            await cargarTodo()
            setVista({ tipo: 'tablero', id: t.id })
          }}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === 'duplicar' ? (
        <Duplicar
          orgId={orgId}
          token={token}
          cursos={cursos}
          tablero={dialogo.tablero}
          onHecho={async (t) => {
            await cargarTodo()
            setVista({ tipo: 'tablero', id: t.id })
          }}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === 'editar-tablero' ? (
        <EditarTablero
          orgId={orgId}
          token={token}
          cursos={cursos}
          tablero={dialogo.tablero}
          onHecho={async () => {
            await cargarTodo()
            cargarTablero(dialogo.tablero.id, true)
          }}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === 'nextcloud' ? (
        <ImportarNextcloud
          orgId={orgId}
          token={token}
          cursos={cursos}
          cursoId={cursoActual?.id || cursos[0]?.id || 0}
          onHecho={cargarTodo}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === 'archivadas' ? (
        <Ventana titulo="Tarjetas archivadas" onCerrar={() => setDialogo(null)} ancho={620}>
          {!archivadas ? (
            <p className="text-[14px] text-[#6B7393]">Cargando…</p>
          ) : !archivadas.length ? (
            <p className="text-[14px] text-[#6B7393]">No hay tarjetas archivadas.</p>
          ) : (
            <ul className="space-y-2">
              {archivadas.map((t) => (
                <li key={t.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => tableroActual && setFicha({ tablero: tableroActual.id, id: t.id })}
                    onKeyDown={(e) => e.key === 'Enter' && tableroActual && setFicha({ tablero: tableroActual.id, id: t.id })}
                    className="rounded-xl border border-[#E2E7F0] px-3.5 py-2.5 cursor-pointer hover:border-[#B9C3DA]"
                  >
                    <p className="text-[12px] text-[#8A93B3]">{columnas.find((c) => c.id === t.columna_id)?.titulo}</p>
                    <TarjetaPequena t={t} etiquetas={etiquetasPorId} hoy={hoy} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12.5px] text-[#6B7393]">Ábrela y, en sus opciones (⋯), «Sacar del archivo» para devolverla al tablero.</p>
        </Ventana>
      ) : null}
    </div>
  )
}

function EditarTablero({
  orgId,
  token,
  cursos,
  tablero,
  onHecho,
  onCerrar,
}: {
  orgId: number
  token: string
  cursos: Curso[]
  tablero: TableroResumen
  onHecho: () => void
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState(tablero.titulo)
  const [color, setColor] = useState(tablero.color)
  const [curso, setCurso] = useState(tablero.curso_id)
  const [enviando, setEnviando] = useState(false)
  async function guardar() {
    setEnviando(true)
    try {
      await cambiarTablero(orgId, tablero.id, { titulo, color, curso_id: curso }, token)
      onHecho()
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido guardar')
    }
    setEnviando(false)
  }
  return (
    <Ventana titulo="El tablero" onCerrar={onCerrar}>
      <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">Nombre</label>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className={CAMPO} />
      <label className="mt-4 block text-[13px] font-semibold text-[#0a1656] mb-1.5">Color</label>
      <ElegirColor valor={color} onCambio={setColor} />
      <label className="mt-4 block text-[13px] font-semibold text-[#0a1656] mb-1.5">Curso</label>
      <select value={curso} onChange={(e) => setCurso(Number(e.target.value))} className={CAMPO}>
        {cursos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      {curso !== tablero.curso_id ? (
        <p className="mt-2 text-[12.5px] text-[#8A6A2A]">Al pasarlo a otro curso, las etiquetas de sus tarjetas pasan a las de ese curso con el mismo nombre (se crean si no existen).</p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCerrar} className={SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={guardar} disabled={!titulo.trim() || enviando} className={PRIMARIO}>
          Guardar
        </button>
      </div>
    </Ventana>
  )
}
