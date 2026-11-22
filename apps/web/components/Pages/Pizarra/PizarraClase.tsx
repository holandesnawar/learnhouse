'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsIn,
  ArrowsHorizontal,
  ArrowsOut,
  Broom,
  CaretDown,
  CloudCheck,
  DownloadSimple,
  FilePlus,
  PaperPlaneTilt,
  SidebarSimple,
  WarningCircle,
  Broadcast,
  CaretLeft,
  CaretRight,
  Check,
  Copy,
  Cursor,
  Eraser,
  Eye,
  EyeSlash,
  FilePdf,
  Hand,
  Highlighter,
  Minus,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  PencilSimple,
  Plus,
  TextT,
  Trash,
  UploadSimple,
  X,
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
  cajaDeLinea,
  cambiarTamano,
  duplicarTrazo,
  escalarTrazo,
  esquinas,
  factorEscala,
  horaCorta,
  moverTrazo,
  recolorear,
  paraLosAlumnos,
  simplificar,
  tocaLinea,
  trazoEnPunto,
  type Caja01,
  type DocPizarra,
  type Esquina,
  type EstiloTexto,
  type Herramienta,
  type PaginaPizarra,
  type Trazo,
  type TrazoLinea,
  type TrazoTexto,
} from '@/lib/nawar/pizarra'
import { bajarFuente, getPizarra, guardarNotas, listaDe, PIZARRA_EN_BLANCO, ponerEnPizarra, publicarPizarra, quitarPublicada, urlPdfConNotas, type ListaPresentaciones as Lista, type Pizarra } from '@services/pizarra/pizarra'
import { subirArchivoProfe } from '@services/tareas/tareas'
import { VisorPresentacionClase } from '@components/Pages/Clases/pasosSemana'
import ListaPresentaciones from '@components/Pages/Presentaciones/ListaPresentaciones'
import { cajaDeTexto, letrasDeLaEscuela, pintarEnBlanco, pintarTrazos, type Letras } from './dibujo'

/**
 * La pizarra de clase (10/11/2026): el profe abre aquí la presentación de la
 * semana mientras comparte pantalla, escribe encima (lápiz, rotulador, texto
 * con la letra de la escuela, páginas en blanco) y con «Guardar para los
 * alumnos» esa es la presentación de después de clase. La explicación entera,
 * en apps/api/src/services/tareas/pizarra.py.
 *
 * Ocupa toda la ventana (sin la barra de la escuela): es lo que se comparte.
 *
 * Cada presentación de la clase guarda SUS notas (22/11/2026): arriba, el
 * botón con el nombre abre la lista (`ListaPresentaciones`); abrir otra NO
 * pisa nada (se guarda lo último, se abre la otra con lo suyo y pasa a ser la
 * de la pizarra). Lo que se guarda va siempre con la presentación a la que
 * pertenece (`docDe`), nunca con «la que esté elegida». Sin ningún PDF, la
 * pizarra abre en blanco. «Descargar con notas» baja el PDF sin publicarlo.
 * `/pizarra/<semana>?fuente=<id>` abre una concreta; con `&descargar=1`, la
 * baja con sus notas (también unas notas cuyo documento ya no está).
 */

type Tam = { w: number; h: number }
type Editando = { i: number | null; x: number; y: number; texto: string; estilo: EstiloTexto; tam: number; color: string }
type Guardado = 'guardado' | 'sin-guardar' | 'guardando' | 'error'

const BLANCO = '#FFFFFF'
const A4: Tam = { w: 595, h: 842 }

// El zoom (12/11/2026: "me falta un zoom aquí dentro"). 1 = la página entera
// cabe; hasta 5 veces. Los lienzos no pasan de MAX_PX de ancho (si no, en el
// iPad o con mucho zoom se queda sin memoria): por encima, el navegador estira.
const ZOOM_MAX = 5
// Lo que ocupa abajo la barra de herramientas flotante: la página queda encima.
const RESERVA_ABAJO = 76
// En pantallas estrechas, las páginas y el zoom suben arriba: la página, debajo.
const reservaArriba = (ancho: number) => (ancho < 560 ? 104 : ancho < 860 ? 56 : 0)
const MAX_PX = 4200

/**
 * La pizarra metida en la sala (12/11/2026: "con una pantalla no sirve"). La
 * sala le pasa esto y la pizarra va dentro de la página (sin cubrirlo todo),
 * con «Enseñar a la clase» la pizarra entra en la llamada como otro
 * participante y manda solo la página (el lienzo de `lienzo`). Ver
 * components/Pages/Sala/SalaPage.tsx.
 */
export interface EnSala {
  ensenando: boolean
  alternar: () => void
  cerrar: () => void
  /** Si la llamada aún no está lista, el botón espera. */
  puede: boolean
  /** El lienzo que la sala manda a la llamada (12/11/2026): mientras se
   * enseña, la pizarra copia en él, diez veces por segundo, lo que se ve de
   * la página (con el zoom y lo que se está escribiendo). Solo la página: ni
   * los botones ni la llamada. */
  lienzo?: (c: HTMLCanvasElement | null) => void
}

/** El trozo de la página que se ve en pantalla, en píxeles del lienzo de
 * la página, y el tamaño con el que se manda (cabe en 1920 × 1440, pares:
 * una página A4 en vertical sale a 1018 × 1440, que se lee bien). */
export function recorteEmision(
  hoja: { left: number; top: number; width: number; height: number },
  area: { left: number; top: number; right: number; bottom: number },
  anchoLienzo: number
) {
  const x0 = Math.max(hoja.left, area.left)
  const y0 = Math.max(hoja.top, area.top)
  const x1 = Math.min(hoja.left + hoja.width, area.right)
  const y1 = Math.min(hoja.top + hoja.height, area.bottom)
  if (x1 - x0 < 4 || y1 - y0 < 4 || !hoja.width) return null
  const k = anchoLienzo / hoja.width
  const asp = (x1 - x0) / (y1 - y0)
  let W = Math.min(1920, 1440 * asp)
  let H = W / asp
  W = Math.max(2, Math.round(W / 2) * 2)
  H = Math.max(2, Math.round(H / 2) * 2)
  return { sx: (x0 - hoja.left) * k, sy: (y0 - hoja.top) * k, sw: (x1 - x0) * k, sh: (y1 - y0) * k, W, H }
}

