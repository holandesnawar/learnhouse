'use client'

/**
 * Una tarjeta del mapa de Visión: tipo, título, estado, responsable, fecha,
 * Urgente / Importante y, en las campañas y métricas, sus cifras con el
 * semáforo. Estilo del panel (`Panel/ui.tsx`): blanco, borde fino, el color
 * solo en los puntos.
 *
 * 17/10 ("más simple, más profesional"):
 * - El «+» de su borde derecho añade otra tarjeta unida a esta (o dentro de su
 *   mapa, si es una vertical o una campaña), sin arrastrar flechas.
 * - Recién creada, el título se escribe en la propia tarjeta (Intro guarda).
 * - El estado solo sale donde dice algo: en tareas, campañas, anuncios,
 *   contenidos y pasos del embudo, o si se ha cambiado (una vertical o una
 *   idea «Pendiente» era ruido).
 *
 * 29/10 (el mapa de Black Friday): tres tipos nuevos.
 * - **Correo**: un correo de verdad de la campaña (`metrica.correo`). Enseña
 *   el asunto de ahora, cuándo sale, a cuántos les llegó, cuántos lo tienen
 *   como próximo y quién volvió por él; «Ver» lo abre tal cual llega.
 * - **Decisión**: lo que decide la persona («¿Compra?»), en una píldora de
 *   borde discontinuo.
 * - **Etapa**: el rótulo grande de una etapa del embudo, sin caja.
 * Y las métricas con `fuente: 'black-friday'` leen la campaña en vivo.
 */

import React, { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowRight, ExternalLink, Eye, Paperclip, Link2, Mail, Plus } from 'lucide-react'
import {
  COLOR_SEMAFORO,
  ESTADO,
  TIPO,
  euros,
  fechaCorta,
  valorDe,
  FUENTE_BF,
  type Cifras,
  type DatosBF,
  type MetricaInfo,
  type NodoVision,
  type Semaforo,
} from '@services/vision/vision'

export type DatosTarjeta = {
  nodo: NodoVision
  cifras?: { cifras: Cifras; semaforo: Record<string, Semaforo> }
  /** Para las tarjetas de métrica: la campaña de la que sale la cifra. */
  campanaTitulo?: string
  metricas?: Record<string, MetricaInfo>
  atenuado?: boolean
  /** Escribiendo el título en la tarjeta (recién creada). */
  editando?: boolean
  onAbrir?: (nodo: NodoVision) => void
  /** El «+»: dónde está en pantalla, para abrir allí el menú. */
  onMas?: (nodo: NodoVision, x: number, y: number) => void
  /** Texto escrito en la tarjeta; null = no se cambia. */
  onTitulo?: (nodo: NodoVision, texto: string | null) => void
  /** La campaña de Black Friday en vivo (correos y cifras), si el mapa la usa. */
  bf?: DatosBF | null
  /** «Ver» en una tarjeta de correo. */
  onVerCorreo?: (id: string, asunto: string) => void
}
export type NodoFlow = Node<DatosTarjeta, 'tarjeta'>

const hoy = () => new Date().toISOString().slice(0, 10)
const CON_ESTADO = new Set(['tarea', 'campana', 'anuncio', 'contenido', 'embudo'])

function Punto({ color }: { color: string }) {
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
}

function Cifra({ etiqueta, valor, semaforo }: { etiqueta: string; valor: string; semaforo?: Semaforo }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">{etiqueta}</p>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-gray-900">
        {semaforo ? <Punto color={COLOR_SEMAFORO[semaforo]} /> : null}
        <span className="truncate">{valor}</span>
      </p>
    </div>
  )
}

