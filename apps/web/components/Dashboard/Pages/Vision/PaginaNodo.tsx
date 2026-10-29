'use client'

/**
 * La página de una tarjeta de Visión, en un panel lateral (doble clic en la
 * tarjeta, o clic en el tablero): como una página de Notion. Propiedades
 * arriba (estado, Urgente / Importante, encargados, fechas, etiquetas), el
 * texto con formato, la lista de tareas, los enlaces y los archivos.
 *
 * Se guarda sola: lo que se escribe, a los 0,7 s de dejar de escribir; lo que
 * se elige (estado, urgente…), al momento. Al cerrar se guarda lo que quede.
 *
 * 29/10: en una tarjeta de correo se elige cuál de la campaña de Black
 * Friday es, se ve tal cual llega y se va a cambiar su texto (Avisos); en una
 * métrica, además de las campañas, «Black Friday · en vivo».
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { getLinkExtension } from '@components/Objects/Editor/EditorConf'
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  X,
  Trash2,
  Plus,
  Paperclip,
  Loader2,
  ExternalLink,
  ArrowRight,
  BarChart3,
  Check,
  CopyPlus,
  MapPin,
  Eye,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import {
  ESTADOS,
  TIPOS,
  abrirArchivo,
  borrarArchivo,
  borrarNodo,
  cambiarNodo,
  FUENTE_BF,
  getBlackFriday,
  getTrabajo,
  type DatosBF,
  subirArchivo,
  type MetricaInfo,
  type NodoVision,
  type TipoNodo,
} from '@services/vision/vision'
import { BOTON, BOTON_PELIGRO, META } from '../Panel/ui'
import Personas from './Personas'
import VistaCorreo, { EDITAR_CORREOS } from '../Panel/VistaCorreo'

const CAMPO =
  'w-full h-8 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13px] text-gray-900 outline-none focus:border-gray-900'
const ETIQUETA = 'text-[12.5px] text-[#6B7280] pt-1.5'

function tamano(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function cuerpoInicial(texto: string) {
  if (!texto) return ''
  try {
    return JSON.parse(texto)
  } catch {
    return texto
  }
}

export default function PaginaNodo({
  orgId,
  token,
  nodo: inicial,
  campanas,
  metricas,
  onCambio,
  onBorrado,
  onAbrirMapa,
  onVerCampana,
  onClose,
  nueva = false,
  personas,
  onVerEnMapa,
}: {
  orgId: number
  token: string
  nodo: NodoVision
  /** Las campañas que hay (para las tarjetas de métrica). */
  campanas: { id: number; titulo: string }[]
  metricas: Record<string, MetricaInfo>
  onCambio: (n: NodoVision) => void
  onBorrado: (id: number) => void
  onAbrirMapa: (n: NodoVision, nuevaPestana: boolean) => void
  onVerCampana: (n: NodoVision) => void
  onClose: () => void
  /** Recién creada: el título viene seleccionado para escribir encima. */
  nueva?: boolean
  /** Nombres que proponer como encargados. Sin ellos, se piden al abrir. */
  personas?: string[]
  /** Desde el tablero: un botón para ver la tarjeta en su mapa. */
  onVerEnMapa?: (n: NodoVision) => void
}) {
  const [n, setN] = useState<NodoVision>(inicial)
  // Los correos y cifras de Black Friday: solo si la tarjeta los puede usar.
  const [bf, setBf] = useState<DatosBF | null>(null)
  const [verCorreo, setVerCorreo] = useState(false)
  useEffect(() => {
    if (n.tipo !== 'correo' && n.tipo !== 'metrica') return
    if (bf) return
    getBlackFriday(orgId, token).then((r) => r.ok && r.datos && setBf(r.datos))
  }, [n.tipo, bf, orgId, token])
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [nuevoEnlace, setNuevoEnlace] = useState({ titulo: '', url: '' })
  const [etiquetasTexto, setEtiquetasTexto] = useState(inicial.etiquetas.join(', '))
  const [nombres, setNombres] = useState<string[]>(personas ?? [])
  const pendiente = useRef<Partial<NodoVision>>({})
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  // Por referencia: si no, cada vez que el mapa se vuelve a pintar se
  // guardaría a destiempo lo que se está escribiendo.
  const onCambioRef = useRef(onCambio)
  onCambioRef.current = onCambio

  // Desde el mapa no se sabe quién hay: se piden los nombres una vez.
  useEffect(() => {
    if (personas) return setNombres(personas)
    let vivo = true
    getTrabajo(orgId, token).then((r) => vivo && r.ok && r.datos && setNombres(r.datos.personas))
    return () => {
      vivo = false
    }
  }, [personas, orgId, token])

  // Si cambia la tarjeta abierta (otra), se empieza de cero.
  useEffect(() => {
    setN(inicial)
    setEtiquetasTexto(inicial.etiquetas.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial.id])

  const enviar = useCallback(async () => {
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = null
    const cambios = pendiente.current
    pendiente.current = {}
    if (!Object.keys(cambios).length) return
    setGuardando(true)
    const r = await cambiarNodo(orgId, n.id, cambios, token)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    onCambioRef.current(r.datos)
  }, [orgId, n.id, token])

  /** Cambia en pantalla y guarda: al momento, o tras dejar de escribir. */
  const poner = useCallback(
    (cambios: Partial<NodoVision>, despacio = false) => {
      setN((v) => ({ ...v, ...cambios }))
      pendiente.current = { ...pendiente.current, ...cambios }
      if (reloj.current) clearTimeout(reloj.current)
      reloj.current = setTimeout(enviar, despacio ? 700 : 0)
    },
    [enviar]
  )

  // Al cerrar o cambiar de tarjeta, lo que quede por guardar.
  useEffect(() => () => void enviar(), [enviar])

  const cerrar = useCallback(async () => {
    await enviar()
    onClose()
  }, [enviar, onClose])

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [cerrar])

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ codeBlock: false, link: false }),
        getLinkExtension(),
        Placeholder.configure({ placeholder: 'Escribe aquí lo que hay que saber: el plan, lo hablado, ideas…' }),
      ],
      content: cuerpoInicial(inicial.cuerpo),
      editorProps: { attributes: { class: 'vision-cuerpo outline-none min-h-[140px] text-[14px] leading-relaxed text-gray-900' } },
      onUpdate: ({ editor: e }) => poner({ cuerpo: JSON.stringify(e.getJSON()) }, true),
    },
    [inicial.id]
  )

  const btn = (activo: boolean) =>
    `w-8 h-8 rounded-md flex items-center justify-center transition-colors ${activo ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-[#F3F4F6]'}`

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return
    setSubiendo(true)
    for (const a of Array.from(archivos)) {
      const r = await subirArchivo(orgId, n.id, a, token)
      if (!r.ok || !r.datos) toast.error(`${a.name}: ${r.error || 'no se ha podido subir'}`)
      else {
        setN((v) => ({ ...v, archivos: r.datos!.archivos }))
        onCambio(r.datos)
      }
    }
    setSubiendo(false)
    if (archivoRef.current) archivoRef.current.value = ''
  }

  async function abrir(id: string) {
    const url = await abrirArchivo(orgId, n.id, id, token)
    if (!url) return toast.error('No se ha podido abrir')
    window.open(url, '_blank', 'noopener')
  }

  async function quitarArchivo(id: string, nombre: string) {
    if (!(await confirmar(`¿Quitar «${nombre}»? Se borra el archivo.`, { boton: 'Quitar', peligro: true }))) return
    const r = await borrarArchivo(orgId, n.id, id, token)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido quitar')
    setN((v) => ({ ...v, archivos: r.datos!.archivos }))
    onCambio(r.datos)
  }

  async function borrar() {
    const extra =
      n.tipo === 'campana'
        ? ' También sus datos, sus pagos apuntados y todo su mapa de dentro.'
        : n.submapa_id
          ? ' También todo su mapa de dentro.'
          : ''
    if (!(await confirmar(`¿Borrar «${n.titulo || 'esta tarjeta'}»?${extra} No se puede deshacer.`, { boton: 'Borrar', peligro: true }))) return
    pendiente.current = {}
    const r = await borrarNodo(orgId, n.id, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    toast.success('Borrada')
    onBorrado(n.id)
  }

  const tipoActual = useMemo(() => TIPOS.find((t) => t.id === n.tipo) ?? TIPOS[0], [n.tipo])

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={cerrar} className="absolute inset-0 bg-black/20" />
      <div className="relative h-full w-full sm:max-w-[620px] bg-white border-l border-[#E5E7EB] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#F3F4F6] px-5 sm:px-7 py-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tipoActual.color }} />
            {tipoActual.nombre}
          </span>
          <span className={`${META} ml-1`}>{guardando ? 'Guardando…' : 'Guardado'}</span>
          <div className="flex-1" />
          <button onClick={cerrar} aria-label="Cerrar" className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 sm:px-7 pt-5 pb-10 space-y-6">
          <input
            value={n.titulo}
            onChange={(e) => poner({ titulo: e.target.value }, true)}
            placeholder="Sin título"
            className="w-full text-[26px] sm:text-[30px] font-bold text-gray-900 outline-none placeholder:text-[#D1D5DB]"
            autoFocus={nueva || !n.titulo}
            onFocus={(e) => nueva && e.target.select()}
          />

          {/* Propiedades, como en Notion. */}
          <div className="grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
            <span className={ETIQUETA}>Tipo</span>
            <select value={n.tipo} onChange={(e) => poner({ tipo: e.target.value as TipoNodo })} className={CAMPO}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>

            <span className={ETIQUETA}>Estado</span>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => poner({ estado: e.id })}
                  className={`h-8 px-2.5 rounded-md border text-[12.5px] font-medium transition-colors ${
                    n.estado === e.id ? 'bg-gray-900 border-gray-900 text-white' : 'border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
                  }`}
                >
                  {e.nombre}
                </button>
              ))}
            </div>

            <span className={ETIQUETA}>Prioridad</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => poner({ urgente: !n.urgente })}
                className={`h-8 px-2.5 rounded-md border text-[12.5px] font-semibold transition-colors ${
                  n.urgente ? 'bg-[#DC2626] border-[#DC2626] text-white' : 'border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
                }`}
              >
                Urgente
              </button>
              <button
                onClick={() => poner({ importante: !n.importante })}
                className={`h-8 px-2.5 rounded-md border text-[12.5px] font-semibold transition-colors ${
                  n.importante ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
                }`}
              >
                Importante
              </button>
              <span className={`${META} self-center`}>
                {n.urgente && n.importante
                  ? 'Hazlo ya'
                  : n.urgente
                    ? 'Hazlo pronto o delégalo'
                    : n.importante
                      ? 'Ponle fecha'
                      : ''}
              </span>
            </div>

            <span className={ETIQUETA}>Encargados</span>
            <Personas valor={n.responsable} onCambio={(texto) => poner({ responsable: texto })} sugerencias={nombres} placeholder="Quién se encarga: escribe el nombre y pulsa Intro" />

            <span className={ETIQUETA}>Fechas</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['inicio', 'Empieza'],
                  ['fin', 'Termina'],
                  ['vence', 'Vence'],
                ] as const
              ).map(([campo, texto]) => (
                <label key={campo} className="block">
                  <span className="block text-[11px] text-[#9CA3AF]">{texto}</span>
                  <input type="date" value={n[campo]} onChange={(e) => poner({ [campo]: e.target.value } as Partial<NodoVision>)} className={CAMPO} />
                </label>
              ))}
            </div>

            <span className={ETIQUETA}>Etiquetas</span>
            <input
              value={etiquetasTexto}
              onChange={(e) => {
                setEtiquetasTexto(e.target.value)
                poner(
                  {
                    etiquetas: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                  true
                )
              }}
              placeholder="ugc, youtube, legal (separadas por comas)"
              className={CAMPO}
            />

            {n.tipo === 'campana' ? (
              <>
                <span className={ETIQUETA}>utm_campaign</span>
                <div>
                  <input
                    value={n.utm_campaign}
                    onChange={(e) => poner({ utm_campaign: e.target.value }, true)}
                    placeholder="vsl-matricula-oct26"
                    className={CAMPO}
                  />
                  <p className={`${META} mt-1`}>
                    El mismo valor que lleva el enlace del anuncio. Con él, la escuela pone sola los leads, las llamadas y las ventas.
                  </p>
                </div>
              </>
            ) : null}

            {n.tipo === 'metrica' ? (
              <>
                <span className={ETIQUETA}>Cifra</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={n.metrica.fuente === FUENTE_BF ? 'bf' : (n.metrica.campana_id ?? '')}
                    onChange={(e) =>
                      // De una fuente a otra, la cifra se vuelve a elegir: no se llaman igual.
                      poner({
                        metrica:
                          e.target.value === 'bf'
                            ? { fuente: FUENTE_BF, clave: '' }
                            : { campana_id: Number(e.target.value) || 0, clave: n.metrica.fuente === FUENTE_BF ? '' : n.metrica.clave },
                      })
                    }
                    className={CAMPO}
                  >
                    <option value="">Campaña…</option>
                    <option value="bf">Black Friday · en vivo</option>
                    {campanas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titulo}
                      </option>
                    ))}
                  </select>
                  <select value={n.metrica.clave ?? ''} onChange={(e) => poner({ metrica: { ...n.metrica, clave: e.target.value } })} className={CAMPO}>
                    <option value="">Cifra…</option>
                    {n.metrica.fuente === FUENTE_BF ? (
                      Object.entries(bf?.nombres ?? {}).map(([clave, nombre]) => (
                        <option key={clave} value={clave}>
                          {nombre}
                        </option>
                      ))
                    ) : (
                      <>
                        {Object.entries(metricas).map(([clave, m]) => (
                          <option key={clave} value={clave}>
                            {m.nombre}
                          </option>
                        ))}
                        <option value="leads">Leads</option>
                        <option value="ventas">Ventas</option>
                        <option value="ingresos_cents">Cobrado</option>
                        <option value="coste_cents">Gastado</option>
                      </>
                    )}
                  </select>
                </div>
              </>
            ) : null}

            {n.tipo === 'correo' ? (
              <>
                <span className={ETIQUETA}>Correo</span>
                <div>
                  <select value={n.metrica.correo ?? ''} onChange={(e) => poner({ metrica: { correo: e.target.value } })} className={CAMPO}>
                    <option value="">Elige el correo…</option>
                    {[
                      { grupo: 'sin_comprar', nombre: 'A quien no compró el ebook' },
                      { grupo: 'compradores', nombre: 'A quien compró el ebook' },
                      { grupo: '', nombre: 'Newsletters (systeme.io)' },
                    ].map((g) => (
                      <optgroup key={g.grupo} label={g.nombre}>
                        {Object.values(bf?.correos ?? {})
                          .filter((c) => c.grupo === g.grupo)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.asunto}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {n.metrica.correo && bf?.correos[n.metrica.correo] ? (
                    <div className="mt-2 rounded-md border border-[#E5E7EB] p-3">
                      <p className="text-[13.5px] font-semibold text-gray-900">{bf.correos[n.metrica.correo].asunto}</p>
                      <p className={META}>
                        {bf.correos[n.metrica.correo].apagado ? 'Apagado: no sale' : bf.correos[n.metrica.correo].cuando}
                      </p>
                      <p className="mt-1.5 text-[12.5px] text-[#4B5563] tabular-nums">
                        {bf.correos[n.metrica.correo].newsletter
                          ? 'Newsletter: no se sabe a quién le llegó. '
                          : `${bf.correos[n.metrica.correo].calculado ? 'Le llegó (calculado)' : 'Enviados'} ${bf.correos[n.metrica.correo].enviados ?? 0} · lo tienen de próximo ${bf.correos[n.metrica.correo].esperando} · `}
                        volvieron {bf.correos[n.metrica.correo].volvieron} · reservaron después {bf.correos[n.metrica.correo].reservaron_despues}{' '}
                        · pagaron después {bf.correos[n.metrica.correo].pagaron_despues}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {bf.correos[n.metrica.correo].enlace ? (
                          // Los correos de systeme.io se ven y se cambian allí.
                          <a href={bf.correos[n.metrica.correo].enlace} target="_blank" rel="noopener noreferrer" className={BOTON}>
                            <ExternalLink size={13} /> Ver y cambiar en systeme.io
                          </a>
                        ) : (
                          <>
                            <button onClick={() => setVerCorreo(true)} className={BOTON}>
                              <Eye size={13} /> Ver cómo llega
                            </button>
                            <Link href={EDITAR_CORREOS} className={BOTON}>
                              Cambiar el texto <ArrowRight size={13} />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className={`${META} mt-1`}>
                      La tarjeta enseña el asunto de ahora, cuándo sale y sus cifras. El texto se cambia en Avisos → Ebook Black Friday.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Acciones de la tarjeta. */}
          <div className="flex flex-wrap gap-2">
            {onVerEnMapa ? (
              <button onClick={() => onVerEnMapa(n)} className={BOTON}>
                <MapPin size={14} /> Ver en el mapa
              </button>
            ) : null}
            {n.tipo === 'campana' ? (
              <button onClick={() => onVerCampana(n)} className={BOTON}>
                <BarChart3 size={14} /> Datos y métricas
              </button>
            ) : null}
            {n.tipo === 'vertical' || n.tipo === 'campana' ? (
              <>
                <button onClick={() => onAbrirMapa(n, false)} className={BOTON}>
                  <ArrowRight size={14} /> {n.submapa_id ? 'Abrir su mapa' : 'Crear su mapa'}
                </button>
                <button onClick={() => onAbrirMapa(n, true)} className={BOTON}>
                  <CopyPlus size={14} /> En pestaña nueva
                </button>
              </>
            ) : null}
          </div>

          {/* El texto, con formato. */}
          <div>
            <div className="flex items-center gap-1 border-b border-[#F3F4F6] pb-1.5 mb-2">
              <button onClick={() => editor?.chain().focus().toggleBold().run()} className={btn(!!editor?.isActive('bold'))} aria-label="Negrita">
                <Bold size={15} />
              </button>
              <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={btn(!!editor?.isActive('italic'))} aria-label="Cursiva">
                <Italic size={15} />
              </button>
              <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(!!editor?.isActive('heading', { level: 2 }))} aria-label="Título">
                <Heading2 size={15} />
              </button>
              <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={btn(!!editor?.isActive('bulletList'))} aria-label="Lista">
                <List size={15} />
              </button>
              <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={btn(!!editor?.isActive('orderedList'))} aria-label="Lista numerada">
                <ListOrdered size={15} />
              </button>
              <button
                onClick={() => {
                  const url = window.prompt('Dirección del enlace (https://…)')
                  if (url) editor?.chain().focus().setLink({ href: url, target: '_blank' }).run()
                }}
                className={btn(!!editor?.isActive('link'))}
                aria-label="Enlace"
              >
                <LinkIcon size={15} />
              </button>
            </div>
            <EditorContent editor={editor} />
          </div>

          {/* Lista de tareas. */}
          <section className="space-y-2">
            <h3 className="text-[14px] font-semibold text-gray-900">
              Tareas {n.checklist.length ? <span className="text-[#9CA3AF] font-normal">· {n.checklist.filter((c) => c.hecho).length}/{n.checklist.length}</span> : null}
            </h3>
            <ul className="space-y-1">
              {n.checklist.map((c, i) => (
                <li key={i} className="group flex items-center gap-2">
                  <button
                    onClick={() => poner({ checklist: n.checklist.map((x, j) => (j === i ? { ...x, hecho: !x.hecho } : x)) })}
                    className={`w-4.5 h-4.5 w-[18px] h-[18px] shrink-0 rounded border flex items-center justify-center ${
                      c.hecho ? 'bg-gray-900 border-gray-900 text-white' : 'border-[#D1D5DB] bg-white'
                    }`}
                    aria-label={c.hecho ? 'Marcar sin hacer' : 'Marcar hecha'}
                  >
                    {c.hecho ? <Check size={12} strokeWidth={3} /> : null}
                  </button>
                  <input
                    value={c.texto}
                    onChange={(e) => poner({ checklist: n.checklist.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) }, true)}
                    className={`flex-1 min-w-0 h-7 text-[13.5px] outline-none ${c.hecho ? 'text-[#9CA3AF] line-through' : 'text-gray-900'}`}
                  />
                  <button
                    onClick={() => poner({ checklist: n.checklist.filter((_, j) => j !== i) })}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-red-600"
                    aria-label="Quitar"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!nuevaTarea.trim()) return
                poner({ checklist: [...n.checklist, { texto: nuevaTarea.trim(), hecho: false }] })
                setNuevaTarea('')
              }}
              className="flex gap-1.5"
            >
              <input value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} placeholder="Añadir tarea (Enter)" className={CAMPO} />
              <button type="submit" className={BOTON} aria-label="Añadir tarea">
                <Plus size={14} />
              </button>
            </form>
          </section>

          {/* Enlaces. */}
          <section className="space-y-2">
            <h3 className="text-[14px] font-semibold text-gray-900">Enlaces</h3>
            <ul className="space-y-1">
              {n.enlaces.map((e, i) => (
                <li key={i} className="group flex items-center gap-2 text-[13.5px]">
                  <ExternalLink size={13} className="text-[#9CA3AF] shrink-0" />
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-[#025dc7] hover:underline truncate">
                    {e.titulo || e.url}
                  </a>
                  <button
                    onClick={() => poner({ enlaces: n.enlaces.filter((_, j) => j !== i) })}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-red-600 ml-auto"
                    aria-label="Quitar enlace"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!nuevoEnlace.url.trim()) return
                poner({ enlaces: [...n.enlaces, { titulo: nuevoEnlace.titulo.trim(), url: nuevoEnlace.url.trim() }] })
                setNuevoEnlace({ titulo: '', url: '' })
              }}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-1.5"
            >
              <input value={nuevoEnlace.titulo} onChange={(e) => setNuevoEnlace((v) => ({ ...v, titulo: e.target.value }))} placeholder="Nombre" className={CAMPO} />
              <input value={nuevoEnlace.url} onChange={(e) => setNuevoEnlace((v) => ({ ...v, url: e.target.value }))} placeholder="https://…" className={CAMPO} />
              <button type="submit" className={BOTON} aria-label="Añadir enlace">
                <Plus size={14} />
              </button>
            </form>
          </section>

          {/* Archivos. */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-gray-900">Archivos</h3>
              <button onClick={() => archivoRef.current?.click()} disabled={subiendo} className={BOTON}>
                {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Subir
              </button>
              <input ref={archivoRef} type="file" multiple className="hidden" onChange={(e) => subir(e.target.files)} />
            </div>
            {n.archivos.length ? (
              <ul className="divide-y divide-[#F3F4F6] rounded-md border border-[#E5E7EB]">
                {n.archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                    <Paperclip size={13} className="text-[#9CA3AF] shrink-0" />
                    <button onClick={() => abrir(a.id)} className="text-[#025dc7] hover:underline truncate text-left">
                      {a.nombre}
                    </button>
                    <span className={`${META} shrink-0 ml-auto`}>{tamano(a.tamano)}</span>
                    <button onClick={() => quitarArchivo(a.id, a.nombre)} className="p-1 text-[#9CA3AF] hover:text-red-600" aria-label="Quitar archivo">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={META}>PDF, imágenes, documentos, audio o vídeo, hasta 25 MB. Solo los ves los administradores.</p>
            )}
          </section>

          <div className="pt-4 border-t border-[#F3F4F6]">
            <button onClick={borrar} className={BOTON_PELIGRO}>
              <Trash2 size={13} /> Borrar tarjeta
            </button>
          </div>
        </div>
      </div>
      {verCorreo && n.metrica.correo ? (
        <VistaCorreo id={n.metrica.correo} asunto={bf?.correos[n.metrica.correo]?.asunto ?? n.titulo} onClose={() => setVerCorreo(false)} />
      ) : null}
    </div>
  )
}
