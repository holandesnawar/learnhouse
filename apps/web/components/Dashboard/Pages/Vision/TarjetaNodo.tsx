'use client'

/**
 * Una tarjeta del mapa de Visión: tipo, título, estado, responsable, fecha,
 * Urgente / Importante y, en las campañas y métricas, sus cifras con el
 * semáforo. Estilo del panel (`Panel/ui.tsx`): blanco, borde fino, el color
 * solo en los puntos.
 */

import React, { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowRight, Paperclip, Link2 } from 'lucide-react'
import {
  COLOR_SEMAFORO,
  ESTADO,
  TIPO,
  euros,
  fechaCorta,
  valorDe,
  type Cifras,
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
  onAbrir?: (nodo: NodoVision) => void
}
export type NodoFlow = Node<DatosTarjeta, 'tarjeta'>

const hoy = () => new Date().toISOString().slice(0, 10)

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

const MANIJA = '!w-2.5 !h-2.5 !bg-white !border !border-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity'

function TarjetaNodo({ data, selected }: NodeProps<NodoFlow>) {
  const { nodo, cifras, campanaTitulo, metricas, atenuado, onAbrir } = data
  const tipo = TIPO[nodo.tipo] ?? TIPO.nota
  const estado = ESTADO[nodo.estado] ?? ESTADO.pendiente
  const vencida = nodo.vence && nodo.vence < hoy() && nodo.estado !== 'hecho'
  const total = nodo.checklist.length
  const grande = nodo.tipo === 'vertical'
  const abrible = nodo.tipo === 'vertical' || nodo.tipo === 'campana'

  return (
    <div
      className={`group relative rounded-lg border bg-white transition-[opacity,box-shadow] ${
        selected ? 'border-[#025dc7] ring-2 ring-[#025dc7]/15' : 'border-[#E5E7EB] hover:border-[#C7CDD6]'
      } ${atenuado ? 'opacity-25' : ''} ${grande ? 'w-[250px]' : nodo.tipo === 'metrica' ? 'w-[210px]' : 'w-[236px]'}`}
      style={nodo.tipo === 'vertical' ? { borderTop: `3px solid ${tipo.color}` } : undefined}
    >
      {/* Las cuatro manijas: se une arrastrando desde cualquiera. */}
      <Handle type="source" position={Position.Top} id="t" className={MANIJA} />
      <Handle type="source" position={Position.Right} id="r" className={MANIJA} />
      <Handle type="source" position={Position.Bottom} id="b" className={MANIJA} />
      <Handle type="source" position={Position.Left} id="l" className={MANIJA} />

      <div className="px-3 pt-2.5 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] min-w-0">
            <Punto color={tipo.color} />
            <span className="truncate">{tipo.nombre}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 shrink-0">
            {nodo.urgente ? <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#DC2626]">Urgente</span> : null}
            {nodo.importante ? <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#1D0084]">Importante</span> : null}
          </span>
        </div>

        {nodo.tipo === 'metrica' ? (
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
            <p className="text-[11.5px] text-[#9CA3AF] truncate">{campanaTitulo ? campanaTitulo : 'Elige campaña y cifra'}</p>
          </>
        ) : (
          <>
            <p className={`mt-1 font-semibold text-gray-900 leading-snug break-words ${grande ? 'text-[16px]' : 'text-[14px]'}`}>
              {nodo.titulo || 'Sin título'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1">
                <Punto color={{ gris: '#9CA3AF', azul: '#2563EB', verde: '#16A34A', rojo: '#DC2626', ambar: '#D97706' }[estado.tono]} />
                {estado.nombre}
              </span>
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

        {abrible && onAbrir ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAbrir(nodo)
            }}
            className="nodrag mt-2.5 w-full inline-flex items-center justify-between rounded-md border border-[#E5E7EB] px-2.5 h-7 text-[12px] font-medium text-gray-800 hover:bg-[#F9FAFB]"
          >
            <span>{nodo.submapa_id ? 'Abrir su mapa' : 'Crear su mapa'}</span>
            <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default memo(TarjetaNodo)
