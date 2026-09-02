'use client'

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote, Trash2, X, Check } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  type LessonHighlight,
  listHighlightsForActivity,
  createHighlight,
  deleteHighlight,
} from '@services/student/highlights'

/**
 * Subrayar y anotar un texto de la formación.
 *
 * Por qué existe teniendo ya `HighlightLayer`: aquel subraya las lecciones
 * escritas con el editor del panel, y se ancla por posiciones de ProseMirror.
 * Las lecciones de holandés no son eso — son cadenas de texto de `courseData.ts`
 * pintadas por `LessonViewer`, donde ProseMirror no existe. Durante meses
 * "subrayar" no hacía nada justo en las lecciones donde está todo el contenido.
 *
 * Aquí el ancla es mucho más simple: **el número de carácter dentro de la
 * cadena**. Se guarda en las mismas columnas (`pm_from`/`pm_to`) y en la misma
 * tabla, así que "Mis notas" lo recoge sin cambiar nada. `block_key` distingue
 * los varios textos de una misma clase (el neerlandés y su traducción), que si
 * no se repintarían el uno encima del otro.
 *
 * Red de seguridad: al pintar se comprueba que el texto guardado siga estando
 * en esa posición. Si mañana se edita la lección y los números bailan, el
 * resaltado no se pinta en el sitio equivocado — simplemente no se pinta.
 */

const ORDEN_COLORES: HighlightColor[] = ['yellow', 'pink', 'blue', 'green']
/** Menos de esto no es subrayar, es un clic que arrastró un poco. */
const MINIMO_CARACTERES = 2

type Contexto = {
  courseUuid?: string
  activityUuid?: string
  nombre?: string
  /** La lista de la clase entera, cargada UNA vez arriba. */
  lista?: LessonHighlight[]
  anadir?: (h: LessonHighlight) => void
  quitar?: (id: number) => void
}

/**
 * Curso y clase donde se está leyendo, puesto una vez arriba.
 *
 * Va por contexto y no por props porque los textos viven dentro de secciones
 * (`ResumenSection`, `LezenSection`) que no tienen ni pintan nada de esto: había
 * que atravesar tres componentes con un dato que ninguno usa.
 */
export const ContextoResaltado = React.createContext<Contexto | null>(null)

/**
 * Carga los resaltados de la clase UNA sola vez y los reparte.
 *
 * Antes cada `TextoResaltable` pedía la lista por su cuenta. Con la intro, los
 * objetivos, el cuerpo de cada sección, el consejo y ahora las filas de las
 * tablas, una lección puede tener treinta trozos subrayables: eran treinta
 * peticiones idénticas al abrir la clase. Ahora se pide una y cada trozo se
 * queda con lo suyo filtrando por `block_key`.
 */
export function ProveedorResaltado({
  courseUuid,
  activityUuid,
  nombre,
  children,
}: {
  courseUuid?: string
  activityUuid?: string
  nombre?: string
  children: React.ReactNode
}) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const [lista, setLista] = useState<LessonHighlight[]>([])

  useEffect(() => {
    if (!accessToken || !activityUuid) {
      setLista([])
      return
    }
    let vivo = true
    listHighlightsForActivity(activityUuid, accessToken).then((l) => {
      if (vivo) setLista(l)
    })
    return () => {
      vivo = false
    }
  }, [activityUuid, accessToken])

  const valor = useMemo<Contexto>(
    () => ({
      courseUuid,
      activityUuid,
      nombre,
      lista,
      anadir: (h) => setLista((prev) => [...prev, h]),
      quitar: (id) => setLista((prev) => prev.filter((x) => x.id !== id)),
    }),
    [courseUuid, activityUuid, nombre, lista]
  )

  return <ContextoResaltado.Provider value={valor}>{children}</ContextoResaltado.Provider>
}

