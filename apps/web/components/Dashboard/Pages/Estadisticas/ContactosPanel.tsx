'use client'

/**
 * Contactos — una ficha por persona, con lo que ha hecho, lo que ha visto y
 * de dónde viene.
 *
 * Es la pantalla que contesta, antes de escribir a alguien: ¿ya vio el
 * precio? ¿de qué anuncio viene? ¿descargó una guía, llegó al pago, ya paga?
 *
 * Desde el 04/11/2026 (usuario: "está un poco lío todo… estilo kanban para
 * saber de dónde viene el tráfico y de ahí poder dividir o filtrar quién viene
 * por esto, quién está en esta etapa… los números totales no aportan nada,
 * abajo y que se puedan esconder") se ve de dos maneras:
 * - «Por origen» (de serie): un tablero con una columna por sitio del que
 *   viene la gente (Anuncios, Instagram y redes, Guías, Web, Correo, Otros;
 *   `lib/nawar/origenContacto.ts`). Cada columna dice cuántos son y en qué
 *   etapa están, y cuántos acabaron de alumnos.
 * - «Por días»: la lista de siempre, por el día de su último movimiento.
 * Arriba, los filtros: etapa, campaña y buscar. Los números por etapa, abajo
 * y plegados.
 *
 * La lista es ligera (sin historial); el historial y las etiquetas del CRM se
 * piden al abrir una ficha, porque las etiquetas se leen de systeme.io en
 * vivo y eso tarda.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import PorDia from './PorDia'
import { marcarSolicitud } from '@services/stats/school'
import FichaCliente from '../Panel/FichaCliente'
import { Plegable, TARJETA, filtro } from '../Panel/ui'
import toast from 'react-hot-toast'
import {
  avisoTrasBorrar,
  borrarContacto,
  cuandoLlamar,
  getResumenSeguimiento,
  quitarDeMetricas,
  volverAContar,
  type NotaReciente,
  type ResumenSeguimiento,
  hoyISO,
  type VolverALlamar,
  ETAPA_MATRICULA,
  ETAPA_TEXTO,
  type EtapaContacto,
  getContactos,
  type Contacto,
} from '@services/stats/contactos'
import {
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  Loader2,
  Map as MapIcon,
  NotebookPen,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { ETAPAS, MAPA_WEB } from '@lib/nawar/mapaWeb'
import { confirmar } from '@lib/nawar/confirmar'
import {
  ORIGENES,
  campanaDe,
  colorDeOrigen,
  iniciales,
  nombreCampana,
  origenDe,
  type OrigenId,
} from '@lib/nawar/origenContacto'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

function fecha(iso: string, conHora = false) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** «Hoy 19:43», «Ayer», «Lun 2 nov»… para las tarjetas, donde no cabe más. */
function cuandoCorto(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(d)
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86400000)
  if (dias <= 0) return `Hoy ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/** El color de cada etapa: el mismo punto en las tarjetas, los filtros y las barras. */
const COLOR_ETAPA: Record<EtapaContacto, string> = {
  lead: '#A3AEC2',
  pidio: '#4da3ff',
  'en-pago': '#D99A2B',
  alumno: '#16A34A',
}

/** Las etapas, en orden. Con «Matrículas hechas», sin los leads. */
const ETAPAS_ADMIN: { id: EtapaContacto; nombre: string; que: string }[] = [
  { id: 'lead', nombre: 'Leads', que: 'Dejaron el correo: guía, Instagram o lista de espera' },
  // Aclarado a petición del usuario: el closer leía "pidieron plaza" y "no
  // llegaron al pago" como si esa gente hubiera abandonado la caja. No: en la
  // campaña de lanzamiento el formulario era de contacto, sin pago; esas
  // personas se cierran llamando.
  { id: 'pidio', nombre: 'Pidieron plaza', que: 'En la campaña de lanzamiento, por el formulario de contacto. No pasaba por el pago: se cierra llamando' },
  { id: 'en-pago', nombre: 'Llegaron al pago', que: 'Rellenaron la matrícula con precio y no terminaron de pagar' },
  { id: 'alumno', nombre: 'Alumnos', que: 'Pagaron o tienen cuenta' },
]
const ETAPAS_CLOSER = ETAPAS_ADMIN.filter((e) => e.id !== 'lead').map((e) =>
  e.id === 'alumno' ? { ...e, nombre: 'Ya son alumnos', que: 'Ya pagaron: no hace falta llamar' } : e
)

function Avatar({ c, color }: { c: Contacto; color: string }) {
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11.5px] font-bold"
      style={{ background: `${color}18`, color }}
      aria-hidden
    >
      {iniciales(c.nombre, c.email)}
    </span>
  )
}

function EtapaPunto({ etapa }: { etapa: EtapaContacto }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#374151] shrink-0">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_ETAPA[etapa] || COLOR_ETAPA.lead }} />
      {ETAPA_TEXTO[etapa] || etapa}
    </span>
  )
}

/** Las marcas pequeñas de una persona: llamar hoy, notas, vio el precio, fuera de los números. */
function Marcas({ c, llamar, notas }: { c: Contacto; llamar?: VolverALlamar; notas: number }) {
  const partes: React.ReactNode[] = []
  if (llamar)
    partes.push(
      <span key="ll" className={`font-semibold ${llamar.fecha <= hoyISO() ? 'text-red-600' : 'text-[#9A6A12]'}`}>
        Llamar {cuandoLlamar(llamar.fecha)}
      </span>
    )
  if (c.atendida)
    partes.push(
      <span key="at" className="text-[#15803D] inline-flex items-center gap-0.5">
        <Check size={11} /> Atendida
      </span>
    )
  if (notas)
    partes.push(
      <span key="no" className="text-[#374151] inline-flex items-center gap-1">
        <NotebookPen size={11} /> {notas} {notas === 1 ? 'nota' : 'notas'}
      </span>
    )
  if (c.vio_precio) partes.push(<span key="vp" className="text-[#15803D]">vio el precio</span>)
  if (c.fuera_de_metricas) partes.push(<span key="fu" className="text-gray-500">fuera de los números</span>)
  if (!partes.length) return null
  return (
    <p className="text-[11.5px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {partes.map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span className="text-[#D1D5DB]">·</span> : null}
          {p}
        </React.Fragment>
      ))}
    </p>
  )
}

/** Una línea por persona (vista «Por días»): quién es, cómo contactarla y lo último que hizo. */
function Fila({
  c,
  onOpen,
  deMatricula,
  llamar,
  notas = 0,
  onQuitar,
  onAtendida,
  guardando = false,
}: {
  c: Contacto
  onOpen: () => void
  deMatricula: boolean
  llamar?: VolverALlamar
  notas?: number
  /** Solo administradores: borrar (lead) o quitar de las métricas (alumno). */
  onQuitar?: () => void
  /** Marcar atendida su solicitud de plaza (closer y administrador). */
  onAtendida?: () => void
  guardando?: boolean
}) {
  // En "Matrículas hechas" importa CUÁNDO se matriculó; si no, lo último que hizo.
  const cuando = deMatricula ? c.matricula_at : c.ultimo_contacto.when
  const esAlumno = c.etapa === 'alumno'
  const origen = origenDe(c)
  const color = colorDeOrigen(origen.id)
  return (
    <div
      className={`rounded-lg border flex items-stretch transition-colors bg-white ${
        c.atendida ? 'border-[#EEF2F9]' : 'border-[#E2E8F4] hover:border-[#B9CBEA] hover:bg-[#F7F9FE]'
      } ${c.fuera_de_metricas ? 'opacity-60' : ''}`}
    >
      <button onClick={onOpen} className="flex-1 min-w-0 text-left px-3 sm:px-3.5 py-2.5 flex items-center gap-3">
        <Avatar c={c} color={color} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-gray-900 flex items-center gap-2 min-w-0">
            <span className="truncate">{c.nombre || c.email}</span>
            <EtapaPunto etapa={c.etapa} />
          </p>
          <p className="text-[12px] text-gray-500 truncate">
            {c.email}
            {c.telefono ? ` · ${c.telefono}` : ''}
          </p>
          <p className="text-[12px] mt-0.5 text-[#4B5563] truncate">
            <span className="font-medium" style={{ color }}>
              {origen.detalle}
            </span>
            <span className="text-[#D1D5DB]"> · </span>
            {deMatricula ? ETAPA_MATRICULA[c.etapa] || 'Se matriculó' : c.ultimo_contacto.que}
            <span className="text-[#9CA3AF]"> · {fecha(cuando, true)}</span>
          </p>
          <div className="mt-0.5">
            <Marcas c={c} llamar={llamar} notas={notas} />
          </div>
        </div>
        <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
      </button>
      {onAtendida ? (
        <button
          onClick={onAtendida}
          disabled={guardando}
          title={c.atendida ? 'Volver a pendiente' : 'Marcar como atendida'}
          className={`shrink-0 px-3 border-l border-[#E2E8F4] text-[12px] font-bold transition-colors disabled:opacity-50 ${
            c.atendida ? 'text-[#9CA3AF] hover:text-gray-700' : 'text-[#15803D] hover:bg-[#F3F6FD]'
          }`}
        >
          {c.atendida ? <RotateCcw size={15} /> : <Check size={16} />}
        </button>
      ) : null}
      {onQuitar ? (
        <button
          onClick={onQuitar}
          disabled={guardando}
          title={
            c.fuera_de_metricas
              ? 'Volver a contarle en los números'
              : esAlumno
                ? 'Quitar de los números (era una prueba). Sigue pudiendo entrar.'
                : 'Borrar (era una prueba o no vale)'
          }
          aria-label={esAlumno ? `Quitar a ${c.nombre || c.email} de los números` : `Borrar a ${c.nombre || c.email}`}
          className={`shrink-0 px-3 border-l border-[#E2E8F4] rounded-r-lg transition-colors disabled:opacity-50 ${
            esAlumno || c.fuera_de_metricas ? 'text-[#6B7280] hover:bg-[#F3F6FD]' : 'text-red-500 hover:text-red-700 hover:bg-red-50'
          }`}
        >
          {c.fuera_de_metricas ? <Eye size={16} /> : esAlumno ? <EyeOff size={16} /> : <Trash2 size={16} />}
        </button>
      ) : null}
    </div>
  )
}

/** Una tarjeta del tablero «Por origen». Tocarla abre la ficha (con borrar y demás). */
function TarjetaContacto({
  c,
  onOpen,
  fechaDe,
  llamar,
  notas = 0,
}: {
  c: Contacto
  onOpen: () => void
  fechaDe: (c: Contacto) => string
  llamar?: VolverALlamar
  notas?: number
}) {
  const origen = origenDe(c)
  const color = colorDeOrigen(origen.id)
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-lg bg-white border border-[#E2E8F4] hover:border-[#B9CBEA] hover:shadow-[0_2px_10px_rgba(29,0,132,0.06)] px-3 py-2.5 transition-all ${
        c.fuera_de_metricas ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar c={c} color={color} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.nombre || c.email}</p>
          <p className="text-[12px] text-gray-500 truncate" title={origen.detalle}>
            {origen.detalle}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <EtapaPunto etapa={c.etapa} />
        <span className="text-[11.5px] text-[#9CA3AF] tabular-nums shrink-0">{cuandoCorto(fechaDe(c))}</span>
      </div>
      <div className="mt-1">
        <Marcas c={c} llamar={llamar} notas={notas} />
      </div>
    </button>
  )
}

/** Cuántos hay en cada etapa, en una barra de colores. */
function BarraEtapas({ items, etapas }: { items: Contacto[]; etapas: { id: EtapaContacto; nombre: string }[] }) {
  const total = items.length
  if (!total) return <div className="h-1.5 rounded-full bg-[#E2E8F4]" />
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-[#E2E8F4]">
      {etapas.map((e) => {
        const n = items.filter((c) => c.etapa === e.id).length
        if (!n) return null
        return <span key={e.id} title={`${e.nombre}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: COLOR_ETAPA[e.id] }} />
      })}
    </div>
  )
}

