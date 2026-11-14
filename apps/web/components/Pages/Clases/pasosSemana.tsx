'use client'
/**
 * La semana de una clase en directo, como lista: presentación, clase,
 * grabación, ejercicios y tarea, con un círculo que se marca al hacerlo.
 * La usan «Esta semana», el Inicio y la página de la clase (rediseño, rama
 * diseno): las tres se tienen que ver igual.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { diaCorto, type ClaseSemana, type Semana } from '@services/tareas/tareas'
import type { GrabacionSala } from '@services/grabaciones/grabaciones'
import { duracionCorta } from '@/lib/nawar/recorte'
import VentanaGrabacionSala from '@components/Pages/Grabaciones/VentanaGrabacionSala'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { urlPdfConNotas } from '@services/pizarra/pizarra'

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const dia = (f: string) => new Date(`${f}T12:00:00`)
export const sinPrefijo = (u: string) => String(u || '').replace(/^course_/, '')


const NOMBRE: Record<string, string> = {
  presentacion: 'Mira la presentación',
  grabacion: 'Mira la grabación',
  ejercicios: 'Haz los ejercicios',
}

export type PasoSemana = {
  key: string
  titulo: string
  detalle?: string
  href?: string
  estado: 'hecho' | 'pendiente' | 'cerrado'
  /** La grabación de la sala (10/11/2026): no es una clase del curso, se ve en una ventana de esta página. */
  sala?: { courseUuid: string; semana: { id: number; tema: string; fecha: string }; grabacion: GrabacionSala }
  /** La presentación con las notas de la clase (10/11/2026, la pizarra): un PDF que se abre con la sesión. */
  notas?: { semanaId: number }
}

/** Lo que toca en una semana, en orden: lo usan «Esta semana» y el Inicio. */
export function pasosDeSemana(semana: Semana, courseUuid: string, ruta: (p: string) => string, hoy: string): PasoSemana[] {
  const actividad = (c: ClaseSemana) => ruta(`/course/${sinPrefijo(courseUuid)}/activity/${c.activity_uuid.replace('activity_', '')}`)
  const clases = semana.clases || []
  const ejercicios = clases.filter((c) => c.tipo === 'ejercicios')
  const pres = clases.filter((c) => c.tipo === 'presentacion')
  const grab = clases.filter((c) => c.tipo === 'grabacion')
  const out: PasoSemana[] = []
  for (const c of pres)
    out.push({ key: c.activity_uuid, titulo: NOMBRE.presentacion, detalle: 'Antes de la clase, para llegar con el tema visto', href: actividad(c), estado: c.hecha ? 'hecho' : 'pendiente' })
  // Si esa semana va a la clase del otro grupo (08/11/2026), su día y su sala.
  const fechaClase = semana.cambio?.fecha || semana.fecha
  if (fechaClase) {
    const pasada = fechaClase < hoy
    out.push({
      key: 'clase',
      titulo: fechaClase === hoy ? 'Ven a la clase, es hoy' : pasada ? 'Clase en directo' : 'Ven a la clase en directo',
      detalle:
        `${DIAS[dia(fechaClase).getDay()]} ${diaCorto(fechaClase).replace(/^\S+\s/, '')}` + (semana.cambio ? ' · con el otro grupo' : ''),
      href: semana.cambio && fechaClase === hoy ? ruta(`/sala/${sinPrefijo(semana.cambio.course_uuid)}`) : ruta(`/course/${sinPrefijo(courseUuid)}`),
      estado: pasada ? 'hecho' : 'pendiente',
    })
  }
  for (const c of grab) out.push({ key: c.activity_uuid, titulo: NOMBRE.grabacion, detalle: 'Por si no pudiste venir o quieres repasar', href: actividad(c), estado: c.hecha ? 'hecho' : 'pendiente' })
  // La grabación que hizo la sala, publicada en esta semana (10/11/2026). Si ya
  // hay una subida a mano, se enseña esa y no las dos.
  const sala = semana.grabacion_sala
  if (sala && !grab.length)
    out.push({
      key: 'grabacion-sala',
      titulo: NOMBRE.grabacion,
      detalle: `${sala.titulo || 'Por si no pudiste venir o quieres repasar'}${sala.segundos ? ` · ${duracionCorta(sala.segundos)}` : ''}`,
      estado: sala.vista ? 'hecho' : 'pendiente',
      sala: { courseUuid, semana: { id: semana.id, tema: semana.tema, fecha: semana.fecha }, grabacion: sala },
    })
  // Lo que el profe escribió encima de la presentación en clase (10/11/2026).
  if (semana.notas_clase)
    out.push({
      key: 'notas-clase',
      titulo: 'Repasa la presentación con las notas de la clase',
      detalle: `Con lo que se escribió en clase · ${semana.notas_clase.paginas} páginas`,
      estado: 'pendiente',
      notas: { semanaId: semana.id },
    })
  if (ejercicios.length) {
    const n = ejercicios.filter((c) => c.hecha).length
    out.push({
      key: 'ejercicios',
      titulo: NOMBRE.ejercicios,
      detalle: `${n} de ${ejercicios.length} hechos`,
      href: actividad(ejercicios.find((c) => !c.hecha) || ejercicios[0]),
      estado: n === ejercicios.length ? 'hecho' : 'pendiente',
    })
  }
  if (semana.ocultas) out.push({ key: 'ocultas', titulo: 'Ejercicios', detalle: 'Se abren el día de la clase', estado: 'cerrado' })
  if (semana.tiene_tarea) {
    const t = semana.tarea?.estado
    out.push({
      key: 'tarea',
      titulo: t === 'corregida' ? 'Escucha la corrección de tu tarea' : 'Entrega la tarea',
      detalle:
        t === 'corregida'
          ? 'Ya está corregida'
          : t === 'entregada'
            ? 'Entregada, pendiente de corregir'
            : t === 'antes-de-entrar'
              ? 'Era de antes de que entraras: opcional'
              : semana.abierta
                ? `Hasta el ${diaCorto(semana.limite)}`
                : 'Se abre el día de la clase',
      href: semana.abierta ? ruta(`/tarea/${semana.id}`) : undefined,
      estado: t === 'entregada' || t === 'corregida' ? 'hecho' : t === 'antes-de-entrar' || !semana.abierta ? 'cerrado' : 'pendiente',
    })
  }
  return out
}

