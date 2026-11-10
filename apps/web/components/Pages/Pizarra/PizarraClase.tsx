'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsIn,
  ArrowsOut,
  CaretLeft,
  CaretRight,
  Check,
  Cursor,
  Eraser,
  Eye,
  EyeSlash,
  FilePdf,
  Highlighter,
  PencilSimple,
  Plus,
  TextT,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { confirmar } from '@/lib/nawar/confirmar'
import {
  COLORES,
  COLORES_ROTULADOR,
  GROSORES,
  GROSOR_ROTULADOR,
  INTERLINEADO,
  TAMANOS,
  ajustarAlPdf,
  horaCorta,
  paraLosAlumnos,
  simplificar,
  tocaLinea,
  type DocPizarra,
  type EstiloTexto,
  type Herramienta,
  type PaginaPizarra,
  type Trazo,
  type TrazoLinea,
  type TrazoTexto,
} from '@/lib/nawar/pizarra'
import { bajarFuente, getPizarra, guardarNotas, publicarPizarra, quitarPublicada, urlPdfConNotas, type Pizarra } from '@services/pizarra/pizarra'
import { subirArchivoProfe } from '@services/tareas/tareas'
import { cajaDeTexto, letrasDeLaEscuela, pintarEnBlanco, pintarTrazos, type Letras } from './dibujo'

/**
 * La pizarra de clase (10/11/2026): el profe abre aquí la presentación de la
 * semana mientras comparte pantalla, escribe encima (lápiz, rotulador, texto
 * con la letra de la escuela, páginas en blanco) y con «Guardar para los
 * alumnos» esa es la presentación de después de clase. La explicación entera,
 * en apps/api/src/services/tareas/pizarra.py.
 *
 * Ocupa toda la ventana (sin la barra de la escuela): es lo que se comparte.
 */

type Tam = { w: number; h: number }
type Editando = { i: number | null; x: number; y: number; texto: string; estilo: EstiloTexto; tam: number; color: string }
type Guardado = 'guardado' | 'sin-guardar' | 'guardando' | 'error'

const BLANCO = '#FFFFFF'
const A4: Tam = { w: 595, h: 842 }

