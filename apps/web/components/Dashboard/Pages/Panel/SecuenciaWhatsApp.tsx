'use client'

/**
 * Los tres WhatsApp de cada llamada, en orden (02/11/2026).
 *
 * Pedido del usuario: "que desde el CRM sea más fácil el orden por el que se
 * envían": 1) presentarte («vi que tienes una llamada agendada mañana… es por
 * Google Meet, unas horas antes te mando el enlace»), 2) el método en PDF
 * («soy yo otra vez…») y 3) el enlace («nuestra llamada es en 3 horas…»).
 *
 * - Cada paso dice si ya se mandó (quién y cuándo), si toca ahora o desde
 *   cuándo toca, y el que toca va resaltado. El orden y los tiempos, con
 *   test, en `lib/nawar/recordatorioLlamada.ts` (`estadoPasos`).
 * - «Enviar» abre WhatsApp con el texto puesto, a su número, y lo apunta como
 *   mandado (en la escuela, para todo el equipo: `whatsapp_llamada.py`).
 *   Desde aquí no se sabe si luego pulsó «enviar» en WhatsApp: si no lo
 *   mandó, «No lo envié» lo quita.
 * - Los textos son de todo el equipo y firman con el nombre de quien los manda
 *   (`{yo}`). Se cambian en «Mensajes» (`EditorMensajes`), donde también se
 *   sube el PDF del método.
 *
 * No hay envío automático: eso pediría la API de WhatsApp Business (se decidió
 * el 27/10 que el seteo lo haga el closer a mano).
 */

import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, Eye, FileText, Loader2, MessageCircle, Pencil, Upload, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import {
  aPartirDe,
  enlaceWhatsApp,
  estadoPasos,
  mensajeRecordatorio,
  PASOS_WHATSAPP,
  type Enviado,
  type EstadoPaso,
  type PasoWhatsApp,
} from '@/lib/nawar/recordatorioLlamada'
import {
  desmarcarWhatsApp,
  getMensajesLlamada,
  guardarMensajesLlamada,
  marcarWhatsApp,
  quitarPdfMetodo,
  subirPdfMetodo,
  type MensajesLlamada,
} from '@services/stats/whatsappLlamada'
import { BOTON, BOTON_PRINCIPAL, ENLACE, META } from './ui'

export type EnviadosWhatsApp = Partial<Record<PasoWhatsApp, Enviado>>

export interface CitaWhatsApp {
  id: string
  email: string
  nombre: string
  telefono: string
  inicio: string
  enlace?: string
  whatsapp?: EnviadosWhatsApp | null
}

// ── Los textos del equipo: se cargan una vez para toda la pantalla ─────────

let cache: MensajesLlamada | null = null
let enCurso: Promise<unknown> | null = null
const oyentes = new Set<(m: MensajesLlamada | null) => void>()

function publicar(m: MensajesLlamada) {
  cache = m
  oyentes.forEach((f) => f(m))
}

function useAcceso() {
  const org = useOrg() as any
  const session = useLHSession() as any
  return { orgId: org?.id as number | undefined, token: session?.data?.tokens?.access_token as string | undefined, session }
}

export function useMensajesLlamada() {
  const { orgId, token } = useAcceso()
  const [m, setM] = useState<MensajesLlamada | null>(cache)
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    oyentes.add(setM)
    return () => {
      oyentes.delete(setM)
    }
  }, [])
  useEffect(() => {
    if (cache || !orgId || !token || enCurso) return
    enCurso = getMensajesLlamada(orgId, token)
      .then((r) => {
        if (r.ok && r.datos) publicar(r.datos)
        else setFallo(true)
      })
      .finally(() => {
        enCurso = null
      })
  }, [orgId, token])
  return { mensajes: m, fallo }
}

