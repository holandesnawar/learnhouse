'use client'

/**
 * Las semanas de una clase en directo, en la página del curso (28/10/2026).
 *
 * Debajo de la franja (fecha y «Entrar a la clase»): «Esta semana · De
 * kleding» con lo que tiene esa semana (presentación, grabación, ejercicios y
 * la tarea) y si el alumno ya lo ha hecho; antes, la «Próxima clase» si su
 * presentación ya está; y abajo las semanas anteriores, plegadas. Cada semana
 * es un capítulo del curso marcado como semana (apps/api/src/services/tareas).
 * El administrador ve además «Nueva semana», «Editar» y el seguimiento.
 *
 * Desde el 06/11/2026 ya no hay «Sesiones grabadas» por meses debajo (usuario:
 * "debe ser estilo próxima semana y esta semana"): las grabaciones de antes
 * van en su semana y, la que no tiene, sale en «Clases anteriores» como una
 * clase más, con su día y su profe (lo coloca el servidor, `colocar_sueltas`).
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Megaphone,
  Mic,
  PenLine,
  Pencil,
  Plus,
  Users,
  Video,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { pasosDeSemana, FilaPaso } from '@components/Pages/Clases/pasosSemana'
import { Vienes } from '@components/Pages/Clases/Vienes'
import { getUriWithOrg } from '@services/config/config'
import toast from 'react-hot-toast'
import {
  diaCorto,
  editarSemana,
  getSemanas,
  type ClaseArchivo,
  type ClaseSemana,
  type Semana,
  type SemanasClase as DatosSemanas,
} from '@services/tareas/tareas'
import { CasillasCampana, EditarSemana, NuevaSemana } from './SemanaModales'
import { AvisarClase } from './AvisarClase'

export const claveSemanas = (courseUuid: string) => ['tareas', 'semanas', String(courseUuid || '').replace(/^course_/, '')]

/** Las semanas de la clase (también las usa la página para no repetir esos capítulos en «Sesiones grabadas»). */
export function useSemanasClase(courseUuid: string, activo = true) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  return useQuery<DatosSemanas>({
    queryKey: claveSemanas(courseUuid),
    queryFn: () => getSemanas(courseUuid, token),
    enabled: !!courseUuid && !!token && activo,
    staleTime: 30_000,
    retry: 1,
  })
}

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

function Icono({ tipo }: { tipo: string }) {
  const props = { size: 22, strokeWidth: 1.6, className: 'text-[#0b2da0]' }
  return (
    <div className="w-7 flex items-center justify-center shrink-0">
      {tipo === 'presentacion' ? (
        <FileText {...props} />
      ) : tipo === 'grabacion' ? (
        <Video {...props} />
      ) : tipo === 'ejercicios' ? (
        <PenLine {...props} />
      ) : tipo === 'tarea' ? (
        <Mic {...props} />
      ) : (
        <Layers {...props} />
      )}
    </div>
  )
}

function Fila({
  tipo,
  titulo,
  detalle,
  estado,
  href,
}: {
  tipo: string
  titulo: string
  detalle?: string
  estado?: React.ReactNode
  href?: string
}) {
  const dentro = (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icono tipo={tipo} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-gray-900 truncate">{titulo}</p>
        {detalle ? <p className="text-[12.5px] text-[#6B7280] leading-snug">{detalle}</p> : null}
      </div>
      {estado ? <div className="shrink-0 text-[12.5px] font-bold">{estado}</div> : null}
      {href ? <ChevronRight size={15} className="shrink-0 text-[#B9C6DC]" /> : null}
    </div>
  )
  return href ? (
    <Link href={href} prefetch={false} className="block hover:bg-[#F8FAFF] transition-colors">
      {dentro}
    </Link>
  ) : (
    dentro
  )
}

const Hecho = ({ texto = 'Hecho' }: { texto?: string }) => (
  <span className="inline-flex items-center gap-1 text-[#15803D]">
    <Check size={14} strokeWidth={3} /> {texto}
  </span>
)