/** Una línea de la lista: un círculo (vacío, con check o gris), el texto y «Abrir». */
export function FilaPaso({ p }: { p: PasoSemana }) {
  // Círculo fino: verde con su marca al hacerlo, gris si falta, punteado si
  // aún no se abre. Sin rellenos (08/11: «los checks se ven IA»).
  const circulo =
    p.estado === 'hecho' ? (
      <span className="w-[22px] h-[22px] rounded-full border-2 border-[#16A34A] text-[#16A34A] flex items-center justify-center shrink-0">
        <Check size={13} strokeWidth={3.4} />
      </span>
    ) : (
      <span className={`w-[22px] h-[22px] rounded-full border-2 shrink-0 ${p.estado === 'cerrado' ? 'border-dashed border-[#C9CFDE]' : 'border-[#B8C2DA]'}`} />
    )
  const dentro = (
    <>
      {circulo}
      <span className="flex-1 min-w-0">
        <span className={`block text-[14.5px] font-medium ${p.estado === 'hecho' ? 'text-[#6B7393]' : p.estado === 'cerrado' ? 'text-[#8A91AD]' : 'text-[#0B1033]'}`}>{p.titulo}</span>
        {p.detalle ? <span className="block text-[12.5px] text-[#8A91AD] first-letter:uppercase">{p.detalle}</span> : null}
      </span>
      {p.href || p.sala || p.notas ? <span className="shrink-0 text-[13px] font-semibold text-[#0b2da0] opacity-0 group-hover:opacity-100 transition-opacity">{p.sala ? 'Ver' : 'Abrir'}</span> : null}
    </>
  )
  const cls = 'group flex items-center gap-3.5 px-5 py-3'
  if (p.sala) return <FilaSala p={p} cls={cls} dentro={dentro} />
  if (p.notas) return <FilaNotas semanaId={p.notas.semanaId} cls={cls} dentro={dentro} />
  return p.href ? (
    <Link href={p.href} className={`${cls} hover:bg-[#F7F9FD]`}>
      {dentro}
    </Link>
  ) : (
    <div className={cls}>{dentro}</div>
  )
}

/** La fila de la grabación de la sala: un botón que abre el vídeo aquí mismo. */
function FilaSala({ p, cls, dentro }: { p: PasoSemana; cls: string; dentro: React.ReactNode }) {
  const [viendo, setViendo] = useState(false)
  if (!p.sala) return null
  return (
    <>
      <button type="button" onClick={() => setViendo(true)} className={`${cls} w-full text-left hover:bg-[#F7F9FD]`}>
        {dentro}
      </button>
      {viendo ? (
        <VentanaGrabacionSala courseUuid={p.sala.courseUuid} semana={p.sala.semana} grabacion={p.sala.grabacion} onClose={() => setViendo(false)} />
      ) : null}
    </>
  )
}

/** La presentación con las notas: se pide con la sesión y se abre en otra pestaña. */
function FilaNotas({ semanaId, cls, dentro }: { semanaId: number; cls: string; dentro: React.ReactNode }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const abrir = async () => {
    // La pestaña se abre YA (con el clic), si no el navegador la bloquea.
    const ventana = window.open('', '_blank')
    try {
      const url = await urlPdfConNotas(semanaId, token)
      if (ventana) ventana.location.href = url
      else window.location.href = url
    } catch (e: any) {
      ventana?.close()
      toast.error(e?.message || 'No se ha podido abrir')
    }
  }
  return (
    <button type="button" onClick={abrir} className={`${cls} w-full text-left hover:bg-[#F7F9FD]`}>
      {dentro}
    </button>
  )
}
