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
 * Teclas: espacio (reproducir), ← → (5 s; con Mayús, 1 s), I y O (inicio y fin
 * del trozo a quitar), + y − (zoom).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { ChevronsLeft, ChevronsRight, Loader2, Minus, Pause, Play, Plus, RotateCcw, Scissors, SkipBack, SkipForward, Undo2, X } from 'lucide-react'
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
import { publicarGrabacion, quitarGrabacion, urlVideoSala, type DiaGrabado, type SemanaDelEstudio } from '@services/grabaciones/grabaciones'

const PX_POR_SEGUNDO_MAX = 14
const REINTENTOS = 3
/** Las partes más cortas que esto nacen fuera si no hay nada publicado. */
const PARTE_MINIMA = 60

const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[#D5DEEE] bg-white text-[13px] font-semibold text-[#0B1033] hover:border-[#0b2da0] hover:text-[#0b2da0] disabled:opacity-40 disabled:hover:border-[#D5DEEE] disabled:hover:text-[#0B1033]'
const BOTON_FUERTE =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-[#0b2da0] bg-[#EAF0FE] text-[13.5px] font-semibold text-[#0b2da0] hover:bg-[#dfe8fd]'

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
  const [previa, setPrevia] = useState(false)
  const [marcaA, setMarcaA] = useState<number | null>(null)
  const [marcaB, setMarcaB] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [ancho, setAncho] = useState(800)
  const [semanaId, setSemanaId] = useState<number | null>(dia.publicada?.semana_id ?? dia.semana?.id ?? null)
  const [titulo, setTitulo] = useState(
    () => semanas.find((x) => x.id === dia.publicada?.semana_id)?.grabacion_sala?.titulo || ''
  )
  const [guardando, setGuardando] = useState(false)

  const parte = listas[iParte]
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

  // El cabezal siempre a la vista: al reproducir y al cambiar el zoom.
  useEffect(() => {
    const el = carril.current
    if (!el || arrastrando.current || anchoPista <= ancho) return
    const x = t * px
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + ancho - 24) el.scrollLeft = Math.max(0, x - ancho * 0.25)
  }, [t, px, ancho, anchoPista])

  function ponerZoom(z: number) {
    const nuevo = Math.min(zoomMax, Math.max(1, z))
    setZoom(nuevo)
    // Con el zoom nuevo, el cabezal al centro.
    requestAnimationFrame(() => {
      const el = carril.current
      if (el && total > 0) el.scrollLeft = Math.max(0, (t / total) * Math.max(ancho, ancho * nuevo) - ancho / 2)
    })
  }

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
    setCargando(false)
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
      if (k === ' ') {
        e.preventDefault()
        alternar()
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
  }, [alternar, irA, marcarInicio, marcarFin, t, zoom, zoomMax, ancho, total])

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
    if (!arrastrando.current) return
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

  const marcas = useMemo(() => {
    if (!total || !px) return []
    const paso = pasoDeRegla(px)
    const out: number[] = []
    for (let s = 0; s <= total && out.length < 1500; s += paso) out.push(s)
    return out
  }, [total, px])

  // Las etiquetas de las partes: solo donde caben dentro de su parte y sin
  // pisarse (una parte de 30 s es una raya sin etiqueta; la dicen los botones
  // de arriba).
  const etiquetas = useMemo(() => {
    let ultima = -Infinity
    return listas.map((p, i) => {
      const x = ini[i] * px
      const cabe = p.dur * px >= 110 && x - ultima >= 120
      if (cabe) ultima = x
      return { x, cabe, texto: `Parte ${i + 1} · ${p.hora}` }
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
      ? `Parte ${enteras[0] + 1} entera`
      : a <= 0.01
        ? 'El principio'
        : b >= total - 0.01
          ? 'El final'
          : 'Un trozo'
    const horas = [horaDe(a), horaDe(Math.max(a, b - 0.01))].filter(Boolean)
    const enteraTxt =
      !sola && enteras.length ? ` · incluye ${enteras.length === 1 ? `la parte ${enteras[0] + 1} entera` : `las partes ${enteras.map((i) => i + 1).join(' y ')} enteras`}` : ''
    const detalle = `${reloj(a, conHoras)} → ${reloj(b, conHoras)}${horas.length === 2 ? ` (${horas[0]} → ${horas[1]})` : ''} · ${duracionCorta(b - a)}${enteraTxt}`
    return { titulo, detalle }
  }

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#F4F7FD]">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-[#E2E8F4] bg-white px-4 sm:px-6 py-3">
        <Scissors size={20} className="shrink-0 text-[#0b2da0]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-[#0B1033]">Recortar la grabación</p>
          <p className="truncate text-[12.5px] text-[#6B7393]">
            {diaCorto(dia.dia)} · la sala grabó {duracionCorta(total)}
            {varias ? ` en ${listas.length} partes, aquí seguidas` : ''}
          </p>
        </div>
        <button onClick={cerrar} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5A6480] hover:bg-[#F0F5FF]">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 py-4 space-y-4">
          {/* Los pasos */}
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              <>
                Busca dónde <b>empieza</b> la clase y pulsa <b>«Empieza aquí»</b>.
              </>,
              <>
                Busca dónde <b>acaba</b> y pulsa <b>«Termina aquí»</b>.
              </>,
              <>
                Si sobra algo en medio, márcalo y <b>«Quitar este trozo»</b>. Luego, <b>Publicar</b>.
              </>,
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-lg border border-[#E2E8F4] bg-white px-3 py-2.5 text-[13px] leading-snug text-[#3F4A61]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b2da0] text-[12px] font-bold text-white">{i + 1}</span>
                <span>{txt}</span>
              </li>
            ))}
          </ol>

          {/* Partes */}
          {varias ? (
            <div>
              <div className="flex flex-wrap gap-2">
                {listas.map((p, i) => {
                  const dentro = seVeLaParte(cortes, tramos, i)
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${i === iParte ? 'border-[#0b2da0] bg-white' : 'border-[#E2E8F4] bg-white/60'}`}
                    >
                      <button onClick={() => irA(ini[i])} className="text-left" title="Ir a esta parte">
                        <span className={`block text-[13px] font-semibold ${dentro ? 'text-[#0B1033]' : 'text-[#9CA3AF] line-through'}`}>
                          Parte {i + 1} · {p.hora}
                        </span>
                        <span className="block text-[11.5px] text-[#6B7393]">{duracionCorta(p.dur)}</span>
                      </button>
                      <label className="flex items-center gap-1.5 text-[12px] text-[#5A6480] cursor-pointer">
                        <input type="checkbox" checked={dentro} onChange={(e) => incluirParte(i, e.target.checked)} className="h-4 w-4 accent-[#0b2da0]" />
                        Incluir
                      </label>
                    </div>
                  )
                })}
              </div>
              {cortasFuera ? (
                <p className="mt-1.5 text-[12px] text-[#6B7393]">
                  {cortasFuera === 1 ? 'Una parte de menos de 1 minuto se ha dejado fuera' : `${cortasFuera} partes de menos de 1 minuto se han dejado fuera`}{' '}
                  (suele ser alguien que entró antes de la clase). Márcala si la quieres.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Vídeo */}
          <div className="overflow-hidden rounded-xl bg-black">
            <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: '16 / 9' }}>
              <video
                ref={video}
                key={`${parte.id}-${intento}`}
                src={urlVideoSala(courseUuid, parte.id, intento)}
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full"
                onClick={alternar}
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
              ) : cargando ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-white/80" />
                </div>
              ) : null}
              {varias ? (
                <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[12px] font-semibold text-white">
                  Parte {iParte + 1} de {listas.length}
                </span>
              ) : null}
              {enCorte >= 0 && !error ? (
                <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[12px] font-semibold text-white">
                  Esto está cortado: los alumnos no lo ven
                </span>
              ) : null}
            </div>
          </div>

          {/* Mandos */}
          <div className="rounded-xl border border-[#E2E8F4] bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => irA(t - 5)} className={BOTON} aria-label="5 segundos atrás" title="5 segundos atrás (←)">
                <SkipBack size={15} />
              </button>
              <button
                onClick={alternar}
                className="inline-flex h-9 w-12 items-center justify-center rounded-lg bg-[#0b2da0] text-white hover:bg-[#0a2690]"
                aria-label={sonando ? 'Pausar' : 'Reproducir'}
                title="Reproducir o pausar (espacio)"
              >
                {sonando ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
              </button>
              <button onClick={() => irA(t + 5)} className={BOTON} aria-label="5 segundos adelante" title="5 segundos adelante (→)">
                <SkipForward size={15} />
              </button>
              <span className="mx-1 text-[14px] font-semibold tabular-nums text-[#0B1033]">
                {reloj(t, conHoras)} <span className="font-normal text-[#8A91AD]">/ {reloj(total, conHoras)}</span>
              </span>
              {hora ? (
                <span className="text-[12.5px] text-[#6B7393]" title="La hora del reloj de ese momento de la clase">
                  · en la sala eran las <b className="font-semibold text-[#3F4A61]">{hora}</b>
                </span>
              ) : null}
              <label className="ml-auto flex items-center gap-2 text-[13px] text-[#3F4A61] cursor-pointer">
                <input type="checkbox" checked={previa} onChange={(e) => setPrevia(e.target.checked)} className="h-4 w-4 accent-[#0b2da0]" />
                Ver cómo queda
              </label>
            </div>

            {/* Línea de tiempo */}
            <div ref={carril} className="mt-3 overflow-x-auto overscroll-x-contain rounded-lg border border-[#E2E8F4] bg-[#F7F9FD]" style={{ touchAction: 'pan-x' }}>
              <div
                ref={pista}
                className="relative h-[112px] cursor-pointer select-none"
                style={{ width: anchoPista, touchAction: 'none' }}
                onPointerDown={alPulsar}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onPointerCancel={alSoltar}
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
                <div className="absolute inset-x-0 top-[50px] h-11 rounded bg-[#0b2da0]/85" />
                {/* Dónde empieza cada parte */}
                {varias
                  ? etiquetas.map((e, i) => (
                      <div key={listas[i].id} className="pointer-events-none absolute top-6 bottom-0 border-l-2 border-[#0B1033]/70" style={{ left: e.x }}>
                        {e.cabe ? (
                          <span className="absolute left-1 top-1 whitespace-nowrap rounded bg-white/90 px-1 text-[10.5px] font-semibold text-[#0B1033]">{e.texto}</span>
                        ) : null}
                      </div>
                    ))
                  : null}
                {/* Lo cortado */}
                {cortes.map(([a, b], i) => (
                  <div
                    key={`${a}-${b}`}
                    className="absolute top-[50px] h-11 bg-[#EEF1F7]"
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
                  <div className="absolute top-[46px] h-[60px] border-l-2 border-[#C2362F]" style={{ left: marcaA * px }}>
                    <span className="absolute -top-3 left-1 text-[10px] font-bold text-[#C2362F]">INICIO</span>
                  </div>
                ) : null}
                {marcaB !== null ? (
                  <div className="absolute top-[46px] h-[60px] border-l-2 border-[#C2362F]" style={{ left: marcaB * px }}>
                    <span className="absolute -top-3 right-1 text-[10px] font-bold text-[#C2362F]">FIN</span>
                  </div>
                ) : null}
                {marcado ? (
                  <div
                    className="absolute top-[50px] h-11 bg-[#C2362F]/35"
                    style={{ left: Math.min(marcaA!, marcaB!) * px, width: Math.abs(marcaB! - marcaA!) * px }}
                  />
                ) : null}
                {/* Cabezal */}
                <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-[#F5A524]" style={{ left: Math.max(0, t * px - 1) }}>
                  <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-[#F5A524]" />
                </div>
              </div>
            </div>

            {/* Principio y final: lo primero que se hace */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={empiezaAqui} className={BOTON_FUERTE} title="Se quita todo lo de antes de este punto">
                <ChevronsRight size={16} /> Empieza aquí
              </button>
              <button onClick={terminaAqui} className={BOTON_FUERTE} title="Se quita todo lo de después de este punto">
                Termina aquí <ChevronsLeft size={16} />
              </button>
              <span className="text-[12px] text-[#6B7393]">
                En el punto naranja{hora ? ` (${hora})` : ''}. Lo que se quita queda rayado.
              </span>
            </div>

            {/* Zoom */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[12px] text-[#6B7393]">Zoom</span>
              <button onClick={() => ponerZoom(zoom / 1.6)} disabled={zoom <= 1} className={`${BOTON} h-8 w-8 px-0`} aria-label="Alejar" title="Alejar (−)">
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={zoomMax > 1 ? Math.round((Math.log(zoom) / Math.log(zoomMax)) * 100) : 0}
                onChange={(e) => ponerZoom(Math.pow(zoomMax, Number(e.target.value) / 100))}
                disabled={zoomMax <= 1}
                aria-label="Zoom de la línea de tiempo"
                className="h-1.5 w-28 sm:w-44 cursor-pointer accent-[#0b2da0]"
              />
              <button onClick={() => ponerZoom(zoom * 1.6)} disabled={zoom >= zoomMax} className={`${BOTON} h-8 w-8 px-0`} aria-label="Acercar" title="Acercar (+)">
                <Plus size={14} />
              </button>
              <span className="hidden sm:inline text-[11.5px] text-[#8A91AD]">Toca o arrastra en la línea para moverte</span>
            </div>

            {/* Quitar un trozo de en medio */}
            <div className="mt-4 rounded-lg border border-[#E2E8F4] p-3">
              <p className="text-[12.5px] font-semibold text-[#0B1033]">Quitar un trozo de en medio</p>
              <p className="mt-0.5 text-[12px] text-[#6B7393]">Marca dónde empieza y dónde acaba lo que sobra (una pausa, un fallo). Puede pasar de una parte a otra.</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button onClick={marcarInicio} className={BOTON} title="Tecla I">
                  Inicio{marcaA !== null ? ` · ${reloj(marcaA, conHoras)}` : ''}
                </button>
                <button onClick={marcarFin} className={BOTON} title="Tecla O">
                  Fin{marcaB !== null ? ` · ${reloj(marcaB, conHoras)}` : ''}
                </button>
                <button
                  onClick={quitarTrozo}
                  disabled={!marcado}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#C2362F] text-[13px] font-semibold text-white hover:bg-[#A92D27] disabled:opacity-40"
                >
                  <Scissors size={14} /> Quitar este trozo
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

            {/* Los cortes */}
            {cortes.length ? (
              <div className="mt-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A91AD]">Lo que se quita</p>
                <ul className="mt-1.5 divide-y divide-[#EEF2F9] rounded-lg border border-[#E2E8F4]">
                  {cortes.map((c, i) => {
                    const n = nombreDelCorte(c)
                    return (
                      <li key={`${c[0]}-${c[1]}`} className="flex items-center gap-3 px-3 py-2">
                        <button onClick={() => irA(c[0])} className="min-w-0 flex-1 text-left text-[13px] text-[#0B1033] hover:text-[#0b2da0]">
                          <span className="font-semibold">{n.titulo}</span>
                          <span className="tabular-nums text-[#6B7393]"> · {n.detalle}</span>
                        </button>
                        <button onClick={() => ponerCortes(sinCorte(cortes, i))} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0b2da0] hover:underline">
                          <Undo2 size={13} /> Deshacer
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 hidden sm:block text-[11.5px] text-[#8A91AD]">
              Teclas: espacio reproduce · ← → mueven 5 s (con Mayús, 1 s) · I y O marcan el inicio y el fin del trozo · + y − cambian el zoom.
            </p>
          </div>
        </div>
      </div>

      {/* Publicar */}
      <div className="border-t border-[#E2E8F4] bg-white px-3 sm:px-6 py-3">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 sm:flex-row sm:items-center">
          <p className="text-[13.5px] text-[#0B1033] sm:flex-1">
            Queda <b>{duracionCorta(queda)}</b>
            <span className="text-[#6B7393]"> de {duracionCorta(total)}</span>
          </p>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={160}
            placeholder="Título (opcional)"
            className="h-10 rounded-lg border border-[#D5DEEE] px-3 text-[13.5px] text-[#0B1033] outline-none focus:border-[#0b2da0] sm:w-48"
          />
          <select
            value={semanaId ?? ''}
            onChange={(e) => setSemanaId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Semana en la que se publica"
            className="h-10 rounded-lg border border-[#D5DEEE] bg-white px-2.5 text-[13.5px] text-[#0B1033] outline-none focus:border-[#0b2da0] sm:max-w-[260px]"
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0b2da0] px-5 text-[14px] font-semibold text-white hover:bg-[#0a2690] disabled:opacity-50"
          >
            {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
            {semana ? `Publicar en «${semana.tema || 'la semana'}»` : 'Publicar'}
          </button>
        </div>
        {!semanas.length ? (
          <p className="mx-auto mt-1.5 w-full max-w-5xl text-[12px] text-[#8A6A2A]">Esta clase aún no tiene semanas: crea la semana de ese día y vuelve para publicar.</p>
        ) : semana?.subida ? (
          <p className="mx-auto mt-1.5 w-full max-w-5xl text-[12px] text-[#8A6A2A]">
            Esa semana ya tiene una grabación subida a mano: los alumnos seguirán viendo esa, no esta.
          </p>
        ) : null}
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