/** Lo que se abre el día de la clase, dicho en una línea: «Ejercicios y tarea». */
function queSeAbre(semana: Semana): string {
  const hay = [(semana.ocultas || 0) > 0 ? 'ejercicios' : '', semana.tiene_tarea ? 'tarea' : ''].filter(Boolean)
  if (!hay.length) return ''
  const texto = hay.join(' y ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Las filas de una semana: presentación, grabación, ejercicios, otras y la tarea.
 * Antes del día de la clase el alumno solo ve la presentación (el servidor ya
 * le quita lo demás) y una línea con lo que se abrirá ese día. */
function ContenidoSemana({
  semana,
  hoy,
  rutaClase,
  orgslug,
  admin,
}: {
  semana: Semana
  hoy: string
  rutaClase: (c: ClaseSemana) => string
  orgslug: string
  admin: boolean
}) {
  const clases = semana.clases || []
  const presentaciones = clases.filter((c) => c.tipo === 'presentacion')
  const grabaciones = clases.filter((c) => c.tipo === 'grabacion')
  const ejercicios = clases.filter((c) => c.tipo === 'ejercicios')
  const otras = clases.filter((c) => c.tipo === 'otra')
  const hechos = ejercicios.filter((c) => c.hecha).length
  const siguienteEjercicio = ejercicios.find((c) => !c.hecha) || ejercicios[0]
  const estadoTarea = semana.tarea?.estado || 'sin-tarea'
  const cerrada = semana.abierta === false

  const filasPresentacion = presentaciones.map((c) => (
    <Fila
      key={c.activity_uuid}
      tipo="presentacion"
      titulo={c.nombre || 'Presentación'}
      detalle="Para mirar antes de la clase"
      estado={c.hecha ? <Hecho texto="Vista" /> : <span className="text-[#0b2da0]">Ábrela</span>}
      href={rutaClase(c)}
    />
  ))

  if (cerrada && !admin) {
    const seAbre = queSeAbre(semana)
    return (
      <div className="divide-y divide-[#EEF2F9]">
        {filasPresentacion.length ? (
          filasPresentacion
        ) : (
          <Fila tipo="presentacion" titulo="Presentación" detalle="Aún no está subida" />
        )}
        {seAbre ? (
          <Fila
            tipo={seAbre === 'Tarea' ? 'tarea' : 'ejercicios'}
            titulo={seAbre}
            detalle={`Se ${seAbre === 'Tarea' ? 'abre' : 'abren'} el día de la clase`}
            estado={<span className="text-[#9CA3AF] font-semibold">Después</span>}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#EEF2F9]">
      {cerrada ? (
        <p className="px-4 py-2.5 text-[12.5px] text-[#5A6480] bg-[#F9FAFB]">
          Hasta el {diaCorto(semana.fecha)}, el día de la clase, los alumnos solo ven la presentación.
        </p>
      ) : null}
      {filasPresentacion}
      {grabaciones.length ? (
        grabaciones.map((c) => (
          <Fila
            key={c.activity_uuid}
            tipo="grabacion"
            titulo={c.suelta ? 'Grabación' : c.nombre || 'Grabación'}
            detalle={c.profe ? `La clase grabada · con ${c.profe}` : 'La clase grabada'}
            estado={c.hecha ? <Hecho texto="Vista" /> : null}
            href={rutaClase(c)}
          />
        ))
      ) : (
        <Fila
          tipo="grabacion"
          titulo="Grabación"
          detalle={semana.fecha >= hoy ? 'Sale después de la clase' : 'Aún no está subida'}
          estado={<span className="text-[#9CA3AF] font-semibold">{semana.fecha >= hoy ? 'Después' : 'Pronto'}</span>}
        />
      )}
      {ejercicios.length ? (
        <Fila
          tipo="ejercicios"
          titulo="Ejercicios"
          detalle={ejercicios.map((c) => c.nombre).join(' · ')}
          estado={
            hechos >= ejercicios.length ? (
              <Hecho />
            ) : (
              <span className="text-[#0b2da0] tabular-nums">
                {hechos} de {ejercicios.length}
              </span>
            )
          }
          href={siguienteEjercicio ? rutaClase(siguienteEjercicio) : undefined}
        />
      ) : null}
      {otras.map((c) => (
        <Fila key={c.activity_uuid} tipo="otra" titulo={c.nombre} estado={c.hecha ? <Hecho /> : null} href={rutaClase(c)} />
      ))}
      {semana.tiene_tarea ? (
        <Fila
          tipo="tarea"
          titulo="Tarea"
          detalle={estadoTarea === 'corregida' ? 'Tu profe ya la ha corregido' : `Entrega hasta el ${diaCorto(semana.limite)}`}
          estado={
            estadoTarea === 'corregida' ? (
              <Hecho texto={semana.tarea?.vista ? 'Corregida' : 'Corregida · nueva'} />
            ) : estadoTarea === 'entregada' ? (
              <span className="text-[#0b2da0]">Entregada</span>
            ) : (
              <span className="text-[#8A6A2A]">{semana.limite < hoy ? 'Sin entregar' : 'Pendiente'}</span>
            )
          }
          href={getUriWithOrg(orgslug, `/tarea/${semana.id}`)}
        />
      ) : null}
      {!clases.length && !semana.tiene_tarea ? (
        <p className="px-4 py-4 text-[13px] text-[#9CA3AF]">Aún no hay nada en esta semana.</p>
      ) : null}
    </div>
  )
}

function CabeceraAdmin({
  semana,
  courseUuid,
  orgslug,
  onEditar,
  onCambio,
}: {
  semana: Semana
  courseUuid: string
  orgslug: string
  onEditar: () => void
  onCambio: () => void
}) {
  const [avisando, setAvisando] = useState(false)
  const limpio = courseUuid.replace(/^course_/, '')
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [guardando, setGuardando] = useState(false)
  // Las casillas de la campana, a mano desde la propia semana (05/11/2026).
  async function avisar(datos: { avisar_presentacion?: boolean; avisar_grabacion?: boolean }) {
    setGuardando(true)
    try {
      await editarSemana(semana.id, datos, token)
      const marcada = datos.avisar_presentacion ?? datos.avisar_grabacion
      toast.success(marcada ? 'Les saldrá en la campana a los alumnos de esta clase' : 'Ya no les avisa en la campana')
      onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-[#F9FAFB] border-t border-[#EEF2F9] text-[12.5px] font-semibold">
      <CasillasCampana
        compacto
        presentacion={semana.avisar_presentacion ?? true}
        grabacion={semana.avisar_grabacion ?? false}
        onPresentacion={(v) => avisar({ avisar_presentacion: v })}
        onGrabacion={(v) => avisar({ avisar_grabacion: v })}
        disabled={guardando}
      />
      <button onClick={() => setAvisando(true)} className="inline-flex items-center gap-1 text-[#0b2da0] hover:underline">
        <Megaphone size={12} /> Avisar a la clase
      </button>
      <button onClick={onEditar} className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#0b2da0]">
        <Pencil size={12} /> Editar semana
      </button>
      <Link
        href={getUriWithOrg(orgslug, `/dash/courses/course/${limpio}/content`)}
        prefetch={false}
        className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#0b2da0]"
      >
        <Plus size={12} /> Añadir clases (grabación…)
      </Link>
      <Link
        href={getUriWithOrg(orgslug, `/dash/estadisticas?tab=seguimiento&clase=${limpio}&semana=${semana.id}`)}
        prefetch={false}
        className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#0b2da0]"
      >
        <Users size={12} /> Seguimiento
      </Link>
      <span className="text-[#9CA3AF] font-medium">Solo lo ves tú</span>
      {avisando ? <AvisarClase semana={semana} onClose={() => setAvisando(false)} /> : null}
    </div>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** El día en una ficha pequeña, como en un calendario: «14 / OCT». */
function ChipFecha({ fecha }: { fecha: string }) {
  const [, m, d] = (fecha || '').split('-').map(Number)
  if (!m || !d) {
    return (
      <div className="w-11 h-11 flex items-center justify-center shrink-0">
        <Video size={24} strokeWidth={1.6} className="text-[#0b2da0]" />
      </div>
    )
  }
  return (
    <div className="w-11 h-11 rounded-xl border border-[#E4E8F2] flex flex-col items-center justify-center shrink-0 leading-none">
      <span className="text-[16px] font-semibold text-[#0B1033] tabular-nums" style={POPPINS}>
        {d}
      </span>
      <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">{MESES[m - 1]}</span>
    </div>
  )
}

/** Lo de la derecha de cada línea, siempre con la misma forma. */
/** Lo de la derecha de cada línea: texto suelto, sin pastilla (08/11: «Vista
 * en una pastilla verde es lo que hace todo el mundo»). Hecho = marca verde
 * pequeña y texto gris; pendiente = gris; «Ver» = enlace azul. */
function Etiqueta({ tono, children }: { tono: 'hecho' | 'azul' | 'gris'; children: React.ReactNode }) {
  const color =
    tono === 'hecho' ? 'text-[#5B6382] [&_svg]:text-[#16A34A]' : tono === 'azul' ? 'text-[#0b2da0] font-semibold' : 'text-[#8A91AD]'
  return <span className={`shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium ${color}`}>{children}</span>
}

/** Qué tuvo una semana, en una línea: «Presentación · Grabación · Tarea». */
function queTuvo(s: Semana): string {
  const tipos = new Set((s.clases || []).map((c) => c.tipo))
  const partes = [
    tipos.has('presentacion') ? 'Presentación' : '',
    tipos.has('grabacion') ? 'Grabación' : '',
    tipos.has('ejercicios') ? 'Ejercicios' : '',
    s.tiene_tarea ? 'Tarea' : '',
  ].filter(Boolean)
  const profe = (s.clases || []).find((c) => c.profe)?.profe
  return [partes.join(' · '), profe ? `con ${profe}` : ''].filter(Boolean).join(' · ')
}

/** Una grabación de antes sin semana, con la misma forma que una semana. */
function FilaArchivo({ c, href }: { c: ClaseArchivo; href: string }) {
  return (
    <Link href={href} prefetch={false} className="flex items-center gap-3.5 px-4 py-3 hover:bg-[#F8FAFF] transition-colors">
      <ChipFecha fecha={c.fecha} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-gray-900 truncate">{c.tema || c.nombre}</p>
        <p className="text-[12.5px] text-[#6B7280] truncate">{['Grabación', c.profe ? `con ${c.profe}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      {c.hecha ? (
        <Etiqueta tono="hecho">
          <Check size={14} strokeWidth={2.5} /> Vista
        </Etiqueta>
      ) : (
        <Etiqueta tono="azul">Ver</Etiqueta>
      )}
      <ChevronRight size={15} className="shrink-0 text-[#B9C6DC]" />
    </Link>
  )
}

/** Cuántas clases anteriores se ven antes de «Ver todas». */
const ANTERIORES_A_LA_VISTA = 6

export default function SemanasClase({
  courseUuid,
  courseuuid,
  orgslug,
  curso,
  conGrabadas = true,
}: {
  courseUuid: string
  courseuuid: string
  orgslug: string
  curso: any
  /** Si la clase enseña sus grabaciones de antes (Spreekclub y Masterclass, no). */
  conGrabadas?: boolean
}) {
  const { data } = useSemanasClase(courseUuid)
  const queryClient = useQueryClient()
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>({})
  const [todas, setTodas] = useState(false)
  const [nueva, setNueva] = useState(false)
  const [editando, setEditando] = useState<Semana | null>(null)

  if (!data) return null
  // El equipo (también los profes, 02/11/2026) prepara y cambia las semanas;
  // quitar una semana entera (borra las entregas), solo un administrador.
  const { semanas, hoy, actual, proxima, admin } = data
  const equipo = Boolean(data.equipo || admin)
  const archivo = conGrabadas ? data.archivo || [] : []
  if (!semanas.length && !archivo.length && !equipo) return null

  const rutaClase = (c: ClaseSemana) =>
    getUriWithOrg(orgslug, '') + `/course/${courseuuid}/activity/${c.activity_uuid.replace('activity_', '')}`
  const recargar = () => queryClient.invalidateQueries({ queryKey: claveSemanas(courseUuid) })

  const semanaActual = semanas.find((s) => s.id === actual) || null
  const semanaProxima = semanas.find((s) => s.id === proxima && s.id !== actual) || null
  const masAdelante = semanas.filter((s) => s.fecha > hoy && s.id !== proxima)
  const anteriores = semanas.filter((s) => s.id !== actual && s.fecha <= hoy)
  // Las semanas pasadas y las grabaciones de antes, juntas y por día.
  const lineas: ({ semana: Semana } | { suelta: ClaseArchivo })[] = [
    ...anteriores.map((semana) => ({ semana })),
    ...archivo.map((suelta) => ({ suelta })),
  ].sort((a, b) => {
    const fa = 'semana' in a ? a.semana.fecha : a.suelta.fecha
    const fb = 'semana' in b ? b.semana.fecha : b.suelta.fecha
    return (fb || '').localeCompare(fa || '')
  })
  const visibles = todas ? lineas : lineas.slice(0, ANTERIORES_A_LA_VISTA)

  // Para el alumno, la semana es la misma lista que en «Esta semana» y en el
  // Inicio (08/11/2026: «es diferente a esta otra»). El equipo sigue viendo
  // las filas con lo que hay subido y sus botones.
  const rutaOrg = (p: string) => getUriWithOrg(orgslug, p)
  const bloque = (titulo: string, semana: Semana) => {
    const pasos = equipo ? [] : pasosDeSemana(semana, courseUuid, rutaOrg, hoy)
    const hechos = pasos.filter((p) => p.estado === 'hecho').length
    return (
      <section key={`b-${semana.id}`} className="mt-6 rounded-2xl border border-[#E4E8F2] bg-white overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[#0b2da0]">
              <span className="uppercase tracking-[0.08em]">{titulo}</span>
              <span className="text-[#8A91AD] font-medium"> · {diaCorto(semana.fecha)}</span>
            </p>
            <h2 className="mt-1.5 text-[21px] sm:text-[23px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
              {semana.tema || 'Clase de la semana'}
            </h2>
          </div>
          {/* La clase que aún no ha llegado: «¿Vienes?» en lugar de «0 de 4»
              (08/11: una sola página por clase, como «Esta semana»). */}
          {!equipo && (semana.fecha || '') >= hoy ? (
            <div className="shrink-0 flex items-center gap-3">
              <span className="text-[13px] text-[#6B7393]">¿Vienes?</span>
              <Vienes semana={semana} courseUuid={courseUuid} segmento textos={['Asistiré', 'No puedo']} />
            </div>
          ) : pasos.length ? (
            <span className="shrink-0 mt-1 text-[13px] font-semibold text-[#8A91AD] tabular-nums">
              {hechos} de {pasos.length}
            </span>
          ) : null}
        </div>
        <div className="border-t border-[#EEF1F7]">
          {equipo ? (
            <>
              <ContenidoSemana semana={semana} hoy={hoy} rutaClase={rutaClase} orgslug={orgslug} admin={equipo} />
              <CabeceraAdmin semana={semana} courseUuid={courseUuid} orgslug={orgslug} onEditar={() => setEditando(semana)} onCambio={recargar} />
            </>
          ) : (
            <div className="py-2">
              {pasos.map((p) => (
                <FilaPaso key={p.key} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }

  const filaSemana = (s: Semana) => {
    const abierta = !!abiertas[s.id]
    const est = s.tarea?.estado || 'sin-tarea'
    const grabacionVista = (s.clases || []).some((c) => c.tipo === 'grabacion' && c.hecha)
    return (
      <div key={s.id}>
        <button
          onClick={() => setAbiertas((a) => ({ ...a, [s.id]: !abierta }))}
          className="w-full flex items-center gap-3.5 px-4 py-3 text-left hover:bg-[#F8FAFF] transition-colors"
        >
          <ChipFecha fecha={s.fecha} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-gray-900 truncate">{s.tema}</p>
            <p className="text-[12.5px] text-[#6B7280] truncate">{queTuvo(s) || 'Clase'}</p>
          </div>
          {est === 'corregida' ? (
            <Etiqueta tono="hecho">
              <Check size={14} strokeWidth={2.5} /> Corregida
            </Etiqueta>
          ) : est === 'entregada' ? (
            <Etiqueta tono="azul">Entregada</Etiqueta>
          ) : est === 'pendiente' ? (
            <Etiqueta tono="gris">{s.limite < hoy ? 'Sin entregar' : 'Pendiente'}</Etiqueta>
          ) : grabacionVista ? (
            <Etiqueta tono="hecho">
              <Check size={14} strokeWidth={2.5} /> Vista
            </Etiqueta>
          ) : null}
          <ChevronDown size={16} className={`shrink-0 text-[#B9C6DC] transition-transform ${abierta ? '' : '-rotate-90'}`} />
        </button>
        {abierta ? (
          <div className="mx-4 mb-3 rounded-xl border border-[#EEF2F9] overflow-hidden">
            <ContenidoSemana semana={s} hoy={hoy} rutaClase={rutaClase} orgslug={orgslug} admin={equipo} />
            {equipo ? <CabeceraAdmin semana={s} courseUuid={courseUuid} orgslug={orgslug} onEditar={() => setEditando(s)} onCambio={recargar} /> : null}
          </div>
        ) : null}
      </div>
    )
  }

  const plegables = (titulo: string, lista: Semana[]) =>
    lista.length ? (
      <div key={`p-${titulo}`}>
        <h2 className="text-[18px] font-bold text-gray-900 mt-6 mb-2.5" style={POPPINS}>
          {titulo}
        </h2>
        <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden divide-y divide-[#EEF2F9]">{lista.map(filaSemana)}</div>
      </div>
    ) : null

  // «Clases anteriores»: las semanas pasadas y las grabaciones de antes, por
  // día. Lleva el ancla de «Clases anteriores» de la franja de arriba.
  const mesDe = (l: (typeof lineas)[number]) => {
    const f = 'semana' in l ? l.semana.fecha : l.suelta.fecha
    return (f || '').slice(0, 7)
  }
  const anterioresBloque = lineas.length ? (
    <div id="sesiones-grabadas" className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3 mt-8 mb-2.5">
        <h2 className="text-[18px] font-bold text-gray-900" style={POPPINS}>
          Clases anteriores
        </h2>
        <span className="text-[12.5px] font-semibold text-[#6B7280]">
          {lineas.length} {lineas.length === 1 ? 'clase' : 'clases'}
        </span>
      </div>
      <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
        {visibles.map((l, i) => {
          const mes = mesDe(l)
          const cambia = i === 0 || mes !== mesDe(visibles[i - 1])
          const [y, m] = mes.split('-').map(Number)
          return (
            <React.Fragment key={'semana' in l ? `s${l.semana.id}` : l.suelta.activity_uuid}>
              {cambia ? (
                <p
                  className={`px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94A8] ${i ? 'border-t border-[#EEF2F9]' : ''}`}
                >
                  {m ? `${MESES_LARGOS[m - 1]} ${y}` : 'Otras'}
                </p>
              ) : null}
              {'semana' in l ? filaSemana(l.semana) : <FilaArchivo c={l.suelta} href={rutaClase(l.suelta)} />}
            </React.Fragment>
          )
        })}
        {lineas.length > ANTERIORES_A_LA_VISTA ? (
          <button
            onClick={() => setTodas((v) => !v)}
            className="w-full border-t border-[#EEF2F9] px-4 py-3 text-center text-[13px] font-semibold text-[#0b2da0] hover:bg-[#F8FAFF]"
          >
            {todas ? 'Ver menos' : `Ver todas las clases (${lineas.length})`}
          </button>
        ) : null}
      </div>
    </div>
  ) : null

  return (
    <div className="w-full">
      {equipo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 rounded-xl border border-dashed border-[#9cc7ff] px-4 py-3">
          <p className="text-[13px] text-[#3F4A61]">
            {semanas.length
              ? 'Cada semana: presentación, grabación, ejercicios y tarea.'
              : 'Organiza esta clase por semanas: presentación antes, grabación y ejercicios después, y una tarea para entregar.'}
          </p>
          <button
            onClick={() => setNueva(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b2da0] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0a2690]"
          >
            <CalendarDays size={15} /> Nueva semana
          </button>
        </div>
      ) : null}

      {semanaActual ? bloque('Esta semana', semanaActual) : null}
      {semanaProxima ? bloque('Próxima clase', semanaProxima) : null}
      {anterioresBloque}
      {equipo ? plegables('Más adelante', masAdelante) : null}

      {nueva ? (
        <NuevaSemana
          courseUuid={courseUuid}
          curso={curso}
          orgslug={orgslug}
          ultima={semanas[0] || null}
          hermanas={data.hermanas || []}
          onClose={() => setNueva(false)}
          onCreada={() => {
            setNueva(false)
            recargar()
          }}
        />
      ) : null}
      {editando ? (
        <EditarSemana
          semana={editando}
          puedeQuitar={admin}
          onClose={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            recargar()
          }}
        />
      ) : null}
    </div>
  )
}
