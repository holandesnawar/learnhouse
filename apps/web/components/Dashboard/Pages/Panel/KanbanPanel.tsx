'use client'

/**
 * Matrículas en kanban: en qué punto está cada persona que pidió plaza, llegó
 * al pago, pidió una llamada o está pendiente en la lista de Llamadas.
 * Nuevo → Por llamar → Contactado → En revisión → Seguimiento → Descartado →
 * Alumno (09/10: fuera Propuesta, que se decide en la llamada; Perdido es
 * ahora Descartado).
 *
 * TODO LO QUE ENTRA, A LLAMAR: Nuevo si llegó hace menos de 48 h (rojo,
 * «llamar ya»), Por llamar si es más antiguo y nadie ha hablado con él (o no
 * vino a su llamada). Las dos con su temperatura a la vista (como en Llamadas)
 * y, si se quedó a medias, dónde. Sacar a alguien de ahí lo marca como hecho
 * en Llamadas. Los de Llamadas sin ficha (solo con el móvil) salen sueltos:
 * no se arrastran y se abren con su detalle de Llamadas (`LlamadaSuelta`).
 * Sin explicación bajo cada columna (09/10: "es obvio").
 *
 * «Llamar hoy» (08/10, el closer ya no tiene Contactos): la tarjeta enseña la
 * fecha de volver a llamar, en rojo si toca, y arriba hay un filtro con las
 * que tocan hoy o se pasaron.
 *
 * Se arrastra la tarjeta de una columna a otra (ordenador) o se abre y se elige
 * la columna (móvil). "Alumno" no se arrastra: sale sola al pagar.
 * En cada columna, lo más nuevo arriba (el día que llegó).
 *
 * Borrar (solo administradores), dentro de la ficha de cada persona —en la
 * tarjeta ocupaba demasiado (28/09)—: a quien no ha pagado se le BORRA; a un
 * alumno no (hay cobro y factura), y se elige entre quitarlo solo del tablero
 * o, si era una prueba, también de los números. Antes a un alumno solo se le
 * quitaba de los números y la tarjeta seguía ahí: "no puedo borrarla".
 * La lógica de qué va en cada columna vive en el servidor
 * (`apps/api/src/services/panel/pipeline.py`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  CANALES,
  getTablero,
  haceCuanto,
  moverTarjeta,
  NOMBRE_CANAL,
  ocultarTarjeta,
  type EtapaTablero,
  euros,
  type Tablero,
  type Tarjeta,
} from '@services/panel/panel'
import FichaCliente from './FichaCliente'
import LlamadaSuelta from './LlamadaSuelta'
import { Termometro } from '../Estadisticas/LlamadasTempladas'
import { cuandoLlamar, hoyISO } from '@services/stats/contactos'
import { quitarPersona } from './quitarPersona'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { quitarDeMetricas, volverAContar } from '@services/stats/contactos'
import { CheckSquare, ChevronDown, ChevronsLeft, Eye, Loader2, PhoneCall, RotateCcw, Search, StickyNote, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, filtro } from './ui'

// Un color por columna, solo en el punto junto al nombre y en tonos apagados.
// Primero eran tres azules seguidos ("hay más colores, no solo azul") y luego
// franjas de color arriba de cada columna, que "se ve algo IA, poco
// profesional" (28/09). El color distingue; no decora.
const COLOR: Record<EtapaTablero, string> = {
  nuevo: '#5B8DEF',
  llamar: '#E07AA8',
  contactado: '#9B87F5',
  revision: '#D9A93E',
  seguimiento: '#3E9BB0',
  descartado: '#A3ACBA',
  alumno: '#2BA67A',
}

// Columnas plegadas: una tira estrecha con el nombre y la cuenta. Descartado
// nace plegada (es la que obligaba a desplazarse a la derecha) y lo que se
// pliega se recuerda en este navegador.
const PLEGADAS_DE_SERIE: EtapaTablero[] = ['descartado']
const CLAVE_PLEGADAS = 'nawar.tablero.plegadas'

const POR_COLUMNA = 6

// En Nuevo y Por llamar, la más caliente arriba (como en Llamadas).
const A_LLAMAR: EtapaTablero[] = ['nuevo', 'llamar']
const ORDEN_TEMPERATURA: Record<string, number> = { caliente: 0, templado: 1, frio: 2 }

/** La fecha de volver a llamar toca hoy o ya se pasó. */
const tocaLlamar = (t: Tarjeta) => Boolean(t.volver_a_llamar?.fecha && t.volver_a_llamar.fecha <= hoyISO())