export default function PizarraClase({ semanaId, enSala }: { semanaId: string; enSala?: EnSala }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const id = Number(semanaId)

  const [info, setInfo] = useState<Pizarra | null>(null)
  const [fallo, setFallo] = useState('')
  const [fuente, setFuente] = useState('')
  // Para volver a abrir la MISMA presentación (se cambió su archivo o sus notas desde la lista).
  const [recarga, setRecarga] = useState(0)
  const [panel, setPanel] = useState(false)
  const [bajando, setBajando] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  // De qué presentación es lo que hay en `docRef`: lo que se guarda va con ella.
  const docDe = useRef('')
  const ultimaGuardada = useRef(0)
  const escribibleRef = useRef<boolean | null>(null)
  // Lo pedido en la dirección: /pizarra/<semana>?fuente=<id>&descargar=1 (fuera de la sala).
  const pedido = useRef<{ fuente: string; descargar: boolean } | null>(null)
  if (pedido.current === null) {
    const q = typeof window !== 'undefined' && !enSala ? new URLSearchParams(window.location.search) : null
    pedido.current = { fuente: q?.get('fuente') || '', descargar: q?.get('descargar') === '1' }
  }
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
  const [zoom, setZoom] = useState(1)
  const [viendoPublicada, setViendoPublicada] = useState(false)
  // El panel de las páginas se puede esconder (y se recuerda en este navegador).
  const [verMiniaturas, setVerMiniaturas] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem('nawar.pizarra.paginas') === 'no') setVerMiniaturas(false)
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  const cambiarMiniaturas = (v: boolean) => {
    setVerMiniaturas(v)
    try {
      localStorage.setItem('nawar.pizarra.paginas', v ? 'si' : 'no')
    } catch {
      /* sin almacenamiento */
    }
  }
  const zoomRef = useRef(1)
  zoomRef.current = zoom

  const pdfRef = useRef<any>(null)
  const docRef = useRef(doc)
  docRef.current = doc
  const idxRef = useRef(idx)
  idxRef.current = idx
  const editRef = useRef(editando)
  editRef.current = editando
  const areaRef = useRef<HTMLDivElement>(null)
  const hojaRef = useRef<HTMLDivElement>(null)
  // Dónde dejar el scroll después de cambiar el zoom (el punto que no se mueve).
  const anclaZoom = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null)
  const manoRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const fondoRef = useRef<HTMLCanvasElement>(null)
  const notasRef = useRef<HTMLCanvasElement>(null)
  const letrasRef = useRef<Letras | null>(null)
  const vivoRef = useRef<TrazoLinea | null>(null)
  // Mover (16/11/2026): `orig` es el trazo como estaba al bajar el dedo y
  // (x0, y0) dónde se bajó; se mueve siempre desde ahí (sin ir acumulando
  // errores). `pendiente`: con la herramienta Texto, hasta que el ratón se
  // mueve un poco no es un arrastre (un clic abre el texto para cambiarlo).
  const gestoRef = useRef<{
    tipo: 'borrar' | 'mover' | 'escalar'
    i?: number
    /** Al estirar una esquina: el punto que no se mueve y dónde estaba la esquina. */
    fija?: { x: number; y: number }
    esquina?: { x: number; y: number }
    x0?: number
    y0?: number
    orig?: Trazo
    pendiente?: boolean
    apuntado?: boolean
  } | null>(null)
  // Lo que hay debajo del ratón o se está moviendo: para el cursor y el recuadro.
  const [sobre, setSobre] = useState(-1)
  // Lo elegido (18/11/2026, como en Canva): un clic en un texto o un dibujo lo
  // elige, salen las esquinas para agrandarlo o achicarlo y una barra con su
  // color, su tamaño, duplicar y borrar. -1 = nada.
  const [sel, setSel] = useState(-1)
  const selRef = useRef(-1)
  selRef.current = sel
  // Lo que estaba elegido al bajar el dedo: un segundo clic sobre el mismo texto lo abre para escribir.
  const elegidoAlBajar = useRef(-1)
  // Al cerrar un texto con Esc, queda elegido (para estirarlo o cambiarle el color).
  const elegirAlCerrar = useRef(false)
  const arrastradoAt = useRef(0)
  useEffect(() => setSobre(-1), [idx, herramienta])
  useEffect(() => setSel(-1), [idx])
  useEffect(() => {
    if (herramienta !== 'mover' && herramienta !== 'texto') setSel(-1)
  }, [herramienta])
  const atras = useRef<{ idx: number; trazos: Trazo[] }[]>([])
  const adelante = useRef<{ idx: number; trazos: Trazo[] }[]>([])
  const sucio = useRef(0)
  const reintentos = useRef(0)
  const guardandoRef = useRef(false)
  const cerradoAt = useRef(0)
  const cuadro = useRef(0)

  escribibleRef.current = info ? info.escribible !== false : null
  // La lista de la clase, para el panel: solo cambia cuando cambia lo suyo.
  const listaInfo = useMemo(
    () => (info ? listaDe(info) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info?.presentaciones, info?.sueltas, info?.en_pizarra, info?.publicada]
  )
  const letras = () => (letrasRef.current ||= letrasDeLaEscuela())
  const tamDe = useCallback((pg?: PaginaPizarra | null): Tam => (pg?.origen ? tams[pg.origen - 1] : tams[0]) || A4, [tams])

  // ── Cargar la semana ────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!token || !id) return
    try {
      const pide = pedido.current
      const datos = await getPizarra(id, token, pide?.fuente || undefined)
      setInfo(datos)
      setFuente((f) => f || datos.fuente)
      setGuardadaAt(datos.guardada_at)
      // Abrir una concreta desde la ficha es ponerla en la pizarra (si solo
      // se viene a descargarla, no).
      if (pide?.fuente && !pide.descargar && datos.fuente === pide.fuente && datos.escribible && datos.en_pizarra !== datos.fuente) {
        ponerEnPizarra(id, datos.fuente, token)
          .then((l) => setInfo((i) => (i ? { ...i, presentaciones: l.presentaciones, sueltas: l.sueltas, en_pizarra: l.fuente } : i)))
          .catch(() => undefined)
      }
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
        // Lo guardado vale para la presentación con la que se escribió.
        const guardado = info.fuente === fuente ? info.anotaciones : null
        const conPdf = info.fuentes.some((f) => f.id === fuente)
        if (!conPdf) {
          // La pizarra en blanco, o unas notas cuyo documento ya no está: no
          // hay PDF que abrir. Las páginas que tenían algo escrito salen como
          // páginas en blanco con sus trazos (`ajustarAlPdf` con 0 páginas).
          let inicial = ajustarAlPdf(guardado, 0)
          if (!inicial.paginas.length) inicial = { v: 1, paginas: [{ origen: null, trazos: [] }] }
          if (!vivo) return
          pdfRef.current = null
          setTams([])
          docRef.current = inicial
          docDe.current = fuente
          setDoc(inicial)
          setIdx((i) => Math.min(i, Math.max(0, inicial.paginas.length - 1)))
          atras.current = []
          adelante.current = []
          setHistoria({ atras: 0, adelante: 0 })
          setPdfListo((n) => n + 1)
          return
        }
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
        const inicial = ajustarAlPdf(guardado, pdf.numPages)
        docRef.current = inicial
        docDe.current = fuente
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
    // `info` solo importa al abrir (lo guardado); recargarla no reabre el PDF.
    // `recarga` vuelve a abrir la misma (cambió su archivo o sus notas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, token, id, !!info, recarga])

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
  // La página entera, sin zoom (lo que cabe en la pantalla).
  const encaje = useMemo<Tam>(() => {
    const t = tamDe(pagina)
    if (!area.w || !area.h) return { w: 0, h: 0 }
    const w = Math.max(120, Math.min(area.w - 32, ((area.h - 32 - RESERVA_ABAJO - reservaArriba(area.w)) * t.w) / t.h))
    return { w: Math.floor(w), h: Math.floor((w * t.h) / t.w) }
  }, [area, pagina, tamDe])
  const escena = useMemo<Tam>(
    () => ({ w: Math.floor(encaje.w * zoom), h: Math.floor(encaje.h * zoom) }),
    [encaje, zoom]
  )
  const pantallaDensidad = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  // Con mucho zoom, menos detalle por píxel: si no, el lienzo no cabe en memoria.
  // En la sala, la página se pinta como mínimo al doble (aunque la pantalla
  // del profe sea de las normales): de ese lienzo sale lo que ven los alumnos.
  const densidadBase = enSala ? Math.max(pantallaDensidad, 2) : pantallaDensidad
  const densidad = escena.w ? Math.min(densidadBase, MAX_PX / escena.w) : densidadBase
  // Lo mismo que «Ajustar al ancho»: la página a lo ancho de la pantalla.
  const zoomAncho = encaje.w ? Math.max(1, Math.min(ZOOM_MAX, (area.w - 24) / encaje.w)) : 1

  /** Cambia el zoom dejando quieto el punto (fx, fy) de la pantalla (0-1 del área). */
  const ponerZoom = useCallback(
    (z: number, fx = 0.5, fy = 0.5) => {
      const nuevo = Math.max(1, Math.min(ZOOM_MAX, Math.round(z * 100) / 100))
      const el = areaRef.current
      const hoja = hojaRef.current
      if (el && hoja) {
        const r = el.getBoundingClientRect()
        const h = hoja.getBoundingClientRect()
        const px = r.left + fx * r.width
        const py = r.top + fy * r.height
        // Qué punto de la página está debajo (0-1 de la página).
        anclaZoom.current = {
          fx: h.width ? (px - h.left) / h.width : 0.5,
          fy: h.height ? (py - h.top) / h.height : 0.5,
          px: fx * r.width,
          py: fy * r.height,
        }
      }
      setZoom(nuevo)
    },
    []
  )

  // Después de cambiar el zoom: el mismo punto de la página, en el mismo sitio.
  React.useLayoutEffect(() => {
    const a = anclaZoom.current
    const el = areaRef.current
    const hoja = hojaRef.current
    if (!a || !el || !hoja) return
    anclaZoom.current = null
    const x = hoja.offsetLeft + a.fx * hoja.offsetWidth - a.px
    const y = hoja.offsetTop + a.fy * hoja.offsetHeight - a.py
    el.scrollLeft = Math.max(0, x)
    el.scrollTop = Math.max(0, y)
  }, [escena.w, escena.h])

  // Al cambiar de página, arriba del todo (el zoom se queda).
  useEffect(() => {
    const el = areaRef.current
    if (el) {
      el.scrollTop = 0
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    }
  }, [idx])

  // Ctrl + rueda o el pellizco del trackpad: zoom donde está el ratón.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const rueda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.01)
      setZoom((z) => {
        const nuevo = Math.max(1, Math.min(ZOOM_MAX, z * factor))
        const hoja = hojaRef.current
        if (hoja) {
          const h = hoja.getBoundingClientRect()
          anclaZoom.current = {
            fx: h.width ? (e.clientX - h.left) / h.width : 0.5,
            fy: h.height ? (e.clientY - h.top) / h.height : 0.5,
            px: e.clientX - r.left,
            py: e.clientY - r.top,
          }
        }
        return nuevo
      })
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => el.removeEventListener('wheel', rueda)
  }, [!!info, pdfListo])

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

  // ── Lo que ven los alumnos (en la sala, 12/11/2026) ───────────────────
  // Un lienzo aparte que la sala manda a la llamada. Mientras se enseña, se
  // copia en él lo que se ve de la página: el fondo, lo escrito, el trazo a
  // medio hacer y el texto que se está escribiendo.
  const salidaRef = useRef<HTMLCanvasElement | null>(null)
  const avisarLienzo = enSala?.lienzo
  useEffect(() => {
    if (!avisarLienzo) return
    const c = document.createElement('canvas')
    c.width = 1280
    c.height = 720
    const ctx = c.getContext('2d')!
    ctx.fillStyle = BLANCO
    ctx.fillRect(0, 0, c.width, c.height)
    salidaRef.current = c
    avisarLienzo(c)
    // Para las pruebas en local (no en producción).
    if (process.env.NODE_ENV !== 'production') (window as any).__lienzoPizarra = c
    return () => {
      avisarLienzo(null)
      salidaRef.current = null
    }
  }, [avisarLienzo])

  const emitiendo = !!enSala?.ensenando
  useEffect(() => {
    if (!emitiendo) return
    const pintar = () => {
      const out = salidaRef.current
      const f = fondoRef.current
      const n = notasRef.current
      const hoja = hojaRef.current
      const area = areaRef.current
      if (!out || !f || !n || !hoja || !area || !f.width || !n.width) return
      const rh = hoja.getBoundingClientRect()
      const ra = area.getBoundingClientRect()
      const r = recorteEmision(rh, ra, f.width)
      if (!r) return
      if (Math.abs(out.width - r.W) > 4 || Math.abs(out.height - r.H) > 4) {
        out.width = r.W
        out.height = r.H
      }
      const ctx = out.getContext('2d')!
      ctx.fillStyle = BLANCO
      ctx.fillRect(0, 0, out.width, out.height)
      const pg = docRef.current.paginas[idxRef.current]
      if (pg?.oculta) {
        ctx.fillStyle = '#5B6B8C'
        ctx.font = `600 ${Math.round(out.height / 22)}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('Un momento…', out.width / 2, out.height / 2)
        return
      }
      ctx.drawImage(f, r.sx, r.sy, r.sw, r.sh, 0, 0, out.width, out.height)
      const kn = n.width / f.width
      ctx.drawImage(n, r.sx * kn, r.sy * kn, r.sw * kn, r.sh * kn, 0, 0, out.width, out.height)
      // El texto que se está escribiendo (aún no está en el lienzo de las notas).
      const e = editRef.current
      if (e && e.texto.trim()) {
        const ex = out.width / r.sw
        const ey = out.height / r.sh
        ctx.save()
        ctx.translate(-r.sx * ex, -r.sy * ey)
        try {
          pintarTrazos(ctx, [{ t: 'texto', x: e.x, y: e.y, texto: e.texto, color: e.color, tam: e.tam, estilo: e.estilo } as Trazo], f.width * ex, f.height * ey, letras())
        } catch {
          /* sin el texto a medias */
        }
        ctx.restore()
      }
    }
    pintar()
    const t = window.setInterval(pintar, 100)
    return () => window.clearInterval(t)
  }, [emitiendo])

  // La letra de la escuela puede llegar después del primer pintado.
  useEffect(() => {
    ;(document as any).fonts?.ready?.then(() => {
      letrasRef.current = null
      repintar()
    })
  }, [repintar])

  // ── Guardar solo ────────────────────────────────────────────────────────
  const guardar = useCallback(async (): Promise<boolean> => {
    // Lo escrito se guarda SIEMPRE con la presentación a la que pertenece
    // (`docDe`), no con la que esté elegida en ese instante: al cambiar de
    // una a otra, lo de la primera no puede acabar en la segunda.
    const de = docDe.current
    if (!token || !de) return false
    // Unas notas cuyo documento ya no está solo se miran y se descargan.
    if (escribibleRef.current === false) return false
    if (guardandoRef.current) return false
    guardandoRef.current = true
    const marca = sucio.current
    setGuardado('guardando')
    try {
      const r = await guardarNotas(id, de, docRef.current, token)
      ultimaGuardada.current = marca
      setGuardadaAt(r.guardada_at)
      setGuardado(sucio.current === marca ? 'guardado' : 'sin-guardar')
      reintentos.current = 0
      return true
    } catch (e: any) {
      setGuardado('error')
      // Solo el primer fallo avisa: los reintentos van solos (16/11/2026).
      if (reintentos.current === 0) toast.error(e?.message || 'No se pudo guardar lo escrito. Lo seguimos intentando.')
      reintentos.current += 1
      return false
    } finally {
      guardandoRef.current = false
    }
  }, [id, token])

  const ensuciar = useCallback(() => {
    // Unas notas cuyo documento ya no está no se guardan: nada que avisar.
    if (escribibleRef.current === false) return
    sucio.current += 1
    setGuardado('sin-guardar')
  }, [])

  useEffect(() => {
    if (guardado !== 'sin-guardar') return
    const t = setTimeout(() => guardar(), 1500)
    return () => clearTimeout(t)
  }, [guardado, doc, guardar])

  // Tras un fallo (un corte de red), se vuelve a intentar solo, cada vez con
  // más espera (3 s, 6 s, 12 s… hasta 1 min). Antes se quedaba sin guardar
  // hasta que el profe escribía algo más (16/11/2026).
  useEffect(() => {
    if (guardado !== 'error') return
    const espera = Math.min(60_000, 3000 * 2 ** Math.max(0, reintentos.current - 1))
    const t = setTimeout(() => guardar(), espera)
    return () => clearTimeout(t)
  }, [guardado, guardar])

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (guardado === 'sin-guardar' || guardado === 'guardando' || guardado === 'error') {
        e.preventDefault()
        e.returnValue = ''
      }
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
  const deshacer = useCallback(() => {
    setSel(-1)
    volver(atras, adelante)
  }, [volver])
  const rehacer = useCallback(() => {
    setSel(-1)
    volver(adelante, atras)
  }, [volver])

  // ── El texto ────────────────────────────────────────────────────────────
  const cerrarTexto = useCallback(() => {
    const e = editRef.current
    if (!e) return
    cerradoAt.current = Date.now()
    setEditando(null)
    editRef.current = null
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    const texto = e.texto.replace(/\s+$/g, '')
    const elegir = elegirAlCerrar.current
    elegirAlCerrar.current = false
    if (e.i == null) {
      if (texto.trim()) {
        poner([...trazos, { t: 'texto', x: e.x, y: e.y, texto, color: e.color, tam: e.tam, estilo: e.estilo }])
        setSel(elegir ? trazos.length : -1)
      }
      return
    }
    const viejo = trazos[e.i] as TrazoTexto | undefined
    if (!viejo) return
    // Lo cambiado mientras se escribía (color, tamaño, estilo) también cuenta.
    const nuevo: TrazoTexto = { ...viejo, texto, color: e.color, tam: e.tam, estilo: e.estilo }
    const igual = nuevo.texto === viejo.texto && nuevo.color === viejo.color && nuevo.tam === viejo.tam && nuevo.estilo === viejo.estilo
    if (!texto.trim()) {
      poner(trazos.filter((_, k) => k !== e.i))
      setSel(-1)
      return
    }
    if (!igual) poner(trazos.map((t, k) => (k === e.i ? nuevo : t)))
    else repintar()
    setSel(elegir ? e.i : -1)
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

  // Qué trazo hay en (x, y) para moverlo: textos por su caja medida con la
  // letra de verdad, líneas por su trazo (16/11/2026).
  const trazoEn = useCallback(
    (x: number, y: number, soloTextos = false): number => {
      const c = notasRef.current
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      if (!c || !c.width) return -1
      const ctx = c.getContext('2d')!
      const caja = (t: TrazoTexto) => {
        const k = cajaDeTexto(ctx, t, c.width, c.height, letras())
        return { x: k.x / c.width, y: k.y / c.height, w: k.w / c.width, h: k.h / c.height }
      }
      return trazoEnPunto(trazos, x, y, c.height / c.width, caja, { soloTextos, margen: (6 * densidad) / c.width })
    },
    [densidad]
  )

  const abrirTexto = useCallback(
    (x: number, y: number) => {
      const i = textoEn(x, y)
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      if (i >= 0) {
        const t = trazos[i] as TrazoTexto
        setSel(i)
        setEditando({ i, x: t.x, y: t.y, texto: t.texto, estilo: t.estilo, tam: t.tam, color: t.color })
      } else {
        setSel(-1)
        // Antes, una Nota salía siempre azul aunque se eligiera otro color (18/11/2026).
        const sobreBlanco = color === BLANCO && estilo !== 'titulo' ? COLORES[1] : color
        setEditando({ i: null, x, y, texto: '', estilo, tam: TAMANOS[tamTexto], color: sobreBlanco })
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
    elegidoAlBajar.current = selRef.current
    if (editRef.current || !pagina) return
    if (herramienta === 'mano') {
      const el = areaRef.current
      if (!el) return
      e.currentTarget.setPointerCapture(e.pointerId)
      manoRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
      return
    }
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
    } else if (herramienta === 'mover' || (herramienta === 'texto' && e.pointerType !== 'touch')) {
      // Elegir y mover un texto o un dibujo arrastrándolo (16/11/2026; elegir,
      // 18/11/2026). Con la herramienta Texto, solo los textos. Hasta que el
      // dedo se mueve un poco no es un arrastre: un clic solo lo elige.
      const i = trazoEn(x, y, herramienta === 'texto')
      if (i < 0) {
        if (herramienta === 'mover') setSel(-1)
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      gestoRef.current = { tipo: 'mover', i, x0: x, y0: y, orig: docRef.current.paginas[idx].trazos[i], pendiente: true }
      setSel(i)
      setSobre(i)
    }
  }

  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = manoRef.current
    if (m) {
      const el = areaRef.current
      if (el) {
        el.scrollLeft = m.sl - (e.clientX - m.x)
        el.scrollTop = m.st - (e.clientY - m.y)
      }
      return
    }
    const [x, y] = donde(e)
    const v = vivoRef.current
    if (v) {
      v.p.push(x, y)
      cancelAnimationFrame(cuadro.current)
      cuadro.current = requestAnimationFrame(repintar)
      return
    }
    const g = gestoRef.current
    if (!g) {
      // Sin nada en marcha: ¿hay algo que mover debajo del ratón? (el cursor y el recuadro)
      if (e.pointerType !== 'touch' && (herramienta === 'mover' || herramienta === 'texto') && !editRef.current) {
        const i = trazoEn(x, y, herramienta === 'texto')
        if (i !== sobre) setSobre(i)
      }
      return
    }
    if (g.tipo === 'borrar') borrarEn(x, y)
    else if (g.tipo === 'escalar') escalarA(x, y)
    else if (g.tipo === 'mover' && g.i != null && g.orig) {
      const dx = x - (g.x0 ?? x)
      const dy = y - (g.y0 ?? y)
      if (g.pendiente) {
        if (Math.hypot(dx, dy) < 0.006) return
        g.pendiente = false
      }
      const trazos = docRef.current.paginas[idxRef.current].trazos
      if (!trazos[g.i]) return
      const nuevo = moverTrazo(g.orig, dx, dy)
      // Deshacer: el primer paso guarda cómo estaba; los demás no (un solo «Deshacer» lo devuelve).
      poner(
        trazos.map((o, k) => (k === g.i ? nuevo : o)),
        !g.apuntado
      )
      g.apuntado = true
    }
  }

  const alSoltar = () => {
    manoRef.current = null
    const v = vivoRef.current
    if (v) {
      vivoRef.current = null
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      poner([...trazos, { ...v, p: simplificar(v.p) }])
    }
    const g = gestoRef.current
    // Tras arrastrar un texto con la herramienta Texto, el clic de soltar no lo abre.
    if (g?.tipo === 'mover' && g.apuntado) arrastradoAt.current = Date.now()
    if (g?.tipo === 'mover' && herramienta !== 'mover') setSobre(-1)
    gestoRef.current = null
  }

  const alPulsar = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (herramienta !== 'texto' || editRef.current) return
    // El clic que cierra un texto no abre otro.
    if (Date.now() - cerradoAt.current < 350) return
    if (Date.now() - arrastradoAt.current < 350) return
    const [x, y] = donde(e)
    const i = textoEn(x, y)
    if (i >= 0) {
      // Primer clic: lo elige (esquinas para estirarlo, su barra). Segundo: a escribir.
      if (elegidoAlBajar.current === i) abrirTexto(x, y)
      else setSel(i)
      return
    }
    // Con algo elegido, un clic fuera solo lo suelta (como en Canva).
    if (elegidoAlBajar.current >= 0) {
      setSel(-1)
      return
    }
    abrirTexto(x, y)
  }

  const alDobleClic = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (herramienta !== 'mover' && herramienta !== 'texto') return
    const [x, y] = donde(e)
    if (textoEn(x, y) >= 0) abrirTexto(x, y)
  }

  // ── Lo elegido: estirar por una esquina, color, tamaño, duplicar, borrar ──
  /** La caja de un trazo en 0-1 de la página (los textos, con la letra de verdad). */
  const cajaDe = useCallback((t?: Trazo): Caja01 | null => {
    const c = notasRef.current
    if (!t || !c || !c.width) return null
    if (t.t === 'texto') {
      const k = cajaDeTexto(c.getContext('2d')!, t, c.width, c.height, letras())
      return { x: k.x / c.width, y: k.y / c.height, w: k.w / c.width, h: k.h / c.height }
    }
    return cajaDeLinea(t, c.height / c.width)
  }, [])

  const empezarEscalar = (e: React.PointerEvent<HTMLElement>, cual: Esquina) => {
    e.preventDefault()
    e.stopPropagation()
    const i = selRef.current
    const t = docRef.current.paginas[idxRef.current]?.trazos[i]
    const caja = cajaDe(t)
    if (!t || !caja) return
    const q = esquinas(caja)[cual]
    e.currentTarget.setPointerCapture(e.pointerId)
    gestoRef.current = { tipo: 'escalar', i, orig: t, fija: q.fija, esquina: { x: q.x, y: q.y } }
  }

  const escalarA = (x: number, y: number) => {
    const g = gestoRef.current
    const c = notasRef.current
    if (!g || g.tipo !== 'escalar' || g.i == null || !g.orig || !g.fija || !g.esquina || !c) return
    const trazos = docRef.current.paginas[idxRef.current]?.trazos
    if (!trazos?.[g.i]) return
    const f = factorEscala(g.fija.x, g.fija.y, g.esquina.x, g.esquina.y, x, y, c.height / c.width)
    const nuevo = escalarTrazo(g.orig, f, g.fija.x, g.fija.y)
    poner(
      trazos.map((o, k) => (k === g.i ? nuevo : o)),
      !g.apuntado
    )
    g.apuntado = true
  }

  const moverEsquina = (e: React.PointerEvent<HTMLElement>) => {
    if (gestoRef.current?.tipo !== 'escalar') return
    const [x, y] = donde(e)
    escalarA(x, y)
  }

  const soltarEsquina = () => {
    if (gestoRef.current?.tipo === 'escalar') gestoRef.current = null
  }

  /** Cambia lo elegido (o el texto que se está escribiendo) con `fn`. */
  const cambiarElegido = useCallback(
    (fn: (t: Trazo) => Trazo) => {
      const ed = editRef.current
      if (ed) {
        const t = fn({ t: 'texto', x: ed.x, y: ed.y, texto: ed.texto, color: ed.color, tam: ed.tam, estilo: ed.estilo })
        if (t.t === 'texto') setEditando({ ...ed, x: t.x, y: t.y, color: t.color, tam: t.tam, estilo: t.estilo })
        return
      }
      const i = selRef.current
      const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
      if (!trazos[i]) return
      poner(trazos.map((o, k) => (k === i ? fn(o) : o)))
    },
    [poner]
  )

  /** El tipo de lo elegido (o del texto que se escribe): decide qué colores tiene. */
  const elegido: Trazo | null = editando
    ? { t: 'texto', x: editando.x, y: editando.y, texto: editando.texto, color: editando.color, tam: editando.tam, estilo: editando.estilo }
    : (pagina?.trazos[sel] ?? null)

  /** Un color: para lo que se escribe a partir de ahora y, si hay algo elegido, también para eso. */
  const elegirColor = (c: string) => {
    const tipo = elegido?.t ?? (herramienta === 'rotulador' ? 'rotulador' : 'lapiz')
    if (tipo === 'rotulador') setColorRot(c)
    else setColor(c)
    if (elegido && (elegido.t === 'rotulador') === COLORES_ROTULADOR.includes(c as any)) cambiarElegido((t) => recolorear(t, c))
  }

  const elegirEstilo = (es: EstiloTexto) => {
    setEstilo(es)
    if (elegido?.t === 'texto') cambiarElegido((t) => (t.t === 'texto' ? { ...t, estilo: es } : t))
  }

  const elegirTamTexto = (k: keyof typeof TAMANOS) => {
    setTamTexto(k)
    if (elegido?.t === 'texto') cambiarElegido((t) => (t.t === 'texto' ? { ...t, tam: TAMANOS[k] } : t))
  }

  const elegirGrosor = (g: keyof typeof GROSORES) => {
    setGrosor(g)
    if (elegido?.t === 'lapiz') cambiarElegido((t) => (t.t === 'lapiz' ? { ...t, grosor: GROSORES[g] } : t))
  }

  const duplicarElegido = () => {
    const i = selRef.current
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    if (!trazos[i] || editRef.current) return
    poner([...trazos, duplicarTrazo(trazos[i])])
    setSel(trazos.length)
  }

  const borrarElegido = () => {
    const i = selRef.current
    const trazos = docRef.current.paginas[idxRef.current]?.trazos || []
    if (!trazos[i] || editRef.current) return
    poner(trazos.filter((_, k) => k !== i))
    setSel(-1)
  }

  const editarElegido = () => {
    const t = docRef.current.paginas[idxRef.current]?.trazos[selRef.current]
    if (t?.t !== 'texto') return
    setEditando({ i: selRef.current, x: t.x, y: t.y, texto: t.texto, estilo: t.estilo, tam: t.tam, color: t.color })
  }

  const elegirHerramienta = (h: Herramienta) => {
    if (editRef.current) cerrarTexto()
    setHerramienta(h)
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
  const accionesRef = useRef({ borrar: borrarElegido, duplicar: duplicarElegido, editar: editarElegido, herramienta: elegirHerramienta })
  accionesRef.current = { borrar: borrarElegido, duplicar: duplicarElegido, editar: editarElegido, herramienta: elegirHerramienta }
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selRef.current >= 0) {
        e.preventDefault()
        accionesRef.current.duplicar()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current >= 0) {
        e.preventDefault()
        accionesRef.current.borrar()
        return
      }
      if (e.key === 'Escape' && selRef.current >= 0) {
        setSel(-1)
        return
      }
      if (e.key === 'Enter' && selRef.current >= 0) {
        e.preventDefault()
        accionesRef.current.editar()
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        ir(idxRef.current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        ir(idxRef.current - 1)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        ponerZoom(zoomRef.current * 1.25)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        ponerZoom(zoomRef.current / 1.25)
      } else if (e.key === '0') {
        ponerZoom(1)
      } else {
        const atajo: Record<string, Herramienta> = { v: 'mover', l: 'lapiz', r: 'rotulador', t: 'texto', b: 'borrador', h: 'mano' }
        const h = atajo[e.key.toLowerCase()]
        if (h) accionesRef.current.herramienta(h)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [deshacer, rehacer, ir, ponerZoom])

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

  // ── Las presentaciones de la clase (22/11/2026) ─────────────────────────
  /** Vuelve a leer la lista (qué tiene notas, cuál es la de la pizarra) sin reabrir el PDF. */
  const releer = useCallback(async () => {
    try {
      const l = listaDe(await getPizarra(id, token, docDe.current || undefined))
      setInfo((i) => (i ? { ...i, presentaciones: l.presentaciones, sueltas: l.sueltas, en_pizarra: l.fuente, publicada: l.publicada } : i))
    } catch {
      /* la lista se queda como estaba */
    }
  }, [id, token])

  /** Guarda lo que quede por guardar (también el texto a medio escribir). Si
   * no se puede, lanza: no se cambia de presentación con algo sin guardar. */
  const guardarTodo = useCallback(async () => {
    cerrarTexto()
    for (let k = 0; k < 120 && guardandoRef.current; k++) await new Promise((r) => setTimeout(r, 50))
    if (sucio.current !== ultimaGuardada.current && escribibleRef.current !== false) {
      const ok = await guardar()
      if (!ok) throw new Error('No se ha podido guardar lo último que escribiste. Comprueba la conexión y vuelve a intentarlo.')
    }
  }, [cerrarTexto, guardar])

  /** Abre otra presentación (o vuelve a abrir la misma) con SUS notas. Lo de
   * la que estaba abierta se guarda antes: no se pierde ni se mezcla. */
  const abrir = useCallback(
    async (nueva: string, ponerla = true) => {
      // Mientras se abre no se puede escribir: lo escrito en ese instante se perdería.
      setAbriendo(true)
      try {
        await guardarTodo()
        const datos = await getPizarra(id, token, nueva)
        const cambia = datos.fuente !== docDe.current
        setInfo(datos)
        setGuardadaAt(datos.guardada_at)
        setGuardado('guardado')
        ultimaGuardada.current = sucio.current
        setSel(-1)
        if (cambia) setIdx(0)
        setFuente(datos.fuente)
        setRecarga((n) => n + 1)
        if (ponerla && datos.escribible && datos.en_pizarra !== datos.fuente) {
          const l = await ponerEnPizarra(id, datos.fuente, token)
          setInfo((i) => (i ? { ...i, presentaciones: l.presentaciones, sueltas: l.sueltas, en_pizarra: l.fuente } : i))
          const nombre = l.presentaciones.find((x) => x.id === datos.fuente)?.nombre
          if (nombre) toast.success(`La pizarra de esta clase abre ahora «${nombre}»`)
        }
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo abrir esa presentación')
      } finally {
        setAbriendo(false)
      }
    },
    [guardarTodo, id, token]
  )

  /** Algo cambió desde la lista (se pasaron notas, se cambió un archivo, se
   * quitó una): se vuelve a abrir la de ahora o, si ya no está, la de la pizarra. */
  const trasCambioEnLaLista = useCallback(
    (l: Lista) => {
      const sigue = docDe.current === PIZARRA_EN_BLANCO || l.presentaciones.some((x) => x.id === docDe.current)
      return abrir(sigue ? docDe.current : l.fuente || PIZARRA_EN_BLANCO, false)
    },
    [abrir]
  )

  /** El PDF con lo escrito encima: lo usan «Guardar para los alumnos» y «Descargar con notas». */
  const montarPdf = async (paginas: PaginaPizarra[], progreso: (n: number) => void): Promise<Blob> => {
    const { jsPDF } = await import('jspdf')
    await (document as any).fonts?.ready
    letrasRef.current = null
    let pdf: any = null
    for (let n = 0; n < paginas.length; n++) {
      progreso(n + 1)
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
    return pdf.output('blob')
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
    const grupo = info.semana.curso || 'esta clase'
    const ok = await confirmar(
      ya
        ? `Los alumnos de ${grupo} ya tienen una versión de esta presentación. ¿Cambiarla por la de ahora, con lo que has escrito?`
        : `¿Guardar esta presentación, con lo que has escrito, para los alumnos de ${grupo}?\n\nDesde el día de la clase la verán en su semana EN LUGAR de la presentación de antes. Los del otro grupo siguen con la suya hasta que su profe guarde la de su clase.`,
      { boton: 'Guardar para los alumnos', peligro: false }
    )
    if (!ok) return
    try {
      setPublicando('Guardando lo escrito…')
      await guardar()
      const pdf = await montarPdf(paginas, (n) => setPublicando(`Preparando la página ${n} de ${paginas.length}…`))
      setPublicando('Subiendo a la escuela…')
      const pub = await publicarPizarra(id, pdf, paginas.length, token, docDe.current)
      setInfo((i) => (i ? { ...i, publicada: pub } : i))
      releer()
      toast.success(`Guardada: los alumnos de ${grupo} ya ven esta versión`)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar para los alumnos')
    } finally {
      setPublicando('')
    }
  }

  /** «Descargar con notas»: el mismo PDF, pero se baja y NO se publica. Lleva
   * todas las páginas, también las escondidas: es la copia del equipo. */
  const descargarConNotas = async () => {
    if (bajando || publicando || !info) return
    cerrarTexto()
    const paginas = docRef.current.paginas
    if (!paginas.length) return
    try {
      setBajando('Preparando el PDF…')
      const pdf = await montarPdf(paginas, (n) => setBajando(`Preparando la página ${n} de ${paginas.length}…`))
      const de = info.presentaciones.find((x) => x.id === docDe.current)?.nombre || info.sueltas.find((x) => x.id === docDe.current)?.nombre || ''
      const sinExt = de.replace(/\.pdf$/i, '')
      const partes = [info.semana.tema, sinExt].filter(Boolean)
      // «Mijn huis - Mijn huis» no: si la presentación se llama como el tema, una vez.
      const base = partes.length === 2 && partes[0].trim().toLowerCase() === partes[1].trim().toLowerCase() ? partes[0] : partes.join(' - ')
      const nombre = `${base || 'Pizarra'} - con notas.pdf`
      const url = URL.createObjectURL(pdf)
      const a = document.createElement('a')
      a.href = url
      a.download = nombre.replace(/[\\/:*?"<>|]/g, ' ')
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success('PDF con las notas descargado')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo preparar el PDF')
    } finally {
      setBajando('')
    }
  }

  // /pizarra/<semana>?fuente=<id>&descargar=1: en cuanto se abre, se baja sola.
  const descargarRef = useRef(descargarConNotas)
  descargarRef.current = descargarConNotas
  const descargaHecha = useRef(false)
  useEffect(() => {
    if (!pdfListo || falloPdf || !pedido.current?.descargar || descargaHecha.current) return
    const t = setTimeout(() => {
      if (descargaHecha.current) return
      descargaHecha.current = true
      descargarRef.current()
    }, 500)
    return () => clearTimeout(t)
  }, [pdfListo, falloPdf])

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
      await guardarTodo()
      const m = await subirArchivoProfe(id, archivo, token)
      const nuevo = [...(m?.archivos || [])].reverse().find((a) => a.tipo === 'archivo' && /\.pdf$/i.test(a.nombre))
      // La recién subida se abre y pasa a ser la de la pizarra. Lo escrito
      // en la que estaba abierta se queda con ella.
      if (nuevo) await abrir(`profe:${nuevo.id}`)
      else await releer()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir')
    } finally {
      setSubiendo(false)
    }
  }

  // ── Pantalla ────────────────────────────────────────────────────────────
  if (fallo) {
    return (
      <Marco dentro={!!enSala}>
        <div className="m-auto max-w-md px-6 text-center">
          <p className="font-[family-name:var(--font-poppins)] text-[17px] font-semibold text-[#0B1033]">No se pudo abrir la pizarra</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#4A5272]">{fallo}</p>
          <Link href="/equipo" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white hover:bg-[#0a2690]">
            Volver a la sala de profesores
          </Link>
        </div>
      </Marco>
    )
  }
  if (!info) {
    return (
      <Marco dentro={!!enSala}>
        <Cargando texto="Abriendo la pizarra…" />
      </Marco>
    )
  }

  // Sin PDF que abrir (la pizarra en blanco, o unas notas sueltas): páginas en blanco.
  const sinPresentaciones = info.fuentes.length === 0
  const abiertaAhora = info.presentaciones.find((x) => x.id === fuente)
  const nombreAbierta = abiertaAhora?.nombre || info.sueltas.find((x) => x.id === fuente)?.nombre || (fuente === PIZARRA_EN_BLANCO ? 'Pizarra en blanco' : 'Presentación')
  const soloLectura = info.escribible === false
  // Al lado de la llamada no caben las miniaturas: las páginas, con las flechas.
  const apretada = !!enSala
  const total = doc.paginas.length
  const trazoColor = herramienta === 'rotulador' ? colorRot : color
  const despues = !!info.publicada && !!guardadaAt && guardadaAt > info.publicada.at
  const conMiniaturas = !apretada && verMiniaturas
  const conPropiedades = herramienta !== 'borrador' && herramienta !== 'mano' && (herramienta !== 'mover' || !!elegido)
  const paraQuien = info.semana.curso || 'esta clase'

  return (
    <Marco dentro={!!enSala}>
      {/* Arriba: de dónde vienes, qué clase es, si está guardado y qué tienen los alumnos */}
      <header className="relative z-[5] flex h-14 shrink-0 items-center gap-2 border-b border-[#E6EAF2] bg-white px-2.5 sm:gap-3 sm:px-4">
        {enSala ? (
          <BotonCabecera onClick={() => enSala.cerrar()} titulo="Cerrar la pizarra (la llamada sigue)">
            <X size={18} />
          </BotonCabecera>
        ) : (
          <Link
            href="/equipo"
            aria-label="Volver a la sala de profesores"
            title="Volver a la sala de profesores"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#3B4262] transition-colors hover:bg-[#F2F4F8] hover:text-[#0B1033]"
          >
            <CaretLeft size={18} weight="bold" />
          </Link>
        )}
        <span className="hidden h-6 w-px shrink-0 bg-[#E6EAF2] sm:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-poppins)] text-[15px] font-semibold leading-tight text-[#0B1033]">{info.semana.tema || 'Clase sin tema'}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[12px] leading-tight text-[#6B7393]">
            <span className="truncate">{info.semana.curso}</span>
            <span className="text-[#C3C9D8]">·</span>
            {soloLectura ? <span>Solo para mirar y descargar</span> : <EstadoGuardado estado={guardado} at={guardadaAt} onReintentar={() => guardar()} />}
          </p>
        </div>

        {/* Qué presentación está abierta: el botón abre la lista de la clase */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              // Al abrir, la lista al día (lo recién escrito cuenta como notas).
              if (!panel) releer()
              setPanel((v) => !v)
            }}
            aria-expanded={panel}
            title="Las presentaciones de esta clase"
            className={`flex h-9 max-w-[42vw] items-center gap-2 rounded-lg border bg-white pl-2.5 pr-2.5 text-[13px] text-[#0B1033] transition-colors md:max-w-[260px] ${
              panel ? 'border-[#0b2da0]' : 'border-[#E2E7F0] hover:border-[#C9D3E6]'
            }`}
          >
            <FilePdf size={16} className="shrink-0 text-[#B42323]" />
            <span className="hidden truncate sm:inline">{nombreAbierta}</span>
            <CaretDown size={12} weight="bold" className="shrink-0 text-[#6B7393]" />
          </button>
          {panel && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPanel(false)} />
              <div
                className="fixed inset-x-2 top-[60px] z-30 max-h-[calc(100dvh-76px)] overflow-y-auto rounded-xl border border-[#E3E7EF] bg-white p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+6px)] sm:w-[460px] sm:max-h-[min(70vh,640px)]"
                style={{ boxShadow: '0 1px 2px rgba(16,24,64,0.05), 0 16px 40px -16px rgba(16,24,64,0.25)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-poppins)] text-[15px] font-semibold text-[#0B1033]">Presentaciones de esta clase</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7393]">Cada una guarda sus notas. Abrir otra no borra lo escrito en esta.</p>
                  </div>
                  <BotonCabecera onClick={() => setPanel(false)} titulo="Cerrar" chico>
                    <X size={16} />
                  </BotonCabecera>
                </div>
                <div className="mt-2">
                  <ListaPresentaciones
                    semanaId={id}
                    token={token}
                    compacta
                    abierta={fuente}
                    inicial={listaInfo}
                    antesDeCambiar={guardarTodo}
                    onAbrir={async (x) => {
                      setPanel(false)
                      await abrir(x)
                    }}
                    onCambio={(l, que) => {
                      if (que === 'cambio') trasCambioEnLaLista(l)
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#EEF1F6] pt-3">
                  <button
                    onClick={() => {
                      setPanel(false)
                      descargarConNotas()
                    }}
                    disabled={!pdfListo || !!falloPdf || !!bajando}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0b2da0] hover:underline disabled:opacity-50"
                  >
                    <DownloadSimple size={15} weight="bold" /> Descargar esta con las notas
                  </button>
                  {fuente !== PIZARRA_EN_BLANCO && !soloLectura ? (
                    <button
                      onClick={async () => {
                        setPanel(false)
                        await abrir(PIZARRA_EN_BLANCO)
                      }}
                      className="text-[13px] font-semibold text-[#3B4262] hover:underline"
                    >
                      Abrir una pizarra en blanco
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>

        {!soloLectura && (
          <EstadoAlumnos
            publicada={info.publicada}
            despues={despues}
            paraQuien={paraQuien}
            onVer={() => setViendoPublicada(true)}
            onQuitar={quitar}
          />
        )}

        {enSala ? (
          <button
            onClick={() => {
              cerrarTexto()
              enSala.alternar()
            }}
            disabled={!enSala.ensenando && (!enSala.puede || !pdfListo || !!falloPdf)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13.5px] font-semibold transition-colors disabled:opacity-50 ${
              enSala.ensenando ? 'bg-[#B42323] text-white hover:bg-[#9E1E1E]' : 'border border-[#E2E7F0] text-[#0B1033] hover:border-[#C9D3E6] hover:bg-[#F7F9FD]'
            }`}
            title={enSala.ensenando ? 'Los alumnos están viendo la pizarra' : 'Que los alumnos vean la pizarra en la llamada'}
          >
            {enSala.ensenando ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : <Broadcast size={16} weight="bold" />}
            {enSala.ensenando ? 'Dejar de enseñar' : 'Enseñar a la clase'}
          </button>
        ) : null}
        {!enSala && (
          <BotonCabecera onClick={pantallaCompleta} titulo={completa ? 'Salir de pantalla completa' : 'Pantalla completa'} solo="sm">
            {completa ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
          </BotonCabecera>
        )}
        {!soloLectura && (
          <button
            onClick={publicar}
            disabled={!!publicando || !pdfListo || !!falloPdf}
            title={`La versión que verán los alumnos de ${paraQuien} en lugar de la de antes de la clase`}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0a2690] disabled:opacity-60"
          >
            <PaperPlaneTilt size={16} weight="fill" />
            <span className="hidden sm:inline">{info.publicada ? (despues ? 'Volver a guardar para los alumnos' : 'Guardar de nuevo') : 'Guardar para los alumnos'}</span>
            <span className="sm:hidden">Guardar</span>
          </button>
        )}
      </header>

      {soloLectura ? (
        <p className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0E3C4] bg-[#FFFBF2] px-4 py-2 text-[13px] text-[#6B5320]">
          <span>
            Estas notas son de una presentación que ya no está en la clase{nombreAbierta && nombreAbierta !== 'Presentación' ? ` («${nombreAbierta}»)` : ''}: salen sobre páginas en blanco. Aquí no se escribe.
          </span>
          <button onClick={descargarConNotas} disabled={!pdfListo || !!bajando} className="font-semibold text-[#0b2da0] hover:underline disabled:opacity-50">
            Descargarlas en PDF
          </button>
        </p>
      ) : sinPresentaciones && fuente === PIZARRA_EN_BLANCO ? (
        <p className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#E6EAF2] bg-[#FAFBFD] px-4 py-2 text-[13px] text-[#4A5272]">
          <span>Esta clase aún no tiene presentación: estás en una pizarra en blanco. Lo que escribas se guarda igual.</span>
          <label className="cursor-pointer font-semibold text-[#0b2da0] hover:underline">
            {subiendo ? 'Subiendo…' : 'Subir la presentación (PDF)'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </p>
      ) : null}
      {(
        <div className="flex min-h-0 flex-1">
          {/* Las páginas, como en Keynote o Google Slides */}
          {conMiniaturas && (
            <aside className="hidden w-[196px] shrink-0 flex-col border-r border-[#E6EAF2] bg-white lg:flex">
              <div className="flex h-11 shrink-0 items-center justify-between pl-4 pr-2">
                <p className="text-[12.5px] font-semibold text-[#3B4262]">
                  Páginas <span className="font-normal text-[#8A91AD]">{total}</span>
                </p>
                <BotonCabecera onClick={() => cambiarMiniaturas(false)} titulo="Esconder las páginas" chico>
                  <SidebarSimple size={16} />
                </BotonCabecera>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
                {doc.paginas.map((pg, k) => (
                  <Miniatura key={k} n={k + 1} pagina={pg} src={pg.origen ? miniaturas[pg.origen] : ''} tam={tamDe(pg)} elegida={k === idx} onClick={() => ir(k)} />
                ))}
                <button
                  onClick={paginaEnBlanco}
                  className="ml-[22px] mt-2 flex aspect-[3/2] w-[calc(100%-22px)] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#C9D1E3] text-[12px] font-semibold text-[#6B7393] transition-colors hover:border-[#0b2da0] hover:text-[#0b2da0]"
                >
                  <Plus size={16} weight="bold" />
                  Página en blanco
                </button>
              </div>
            </aside>
          )}

          {/* El lienzo, con las barras flotando encima */}
          <div className="@container relative min-w-0 flex-1" style={PUNTOS}>
            <div ref={areaRef} className={`absolute inset-0 flex ${zoom > 1 ? 'overflow-auto' : 'items-center justify-center overflow-hidden'}`}>
              {falloPdf ? (
                <div className="m-auto w-full max-w-[440px] rounded-2xl border border-[#E6EAF2] bg-white px-7 py-7 text-center">
                  <p className="font-[family-name:var(--font-poppins)] text-[16px] font-semibold text-[#0B1033]">No se pudo abrir esta presentación</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#4A5272]">{falloPdf}</p>
                  {info.presentaciones.length > 1 && <p className="mt-2 text-[13px] text-[#6B7393]">Arriba, en el botón con el nombre, puedes abrir otra de las presentaciones de esta clase.</p>}
                  <label className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white">
                    <UploadSimple size={16} weight="bold" />
                    {subiendo ? 'Subiendo…' : 'Subir otro PDF'}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
                  </label>
                </div>
              ) : !pdfListo ? (
                <Cargando texto="Abriendo la presentación…" />
              ) : (
                pagina && (
                  <div
                    ref={hojaRef}
                    className="relative m-auto shrink-0 bg-white"
                    style={{
                      width: escena.w,
                      height: escena.h,
                      borderRadius: 2,
                      boxShadow: '0 0 0 1px rgba(16,24,64,0.06), 0 1px 2px rgba(16,24,64,0.06), 0 12px 32px -12px rgba(16,24,64,0.18)',
                      marginTop: (zoom > 1 ? 16 : 0) + reservaArriba(area.w) || undefined,
                      // Que la página quede por encima de la barra de herramientas.
                      marginBottom: RESERVA_ABAJO,
                    }}
                  >
                    <canvas ref={fondoRef} className="absolute inset-0 h-full w-full" />
                    {/* Solo para mirar (notas de un documento que ya no está): no se escribe encima. */}
                    {soloLectura ? <div className="absolute inset-0 z-[3]" aria-hidden /> : null}
                    <canvas
                      ref={notasRef}
                      className="absolute inset-0 h-full w-full"
                      style={{
                        // Mover con el dedo: el navegador no puede quedarse el gesto para desplazar la página.
                        touchAction: herramienta === 'texto' ? 'manipulation' : 'none',
                        cursor:
                          (herramienta === 'mover' || herramienta === 'texto') && sobre >= 0
                            ? 'move'
                            : herramienta === 'texto'
                              ? 'text'
                              : herramienta === 'mover'
                                ? 'default'
                                : herramienta === 'mano'
                                  ? zoom > 1
                                    ? 'grab'
                                    : 'default'
                                  : 'crosshair',
                      }}
                      onPointerLeave={() => {
                        if (!gestoRef.current && sobre >= 0) setSobre(-1)
                      }}
                      onPointerDown={alBajar}
                      onPointerMove={alMover}
                      onPointerUp={alSoltar}
                      onPointerCancel={alSoltar}
                      onClick={alPulsar}
                      onDoubleClick={alDobleClic}
                    />
                    {sobre >= 0 && sobre !== sel && !editando && (herramienta === 'mover' || herramienta === 'texto') ? (
                      <MarcoCaja caja={cajaDe(pagina.trazos[sobre])} W={escena.w} H={escena.h} suave />
                    ) : null}
                    {sel >= 0 && !editando && pagina.trazos[sel] ? (
                      <MarcoCaja
                        caja={cajaDe(pagina.trazos[sel])}
                        W={escena.w}
                        H={escena.h}
                        onEsquina={empezarEscalar}
                        onMoverEsquina={moverEsquina}
                        onSoltarEsquina={soltarEsquina}
                      />
                    ) : null}
                    {elegido && (sel >= 0 || editando) ? (
                      <BarraElegido
                        trazo={elegido}
                        caja={cajaDe(elegido)}
                        W={escena.w}
                        H={escena.h}
                        escribiendo={!!editando}
                        onColor={elegirColor}
                        onEstilo={elegirEstilo}
                        onTam={(f) => cambiarElegido((t) => cambiarTamano(t, f))}
                        onEditar={editarElegido}
                        onDuplicar={duplicarElegido}
                        onBorrar={borrarElegido}
                      />
                    ) : null}
                    {editando && (
                      <CajaDeTexto
                        e={editando}
                        ancho={escena.w}
                        alto={escena.h}
                        onChange={(texto) => setEditando((v) => (v ? { ...v, texto } : v))}
                        onCerrar={cerrarTexto}
                        onListo={() => {
                          elegirAlCerrar.current = true
                        }}
                      />
                    )}
                    {pagina.oculta && (
                      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0B1033]/85 px-2.5 py-1 text-[11.5px] font-semibold text-white">
                        <EyeSlash size={13} /> Los alumnos no verán esta página
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Abrir otra vez las páginas */}
            {!apretada && !verMiniaturas && (
              <div className="absolute left-3 top-3 z-[4] hidden lg:block">
                <Flotante>
                  <BotonDock onClick={() => cambiarMiniaturas(true)} titulo="Ver las páginas">
                    <SidebarSimple size={18} />
                  </BotonDock>
                </Flotante>
              </div>
            )}

            {pdfListo && !falloPdf ? (
              <>
                {/* Color, grosor y tipo de letra: un panel a la izquierda, solo cuando sirven (como en Excalidraw) */}
                {conPropiedades && (
                  <div className="absolute left-4 top-1/2 z-[4] -translate-y-1/2 @max-[860px]:left-3">
                    <Flotante propiedades vertical>
                      <div className="grid grid-cols-2 gap-0.5">
                        {(elegido ? elegido.t === 'rotulador' : herramienta === 'rotulador')
                          ? COLORES_ROTULADOR.map((c) => <Color key={c} c={c} elegido={(elegido ? elegido.color : colorRot) === c} onClick={() => elegirColor(c)} />)
                          : [...COLORES, BLANCO].map((c) => <Color key={c} c={c} elegido={(elegido ? elegido.color : color) === c} onClick={() => elegirColor(c)} />)}
                      </div>
                      {(elegido ? elegido.t === 'lapiz' : herramienta === 'lapiz') && (
                        <>
                          <Raya horizontal />
                          <div className="flex flex-col gap-0.5">
                            {(Object.keys(GROSORES) as (keyof typeof GROSORES)[]).map((g) => {
                              const activo = elegido?.t === 'lapiz' ? Math.abs(elegido.grosor - GROSORES[g]) < 0.0005 : grosor === g
                              const c = elegido ? elegido.color : trazoColor
                              return (
                                <button
                                  key={g}
                                  onClick={() => elegirGrosor(g)}
                                  title={`Trazo ${g}`}
                                  aria-label={`Trazo ${g}`}
                                  aria-pressed={activo}
                                  className={`flex h-8 w-full items-center justify-center rounded-lg px-2 transition-colors ${activo ? 'bg-[#EEF2FC]' : 'hover:bg-[#F2F4F8]'}`}
                                >
                                  <span className="block w-full rounded-full" style={{ height: g === 'fino' ? 2 : g === 'medio' ? 4 : 7, background: c === BLANCO ? '#0B1033' : c }} />
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {(elegido ? elegido.t === 'texto' : herramienta === 'texto') && (
                        <>
                          <Raya horizontal />
                          <div className="flex flex-col gap-0.5">
                            <Opcion activa={(elegido?.t === 'texto' ? elegido.estilo : estilo) === 'titulo'} onClick={() => elegirEstilo('titulo')}>
                              Título
                            </Opcion>
                            <Opcion activa={(elegido?.t === 'texto' ? elegido.estilo : estilo) === 'texto'} onClick={() => elegirEstilo('texto')}>
                              Texto
                            </Opcion>
                            <Opcion activa={(elegido?.t === 'texto' ? elegido.estilo : estilo) === 'nota'} onClick={() => elegirEstilo('nota')}>
                              Nota
                            </Opcion>
                          </div>
                          {!elegido && (
                            <>
                              <Raya horizontal />
                              <div className="grid grid-cols-3 gap-0.5">
                                <Opcion activa={tamTexto === 'pequeno'} onClick={() => elegirTamTexto('pequeno')} titulo="Letra pequeña">
                                  <span className="text-[10.5px]">A</span>
                                </Opcion>
                                <Opcion activa={tamTexto === 'normal'} onClick={() => elegirTamTexto('normal')} titulo="Letra normal">
                                  <span className="text-[13px]">A</span>
                                </Opcion>
                                <Opcion activa={tamTexto === 'grande'} onClick={() => elegirTamTexto('grande')} titulo="Letra grande">
                                  <span className="text-[16px]">A</span>
                                </Opcion>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </Flotante>
                  </div>
                )}

                {/* Las herramientas, abajo en el centro (como en Canva, Miro o tldraw) */}
                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[4] flex justify-center px-3">
                  <Flotante className="pointer-events-auto max-w-full overflow-x-auto">
                    <BotonDock activo={herramienta === 'mover'} onClick={() => elegirHerramienta('mover')} titulo="Elegir y mover" atajo="V">
                      <Cursor size={19} />
                    </BotonDock>
                    <BotonDock activo={herramienta === 'lapiz'} onClick={() => elegirHerramienta('lapiz')} titulo="Lápiz" atajo="L">
                      <PencilSimple size={19} />
                    </BotonDock>
                    <BotonDock activo={herramienta === 'rotulador'} onClick={() => elegirHerramienta('rotulador')} titulo="Rotulador" atajo="R">
                      <Highlighter size={19} />
                    </BotonDock>
                    <BotonDock activo={herramienta === 'texto'} onClick={() => elegirHerramienta('texto')} titulo="Texto" atajo="T">
                      <TextT size={19} />
                    </BotonDock>
                    <BotonDock activo={herramienta === 'borrador'} onClick={() => elegirHerramienta('borrador')} titulo="Borrador" atajo="B">
                      <Eraser size={19} />
                    </BotonDock>
                    <BotonDock activo={herramienta === 'mano'} onClick={() => elegirHerramienta('mano')} titulo="Mover la página" atajo="H">
                      <Hand size={19} />
                    </BotonDock>
                    <Raya alta />
                    <BotonDock onClick={deshacer} apagado={!historia.atras} titulo="Deshacer" atajo="⌘Z">
                      <ArrowCounterClockwise size={19} />
                    </BotonDock>
                    <BotonDock onClick={rehacer} apagado={!historia.adelante} titulo="Rehacer" atajo="⇧⌘Z">
                      <ArrowClockwise size={19} />
                    </BotonDock>
                  </Flotante>
                </div>

                {/* Las páginas: abajo a la izquierda (arriba si no cabe) */}
                <div className="absolute bottom-4 left-4 z-[4] @max-[860px]:bottom-auto @max-[860px]:left-3 @max-[860px]:top-3">
                  <Flotante>
                    <BotonDock onClick={() => ir(idx - 1)} apagado={idx === 0} titulo="Página anterior" atajo="←" chico>
                      <CaretLeft size={16} weight="bold" />
                    </BotonDock>
                    <span className="min-w-[52px] px-0.5 text-center text-[12.5px] font-semibold tabular-nums text-[#0B1033]">
                      {total ? idx + 1 : 0} <span className="font-normal text-[#8A91AD]">/ {total}</span>
                    </span>
                    <BotonDock onClick={() => ir(idx + 1)} apagado={idx >= total - 1} titulo="Página siguiente" atajo="→" chico>
                      <CaretRight size={16} weight="bold" />
                    </BotonDock>
                    <Raya />
                    <BotonDock onClick={esconder} activo={!!pagina?.oculta} titulo={pagina?.oculta ? 'Volver a enseñar esta página a los alumnos' : 'Que los alumnos no vean esta página'} chico>
                      {pagina?.oculta ? <EyeSlash size={17} /> : <Eye size={17} />}
                    </BotonDock>
                    <BotonDock onClick={paginaEnBlanco} titulo="Añadir una página en blanco para notas" chico>
                      <FilePlus size={17} />
                    </BotonDock>
                    {pagina?.origen == null ? (
                      <BotonDock onClick={quitarPagina} titulo="Quitar esta página en blanco" chico peligro>
                        <Trash size={17} />
                      </BotonDock>
                    ) : (
                      <BotonDock onClick={limpiarPagina} apagado={!pagina?.trazos.length} titulo="Borrar todo lo escrito en esta página" chico peligro>
                        <Broom size={17} />
                      </BotonDock>
                    )}
                  </Flotante>
                </div>

                {/* El zoom: abajo a la derecha (arriba si no cabe) */}
                <div className="absolute bottom-4 right-4 z-[4] @max-[860px]:bottom-auto @max-[860px]:right-3 @max-[860px]:top-3 @max-[560px]:top-[60px]">
                  <Flotante>
                    <BotonDock onClick={() => ponerZoom(zoom / 1.25)} apagado={zoom <= 1} titulo="Alejar" atajo="−" chico>
                      <Minus size={16} weight="bold" />
                    </BotonDock>
                    <button
                      onClick={() => ponerZoom(1)}
                      title="La página entera (0)"
                      className="h-8 min-w-[52px] rounded-lg px-1.5 text-[12.5px] font-semibold tabular-nums text-[#0B1033] transition-colors hover:bg-[#F2F4F8]"
                    >
                      {Math.round(zoom * 100)} %
                    </button>
                    <BotonDock onClick={() => ponerZoom(zoom * 1.25)} apagado={zoom >= ZOOM_MAX} titulo="Acercar" atajo="+" chico>
                      <Plus size={16} weight="bold" />
                    </BotonDock>
                    {zoomAncho > 1.02 && (
                      <BotonDock onClick={() => ponerZoom(zoomAncho, 0.5, 0)} activo={Math.abs(zoom - zoomAncho) < 0.02} titulo="Ajustar al ancho de la pantalla" chico>
                        <ArrowsHorizontal size={17} />
                      </BotonDock>
                    )}
                  </Flotante>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {abriendo && <div className="absolute inset-0 z-10 cursor-wait bg-white/50" aria-hidden />}
      {bajando && !publicando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
          <div className="w-[320px] rounded-2xl border border-[#E6EAF2] bg-white px-6 py-6 text-center shadow-[0_16px_40px_-16px_rgba(16,24,64,0.25)]">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#DCE3F2] border-t-[#0b2da0]" />
            <p className="mt-4 font-[family-name:var(--font-poppins)] text-[15.5px] font-semibold text-[#0B1033]">Preparando el PDF con las notas</p>
            <p className="mt-1 text-[13px] text-[#6B7393]">{bajando}</p>
          </div>
        </div>
      )}
      {publicando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
          <div className="w-[320px] rounded-2xl border border-[#E6EAF2] bg-white px-6 py-6 text-center shadow-[0_16px_40px_-16px_rgba(16,24,64,0.25)]">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#DCE3F2] border-t-[#0b2da0]" />
            <p className="mt-4 font-[family-name:var(--font-poppins)] text-[15.5px] font-semibold text-[#0B1033]">Guardando para los alumnos</p>
            <p className="mt-1 text-[13px] text-[#6B7393]">{publicando}</p>
          </div>
        </div>
      )}
      {viendoPublicada ? <VisorPresentacionClase semanaId={id} titulo={`Lo que ven los alumnos de ${paraQuien}`} onClose={() => setViendoPublicada(false)} /> : null}
    </Marco>
  )
}

/**
 * Toda la ventana. Va colgado del cuerpo de la página (no del marco de la
 * escuela): si no, la barra de arriba de la escuela queda por encima.
 */
function Marco({ children, dentro }: { children: React.ReactNode; dentro?: boolean }) {
  const [listo, setListo] = useState(false)
  useEffect(() => setListo(true), [])
  // Dentro de la sala: en su caja, al lado de la llamada.
  if (dentro) return <div className="relative flex h-full w-full flex-col bg-[#F3F5F9]">{children}</div>
  if (!listo) return null
  return createPortal(<div className="fixed inset-0 z-[999] flex flex-col bg-[#F3F5F9]">{children}</div>, document.body)
}

/**
 * El recuadro de lo que hay debajo del ratón (`suave`) o de lo elegido, con
 * sus cuatro esquinas para estirarlo (18/11/2026, como en Canva). Va en la
 * página y no en el lienzo: así no sale en lo que ven los alumnos en la sala.
 */
function MarcoCaja({
  caja,
  W,
  H,
  suave,
  onEsquina,
  onMoverEsquina,
  onSoltarEsquina,
}: {
  caja: Caja01 | null
  W: number
  H: number
  suave?: boolean
  onEsquina?: (e: React.PointerEvent<HTMLElement>, cual: Esquina) => void
  onMoverEsquina?: (e: React.PointerEvent<HTMLElement>) => void
  onSoltarEsquina?: () => void
}) {
  if (!caja) return null
  const m = 5
  const x = caja.x * W - m
  const y = caja.y * H - m
  const w = caja.w * W + m * 2
  const h = caja.h * H + m * 2
  if (suave) {
    return <div className="pointer-events-none absolute rounded-[3px] border border-[#0b2da0]/45" style={{ left: x, top: y, width: w, height: h }} />
  }
  const puntos: [Esquina, number, number, string][] = [
    ['no', x, y, 'nwse-resize'],
    ['ne', x + w, y, 'nesw-resize'],
    ['so', x, y + h, 'nesw-resize'],
    ['se', x + w, y + h, 'nwse-resize'],
  ]
  return (
    <>
      <div className="pointer-events-none absolute rounded-[3px] border-[1.5px] border-[#0b2da0]" style={{ left: x, top: y, width: w, height: h }} />
      {onEsquina &&
        puntos.map(([cual, px, py, cursor]) => (
          // La zona que se toca es grande (28 px, el dedo y el lápiz); el punto que se ve, pequeño.
          <span
            key={cual}
            role="button"
            aria-label="Estirar"
            title="Arrastra para agrandar o achicar"
            onPointerDown={(e) => onEsquina(e, cual)}
            onPointerMove={onMoverEsquina}
            onPointerUp={onSoltarEsquina}
            onPointerCancel={onSoltarEsquina}
            className="absolute z-[2] flex h-7 w-7 items-center justify-center"
            style={{ left: px - 14, top: py - 14, cursor, touchAction: 'none' }}
          >
            <span className="block h-[11px] w-[11px] rounded-[3px] border-[1.5px] border-[#0b2da0] bg-white" />
          </span>
        ))}
    </>
  )
}

/**
 * La barra pequeña encima de lo elegido (18/11/2026): color, tamaño, estilo
 * del texto, escribir, duplicar y borrar. Los botones no quitan el foco a la
 * caja de escribir (`onMouseDown` sin hacer nada): así el color se cambia
 * también mientras se escribe.
 */
function BarraElegido({
  trazo,
  caja,
  W,
  H,
  escribiendo,
  onColor,
  onEstilo,
  onTam,
  onEditar,
  onDuplicar,
  onBorrar,
}: {
  trazo: Trazo
  caja: Caja01 | null
  W: number
  H: number
  escribiendo: boolean
  onColor: (c: string) => void
  onEstilo: (e: EstiloTexto) => void
  onTam: (factor: number) => void
  onEditar: () => void
  onDuplicar: () => void
  onBorrar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [medida, setMedida] = useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (el && (el.offsetWidth !== medida.w || el.offsetHeight !== medida.h)) setMedida({ w: el.offsetWidth, h: el.offsetHeight })
  })
  if (!caja) return null
  const colores = trazo.t === 'rotulador' ? [...COLORES_ROTULADOR] : [...COLORES, BLANCO]
  const texto = trazo.t === 'texto'
  // Encima de lo elegido; si no cabe, debajo. Nunca fuera de la página por los lados.
  const arriba = caja.y * H - 12 - medida.h
  const top = arriba >= 4 ? arriba : Math.min(H - medida.h - 4, (caja.y + caja.h) * H + 12)
  const centro = (caja.x + caja.w / 2) * W
  const left = Math.max(4, Math.min(W - medida.w - 4, centro - medida.w / 2))
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={parar}
      onClick={parar}
      onDoubleClick={parar}
      className="absolute z-[3] flex flex-wrap items-center gap-0.5 rounded-xl border border-[#E3E7EF] bg-white p-1 text-[#0B1033]"
      style={{ left, top, maxWidth: Math.max(160, W - 8), boxShadow: '0 1px 2px rgba(16,24,64,0.05), 0 10px 28px -12px rgba(16,24,64,0.25)', visibility: medida.w ? 'visible' : 'hidden' }}
    >
      {colores.map((c) => (
        <Color key={c} c={c} elegido={trazo.color === c} onClick={() => onColor(c)} chico />
      ))}
      <Raya chica />
      <BotonBarra onClick={() => onTam(1 / 1.15)} titulo={texto ? 'Letra más pequeña' : 'Trazo más fino'}>
        <Minus size={15} />
      </BotonBarra>
      <span className="min-w-[30px] text-center text-[12px] font-semibold tabular-nums text-[#0a1656]" title={texto ? 'Tamaño de la letra' : 'Grosor'}>
        {texto ? Math.round((trazo as TrazoTexto).tam * 1000) : Math.round((trazo as TrazoLinea).grosor * 1000)}
      </span>
      <BotonBarra onClick={() => onTam(1.15)} titulo={texto ? 'Letra más grande' : 'Trazo más grueso'}>
        <Plus size={15} />
      </BotonBarra>
      {texto && (
        <>
          <Raya chica />
          {(['texto', 'titulo', 'nota'] as EstiloTexto[]).map((es) => (
            <button
              key={es}
              onClick={() => onEstilo(es)}
              className={`h-7 rounded-lg px-2 text-[12px] font-semibold ${(trazo as TrazoTexto).estilo === es ? 'bg-[#EEF2FC] text-[#0b2da0]' : 'text-[#3B4262] hover:bg-[#F2F4F8]'}`}
            >
              {es === 'texto' ? 'Texto' : es === 'titulo' ? 'Título' : 'Nota'}
            </button>
          ))}
        </>
      )}
      {!escribiendo && (
        <>
          <Raya chica />
          {texto && (
            <BotonBarra onClick={onEditar} titulo="Cambiar el texto (Intro)">
              <PencilSimple size={15} />
            </BotonBarra>
          )}
          <BotonBarra onClick={onDuplicar} titulo="Duplicar (Ctrl+D)">
            <Copy size={15} />
          </BotonBarra>
          <BotonBarra onClick={onBorrar} titulo="Borrar (Supr)" peligro>
            <Trash size={15} />
          </BotonBarra>
        </>
      )}
    </div>
  )
}

function BotonBarra({ children, onClick, titulo, peligro }: { children: React.ReactNode; onClick: () => void; titulo: string; peligro?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`flex h-7 w-7 items-center justify-center rounded-lg ${peligro ? 'text-[#3B4262] hover:bg-[#FBEDEC] hover:text-[#B42323]' : 'text-[#3B4262] hover:bg-[#F2F4F8]'}`}
    >
      {children}
    </button>
  )
}

/** El fondo del lienzo: gris muy claro con puntos, como una mesa de trabajo. */
const PUNTOS: React.CSSProperties = {
  backgroundColor: '#F3F5F9',
  backgroundImage: 'radial-gradient(rgba(16,24,64,0.11) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
}

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="m-auto flex flex-col items-center gap-3">
      <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#DCE3F2] border-t-[#0b2da0]" />
      <p className="text-[13.5px] text-[#6B7393]">{texto}</p>
    </div>
  )
}

/** Una barra que flota sobre el lienzo. */
function Flotante({ children, propiedades, vertical, className = '' }: { children: React.ReactNode; propiedades?: boolean; vertical?: boolean; className?: string }) {
  return (
    <div
      // Los de color y tamaño no le quitan el foco al texto que se escribe.
      onMouseDown={propiedades ? (e) => e.preventDefault() : undefined}
      className={`flex shrink-0 gap-0.5 rounded-xl border border-[#E3E7EF] bg-white/95 p-1 backdrop-blur ${vertical ? 'w-[84px] flex-col items-stretch p-1.5' : 'items-center'} ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(16,24,64,0.05), 0 8px 24px -10px rgba(16,24,64,0.18)' }}
    >
      {children}
    </div>
  )
}

/** Un botón de las barras flotantes, con su nombre y su atajo al pasar el ratón. */
function BotonDock({
  children,
  onClick,
  activo,
  apagado,
  titulo,
  atajo,
  chico,
  peligro,
}: {
  children: React.ReactNode
  onClick: () => void
  activo?: boolean
  apagado?: boolean
  titulo: string
  atajo?: string
  chico?: boolean
  peligro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={apagado}
      aria-label={titulo}
      aria-pressed={activo}
      title={atajo ? `${titulo} (${atajo})` : titulo}
      className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${chico ? 'h-8 w-8' : 'h-10 w-10'} ${
        activo
          ? 'bg-[#0b2da0] text-white'
          : peligro
            ? 'text-[#3B4262] hover:bg-[#FBEDEC] hover:text-[#B42323]'
            : 'text-[#3B4262] hover:bg-[#F2F4F8] hover:text-[#0B1033]'
      } disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

function BotonCabecera({ children, onClick, titulo, solo, chico }: { children: React.ReactNode; onClick: () => void; titulo: string; solo?: 'sm'; chico?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`${solo === 'sm' ? 'hidden sm:flex' : 'flex'} ${chico ? 'h-8 w-8' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-lg text-[#3B4262] transition-colors hover:bg-[#F2F4F8] hover:text-[#0B1033]`}
    >
      {children}
    </button>
  )
}

/**
 * Qué tienen los alumnos de ESTA clase (18/11/2026): nada aún (ven la de
 * antes de la clase), la versión de la clase, o hay cambios sin guardar
 * para ellos. Al tocarlo: verla como ellos o quitarla.
 */
function EstadoAlumnos({
  publicada,
  despues,
  paraQuien,
  onVer,
  onQuitar,
}: {
  publicada: { at: string; paginas: number } | null | undefined
  despues: boolean
  paraQuien: string
  onVer: () => void
  onQuitar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const punto = !publicada ? '#B8C0D2' : despues ? '#D9A23B' : '#16A34A'
  const corto = !publicada ? 'Aún no la tienen' : despues ? 'Cambios sin guardar' : `La tienen · ${horaCorta(publicada.at)}`
  return (
    <div ref={ref} className="relative hidden shrink-0 md:block">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-lg border border-[#E2E7F0] bg-white px-3 text-[13px] font-medium text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD]"
        aria-expanded={abierto}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: punto }} />
        <span className="text-[#6B7393]">Alumnos:</span> {corto}
        <CaretDown size={12} weight="bold" className="text-[#6B7393]" />
      </button>
      {abierto && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[320px] rounded-xl border border-[#E3E7EF] bg-white p-1.5"
          style={{ boxShadow: '0 1px 2px rgba(16,24,64,0.05), 0 16px 40px -16px rgba(16,24,64,0.25)' }}
        >
          <div className="px-3 pb-2.5 pt-2">
            <p className="text-[13.5px] font-semibold text-[#0B1033]">Lo que ven los alumnos de {paraQuien}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7393]">
              {!publicada
                ? 'Por ahora, la presentación de antes de la clase. Al terminar, pulsa «Guardar para los alumnos» y verán esta, con lo que has escrito. El otro grupo no la ve.'
                : despues
                  ? `Tienen la versión de las ${horaCorta(publicada.at)}. Has escrito después: vuelve a guardar para que vean lo último.`
                  : `La versión de la clase, guardada a las ${horaCorta(publicada.at)} (${publicada.paginas} páginas), en lugar de la de antes. El otro grupo no la ve.`}
            </p>
          </div>
          {publicada ? (
            <>
              <button
                onClick={() => {
                  setAbierto(false)
                  onVer()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-[#0B1033] hover:bg-[#F4F6FB]"
              >
                <Eye size={16} className="text-[#6B7393]" /> Verla como la ven ellos
              </button>
              <button
                onClick={() => {
                  setAbierto(false)
                  onQuitar()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-[#B42323] hover:bg-[#FBEDEC]"
              >
                <Trash size={16} /> Quitársela (vuelven a la de antes)
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function EstadoGuardado({ estado, at, onReintentar }: { estado: Guardado; at: string; onReintentar?: () => void }) {
  if (estado === 'guardando')
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[#C9D1E3] border-t-[#6B7393]" /> Guardando…
      </span>
    )
  if (estado === 'sin-guardar') return <span className="shrink-0">Sin guardar</span>
  if (estado === 'error')
    return (
      <span className="flex shrink-0 items-center gap-1 text-[#B42323]">
        <WarningCircle size={13} weight="fill" /> Sin guardar ·{' '}
        <button onClick={onReintentar} className="font-semibold underline">
          Reintentar
        </button>
      </span>
    )
  return (
    <span className="flex shrink-0 items-center gap-1">
      {at ? <CloudCheck size={14} className="text-[#16A34A]" /> : null}
      {at ? `Guardado ${horaCorta(at)}` : 'Aún no has escrito nada'}
    </span>
  )
}

function Opcion({ children, onClick, activa, titulo }: { children: React.ReactNode; onClick: () => void; activa: boolean; titulo?: string }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-pressed={activa}
      className={`h-8 min-w-8 shrink-0 rounded-lg px-2 text-[12.5px] font-semibold transition-colors ${activa ? 'bg-[#EEF2FC] text-[#0b2da0]' : 'text-[#3B4262] hover:bg-[#F2F4F8]'}`}
    >
      {children}
    </button>
  )
}

function Raya({ chica, alta, horizontal }: { chica?: boolean; alta?: boolean; horizontal?: boolean }) {
  if (horizontal) return <span className="my-1 h-px w-full shrink-0 bg-[#E6EAF2]" />
  return <span className={`mx-1 w-px shrink-0 bg-[#E6EAF2] ${alta ? 'h-6' : chica ? 'h-5' : 'h-5'}`} />
}

function Color({ c, elegido, onClick, chico }: { c: string; elegido: boolean; onClick: () => void; chico?: boolean }) {
  const borde = c === BLANCO ? '#0B1033' : c
  return (
    <button
      onClick={onClick}
      title="Color"
      aria-label="Color"
      aria-pressed={elegido}
      className={`flex shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[#F2F4F8] ${chico ? 'h-7 w-7' : 'h-8 w-8'}`}
    >
      <span
        className={`${chico ? 'h-[16px] w-[16px]' : 'h-[18px] w-[18px]'} rounded-full`}
        style={{ background: c, boxShadow: elegido ? `0 0 0 2px #fff, 0 0 0 3.5px ${borde}` : c === BLANCO ? 'inset 0 0 0 1px #B7C3DA' : 'inset 0 0 0 1px rgba(16,24,64,0.08)' }}
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
    <button ref={caja} onClick={onClick} className={`group flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition-colors ${elegida ? 'bg-[#EEF2FC]' : 'hover:bg-[#F4F6FB]'}`}>
      <span className={`w-[14px] shrink-0 pt-0.5 text-right text-[11px] tabular-nums ${elegida ? 'font-semibold text-[#0b2da0]' : 'text-[#8A91AD]'}`}>{n}</span>
      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-[5px] bg-white"
        style={{ aspectRatio: `${tam.w} / ${tam.h}`, boxShadow: elegida ? '0 0 0 2px #0b2da0' : '0 0 0 1px #E3E7EF', opacity: pagina.oculta ? 0.4 : 1 }}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full" draggable={false} />
        ) : pagina.origen == null ? (
          <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-semibold text-[#8A91AD]">Notas</span>
        ) : (
          <span className="absolute inset-0 animate-pulse bg-[#F4F6FB]" />
        )}
        {pagina.trazos.length > 0 && <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-[#0b2da0] ring-2 ring-white" title="Tiene algo escrito" />}
        {pagina.oculta && <EyeSlash size={13} className="absolute bottom-1.5 right-1.5 text-[#0B1033]" />}
      </div>
    </button>
  )
}

/** Donde se escribe un texto: una caja con la misma letra y en el mismo sitio en que quedará. */
function CajaDeTexto({
  e,
  ancho,
  alto,
  onChange,
  onCerrar,
  onListo,
}: {
  e: Editando
  ancho: number
  alto: number
  onChange: (t: string) => void
  onCerrar: () => void
  /** Esc o Ctrl+Intro: el texto queda elegido al cerrarse. */
  onListo?: () => void
}) {
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
          onListo?.()
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