function TituloEnLaTarjeta({ inicial, grande, onFin }: { inicial: string; grande: boolean; onFin: (texto: string | null) => void }) {
  const [texto, setTexto] = useState(inicial)
  const hecho = useRef(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // React Flow pinta la tarjeta nueva escondida hasta medirla: mientras
    // tanto no se le puede dar el foco. Se reintenta unos fotogramas.
    let vuelta = 0
    let id = 0
    const intentar = () => {
      const el = ref.current
      if (!el) return
      el.focus({ preventScroll: true })
      if (document.activeElement === el) el.select()
      else if (vuelta++ < 30) id = requestAnimationFrame(intentar)
    }
    intentar()
    return () => cancelAnimationFrame(id)
  }, [])
  const fin = (valor: string | null) => {
    if (hecho.current) return
    hecho.current = true
    onFin(valor)
  }
  return (
    <textarea
      ref={ref}
      value={texto}
      rows={1}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          fin(texto)
        } else if (e.key === 'Escape') fin(null)
      }}
      onBlur={() => fin(texto)}
      placeholder="Escribe y pulsa Intro"
      className={`nodrag nopan nowheel mt-1 w-full resize-none overflow-hidden bg-transparent outline-none font-semibold text-gray-900 leading-snug placeholder:text-[#C4C9D1] placeholder:font-normal ${
        grande ? 'text-[16px]' : 'text-[14px]'
      }`}
    />
  )
}

/** Lo de dentro de una tarjeta de correo: el correo de verdad y sus cifras. */
function CuerpoCorreo({ nodo, bf, onVer }: { nodo: NodoVision; bf?: DatosBF | null; onVer?: (id: string, asunto: string) => void }) {
  const id = nodo.metrica.correo || ''
  const c = id ? bf?.correos?.[id] : undefined
  if (!c) {
    return (
      <>
        <p className="mt-1 text-[14px] font-semibold text-gray-900 leading-snug break-words">{nodo.titulo || 'Correo'}</p>
        <p className="mt-1 text-[11.5px] text-[#9CA3AF]">{id ? 'Ese correo ya no está en la campaña' : 'Doble clic: elige qué correo es'}</p>
      </>
    )
  }
  return (
    <>
      <p className="mt-1 text-[11.5px] text-[#6B7280] truncate">{nodo.titulo}</p>
      <p className="text-[14px] font-semibold text-gray-900 leading-snug break-words line-clamp-2">{c.asunto}</p>
      <p className="mt-1 text-[11.5px] text-[#6B7280] leading-snug">{c.apagado ? 'Apagado: no sale' : c.cuando}</p>
      <div className="mt-2 pt-2 border-t border-[#F3F4F6] grid grid-cols-3 gap-x-2">
        {c.newsletter ? (
          <>
            <Cifra etiqueta="Volvieron" valor={String(c.volvieron)} />
            <Cifra etiqueta="Reservaron" valor={String(c.reservaron_despues)} />
            <Cifra etiqueta="Pagaron" valor={String(c.pagaron_despues)} />
          </>
        ) : (
          <>
            <Cifra etiqueta={c.calculado ? 'Le llegó' : 'Enviados'} valor={String(c.enviados ?? 0)} />
            <Cifra etiqueta="Próximo" valor={String(c.esperando)} />
            <Cifra etiqueta="Volvieron" valor={String(c.volvieron)} />
          </>
        )}
      </div>
      {c.enlace ? (
        // Los correos de systeme.io se ven allí.
        <a
          href={c.enlace}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="nodrag mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#025dc7] hover:underline"
        >
          <ExternalLink size={12} /> Ver en systeme.io
        </a>
      ) : onVer ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onVer(id, c.asunto)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="nodrag mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#025dc7] hover:underline"
        >
          <Eye size={12} /> Ver el correo
        </button>
      ) : null}
    </>
  )
}

const MANIJA = '!w-2.5 !h-2.5 !bg-white !border !border-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity'

