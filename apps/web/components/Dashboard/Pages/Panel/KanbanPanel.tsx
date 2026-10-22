'use client'

/**
 * Matrículas en kanban: en qué punto está cada persona que pidió plaza, llegó
 * al pago, pidió una llamada o está pendiente en la lista de Llamadas.
 * Nuevo → Por llamar → Contactado → Seguimiento → Descartado → Alumno (09/10:
 * fuera Propuesta y En revisión, que se juntaron en Seguimiento —«va a
 * pagar» o «lo piensa» va en una nota, que la tarjeta enseña—; Perdido es
 * ahora Descartado). Se arrastra de una columna a otra en el ordenador.
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
 *
 * DOS MESAS (22/10/2026, entra un segundo closer): arriba se elige
 * **Leads** (del embudo a la llamada: Nuevo, Por llamar, No contesta,
 * Contactado, Descartado) o **Ventas** (de la llamada al cobro: Por asignar,
 * Agendada, No show, Seguimiento, Por pagar, Ganada, Perdida). Es la misma
 * tarjeta y la misma ficha; la columna decide la mesa. «Por asignar» son las
 * agendadas sin closer: se reparten con «Para mí» / «Para <otro>»
 * (`Reparto.tsx`). En Ventas, «Mías» enseña solo las tuyas (y las que están
 * por asignar, que son de todos).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  asignarCloser,
  CANALES,
  getTablero,
  guardarReparto,
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
import { CalendarCheck, CheckSquare, ChevronDown, ChevronsLeft, Eye, Loader2, PhoneCall, RotateCcw, Search, StickyNote, UserRound, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, filtro } from './ui'
import { BotonesReparto, nombreCorto, useReparto, type Reparto } from './Reparto'

// Un color por columna, solo en el punto junto al nombre y en tonos apagados.
// Primero eran tres azules seguidos ("hay más colores, no solo azul") y luego
// franjas de color arriba de cada columna, que "se ve algo IA, poco
// profesional" (28/09). El color distingue; no decora. Descartado era gris
// para que se viera "apagado", y parecía que le faltaba el color ("¿por qué
// no tiene color como los demás?", 13/10): ahora rojo oscuro, que se separa
// del naranja suave de Por pagar. No show, entre las dos, va en ciruela para
// no confundirse con ninguna. No contesta (14/10), junto a Por llamar, en
// verde oliva: el único tono que no estaba.
type Mesa = 'leads' | 'ventas'
/** Una columna de la pantalla: una etapa, o «Por asignar» (agendada sin closer). */
type ColumnaId = EtapaTablero | 'por-asignar'

const COLOR: Record<ColumnaId, string> = {
  'por-asignar': '#64748B',
  nuevo: '#5B8DEF',
  llamar: '#E07AA8',
  'no-contesta': '#8FA03C',
  contactado: '#9B87F5',
  agendado: '#D4A24C',
  seguimiento: '#3E9BB0',
  'pendiente-pago': '#D9826A',
  'no-show': '#9A5296',
  descartado: '#B4413C',
  alumno: '#2BA67A',
}

// Columnas plegadas: una tira estrecha con el nombre y la cuenta. Descartado
// nace plegada (es la que obligaba a desplazarse a la derecha) y lo que se
// pliega se recuerda en este navegador.
const PLEGADAS_DE_SERIE: ColumnaId[] = ['descartado']
const CLAVE_PLEGADAS = 'nawar.tablero.plegadas'
const CLAVE_MESA = 'nawar.tablero.mesa'
const CLAVE_MIAS = 'nawar.tablero.mias'