const POR_COLUMNA = 8

/** Una columna del tablero: un sitio del que viene la gente. */
function ColumnaOrigen({
  o,
  items,
  etapas,
  tarjeta,
  ancho = false,
}: {
  o: (typeof ORIGENES)[number]
  items: Contacto[]
  etapas: { id: EtapaContacto; nombre: string }[]
  tarjeta: (c: Contacto) => React.ReactNode
  /** En el móvil va sola y ocupa todo el ancho. */
  ancho?: boolean
}) {
  const [cuantos, setCuantos] = useState(POR_COLUMNA)
  const alumnos = items.filter((c) => c.etapa === 'alumno').length
  const pct = items.length ? Math.round((alumnos / items.length) * 100) : 0
  return (
    <div className={`flex flex-col rounded-xl bg-[#F4F7FD] border border-[#E2E8F4] ${ancho ? 'w-full' : 'flex-1 min-w-[214px] max-w-[320px]'}`}>
      <div className="px-3 pt-3 pb-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: o.color }} />
          <span className="text-[14px] font-bold text-[#0a1656] truncate" style={POPPINS}>
            {o.nombre}
          </span>
          <span className="ml-auto rounded-full bg-white border border-[#E2E8F4] px-2 py-0.5 text-[11.5px] font-bold text-[#1D0084] tabular-nums">
            {items.length}
          </span>
        </div>
        <BarraEtapas items={items} etapas={etapas} />
        <p className="text-[11.5px] text-[#6B7280]">
          {alumnos ? (
            <>
              <strong className="text-[#15803D] font-semibold">{alumnos}</strong> {alumnos === 1 ? 'alumno' : 'alumnos'} · {pct} %
            </>
          ) : (
            o.que
          )}
        </p>
      </div>
      <div className="px-2 pb-2 space-y-1.5">
        {items.length === 0 ? (
          <p className="px-1.5 py-3 text-[12.5px] text-[#9CA3AF]">Nadie con estos filtros.</p>
        ) : (
          items.slice(0, cuantos).map((c) => <React.Fragment key={c.email}>{tarjeta(c)}</React.Fragment>)
        )}
        {items.length > cuantos ? (
          <button
            onClick={() => setCuantos((n) => n + 20)}
            className="w-full rounded-lg py-2 text-[12.5px] font-semibold text-[#025dc7] hover:bg-white transition-colors"
          >
            {items.length - cuantos <= 20 ? `Ver ${items.length - cuantos} más` : `Ver 20 más · quedan ${items.length - cuantos}`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** El tablero «Por origen». En el ordenador todas las columnas; en el móvil, una cada vez. */
function TableroOrigen({
  items,
  etapas,
  tarjeta,
}: {
  items: Contacto[]
  etapas: { id: EtapaContacto; nombre: string }[]
  tarjeta: (c: Contacto) => React.ReactNode
}) {
  const porOrigen = useMemo(() => {
    const m: Record<OrigenId, Contacto[]> = { anuncios: [], redes: [], guias: [], web: [], correo: [], otros: [] }
    for (const c of items) m[origenDe(c).id].push(c)
    return m
  }, [items])
  const conGente = ORIGENES.filter((o) => porOrigen[o.id].length)
  const [movil, setMovil] = useState<OrigenId | null>(null)
  const elegida = conGente.find((o) => o.id === movil) || conGente[0]
  if (!conGente.length) return <p className="text-[13.5px] text-gray-700 py-2">Nadie coincide con estos filtros.</p>
  return (
    <>
      {/* Móvil: elegir la columna. */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {conGente.map((o) => (
            <button key={o.id} onClick={() => setMovil(o.id)} className={`${filtro(elegida?.id === o.id)} inline-flex items-center gap-1.5`}>
              <span className="w-2 h-2 rounded-full" style={{ background: elegida?.id === o.id ? '#fff' : o.color }} />
              {o.nombre}
              <span className="tabular-nums opacity-70">{porOrigen[o.id].length}</span>
            </button>
          ))}
        </div>
        {elegida ? <ColumnaOrigen key={elegida.id} o={elegida} items={porOrigen[elegida.id]} etapas={etapas} tarjeta={tarjeta} ancho /> : null}
      </div>
      {/* Ordenador: todas, una al lado de otra. */}
      <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 items-start">
        {conGente.map((o) => (
          <ColumnaOrigen key={o.id} o={o} items={porOrigen[o.id]} etapas={etapas} tarjeta={tarjeta} />
        ))}
      </div>
    </>
  )
}

function MapaWeb() {
  return (
    <Plegable
      titulo="Mapa de la web"
      icono={<MapIcon size={16} />}
      resumen="Qué página lleva a cada etapa"
      recordarComo="contactos.mapa"
      color="#1D0084"
    >
      <div className="mt-3 space-y-4">
        {ETAPAS.map((et) => (
          <div key={et.id}>
            <p className="text-[12.5px] font-bold text-gray-900">{et.nombre}</p>
            <p className="text-[12px] text-gray-500 mb-1.5">{et.que}</p>
            <div className="space-y-1">
              {MAPA_WEB.filter((p) => p.etapa === et.id).map((p) => (
                <div
                  key={p.ruta}
                  className={`rounded-lg border px-3 py-2 text-[12.5px] ${p.redirigeA ? 'border-[#F3F4F6] opacity-60' : 'border-[#E2E8F4]'}`}
                >
                  <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{p.nombre}</span>
                    <span className="font-mono text-[11.5px] text-[#025dc7] break-all">{p.ruta}</span>
                    {p.precio ? (
                      <span className="rounded-full text-[#15803D] px-1.5 py-0.5 text-[10.5px] font-semibold">enseña el precio</span>
                    ) : (
                      <span className="rounded-full text-gray-500 px-1.5 py-0.5 text-[10.5px] font-semibold">sin precio</span>
                    )}
                    {p.ads ? <span className="rounded-full text-[#B45309] px-1.5 py-0.5 text-[10.5px] font-semibold">anuncios</span> : null}
                  </p>
                  <p className="text-gray-600 mt-0.5">{p.que}</p>
                  <p className="text-gray-500 mt-0.5">
                    <span className="text-[#9CA3AF]">Botón:</span> {p.boton}
                    {p.etiquetas.length ? (
                      <>
                        {' · '}
                        <span className="text-[#9CA3AF]">Etiqueta:</span> {p.etiquetas.join(', ')}
                      </>
                    ) : null}
                    {p.redirigeA ? (
                      <>
                        {' · '}
                        <span className="text-[#B45309]">Redirige a {p.redirigeA}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11.5px] text-[#9CA3AF]">
          Este mapa está escrito a mano (las páginas viven en el otro repo). Si se cambia una página en la web, hay que cambiarlo aquí también.
        </p>
      </div>
    </Plegable>
  )
}

/**
 * Lo último que ha apuntado el equipo (sobre todo el closer), para que el
 * administrador lo vea sin abrir ficha por ficha. Tocar una nota abre la ficha.
 * Plegado de serie ("que se pueda hacer pequeño", 28/09).
 */
function UltimasNotas({
  notas,
  nombreDe,
  abrir,
}: {
  notas: NotaReciente[]
  nombreDe: (email: string) => string
  abrir: (email: string) => void
}) {
  const [todas, setTodas] = useState(false)
  if (!notas.length) return null
  const vistas = todas ? notas : notas.slice(0, 3)
  const ultima = notas[0]
  return (
    <Plegable
      titulo="Notas del equipo"
      icono={<NotebookPen size={16} />}
      resumen={
        ultima ? (
          <>
            La última, de {ultima.autor} sobre <strong className="text-gray-700 font-semibold">{nombreDe(ultima.email)}</strong>,{' '}
            {fecha(ultima.created_at, true)}
          </>
        ) : null
      }
      recordarComo="contactos.notas"
    >
      <ul className="mt-1 divide-y divide-[#F3F4F6]">
        {vistas.map((n) => (
          <li key={n.id}>
            <button onClick={() => abrir(n.email)} className="w-full text-left py-2.5 hover:bg-[#F7F9FE] rounded-lg px-1.5">
              <p className="text-[12px] text-gray-500">
                <strong className="text-gray-900">{nombreDe(n.email)}</strong> · {n.autor} · {fecha(n.created_at, true)}
              </p>
              <p className="text-[13px] text-gray-800 mt-0.5 line-clamp-2 whitespace-pre-wrap">{n.texto}</p>
            </button>
          </li>
        ))}
      </ul>
      {notas.length > 3 ? (
        <button onClick={() => setTodas((v) => !v)} className="mt-1 text-[12.5px] font-semibold text-[#025dc7] hover:underline">
          {todas ? 'Ver menos' : `Ver las ${notas.length} últimas`}
        </button>
      ) : null}
    </Plegable>
  )
}

/**
 * «Para llamar hoy» (lo que toca hoy y lo que se pasó de fecha), plegable
 * (03/11, usuario: "que se pueda esconder ese banner, si no da pereza
 * entrar"). Plegado de serie: queda una línea con cuántos son, y se abre con
 * un toque. Lo que elija cada uno se recuerda en su navegador.
 */
function ParaLlamarHoy({ n, children }: { n: number; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    try {
      setAbierto(localStorage.getItem('nawar.contactos.llamar-hoy') === 'abierto')
    } catch {}
  }, [])
  function alternar() {
    const v = !abierto
    setAbierto(v)
    try {
      localStorage.setItem('nawar.contactos.llamar-hoy', v ? 'abierto' : 'plegado')
    } catch {}
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 px-3.5 sm:px-4 py-3">
      <button onClick={alternar} aria-expanded={abierto} className="w-full flex items-center gap-2 text-left">
        <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
          <BellRing size={16} />
        </span>
        <span className="text-[14px] font-bold text-red-700 flex-1" style={POPPINS}>
          Para llamar hoy · {n}
        </span>
        <span className="text-[12.5px] font-semibold text-red-700/80 inline-flex items-center gap-1">
          {abierto ? 'Ocultar' : 'Ver'}
          {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {abierto ? <div className="mt-2.5 space-y-1.5">{children}</div> : null}
    </div>
  )
}

/** Los números por etapa: abajo y plegados ("no aportan nada", 04/11). */
function NumerosPorEtapa({ items, etapas }: { items: Contacto[]; etapas: typeof ETAPAS_ADMIN }) {
  const total = items.length
  return (
    <Plegable
      titulo="Números por etapa"
      icono={<BarChart3 size={16} />}
      resumen={etapas.map((e) => `${e.nombre} ${items.filter((c) => c.etapa === e.id).length}`).join(' · ')}
      recordarComo="contactos.numeros"
    >
      <div className={`mt-3 grid grid-cols-2 ${etapas.length === 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-2.5`}>
        {etapas.map((e, i) => {
          const n = items.filter((c) => c.etapa === e.id).length
          return (
            <div key={e.id} className="rounded-lg border border-[#E2E8F4] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_ETAPA[e.id] }} />
                {i + 1} · {e.nombre}
              </p>
              <p className="text-[26px] font-semibold tabular-nums leading-tight mt-0.5 text-[#0a1656]">
                {n}
                {total ? <span className="text-[13px] text-[#9CA3AF] font-medium ml-1.5">{Math.round((n / total) * 100)} %</span> : null}
              </p>
              <p className="text-[11.5px] leading-snug text-gray-500">{e.que}</p>
            </div>
          )
        })}
      </div>
    </Plegable>
  )
}

type Vista = 'origen' | 'dias'

export default function ContactosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isCloser, isAdmin } = useAdminStatus()

  const [q, setQ] = useState('')
  const [datos, setDatos] = useState<{ total: number; mostrados: number; contactos: Contacto[] } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<EtapaContacto | null>(null)
  const [origenFiltro, setOrigenFiltro] = useState<OrigenId | null>(null)
  const [campana, setCampana] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)

  // «Por origen» (el tablero, de serie) o «Por días» (la lista de antes).
  // Se recuerda en el navegador.
  const [vista, setVistaEstado] = useState<Vista>('origen')
  useEffect(() => {
    try {
      const g = localStorage.getItem('nawar.contactos.vista')
      if (g === 'origen' || g === 'dias') setVistaEstado(g)
    } catch {}
  }, [])
  const setVista = (v: Vista) => {
    setVistaEstado(v)
    try {
      localStorage.setItem('nawar.contactos.vista', v)
    } catch {}
  }

  // "Matrículas hechas": solo quien rellenó la matrícula (pidió plaza o llegó
  // al pago), por día de matrícula. Se puede abrir directo con
  // ?vista=matriculas (el enlace de Estadísticas). Desde el 03/11 el closer
  // elige igual que el administrador (antes veía solo las matrículas).
  const [soloMatriculas, setSoloMatriculas] = useState(false)
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('vista') === 'matriculas') setSoloMatriculas(true)
    } catch {}
  }, [])

  const [resumen, setResumen] = useState<ResumenSeguimiento>({ recordatorios: {}, notas_por_email: {}, ultimas_notas: [] })
  const recordatorios = resumen.recordatorios

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setCargando(true)
    const [lista, res] = await Promise.all([getContactos(org.id, '', accessToken), getResumenSeguimiento(org.id, accessToken)])
    setDatos(lista)
    setResumen(res)
    setCargando(false)
  }, [org?.id, accessToken])

  const cambioFecha = (email: string, v: VolverALlamar | null) =>
    setResumen((prev) => {
      const recs = { ...prev.recordatorios }
      if (v) recs[email.toLowerCase()] = v
      else delete recs[email.toLowerCase()]
      return { ...prev, recordatorios: recs }
    })

  useEffect(() => {
    cargar()
  }, [cargar])

  // Los quitados de los números no cuentan en nada: ni en las cifras ni en
  // la lista. Se pueden ver abajo ("N fuera de los números") y devolver.
  const todos = datos?.contactos ?? []
  const fuera = todos.filter((c) => c.fuera_de_metricas)
  const lista = useMemo(() => {
    const cuentan = todos.filter((c) => !c.fuera_de_metricas)
    return soloMatriculas ? cuentan.filter((c) => c.matricula_at) : cuentan
  }, [todos, soloMatriculas])

  const etapas = soloMatriculas ? ETAPAS_CLOSER : ETAPAS_ADMIN
  const totalTodos = todos.filter((c) => !c.fuera_de_metricas).length
  const totalMatriculas = todos.filter((c) => !c.fuera_de_metricas && c.matricula_at).length
  const nombreDe = (email: string) => todos.find((c) => c.email === email)?.nombre || email

  const actualizarFicha = (email: string, cambios: Partial<Contacto>) =>
    setDatos((prev) => (prev ? { ...prev, contactos: prev.contactos.map((x) => (x.email === email ? { ...x, ...cambios } : x)) } : prev))

  // Administrador: a un lead se le BORRA; a un alumno se le QUITA de los
  // números (sigue pudiendo entrar: 24/09, "no quiero quitarlo de la escuela").
  async function quitar(c: Contacto) {
    if (c.fuera_de_metricas) {
      setGuardando(c.email)
      const r = await volverAContar(org?.id, c.email, accessToken)
      setGuardando(null)
      if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
      actualizarFicha(c.email, { fuera_de_metricas: false })
      return toast.success('Vuelve a contar en los números')
    }
    if (c.etapa === 'alumno') {
      if (
        !(await confirmar(
          `¿Quitar a ${c.nombre || c.email} de los números? Deja de contar en las estadísticas, los gastos y las plazas. Su cuenta, su acceso a la escuela y sus pagos siguen igual. Se puede deshacer.`
        ))
      )
        return
      setGuardando(c.email)
      const r = await quitarDeMetricas(org?.id, c.email, accessToken)
      setGuardando(null)
      if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
      setAbierto(null)
      actualizarFicha(c.email, { fuera_de_metricas: true })
      return toast.success('Quitado de los números')
    }
    if (
      !(await confirmar(
        `¿Borrar a ${c.nombre || c.email}? Es para pruebas o leads que no valen: se borran sus guías, llamadas, solicitudes, notas y matrículas sin pagar. No se puede deshacer.`
      ))
    )
      return
    setGuardando(c.email)
    const r = await borrarContacto(org?.id, c.email, accessToken)
    setGuardando(null)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    setAbierto(null)
    const aviso = avisoTrasBorrar(r.quedan)
    if (aviso === 'Borrado') {
      setDatos((prev) => (prev ? { ...prev, contactos: prev.contactos.filter((x) => x.email !== c.email) } : prev))
      toast.success('Borrado')
    } else {
      toast(aviso, { duration: 7000 })
      cargar()
    }
  }

  // Atendida = su solicitud de plaza marcada (la misma marca que Llamadas).
  async function alternarAtendida(c: Contacto) {
    if (!c.solicitud_id) return
    setGuardando(c.email)
    const ok = await marcarSolicitud(org?.id, c.solicitud_id, !c.atendida, accessToken)
    setGuardando(null)
    if (!ok) return toast.error('No se ha podido guardar')
    actualizarFicha(c.email, { atendida: !c.atendida })
  }

  // Los filtros. El buscador filtra en el navegador: la lista ya viene entera
  // y así responde al instante. Cada fila de filtros cuenta con los OTROS
  // filtros puestos (si eliges «Anuncios», las etapas dicen cuántos de
  // anuncios hay en cada una).
  const t = q.trim().toLowerCase()
  const pasaBusqueda = (c: Contacto) =>
    !t ||
    c.email.includes(t) ||
    c.nombre.toLowerCase().includes(t) ||
    c.telefono.includes(t) ||
    c.utm_campaign.toLowerCase().includes(t) ||
    (c.canal?.detalle || '').toLowerCase().includes(t) ||
    c.etiquetas.some((e) => e.toLowerCase().includes(t))
  const pasaCampana = (c: Contacto) => !campana || campanaDe(c) === campana
  const pasaOrigen = (c: Contacto) => !origenFiltro || origenDe(c).id === origenFiltro
  const pasaEtapa = (c: Contacto) => !etapa || c.etapa === etapa

  const base = useMemo(() => lista.filter((c) => pasaBusqueda(c) && pasaCampana(c)), [lista, t, campana]) // eslint-disable-line react-hooks/exhaustive-deps
  const paraEtapas = vista === 'dias' ? base.filter(pasaOrigen) : base
  const visibles = useMemo(
    () => base.filter((c) => pasaEtapa(c) && (vista === 'origen' || pasaOrigen(c))),
    [base, etapa, origenFiltro, vista] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const campanas = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of lista) {
      const k = campanaDe(c)
      if (k) m[k] = (m[k] || 0) + 1
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [lista])
  const hayFiltros = Boolean(t || etapa || origenFiltro || campana)

  const fechaDe = (c: Contacto) => (soloMatriculas ? c.matricula_at : c.ultimo_contacto.when)
  const ordenados = useMemo(
    () => [...visibles].sort((a, b) => (fechaDe(b) || '').localeCompare(fechaDe(a) || '')),
    [visibles, soloMatriculas] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const fila = (c: Contacto) => (
    <Fila
      c={c}
      deMatricula={soloMatriculas}
      onOpen={() => setAbierto(c.email)}
      onQuitar={isAdmin ? () => quitar(c) : undefined}
      onAtendida={c.solicitud_id ? () => alternarAtendida(c) : undefined}
      guardando={guardando === c.email}
      llamar={recordatorios[c.email.toLowerCase()]}
      notas={resumen.notas_por_email[c.email.toLowerCase()] || 0}
    />
  )
  const tarjeta = (c: Contacto) => (
    <TarjetaContacto
      c={c}
      onOpen={() => setAbierto(c.email)}
      fechaDe={fechaDe}
      llamar={recordatorios[c.email.toLowerCase()]}
      notas={resumen.notas_por_email[c.email.toLowerCase()] || 0}
    />
  )
  const contactoAbierto = todos.find((c) => c.email === abierto)

  const tocanHoy = (() => {
    const hoy = hoyISO()
    return lista
      .filter((c) => c.etapa !== 'alumno' && recordatorios[c.email.toLowerCase()]?.fecha && recordatorios[c.email.toLowerCase()].fecha <= hoy)
      .sort((a, b) => recordatorios[a.email.toLowerCase()].fecha.localeCompare(recordatorios[b.email.toLowerCase()].fecha))
  })()

  return (
    <section className="space-y-4">
      {/* Todos o solo las matrículas; y cómo verlos. */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex rounded-lg bg-[#E9EEF8] p-1">
          {[
            { id: false, label: 'Todos los contactos', n: totalTodos },
            { id: true, label: 'Matrículas hechas', n: totalMatriculas },
          ].map((o) => (
            <button
              key={String(o.id)}
              onClick={() => {
                setSoloMatriculas(o.id)
                setEtapa(null)
              }}
              className={`px-3 sm:px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                soloMatriculas === o.id ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480] hover:text-[#1D0084]'
              }`}
            >
              {o.label} <span className="tabular-nums opacity-70">{o.n}</span>
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-[#E9EEF8] p-1">
          {(
            [
              { id: 'origen', label: 'Por origen', icono: <Columns3 size={14} /> },
              { id: 'dias', label: 'Por días', icono: <CalendarDays size={14} /> },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setVista(o.id)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                vista === o.id ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480] hover:text-[#1D0084]'
              }`}
            >
              {o.icono} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lo que toca hoy (y lo que se pasó de fecha), antes que nada. */}
      {tocanHoy.length ? (
        <ParaLlamarHoy n={tocanHoy.length}>
          {tocanHoy.map((c) => (
            <React.Fragment key={c.email}>{fila(c)}</React.Fragment>
          ))}
        </ParaLlamarHoy>
      ) : null}

      {/* El administrador ve lo que va apuntando el closer. */}
      {isAdmin ? <UltimasNotas notas={resumen.ultimas_notas} nombreDe={nombreDe} abrir={setAbierto} /> : null}

      {/* Los filtros: buscar, etapa, campaña (y, en «Por días», el origen). */}
      <div className={`${TARJETA} p-3 sm:p-4 space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o anuncio"
              className="w-full bg-[#F7F9FE] rounded-lg pl-9 pr-3 py-2 text-[13.5px] text-gray-900 placeholder:text-gray-400 border border-[#E2E8F4] outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors"
            />
          </label>
          {campanas.length ? (
            <select
              value={campana}
              onChange={(e) => setCampana(e.target.value)}
              aria-label="Campaña"
              className="h-[38px] rounded-lg border border-[#E2E8F4] bg-white px-2.5 text-[13px] text-[#374151] outline-none focus:border-[#4da3ff] sm:max-w-[230px]"
            >
              <option value="">Todas las campañas</option>
              {campanas.map(([id, n]) => (
                <option key={id} value={id}>
                  {nombreCampana(id)} · {n}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          <button onClick={() => setEtapa(null)} className={filtro(!etapa)}>
            Todas las etapas <span className="tabular-nums opacity-70">{paraEtapas.length}</span>
          </button>
          {etapas.map((e) => {
            const n = paraEtapas.filter((c) => c.etapa === e.id).length
            const on = etapa === e.id
            return (
              <button key={e.id} onClick={() => setEtapa(on ? null : e.id)} className={`${filtro(on)} inline-flex items-center gap-1.5`} title={e.que}>
                <span className="w-2 h-2 rounded-full" style={{ background: on ? '#fff' : COLOR_ETAPA[e.id] }} />
                {e.nombre} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>

        {vista === 'dias' ? (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            <button onClick={() => setOrigenFiltro(null)} className={filtro(!origenFiltro)}>
              De todas partes
            </button>
            {ORIGENES.map((o) => {
              const n = base.filter((c) => pasaEtapa(c) && origenDe(c).id === o.id).length
              if (!n) return null
              const on = origenFiltro === o.id
              return (
                <button key={o.id} onClick={() => setOrigenFiltro(on ? null : o.id)} className={`${filtro(on)} inline-flex items-center gap-1.5`} title={o.que}>
                  <span className="w-2 h-2 rounded-full" style={{ background: on ? '#fff' : o.color }} />
                  {o.nombre} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {hayFiltros ? (
          <p className="text-[12.5px] text-[#6B7280] flex flex-wrap items-center gap-x-2">
            <span>
              {visibles.length} {visibles.length === 1 ? 'persona' : 'personas'} con estos filtros
            </span>
            <button
              onClick={() => {
                setQ('')
                setEtapa(null)
                setOrigenFiltro(null)
                setCampana('')
              }}
              className="inline-flex items-center gap-1 font-semibold text-[#025dc7] hover:underline"
            >
              <X size={12} /> Quitar filtros
            </button>
          </p>
        ) : null}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 text-[13.5px] text-gray-500 py-6">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : !datos ? (
        <p className="text-[13.5px] text-gray-700 py-2">No se han podido cargar los contactos.</p>
      ) : lista.length === 0 ? (
        <p className="text-[13.5px] text-gray-700 py-2">
          {soloMatriculas ? 'Todavía no se ha matriculado nadie.' : 'Todavía no hay ningún contacto guardado.'}
        </p>
      ) : vista === 'origen' ? (
        <TableroOrigen items={ordenados} etapas={etapas} tarjeta={tarjeta} />
      ) : visibles.length === 0 ? (
        <p className="text-[13.5px] text-gray-700 py-2">Nadie coincide con estos filtros.</p>
      ) : t ? (
        // Buscando: todo junto, sin grupos plegados que escondan el resultado.
        <div className={`${TARJETA} p-2 space-y-1.5`}>
          {ordenados.map((c) => (
            <React.Fragment key={c.email}>{fila(c)}</React.Fragment>
          ))}
        </div>
      ) : (
        <div className={`${TARJETA} p-2 sm:p-3`}>
          <PorDia
            items={ordenados}
            fecha={fechaDe}
            clave={(c) => c.email}
            recordarComo={soloMatriculas ? 'contactos-matriculas' : 'contactos'}
            render={fila}
          />
        </div>
      )}
      {datos && datos.total > datos.mostrados ? (
        <p className="text-[12px] text-[#9CA3AF]">
          Se enseñan los {datos.mostrados} más recientes de {datos.total}. Usa el buscador para el resto.
        </p>
      ) : null}

      {/* Abajo y plegado: los números, los que están fuera y el mapa de la web. */}
      {datos && lista.length ? <NumerosPorEtapa items={lista} etapas={etapas} /> : null}

      {isAdmin && fuera.length ? (
        <Plegable
          titulo="Fuera de los números"
          icono={<EyeOff size={16} />}
          cifra={fuera.length}
          resumen="Pruebas: no cuentan en nada. Se pueden devolver."
          recordarComo="contactos.fuera"
          color="#6B7280"
        >
          <div className="mt-2 space-y-1.5">
            {fuera.map((c) => (
              <React.Fragment key={c.email}>{fila(c)}</React.Fragment>
            ))}
          </div>
        </Plegable>
      ) : null}

      {isCloser ? null : <MapaWeb />}

      {abierto ? (
        // La ficha completa del panel (la misma del tablero y de Tareas).
        <FichaCliente
          email={abierto}
          onClose={() => setAbierto(null)}
          onCambio={cargar}
          onQuitar={isAdmin && contactoAbierto ? () => quitar(contactoAbierto) : undefined}
          quitarEtiqueta={
            contactoAbierto?.fuera_de_metricas ? 'Volver a contar' : contactoAbierto?.etapa === 'alumno' ? 'Quitar de los números' : 'Borrar'
          }
          onCambioFecha={cambioFecha}
        />
      ) : null}
    </section>
  )
}