/** Hace cuánto (para «enviado por Diego hace 2 h»). */
function haceCuanto(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!iso || Number.isNaN(ms)) return ''
  const min = Math.round(ms / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

/** «meet.google.com/abc-defg-hij»: el enlace sin https://. */
export function enlaceCorto(url: string) {
  return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// ── Mandar y apuntar ────────────────────────────────────────────────────────

function useMandar(cita: CitaWhatsApp, onCambio: (w: EnviadosWhatsApp) => void) {
  const { orgId, token, session } = useAcceso()
  const yo = session?.data?.user?.first_name || ''
  const { mensajes } = useMensajesLlamada()
  const [ocupado, setOcupado] = useState<PasoWhatsApp | null>(null)
  const enviados: EnviadosWhatsApp = cita.whatsapp || {}

  function texto(paso: PasoWhatsApp) {
    const plantilla = mensajes?.pasos.find((p) => p.id === paso)?.texto || ''
    return mensajeRecordatorio(plantilla, { nombre: cita.nombre, inicio: cita.inicio, enlace: cita.enlace, yo, pdf: mensajes?.pdf })
  }

  /** Qué falta para poder mandarlo (sin PDF no hay mensaje 2; sin enlace, no hay 3). */
  function falta(paso: PasoWhatsApp): string {
    if (!mensajes) return 'Cargando los mensajes…'
    if (paso === 'recurso' && !mensajes.pdf) return 'Falta el PDF del método: súbelo en «Mensajes».'
    if (paso === 'enlace' && !cita.enlace) return 'Esta llamada aún no tiene enlace de Google Meet en Calendly.'
    return ''
  }

  async function apuntar(paso: PasoWhatsApp) {
    if (!orgId || !token) return
    setOcupado(paso)
    const r = await marcarWhatsApp(orgId, { cita_id: cita.id, email: cita.email, paso, inicio: cita.inicio }, token)
    setOcupado(null)
    if (!r.ok || !r.datos) {
      toast.error(`No se ha podido apuntar: ${r.error || 'sin motivo'}`)
      return
    }
    onCambio({ ...enviados, [paso]: r.datos.enviado })
    const n = PASOS_WHATSAPP.find((p) => p.id === paso)?.numero
    toast.success(`Apuntado: mensaje ${n} de 3 enviado`)
  }

  async function quitar(paso: PasoWhatsApp) {
    if (!orgId || !token) return
    setOcupado(paso)
    const r = await desmarcarWhatsApp(orgId, cita.id, paso, token)
    setOcupado(null)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    const nuevo = { ...enviados }
    delete nuevo[paso]
    onCambio(nuevo)
  }

  return { mensajes, texto, falta, apuntar, quitar, ocupado, numero: numeroWhatsApp(cita.telefono) }
}

/** El botón que abre WhatsApp con el texto y, a la vez, lo apunta. */
function BotonEnviar({
  paso,
  texto,
  numero,
  principal,
  falta,
  ocupado,
  etiqueta,
  apuntar,
}: {
  paso: EstadoPaso
  texto: string
  numero: string
  principal: boolean
  falta: string
  ocupado: boolean
  etiqueta: string
  apuntar: () => void
}) {
  const clase = principal ? BOTON_PRINCIPAL : BOTON
  if (falta) {
    return (
      <button disabled className={`${clase} !opacity-40 cursor-not-allowed`} title={falta}>
        <MessageCircle size={13} /> {etiqueta}
      </button>
    )
  }
  return (
    <a
      href={enlaceWhatsApp(numero, texto)}
      target="_blank"
      rel="noreferrer"
      onClick={apuntar}
      className={clase}
      title={numero ? `Abre WhatsApp con el mensaje ${paso.numero} escrito` : 'No tenemos su número: WhatsApp te dejará elegir a quién mandarlo'}
    >
      {ocupado ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} {etiqueta}
    </a>
  )
}

function lineaEstado(p: EstadoPaso): { texto: string; clase: string } {
  if (p.estado === 'enviado' && p.enviado) {
    const quien = (p.enviado.autor || '').split(/\s+/)[0]
    return { texto: [quien ? `Enviado por ${quien}` : 'Enviado', haceCuanto(p.enviado.cuando)].filter(Boolean).join(' · '), clase: 'text-[#15803D]' }
  }
  if (p.estado === 'toca') return { texto: 'Toca ahora', clase: 'text-[#025dc7] font-medium' }
  if (!p.desde) return { texto: 'Después del 1', clase: 'text-gray-500' }
  return { texto: `Toca ${aPartirDe(p.desde)}`, clase: 'text-gray-500' }
}

/**
 * Los tres pasos de una cita, con su estado y sus botones. En la ventana de
 * la cita (Llamadas) y en la ficha, en cada llamada que aún no ha pasado.
 */
export default function SecuenciaWhatsApp({
  cita,
  onCambio,
  sinTitulo = false,
  conMeet = true,
}: {
  cita: CitaWhatsApp
  onCambio: (w: EnviadosWhatsApp) => void
  sinTitulo?: boolean
  /** La ficha ya lo enseña encima, con «Copiar». */
  conMeet?: boolean
}) {
  const { mensajes, texto, falta, apuntar, quitar, ocupado, numero } = useMandar(cita, onCambio)
  const [viendo, setViendo] = useState<PasoWhatsApp | null>(null)
  const [editor, setEditor] = useState(false)
  const { pasos, siguiente } = estadoPasos(cita, new Date(), mensajes?.horas_antes)

  return (
    <div className="w-full">
      {sinTitulo ? null : (
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[13.5px] font-semibold text-gray-900">Recordatorios por WhatsApp</p>
          <button onClick={() => setEditor(true)} className={`${ENLACE} !text-[12.5px] inline-flex items-center gap-1`}>
            <Pencil size={12} /> Mensajes
          </button>
        </div>
      )}
      <ol className="space-y-1.5">
        {pasos.map((p) => {
          const es = siguiente?.id === p.id && p.estado === 'toca'
          const estado = lineaEstado(p)
          const motivo = p.estado === 'enviado' ? '' : falta(p.id)
          return (
            <li
              key={p.id}
              className={`rounded-md border px-3 py-2.5 ${es ? 'border-[#025dc7] bg-[#F5F9FF]' : 'border-[#E5E7EB] bg-white'}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                    p.estado === 'enviado'
                      ? 'bg-[#16A34A] text-white'
                      : es
                        ? 'bg-[#025dc7] text-white'
                        : 'border border-[#D1D5DB] text-gray-500'
                  }`}
                >
                  {p.estado === 'enviado' ? <Check size={13} strokeWidth={3} /> : p.numero}
                </span>
                <div className="flex-1 min-w-[150px]">
                  <p className="text-[13.5px] font-medium text-gray-900 leading-tight">{p.nombre}</p>
                  <p className={`text-[12px] leading-tight mt-0.5 ${estado.clase}`}>{estado.texto}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViendo((v) => (v === p.id ? null : p.id))}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-[#F3F4F6]"
                    aria-label={`Ver el mensaje ${p.numero}`}
                    title="Ver el mensaje"
                  >
                    <Eye size={14} />
                  </button>
                  {p.estado === 'enviado' ? (
                    <>
                      <BotonEnviar
                        paso={p}
                        texto={texto(p.id)}
                        numero={numero}
                        principal={false}
                        falta={falta(p.id)}
                        ocupado={ocupado === p.id}
                        etiqueta="Reenviar"
                        apuntar={() => apuntar(p.id)}
                      />
                      <button onClick={() => quitar(p.id)} disabled={ocupado === p.id} className={`${ENLACE} !text-[12px] !text-gray-500`}>
                        No lo envié
                      </button>
                    </>
                  ) : (
                    <BotonEnviar
                      paso={p}
                      texto={texto(p.id)}
                      numero={numero}
                      principal={es}
                      falta={motivo}
                      ocupado={ocupado === p.id}
                      etiqueta={es ? 'Enviar' : 'Enviar ya'}
                      apuntar={() => apuntar(p.id)}
                    />
                  )}
                </div>
              </div>
              {motivo ? <p className="text-[12px] text-[#92400E] mt-1.5 sm:pl-9">{motivo}</p> : null}
              {viendo === p.id ? (
                <p className="mt-2 sm:ml-9 rounded-md bg-[#F3F4F6] px-3 py-2 text-[13px] text-gray-900 whitespace-pre-wrap break-words">
                  {mensajes ? texto(p.id) : 'Cargando…'}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
      {conMeet && cita.enlace ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gray-600">
          <Video size={13} className="text-gray-400" />
          <span>Google Meet:</span>
          <a href={cita.enlace} target="_blank" rel="noreferrer" className="text-[#025dc7] hover:underline break-all">
            {enlaceCorto(cita.enlace)}
          </a>
        </div>
      ) : null}
      {editor ? <EditorMensajes cerrar={() => setEditor(false)} /> : null}
    </div>
  )
}

/**
 * La versión de una fila (la lista de arriba de Llamadas): los tres puntos y
 * el botón del que toca.
 */
export function SiguienteWhatsApp({ cita, onCambio }: { cita: CitaWhatsApp; onCambio: (w: EnviadosWhatsApp) => void }) {
  const { mensajes, texto, falta, apuntar, ocupado, numero } = useMandar(cita, onCambio)
  const { pasos, siguiente } = estadoPasos(cita, new Date(), mensajes?.horas_antes)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex items-center gap-1" aria-label={`${pasos.filter((p) => p.estado === 'enviado').length} de 3 mensajes enviados`}>
        {pasos.map((p) => (
          <span
            key={p.id}
            title={`${p.numero} · ${p.nombre}: ${lineaEstado(p).texto}`}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold ${
              p.estado === 'enviado'
                ? 'bg-[#16A34A] text-white'
                : siguiente?.id === p.id && p.estado === 'toca'
                  ? 'bg-[#025dc7] text-white'
                  : 'border border-[#D1D5DB] text-gray-400'
            }`}
          >
            {p.estado === 'enviado' ? <Check size={11} strokeWidth={3} /> : p.numero}
          </span>
        ))}
      </span>
      {siguiente && siguiente.estado === 'toca' ? (
        <BotonEnviar
          paso={siguiente}
          texto={texto(siguiente.id)}
          numero={numero}
          principal
          falta={falta(siguiente.id)}
          ocupado={ocupado === siguiente.id}
          etiqueta={`Enviar ${siguiente.numero} · ${siguiente.nombre}`}
          apuntar={() => apuntar(siguiente.id)}
        />
      ) : siguiente ? (
        <span className={META}>
          Siguiente: {siguiente.numero}, {siguiente.desde ? aPartirDe(siguiente.desde) : 'después del 1'}
        </span>
      ) : (
        <span className={META}>Los 3 enviados</span>
      )}
    </div>
  )
}

// ── Cambiar los mensajes y el PDF ───────────────────────────────────────────

const EJEMPLO = {
  nombre: 'Ana',
  // Mañana a las 18:00 (para que se vea «mañana» y «en 3 horas»).
  inicio: (() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000)
    d.setUTCHours(17, 0, 0, 0) // 18:00 en Países Bajos (en invierno)
    return d.toISOString()
  })(),
  enlace: 'https://meet.google.com/abc-defg-hij',
}

export function EditorMensajes({ cerrar }: { cerrar: () => void }) {
  const { orgId, token, session } = useAcceso()
  const yo = session?.data?.user?.first_name || ''
  const { mensajes, fallo } = useMensajesLlamada()
  const [textos, setTextos] = useState<Record<PasoWhatsApp, string> | null>(null)
  const [pdfEnlace, setPdfEnlace] = useState('')
  const [horas, setHoras] = useState(3)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!mensajes || textos) return
    setTextos(Object.fromEntries(mensajes.pasos.map((p) => [p.id, p.texto])) as Record<PasoWhatsApp, string>)
    setPdfEnlace(mensajes.pdf_enlace)
    setHoras(mensajes.horas_antes)
  }, [mensajes, textos])

  async function guardar() {
    if (!orgId || !token || !textos) return
    setGuardando(true)
    const r = await guardarMensajesLlamada(orgId, { textos, pdf_enlace: pdfEnlace.trim(), horas_antes: horas }, token)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar', { duration: 8000 })
      return
    }
    publicar(r.datos)
    toast.success('Mensajes guardados para todo el equipo')
    cerrar()
  }

  async function subir(f: File | undefined) {
    if (!f || !orgId || !token) return
    setSubiendo(true)
    const r = await subirPdfMetodo(orgId, f, token)
    setSubiendo(false)
    if (archivo.current) archivo.current.value = ''
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido subir')
      return
    }
    publicar(r.datos)
    toast.success('PDF subido')
  }

  async function quitarPdf() {
    if (!orgId || !token) return
    const r = await quitarPdfMetodo(orgId, token)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    publicar(r.datos)
  }

  const pdfEjemplo = mensajes?.pdf_subido ? mensajes.pdf : pdfEnlace.trim()

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-3 pb-24 sm:pb-3" onClick={cerrar} role="dialog" aria-modal="true">
      <div
        className="w-full max-w-2xl rounded-xl bg-white border border-[#E5E7EB] max-h-[calc(100vh-7.5rem)] sm:max-h-[92vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6] flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[17px] font-semibold text-gray-900">Los WhatsApp de las llamadas</p>
            <p className={`${META} mt-0.5 !whitespace-normal`}>
              Tres mensajes, en este orden. Son los mismos para todo el equipo y cada uno firma con su nombre ({'{yo}'}).
            </p>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="p-1 -m-1 text-gray-400 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {!mensajes || !textos ? (
          <div className="p-8 flex justify-center">
            {fallo ? <p className="text-[13.5px] text-gray-600">No se han podido cargar los mensajes.</p> : <Loader2 className="animate-spin text-gray-400" size={22} />}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {mensajes.pasos.map((p) => {
              const ejemplo = mensajeRecordatorio(textos[p.id], { ...EJEMPLO, yo, pdf: pdfEjemplo || 'https://…/Metodo-Holandes-Nawar.pdf' }, new Date(new Date(EJEMPLO.inicio).getTime() - (p.id === 'enlace' ? horas : 26) * 3600 * 1000))
              return (
                <div key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[14px] font-semibold text-gray-900">
                      {p.numero}. {p.nombre} <span className="font-normal text-gray-500">· {p.cuando}</span>
                    </p>
                    {textos[p.id] !== mensajes.fabrica[p.id] ? (
                      <button onClick={() => setTextos({ ...textos, [p.id]: mensajes.fabrica[p.id] })} className={`${ENLACE} !text-[12.5px] shrink-0`}>
                        El de serie
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    <textarea
                      value={textos[p.id]}
                      onChange={(e) => setTextos({ ...textos, [p.id]: e.target.value })}
                      rows={8}
                      className="w-full rounded-md border border-[#D1D5DB] px-2.5 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-900"
                    />
                    <div className="rounded-md bg-[#F3F4F6] px-3 py-2 text-[12.5px] text-gray-800 whitespace-pre-wrap break-words">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-1">Así le llega</span>
                      {ejemplo}
                    </div>
                  </div>
                  {p.id === 'enlace' ? (
                    <label className="mt-2 flex items-center gap-2 text-[13px] text-gray-700">
                      Toca
                      <select
                        value={horas}
                        onChange={(e) => setHoras(Number(e.target.value))}
                        className="h-8 rounded-md border border-[#D1D5DB] px-2 text-[13px] text-gray-900"
                      >
                        {[1, 2, 3, 4, 5, 6].map((h) => (
                          <option key={h} value={h}>
                            {h} {h === 1 ? 'hora' : 'horas'}
                          </option>
                        ))}
                      </select>
                      antes de la llamada
                    </label>
                  ) : null}
                  {p.id === 'recurso' ? (
                    <div className="mt-2 rounded-md border border-[#E5E7EB] p-3 space-y-2">
                      <p className="text-[13px] font-medium text-gray-900 flex items-center gap-1.5">
                        <FileText size={14} className="text-gray-400" /> El PDF del método ({'{pdf}'})
                      </p>
                      {mensajes.pdf_subido ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="text-[13px] text-gray-800 truncate max-w-[220px]">{mensajes.pdf_nombre || 'PDF subido'}</span>
                          <a href={mensajes.pdf} target="_blank" rel="noreferrer" className={`${ENLACE} !text-[12.5px]`}>
                            Ver
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(mensajes.pdf).then(() => toast.success('Enlace copiado'))
                            }}
                            className={`${ENLACE} !text-[12.5px] inline-flex items-center gap-1`}
                          >
                            <Copy size={12} /> Copiar enlace
                          </button>
                          <button onClick={() => archivo.current?.click()} className={`${ENLACE} !text-[12.5px]`}>
                            Cambiar
                          </button>
                          <button onClick={quitarPdf} className={`${ENLACE} !text-[12.5px] !text-red-600`}>
                            Quitar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => archivo.current?.click()} disabled={subiendo} className={BOTON}>
                            {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Subir el PDF
                          </button>
                          <p className={`${META} !whitespace-normal`}>O pega aquí un enlace (Google Drive, la web…):</p>
                          <input
                            value={pdfEnlace}
                            onChange={(e) => setPdfEnlace(e.target.value)}
                            placeholder="https://…"
                            className="w-full h-9 rounded-md border border-[#D1D5DB] px-2.5 text-[13px] text-gray-900 outline-none focus:border-gray-900"
                          />
                        </>
                      )}
                      <p className={`${META} !whitespace-normal`}>
                        Al subirlo, la escuela lo sirve en un enlace público que va en el mensaje. Cualquiera con el enlace lo abre: es para
                        compartir.
                      </p>
                      <input ref={archivo} type="file" accept="application/pdf" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
                    </div>
                  ) : null}
                </div>
              )
            })}
            <p className={`${META} !whitespace-normal`}>
              Huecos: {'{nombre}'}, {'{yo}'} (quien lo manda), {'{dia}'} (hoy, mañana, el lunes…), {'{hora}'}, {'{falta}'} (en 3 horas, en 40
              minutos…), {'{enlace}'} (el Google Meet de la llamada) y {'{pdf}'}. Una línea con {'{enlace}'} o {'{pdf}'} desaparece si no lo hay.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={guardar} disabled={guardando} className={`${BOTON_PRINCIPAL} h-9 flex-1 sm:flex-none`}>
                {guardando ? <Loader2 size={13} className="animate-spin" /> : null} Guardar para todo el equipo
              </button>
              <button onClick={cerrar} className={`${BOTON} h-9`}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
