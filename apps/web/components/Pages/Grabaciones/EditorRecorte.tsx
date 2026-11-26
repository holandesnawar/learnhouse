'use client'

/**
 * Recortar la grabación de una clase y publicarla (10/11/2026; rehecho el
 * 12/11/2026).
 *
 * Usuario: "una línea de tiempo con zoom para cortar partes y un botón de
 * publicar". El recorte es VIRTUAL (no se procesa vídeo): aquí se marcan los
 * CORTES —lo que se quita— y al publicar se guarda lo que queda. Se puede
 * volver a abrir y cambiarlo las veces que haga falta.
 *
 * ⚠️ 12/11: "no veo el clip entero, solo 30 segundos, y no se sabe bien dónde
 * entrar para arreglarlo". Si la sala cortó y volvió a grabar, el día tiene
 * varias PARTES, y el editor abría la primera (31 s, en negro). Ahora:
 * - UNA sola línea de tiempo con todas las partes seguidas (la grabación
 *   entera del día), con una raya y su hora donde empieza cada parte. Tocar
 *   en cualquier sitio cambia de parte solo, y al reproducir sigue con la
 *   siguiente.
 * - Los cortes se marcan sobre esa línea (`lib/nawar/recorte.ts`: «la línea
 *   con todas las partes»): «Empieza aquí» deja fuera todo lo de antes,
 *   también las partes enteras; «Termina aquí», lo de después; un trozo de en
 *   medio puede abarcar dos partes. Al publicar se reparten por parte: lo que
 *   guarda el servidor no cambia.
 * - Se abre en la parte MÁS LARGA, y sin nada publicado las partes de menos
 *   de un minuto nacen fuera (casi siempre, alguien que entró antes).
 * - Arriba, los tres pasos; junto a la línea, «Empieza aquí» y «Termina aquí».
 *
 * 26/11/2026, usuario: "mejor UX para editar: darle pausa, quitar lo de parte 1
 * de 2, poner la clase en pantalla completa… un mejor editor". Ahora es una
 * pantalla de editor sin bajar: el vídeo ocupa lo que haya arriba, los mandos
 * y la línea van fijos debajo y lo demás (pasos, grabaciones del día, lo que se
 * quita, teclas) en una columna a la derecha. Sobre el vídeo: un botón grande de
 * reproducir cuando está en pausa y «Pantalla completa» (doble clic o F), con su
 * propia barra para moverse sin salir. Velocidad 1× a 2× para repasar rápido, y
 * al pasar el ratón por la línea se ve el minuto. Fuera «Parte 1 de 2»: las
 * grabaciones del día se nombran por su hora.
 *
 * Teclas: espacio o K (reproducir), ← → (5 s; con Mayús, 1 s), J y L (10 s),
 * I y O (inicio y fin del trozo a quitar), + y − (zoom), F (pantalla completa).
 */

import { useFuenteSala } from './useFuenteSala'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { ChevronsLeft, ChevronsRight, Loader2, Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, Scissors, SkipBack, SkipForward, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@/lib/nawar/confirmar'
import {
  cortar,
  corteEn,
  cortesGlobales,
  deGlobal,
  descortar,
  dondeSeguir,
  duracionCorta,
  duracionVisible,
  empiezaEn,
  horaEn,
  inicios,
  parteMasLarga,
  partesEnteras,
  pasoDeRegla,
  reloj,
  seVeLaParte,
  sinCorte,
  terminaEn,
  totalDe,
  trozosDe,
  trozosPorParte,
  type Trozo,
} from '@/lib/nawar/recorte'
import { diaCorto } from '@services/tareas/tareas'
import { diagnosticoVideo, publicarGrabacion, quitarGrabacion, urlVideoSala, type DiaGrabado, type DiagnosticoVideo, type SemanaDelEstudio } from '@services/grabaciones/grabaciones'

const PX_POR_SEGUNDO_MAX = 100
/** Lo que se puede ver de un golpe en la línea (18/11/2026). */
const VENTANAS: { texto: string; seg: number | null }[] = [
  { texto: 'Todo', seg: null },
  { texto: '30 min', seg: 1800 },
  { texto: '5 min', seg: 300 },
  { texto: '1 min', seg: 60 },
  { texto: '10 s', seg: 10 },
]
const REINTENTOS = 3
/** Las velocidades del botón (se pasa de una a la siguiente). */
const VELOCIDADES = [1, 1.25, 1.5, 2]
/** Las partes más cortas que esto nacen fuera si no hay nada publicado. */
const PARTE_MINIMA = 60

const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[#E2E7F0] bg-white text-[13px] font-semibold text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD] disabled:opacity-40 disabled:hover:bg-white'
const BOTON_FUERTE =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0B1033] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2547]'

const RAYAS: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,110,135,0.55) 0 6px, rgba(100,110,135,0.25) 6px 12px)',
}