/**
 * Separa el `**negrita**` del texto y devuelve el texto limpio con sus tramos.
 *
 * Esto es lo que faltaba para poder subrayar el cuerpo de las secciones del
 * Samenvatting: 94 de los 112 textos llevan negritas, así que sin esto había
 * que elegir entre pintar la negrita o poder subrayar. Los asteriscos NO
 * llegan al DOM, así que las posiciones se cuentan sobre el texto limpio y
 * `posicionEnTexto` sigue cuadrando sin tocar nada.
 */
function partirNegritas(bruto: string): { plano: string; negritas: [number, number][] } {
  const negritas: [number, number][] = []
  let plano = ''
  let ultimo = 0
  const re = /\*\*([^*]+)\*\*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(bruto))) {
    plano += bruto.slice(ultimo, m.index)
    const desde = plano.length
    plano += m[1]
    negritas.push([desde, plano.length])
    ultimo = m.index + m[0].length
  }
  plano += bruto.slice(ultimo)
  return { plano, negritas }
}

/** En qué carácter del contenedor cae este punto del DOM. */
function posicionEnTexto(contenedor: HTMLElement, nodo: Node, offset: number): number | null {
  let total = 0
  const paseador = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT)
  let actual: Node | null
  while ((actual = paseador.nextNode())) {
    if (actual === nodo) return total + offset
    total += (actual.textContent || '').length
  }
  // La selección puede terminar en el propio contenedor en vez de en un texto.
  if (nodo === contenedor) return Math.min(offset, total)
  return null
}

