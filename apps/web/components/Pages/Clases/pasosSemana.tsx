'use client'
/**
 * La semana de una clase en directo, como lista: presentación, clase,
 * grabación, ejercicios y tarea, con un círculo que se marca al hacerlo.
 * La usan «Esta semana», el Inicio y la página de la clase (rediseño, rama
 * diseno): las tres se tienen que ver igual.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { Check, Download, X } from 'lucide-react'
import { diaCorto, type ClaseSemana, type Semana } from '@services/tareas/tareas'
import type { GrabacionSala } from '@services/grabaciones/grabaciones'
import { duracionCorta } from '@/lib/nawar/recorte'
import VentanaGrabacionSala from '@components/Pages/Grabaciones/VentanaGrabacionSala'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { urlPdfConNotas } from '@services/pizarra/pizarra'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import PaginasPdf from '@components/Objects/Activities/DocumentPdf/PaginasPdf'
import { textosDeClase } from '@/lib/nawar/palabraClase'

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
export function pasosDeSemana(
  semana: Semana,
  courseUuid: string,
  ruta: (p: string) => string,
  hoy: string,
  /** El nombre del curso: en el Spreek Club se dice «sesión», no «clase» (18/11/2026). */
  nombreCurso?: string
): PasoSemana[] {
  const t = textosDeClase(nombreCurso)
  return pasosSinPalabra(semana, courseUuid, ruta, hoy).map((p) => ({ ...p, titulo: t(p.titulo), detalle: p.detalle ? t(p.detalle) : p.detalle }))
}

function pasosSinPalabra(semana: Semana, courseUuid: string, ruta: (p: string) => string, hoy: string): PasoSemana[] {
  const actividad = (c: ClaseSemana) => ruta(`/course/${sinPrefijo(courseUuid)}/activity/${c.activity_uuid.replace('activity_', '')}`)
  const clases = semana.clases || []
  const ejercicios = clases.filter((c) => c.tipo === 'ejercicios')
  const pres = clases.filter((c) => c.tipo === 'presentacion')
  const grab = clases.filter((c) => c.tipo === 'grabacion')
  const out: PasoSemana[] = []
  // Una sola presentación por grupo (18/11/2026, usuario: "si el lunes se da
  // la clase, que al terminar la profe le dé a guardar y el alumno de su grupo
  // vea su presentación editada… y el del miércoles todavía la anterior"):
  // antes de la clase, la de antes; cuando el profe de SU clase la guarda desde
  // la pizarra, en su lugar, la versión de la clase. Nunca las dos a la vez.
  const notas = semana.notas_clase
  if (notas)
    out.push({
      key: 'notas-clase',
      titulo: 'Repasa la presentación de la clase',
      detalle: `La de tu clase, con lo que se escribió en ella${notas.paginas ? ` · ${notas.paginas} páginas` : ''}`,
      estado: 'pendiente',
      // En su propia página, no «como un curso» (22/11/2026): /presentacion/<semana>.
      href: ruta(`/presentacion/${semana.id}`),
    })
  else
    for (const c of pres)
      out.push({ key: c.activity_uuid, titulo: NOMBRE.presentacion, detalle: 'Antes de la clase, para llegar con el tema visto', href: ruta(`/presentacion/${semana.id}`), estado: c.hecha ? 'hecho' : 'pendiente' })
  // Si esa semana va a la clase del otro grupo (08/11/2026), su día y su sala.
  const fechaClase = semana.cambio?.fecha || semana.fecha
  const pasada = !!fechaClase && fechaClase < hoy
  // Ya pasada, la clase no sale como paso (18/11/2026, usuario: "quita lo de
  // «Clase en directo», mejor tipo grabación de la sala"): el check verde solo
  // decía que la fecha había pasado, no que hubiera ido. En su sitio, la
  // grabación (abajo) o, si aún no está, que se publicará.
  if (fechaClase && !pasada) {
    out.push({
      key: 'clase',
      titulo: fechaClase === hoy ? 'Ven a la clase, es hoy' : 'Ven a la clase en directo',
      detalle:
        `${DIAS[dia(fechaClase).getDay()]} ${diaCorto(fechaClase).replace(/^\S+\s/, '')}` + (semana.cambio ? ' · con el otro grupo' : ''),
      href: semana.cambio && fechaClase === hoy ? ruta(`/sala/${sinPrefijo(semana.cambio.course_uuid)}`) : ruta(`/course/${sinPrefijo(courseUuid)}`),
      estado: 'pendiente',
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
  if (pasada && !grab.length && !sala)
    out.push({
      key: 'grabacion-pendiente',
      titulo: 'La grabación de la clase',
      detalle: 'Aún no está publicada: te sale aquí en cuanto lo esté',
      estado: 'cerrado',
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

/**
 * La presentación de su clase: se pide con la sesión y se abre AQUÍ, en un
 * visor a toda la ventana con las páginas pintadas por la escuela (18/11/2026;
 * antes era una pestaña nueva con el visor del navegador).
 */
function FilaNotas({ semanaId, cls, dentro }: { semanaId: number; cls: string; dentro: React.ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={`${cls} w-full text-left hover:bg-[#F7F9FD]`}>
        {dentro}
      </button>
      {abierta ? <VisorPresentacionClase semanaId={semanaId} onClose={() => setAbierta(false)} /> : null}
    </>
  )
}

export function VisorPresentacionClase({ semanaId, titulo, onClose }: { semanaId: number; titulo?: string; onClose: () => void }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [url, setUrl] = useState('')
  const [fallo, setFallo] = useState('')
  const [sinVisor, setSinVisor] = useState(false)
  React.useEffect(() => {
    let vivo = true
    let hecha = ''
    urlPdfConNotas(semanaId, token)
      .then((u) => {
        hecha = u
        if (vivo) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((e: any) => vivo && setFallo(e?.message || 'No se ha podido abrir'))
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      vivo = false
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
      if (hecha) URL.revokeObjectURL(hecha)
    }
  }, [semanaId, token, onClose])
  return (
    <EnElCuerpo>
      <div className="fixed inset-0 flex flex-col bg-[#F4F6FB]" role="dialog" aria-modal="true" aria-label="Presentación de la clase">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E6EAF2] bg-white px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-poppins)] text-[15px] font-semibold text-[#0B1033]">{titulo || 'La presentación de tu clase'}</p>
            <p className="truncate text-[12px] text-[#6B7393]">Con lo que se escribió en la clase</p>
          </div>
          {url ? (
            <a
              href={url}
              download="Presentación de la clase.pdf"
              className="hidden items-center gap-1.5 rounded-lg border border-[#E2E7F0] px-3 py-2 text-[13px] font-semibold text-[#0B1033] hover:bg-[#F7F9FD] sm:inline-flex"
            >
              <Download size={15} /> Descargar
            </a>
          ) : null}
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0B1033] hover:bg-[#F4F6FB]">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[880px] px-3 py-5 sm:px-6 sm:py-8">
            {fallo ? (
              <p className="py-20 text-center text-[14px] text-[#6B7393]">{fallo}</p>
            ) : !url ? (
              <p className="animate-pulse py-20 text-center text-[14px] text-[#6B7393]">Abriendo la presentación…</p>
            ) : sinVisor ? (
              <iframe src={url} title="Presentación" className="h-[calc(100dvh-7rem)] w-full rounded-lg border border-[#E6EAF2] bg-white" />
            ) : (
              <PaginasPdf url={url} alFallar={() => setSinVisor(true)} />
            )}
          </div>
        </div>
      </div>
    </EnElCuerpo>
  )
}