function TarjetaNodo({ data, selected }: NodeProps<NodoFlow>) {
  const { nodo, cifras, campanaTitulo, metricas, atenuado, editando, onAbrir, onMas, onTitulo, bf, onVerCorreo } = data
  const tipo = TIPO[nodo.tipo] ?? TIPO.nota
  const estado = ESTADO[nodo.estado] ?? ESTADO.pendiente
  const vencida = nodo.vence && nodo.vence < hoy() && nodo.estado !== 'hecho'
  const total = nodo.checklist.length
  const grande = nodo.tipo === 'vertical'
  const abrible = nodo.tipo === 'vertical' || nodo.tipo === 'campana'
  const verEstado = CON_ESTADO.has(nodo.tipo) || (nodo.estado !== 'pendiente' && nodo.estado !== 'idea')
  const ancho =
    grande || nodo.tipo === 'correo'
      ? 'w-[250px]'
      : nodo.tipo === 'etapa'
        ? 'w-[300px]'
        : nodo.tipo === 'metrica'
          ? 'w-[210px]'
          : nodo.tipo === 'nota'
            ? 'w-[220px]'
            : 'w-[236px]'
  const bfMetrica = nodo.tipo === 'metrica' && nodo.metrica.fuente === FUENTE_BF
  // Cada tipo, su caja: la decisión es una píldora de borde discontinuo y la
  // etapa no lleva caja (es un rótulo).
  const caja =
    nodo.tipo === 'decision'
      ? `rounded-full border border-dashed bg-[#FFFBF2] ${selected ? 'border-[#025dc7] ring-2 ring-[#025dc7]/15' : 'border-[#C9A55C] hover:border-[#8A6A2A]'}`
      : nodo.tipo === 'etapa'
        ? `rounded-lg border ${selected ? 'border-[#025dc7] ring-2 ring-[#025dc7]/15 bg-white' : 'border-transparent hover:border-[#E5E7EB]'}`
        : `rounded-lg border bg-white ${selected ? 'border-[#025dc7] ring-2 ring-[#025dc7]/15' : 'border-[#E5E7EB] hover:border-[#C7CDD6]'}`

  return (
    <div
      className={`group relative transition-[opacity,box-shadow] ${caja} ${atenuado ? 'opacity-25' : ''} ${ancho}`}
      style={nodo.tipo === 'vertical' ? { borderTop: `3px solid ${tipo.color}` } : undefined}
    >
      {/* Las cuatro manijas: se une arrastrando desde cualquiera. */}
      <Handle type="source" position={Position.Top} id="t" className={MANIJA} />
      <Handle type="source" position={Position.Right} id="r" className={MANIJA} />
      <Handle type="source" position={Position.Bottom} id="b" className={MANIJA} />
      <Handle type="source" position={Position.Left} id="l" className={MANIJA} />

      {/* El «+»: otra tarjeta unida a esta, sin arrastrar flechas. */}
      {onMas && !editando ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            onMas(nodo, r.right, r.top + r.height / 2)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title="Añadir algo unido a esta tarjeta"
          aria-label="Añadir algo unido a esta tarjeta"
          className={`nodrag nopan absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full border border-[#D1D5DB] bg-white text-gray-700 flex items-center justify-center hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-[opacity,colors] ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Plus size={15} strokeWidth={2.25} />
        </button>
      ) : null}

      <div className={nodo.tipo === 'decision' ? 'px-5 py-2.5' : 'px-3 pt-2.5 pb-2.5'}>
        {nodo.tipo === 'etapa' ? null : (
          <div className={`flex items-center gap-2 ${nodo.tipo === 'decision' ? 'justify-center' : 'justify-between'}`}>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] min-w-0">
              {nodo.tipo === 'correo' ? <Mail size={12} className="text-[#4338CA] shrink-0" /> : <Punto color={tipo.color} />}
              <span className="truncate">{nodo.tipo === 'correo' && nodo.etiquetas[1] ? `${tipo.nombre} · ${nodo.etiquetas[1]}` : tipo.nombre}</span>
            </span>
            {nodo.tipo === 'decision' ? null : (
              <span className="inline-flex items-center gap-1.5 shrink-0">
                {nodo.urgente ? <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#DC2626]">Urgente</span> : null}
                {nodo.importante ? <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#1D0084]">Importante</span> : null}
              </span>
            )}
          </div>
        )}

        {nodo.tipo === 'correo' ? (
          <CuerpoCorreo nodo={nodo} bf={bf} onVer={onVerCorreo} />
        ) : nodo.tipo === 'decision' ? (
          <p className="mt-0.5 text-[14px] font-semibold text-[#5C4512] leading-snug break-words text-center">{nodo.titulo || 'Sin título'}</p>
        ) : nodo.tipo === 'etapa' ? (
          <p className="text-[20px] font-semibold text-[#1D0084] leading-tight break-words">{nodo.titulo || 'Sin título'}</p>
        ) : bfMetrica ? (
          <>
            <p className="mt-1.5 text-[12.5px] text-[#4B5563] truncate">{bf?.nombres?.[nodo.metrica.clave ?? ''] ?? nodo.titulo}</p>
            <p className="text-[24px] font-semibold tabular-nums text-gray-900 leading-tight">
              {bf && nodo.metrica.clave && nodo.metrica.clave in bf.cifras ? bf.cifras[nodo.metrica.clave] : '—'}
            </p>
            <p className="text-[11.5px] text-[#9CA3AF] truncate">Black Friday · ahora mismo</p>
          </>
        ) : nodo.tipo === 'metrica' ? (
          <>
            <p className="mt-1.5 text-[12.5px] text-[#4B5563] truncate">
              {metricas?.[nodo.metrica.clave ?? '']?.nombre ?? nodo.titulo}
            </p>
            <p className="flex items-center gap-2 text-[24px] font-semibold tabular-nums text-gray-900 leading-tight">
              {cifras && nodo.metrica.clave && cifras.semaforo[nodo.metrica.clave] ? (
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_SEMAFORO[cifras.semaforo[nodo.metrica.clave] as 'verde'] }} />
              ) : null}
              {cifras && nodo.metrica.clave ? valorDe(nodo.metrica.clave, cifras.cifras, metricas) : '—'}
            </p>
            <p className="text-[11.5px] text-[#9CA3AF] truncate">{campanaTitulo ? campanaTitulo : 'Doble clic: elige campaña y cifra'}</p>
          </>
        ) : (
          <>
            {editando && onTitulo ? (
              <TituloEnLaTarjeta
                // Recién creada lleva el nombre del tipo («Nota»): se empieza en blanco.
                inicial={nodo.titulo === tipo.nombre ? '' : nodo.titulo}
                grande={grande}
                onFin={(t) => onTitulo(nodo, t)}
              />
            ) : (
              <p className={`mt-1 font-semibold text-gray-900 leading-snug break-words ${grande ? 'text-[16px]' : 'text-[14px]'}`}>
                {nodo.titulo || 'Sin título'}
              </p>
            )}
            {verEstado || nodo.responsable || nodo.vence || nodo.archivos.length || nodo.enlaces.length ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-[#6B7280]">
                {verEstado ? (
                  <span className="inline-flex items-center gap-1">
                    <Punto color={{ gris: '#9CA3AF', azul: '#2563EB', verde: '#16A34A', rojo: '#DC2626', ambar: '#D97706' }[estado.tono]} />
                    {estado.nombre}
                  </span>
                ) : null}
                {nodo.responsable ? <span className="truncate max-w-[110px]">{nodo.responsable}</span> : null}
                {nodo.vence ? (
                  <span className={vencida ? 'text-[#DC2626] font-semibold' : ''}>
                    {vencida ? 'Venció ' : 'Vence '}
                    {fechaCorta(nodo.vence)}
                  </span>
                ) : null}
                {nodo.archivos.length ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Paperclip size={11} />
                    {nodo.archivos.length}
                  </span>
                ) : null}
                {nodo.enlaces.length ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Link2 size={11} />
                    {nodo.enlaces.length}
                  </span>
                ) : null}
              </div>
            ) : null}
            {total ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-gray-800" style={{ width: `${Math.round((nodo.hechas * 100) / total)}%` }} />
                </div>
                <span className="text-[11px] tabular-nums text-[#6B7280]">
                  {nodo.hechas}/{total}
                </span>
              </div>
            ) : null}
            {nodo.etiquetas.length ? (
              <p className="mt-1.5 text-[11px] text-[#9CA3AF] truncate">{nodo.etiquetas.map((e) => `#${e}`).join(' ')}</p>
            ) : null}
            {nodo.tipo === 'campana' && cifras ? (
              <div className="mt-2.5 pt-2 border-t border-[#F3F4F6] grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Cifra etiqueta="Leads" valor={String(cifras.cifras.leads)} />
                <Cifra etiqueta="Ventas" valor={String(cifras.cifras.ventas)} />
                <Cifra etiqueta="CAC" valor={euros(cifras.cifras.cac)} semaforo={cifras.semaforo.cac} />
                <Cifra etiqueta="Margen" valor={euros(cifras.cifras.margen)} semaforo={cifras.semaforo.margen} />
              </div>
            ) : null}
          </>
        )}

        {abrible && onAbrir && !editando ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAbrir(nodo)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="nodrag mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#025dc7] hover:underline"
          >
            {nodo.submapa_id ? 'Entrar' : 'Crear su mapa'}
            <ArrowRight size={12} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default memo(TarjetaNodo)