export default function TextoResaltable({
  texto,
  bloque,
  contexto: contextoProp,
  className,
}: {
  texto: string
  /** Qué texto de la clase es: `resumen`, `lezen_nl`, `lezen_es`… */
  bloque: string
  contexto?: Contexto
  className?: string
}) {
  const heredado = useContext(ContextoResaltado)
  const contexto = contextoProp ?? heredado ?? undefined
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const activityUuid = contexto?.activityUuid || ''
  const contenedorRef = useRef<HTMLParagraphElement | null>(null)

  const compartida = contexto?.lista
  const [propios, setPropios] = useState<LessonHighlight[]>([])
  const [menu, setMenu] = useState<{ top: number; left: number; desde: number; hasta: number; cita: string } | null>(null)
  const [redactando, setRedactando] = useState<{ desde: number; hasta: number; cita: string; color: HighlightColor; nota: string } | null>(null)
  const [abierto, setAbierto] = useState<{ top: number; left: number; hl: LessonHighlight } | null>(null)

  // Fuera del curso (la app de ejercicios suelta) no hay clase a la que colgar
  // el resaltado, así que el texto se pinta y ya.
  const activo = !!accessToken && !!activityUuid

  // Sin proveedor arriba (otro sitio que use el componente suelto) se sigue
  // pidiendo por cuenta propia: así nunca deja de funcionar.
  useEffect(() => {
    if (!activo || compartida) return
    let vivo = true
    listHighlightsForActivity(activityUuid, accessToken).then((lista) => {
      if (vivo) setPropios(lista)
    })
    return () => {
      vivo = false
    }
  }, [activo, compartida, activityUuid, accessToken])

  const resaltados = useMemo(
    () => (compartida ?? propios).filter((h) => (h.block_key || '') === bloque),
    [compartida, propios, bloque]
  )

  const { plano, negritas } = useMemo(() => partirNegritas(texto), [texto])

  /** El texto partido en trozos: los subrayados y lo que hay entre ellos. */
  const trozos = useMemo(() => {
    const orden = [...resaltados].sort((a, b) => a.pm_from - b.pm_from)
    const salida: { desde: number; texto: string; hl?: LessonHighlight }[] = []
    let cursor = 0
    for (const h of orden) {
      const desde = Math.max(0, Math.min(h.pm_from, plano.length))
      const hasta = Math.max(desde, Math.min(h.pm_to, plano.length))
      // Se solapa con el anterior, o el texto de la lección ya no es el que se
      // subrayó. En los dos casos, mejor no pintar que pintar donde no es.
      if (desde < cursor || hasta <= desde) continue
      if (plano.slice(desde, hasta) !== h.quote) continue
      if (desde > cursor) salida.push({ desde: cursor, texto: plano.slice(cursor, desde) })
      salida.push({ desde, texto: plano.slice(desde, hasta), hl: h })
      cursor = hasta
    }
    if (cursor < plano.length) salida.push({ desde: cursor, texto: plano.slice(cursor) })
    return salida
  }, [plano, resaltados])

  /** Pinta un trozo respetando las negritas que le caen dentro. */
  const conNegritas = useCallback(
    (trozo: string, inicio: number): React.ReactNode => {
      const fin = inicio + trozo.length
      const dentro = negritas.filter(([a, b]) => b > inicio && a < fin)
      if (!dentro.length) return trozo
      const salida: React.ReactNode[] = []
      let cursor = inicio
      dentro.forEach(([a, b], i) => {
        const ini = Math.max(a, inicio)
        const f = Math.min(b, fin)
        if (ini > cursor) salida.push(<React.Fragment key={`t${i}`}>{plano.slice(cursor, ini)}</React.Fragment>)
        salida.push(
          <strong key={`b${i}`} className="font-bold text-gray-900">
            {plano.slice(ini, f)}
          </strong>
        )
        cursor = f
      })
      if (cursor < fin) salida.push(<React.Fragment key="fin">{plano.slice(cursor, fin)}</React.Fragment>)
      return salida
    },
    [plano, negritas]
  )

  const alSoltar = useCallback(() => {
    if (!activo) return
    const contenedor = contenedorRef.current
    const sel = window.getSelection()
    if (!contenedor || !sel || sel.isCollapsed || sel.rangeCount === 0) return

    const rango = sel.getRangeAt(0)
    if (!contenedor.contains(rango.commonAncestorContainer)) return

    const a = posicionEnTexto(contenedor, rango.startContainer, rango.startOffset)
    const b = posicionEnTexto(contenedor, rango.endContainer, rango.endOffset)
    if (a === null || b === null) return

    const desde = Math.min(a, b)
    const hasta = Math.max(a, b)
    if (hasta - desde < MINIMO_CARACTERES) return

    const caja = rango.getBoundingClientRect()
    setMenu({
      top: caja.top - 8,
      left: caja.left + caja.width / 2,
      desde,
      hasta,
      cita: plano.slice(desde, hasta),
    })
  }, [activo, plano])

  // Al tocar en otro sitio se cierra el menú, como cualquier menú flotante.
  useEffect(() => {
    if (!menu) return
    const cerrar = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-menu-resaltado]')) return
      setMenu(null)
    }
    // En el mismo tick se cerraría con el clic que lo abrió.
    const id = window.setTimeout(() => document.addEventListener('mousedown', cerrar), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', cerrar)
    }
  }, [menu])

  async function guardar(color: HighlightColor, nota: string, desde: number, hasta: number, cita: string) {
    setMenu(null)
    setRedactando(null)
    window.getSelection()?.removeAllRanges()
    const creado = await createHighlight(
      {
        activity_uuid: activityUuid,
        activity_name: contexto?.nombre || '',
        course_uuid: contexto?.courseUuid || '',
        block_key: bloque,
        color,
        quote: cita,
        note: nota,
        pm_from: desde,
        pm_to: hasta,
      },
      accessToken
    )
    if (!creado) return
    if (contexto?.anadir) contexto.anadir(creado)
    else setPropios((prev) => [...prev, creado])
  }

  async function borrar(id: number) {
    setAbierto(null)
    if (contexto?.quitar) contexto.quitar(id)
    else setPropios((prev) => prev.filter((h) => h.id !== id))
    await deleteHighlight(id, accessToken)
  }

  const menuFlotante =
    menu && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-menu-resaltado
            className="fixed z-[10000] -translate-x-1/2 -translate-y-full flex items-center gap-1 bg-white rounded-xl shadow-xl border border-[#DDE6F5] px-2 py-1.5"
            style={{ top: menu.top, left: menu.left }}
          >
            {ORDEN_COLORES.map((c) => (
              <button
                key={c}
                type="button"
                title={HIGHLIGHT_COLORS[c].label}
                aria-label={HIGHLIGHT_COLORS[c].label}
                onClick={() => guardar(c, '', menu.desde, menu.hasta, menu.cita)}
                className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: HIGHLIGHT_COLORS[c].bg }}
              />
            ))}
            <span className="w-px h-5 bg-[#DDE6F5] mx-0.5" />
            <button
              type="button"
              onClick={() =>
                setRedactando({ desde: menu.desde, hasta: menu.hasta, cita: menu.cita, color: 'yellow', nota: '' })
              }
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12.5px] font-semibold text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
            >
              <StickyNote size={14} />
              Nota
            </button>
          </div>,
          document.body
        )
      : null

  const redactor =
    redactando && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[10001] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setRedactando(null)}
          >
            <div
              className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[13px] text-[#5A6480] leading-relaxed line-clamp-3">
                  «{redactando.cita}»
                </p>
                <button
                  type="button"
                  onClick={() => setRedactando(null)}
                  aria-label="Cerrar"
                  className="shrink-0 text-gray-400 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {ORDEN_COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={HIGHLIGHT_COLORS[c].label}
                    onClick={() => setRedactando({ ...redactando, color: c })}
                    className={`w-7 h-7 rounded-full border transition-transform ${
                      redactando.color === c ? 'border-[#025dc7] scale-110' : 'border-black/10'
                    }`}
                    style={{ backgroundColor: HIGHLIGHT_COLORS[c].bg }}
                  />
                ))}
              </div>

              <textarea
                autoFocus
                value={redactando.nota}
                onChange={(e) => setRedactando({ ...redactando, nota: e.target.value })}
                rows={3}
                placeholder="Escribe tu nota…"
                className="w-full bg-[#F0F5FF] rounded-xl px-3 py-2.5 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors resize-y"
              />

              <button
                type="button"
                onClick={() =>
                  guardar(redactando.color, redactando.nota.trim(), redactando.desde, redactando.hasta, redactando.cita)
                }
                className="mt-3 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold text-[15px] transition-colors"
              >
                <Check size={16} strokeWidth={2.5} />
                Guardar
              </button>
            </div>
          </div>,
          document.body
        )
      : null

  const visor =
    abierto && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[10000]" onClick={() => setAbierto(null)}>
            <div
              className="absolute -translate-x-1/2 -translate-y-full max-w-[300px] bg-white rounded-xl shadow-xl border border-[#DDE6F5] p-3"
              style={{ top: abierto.top, left: abierto.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {abierto.hl.note ? (
                <p className="text-[13.5px] text-gray-800 leading-relaxed whitespace-pre-line mb-2">
                  {abierto.hl.note}
                </p>
              ) : (
                <p className="text-[13px] text-gray-400 mb-2">Sin nota.</p>
              )}
              <button
                type="button"
                onClick={() => borrar(abierto.hl.id)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600 hover:text-rose-700"
              >
                <Trash2 size={14} />
                Quitar el subrayado
              </button>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <p ref={contenedorRef} className={className} onMouseUp={alSoltar} onTouchEnd={alSoltar}>
        {trozos.map((t, i) =>
          t.hl ? (
            <mark
              key={i}
              onClick={(e) => {
                const caja = (e.target as HTMLElement).getBoundingClientRect()
                setAbierto({ top: caja.top - 6, left: caja.left + caja.width / 2, hl: t.hl! })
              }}
              className="rounded-[3px] cursor-pointer"
              style={{ backgroundColor: HIGHLIGHT_COLORS[t.hl.color]?.bg || '#FEF3C7', color: 'inherit' }}
            >
              {conNegritas(t.texto, t.desde)}
              {!!t.hl.note && <StickyNote size={12} className="inline-block ml-0.5 -mt-0.5 text-[#025dc7]" />}
            </mark>
          ) : (
            <React.Fragment key={i}>{conNegritas(t.texto, t.desde)}</React.Fragment>
          )
        )}
      </p>
      {menuFlotante}
      {redactor}
      {visor}
    </>
  )
}