// Las columnas de cada mesa. En Ventas, Alumno es «Ganada» y Descartado,
// «Perdida» (el servidor pone en Ventas a quien se descarta tras una llamada).
const COLUMNAS: Record<Mesa, { id: ColumnaId; nombre: string }[]> = {
  leads: [
    { id: 'nuevo', nombre: 'Nuevo' },
    { id: 'llamar', nombre: 'Por llamar' },
    { id: 'no-contesta', nombre: 'No contesta' },
    { id: 'contactado', nombre: 'Contactado' },
    { id: 'descartado', nombre: 'Descartado' },
  ],
  ventas: [
    { id: 'por-asignar', nombre: 'Por asignar' },
    { id: 'agendado', nombre: 'Agendada' },
    { id: 'no-show', nombre: 'No show' },
    { id: 'seguimiento', nombre: 'Seguimiento' },
    { id: 'pendiente-pago', nombre: 'Por pagar' },
    { id: 'alumno', nombre: 'Ganada' },
    { id: 'descartado', nombre: 'Perdida' },
  ],
}
const EN_CURSO_VENTAS: EtapaTablero[] = ['agendado', 'no-show', 'seguimiento', 'pendiente-pago']

const mesaDe = (t: Tarjeta): Mesa => (t.mesa === 'ventas' ? 'ventas' : 'leads')
/** En qué columna de la pantalla sale: las agendadas sin closer, en «Por asignar». */
const columnaDe = (t: Tarjeta): ColumnaId =>
  mesaDe(t) === 'ventas' && t.etapa === 'agendado' && !t.closer_id ? 'por-asignar' : t.etapa

const POR_COLUMNA = 6

// En Nuevo, Por llamar y No contesta, la más caliente arriba (como en Llamadas).
const A_LLAMAR: EtapaTablero[] = ['nuevo', 'llamar', 'no-contesta']
const ORDEN_TEMPERATURA: Record<string, number> = { caliente: 0, templado: 1, frio: 2 }

/** «jue 16 oct · 18:00», en hora de Países Bajos. */
function diaHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
  return `${dia.replace(/\./g, '').replace(',', '')} · ${hora}`
}

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

