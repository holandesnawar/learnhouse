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
  Mic,
  PenLine,
  Pencil,
  Plus,
  Users,
  Video,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  diaCorto,
  getSemanas,
  type ClaseSemana,
  type Semana,
  type SemanasClase as DatosSemanas,
} from '@services/tareas/tareas'
import { EditarSemana, NuevaSemana } from './SemanaModales'

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
  const props = { size: 18, className: 'text-[#025dc7]' }
  return (
    <div className="w-9 h-9 rounded-[10px] bg-[#F0F5FF] flex items-center justify-center shrink-0">
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
      estado={c.hecha ? <Hecho texto="Vista" /> : <span className="text-[#025dc7]">Ábrela</span>}
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
            titulo={c.nombre || 'Grabación'}
            detalle="La clase grabada"
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
              <span className="text-[#025dc7] tabular-nums">
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
              <span className="text-[#025dc7]">Entregada</span>
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

function CabeceraAdmin({ semana, courseUuid, orgslug, onEditar }: { semana: Semana; courseUuid: string; orgslug: string; onEditar: () => void }) {
  const limpio = courseUuid.replace(/^course_/, '')
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-[#F9FAFB] border-t border-[#EEF2F9] text-[12.5px] font-semibold">
      <button onClick={onEditar} className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#025dc7]">
        <Pencil size={12} /> Editar semana
      </button>
      <Link
        href={getUriWithOrg(orgslug, `/dash/courses/course/${limpio}/content`)}
        prefetch={false}
        className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#025dc7]"
      >
        <Plus size={12} /> Añadir clases (grabación…)
      </Link>
      <Link
        href={getUriWithOrg(orgslug, `/dash/estadisticas?tab=seguimiento&clase=${limpio}&semana=${semana.id}`)}
        prefetch={false}
        className="inline-flex items-center gap-1 text-[#5A6480] hover:text-[#025dc7]"
      >
        <Users size={12} /> Seguimiento
      </Link>
      <span className="text-[#9CA3AF] font-medium">Solo lo ves tú</span>
    </div>
  )
}

export default function SemanasClase({ courseUuid, courseuuid, orgslug, curso }: { courseUuid: string; courseuuid: string; orgslug: string; curso: any }) {
  const { data } = useSemanasClase(courseUuid)
  const queryClient = useQueryClient()
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>({})
  const [nueva, setNueva] = useState(false)
  const [editando, setEditando] = useState<Semana | null>(null)

  if (!data) return null
  const { semanas, hoy, actual, proxima, admin } = data
  if (!semanas.length && !admin) return null

  const rutaClase = (c: ClaseSemana) =>
    getUriWithOrg(orgslug, '') + `/course/${courseuuid}/activity/${c.activity_uuid.replace('activity_', '')}`
  const recargar = () => queryClient.invalidateQueries({ queryKey: claveSemanas(courseUuid) })

  const semanaActual = semanas.find((s) => s.id === actual) || null
  const semanaProxima = semanas.find((s) => s.id === proxima && s.id !== actual) || null
  const masAdelante = semanas.filter((s) => s.fecha > hoy && s.id !== proxima)
  const anteriores = semanas.filter((s) => s.id !== actual && s.fecha <= hoy)

  const bloque = (titulo: string, semana: Semana) => (
    <div key={`b-${semana.id}`}>
      <div className="flex items-baseline justify-between gap-3 mt-6 mb-2.5">
        <h2 className="text-[18px] font-bold text-gray-900 leading-tight min-w-0" style={POPPINS}>
          {titulo} · {semana.tema}
        </h2>
        <span className="text-[12.5px] font-semibold text-[#6B7280] shrink-0 first-letter:uppercase">{diaCorto(semana.fecha)}</span>
      </div>
      <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
        <ContenidoSemana semana={semana} hoy={hoy} rutaClase={rutaClase} orgslug={orgslug} admin={admin} />
        {admin ? <CabeceraAdmin semana={semana} courseUuid={courseUuid} orgslug={orgslug} onEditar={() => setEditando(semana)} /> : null}
      </div>
    </div>
  )

  const plegables = (titulo: string, lista: Semana[]) =>
    lista.length ? (
      <div key={`p-${titulo}`}>
        <h2 className="text-[18px] font-bold text-gray-900 mt-6 mb-2.5" style={POPPINS}>
          {titulo}
        </h2>
        <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden divide-y divide-[#EEF2F9]">
          {lista.map((s) => {
            const abierta = !!abiertas[s.id]
            const est = s.tarea?.estado || 'sin-tarea'
            return (
              <div key={s.id}>
                <button
                  onClick={() => setAbiertas((a) => ({ ...a, [s.id]: !abierta }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFF]"
                >
                  <ChevronDown size={16} className={`shrink-0 text-[#025dc7] transition-transform ${abierta ? '' : '-rotate-90'}`} />
                  <span className="flex-1 min-w-0 text-[14px] font-semibold text-gray-900 truncate">
                    {s.tema} <span className="font-medium text-[#6B7280]">· {diaCorto(s.fecha)}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-bold">
                    {est === 'corregida' ? (
                      <Hecho texto="Corregida" />
                    ) : est === 'entregada' ? (
                      <span className="text-[#025dc7]">Entregada</span>
                    ) : est === 'pendiente' ? (
                      <span className="text-[#9CA3AF]">{s.limite < hoy ? 'Sin entregar' : 'Pendiente'}</span>
                    ) : null}
                  </span>
                </button>
                {abierta ? (
                  <div className="border-t border-[#EEF2F9]">
                    <ContenidoSemana semana={s} hoy={hoy} rutaClase={rutaClase} orgslug={orgslug} admin={admin} />
                    {admin ? <CabeceraAdmin semana={s} courseUuid={courseUuid} orgslug={orgslug} onEditar={() => setEditando(s)} /> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <div className="w-full">
      {admin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 rounded-xl border border-dashed border-[#9cc7ff] px-4 py-3">
          <p className="text-[13px] text-[#3F4A61]">
            {semanas.length
              ? 'Cada semana: presentación, grabación, ejercicios y tarea.'
              : 'Organiza esta clase por semanas: presentación antes, grabación y ejercicios después, y una tarea para entregar.'}
          </p>
          <button
            onClick={() => setNueva(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#025dc7] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0b6df0]"
          >
            <CalendarDays size={15} /> Nueva semana
          </button>
        </div>
      ) : null}

      {semanaActual ? bloque('Esta semana', semanaActual) : null}
      {semanaProxima ? bloque('Próxima clase', semanaProxima) : null}
      {plegables('Semanas anteriores', anteriores)}
      {admin ? plegables('Más adelante', masAdelante) : null}

      {nueva ? (
        <NuevaSemana
          courseUuid={courseUuid}
          curso={curso}
          orgslug={orgslug}
          ultima={semanas[0] || null}
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
