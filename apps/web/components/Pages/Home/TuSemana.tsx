'use client'

/**
 * «Tu semana de clase» en el Inicio (28/10/2026), en el sitio de la antigua
 * hoja de ruta. La hoja de ruta era la misma lista para todos y había que
 * cambiarla a mano; esto es de cada alumno: la semana en curso de su clase en
 * directo (presentación, clase, ejercicios, tarea), qué ha hecho ya y un botón
 * a lo siguiente que le toca. Y, si tiene una corrección sin escuchar, el aviso.
 */

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bell, CalendarDays, Check } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { diaCorto, getMiSemana, type MiSemana, type Semana } from '@services/tareas/tareas'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

function Paso({ hecho, actual, children }: { hecho: boolean; actual?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[14px]">
      <span
        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${
          hecho ? 'bg-[#16A34A]' : actual ? 'border-2 border-[#4da3ff]' : 'border-2 border-[#CBD5E1]'
        }`}
      >
        {hecho ? <Check size={12} strokeWidth={3} className="text-white" /> : null}
      </span>
      <span className={hecho ? 'text-[#9CA3AF] line-through decoration-[#CBD5E1]' : 'text-gray-900'}>{children}</span>
    </div>
  )
}

function Tarjeta({ curso, courseUuid, proxima, semana, orgslug }: { curso: string; courseUuid: string; proxima: boolean; semana: Semana; orgslug: string }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const clases = semana.clases || []
  const ruta = (uuid: string) => getUriWithOrg(orgslug, `/course/${courseUuid}/activity/${uuid.replace('activity_', '')}`)
  const presentacion = clases.find((c) => c.tipo === 'presentacion')
  const ejercicios = clases.filter((c) => c.tipo === 'ejercicios')
  const ejerciciosHechos = ejercicios.filter((c) => c.hecha).length
  const tarea = semana.tarea?.estado || 'sin-tarea'

  const pasos: { hecho: boolean; texto: React.ReactNode; href?: string; boton?: string }[] = []
  if (presentacion) pasos.push({ hecho: presentacion.hecha, texto: 'Mira la presentación', href: ruta(presentacion.activity_uuid), boton: 'Ver la presentación' })
  if (ejercicios.length) {
    const sig = ejercicios.find((c) => !c.hecha)
    pasos.push({
      hecho: ejerciciosHechos >= ejercicios.length,
      texto: (
        <>
          Haz los ejercicios <span className="text-[#6B7280] tabular-nums">· {ejerciciosHechos} de {ejercicios.length}</span>
        </>
      ),
      href: sig ? ruta(sig.activity_uuid) : undefined,
      boton: 'Seguir: ejercicios',
    })
  }
  if (semana.tiene_tarea)
    pasos.push({
      hecho: tarea === 'entregada' || tarea === 'corregida',
      texto: (
        <>
          Entrega la tarea <span className="text-[#6B7280]">· {tarea === 'corregida' ? 'corregida' : tarea === 'entregada' ? 'entregada' : `hasta el ${diaCorto(semana.limite)}`}</span>
        </>
      ),
      href: getUriWithOrg(orgslug, `/tarea/${semana.id}`),
      boton: 'Hacer la tarea',
    })
  const hechos = pasos.filter((p) => p.hecho).length
  const siguiente = pasos.find((p) => !p.hecho && p.href)
  const pct = pasos.length ? Math.round((hechos * 100) / pasos.length) : 0

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-gray-900 leading-tight min-w-0" style={POPPINS}>
          {proxima ? 'Tu próxima clase' : 'Tu semana de clase'} · {semana.tema}
        </h2>
        {pasos.length ? (
          <span className="shrink-0 text-[12.5px] font-semibold text-[#6B7280] tabular-nums">
            {hechos} de {pasos.length} hechas
          </span>
        ) : null}
      </div>
      <p className="text-[12.5px] text-[#6B7280] mt-0.5">{curso}</p>
      {pasos.length ? (
        <div className="h-1.5 rounded-full bg-[#EEF2F9] mt-3 overflow-hidden">
          <div className="h-full bg-[#4da3ff] rounded-full" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="mt-2.5">
        {presentacion ? <Paso hecho={pasos[0].hecho} actual={pasos[0] === siguiente}>{pasos[0].texto}</Paso> : null}
        <div className="flex items-center gap-2.5 py-1.5 text-[14px] text-gray-900">
          <CalendarDays size={18} className="text-[#025dc7] shrink-0" />
          <span>
            Clase en directo · <span className="first-letter:uppercase">{semana.fecha === hoy ? 'hoy' : diaCorto(semana.fecha)}</span>
          </span>
        </div>
        {pasos.slice(presentacion ? 1 : 0).map((p, i) => (
          <Paso key={i} hecho={p.hecho} actual={!p.hecho && p === siguiente}>
            {p.texto}
          </Paso>
        ))}
      </div>
      <div className="mt-3">
        {siguiente?.href ? (
          <Link
            href={siguiente.href}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#4da3ff] px-6 py-3 text-[15px] font-bold text-[#0a1656] hover:bg-[#5eb4ff]"
          >
            {siguiente.boton} <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        ) : (
          <Link
            href={getUriWithOrg(orgslug, `/course/${courseUuid}`)}
            className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#025dc7] hover:text-[#1D0084]"
          >
            {pasos.length && hechos === pasos.length ? '¡Semana completa! Ver la clase' : 'Ver la clase'} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  )
}

export default function TuSemana({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data } = useQuery<MiSemana>({
    queryKey: ['tareas', 'mi-semana', org?.id],
    queryFn: () => getMiSemana(org.id, token),
    enabled: !!org?.id && !!token,
    staleTime: 30_000,
    retry: 1,
  })
  if (!data || (!data.clases.length && !data.corregidas.length)) return null

  return (
    <div className="mb-8 space-y-3">
      {data.corregidas.slice(0, 2).map((c) => (
        <Link
          key={c.entrega_id}
          href={getUriWithOrg(orgslug, `/tarea/${c.tarea_id}`)}
          className="flex items-center gap-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 hover:bg-[#E7FBEE]"
        >
          <Bell size={18} className="text-[#15803D] shrink-0" />
          <span className="flex-1 min-w-0 text-[14px] font-semibold text-[#15803D] truncate">
            Tu tarea de {c.tema} está corregida{c.tiene_audio ? ' · con nota de voz' : ''}
          </span>
          <ArrowRight size={15} className="text-[#15803D] shrink-0" />
        </Link>
      ))}
      {data.clases.map((c) => (
        <Tarjeta key={c.course_uuid} curso={c.curso} courseUuid={c.course_uuid} proxima={c.proxima} semana={c.semana} orgslug={orgslug} />
      ))}
    </div>
  )
}
