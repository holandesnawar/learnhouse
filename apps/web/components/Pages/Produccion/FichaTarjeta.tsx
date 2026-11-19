'use client'
/**
 * La ficha de una tarjeta de producción (19/11/2026), como la de Nextcloud
 * Deck: título, etiquetas, personas, fecha y «hecha», columna, enlaces,
 * descripción con el editor, adjuntos y comentarios. Todo se guarda solo.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Archive,
  ArrowSquareOut,
  CalendarBlank,
  ChatCircle,
  CheckCircle,
  Circle,
  DotsThree,
  DownloadSimple,
  House,
  LinkSimple,
  Paperclip,
  Plus,
  Tag,
  Trash,
  UploadSimple,
  UserPlus,
  X,
} from '@phosphor-icons/react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { confirmar } from '@/lib/nawar/confirmar'
import { COLORES, haceCuanto, letraSobre, tamano } from '@/lib/nawar/produccion'
import {
  abrirAdjunto,
  borrarAdjunto,
  borrarComentario,
  borrarTarjeta,
  cambiarComentario,
  cambiarTarjeta,
  comentar,
  crearEtiqueta,
  getTarjeta,
  subirAdjunto,
  type CambioTarjeta,
  type Columna,
  type Comentario,
  type Etiqueta,
  type Miembro,
  type TableroResumen,
  type TarjetaCompleta,
} from '@services/produccion/produccion'
import EditorDescripcion from './EditorDescripcion'
import { POPPINS } from '@components/Pages/Equipo/estilo'

type Pestana = 'detalles' | 'adjuntos' | 'comentarios'

export function ChipEtiqueta({ e, onQuitar, pequena }: { e: Etiqueta; onQuitar?: () => void; pequena?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${pequena ? 'h-[22px] px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]'}`}
      style={{ background: e.color, color: letraSobre(e.color) }}
    >
      {e.nombre}
      {onQuitar ? (
        <button onClick={onQuitar} aria-label={`Quitar ${e.nombre}`} className="opacity-80 hover:opacity-100">
          <X size={12} weight="bold" />
        </button>
      ) : null}
    </span>
  )
}

function Fila({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[28px_120px_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
      <span className="h-8 flex items-center text-[#6B7393]">{icono}</span>
      <span className="hidden sm:flex h-8 items-center text-[13px] font-medium text-[#6B7393]">{titulo}</span>
      <div className="min-w-0 flex flex-wrap items-center gap-1.5 min-h-8">{children}</div>
    </div>
  )
}

function Menu({ abierto, onCerrar, children, ancho = 260 }: { abierto: boolean; onCerrar: () => void; children: React.ReactNode; ancho?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    // Esc cierra el menú, no la ficha (la ficha mira si hay un menú abierto).
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
    <div ref={ref} style={{ width: ancho }} className="absolute z-20 mt-1 rounded-xl border border-[#E2E7F0] bg-white shadow-lg p-1.5 max-h-[320px] overflow-y-auto">
      {children}
    </div>
  )
}

export default function FichaTarjeta({
  orgId,
  token,
  tarjetaId,
  etiquetas,
  columnas,
  tableros,
  miembros,
  yo,
  cursoId,
  onCambio,
  onBorrada,
  onEtiquetaNueva,
  onCerrar,
}: {
  orgId: number
  token: string
  tarjetaId: number
  etiquetas: Etiqueta[]
  columnas: Columna[]
  tableros: TableroResumen[]
  miembros: Miembro[]
  yo: { id: number; admin: boolean }
  cursoId: number
  onCambio: (t: TarjetaCompleta) => void
  onBorrada: (id: number) => void
  onEtiquetaNueva: (e: Etiqueta) => void
  onCerrar: () => void
}) {
  const [t, setT] = useState<TarjetaCompleta | null>(null)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState<Pestana>('detalles')
  const [titulo, setTitulo] = useState('')
  const [guardando, setGuardando] = useState<'' | 'guardando' | 'guardado' | 'error'>('')
  const [menuEtiquetas, setMenuEtiquetas] = useState(false)
  const [menuPersonas, setMenuPersonas] = useState(false)
  const [menuMas, setMenuMas] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [enlaceUrl, setEnlaceUrl] = useState('')
  const [enlaceTitulo, setEnlaceTitulo] = useState('')
  const [comentario, setComentario] = useState('')
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)
  const descripcionPendiente = useRef<string | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let vivo = true
    getTarjeta(orgId, tarjetaId, token)
      .then((d) => {
        if (!vivo) return
        setT(d)
        setTitulo(d.titulo)
      })
      .catch((e) => vivo && setError(e?.message || 'No se ha podido abrir la tarjeta'))
    return () => {
      vivo = false
    }
  }, [orgId, tarjetaId, token])

  const guardar = useCallback(
    async (d: CambioTarjeta, avisar = false) => {
      setGuardando('guardando')
      try {
        const r = await cambiarTarjeta(orgId, tarjetaId, d, token)
        setT((v) => (v ? { ...r, comentarios: v.comentarios } : r))
        onCambio(r)
        setGuardando('guardado')
        if (avisar) toast.success('Guardado')
        return r
      } catch (e: any) {
        setGuardando('error')
        toast.error(e?.message || 'No se ha podido guardar')
        return null
      }
    },
    [orgId, tarjetaId, token, onCambio]
  )

  const guardarDescripcion = useCallback(async () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    const d = descripcionPendiente.current
    if (d === null) return
    descripcionPendiente.current = null
    await guardar({ descripcion: d })
  }, [guardar])

  const alEscribir = useCallback(
    (json: string) => {
      descripcionPendiente.current = json
      setGuardando('guardando')
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(guardarDescripcion, 900)
    },
    [guardarDescripcion]
  )

  const cerrar = useCallback(async () => {
    await guardarDescripcion()
    if (t && titulo.trim() && titulo.trim() !== t.titulo) await guardar({ titulo: titulo.trim() })
    onCerrar()
  }, [guardarDescripcion, t, titulo, guardar, onCerrar])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menuEtiquetas && !menuPersonas && !menuMas) cerrar()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [cerrar, menuEtiquetas, menuPersonas, menuMas])

  // Avisar si se cierra la pestaña con texto sin guardar.
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (descripcionPendiente.current !== null) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [])

  const porId = useMemo(() => new Map(etiquetas.map((e) => [e.id, e])), [etiquetas])
  const suyasEtiquetas = (t?.etiquetas || []).map((i) => porId.get(i)).filter(Boolean) as Etiqueta[]
  const fecha = (t?.vence || '').slice(0, 10)
  const hora = (t?.vence || '').slice(11, 16)
  const mismoCurso = tableros.filter((b) => b.curso_id === cursoId && !b.archivado)

  async function toggleEtiqueta(id: number) {
    if (!t) return
    const ya = t.etiquetas.includes(id)
    await guardar({ etiquetas: ya ? t.etiquetas.filter((x) => x !== id) : [...t.etiquetas, id] })
  }

  async function nueva() {
    const n = nuevaEtiqueta.trim()
    if (!n || !t) return
    try {
      const e = await crearEtiqueta(orgId, cursoId, { nombre: n, color: COLORES[etiquetas.length % COLORES.length] }, token)
      onEtiquetaNueva(e)
      setNuevaEtiqueta('')
      if (!t.etiquetas.includes(e.id)) await guardar({ etiquetas: [...t.etiquetas, e.id] })
    } catch (err: any) {
      toast.error(err?.message || 'No se ha podido crear la etiqueta')
    }
  }

  async function togglePersona(m: { id: number; nombre: string }) {
    if (!t) return
    const ya = t.asignados.some((a) => (a.id ? a.id === m.id : a.nombre === m.nombre))
    const lista = ya ? t.asignados.filter((a) => (a.id ? a.id !== m.id : a.nombre !== m.nombre)) : [...t.asignados, m]
    await guardar({ asignados: lista })
  }

  async function ponerFecha(dia: string, h: string) {
    await guardar({ vence: dia ? (h ? `${dia}T${h}` : dia) : '' })
  }

  async function anadirEnlace() {
    if (!t || !enlaceUrl.trim()) return
    const r = await guardar({ enlaces: [...t.enlaces, { titulo: enlaceTitulo.trim(), url: enlaceUrl.trim() }] })
    if (r) {
      if (r.enlaces.length === t.enlaces.length) toast.error('Esa dirección no vale (tiene que ser una web: https://…)')
      setEnlaceUrl('')
      setEnlaceTitulo('')
    }
  }

  async function subir(archivos: FileList | File[] | null) {
    if (!archivos || !t) return
    const lista = Array.from(archivos)
    if (!lista.length) return
    setSubiendo(true)
    for (const a of lista) {
      try {
        const r = await subirAdjunto(orgId, t.id, a, token)
        setT((v) => (v ? { ...r, comentarios: v.comentarios } : r))
        onCambio(r)
      } catch (e: any) {
        toast.error(`${a.name}: ${e?.message || 'no se ha podido subir'}`)
      }
    }
    setSubiendo(false)
    if (archivoRef.current) archivoRef.current.value = ''
  }

  async function abrir(id: string) {
    if (!t) return
    const url = await abrirAdjunto(orgId, t.id, id, token)
    if (!url) return toast.error('No se ha podido abrir')
    window.open(url, '_blank', 'noopener')
  }

  async function bajar(id: string, nombre: string) {
    if (!t) return
    const url = await abrirAdjunto(orgId, t.id, id, token)
    if (!url) return toast.error('No se ha podido bajar')
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
  }

  async function quitarAdjunto(id: string, nombre: string) {
    if (!t || !(await confirmar(`¿Quitar «${nombre}»? Se borra el archivo.`, { boton: 'Quitar', peligro: true }))) return
    try {
      const r = await borrarAdjunto(orgId, t.id, id, token)
      setT((v) => (v ? { ...r, comentarios: v.comentarios } : r))
      onCambio(r)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido quitar')
    }
  }

  async function enviarComentario() {
    if (!t || !comentario.trim()) return
    try {
      const c = await comentar(orgId, t.id, comentario.trim(), token)
      const r: TarjetaCompleta = { ...t, comentarios: [...(t.comentarios || []), c], n_comentarios: t.n_comentarios + 1 }
      setT(r)
      onCambio(r)
      setComentario('')
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido comentar')
    }
  }

  async function guardarEdicion() {
    if (!t || !editando) return
    try {
      const c = await cambiarComentario(orgId, editando.id, editando.texto, token)
      setT({ ...t, comentarios: (t.comentarios || []).map((x) => (x.id === c.id ? c : x)) })
      setEditando(null)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido cambiar')
    }
  }

  async function quitarComentario(c: Comentario) {
    if (!t || !(await confirmar('¿Borrar este comentario?', { boton: 'Borrar', peligro: true }))) return
    try {
      await borrarComentario(orgId, c.id, token)
      const r: TarjetaCompleta = { ...t, comentarios: (t.comentarios || []).filter((x) => x.id !== c.id), n_comentarios: Math.max(0, t.n_comentarios - 1) }
      setT(r)
      onCambio(r)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido borrar')
    }
  }

  async function borrar() {
    if (!t) return
    if (!(await confirmar(`¿Borrar «${t.titulo}»? Se borran también sus adjuntos y comentarios. No se puede deshacer.`, { boton: 'Borrar', peligro: true }))) return
    try {
      await borrarTarjeta(orgId, t.id, token)
      onBorrada(t.id)
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido borrar')
    }
  }

  const puedeBorrar = !!t && (yo.admin || t.creado_por_id === yo.id)
  const BTN = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#E2E7F0] text-[13px] font-medium text-[#3B4262] hover:bg-[#F6F8FC]'

  return (
    <EnElCuerpo>
      <div className="fixed inset-0 z-[1000] flex items-stretch sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true">
        <button aria-label="Cerrar" onClick={cerrar} className="absolute inset-0 bg-[#0B1033]/40" />
        <div className="relative w-full sm:max-w-[920px] h-full sm:h-[88vh] bg-white sm:rounded-2xl flex flex-col overflow-hidden">
          {!t ? (
            <div className="p-8 text-[14px] text-[#6B7393]">{error || 'Abriendo la tarjeta…'}</div>
          ) : (
            <>
              {/* Cabecera */}
              <div className="px-5 sm:px-7 pt-5 pb-0">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => guardar({ hecha: !t.hecha_at })}
                    title={t.hecha_at ? 'Hecha · pulsa para deshacer' : 'Marcar como hecha'}
                    className={`mt-1.5 shrink-0 ${t.hecha_at ? 'text-[#15803D]' : 'text-[#B5BDD3] hover:text-[#15803D]'}`}
                  >
                    {t.hecha_at ? <CheckCircle size={26} weight="fill" /> : <Circle size={26} />}
                  </button>
                  <textarea
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    onBlur={() => titulo.trim() && titulo.trim() !== t.titulo && guardar({ titulo: titulo.trim() })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ;(e.target as HTMLTextAreaElement).blur()
                      }
                    }}
                    rows={1}
                    className={`flex-1 min-w-0 resize-none bg-transparent text-[21px] sm:text-[24px] font-bold leading-tight text-[#0B1033] outline-none rounded-md focus:bg-[#F6F8FC] px-1 -mx-1 ${t.hecha_at ? 'line-through decoration-[#15803D]/50' : ''}`}
                    style={{ ...POPPINS, fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <div className="relative shrink-0 flex items-center gap-1">
                    <button onClick={() => setMenuMas((v) => !v)} aria-label="Más" className="w-9 h-9 rounded-lg flex items-center justify-center text-[#4A5272] hover:bg-[#F1F4FA]">
                      <DotsThree size={22} weight="bold" />
                    </button>
                    <button onClick={cerrar} aria-label="Cerrar" className="w-9 h-9 rounded-lg flex items-center justify-center text-[#4A5272] hover:bg-[#F1F4FA]">
                      <X size={20} />
                    </button>
                    <div className="absolute right-10 top-9">
                      <Menu abierto={menuMas} onCerrar={() => setMenuMas(false)} ancho={240}>
                        <button
                          onClick={() => {
                            setMenuMas(false)
                            guardar({ archivada: !t.archivada }, true)
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-left hover:bg-[#F6F8FC]"
                        >
                          <Archive size={16} /> {t.archivada ? 'Sacar del archivo' : 'Archivar la tarjeta'}
                        </button>
                        {mismoCurso.length > 1 ? (
                          <div className="px-2.5 py-2">
                            <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#8A93B3]">Mover a otro tablero</p>
                            <select
                              value={t.tablero_id}
                              onChange={async (e) => {
                                setMenuMas(false)
                                const r = await guardar({ tablero_id: Number(e.target.value) }, true)
                                if (r) onCerrar()
                              }}
                              className="mt-1 w-full h-8 rounded-lg border border-[#E2E7F0] px-2 text-[13px]"
                            >
                              {tableros
                                .filter((b) => !b.archivado)
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.titulo}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}
                        {puedeBorrar ? (
                          <button
                            onClick={() => {
                              setMenuMas(false)
                              borrar()
                            }}
                            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-left text-[#B42318] hover:bg-[#FEF3F2]"
                          >
                            <Trash size={16} /> Borrar la tarjeta
                          </button>
                        ) : null}
                      </Menu>
                    </div>
                  </div>
                </div>
                <p className="mt-1 pl-[38px] text-[12.5px] text-[#6B7393]">
                  {t.archivada ? <span className="font-semibold text-[#8A6A2A]">Archivada · </span> : null}
                  Modificada {haceCuanto(t.updated_at)}
                  {t.actualizado_por ? ` por ${t.actualizado_por}` : ''} · Creada {haceCuanto(t.created_at)}
                  {t.creado_por ? ` por ${t.creado_por}` : ''}
                  {guardando === 'guardando' ? ' · Guardando…' : guardando === 'guardado' ? ' · Guardado' : guardando === 'error' ? ' · No se ha guardado' : ''}
                </p>
                <nav className="mt-4 flex gap-1 border-b border-[#E9EDF5] -mx-5 px-5 sm:-mx-7 sm:px-7">
                  {(
                    [
                      ['detalles', 'Detalles', <House key="d" size={16} />],
                      ['adjuntos', `Adjuntos${t.adjuntos.length ? ` (${t.adjuntos.length})` : ''}`, <Paperclip key="a" size={16} />],
                      ['comentarios', `Comentarios${t.n_comentarios ? ` (${t.n_comentarios})` : ''}`, <ChatCircle key="c" size={16} />],
                    ] as [Pestana, string, React.ReactNode][]
                  ).map(([id, txt, ic]) => (
                    <button
                      key={id}
                      onClick={() => setPestana(id)}
                      className={`inline-flex items-center gap-1.5 h-10 px-3 text-[14px] font-semibold border-b-2 -mb-px ${
                        pestana === id ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-transparent text-[#5B6382] hover:text-[#0B1033]'
                      }`}
                    >
                      {ic}
                      {txt}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
                {pestana === 'detalles' ? (
                  <div className="space-y-3">
                    <Fila icono={<Tag size={18} />} titulo="Etiquetas">
                      {suyasEtiquetas.map((e) => (
                        <ChipEtiqueta key={e.id} e={e} onQuitar={() => toggleEtiqueta(e.id)} />
                      ))}
                      <div className="relative">
                        <button onClick={() => setMenuEtiquetas((v) => !v)} className={BTN}>
                          <Plus size={14} /> Etiqueta
                        </button>
                        <Menu abierto={menuEtiquetas} onCerrar={() => setMenuEtiquetas(false)}>
                          {etiquetas.map((e) => (
                            <button key={e.id} onClick={() => toggleEtiqueta(e.id)} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#F6F8FC]">
                              <span className={`w-4 h-4 rounded border flex items-center justify-center ${t.etiquetas.includes(e.id) ? 'bg-[#0b2da0] border-[#0b2da0]' : 'border-[#C9D0E0]'}`}>
                                {t.etiquetas.includes(e.id) ? <span className="w-1.5 h-2.5 border-r-2 border-b-2 border-white rotate-45 -mt-0.5" /> : null}
                              </span>
                              <ChipEtiqueta e={e} pequena />
                            </button>
                          ))}
                          <div className="mt-1 pt-1.5 border-t border-[#EEF1F7] flex gap-1">
                            <input
                              value={nuevaEtiqueta}
                              onChange={(e) => setNuevaEtiqueta(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && nueva()}
                              placeholder="Etiqueta nueva…"
                              className="flex-1 min-w-0 h-8 rounded-lg border border-[#E2E7F0] px-2 text-[13px] outline-none focus:border-[#0b2da0]"
                            />
                            <button onClick={nueva} className="h-8 px-2.5 rounded-lg bg-[#0b2da0] text-white text-[12.5px] font-semibold">
                              Crear
                            </button>
                          </div>
                        </Menu>
                      </div>
                    </Fila>

                    <Fila icono={<UserPlus size={18} />} titulo="Personas">
                      {t.asignados.map((a) => (
                        <span key={`${a.id}-${a.nombre}`} className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-[#F1F4FA] text-[13px] text-[#1A2040]">
                          <AvatarPersona nombre={a.nombre} size={24} />
                          {a.nombre}
                          {!a.id ? <span className="text-[11px] text-[#8A93B3]">(Nextcloud)</span> : null}
                          <button onClick={() => togglePersona(a)} aria-label={`Quitar a ${a.nombre}`} className="text-[#6B7393] hover:text-[#0B1033]">
                            <X size={12} weight="bold" />
                          </button>
                        </span>
                      ))}
                      <div className="relative">
                        <button onClick={() => setMenuPersonas((v) => !v)} className={BTN}>
                          <Plus size={14} /> Persona
                        </button>
                        <Menu abierto={menuPersonas} onCerrar={() => setMenuPersonas(false)}>
                          {miembros.map((m) => {
                            const ya = t.asignados.some((a) => a.id === m.id)
                            return (
                              <button key={m.id} onClick={() => togglePersona({ id: m.id, nombre: m.nombre })} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#F6F8FC]">
                                <AvatarPersona nombre={m.nombre} size={26} />
                                <span className="flex-1 min-w-0 truncate text-[13.5px]">{m.nombre}</span>
                                <span className="text-[11.5px] text-[#8A93B3]">{m.rol}</span>
                                {ya ? <CheckCircle size={16} weight="fill" className="text-[#0b2da0]" /> : null}
                              </button>
                            )
                          })}
                        </Menu>
                      </div>
                    </Fila>

                    <Fila icono={<CalendarBlank size={18} />} titulo="Para cuándo">
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => ponerFecha(e.target.value, hora)}
                        className="h-8 rounded-lg border border-[#E2E7F0] px-2 text-[13px] outline-none focus:border-[#0b2da0]"
                      />
                      {fecha ? (
                        <input
                          type="time"
                          value={hora}
                          onChange={(e) => ponerFecha(fecha, e.target.value)}
                          className="h-8 rounded-lg border border-[#E2E7F0] px-2 text-[13px] outline-none focus:border-[#0b2da0]"
                        />
                      ) : null}
                      {fecha ? (
                        <button onClick={() => ponerFecha('', '')} className="h-8 px-2 text-[12.5px] text-[#6B7393] hover:text-[#0B1033]">
                          Quitar la fecha
                        </button>
                      ) : null}
                      <button
                        onClick={() => guardar({ hecha: !t.hecha_at })}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold ${
                          t.hecha_at ? 'bg-[#ECFDF3] text-[#15803D]' : 'border border-[#E2E7F0] text-[#3B4262] hover:bg-[#F6F8FC]'
                        }`}
                      >
                        <CheckCircle size={16} weight={t.hecha_at ? 'fill' : 'regular'} />
                        {t.hecha_at ? `Hecha ${haceCuanto(t.hecha_at)}` : 'Marcar como hecha'}
                      </button>
                    </Fila>

                    <Fila icono={<Archive size={18} />} titulo="Columna">
                      <select
                        value={t.columna_id}
                        onChange={(e) => guardar({ columna_id: Number(e.target.value) })}
                        className="h-8 rounded-lg border border-[#E2E7F0] px-2 text-[13px] outline-none focus:border-[#0b2da0] max-w-full"
                      >
                        {columnas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.titulo}
                          </option>
                        ))}
                      </select>
                    </Fila>

                    <Fila icono={<LinkSimple size={18} />} titulo="Enlaces">
                      <div className="w-full space-y-1.5">
                        {t.enlaces.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 rounded-lg border border-[#E9EDF5] px-2.5 py-1.5">
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-[13.5px] text-[#0b2da0] hover:underline">
                              {e.titulo || e.url}
                            </a>
                            <ArrowSquareOut size={14} className="shrink-0 text-[#8A93B3]" />
                            <button
                              onClick={() => guardar({ enlaces: t.enlaces.filter((x) => x.id !== e.id) })}
                              aria-label="Quitar el enlace"
                              className="shrink-0 text-[#8A93B3] hover:text-[#B42318]"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <input
                            value={enlaceUrl}
                            onChange={(e) => setEnlaceUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && anadirEnlace()}
                            placeholder="Pega un enlace: Drive, Bunny, Canva…"
                            className="flex-1 min-w-0 h-8 rounded-lg border border-[#E2E7F0] px-2.5 text-[13px] outline-none focus:border-[#0b2da0]"
                          />
                          <input
                            value={enlaceTitulo}
                            onChange={(e) => setEnlaceTitulo(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && anadirEnlace()}
                            placeholder="Nombre (opcional)"
                            className="sm:w-[180px] h-8 rounded-lg border border-[#E2E7F0] px-2.5 text-[13px] outline-none focus:border-[#0b2da0]"
                          />
                          <button onClick={anadirEnlace} disabled={!enlaceUrl.trim()} className="h-8 px-3 rounded-lg bg-[#0b2da0] text-white text-[12.5px] font-semibold disabled:opacity-40">
                            Añadir
                          </button>
                        </div>
                      </div>
                    </Fila>

                    <div className="pt-3">
                      <h3 className="text-[15px] font-semibold text-[#0B1033]" style={POPPINS}>
                        Descripción
                      </h3>
                      <EditorDescripcion id={t.id} inicial={t.descripcion} onCambio={alEscribir} />
                    </div>
                  </div>
                ) : pestana === 'adjuntos' ? (
                  <div>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setArrastrando(true)
                      }}
                      onDragLeave={() => setArrastrando(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setArrastrando(false)
                        subir(e.dataTransfer.files)
                      }}
                      className={`rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${arrastrando ? 'border-[#0b2da0] bg-[#F3F6FE]' : 'border-[#D6DDEC]'}`}
                    >
                      <UploadSimple size={26} className="mx-auto text-[#8A93B3]" />
                      <p className="mt-2 text-[14px] text-[#3B4262]">Arrastra aquí los archivos (PDF, presentaciones, audio, vídeo…) o</p>
                      <button onClick={() => archivoRef.current?.click()} disabled={subiendo} className="mt-2 h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-50">
                        {subiendo ? 'Subiendo…' : 'Elegir archivos'}
                      </button>
                      <p className="mt-2 text-[12px] text-[#8A93B3]">Hasta 50 MB cada uno. Para vídeos grandes, mejor pega su enlace en Detalles.</p>
                      <input ref={archivoRef} type="file" multiple hidden onChange={(e) => subir(e.target.files)} />
                    </div>
                    <ul className="mt-4 divide-y divide-[#EEF1F7]">
                      {t.adjuntos.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 py-2.5">
                          <span className="w-10 h-10 shrink-0 rounded-lg bg-[#F1F4FA] flex items-center justify-center text-[10.5px] font-bold uppercase text-[#4A5272]">{(a.ext || '').replace('.', '')}</span>
                          <div className="flex-1 min-w-0">
                            <button onClick={() => abrir(a.id)} className="block max-w-full truncate text-left text-[14px] font-medium text-[#0B1033] hover:text-[#0b2da0]">
                              {a.nombre}
                            </button>
                            <p className="text-[12px] text-[#8A93B3]">
                              {tamano(a.tamano)} · {a.por ? `${a.por}, ` : ''}
                              {haceCuanto(a.subido)}
                            </p>
                          </div>
                          <button onClick={() => bajar(a.id, a.nombre)} aria-label="Bajar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4A5272] hover:bg-[#F1F4FA]">
                            <DownloadSimple size={17} />
                          </button>
                          <button onClick={() => quitarAdjunto(a.id, a.nombre)} aria-label="Quitar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8A93B3] hover:text-[#B42318] hover:bg-[#FEF3F2]">
                            <Trash size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!t.adjuntos.length ? <p className="mt-3 text-[13.5px] text-[#8A93B3]">Aún no hay archivos.</p> : null}
                  </div>
                ) : (
                  <div>
                    <div className="space-y-4">
                      {(t.comentarios || []).map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <AvatarPersona nombre={c.autor} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px]">
                              <span className="font-semibold text-[#0B1033]">{c.autor}</span>
                              <span className="text-[#8A93B3]">
                                {' '}
                                · {haceCuanto(c.created_at)}
                                {c.editado_at ? ' · editado' : ''}
                              </span>
                            </p>
                            {editando?.id === c.id ? (
                              <div className="mt-1">
                                <textarea
                                  value={editando.texto}
                                  onChange={(e) => setEditando({ id: c.id, texto: e.target.value })}
                                  rows={3}
                                  className="w-full rounded-lg border border-[#E2E7F0] px-3 py-2 text-[14px] outline-none focus:border-[#0b2da0]"
                                />
                                <div className="mt-1 flex gap-2">
                                  <button onClick={guardarEdicion} className="h-8 px-3 rounded-lg bg-[#0b2da0] text-white text-[12.5px] font-semibold">
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditando(null)} className="h-8 px-3 text-[12.5px] text-[#6B7393]">
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1A2040]">{c.texto}</p>
                            )}
                            {editando?.id !== c.id ? (
                              <div className="mt-0.5 flex gap-3 text-[12px]">
                                {c.user_id === yo.id ? (
                                  <button onClick={() => setEditando({ id: c.id, texto: c.texto })} className="text-[#6B7393] hover:text-[#0B1033]">
                                    Editar
                                  </button>
                                ) : null}
                                {c.user_id === yo.id || yo.admin ? (
                                  <button onClick={() => quitarComentario(c)} className="text-[#6B7393] hover:text-[#B42318]">
                                    Borrar
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {!(t.comentarios || []).length ? <p className="text-[13.5px] text-[#8A93B3]">Aún no hay comentarios. Aquí podéis hablar de esta lección sin WhatsApp.</p> : null}
                    </div>
                    <div className="mt-5">
                      <textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviarComentario()
                        }}
                        rows={3}
                        placeholder="Escribe un comentario…"
                        className="w-full rounded-xl border border-[#E2E7F0] px-3 py-2.5 text-[14px] outline-none focus:border-[#0b2da0]"
                      />
                      <div className="mt-1.5 flex justify-end">
                        <button onClick={enviarComentario} disabled={!comentario.trim()} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-40">
                          Comentar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </EnElCuerpo>
  )
}