export default function PizarraClase({ semanaId }: { semanaId: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const id = Number(semanaId)

  const [info, setInfo] = useState<Pizarra | null>(null)
  const [fallo, setFallo] = useState('')
  const [fuente, setFuente] = useState('')
  const [pdfListo, setPdfListo] = useState(0)
  const [tams, setTams] = useState<Tam[]>([])
  const [doc, setDoc] = useState<DocPizarra>({ v: 1, paginas: [] })
  const [idx, setIdx] = useState(0)
  const [herramienta, setHerramienta] = useState<Herramienta>('lapiz')
  const [color, setColor] = useState<string>(COLORES[0])
  const [colorRot, setColorRot] = useState<string>(COLORES_ROTULADOR[0])
  const [grosor, setGrosor] = useState<keyof typeof GROSORES>('medio')
  const [tamTexto, setTamTexto] = useState<keyof typeof TAMANOS>('normal')
  const [estilo, setEstilo] = useState<EstiloTexto>('texto')
  const [editando, setEditando] = useState<Editando | null>(null)
  const [guardado, setGuardado] = useState<Guardado>('guardado')
  const [guardadaAt, setGuardadaAt] = useState('')
  const [publicando, setPublicando] = useState('')
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({})
  const [area, setArea] = useState<Tam>({ w: 0, h: 0 })
  const [completa, setCompleta] = useState(false)
  const [historia, setHistoria] = useState({ atras: 0, adelante: 0 })
  const [subiendo, setSubiendo] = useState(false)
  const [falloPdf, setFalloPdf] = useState('')

  const pdfRef = useRef<any>(null)
  const docRef = useRef(doc)
  docRef.current = doc
  const idxRef = useRef(idx)
  idxRef.current = idx
  const editRef = useRef(editando)
  editRef.current = editando
  const areaRef = useRef<HTMLDivElement>(null)
  const fondoRef = useRef<HTMLCanvasElement>(null)
  const notasRef = useRef<HTMLCanvasElement>(null)
  const letrasRef = useRef<Letras | null>(null)
  const vivoRef = useRef<TrazoLinea | null>(null)
  const gestoRef = useRef<{ tipo: 'borrar' | 'mover'; i?: number; dx?: number; dy?: number; apuntado?: boolean } | null>(null)
  const atras = useRef<{ idx: number; trazos: Trazo[] }[]>([])
  const adelante = useRef<{ idx: number; trazos: Trazo[] }[]>([])
  const sucio = useRef(0)
  const guardandoRef = useRef(false)
  const cerradoAt = useRef(0)
  const cuadro = useRef(0)

  const letras = () => (letrasRef.current ||= letrasDeLaEscuela())
  const tamDe = useCallback((pg?: PaginaPizarra | null): Tam => (pg?.origen ? tams[pg.origen - 1] : tams[0]) || A4, [tams])

  // ── Cargar la semana ────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!token || !id) return
    try {
      const datos = await getPizarra(id, token)
      setInfo(datos)
      setFuente((f) => f || datos.fuente)
      setGuardadaAt(datos.guardada_at)
    } catch (e: any) {
      setFallo(e?.message || 'No se pudo abrir la pizarra')
    }
  }, [id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  // ── Abrir el PDF con pdf.js ─────────────────────────────────────────────
  useEffect(() => {
    if (!info || !fuente || !token) return
    let vivo = true
    let worker: Worker | null = null
    let tarea: any = null
    setPdfListo(0)
    setFalloPdf('')
    setMiniaturas({})
    ;(async () => {
      try {
        const datos = await bajarFuente(id, fuente, token)
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
        worker = new Worker(new URL('../../Objects/Activities/DocumentPdf/pdf.worker.ts', import.meta.url), { type: 'module' })
        tarea = pdfjs.getDocument({ data: new Uint8Array(datos), worker: new pdfjs.PDFWorker({ port: worker }) })
        const pdf = await tarea.promise
        const medidas: Tam[] = []
        for (let n = 1; n <= pdf.numPages; n++) {
          const v = (await pdf.getPage(n)).getViewport({ scale: 1 })
          medidas.push({ w: v.width, h: v.height })
        }
        if (!vivo) return
        pdfRef.current = pdf
        setTams(medidas)
        // Lo guardado vale para la presentación con la que se escribió.
        const guardado = info.fuente === fuente ? info.anotaciones : null
        const inicial = ajustarAlPdf(guardado, pdf.numPages)
        docRef.current = inicial
        setDoc(inicial)
        setIdx((i) => Math.min(i, Math.max(0, inicial.paginas.length - 1)))
        atras.current = []
        adelante.current = []
        setHistoria({ atras: 0, adelante: 0 })
        setPdfListo((n) => n + 1)
      } catch (e: any) {
        if (vivo) setFalloPdf(/pdf|structure|password/i.test(e?.message || '') ? 'Ese archivo no se deja leer como PDF. Vuelve a exportarlo (Exportar → PDF) y súbelo otra vez.' : e?.message || 'No se pudo abrir la presentación')
      }
    })()
    return () => {
      vivo = false
      pdfRef.current = null
      Promise.resolve(tarea?.destroy()).finally(() => worker?.terminate())
    }
    // `info` solo importa la primera vez (lo guardado); recargarla no reabre el PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, token, id, !!info])

  /** Una página (del PDF o en blanco) pintada en un lienzo nuevo de ese ancho. */
  const pintarPagina = useCallback(
    async (pg: PaginaPizarra, ancho: number, cancelar?: { tarea?: any }): Promise<HTMLCanvasElement> => {
      const t = tamDe(pg)
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.round(ancho)
      lienzo.height = Math.round((ancho * t.h) / t.w)
      const ctx = lienzo.getContext('2d')!
      ctx.fillStyle = BLANCO
      ctx.fillRect(0, 0, lienzo.width, lienzo.height)
      const pdf = pdfRef.current
      if (pg.origen && pdf) {
        const pagina = await pdf.getPage(pg.origen)
        const base = pagina.getViewport({ scale: 1 })
        const tarea = pagina.render({ canvas: lienzo, canvasContext: ctx, viewport: pagina.getViewport({ scale: lienzo.width / base.width }) })
        if (cancelar) cancelar.tarea = tarea
        await tarea.promise
      } else if (!pg.origen) {
        pintarEnBlanco(ctx, lienzo.width, lienzo.height, pg.titulo || '', info?.semana.tema || '', letras())
      }
      return lienzo
    },
    [tamDe, info?.semana.tema]
  )

  // ── Miniaturas, de una en una ───────────────────────────────────────────
  useEffect(() => {
    if (!pdfListo) return
    let vivo = true
    ;(async () => {
      for (let n = 1; n <= tams.length && vivo; n++) {
        try {
          const c = await pintarPagina({ origen: n, trazos: [] }, 240)
          const url = c.toDataURL('image/jpeg', 0.7)
          c.width = 0
          if (vivo) setMiniaturas((m) => ({ ...m, [n]: url }))
        } catch {
          /* una miniatura que falla no importa */
        }
      }
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfListo])

  // ── El tamaño de la página en pantalla ──────────────────────────────────
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const medir = () => setArea({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [!!info, pdfListo])

  const pagina = doc.paginas[idx] || null
  const escena = useMemo<Tam>(() => {
    const t = tamDe(pagina)
    if (!area.w || !area.h) return { w: 0, h: 0 }
    const w = Math.max(120, Math.min(area.w - 24, ((area.h - 24) * t.w) / t.h))
    return { w: Math.floor(w), h: Math.floor((w * t.h) / t.w) }
  }, [area, pagina, tamDe])
  const densidad = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)

  // ── El fondo: la página del PDF ─────────────────────────────────────────
  useEffect(() => {
    const lienzo = fondoRef.current
    const pg = docRef.current.paginas[idx]
    if (!lienzo || !pg || !escena.w || !pdfListo) return
    let vivo = true
    const cancelar: { tarea?: any } = {}
    pintarPagina(pg, escena.w * densidad, cancelar)
      .then((c) => {
        if (!vivo) return
        lienzo.width = c.width
        lienzo.height = c.height
        lienzo.getContext('2d')!.drawImage(c, 0, 0)
        c.width = 0
      })
      .catch(() => undefined)
    return () => {
      vivo = false
      try {
        cancelar.tarea?.cancel()
      } catch {
        /* ya había terminado */
      }
    }
  }, [idx, escena.w, escena.h, pdfListo, pagina?.origen, pagina?.titulo, densidad, pintarPagina])

  // ── Lo escrito, encima ──────────────────────────────────────────────────
  const repintar = useCallback(() => {
    const c = notasRef.current
    const pg = docRef.current.paginas[idxRef.current]
    if (!c || !pg) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    pintarTrazos(ctx, pg.trazos, c.width, c.height, letras(), editRef.current?.i ?? -1)
    if (vivoRef.current) pintarTrazos(ctx, [vivoRef.current], c.width, c.height, letras())
  }, [])

  useEffect(() => {
    const c = notasRef.current
    if (!c || !escena.w) return
    const W = Math.round(escena.w * densidad)
    const H = Math.round(escena.h * densidad)
    if (c.width !== W || c.height !== H) {
      c.width = W
      c.height = H
    }
    repintar()
  }, [doc, idx, escena.w, escena.h, editando, densidad, repintar])

  // La letra de la escuela puede llegar después del primer pintado.
  useEffect(() => {
    ;(document as any).fonts?.ready?.then(() => {
      letrasRef.current = null
      repintar()
    })
  }, [repintar])

  // ── Guardar solo ────────────────────────────────────────────────────────
  const guardar = useCallback(async (): Promise<boolean> => {
    if (!token || !fuente) return false
    if (guardandoRef.current) return false
    guardandoRef.current = true
    const marca = sucio.current
    setGuardado('guardando')
    try {
      const r = await guardarNotas(id, fuente, docRef.current, token)
      setGuardadaAt(r.guardada_at)
      setGuardado(sucio.current === marca ? 'guardado' : 'sin-guardar')
      return true
    } catch (e: any) {
      setGuardado('error')
      toast.error(e?.message || 'No se pudo guardar lo escrito')
      return false
    } finally {
      guardandoRef.current = false
    }
  }, [fuente, id, token])

  const ensuciar = useCallback(() => {
    sucio.current += 1
    setGuardado('sin-guardar')
  }, [])

  useEffect(() => {
    if (guardado !== 'sin-guardar') return
    const t = setTimeout(() => guardar(), 1500)
    return () => clearTimeout(t)
  }, [guardado, doc, guardar])

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (guardado === 'sin-guardar' || guardado === 'guardando') e.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [guardado])

  // ── Cambiar lo escrito ──────────────────────────────────────────────────
  const poner = useCallback(
    (trazos: Trazo[], deshacer = true, en = idxRef.current) => {
      const d = docRef.current
      if (!d.paginas[en]) return
      if (deshacer) {
        atras.current.push({ idx: en, trazos: d.paginas[en].trazos })
        if (atras.current.length > 200) atras.current.shift()
        adelante.current = []
        setHistoria({ atras: atras.current.length, adelante: 0 })
      }
      const paginas = d.paginas.slice()
      paginas[en] = { ...paginas[en], trazos }
      const nuevo = { ...d, paginas }
      docRef.current = nuevo
      setDoc(nuevo)
      ensuciar()
    },
    [ensuciar]
  )

  const cambiarPaginas = useCallback(
    (paginas: PaginaPizarra[]) => {
      const nuevo: DocPizarra = { v: 1, paginas }
      docRef.current = nuevo
      setDoc(nuevo)
      ensuciar()
    },
    [ensuciar]
  )

  const volver = useCallback(
    (de: typeof atras, a: typeof atras) => {
      const paso = de.current.pop()
      if (!paso) return
      const d = docRef.current
      if (!d.paginas[paso.idx]) return
      a.current.push({ idx: paso.idx, trazos: d.paginas[paso.idx].trazos })
      const paginas = d.paginas.slice()
      paginas[paso.idx] = { ...paginas[paso.idx], trazos: paso.trazos }
      const nuevo = { ...d, paginas }
      docRef.current = nuevo
      setDoc(nuevo)
      setIdx(paso.idx)
      setHistoria({ atras: atras.current.length, adelante: adelante.current.length })
      ensuciar()
    },
    [ensuciar]
  )
  const deshacer = useCallback(() => volver(atras, adelante), [volver])
  const rehacer = useCallback(() => volver(adelante, atras), [volver])

  // ── El texto ────────────────────────────────────────────────────────────
  const cerrarTexto = useCallback(() => {
    const e = editRef.current
    if (!e) return
    cerradoAt.current = Date.now()
    setEditando(null)
    editRef.current = null
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    const texto = e.texto.replace(/\s+$/g, '')
    if (e.i == null) {
      if (texto.trim()) poner([...trazos, { t: 'texto', x: e.x, y: e.y, texto, color: e.color, tam: e.tam, estilo: e.estilo }])
      return
    }
    const viejo = trazos[e.i] as TrazoTexto | undefined
    if (!viejo) return
    if (!texto.trim()) poner(trazos.filter((_, k) => k !== e.i))
    else if (texto !== viejo.texto) poner(trazos.map((t, k) => (k === e.i ? { ...viejo, texto } : t)))
    else repintar()
  }, [poner, repintar])

  const textoEn = useCallback((x: number, y: number): number => {
    const c = notasRef.current
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    if (!c) return -1
    const ctx = c.getContext('2d')!
    for (let i = trazos.length - 1; i >= 0; i--) {
      const t = trazos[i]
      if (t.t !== 'texto') continue
      const caja = cajaDeTexto(ctx, t, c.width, c.height, letras())
      const px = x * c.width
      const py = y * c.height
      const m = 6 * densidad
      if (px >= caja.x - m && px <= caja.x + caja.w + m && py >= caja.y - m && py <= caja.y + caja.h + m) return i
    }
    return -1
  }, [densidad])

  const abrirTexto = useCallback(
    (x: number, y: number) => {
      const i = textoEn(x, y)
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      if (i >= 0) {
        const t = trazos[i] as TrazoTexto
        setEditando({ i, x: t.x, y: t.y, texto: t.texto, estilo: t.estilo, tam: t.tam, color: t.color })
      } else {
        const oscuro = color === BLANCO ? COLORES[1] : color
        setEditando({ i: null, x, y, texto: '', estilo, tam: TAMANOS[tamTexto], color: estilo === 'nota' ? COLORES[0] : estilo === 'titulo' ? color : oscuro })
      }
    },
    [color, estilo, tamTexto, textoEn]
  )

  // ── El ratón, el dedo o el lápiz ────────────────────────────────────────
  const donde = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const r = notasRef.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]
  }

  const borrarEn = (x: number, y: number) => {
    const c = notasRef.current
    const g = gestoRef.current
    if (!c || !g) return
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    const alto = c.height / c.width
    const tocado = textoEn(x, y)
    const quedan = trazos.filter((t, i) => (t.t === 'texto' ? i !== tocado : !tocaLinea(t, x, y, 0.012, alto)))
    if (quedan.length === trazos.length) return
    poner(quedan, !g.apuntado)
    g.apuntado = true
  }

  const alBajar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editRef.current || !pagina) return
    const [x, y] = donde(e)
    if (herramienta === 'lapiz' || herramienta === 'rotulador') {
      e.currentTarget.setPointerCapture(e.pointerId)
      vivoRef.current = {
        t: herramienta,
        color: herramienta === 'rotulador' ? colorRot : color,
        grosor: herramienta === 'rotulador' ? GROSOR_ROTULADOR : GROSORES[grosor],
        p: [x, y],
      }
      repintar()
    } else if (herramienta === 'borrador') {
      e.currentTarget.setPointerCapture(e.pointerId)
      gestoRef.current = { tipo: 'borrar' }
      borrarEn(x, y)
    } else if (herramienta === 'mover') {
      const i = textoEn(x, y)
      if (i < 0) return
      const t = docRef.current.paginas[idx].trazos[i] as TrazoTexto
      e.currentTarget.setPointerCapture(e.pointerId)
      gestoRef.current = { tipo: 'mover', i, dx: x - t.x, dy: y - t.y }
    }
  }

  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = donde(e)
    const v = vivoRef.current
    if (v) {
      v.p.push(x, y)
      cancelAnimationFrame(cuadro.current)
      cuadro.current = requestAnimationFrame(repintar)
      return
    }
    const g = gestoRef.current
    if (!g) return
    if (g.tipo === 'borrar') borrarEn(x, y)
    else if (g.tipo === 'mover' && g.i != null) {
      const trazos = docRef.current.paginas[idxRef.current].trazos
      const t = trazos[g.i] as TrazoTexto
      const nx = Math.max(0, Math.min(0.98, x - (g.dx || 0)))
      const ny = Math.max(0, Math.min(0.98, y - (g.dy || 0)))
      if (Math.abs(nx - t.x) + Math.abs(ny - t.y) < 0.001) return
      poner(trazos.map((o, k) => (k === g.i ? { ...t, x: nx, y: ny } : o)), !g.apuntado)
      g.apuntado = true
    }
  }

  const alSoltar = () => {
    const v = vivoRef.current
    if (v) {
      vivoRef.current = null
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      poner([...trazos, { ...v, p: simplificar(v.p) }])
    }
    gestoRef.current = null
  }

  const alPulsar = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (herramienta !== 'texto' || editRef.current) return
    // El clic que cierra un texto no abre otro.
    if (Date.now() - cerradoAt.current < 350) return
    const [x, y] = donde(e)
    abrirTexto(x, y)
  }

  const alDobleClic = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (herramienta !== 'mover') return
    const [x, y] = donde(e)
    if (textoEn(x, y) >= 0) abrirTexto(x, y)
  }

  // ── Páginas ─────────────────────────────────────────────────────────────
  const ir = useCallback(
    (n: number) => {
      cerrarTexto()
      setIdx(Math.max(0, Math.min(docRef.current.paginas.length - 1, n)))
    },
    [cerrarTexto]
  )

  const paginaEnBlanco = () => {
    cerrarTexto()
    const paginas = docRef.current.paginas.slice()
    paginas.splice(idx + 1, 0, { origen: null, titulo: 'Notas de la clase', trazos: [] })
    cambiarPaginas(paginas)
    setIdx(idx + 1)
  }

  const esconder = () => {
    if (!pagina) return
    cambiarPaginas(docRef.current.paginas.map((p, k) => (k === idx ? { ...p, oculta: !p.oculta } : p)))
  }

  const quitarPagina = async () => {
    if (!pagina || pagina.origen != null) return
    if (pagina.trazos.length && !(await confirmar('¿Quitar esta página de notas? Lo escrito en ella se pierde.', { boton: 'Quitar', peligro: true }))) return
    cambiarPaginas(docRef.current.paginas.filter((_, k) => k !== idx))
    setIdx(Math.max(0, idx - 1))
  }

  const limpiarPagina = async () => {
    if (!pagina?.trazos.length) return
    if (!(await confirmar('¿Borrar todo lo escrito en esta página?', { boton: 'Borrar', peligro: false }))) return
    poner([])
  }

  // ── Teclas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) rehacer()
        else deshacer()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        ir(idxRef.current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        ir(idxRef.current - 1)
      } else {
        const atajo: Record<string, Herramienta> = { v: 'mover', l: 'lapiz', r: 'rotulador', t: 'texto', b: 'borrador' }
        const h = atajo[e.key.toLowerCase()]
        if (h) setHerramienta(h)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [deshacer, rehacer, ir])

  // ── Pantalla completa ───────────────────────────────────────────────────
  useEffect(() => {
    const cambio = () => setCompleta(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])
  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  // ── Guardar para los alumnos ────────────────────────────────────────────
  const publicar = async () => {
    if (publicando || !info) return
    cerrarTexto()
    const paginas = paraLosAlumnos(docRef.current)
    if (!paginas.length) {
      toast.error('Todas las páginas están escondidas: los alumnos no verían nada')
      return
    }
    const ya = info.publicada
    const ok = await confirmar(
      ya
        ? 'Los alumnos ya tienen una versión de esta presentación. ¿Cambiarla por la de ahora, con lo que has escrito?'
        : `¿Guardar esta presentación, con lo que has escrito, para los alumnos de ${info.semana.curso || 'la clase'}? La verán en su semana desde el día de la clase.`,
      { boton: 'Guardar para los alumnos', peligro: false }
    )
    if (!ok) return
    try {
      setPublicando('Guardando lo escrito…')
      await guardar()
      const { jsPDF } = await import('jspdf')
      await (document as any).fonts?.ready
      letrasRef.current = null
      let pdf: any = null
      for (let n = 0; n < paginas.length; n++) {
        setPublicando(`Preparando la página ${n + 1} de ${paginas.length}…`)
        const pg = paginas[n]
        const t = tamDe(pg)
        const c = await pintarPagina(pg, t.w >= t.h ? 1920 : 1500)
        pintarTrazos(c.getContext('2d')!, pg.trazos, c.width, c.height, letras())
        const imagen = c.toDataURL('image/jpeg', 0.86)
        c.width = 0
        const giro = t.w > t.h ? 'l' : 'p'
        if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [t.w, t.h], orientation: giro, compress: true })
        else pdf.addPage([t.w, t.h], giro)
        pdf.addImage(imagen, 'JPEG', 0, 0, t.w, t.h, undefined, 'FAST')
        // Que la pantalla respire entre página y página.
        await new Promise((r) => setTimeout(r, 0))
      }
      setPublicando('Subiendo a la escuela…')
      const pub = await publicarPizarra(id, pdf.output('blob'), paginas.length, token)
      setInfo((i) => (i ? { ...i, publicada: pub } : i))
      toast.success('Guardada: los alumnos ya la tienen en su semana')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar para los alumnos')
    } finally {
      setPublicando('')
    }
  }

  const verPublicada = async () => {
    const ventana = window.open('', '_blank')
    try {
      const url = await urlPdfConNotas(id, token)
      if (ventana) ventana.location.href = url
    } catch (e: any) {
      ventana?.close()
      toast.error(e?.message || 'No se pudo abrir')
    }
  }

  const quitar = async () => {
    if (!(await confirmar('¿Quitar la presentación con notas de la semana de los alumnos? Lo que has escrito aquí no se borra.', { boton: 'Quitar', peligro: false }))) return
    try {
      await quitarPublicada(id, token)
      setInfo((i) => (i ? { ...i, publicada: null } : i))
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo quitar')
    }
  }

  const subir = async (archivo?: File | null) => {
    if (!archivo) return
    if (!/\.pdf$/i.test(archivo.name)) {
      toast.error('Tiene que ser un PDF. Desde PowerPoint, Keynote, Canva o Claude: Exportar → PDF.')
      return
    }
    setSubiendo(true)
    try {
      const m = await subirArchivoProfe(id, archivo, token)
      const nuevo = [...(m?.archivos || [])].reverse().find((a) => a.tipo === 'archivo' && /\.pdf$/i.test(a.nombre))
      await cargar()
      if (nuevo) setFuente(`profe:${nuevo.id}`)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir')
    } finally {
      setSubiendo(false)
    }
  }

  const cambiarFuente = async (nueva: string) => {
    if (nueva === fuente) return
    const escrito = docRef.current.paginas.some((p) => p.trazos.length)
    if (escrito && !(await confirmar('Lo que has escrito es de la otra presentación. Si cambias y escribes en esta, lo anterior se sustituye. ¿Cambiar?', { boton: 'Cambiar', peligro: false }))) return
    setFuente(nueva)
    setIdx(0)
  }

  // ── Pantalla ────────────────────────────────────────────────────────────
  if (fallo) {
    return (
      <Marco>
        <div className="m-auto max-w-md px-6 text-center">
          <p className="text-[15px] font-semibold text-[#0a1656]">No se pudo abrir la pizarra</p>
          <p className="mt-2 text-[14px] text-[#171a2e]">{fallo}</p>
          <Link href="/equipo" className="mt-5 inline-block rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white">
            Volver a la sala de profesores
          </Link>
        </div>
      </Marco>
    )
  }
  if (!info) {
    return (
      <Marco>
        <p className="m-auto animate-pulse text-[14px] text-[#0a1656]/70">Abriendo la pizarra…</p>
      </Marco>
    )
  }

  const sinPdf = info.fuentes.length === 0
  const total = doc.paginas.length
  const trazoColor = herramienta === 'rotulador' ? colorRot : color
  const despues = !!info.publicada && !!guardadaAt && guardadaAt > info.publicada.at

  return (
    <Marco>
      {/* Arriba */}
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#E2E8F4] bg-white px-3 sm:px-4">
        <Link href="/equipo" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13.5px] font-medium text-[#0a1656] hover:text-[#0b2da0]" title="Volver a la sala de profesores">
          <CaretLeft size={16} weight="bold" />
          <span className="hidden sm:inline">Sala de profesores</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-poppins)] text-[15px] font-semibold leading-tight text-[#0a1656]">{info.semana.tema || 'Clase'}</p>
          <p className="truncate text-[12px] leading-tight text-[#5B6B8C]">
            {info.semana.curso}
            {!sinPdf && (
              <>
                {' · '}
                <EstadoGuardado estado={guardado} at={guardadaAt} />
              </>
            )}
          </p>
        </div>
        {info.fuentes.length > 1 && (
          <select
            value={fuente}
            onChange={(e) => cambiarFuente(e.target.value)}
            className="max-w-[140px] rounded-lg border border-[#E2E8F4] bg-white px-2 py-1.5 text-[13px] text-[#0a1656] sm:max-w-[220px]"
            title="Sobre qué presentación escribes"
          >
            {info.fuentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.de === 'profe' ? 'Completa: ' : 'La de los alumnos: '}
                {f.nombre}
              </option>
            ))}
          </select>
        )}
        <button onClick={pantallaCompleta} className="hidden rounded-lg p-2 text-[#0a1656] hover:text-[#0b2da0] sm:block" title={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          {completa ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
        </button>
        {!sinPdf && (
          <button
            onClick={publicar}
            disabled={!!publicando || !pdfListo || !!falloPdf}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0b2da0] px-3.5 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
          >
            <Check size={15} weight="bold" />
            <span className="hidden sm:inline">Guardar para los alumnos</span>
            <span className="sm:hidden">Guardar</span>
          </button>
        )}
      </header>

      {info.publicada && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#E2E8F4] bg-white px-4 py-1.5 text-[12.5px] text-[#171a2e]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: despues ? '#E4B252' : '#16A34A' }} />
            {despues
              ? 'Has escrito después de guardarla para los alumnos: vuelve a guardarla para que vean lo último.'
              : `Los alumnos tienen la versión de las ${horaCorta(info.publicada.at)} (${info.publicada.paginas} páginas).`}
          </span>
          <button onClick={verPublicada} className="font-semibold text-[#0b2da0]">
            Ver cómo la ven
          </button>
          <button onClick={quitar} className="text-[#5B6B8C] hover:text-[#B4413C]">
            Quitar
          </button>
        </div>
      )}

      {sinPdf ? (
        <div className="m-auto max-w-lg px-6 text-center">
          <FilePdf size={34} className="mx-auto text-[#0b2da0]" />
          <p className="mt-3 font-[family-name:var(--font-poppins)] text-[18px] font-semibold text-[#0a1656]">Esta semana aún no tiene la presentación en PDF</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#171a2e]">
            Súbela aquí y podrás abrirla en clase, escribir encima y guardarla para los alumnos. Tiene que ser un PDF: desde PowerPoint, Keynote, Canva o
            Claude, «Exportar → PDF».
          </p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white">
            <UploadSimple size={16} weight="bold" />
            {subiendo ? 'Subiendo…' : 'Subir la presentación'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Las páginas */}
          <aside className="hidden w-[148px] shrink-0 flex-col border-r border-[#E2E8F4] bg-white lg:flex">
            <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
              {doc.paginas.map((pg, k) => (
                <Miniatura key={k} n={k + 1} pagina={pg} src={pg.origen ? miniaturas[pg.origen] : ''} tam={tamDe(pg)} elegida={k === idx} onClick={() => ir(k)} />
              ))}
            </div>
            <button onClick={paginaEnBlanco} className="flex items-center justify-center gap-1.5 border-t border-[#E2E8F4] px-2 py-2.5 text-[12.5px] font-semibold text-[#0b2da0]">
              <Plus size={13} weight="bold" /> Página en blanco
            </button>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* La página */}
            <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {falloPdf ? (
                <div className="max-w-md px-6 text-center">
                  <p className="text-[15px] font-semibold text-[#0a1656]">No se pudo abrir esta presentación</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#171a2e]">{falloPdf}</p>
                  {info.fuentes.length > 1 && <p className="mt-2 text-[13.5px] text-[#5B6B8C]">Arriba puedes elegir otra de las presentaciones de esta semana.</p>}
                  <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white">
                    <UploadSimple size={16} weight="bold" />
                    {subiendo ? 'Subiendo…' : 'Subir otro PDF'}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
                  </label>
                </div>
              ) : !pdfListo ? (
                <p className="animate-pulse text-[14px] text-[#0a1656]/70">Abriendo la presentación…</p>
              ) : (
                pagina && (
                  <div className="relative bg-white" style={{ width: escena.w, height: escena.h, boxShadow: '0 0 0 1px #DDE6F5' }}>
                    <canvas ref={fondoRef} className="absolute inset-0 h-full w-full" />
                    <canvas
                      ref={notasRef}
                      className="absolute inset-0 h-full w-full"
                      style={{
                        touchAction: herramienta === 'mover' || herramienta === 'texto' ? 'manipulation' : 'none',
                        cursor: herramienta === 'texto' ? 'text' : herramienta === 'mover' ? 'default' : 'crosshair',
                      }}
                      onPointerDown={alBajar}
                      onPointerMove={alMover}
                      onPointerUp={alSoltar}
                      onPointerCancel={alSoltar}
                      onClick={alPulsar}
                      onDoubleClick={alDobleClic}
                    />
                    {editando && (
                      <CajaDeTexto
                        e={editando}
                        ancho={escena.w}
                        alto={escena.h}
                        onChange={(texto) => setEditando((v) => (v ? { ...v, texto } : v))}
                        onCerrar={cerrarTexto}
                      />
                    )}
                    {pagina.oculta && (
                      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-[#0a1656] px-2 py-1 text-[11.5px] font-semibold text-white">
                        <EyeSlash size={13} /> Los alumnos no verán esta página
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Las herramientas */}
            <div className="shrink-0 overflow-x-auto border-t border-[#E2E8F4] bg-white">
              <div className="mx-auto flex w-max items-center gap-1 px-3 py-2">
                <Boton activo={herramienta === 'mover'} onClick={() => setHerramienta('mover')} titulo="Mover un texto (V)">
                  <Cursor size={18} />
                </Boton>
                <Boton activo={herramienta === 'lapiz'} onClick={() => setHerramienta('lapiz')} titulo="Lápiz (L)">
                  <PencilSimple size={18} />
                </Boton>
                <Boton activo={herramienta === 'rotulador'} onClick={() => setHerramienta('rotulador')} titulo="Rotulador para resaltar (R)">
                  <Highlighter size={18} />
                </Boton>
                <Boton activo={herramienta === 'texto'} onClick={() => setHerramienta('texto')} titulo="Escribir con el teclado (T)">
                  <TextT size={18} />
                </Boton>
                <Boton activo={herramienta === 'borrador'} onClick={() => setHerramienta('borrador')} titulo="Borrador (B)">
                  <Eraser size={18} />
                </Boton>
                <Raya />
                {herramienta === 'rotulador'
                  ? COLORES_ROTULADOR.map((c) => <Color key={c} c={c} elegido={colorRot === c} onClick={() => setColorRot(c)} />)
                  : [...COLORES, BLANCO].map((c) => <Color key={c} c={c} elegido={color === c} onClick={() => setColor(c)} />)}
                {herramienta === 'lapiz' && (
                  <>
                    <Raya />
                    {(Object.keys(GROSORES) as (keyof typeof GROSORES)[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGrosor(g)}
                        title={`Trazo ${g}`}
                        className={`flex h-9 w-8 items-center justify-center rounded-lg ${grosor === g ? 'bg-[#EAF0FE]' : ''}`}
                      >
                        <span className="rounded-full" style={{ width: g === 'fino' ? 4 : g === 'medio' ? 7 : 11, height: g === 'fino' ? 4 : g === 'medio' ? 7 : 11, background: trazoColor === BLANCO ? '#0a1656' : trazoColor }} />
                      </button>
                    ))}
                  </>
                )}
                {herramienta === 'texto' && (
                  <>
                    <Raya />
                    <Opcion activa={estilo === 'texto'} onClick={() => setEstilo('texto')}>Texto</Opcion>
                    <Opcion activa={estilo === 'titulo'} onClick={() => setEstilo('titulo')}>Título</Opcion>
                    <Opcion activa={estilo === 'nota'} onClick={() => setEstilo('nota')}>Nota</Opcion>
                    <Raya />
                    <Opcion activa={tamTexto === 'pequeno'} onClick={() => setTamTexto('pequeno')}>A−</Opcion>
                    <Opcion activa={tamTexto === 'normal'} onClick={() => setTamTexto('normal')}>A</Opcion>
                    <Opcion activa={tamTexto === 'grande'} onClick={() => setTamTexto('grande')}>A+</Opcion>
                  </>
                )}
                <Raya />
                <Boton onClick={deshacer} apagado={!historia.atras} titulo="Deshacer (Ctrl+Z)">
                  <ArrowCounterClockwise size={18} />
                </Boton>
                <Boton onClick={rehacer} apagado={!historia.adelante} titulo="Rehacer">
                  <ArrowClockwise size={18} />
                </Boton>
                <Boton onClick={limpiarPagina} apagado={!pagina?.trazos.length} titulo="Borrar todo lo escrito en esta página">
                  <Trash size={18} />
                </Boton>
                <Raya />
                <Boton onClick={esconder} activo={!!pagina?.oculta} titulo={pagina?.oculta ? 'Volver a enseñar esta página a los alumnos' : 'Que los alumnos no vean esta página'}>
                  {pagina?.oculta ? <EyeSlash size={18} /> : <Eye size={18} />}
                </Boton>
                <button onClick={paginaEnBlanco} className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-[#0b2da0] lg:hidden" title="Añadir una página en blanco para notas">
                  <Plus size={14} weight="bold" /> Página
                </button>
                {pagina?.origen == null && (
                  <button onClick={quitarPagina} className="h-9 rounded-lg px-2 text-[12.5px] font-medium text-[#5B6B8C] hover:text-[#B4413C]">
                    Quitar página
                  </button>
                )}
                <Raya />
                <Boton onClick={() => ir(idx - 1)} apagado={idx === 0} titulo="Página anterior (←)">
                  <CaretLeft size={18} />
                </Boton>
                <span className="min-w-[54px] text-center text-[13px] font-semibold tabular-nums text-[#0a1656]">
                  {total ? idx + 1 : 0} / {total}
                </span>
                <Boton onClick={() => ir(idx + 1)} apagado={idx >= total - 1} titulo="Página siguiente (→)">
                  <CaretRight size={18} />
                </Boton>
              </div>
            </div>
          </div>
        </div>
      )}

      {publicando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="rounded-xl border border-[#E2E8F4] bg-white px-6 py-5 text-center">
            <p className="font-[family-name:var(--font-poppins)] text-[16px] font-semibold text-[#0a1656]">Guardando para los alumnos</p>
            <p className="mt-1.5 text-[13.5px] text-[#171a2e]">{publicando}</p>
          </div>
        </div>
      )}
    </Marco>
  )
}

/**
 * Toda la ventana. Va colgado del cuerpo de la página (no del marco de la
 * escuela): si no, la barra de arriba de la escuela queda por encima.
 */
function Marco({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false)
  useEffect(() => setListo(true), [])
  if (!listo) return null
  return createPortal(<div className="fixed inset-0 z-[999] flex flex-col bg-[#EEF2F9]">{children}</div>, document.body)
}

function EstadoGuardado({ estado, at }: { estado: Guardado; at: string }) {
  if (estado === 'guardando') return <span>Guardando…</span>
  if (estado === 'sin-guardar') return <span>Sin guardar</span>
  if (estado === 'error') return <span className="text-[#B4413C]">No se pudo guardar</span>
  return <span>{at ? `Lo escrito está guardado (${horaCorta(at)})` : 'Aún no has escrito nada'}</span>
}

function Boton({ children, onClick, activo, apagado, titulo }: { children: React.ReactNode; onClick: () => void; activo?: boolean; apagado?: boolean; titulo: string }) {
  return (
    <button
      onClick={onClick}
      disabled={apagado}
      title={titulo}
      aria-label={titulo}
      className={`flex h-9 w-9 items-center justify-center rounded-lg ${activo ? 'bg-[#0b2da0] text-white' : 'text-[#0a1656] hover:text-[#0b2da0]'} disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

function Opcion({ children, onClick, activa }: { children: React.ReactNode; onClick: () => void; activa: boolean }) {
  return (
    <button onClick={onClick} className={`h-9 rounded-lg px-2.5 text-[12.5px] font-semibold ${activa ? 'bg-[#EAF0FE] text-[#0b2da0]' : 'text-[#0a1656]'}`}>
      {children}
    </button>
  )
}

function Raya() {
  return <span className="mx-1.5 h-6 w-px shrink-0 bg-[#E2E8F4]" />
}

function Color({ c, elegido, onClick }: { c: string; elegido: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Color" className="flex h-9 w-7 items-center justify-center">
      <span
        className="h-5 w-5 rounded-full"
        style={{ background: c, boxShadow: elegido ? `0 0 0 2px #fff, 0 0 0 4px ${c === BLANCO ? '#0a1656' : c}` : c === BLANCO ? 'inset 0 0 0 1px #B7C3DA' : 'none' }}
      />
    </button>
  )
}

function Miniatura({ n, pagina, src, tam, elegida, onClick }: { n: number; pagina: PaginaPizarra; src: string; tam: Tam; elegida: boolean; onClick: () => void }) {
  const caja = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (elegida) caja.current?.scrollIntoView({ block: 'nearest' })
  }, [elegida])
  return (
    <button ref={caja} onClick={onClick} className="block w-full text-left">
      <div
        className="relative w-full overflow-hidden rounded-md bg-white"
        style={{ aspectRatio: `${tam.w} / ${tam.h}`, boxShadow: elegida ? '0 0 0 2px #0b2da0' : '0 0 0 1px #DDE6F5', opacity: pagina.oculta ? 0.45 : 1 }}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full" draggable={false} />
        ) : pagina.origen == null ? (
          <span className="absolute left-2 top-2 text-[9px] font-semibold text-[#0a1656]">Notas</span>
        ) : (
          <span className="absolute inset-0 animate-pulse bg-[#F4F7FD]" />
        )}
        {pagina.trazos.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#0b2da0]" title="Tiene algo escrito" />}
        {pagina.oculta && <EyeSlash size={13} className="absolute bottom-1.5 right-1.5 text-[#0a1656]" />}
      </div>
      <span className={`mt-1 block text-center text-[11px] tabular-nums ${elegida ? 'font-semibold text-[#0b2da0]' : 'text-[#5B6B8C]'}`}>{n}</span>
    </button>
  )
}