function VerMas({ id, total, vistas, onMas }: { id: string; total: number; vistas: number; onMas: (id: string) => void }) {
  if (total <= vistas) return null
  return (
    <button
      onClick={() => onMas(id)}
      className="w-full inline-flex items-center justify-center gap-1 rounded-md py-1.5 text-[12.5px] font-medium text-gray-600 hover:text-gray-900 hover:bg-white"
    >
      <ChevronDown size={13} />
      {total - vistas <= 20 ? `Ver ${total - vistas === 1 ? 'la que falta' : `las ${total - vistas} que faltan`}` : `Ver 20 más · quedan ${total - vistas}`}
    </button>
  )
}

function TarjetaVista({ t, onAbrir }: { t: Tarjeta; onAbrir: () => void }) {
  // Sin cajitas de color (29/09, "que parezca un software"): una línea de
  // datos en gris con iconos pequeños. Las notas van en negro para que se
  // vean de un vistazo, que es para lo que están (pedido del 28/09).
  return (
    <button
      onClick={onAbrir}
      className="w-full text-left rounded-md bg-white border border-[#E5E7EB] hover:border-[#9CA3AF] px-3 py-2.5 transition-colors"
    >
      <div className="flex items-baseline gap-2">
        <p className="flex-1 min-w-0 text-[13.5px] font-medium text-gray-900 truncate">{t.nombre || t.email}</p>
        <span className="shrink-0 text-[11.5px] text-gray-400 tabular-nums" title="Cuándo llegó">
          {haceCuanto(t.llegada || t.desde)}
        </span>
      </div>
      {A_LLAMAR.includes(t.etapa) && t.temperatura ? (
        <div className="mt-0.5">
          <span className="text-[11.5px]">
            <Termometro t={t.temperatura} aMano={Boolean(t.llamada?.temperatura_manual)} />
          </span>
          {/* Dónde se quedó, si está pendiente en Llamadas (o la última nota,
              si la apuntaron a mano); si no, lo último que hizo. */}
          <p className="text-[12px] text-gray-600 line-clamp-2">
            {(t.llamada && ((t.llamada.origen !== 'mano' && t.llamada.detalle) || t.ultima_nota)) || t.que_hizo}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-gray-500 truncate">{t.que_hizo}</p>
      )}
      {t.volver_a_llamar?.fecha ? (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium ${tocaLlamar(t) ? 'text-red-600' : 'text-gray-700'}`}
          title={t.volver_a_llamar.motivo || 'Volver a llamar'}
        >
          <PhoneCall size={11} />
          Llamar {cuandoLlamar(t.volver_a_llamar.fecha)}
        </p>
      ) : null}
      {t.reserva ? (
        <p className="mt-1 text-[11.5px] font-medium text-gray-900 tabular-nums" title="Plaza reservada: entra a la escuela cuando pague lo que falta">
          {t.reserva.pagado_cents > 0
            ? `Señal ${euros(t.reserva.pagado_cents)} · faltan ${euros(t.reserva.pendiente_cents)}`
            : 'Enlace de señal enviado, sin pagar'}
        </p>
      ) : null}
      {t.canal || t.vio_precio || t.notas || t.tareas ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-gray-500">
          {t.canal ? <span>{NOMBRE_CANAL[t.canal]}</span> : null}
          {t.vio_precio ? (
            <span className="inline-flex items-center gap-1">
              <Eye size={11} /> vio precio
            </span>
          ) : null}
          {t.notas ? (
            <span title={t.ultima_nota ? `Última nota: ${t.ultima_nota}` : 'Tiene notas'} className="inline-flex items-center gap-1 font-medium text-gray-900">
              <StickyNote size={11} /> {t.notas}
            </span>
          ) : null}
          {t.tareas ? (
            <span className="inline-flex items-center gap-1" title="Tareas pendientes">
              <CheckSquare size={11} /> {t.tareas}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

export default function KanbanPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Tablero | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [canal, setCanal] = useState<string>('')
  const [soloHoy, setSoloHoy] = useState(false)
  // La tarjeta abierta (por su id: el correo, o «llamada:<id>» en las sueltas).
  const [abierta, setAbierta] = useState<string | null>(null)
  // En el móvil se ve una columna cada vez.
  const [columnaMovil, setColumnaMovil] = useState<EtapaTablero>('nuevo')
  // Cuántas se ven por columna: las más nuevas y "Ver más" para el resto, así
  // no hay que bajar por todas cuando se ha contactado a mucha gente.
  const [cuantas, setCuantas] = useState<Record<string, number>>({})
  const [plegadas, setPlegadas] = useState<string[]>(PLEGADAS_DE_SERIE)
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_PLEGADAS) || 'null')
      // «perdido» se llama ahora «descartado» (09/10).
      if (Array.isArray(g)) setPlegadas(g.map((x: string) => (x === 'perdido' ? 'descartado' : x)))
    } catch {}
  }, [])
  function plegar(id: string) {
    const nuevas = plegadas.includes(id) ? plegadas.filter((x) => x !== id) : [...plegadas, id]
    setPlegadas(nuevas)
    try {
      localStorage.setItem(CLAVE_PLEGADAS, JSON.stringify(nuevas))
    } catch {}
  }
  const verCuantas = (id: string) => (q.trim() ? Infinity : cuantas[id] ?? POR_COLUMNA)
  const verMas = (id: string) => setCuantas((c) => ({ ...c, [id]: (c[id] ?? POR_COLUMNA) + 20 }))
  const { isAdmin } = useAdminStatus()

  // Alumno que se quiere quitar: se pregunta cómo (solo del tablero o también de los números).
  const [pregunta, setPregunta] = useState<Tarjeta | null>(null)
  const [verQuitadas, setVerQuitadas] = useState(false)
  const [haciendo, setHaciendo] = useState(false)

  async function borrar(t: Tarjeta) {
    if (t.etapa === 'alumno') {
      setPregunta(t)
      return
    }
    const r = await quitarPersona(org?.id, accessToken, { email: t.email, nombre: t.nombre, esAlumno: false })
    if (r) {
      setAbierta(null)
      cargar()
    }
  }

  async function quitarAlumno(t: Tarjeta, tambienNumeros: boolean) {
    setHaciendo(true)
    const r = tambienNumeros ? await quitarDeMetricas(org?.id, t.email, accessToken) : await ocultarTarjeta(org?.id, t.email, true, accessToken)
    setHaciendo(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    toast.success(tambienNumeros ? 'Quitado del tablero y de los números' : 'Quitado del tablero')
    setPregunta(null)
    setAbierta(null)
    cargar()
  }

  async function devolver(t: Tarjeta) {
    if (t.fuera_de_metricas) {
      const r = await volverAContar(org?.id, t.email, accessToken)
      if (!r.ok) {
        toast.error(r.error || 'No se ha podido devolver')
        return
      }
    }
    const r = await ocultarTarjeta(org?.id, t.email, false, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido devolver')
      return
    }
    toast.success(t.fuera_de_metricas ? 'Vuelve al tablero y a los números' : 'Vuelve al tablero')
    cargar()
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getTablero(org.id, accessToken)
    if (r.ok && r.datos) setDatos(r.datos)
    else setError(r.error || 'No se ha podido cargar el tablero')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (datos?.tarjetas ?? []).filter(
      (c) =>
        !c.oculto &&
        (!canal || c.canal === canal) &&
        (!soloHoy || tocaLlamar(c)) &&
        (!t || c.email.includes(t) || c.nombre.toLowerCase().includes(t) || c.telefono.includes(t))
    )
  }, [datos, q, canal, soloHoy])
  const paraHoy = useMemo(() => (datos?.tarjetas ?? []).filter((c) => !c.oculto && tocaLlamar(c)).length, [datos])

  const porColumna = useMemo(() => {
    const m: Record<string, Tarjeta[]> = {}
    for (const e of datos?.etapas ?? []) m[e.id] = []
    for (const c of filtradas) (m[c.etapa] ??= []).push(c)
    // Lo más nuevo arriba, lo más antiguo abajo (pedido del usuario, 28/09).
    const cuando = (t: Tarjeta) => {
      const x = t.llegada || t.desde || ''
      const d = Date.parse(x.includes('T') && !/[zZ]|[+-]\d\d:?\d\d$/.test(x) ? `${x}Z` : x)
      return Number.isNaN(d) ? 0 : d
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => cuando(b) - cuando(a))
    // Nuevo y Por llamar: la más caliente arriba; dentro, la más nueva.
    for (const k of A_LLAMAR)
      m[k]?.sort(
        (a, b) => (ORDEN_TEMPERATURA[a.temperatura ?? 'frio'] ?? 2) - (ORDEN_TEMPERATURA[b.temperatura ?? 'frio'] ?? 2) || cuando(b) - cuando(a)
      )
    return m
  }, [datos, filtradas])

  async function alSoltar(r: DropResult) {
    if (!r.destination || !datos) return
    const destino = r.destination.droppableId as EtapaTablero
    const id = r.draggableId
    const tarjeta = datos.tarjetas.find((t) => t.id === id)
    if (!tarjeta || tarjeta.etapa === destino || tarjeta.suelta) return
    if (destino === 'alumno' || tarjeta.etapa === 'alumno') {
      toast('La columna Alumno se llena sola cuando alguien paga.')
      return
    }
    // Se mueve ya en pantalla y, si el servidor dice que no, se deshace.
    const antes = datos
    setDatos({
      ...datos,
      tarjetas: datos.tarjetas.map((t) =>
        t.id === id ? { ...t, etapa: destino, desde: new Date().toISOString(), llamada: A_LLAMAR.includes(destino) ? t.llamada : null } : t
      ),
    })
    const res = await moverTarjeta(
      org?.id,
      { email: tarjeta.email, etapa: destino, nombre: tarjeta.nombre, telefono: tarjeta.telefono },
      accessToken
    )
    if (!res.ok) {
      setDatos(antes)
      toast.error(res.error || 'No se ha podido mover')
      return
    }
    // Salir de Nuevo / Por llamar la marca como hecha en Llamadas: se relee.
    if (A_LLAMAR.includes(tarjeta.etapa) || A_LLAMAR.includes(destino)) cargar()
  }

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={24} />}
      </div>
    )
  }

  const quitadas = (datos.tarjetas ?? []).filter((c) => c.oculto)
  const tarjetaAbierta = abierta ? datos.tarjetas.find((c) => c.id === abierta) : undefined
  const total = filtradas.length
  const abiertos = filtradas.filter((c) => c.etapa !== 'alumno' && c.etapa !== 'descartado').length

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-3xl">
        Lo que entra va a Nuevo, en rojo: llámale ya. Si en 48 horas nadie ha hablado con esa persona, pasa sola a Por llamar.
        Ábrela para ver todo, sus notas y cambiarla de columna<span className="hidden lg:inline"> (o arrástrala)</span>.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            className="w-full h-9 bg-white border border-[#E5E7EB] rounded-md pl-9 pr-3 text-[13.5px] text-gray-900 outline-none focus:border-gray-900"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setSoloHoy((v) => !v)}
            className={`${filtro(soloHoy)} inline-flex items-center gap-1.5`}
            title="Las que tienen la fecha de volver a llamar hoy o ya pasada"
          >
            <PhoneCall size={13} className={soloHoy ? '' : paraHoy ? 'text-red-600' : 'text-gray-400'} />
            Llamar hoy <span className="tabular-nums opacity-80">{paraHoy}</span>
          </button>
          <button
            onClick={() => setCanal('')}
            className={filtro(!canal)}
          >
            Todos los canales
          </button>
          {CANALES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCanal(canal === c.id ? '' : c.id)}
              className={filtro(canal === c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-[#9CA3AF]">
        {total} {total === 1 ? 'persona' : 'personas'} · {abiertos} en curso
        {isAdmin && quitadas.length ? (
          <>
            {' · '}
            <button onClick={() => setVerQuitadas((v) => !v)} className="font-semibold text-[#025dc7] hover:underline">
              {quitadas.length} quitadas del tablero {verQuitadas ? '(ocultar)' : '(ver)'}
            </button>
          </>
        ) : null}
      </p>

      {isAdmin && verQuitadas && quitadas.length ? (
        <div className="rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6]">
          {quitadas.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{t.nombre || t.email}</p>
                <p className="text-[11.5px] text-[#9CA3AF] truncate">
                  {t.fuera_de_metricas ? 'Prueba: fuera del tablero y de los números' : 'Quitado del tablero (sigue contando)'}
                </p>
              </div>
              <button
                onClick={() => devolver(t)}
                className={BOTON}
              >
                <RotateCcw size={12} /> Devolver
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Móvil: una columna cada vez, con pestañas */}
      <div className="lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {datos.etapas.map((e) => (
            <button
              key={e.id}
              onClick={() => setColumnaMovil(e.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${
                columnaMovil === e.id ? 'bg-gray-900 text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: COLOR[e.id] }} />
              {e.nombre} <span className="opacity-70">{porColumna[e.id]?.length ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          {(porColumna[columnaMovil] ?? []).slice(0, verCuantas(columnaMovil)).map((t) => (
            <TarjetaVista key={t.id} t={t} onAbrir={() => setAbierta(t.id)} />
          ))}
          <VerMas id={columnaMovil} total={porColumna[columnaMovil]?.length ?? 0} vistas={verCuantas(columnaMovil)} onMas={verMas} />
          {!porColumna[columnaMovil]?.length ? <p className="text-[13px] text-[#9CA3AF] py-6 text-center">Nadie en esta columna.</p> : null}
        </div>
      </div>

      {/* Ordenador: el tablero entero */}
      <div className="hidden lg:block overflow-x-auto pb-2">
        <DragDropContext onDragEnd={alSoltar}>
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: datos.etapas.map((e) => (plegadas.includes(e.id) ? '44px' : 'minmax(180px,1fr)')).join(' '),
              minWidth: datos.etapas.reduce((n, e) => n + (plegadas.includes(e.id) ? 44 : 180) + 10, 0),
            }}
          >
            {datos.etapas.map((e) => {
              const plegada = plegadas.includes(e.id)
              const n = porColumna[e.id]?.length ?? 0
              return (
              <Droppable droppableId={e.id} key={e.id} isDropDisabled={e.id === 'alumno'}>
                {(prov, snap) =>
                  plegada ? (
                    // Plegada: se sigue pudiendo soltar una tarjeta encima.
                    <div
                      ref={prov.innerRef}
                      {...prov.droppableProps}
                      className={`rounded-lg border min-h-[420px] transition-colors ${
                        snap.isDraggingOver ? 'bg-[#F3F4F6] border-[#9CA3AF]' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                      }`}
                    >
                      <button
                        onClick={() => plegar(e.id)}
                        title={`Desplegar ${e.nombre}`}
                        className="w-full h-full min-h-[420px] flex flex-col items-center gap-2 pt-3 text-[#6B7280] hover:text-gray-900"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: COLOR[e.id] }} />
                        <span className="text-[12px] font-semibold tabular-nums">{n}</span>
                        <span className="text-[12.5px] font-semibold [writing-mode:vertical-rl]">{e.nombre}</span>
                      </button>
                      <div className="hidden">{prov.placeholder}</div>
                    </div>
                  ) : (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={`rounded-lg border p-2 min-h-[420px] transition-colors ${
                      snap.isDraggingOver ? 'bg-[#F3F4F6] border-[#9CA3AF]' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                    }`}
                  >
                    <div className="px-1.5 pt-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR[e.id] }} />
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{e.nombre}</p>
                        <span className="text-[12px] font-medium text-[#9CA3AF] tabular-nums">{n}</span>
                        <button
                          onClick={() => plegar(e.id)}
                          title="Plegar columna"
                          aria-label={`Plegar ${e.nombre}`}
                          className="ml-auto p-1 rounded-md text-[#A3ACBA] hover:text-gray-900 hover:bg-white"
                        >
                          <ChevronsLeft size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(porColumna[e.id] ?? []).slice(0, verCuantas(e.id)).map((t, i) => (
                        <Draggable draggableId={t.id} index={i} key={t.id} isDragDisabled={t.etapa === 'alumno' || Boolean(t.suelta)}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <TarjetaVista t={t} onAbrir={() => setAbierta(t.id)} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      <VerMas id={e.id} total={n} vistas={verCuantas(e.id)} onMas={verMas} />
                    </div>
                  </div>
                  )
                }
              </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {pregunta ? (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => !haciendo && setPregunta(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <p className="flex-1 text-[16px] font-bold text-gray-900">Quitar a {pregunta.nombre || pregunta.email}</p>
              <button onClick={() => setPregunta(null)} aria-label="Cerrar" className="p-1 text-[#9CA3AF] hover:text-gray-900">
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-[#6B7280] leading-relaxed">
              Ya es alumno: su cuenta, su acceso a la escuela y su pago no se borran nunca desde aquí.
            </p>
            <div className="mt-4 space-y-2">
              <button
                disabled={haciendo}
                onClick={() => quitarAlumno(pregunta, false)}
                className="w-full text-left rounded-md border border-[#E5E7EB] hover:bg-[#F9FAFB] px-4 py-3 disabled:opacity-60"
              >
                <p className="text-[14px] font-semibold text-gray-900">Quitarlo solo del tablero</p>
                <p className="text-[12.5px] text-[#6B7280]">Es un alumno de verdad. Sigue contando en ventas y alumnos.</p>
              </button>
              <button
                disabled={haciendo}
                onClick={() => quitarAlumno(pregunta, true)}
                className="w-full text-left rounded-md border border-[#FCA5A5] hover:bg-red-50 px-4 py-3 disabled:opacity-60"
              >
                <p className="text-[14px] font-semibold text-red-700">Era una prueba: quitarlo también de los números</p>
                <p className="text-[12.5px] text-[#6B7280]">Deja de contar en ventas, alumnos, gastos y plazas.</p>
              </button>
            </div>
            <p className="mt-3 text-[12px] text-[#9CA3AF]">Se puede deshacer desde «quitadas del tablero».</p>
          </div>
        </div>
      ) : null}

      {tarjetaAbierta?.suelta && tarjetaAbierta.llamada ? (
        <LlamadaSuelta key={tarjetaAbierta.id} llamada={tarjetaAbierta.llamada} onClose={() => setAbierta(null)} onCambio={cargar} />
      ) : abierta && tarjetaAbierta ? (
        <FichaCliente
          email={tarjetaAbierta.email}
          onClose={() => setAbierta(null)}
          onCambio={cargar}
          onQuitar={isAdmin && tarjetaAbierta ? () => borrar(tarjetaAbierta) : undefined}
          quitarEtiqueta={tarjetaAbierta?.etapa === 'alumno' ? 'Quitar del tablero' : 'Borrar'}
        />
      ) : null}
    </div>
  )
}