function TarjetaVista({
  t,
  onAbrir,
  reparto,
  onAsignada,
}: {
  t: Tarjeta
  onAbrir: () => void
  reparto?: Reparto
  onAsignada?: (closerId: number, closer: string) => void
}) {
  // Sin cajitas de color (29/09, "que parezca un software"): una línea de
  // datos en gris con iconos pequeños. La última nota va entera (dos líneas)
  // y en negro: se lee sin abrir la tarjeta (09/10, "que una nota se pueda
  // leer desde fuera", p. ej. «va a pagar» o «lo piensa» en Seguimiento).
  // ⚠️ Un <div>, NO un <button>: @hello-pangea/dnd no deja empezar a
  // arrastrar desde un botón, y con <button> arrastrar no funcionaba nunca.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onAbrir()
      }}
      className={`w-full text-left rounded-md bg-white border border-[#E5E7EB] hover:border-[#9CA3AF] px-3 py-2.5 transition-colors outline-none focus-visible:border-gray-900 ${
        t.suelta ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      }`}
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
          {(t.llamada && t.llamada.origen !== 'mano' && t.llamada.detalle) || t.que_hizo ? (
            <p className="text-[12px] text-gray-600 line-clamp-2">
              {(t.llamada && t.llamada.origen !== 'mano' && t.llamada.detalle) || t.que_hizo}
            </p>
          ) : null}
        </div>
      ) : t.que_hizo ? (
        <p className="text-[12px] text-gray-500 truncate">{t.que_hizo}</p>
      ) : null}
      {t.ultima_nota ? (
        <p
          className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-gray-900"
          title={t.notas > 1 ? `${t.notas} notas · la última: ${t.ultima_nota}` : t.ultima_nota}
        >
          <StickyNote size={12} className="mt-[2px] shrink-0 text-gray-400" />
          <span className="line-clamp-2">{t.ultima_nota}</span>
        </p>
      ) : null}
      {t.volver_a_llamar?.fecha ? (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium ${tocaLlamar(t) ? 'text-red-600' : 'text-gray-700'}`}
          title={t.volver_a_llamar.motivo || 'Volver a llamar'}
        >
          <PhoneCall size={11} />
          Llamar {cuandoLlamar(t.volver_a_llamar.fecha)}
        </p>
      ) : null}
      {/* Reservó en Calendly (14/10): por eso está en Agendado. Si la llamada
          ya pasó, falta apuntar «¿Qué pasó?» en Llamadas. */}
      {t.cita?.inicio ? (
        new Date(t.cita.inicio).getTime() > Date.now() ? (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-gray-700" title="Reservada en Calendly">
            <CalendarCheck size={11} className="shrink-0" />
            Llamada {diaHora(t.cita.inicio)}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-[#B45309]" title="Apúntalo en Llamadas → ¿Qué pasó?">
            <CalendarCheck size={11} className="shrink-0" />
            Llamada del {diaHora(t.cita.inicio)} · falta «¿Qué pasó?»
          </p>
        )
      ) : null}
      {/* Ventas: quién la lleva; y en «Por asignar», repartirla sin abrirla. */}
      {mesaDe(t) === 'ventas' && t.closer ? (
        <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-gray-700" title="El closer que lleva su llamada">
          <UserRound size={11} className="shrink-0" />
          {t.closer_id === reparto?.yo ? 'Tuya' : nombreCorto(t.closer)}
        </p>
      ) : null}
      {reparto && columnaDe(t) === 'por-asignar' && onAsignada ? (
        <div className="mt-2">
          <BotonesReparto email={t.email} closerId={t.closer_id || 0} reparto={reparto} onHecho={onAsignada} pequeno />
        </div>
      ) : null}
      {t.reserva ? (
        <p className="mt-1 text-[11.5px] font-medium text-gray-900 tabular-nums" title="Plaza reservada: entra a la escuela cuando pague lo que falta">
          {t.reserva.pagado_cents > 0
            ? `Señal ${euros(t.reserva.pagado_cents)} · faltan ${euros(t.reserva.pendiente_cents)}`
            : 'Enlace de pago enviado, sin pagar'}
        </p>
      ) : null}
      {t.origen || t.canal || t.vio_precio || t.notas > 1 || t.tareas ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-gray-500">
          {/* De dónde viene (09/10): «Anuncio Meta», «Web · inicio», «Guía»…
              Desde el 14/10 con el anuncio concreto detrás: «Anuncio Meta · UGC-Laura». */}
          {t.origen ? (
            <span
              className={`max-w-full truncate ${t.origen.startsWith('Anuncio') ? 'font-medium text-gray-800' : ''}`}
              title={`De dónde viene: ${t.origen}`}
            >
              {t.origen}
            </span>
          ) : null}
          {t.canal ? <span>{NOMBRE_CANAL[t.canal]}</span> : null}
          {t.vio_precio ? (
            <span className="inline-flex items-center gap-1">
              <Eye size={11} /> vio precio
            </span>
          ) : null}
          {t.notas > 1 ? (
            <span title="Notas en su ficha" className="inline-flex items-center gap-1">
              <StickyNote size={11} /> {t.notas} notas
            </span>
          ) : null}
          {t.tareas ? (
            <span className="inline-flex items-center gap-1" title="Tareas pendientes">
              <CheckSquare size={11} /> {t.tareas}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
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
  // Leads o Ventas, y en Ventas, solo las mías (se recuerda en el navegador;
  // los correos de reparto abren con `?mesa=ventas`).
  const [mesa, setMesaEstado] = useState<Mesa>('leads')
  const [soloMias, setSoloMiasEstado] = useState<boolean | null>(null)
  const reparto = useReparto()
  // En el móvil se ve una columna cada vez.
  const [columnaMovil, setColumnaMovil] = useState<ColumnaId>('nuevo')
  useEffect(() => {
    try {
      const deLaDireccion = new URLSearchParams(window.location.search).get('mesa')
      const guardada = localStorage.getItem(CLAVE_MESA)
      const m = deLaDireccion === 'ventas' || deLaDireccion === 'leads' ? deLaDireccion : guardada
      if (m === 'ventas' || m === 'leads') {
        setMesaEstado(m)
        setColumnaMovil(COLUMNAS[m][0].id)
      }
      const mias = localStorage.getItem(CLAVE_MIAS)
      if (mias === '1' || mias === '0') setSoloMiasEstado(mias === '1')
    } catch {}
  }, [])
  function setMesa(m: Mesa) {
    setMesaEstado(m)
    setColumnaMovil(COLUMNAS[m][0].id)
    try {
      localStorage.setItem(CLAVE_MESA, m)
    } catch {}
  }
  function setSoloMias(v: boolean) {
    setSoloMiasEstado(v)
    try {
      localStorage.setItem(CLAVE_MIAS, v ? '1' : '0')
    } catch {}
  }
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
  // Sin elegir nada: el closer ve las suyas y quien dirige, todas.
  const mias = soloMias ?? !isAdmin

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

  // ⚠️ (17/10, "cambiamos algo y vuelve a su lugar"). Leer el tablero tarda
  // un par de segundos; si mientras tanto se movía una tarjeta, la respuesta
  // vieja llegaba DESPUÉS y la pintaba donde estaba antes. Ahora se tira
  // cualquier lectura que empezó antes de un movimiento (o con uno a medias),
  // y también una lectura que ya no es la última que se pidió.
  const lectura = useRef(0)
  const movimientos = useRef(0)
  const moviendo = useRef(0)
  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const mia = ++lectura.current
    const movimientosAlEmpezar = movimientos.current
    const habiaUnoAMedias = moviendo.current > 0
    const r = await getTablero(org.id, accessToken)
    if (mia !== lectura.current || movimientos.current !== movimientosAlEmpezar || habiaUnoAMedias) return
    if (r.ok && r.datos) setDatos(r.datos)
    else setError(r.error || 'No se ha podido cargar el tablero')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las de esta mesa; en Ventas con «Mías», las mías y las que están por
  // asignar (son de todos hasta que alguien se las queda).
  const deLaMesa = useMemo(
    () =>
      (datos?.tarjetas ?? []).filter(
        (c) =>
          !c.oculto &&
          mesaDe(c) === mesa &&
          (mesa !== 'ventas' || !mias || c.closer_id === reparto.yo || columnaDe(c) === 'por-asignar')
      ),
    [datos, mesa, mias, reparto.yo]
  )
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return deLaMesa.filter(
      (c) =>
        (!canal || c.canal === canal) &&
        (!soloHoy || tocaLlamar(c)) &&
        (!t || c.email.includes(t) || c.nombre.toLowerCase().includes(t) || c.telefono.includes(t))
    )
  }, [deLaMesa, q, canal, soloHoy])
  const paraHoy = useMemo(() => deLaMesa.filter((c) => tocaLlamar(c)).length, [deLaMesa])
  const enCadaMesa = useMemo(() => {
    const n = { leads: 0, ventas: 0 }
    for (const c of datos?.tarjetas ?? []) if (!c.oculto && c.etapa !== 'alumno' && c.etapa !== 'descartado') n[mesaDe(c)]++
    return n
  }, [datos])
  // Cómo va cada closer en Ventas: en curso y ganadas.
  const porCloser = useMemo(() => {
    const m = new Map<number, { nombre: string; curso: number; ganadas: number }>()
    for (const c of datos?.tarjetas ?? []) {
      if (c.oculto || mesaDe(c) !== 'ventas' || !c.closer_id) continue
      const x = m.get(c.closer_id) ?? { nombre: c.closer || '', curso: 0, ganadas: 0 }
      if (EN_CURSO_VENTAS.includes(c.etapa)) x.curso++
      if (c.etapa === 'alumno') x.ganadas++
      m.set(c.closer_id, x)
    }
    return Array.from(m.entries()).map(([id, x]) => ({ id, ...x }))
  }, [datos])
  const columnas = COLUMNAS[mesa]

  const porColumna = useMemo(() => {
    const m: Record<string, Tarjeta[]> = {}
    for (const e of columnas) m[e.id] = []
    for (const c of filtradas) (m[columnaDe(c)] ??= []).push(c)
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
  }, [columnas, filtradas])

  // Asignada desde «Por asignar» (o la ficha): se ve ya y se relee.
  function asignada(id: string, closerId: number, closer: string, releer = true) {
    setDatos((d) => (d ? { ...d, tarjetas: d.tarjetas.map((t) => (t.id === id ? { ...t, closer_id: closerId, closer } : t)) } : d))
    if (releer) cargar()
  }

  // Al arrastrar: se ve ya, y se relee cuando el servidor lo ha guardado.
  async function cambiarCloser(tarjeta: Tarjeta, closerId: number) {
    const quien = reparto.equipo.find((m) => m.id === closerId)
    asignada(tarjeta.id, closerId, quien?.nombre ?? '', false)
    const r = await asignarCloser(org?.id, tarjeta.email, closerId, accessToken)
    if (!r.ok) {
      asignada(tarjeta.id, tarjeta.closer_id || 0, tarjeta.closer || '', false)
      toast.error(r.error || 'No se ha podido asignar')
      return
    }
    if (moviendo.current === 0) cargar()
  }

  async function alSoltar(r: DropResult) {
    if (!r.destination || !datos) return
    const columnaDestino = r.destination.droppableId as ColumnaId
    const id = r.draggableId
    const tarjeta = datos.tarjetas.find((t) => t.id === id)
    if (!tarjeta || columnaDe(tarjeta) === columnaDestino || tarjeta.suelta) return
    if (columnaDestino === 'alumno' || tarjeta.etapa === 'alumno') {
      toast('Ganada (Alumno) se llena sola cuando alguien paga.')
      return
    }
    const destino: EtapaTablero = columnaDestino === 'por-asignar' ? 'agendado' : columnaDestino
    // Soltarla en «Por asignar» le quita el closer; soltar en Agendada una sin
    // closer es quedársela (si no, volvería a salir en «Por asignar»).
    const closerNuevo =
      columnaDestino === 'por-asignar' ? 0 : columnaDestino === 'agendado' && !tarjeta.closer_id ? reparto.yo : null
    if (destino === tarjeta.etapa) {
      if (closerNuevo !== null) await cambiarCloser(tarjeta, closerNuevo)
      return
    }
    // Se mueve ya en pantalla y, si el servidor dice que no, se deshace (solo
    // esa tarjeta: puede haber otras moviéndose a la vez).
    const origen = tarjeta.etapa
    const ponerEn = (etapa: EtapaTablero, extra: Partial<Tarjeta> = {}) =>
      setDatos((d) => (d ? { ...d, tarjetas: d.tarjetas.map((t) => (t.id === id ? { ...t, etapa, ...extra } : t)) } : d))
    movimientos.current++
    moviendo.current++
    ponerEn(destino, { desde: new Date().toISOString(), llamada: A_LLAMAR.includes(destino) ? tarjeta.llamada : null })
    const res = await moverTarjeta(
      org?.id,
      { email: tarjeta.email, etapa: destino, nombre: tarjeta.nombre, telefono: tarjeta.telefono },
      accessToken
    )
    if (res.ok && closerNuevo !== null) {
      // Primero la columna y luego el closer: así no compiten por la misma fila.
      const quien = reparto.equipo.find((m) => m.id === closerNuevo)
      asignada(tarjeta.id, closerNuevo, quien?.nombre ?? '', false)
      const a = await asignarCloser(org?.id, tarjeta.email, closerNuevo, accessToken)
      if (!a.ok) toast.error(a.error || 'Movida, pero no se ha podido asignar')
    }
    moviendo.current--
    if (!res.ok) {
      ponerEn(origen, { desde: tarjeta.desde, llamada: tarjeta.llamada })
      toast.error(res.error || 'No se ha podido mover')
      return
    }
    // Se relee siempre: así lo que se ve es lo que ha guardado el servidor
    // (Llamadas a juego, la temperatura…). Si hay otro movimiento a medias,
    // esta lectura se tira y la hará el último.
    if (moviendo.current === 0) cargar()
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
      {/* Leads o Ventas (22/10). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5">
          {(['leads', 'ventas'] as Mesa[]).map((m) => (
            <button
              key={m}
              onClick={() => setMesa(m)}
              className={`h-8 px-3.5 rounded-md text-[13px] font-semibold inline-flex items-center gap-1.5 ${
                mesa === m ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-[#F9FAFB]'
              }`}
            >
              {m === 'leads' ? 'Leads' : 'Ventas'}
              <span className={`tabular-nums text-[12px] ${mesa === m ? 'opacity-70' : 'text-[#9CA3AF]'}`}>{enCadaMesa[m]}</span>
            </button>
          ))}
        </div>
        {mesa === 'ventas' ? (
          <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5">
            {[
              { v: true, nombre: 'Mías' },
              { v: false, nombre: 'Todas' },
            ].map((o) => (
              <button
                key={o.nombre}
                onClick={() => setSoloMias(o.v)}
                className={`h-8 px-3 rounded-md text-[12.5px] font-semibold ${
                  mias === o.v ? 'bg-[#F3F4F6] text-gray-900' : 'text-[#6B7280] hover:text-gray-900'
                }`}
              >
                {o.nombre}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-3xl">
        {mesa === 'leads' ? (
          <>
            Lo que entra va a Nuevo, en rojo: llámale ya. Si en 48 horas nadie ha hablado con esa persona, pasa sola a Por llamar.
            Cuando reserva una llamada, pasa a Ventas.
          </>
        ) : (
          <>
            Cada llamada que se reserva entra en Por asignar y le llega un correo a quien reparte. Pulsa «Para mí» o pásasela
            al otro closer: le llegará un correo con la llamada.
          </>
        )}{' '}
        Ábrela para ver todo, sus notas y cambiarla de columna<span className="hidden lg:inline"> (o arrástrala)</span>.
      </p>

      {mesa === 'ventas' && (porCloser.length || isAdmin) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[#6B7280]">
          {porCloser.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <UserRound size={12} className="text-gray-400" />
              <span className="font-semibold text-gray-900">{c.id === reparto.yo ? 'Tú' : nombreCorto(c.nombre)}</span>
              {c.curso} en curso · {c.ganadas} {c.ganadas === 1 ? 'ganada' : 'ganadas'}
            </span>
          ))}
          {isAdmin && reparto.equipo.length ? (
            <label className="w-full sm:w-auto sm:ml-auto flex items-center gap-1.5">
              <span className="shrink-0">Reparte las llamadas:</span>
              <select
                value={reparto.repartidorId}
                onChange={async (e) => {
                  const r = await guardarReparto(org?.id, Number(e.target.value), accessToken)
                  if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
                  toast.success('Guardado')
                  reparto.recargar()
                }}
                className="min-w-0 flex-1 sm:flex-none h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-[12.5px] text-gray-900"
              >
                <option value={0}>Nadie (avisa a los administradores)</option>
                {reparto.equipo.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

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
          {columnas.map((e) => (
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
            <TarjetaVista
              key={t.id}
              t={t}
              onAbrir={() => setAbierta(t.id)}
              reparto={reparto}
              onAsignada={(id, nombre) => asignada(t.id, id, nombre)}
            />
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
              gridTemplateColumns: columnas.map((e) => (plegadas.includes(e.id) ? '44px' : 'minmax(180px,1fr)')).join(' '),
              minWidth: columnas.reduce((n, e) => n + (plegadas.includes(e.id) ? 44 : 180) + 10, 0),
            }}
          >
            {columnas.map((e) => {
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
                              <TarjetaVista
                                t={t}
                                onAbrir={() => setAbierta(t.id)}
                                reparto={reparto}
                                onAsignada={(id, nombre) => asignada(t.id, id, nombre)}
                              />
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