/** Donde se escribe un texto: una caja con la misma letra y en el mismo sitio en que quedará. */
function CajaDeTexto({ e, ancho, alto, onChange, onCerrar }: { e: Editando; ancho: number; alto: number; onChange: (t: string) => void; onCerrar: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const px = Math.max(6, e.tam * ancho)
  const lineas = e.texto.split('\n')
  const largo = Math.max(6, ...lineas.map((l) => l.length + 1))
  const nota = e.estilo === 'nota'
  const m = nota ? px * 0.55 : 0
  return (
    <textarea
      ref={ref}
      value={e.texto}
      onChange={(ev) => onChange(ev.target.value)}
      onBlur={onCerrar}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey))) {
          ev.preventDefault()
          ;(ev.target as HTMLTextAreaElement).blur()
        }
        ev.stopPropagation()
      }}
      rows={lineas.length}
      spellCheck={false}
      placeholder="Escribe…"
      className="absolute m-0 resize-none overflow-hidden border-0 outline-dashed outline-1 outline-offset-2 outline-[#4da3ff] placeholder:text-[#0a1656]/35 focus:ring-0"
      style={{
        left: e.x * ancho - m,
        top: e.y * alto - m,
        padding: nota ? `${m}px ${m}px ${m}px ${m + px * 0.25 - Math.max(2, px * 0.14)}px` : 0,
        width: `calc(${largo}ch + ${nota ? m * 2 + px * 0.25 : 4}px)`,
        maxWidth: ancho - e.x * ancho + m,
        fontSize: px,
        lineHeight: INTERLINEADO,
        fontFamily: e.estilo === 'titulo' ? 'var(--font-poppins), sans-serif' : 'var(--font-inter), sans-serif',
        fontWeight: e.estilo === 'titulo' ? 700 : nota ? 500 : 600,
        color: nota ? '#0a1656' : e.color,
        background: nota ? '#F0F5FF' : e.color === BLANCO ? 'rgba(10,22,86,0.35)' : 'rgba(255,255,255,0.7)',
        borderLeft: nota ? `${Math.max(2, px * 0.14)}px solid ${e.color}` : undefined,
        borderRadius: nota ? px * 0.3 : 2,
        whiteSpace: 'pre',
      }}
    />
  )
}