function EditorRecorteDentro({
  courseUuid,
  dia,
  semanas,
  token,
  onClose,
  onPublicado,
}: {
  courseUuid: string
  dia: DiaGrabado
  semanas: SemanaDelEstudio[]
  token: string
  onClose: () => void
  onPublicado: () => void | Promise<void>
}) {
  const listas = useMemo(() => dia.partes.filter((p) => p.lista), [dia.partes])
  const tramos = useMemo(() => listas.map((p) => ({ id: p.id, dur: p.dur })), [listas])
  const ini = useMemo(() => inicios(tramos), [tramos])
  const total = useMemo(() => totalDe(tramos), [tramos])
  const varias = listas.length > 1

  const video = useRef<HTMLVideoElement | null>(null)
  const carril = useRef<HTMLDivElement | null>(null)
  const pista = useRef<HTMLDivElement | null>(null)
  const pendiente = useRef<number | null>(null)
  const quiereSonar = useRef(false)
  const arrastrando = useRef(false)

  // Lo que ya estaba publicado manda; si no, todo dentro menos lo muy corto.
  const sinPublicar = !dia.publicada
  const fueraAlEmpezar = useMemo(
    () => listas.map((p) => (dia.publicada ? p.trozos === null : varias && p.dur < PARTE_MINIMA)),
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [cortes, setCortes] = useState<Trozo[]>(() =>
    cortesGlobales(
      tramos,
      listas.map((p) => p.trozos),
      fueraAlEmpezar
    )
  )
  const cortasFuera = sinPublicar ? listas.filter((_, i) => fueraAlEmpezar[i]).length : 0

  const empiezaEnParte = useMemo(() => parteMasLarga(tramos), [tramos])
  const [tocado, setTocado] = useState(false)
  const [iParte, setIParte] = useState(empiezaEnParte)
  const [t, setT] = useState(() => ini[empiezaEnParte] || 0)
  const [sonando, setSonando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  // «Se queda cargando todo el tiempo» (17/11/2026): pasados 20 s sin poder
  // enseñar nada, se dice y se ofrece ver por qué (la escuela mira el archivo).
  const [tarda, setTarda] = useState(false)
  const [porQue, setPorQue] = useState<DiagnosticoVideo | null>(null)
  const [mirando, setMirando] = useState(false)
  const [previa, setPrevia] = useState(false)
  const [marcaA, setMarcaA] = useState<number | null>(null)
  const [marcaB, setMarcaB] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [ancho, setAncho] = useState(800)
  // Dónde está la línea desplazada (para la miniatura de arriba y la regla).
  const [desde, setDesde] = useState(0)
  const [semanaId, setSemanaId] = useState<number | null>(dia.publicada?.semana_id ?? dia.semana?.id ?? null)
  const [titulo, setTitulo] = useState(
    () => semanas.find((x) => x.id === dia.publicada?.semana_id)?.grabacion_sala?.titulo || ''
  )
  const [guardando, setGuardando] = useState(false)
  const [vel, setVel] = useState(1)
  const [pantalla, setPantalla] = useState(false)
  // El minuto que hay bajo el ratón en la línea (para verlo antes de tocar).
  const [sobre, setSobre] = useState<number | null>(null)
  const marco = useRef<HTMLDivElement | null>(null)

  const parte = listas[iParte]
  // El vídeo sale de Bunny (mp4 o HLS, se salta al momento) o de Daily (18/11/2026).
  useFuenteSala(video, courseUuid, parte?.id, intento, () => alFallar())
  const trozos = useMemo(() => trozosDe(cortes, total), [cortes, total])
  const zoomMax = Math.max(1, (total * PX_POR_SEGUNDO_MAX) / Math.max(1, ancho))
  const anchoPista = Math.max(ancho, ancho * zoom)
  const px = total > 0 ? anchoPista / total : 0
  const queda = duracionVisible(trozos, 0)
  const semana = semanas.find((s) => s.id === semanaId) || null
  const conHoras = total >= 3600

  /** La hora del reloj de un punto de la línea («17:38»). */
  const horaDe = useCallback(
    (g: number) => {
      const { parte: i, real } = deGlobal(tramos, g)
      return horaEn(listas[i]?.hora, real)
    },
    [tramos, listas]
  )

  // ── El ancho del carril (para el zoom y las marcas de la regla) ──────────
  useEffect(() => {
    const el = carril.current
    if (!el) return
    const medir = () => setAncho(Math.max(240, el.clientWidth))
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  // El cabezal a la vista cuando se MUEVE (al reproducir o saltar). Al
  // cambiar el zoom no: ahí manda el punto donde se acercó (el ratón).
  const tVisto = useRef(t)
  useEffect(() => {
    const el = carril.current
    const movido = tVisto.current !== t
    tVisto.current = t
    if (!movido || !el || arrastrando.current || anchoPista <= ancho) return
    const x = t * px
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + ancho - 24) el.scrollLeft = Math.max(0, x - ancho * 0.25)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  /**
   * Acercar o alejar la línea (18/11/2026, usuario: "el Spreek uur dura 3
   * horas… como Final Cut, hacer zoom en la línea de vídeo para coger el
   * segundo"). Con `ancla` (un punto de la pantalla: el ratón) ese segundo se
   * queda debajo del ratón; sin ancla, el cabezal rojo se queda en el centro.
   */
  // El zoom de verdad, sin esperar a pintar: con la rueda llegan varios
  // avisos seguidos y cada uno tiene que partir del anterior.
  const zoomRef = useRef(1)
  const zoomPendiente = useRef<{ seg: number; dx: number | null } | null>(null)
  function ponerZoom(z: number, ancla?: number) {
    const el = carril.current
    const viejo = zoomRef.current
    const nuevo = Math.min(zoomMax, Math.max(1, z))
    const caja = el?.getBoundingClientRect()
    const dx = ancla !== undefined && caja ? Math.max(0, Math.min(ancho, ancla - caja.left)) : null
    const pxViejo = total > 0 ? Math.max(ancho, ancho * viejo) / total : 0
    const p = zoomPendiente.current
    // El segundo que se queda quieto: el que hay bajo el ratón (o el cabezal).
    const seg = p && p.dx === dx ? p.seg : dx !== null && el && pxViejo > 0 ? (el.scrollLeft + dx) / pxViejo : t
    zoomRef.current = nuevo
    zoomPendiente.current = { seg, dx }
    setZoom(nuevo)
  }
  // Con el zoom nuevo ya pintado, la línea se coloca para que ese segundo siga
  // en su sitio.
  React.useLayoutEffect(() => {
    const p = zoomPendiente.current
    const el = carril.current
    zoomPendiente.current = null
    if (!p || !el || total <= 0) return
    el.scrollLeft = Math.max(0, p.seg * (Math.max(ancho, ancho * zoom) / total) - (p.dx ?? ancho / 2))
    setDesde(el.scrollLeft)
  }, [zoom, ancho, total])
  /** La miniatura del día: llevar lo que se ve abajo al punto tocado. */
  function irAlMapa(e: React.PointerEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    const el = carril.current
    if (!el || !caja.width) return
    const f = Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width))
    el.scrollLeft = Math.max(0, f * anchoPista - ancho / 2)
  }
  /** Que en la línea se vean `seg` segundos alrededor del cabezal («10 min», «1 min»…). */
  function verVentana(seg: number | null) {
    ponerZoom(seg && total > seg ? total / seg : 1)
  }
  // Ctrl + rueda (o pellizcar el trackpad) acerca donde está el ratón; con
  // zoom, la rueda normal mueve la línea a los lados. Va con un oyente nativo
  // porque React no deja parar el desplazamiento de la página desde onWheel.
  const zoomVivo = useRef({ zoom, ponerZoom })
  zoomVivo.current = { zoom, ponerZoom }
  useEffect(() => {
    const el = carril.current
    if (!el) return
    const rueda = (e: WheelEvent) => {
      const { ponerZoom: poner } = zoomVivo.current
      const z = zoomRef.current
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        poner(z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), e.clientX)
      } else if (z > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 30 : 1)
      }
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => el.removeEventListener('wheel', rueda)
  }, [])

  // ── Moverse por la línea (cambia de parte si hace falta) ─────────────────
  const irA = useCallback(
    (g: number, seguirSonando?: boolean) => {
      const destino = Math.max(0, Math.min(total || g, g))
      const { parte: i, real } = deGlobal(tramos, destino)
      setT(destino)
      const v = video.current
      if (i === iParte && v) {
        try {
          v.currentTime = real
        } catch {
          pendiente.current = real
        }
        return
      }
      // Otra parte: otro vídeo. Se coloca (y sigue sonando) al cargar.
      pendiente.current = real
      quiereSonar.current = seguirSonando ?? (!!v && !v.paused)
      v?.pause()
      setIntento(0)
      setError('')
      setCargando(true)
      setIParte(i)
    },
    [tramos, total, iParte]
  )

  const alternar = useCallback(() => {
    const v = video.current
    if (!v) return
    if (v.paused) {
      // En «Ver cómo queda», empezar en algo que se vea.
      if (previa) {
        const sitio = dondeSeguir(trozos, t)
        const desde = sitio === null ? trozos[0]?.[0] ?? 0 : sitio
        if (Math.abs(desde - t) > 0.1) {
          irA(desde, true)
          if (deGlobal(tramos, desde).parte !== iParte) return
        }
      }
      void v.play().catch(() => undefined)
    } else v.pause()
  }, [previa, trozos, t, irA, tramos, iParte])

  useEffect(() => {
    setTarda(false)
    setPorQue(null)
    const id = window.setTimeout(() => {
      const v = video.current
      if (v && v.readyState < 1) setTarda(true)
    }, 20000)
    return () => window.clearTimeout(id)
  }, [parte?.id, intento])

  // Se queda parado A MITAD (17/11/2026, captura del usuario: el vídeo con
  // la duración ya puesta, en 0:05:54, y la rueda girando sin fin). El aviso
  // de arriba solo saltaba si no llegaba ni la duración. Ahora, si lleva 15 s
  // cargando sin avanzar, se vuelve a pedir el vídeo UNA vez en el mismo
  // segundo; si sigue igual, sale el aviso con «Ver por qué».
  const atascos = useRef(0)
  useEffect(() => {
    atascos.current = 0
  }, [parte?.id])
  useEffect(() => {
    if (!cargando || error) return
    const id = window.setTimeout(() => {
      const v = video.current
      if (!v || v.readyState >= 3) return
      if (atascos.current < 1) {
        atascos.current += 1
        pendiente.current = v.currentTime > 0 ? v.currentTime : deGlobal(tramos, t).real
        quiereSonar.current = !v.paused || sonando
        setIntento((n) => n + 1)
      } else setTarda(true)
    }, 15000)
    return () => window.clearTimeout(id)
  }, [cargando, intento, error, parte?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function verPorQue() {
    if (!parte) return
    setMirando(true)
    try {
      setPorQue(await diagnosticoVideo(courseUuid, parte.id, token))
    } catch (e: any) {
      setPorQue({ veredicto: e?.message || 'No se pudo mirar el vídeo.' })
    } finally {
      setMirando(false)
    }
  }

  function alCargar() {
    const v = video.current
    if (!v) return
    if (pendiente.current !== null) {
      try {
        v.currentTime = pendiente.current
      } catch {
        /* lo coloca el primer avance */
      }
      pendiente.current = null
    }
    v.playbackRate = vel
    setCargando(false)
    setTarda(false)
    setError('')
    if (quiereSonar.current) void v.play().catch(() => undefined)
    quiereSonar.current = false
  }

  function alAvanzar() {
    const v = video.current
    if (!v || arrastrando.current) return
    const g = (ini[iParte] || 0) + v.currentTime
    if (previa && !v.paused) {
      const sitio = dondeSeguir(trozos, g)
      if (sitio === null) {
        v.pause()
        return
      }
      if (sitio > g + 0.05) {
        irA(sitio, true)
        return
      }
    }
    setT(g)
  }

  /** Al acabar una parte, sigue con la siguiente (en «Ver cómo queda», con lo siguiente que se vea). */
  function alAcabar() {
    const fin = (ini[iParte] || 0) + (parte?.dur || 0)
    if (iParte >= listas.length - 1) return
    if (previa) {
      const sitio = dondeSeguir(trozos, fin)
      if (sitio !== null) irA(sitio, true)
      return
    }
    irA(ini[iParte + 1], true)
  }

  function alFallar() {
    const v = video.current
    if (intento >= REINTENTOS) {
      setCargando(false)
      setError('No se pudo cargar el vídeo de la sala. Puede que aún se esté procesando.')
      return
    }
    pendiente.current = v && v.currentTime > 0 ? v.currentTime : deGlobal(tramos, t).real
    quiereSonar.current = sonando
    setCargando(true)
    setIntento((n) => n + 1)
  }

  // ── Velocidad y pantalla completa ────────────────────────────────────────
  useEffect(() => {
    if (video.current) video.current.playbackRate = vel
  }, [vel])

  useEffect(() => {
    const cambio = () => {
      const d = document as any
      setPantalla(!!marco.current && (d.fullscreenElement || d.webkitFullscreenElement) === marco.current)
    }
    document.addEventListener('fullscreenchange', cambio)
    document.addEventListener('webkitfullscreenchange', cambio)
    return () => {
      document.removeEventListener('fullscreenchange', cambio)
      document.removeEventListener('webkitfullscreenchange', cambio)
    }
  }, [])

  const pantallaCompleta = useCallback(() => {
    const d = document as any
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      void (d.exitFullscreen?.() || d.webkitExitFullscreen?.())?.catch?.(() => undefined)
      return
    }
    const el = marco.current as any
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined)
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    // El iPhone solo deja poner el VÍDEO a pantalla completa (con su reproductor).
    else (video.current as any)?.webkitEnterFullscreen?.()
  }, [])

  const otraVelocidad = () => setVel((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])

  // ── Cortar ───────────────────────────────────────────────────────────────
  function ponerCortes(nuevos: Trozo[]) {
    setCortes(nuevos)
    setTocado(true)
  }

  const empiezaAqui = () => ponerCortes(empiezaEn(cortes, t, total))
  const terminaAqui = () => ponerCortes(terminaEn(cortes, t, total))

  function incluirParte(i: number, si: boolean) {
    const a = ini[i]
    const b = a + (listas[i]?.dur || 0)
    ponerCortes(si ? descortar(cortes, a, b, total) : cortar(cortes, a, b, total))
  }

  const marcarInicio = useCallback(() => {
    setMarcaA(t)
    if (marcaB !== null && marcaB <= t) setMarcaB(null)
  }, [t, marcaB])
  const marcarFin = useCallback(() => {
    setMarcaB(t)
    if (marcaA !== null && marcaA >= t) setMarcaA(null)
  }, [t, marcaA])

  function quitarTrozo() {
    if (marcaA === null || marcaB === null) return
    if (Math.abs(marcaB - marcaA) < 1) {
      toast.error('El trozo marcado dura menos de un segundo')
      return
    }
    ponerCortes(cortar(cortes, marcaA, marcaB, total))
    setMarcaA(null)
    setMarcaB(null)
  }

  // ── Teclas ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === ' ' || k === 'k' || k === 'K') {
        e.preventDefault()
        alternar()
      } else if (k === 'j' || k === 'J' || k === 'l' || k === 'L') {
        irA(t + (k === 'j' || k === 'J' ? -10 : 10))
      } else if (k === 'f' || k === 'F') {
        pantallaCompleta()
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault()
        irA(t + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 5))
      } else if (k === 'i' || k === 'I') marcarInicio()
      else if (k === 'o' || k === 'O') marcarFin()
      else if (k === '+' || k === '=') ponerZoom(zoom * 1.6)
      else if (k === '-') ponerZoom(zoom / 1.6)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
    // `ponerZoom` cambia en cada pintado; con lo que usa basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alternar, irA, marcarInicio, marcarFin, pantallaCompleta, t, zoom, zoomMax, ancho, total])

  // ── La línea de tiempo: tocar y arrastrar ────────────────────────────────
  function segundoEn(clientX: number): number {
    const el = pista.current
    if (!el || !total) return 0
    const caja = el.getBoundingClientRect()
    return Math.max(0, Math.min(total, ((clientX - caja.left) / caja.width) * total))
  }

  // Al arrastrar se mueve el cabezal; el vídeo se coloca al soltar (si no,
  // cruzar de una parte a otra cargaría vídeos a cada paso).
  function alPulsar(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no-mover]')) return
    arrastrando.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setT(segundoEn(e.clientX))
  }
  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastrando.current) {
      if (e.pointerType === 'mouse') setSobre(segundoEn(e.clientX))
      return
    }
    // Con zoom, al arrastrar hasta el borde la línea se desplaza sola.
    const el = carril.current
    if (el) {
      const caja = el.getBoundingClientRect()
      if (e.clientX > caja.right - 28) el.scrollLeft += 18
      else if (e.clientX < caja.left + 28) el.scrollLeft -= 18
    }
    setT(segundoEn(e.clientX))
  }
  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastrando.current) return
    arrastrando.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ya suelto */
    }
    irA(segundoEn(e.clientX))
  }

  // La barra de la pantalla completa: la misma línea entera, sin zoom.
  function enBarra(e: React.PointerEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    return total && caja.width ? Math.max(0, Math.min(total, ((e.clientX - caja.left) / caja.width) * total)) : 0
  }

  // Solo las marcas de lo que se ve (y un poco a cada lado): con mucho zoom,
  // una clase de 3 h serían miles.
  const marcas = useMemo(() => {
    if (!total || !px) return []
    const paso = pasoDeRegla(px)
    const a = Math.max(0, Math.floor((desde - ancho) / px / paso) * paso)
    const b = Math.min(total, (desde + 2 * ancho) / px)
    const out: number[] = []
    for (let s = a; s <= b && out.length < 600; s += paso) out.push(s)
    return out
  }, [total, px, desde, ancho])
  const visto = px > 0 ? Math.min(total, ancho / px) : total

  // Las etiquetas de las partes: solo donde caben dentro de su parte y sin
  // pisarse (una parte de 30 s es una raya sin etiqueta; la dicen los botones
  // de arriba).
  const etiquetas = useMemo(() => {
    let ultima = -Infinity
    return listas.map((p, i) => {
      const x = ini[i] * px
      const cabe = p.dur * px >= 110 && x - ultima >= 120
      if (cabe) ultima = x
      return { x, cabe, texto: p.hora || `${i + 1}` }
    })
  }, [listas, ini, px])

  // ── Publicar y cerrar ────────────────────────────────────────────────────
  async function cerrar() {
    if (tocado && !(await confirmar('¿Salir sin publicar?\n\nSe pierde el recorte que has marcado.', { boton: 'Salir', peligro: true }))) return
    onClose()
  }

  async function publicar() {
    if (!semana) {
      toast.error('Elige en qué semana se publica')
      return
    }
    const partes = trozosPorParte(cortes, tramos)
    if (!partes.length) {
      toast.error('Con ese recorte no queda nada que enseñar')
      return
    }
    setGuardando(true)
    try {
      await publicarGrabacion(semana.id, { partes, titulo: titulo.trim() }, token)
      // Si estaba publicada en otra semana, se MUEVE: no se queda en las dos.
      const antes = dia.publicada?.semana_id
      if (antes && antes !== semana.id) await quitarGrabacion(antes, token).catch(() => undefined)
      toast.success(`Publicada en «${semana.tema}»: ya la ven los alumnos`)
      await onPublicado()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo publicar')
    } finally {
      setGuardando(false)
    }
  }

  if (!parte) {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-[14.5px] text-[#0B1033]">La grabación de ese día aún se está procesando en la sala. Vuelve a probar en unos minutos.</p>
          <button onClick={onClose} className={`${BOTON} mt-4`}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  const enCorte = corteEn(cortes, t)
  const marcado = marcaA !== null && marcaB !== null
  const hora = horaDe(t)

  /** Cómo se llama un corte en la lista de «Lo que se quita». */
  function nombreDelCorte([a, b]: Trozo): { titulo: string; detalle: string } {
    const enteras = partesEnteras(tramos, [a, b])
    const sola = enteras.length === 1 && Math.abs(a - ini[enteras[0]]) < 0.6 && Math.abs(b - (ini[enteras[0]] + listas[enteras[0]].dur)) < 0.6
    const titulo = sola
      ? `La grabación de las ${listas[enteras[0]]?.hora || enteras[0] + 1} entera`
      : a <= 0.01
        ? 'El principio'
        : b >= total - 0.01
          ? 'El final'
          : 'Un trozo'
    const horas = [horaDe(a), horaDe(Math.max(a, b - 0.01))].filter(Boolean)
    const enteraTxt =
      !sola && enteras.length ? ` · incluye ${enteras.length === 1 ? `la grabación de las ${listas[enteras[0]]?.hora} entera` : `las de las ${enteras.map((i) => listas[i]?.hora).join(' y ')} enteras`}` : ''
    const detalle = `${reloj(a, conHoras)} → ${reloj(b, conHoras)}${horas.length === 2 ? ` (${horas[0]} → ${horas[1]})` : ''} · ${duracionCorta(b - a)}${enteraTxt}`
    return { titulo, detalle }
  }

  const parado = !sonando && !cargando && !error && !tarda

  // ── El vídeo, con lo que va encima ─────────────────────────────────────────
  const zonaVideo = (
    <div ref={marco} className="group relative h-full w-full bg-[#0B1033]">
      <video
        ref={video}
        key={`${parte.id}-${intento}`}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full cursor-pointer object-contain"
        onClick={alternar}
        onDoubleClick={pantallaCompleta}
        onLoadedMetadata={alCargar}
        onTimeUpdate={alAvanzar}
        onEnded={alAcabar}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onWaiting={() => setCargando(true)}
        onPlaying={() => setCargando(false)}
        onSeeked={() => setCargando(false)}
        onError={alFallar}
      />
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[14px] text-white/90">{error}</p>
          <button
            onClick={() => {
              setError('')
              setCargando(true)
              setIntento(0)
            }}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-[13.5px] font-semibold text-[#0B1033]"
          >
            <RotateCcw size={15} /> Volver a intentarlo
          </button>
        </div>
      ) : tarda ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Loader2 size={26} className="animate-spin text-white/70" />
          <p className="max-w-md text-[14px] text-white/90">
            {porQue
              ? porQue.veredicto
              : (video.current?.readyState || 0) >= 1
                ? 'El vídeo se ha quedado parado en este punto. Puedes recortar igualmente con la línea de abajo: los tiempos valen aunque no se vea.'
                : 'El vídeo está tardando mucho en cargar. Puedes recortar igualmente con la línea de abajo: los tiempos valen aunque no se vea.'}
          </p>
          {porQue && porQue.tamano ? (
            <p className="text-[12px] text-white/60">
              {[porQue.archivo && `.${porQue.archivo}`, porQue.tipo, porQue.acepta_rangos ? 'deja pedir trozos' : 'no deja pedir trozos', porQue.cajas?.length ? `empieza por ${porQue.cajas.slice(0, 3).join(' · ')}` : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!porQue ? (
              <button
                onClick={verPorQue}
                disabled={mirando}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-[13.5px] font-semibold text-[#0B1033] disabled:opacity-70"
              >
                {mirando ? <Loader2 size={15} className="animate-spin" /> : null} Ver por qué
              </button>
            ) : null}
            <button
              onClick={() => {
                setTarda(false)
                setCargando(true)
                setIntento((n) => n + 1)
              }}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-white/40 text-[13.5px] font-semibold text-white"
            >
              <RotateCcw size={15} /> Volver a intentarlo
            </button>
            <a
              href={urlVideoSala(courseUuid, parte.id, 1)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center h-9 px-4 rounded-lg border border-white/40 text-[13.5px] font-semibold text-white"
            >
              Abrirlo en otra pestaña
            </a>
          </div>
        </div>
      ) : cargando ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white/80" />
        </div>
      ) : null}

      {/* En pausa: el botón grande en el centro */}
      {parado ? (
        <button
          onClick={alternar}
          aria-label="Reproducir"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105"
        >
          <Play size={28} fill="currentColor" className="ml-1" />
        </button>
      ) : null}

      {enCorte >= 0 && !error ? (
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[12px] font-semibold text-white">
          Esto está cortado: los alumnos no lo ven
        </span>
      ) : null}

      {/* Pantalla completa: arriba a la derecha (y doble clic o F); dentro, sale en su barra */}
      {pantalla ? null : <button
        onClick={pantallaCompleta}
        aria-label="Pantalla completa"
        title="Pantalla completa (F o doble clic)"
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-white transition-opacity hover:bg-black/70 ${parado ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <Maximize2 size={17} />
      </button>}

      {/* En pantalla completa, su propia barra: moverse sin salir */}
      {pantalla ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pb-4 pt-10 opacity-100 transition-opacity">
          <div
            className="relative h-6 cursor-pointer"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              arrastrando.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              setT(enBarra(e))
            }}
            onPointerMove={(e) => {
              if (arrastrando.current) setT(enBarra(e))
            }}
            onPointerUp={(e) => {
              if (!arrastrando.current) return
              arrastrando.current = false
              irA(enBarra(e))
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25">
              {cortes.map(([a, b]) => (
                <div key={`pc${a}-${b}`} className="absolute inset-y-0 bg-black/50" style={{ left: `${(a / total) * 100}%`, width: `${((b - a) / total) * 100}%` }} />
              ))}
              <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${total ? (t / total) * 100 : 0}%` }} />
            </div>
            <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${total ? (t / total) * 100 : 0}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-white">
            <button onClick={() => irA(t - 10)} aria-label="10 segundos atrás" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15">
              <SkipBack size={17} />
            </button>
            <button onClick={alternar} aria-label={sonando ? 'Pausar' : 'Reproducir'} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B1033]">
              {sonando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => irA(t + 10)} aria-label="10 segundos adelante" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15">
              <SkipForward size={17} />
            </button>
            <span className="text-[14px] font-semibold tabular-nums">
              {reloj(t, conHoras)} <span className="font-normal text-white/60">/ {reloj(total, conHoras)}</span>
            </span>
            {enCorte >= 0 ? <span className="text-[12.5px] text-white/70">· cortado</span> : null}
            <button onClick={otraVelocidad} className="ml-auto h-8 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums hover:bg-white/15" title="Velocidad">
              {String(vel).replace('.', ',')}×
            </button>
            <button onClick={pantallaCompleta} aria-label="Salir de pantalla completa" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15">
              <Minimize2 size={17} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )

  // ── La columna de al lado: los pasos, lo grabado y lo que se quita ─────────
  const lateral = (
    <div className="space-y-6 p-4 lg:p-5">
      <div>
        <p className="text-[13.5px] font-semibold text-[#0B1033]">Cómo se recorta</p>
        <ol className="mt-2 space-y-2 text-[13px] leading-snug text-[#4B5565]">
          {[
            <>Busca dónde empieza la clase y pulsa <b className="font-semibold text-[#0B1033]">Empieza aquí</b>.</>,
            <>Busca dónde acaba y pulsa <b className="font-semibold text-[#0B1033]">Termina aquí</b>.</>,
            <>Si sobra algo en medio, márcalo con <b className="font-semibold text-[#0B1033]">Inicio</b> y <b className="font-semibold text-[#0B1033]">Fin</b> y quítalo.</>,
            <>Elige la semana y pulsa <b className="font-semibold text-[#0B1033]">Publicar</b>, arriba.</>,
          ].map((paso, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF2FB] text-[11px] font-semibold text-[#0b2da0]">{i + 1}</span>
              <span>{paso}</span>
            </li>
          ))}
        </ol>
      </div>

      {varias ? (
        <div>
          <p className="text-[13.5px] font-semibold text-[#0B1033]">Lo que grabó la sala ese día</p>
          <p className="mt-0.5 text-[12px] text-[#6B7393]">Van seguidas en la línea. Quita la marca de la que no quieras.</p>
          <ul className="mt-2 divide-y divide-[#EEF1F6] rounded-xl border border-[#E6EAF2] bg-white">
            {listas.map((p, i) => {
              const dentro = seVeLaParte(cortes, tramos, i)
              return (
                <li key={p.id} className={`flex items-center gap-3 px-3 py-2 ${i === iParte ? 'bg-[#F5F8FF]' : ''}`}>
                  <button onClick={() => irA(ini[i])} className="min-w-0 flex-1 text-left" title="Ir aquí">
                    <span className={`block text-[13px] font-semibold ${dentro ? 'text-[#0B1033]' : 'text-[#9CA3AF] line-through'}`}>Desde las {p.hora}</span>
                    <span className="block text-[11.5px] text-[#6B7393]">{duracionCorta(p.dur)}</span>
                  </button>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#5A6480]">
                    <input type="checkbox" checked={dentro} onChange={(e) => incluirParte(i, e.target.checked)} className="h-4 w-4 accent-[#0b2da0]" />
                    Incluir
                  </label>
                </li>
              )
            })}
          </ul>
          {cortasFuera ? (
            <p className="mt-1.5 text-[12px] text-[#6B7393]">
              {cortasFuera === 1 ? 'La de menos de 1 minuto se ha dejado fuera' : `Las ${cortasFuera} de menos de 1 minuto se han dejado fuera`} (suele ser alguien que entró antes de la
              clase).
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-[13.5px] font-semibold text-[#0B1033]">Lo que se quita</p>
        {cortes.length ? (
          <ul className="mt-2 divide-y divide-[#EEF1F6] rounded-xl border border-[#E6EAF2] bg-white">
            {cortes.map((c, i) => {
              const n = nombreDelCorte(c)
              return (
                <li key={`${c[0]}-${c[1]}`} className="flex items-start gap-2 px-3 py-2">
                  <button onClick={() => irA(c[0])} className="min-w-0 flex-1 text-left text-[13px] text-[#0B1033] hover:text-[#0b2da0]">
                    <span className="block font-semibold">{n.titulo}</span>
                    <span className="block text-[12px] tabular-nums text-[#6B7393]">{n.detalle}</span>
                  </button>
                  <button onClick={() => ponerCortes(sinCorte(cortes, i))} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#0b2da0] hover:underline">
                    <Undo2 size={13} /> Deshacer
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-1 text-[12.5px] text-[#6B7393]">Nada todavía: los alumnos verían la grabación entera.</p>
        )}
      </div>

      <div className="hidden lg:block">
        <p className="text-[13.5px] font-semibold text-[#0B1033]">Teclas</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] text-[#4B5565]">
          {[
            ['Espacio o K', 'Reproducir o pausar'],
            ['← →', '5 segundos (con Mayús, 1)'],
            ['J  L', '10 segundos'],
            ['I  O', 'Inicio y fin del trozo a quitar'],
            ['+  −', 'Acercar o alejar la línea'],
            ['F', 'Pantalla completa'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="font-semibold text-[#0B1033]">{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="mt-2 text-[12px] text-[#8A91AD]">Ctrl + rueda (o pellizcar el trackpad) acerca la línea donde está el ratón; con zoom, la rueda la mueve.</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#F3F5F9]">
      {/* Cabecera: qué grabación es y, a la derecha, dónde se publica (como «Exportar» en un editor de vídeo) */}
      <div className="shrink-0 border-b border-[#E6EAF2] bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5">
          <button onClick={cerrar} aria-label="Cerrar" title="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#3B4262] transition-colors hover:bg-[#F2F4F8] hover:text-[#0B1033]">
            <X size={19} />
          </button>
          <span className="hidden h-6 w-px shrink-0 bg-[#E6EAF2] sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-[#0B1033]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
              Recortar la grabación
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-tight text-[#6B7393] first-letter:uppercase">
              {diaCorto(dia.dia)} · la sala grabó {duracionCorta(total)}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="mr-1 hidden text-[13px] text-[#3B4262] lg:inline">
              Queda <b className="font-semibold text-[#0B1033]">{duracionCorta(queda)}</b>
              <span className="text-[#8A91AD]"> de {duracionCorta(total)}</span>
            </span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={160}
              placeholder="Título (opcional)"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#E2E7F0] px-3 text-[13.5px] text-[#0B1033] outline-none transition-colors placeholder:text-[#9AA1B9] hover:border-[#C9D3E6] focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/10 sm:w-44 sm:flex-none"
            />
            <select
              value={semanaId ?? ''}
              onChange={(e) => setSemanaId(e.target.value ? Number(e.target.value) : null)}
              aria-label="Semana en la que se publica"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#E2E7F0] bg-white px-2.5 text-[13.5px] text-[#0B1033] outline-none transition-colors hover:border-[#C9D3E6] focus:border-[#0b2da0] sm:max-w-[240px] sm:flex-none"
            >
              <option value="">Elige la semana…</option>
              {semanas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tema || 'Semana'} · {diaCorto(s.fecha)}
                </option>
              ))}
            </select>
            <button
              onClick={publicar}
              disabled={guardando || !semana}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0b2da0] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0a2690] disabled:opacity-50"
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
              Publicar
            </button>
          </div>
        </div>
        {!semanas.length ? (
          <p className="border-t border-[#F1E6CC] bg-[#FFFBF2] px-5 py-1.5 text-[12.5px] text-[#8A6A2A]">Esta clase aún no tiene semanas: crea la semana de ese día y vuelve para publicar.</p>
        ) : semana?.subida ? (
          <p className="border-t border-[#F1E6CC] bg-[#FFFBF2] px-5 py-1.5 text-[12.5px] text-[#8A6A2A]">
            Esa semana ya tiene una grabación subida a mano: los alumnos seguirán viendo esa, no esta.
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Columna principal: el vídeo arriba (lo que quepa) y los mandos fijos debajo */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <div className="h-[42vh] shrink-0 lg:h-auto lg:min-h-[200px] lg:flex-1">{zonaVideo}</div>

          <div className="shrink-0 border-t border-[#E6EAF2] bg-white px-3 pb-3 pt-2.5 sm:px-5">
            {/* Reproducir, tiempo, velocidad */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => irA(t - 5)} className={`${BOTON} w-9 px-0`} aria-label="5 segundos atrás" title="5 segundos atrás (←)">
                <SkipBack size={15} />
              </button>
              <button
                onClick={alternar}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2da0] text-white transition-colors hover:bg-[#0a2690]"
                aria-label={sonando ? 'Pausar' : 'Reproducir'}
                title="Reproducir o pausar (espacio)"
              >
                {sonando ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
              </button>
              <button onClick={() => irA(t + 5)} className={`${BOTON} w-9 px-0`} aria-label="5 segundos adelante" title="5 segundos adelante (→)">
                <SkipForward size={15} />
              </button>
              <span className="mx-1.5 text-[14px] font-semibold tabular-nums text-[#0B1033]">
                {reloj(t, conHoras)} <span className="font-normal text-[#8A91AD]">/ {reloj(total, conHoras)}</span>
              </span>
              {hora ? (
                <span className="hidden text-[12.5px] text-[#6B7393] sm:inline" title="La hora del reloj de ese momento de la clase">
                  · en la sala eran las <b className="font-semibold text-[#3F4A61]">{hora}</b>
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <button onClick={otraVelocidad} className={`${BOTON} min-w-[52px] tabular-nums`} title="Velocidad: para repasar más rápido">
                  {String(vel).replace('.', ',')}×
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={previa}
                  onClick={() => setPrevia(!previa)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[#3B4262] transition-colors hover:bg-[#F2F4F8]"
                  title="Reproduce saltando lo que has quitado, como lo verán los alumnos"
                >
                  <span className={`relative h-5 w-9 rounded-full transition-colors ${previa ? 'bg-[#0b2da0]' : 'bg-[#D5DCE8]'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${previa ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                  Ver cómo queda
                </button>
                <button onClick={pantallaCompleta} className={`${BOTON} w-9 px-0`} aria-label="Pantalla completa" title="Pantalla completa (F)">
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>

            {/* Zoom de la línea */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="inline-flex rounded-lg border border-[#E2E7F0] bg-white p-0.5" role="group" aria-label="Cuánto se ve en la línea">
                {VENTANAS.filter((v) => v.seg === null || v.seg < total * 0.8).map((v) => {
                  const activo = v.seg === null ? zoom <= 1.01 : Math.abs(visto - v.seg) / v.seg < 0.15
                  return (
                    <button
                      key={v.texto}
                      onClick={() => verVentana(v.seg)}
                      className={`h-7 rounded-md px-2.5 text-[12.5px] font-semibold transition-colors ${activo ? 'bg-[#0b2da0] text-white' : 'text-[#3B4262] hover:bg-[#F2F5FB]'}`}
                      title={v.seg === null ? 'Ver el día entero' : `Acercar hasta ver ${v.texto} alrededor de la línea roja`}
                    >
                      {v.texto}
                    </button>
                  )
                })}
              </div>
              <p className="hidden text-[12.5px] text-[#6B7393] sm:block">
                Se ve <b className="font-semibold tabular-nums text-[#0B1033]">{duracionCorta(visto)}</b> de {duracionCorta(total)}
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => ponerZoom(zoom / 1.6)} disabled={zoom <= 1} className={`${BOTON} h-8 w-8 px-0`} aria-label="Alejar" title="Alejar (−)">
                  <Minus size={16} strokeWidth={2.25} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={zoomMax > 1 ? Math.round((Math.log(zoom) / Math.log(zoomMax)) * 100) : 0}
                  onChange={(e) => ponerZoom(Math.pow(zoomMax, Number(e.target.value) / 100))}
                  disabled={zoomMax <= 1}
                  aria-label="Zoom de la línea de tiempo"
                  className="h-1.5 w-24 cursor-pointer accent-[#0b2da0] sm:w-36"
                />
                <button onClick={() => ponerZoom(zoom * 1.6)} disabled={zoom >= zoomMax} className={`${BOTON} h-8 w-8 px-0`} aria-label="Acercar" title="Acercar (+)">
                  <Plus size={16} strokeWidth={2.25} />
                </button>
              </div>
            </div>

            {/* El día entero en pequeño: el recuadro es lo que se ve abajo. */}
            {zoom > 1.01 ? (
              <div
                className="relative mt-2 h-6 cursor-grab select-none overflow-hidden rounded-lg border border-[#E2E7F0] bg-[#EEF2FA] active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  irAlMapa(e)
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) irAlMapa(e)
                }}
                title="El día entero: arrastra el recuadro para ir a otra hora"
              >
                <div className="absolute inset-y-1 inset-x-0 mx-0 rounded" style={{ background: 'linear-gradient(180deg, #5C7BDB 0%, #3E5FC8 100%)' }} />
                {cortes.map(([a, b]) => (
                  <div key={`m${a}-${b}`} className="absolute inset-y-1 bg-[#EEF1F7]" style={{ left: `${(a / total) * 100}%`, width: `${((b - a) / total) * 100}%`, ...RAYAS }} />
                ))}
                {varias ? listas.map((p, i) => (i ? <div key={`mp${p.id}`} className="absolute inset-y-0 w-px bg-[#0B1033]/60" style={{ left: `${(ini[i] / total) * 100}%` }} /> : null)) : null}
                <div className="absolute inset-y-0 w-0.5 bg-[#E5484D]" style={{ left: `${(t / total) * 100}%` }} />
                <div
                  className="absolute inset-y-0 rounded-md border-2 border-[#0B1033] bg-white/25 shadow-[0_0_0_9999px_rgba(244,247,253,0.55)]"
                  style={{ left: `${(desde / anchoPista) * 100}%`, width: `${Math.max(1.2, (ancho / anchoPista) * 100)}%` }}
                />
              </div>
            ) : null}

            {/* Línea de tiempo */}
            <div
              ref={carril}
              onScroll={(e) => setDesde(e.currentTarget.scrollLeft)}
              className="mt-2 overflow-x-auto overscroll-x-contain rounded-xl border border-[#E6EAF2] bg-[#FAFBFD]"
              style={{ touchAction: 'pan-x' }}
            >
              <div
                ref={pista}
                className="relative h-[96px] cursor-pointer select-none"
                style={{ width: anchoPista, touchAction: 'none' }}
                onPointerDown={alPulsar}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onPointerCancel={alSoltar}
                onPointerLeave={() => setSobre(null)}
              >
                {/* Regla */}
                <div className="absolute inset-x-0 top-0 h-6 border-b border-[#E2E8F4]">
                  {marcas.map((s) => (
                    <span key={s} className="absolute top-0 h-full border-l border-[#CBD5E8] pl-1 text-[10.5px] leading-6 tabular-nums text-[#6B7393]" style={{ left: s * px }}>
                      {reloj(s)}
                    </span>
                  ))}
                </div>
                {/* Lo que se ve */}
                <div className="absolute inset-x-0 top-[40px] h-11 rounded-md" style={{ background: 'linear-gradient(180deg, #2449C2 0%, #0b2da0 100%)' }} />
                {/* Dónde empieza cada grabación del día, con su hora */}
                {varias
                  ? etiquetas.map((e, i) => (
                      <div key={listas[i].id} className="pointer-events-none absolute top-6 bottom-0 border-l-2 border-[#0B1033]/70" style={{ left: e.x }}>
                        {e.cabe ? <span className="absolute left-1 top-0.5 whitespace-nowrap rounded bg-white/90 px-1 text-[10.5px] font-semibold text-[#0B1033]">{e.texto}</span> : null}
                      </div>
                    ))
                  : null}
                {/* Lo cortado */}
                {cortes.map(([a, b], i) => (
                  <div
                    key={`${a}-${b}`}
                    className="absolute top-[40px] h-11 bg-[#EEF1F7]"
                    style={{ left: a * px, width: Math.max(2, (b - a) * px), ...RAYAS }}
                    title={`Cortado: ${reloj(a, conHoras)} → ${reloj(b, conHoras)}`}
                  >
                    {(b - a) * px > 30 ? (
                      <button
                        data-no-mover
                        onClick={() => ponerCortes(sinCorte(cortes, i))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-white text-[#0B1033] shadow-sm hover:bg-[#F0F5FF]"
                        aria-label="Deshacer este corte"
                        title="Deshacer este corte"
                      >
                        <Undo2 size={12} />
                      </button>
                    ) : null}
                  </div>
                ))}
                {/* El trozo que se está marcando */}
                {marcaA !== null ? (
                  <div className="absolute top-[36px] h-[56px] border-l-2 border-[#C2362F]" style={{ left: marcaA * px }}>
                    <span className="absolute -top-3 left-1 text-[10px] font-bold text-[#C2362F]">INICIO</span>
                  </div>
                ) : null}
                {marcaB !== null ? (
                  <div className="absolute top-[36px] h-[56px] border-l-2 border-[#C2362F]" style={{ left: marcaB * px }}>
                    <span className="absolute -top-3 right-1 text-[10px] font-bold text-[#C2362F]">FIN</span>
                  </div>
                ) : null}
                {marcado ? (
                  <div className="absolute top-[40px] h-11 bg-[#C2362F]/35" style={{ left: Math.min(marcaA!, marcaB!) * px, width: Math.abs(marcaB! - marcaA!) * px }} />
                ) : null}
                {/* Bajo el ratón: el minuto, antes de tocar */}
                {sobre !== null ? (
                  <div className="pointer-events-none absolute top-6 bottom-0 w-px bg-[#0B1033]/35" style={{ left: sobre * px }}>
                    <span className="absolute bottom-1 left-1 whitespace-nowrap rounded bg-[#0B1033] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white">
                      {reloj(sobre, conHoras)}
                      {horaDe(sobre) ? ` · ${horaDe(sobre)}` : ''}
                    </span>
                  </div>
                ) : null}
                {/* Cabezal */}
                <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-[#E5484D]" style={{ left: Math.max(0, t * px - 1) }}>
                  <span className="absolute -left-[5px] top-0 h-3 w-3 rotate-45 rounded-[2px] bg-[#E5484D]" />
                </div>
              </div>
            </div>

            {/* Cortar: el principio y el final, y un trozo de en medio */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button onClick={empiezaAqui} className={BOTON_FUERTE} title="Se quita todo lo de antes de la línea roja">
                <ChevronsRight size={16} /> Empieza aquí
              </button>
              <button onClick={terminaAqui} className={BOTON_FUERTE} title="Se quita todo lo de después de la línea roja">
                Termina aquí <ChevronsLeft size={16} />
              </button>
              <span className="mx-1 hidden h-6 w-px bg-[#E6EAF2] sm:block" />
              <span className="text-[12.5px] font-medium text-[#4B5565]">Quitar un trozo:</span>
              <button onClick={marcarInicio} className={BOTON} title="Tecla I">
                Inicio{marcaA !== null ? ` · ${reloj(marcaA, conHoras)}` : ''}
              </button>
              <button onClick={marcarFin} className={BOTON} title="Tecla O">
                Fin{marcaB !== null ? ` · ${reloj(marcaB, conHoras)}` : ''}
              </button>
              <button
                onClick={quitarTrozo}
                disabled={!marcado}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C2362F] px-3 text-[13px] font-semibold text-white hover:bg-[#A92D27] disabled:opacity-40"
              >
                <Scissors size={14} /> Quitar
              </button>
              {marcaA !== null || marcaB !== null ? (
                <button
                  onClick={() => {
                    setMarcaA(null)
                    setMarcaB(null)
                  }}
                  className="h-9 px-2 text-[12.5px] font-semibold text-[#6B7393] hover:text-[#0B1033]"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>

          {/* En el móvil, la columna de al lado va debajo */}
          <div className="border-t border-[#E6EAF2] bg-[#F7F9FC] lg:hidden">{lateral}</div>
        </div>

        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-[#E6EAF2] bg-[#F7F9FC] lg:block">{lateral}</aside>
      </div>
    </div>
  )
}

/** A toda la ventana, por encima de la barra de la escuela (ver `EnElCuerpo`). */
export default function EditorRecorte(props: React.ComponentProps<typeof EditorRecorteDentro>) {
  return (
    <EnElCuerpo>
      <EditorRecorteDentro {...props} />
    </EnElCuerpo>
  )
}
