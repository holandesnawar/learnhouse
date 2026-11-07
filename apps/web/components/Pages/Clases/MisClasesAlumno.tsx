'use client'
/**
 * «Mis clases» del alumno (rediseño, rama `diseno`, 07/11/2026).
 *
 * Tres subpáginas en la barra, en lugar de todo dentro de la página del curso:
 *  - Esta semana (`/clases`): la clase en curso y la que viene de cada clase en
 *    directo que ve (la clase semanal, la masterclass…), con «¿Vienes?», lo que
 *    tiene que hacer y el botón para entrar.
 *  - Tareas (`/clases/tareas`): todas sus tareas, la que toca arriba.
 *  - Clases grabadas (`/clases/grabadas`): las semanas pasadas y las
 *    grabaciones de antes, por meses.
 *
 * El alumno NUNCA ve el nombre del grupo (Groep rood…): ve «Clase semanal».
 * El equipo ve todas las clases y elige cuál mirar arriba, con la etiqueta.
 * Los datos son los de siempre (`/tareas/course/{uuid}/semanas`), así que todo
 * lo que ya funcionaba (tareas, entregas, lista) sigue igual.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,

  FileText,
  Film,
  PenLine,
  Dumbbell,
  Video,
  X,
  Clock,
  Users,
} from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useCursosEnDirecto } from '@/hooks/queries/useCursosEnDirecto'
import { useSemanasClase, claveSemanas } from '@components/Pages/Courses/SemanasClase'
import { getUriWithOrg } from '@services/config/config'
import { ajustesDirecto, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { confirmarVoy, diaCorto, type ClaseSemana, type Semana } from '@services/tareas/tareas'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const dia = (f: string) => new Date(`${f}T12:00:00`)
const sinPrefijo = (u: string) => String(u || '').replace(/^course_/, '')

/** El recuadro de cada clase: hora, profe y duración (lo de siempre). */
function useRecuadro(uuid: string) {
  const org = useOrg() as any
  const config = org?.config?.config
  const a = ajustesDirecto(config, uuid)
  const r: any = a.banner || (sinPrefijo(uuid) === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
  return {
    hora: String(r.schedule || '').trim(),
    profe: String(r.teacher || '').trim(),
    duracion: String(r.duration || '').trim(),
    etiqueta: a.etiqueta,
  }
}

/** Las clases que mira esta persona: el alumno, todas las suyas; el equipo elige. */
function useClasesVisibles() {
  const { data: cursos } = useCursosEnDirecto()
  const { isStaff } = useAdminStatus()
  const org = useOrg() as any
  const [elegida, setElegida] = useState<string>('')
  const lista = cursos || []
  const visibles = isStaff ? lista.filter((c) => !elegida || c.uuid === elegida) : lista
  const Selector = () =>
    isStaff && lista.length > 1 ? (
      <div className="flex flex-wrap gap-2 mb-6">
        <Chip on={!elegida} onClick={() => setElegida('')}>
          Todas
        </Chip>
        {lista.map((c) => {
          const et = ajustesDirecto(org?.config?.config, c.uuid).etiqueta
          return (
            <Chip key={c.uuid} on={elegida === c.uuid} onClick={() => setElegida(c.uuid)}>
              {c.nombre}
              {et ? <span className="opacity-70"> · {et}</span> : null}
            </Chip>
          )
        })}
      </div>
    ) : null
  return { visibles, cargando: !cursos, Selector }
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${
        on ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#DDE3F0] text-[#3B4262] hover:border-[#1D0084]/40'
      }`}
    >
      {children}
    </button>
  )
}

function Cabecera({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight" style={POPPINS}>
        {titulo}
      </h1>
      <p className="mt-1 text-[14.5px] text-[#5B6382]">{texto}</p>
    </div>
  )
}

function Envoltorio({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[920px] mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
}

function Vacio({ texto }: { texto: string }) {
  return <div className={`${TARJETA} px-5 py-10 text-center text-[14px] text-[#6B7393]`}>{texto}</div>
}

// ── «¿Vienes a la clase?» ───────────────────────────────────────────────────

export function Vienes({ semana, courseUuid, compacto = false }: { semana: Semana; courseUuid: string; compacto?: boolean }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const qc = useQueryClient()
  const [voy, setVoy] = useState<boolean | null>(semana.voy ?? null)
  const [guardando, setGuardando] = useState(false)
  const elegir = async (va: boolean) => {
    if (guardando) return
    const nuevo = voy === va ? null : va
    setVoy(nuevo)
    setGuardando(true)
    try {
      await confirmarVoy(semana.id, nuevo, token)
      qc.invalidateQueries({ queryKey: claveSemanas(courseUuid) })
      qc.invalidateQueries({ queryKey: ['tareas', 'mi-semana'] })
    } catch {
      setVoy(semana.voy ?? null)
    } finally {
      setGuardando(false)
    }
  }
  const boton = (va: boolean, texto: string) => {
    const on = voy === va
    return (
      <button
        onClick={() => elegir(va)}
        disabled={guardando}
        className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13.5px] font-semibold border transition-colors ${
          on
            ? va
              ? 'bg-[#E9F7EF] border-[#86D3A6] text-[#13703D]'
              : 'bg-[#FDF0F0] border-[#F1B2B2] text-[#B42323]'
            : 'bg-white border-[#DDE3F0] text-[#2B3150] hover:border-[#1D0084]/40'
        }`}
      >
        {va ? <Check size={15} strokeWidth={2.6} /> : <X size={15} strokeWidth={2.6} />}
        {texto}
      </button>
    )
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacto ? '' : 'pt-1'}`}>
      {!compacto && <span className="text-[13.5px] font-semibold text-[#2B3150] mr-1">¿Vienes a la clase?</span>}
      {boton(true, 'Voy')}
      {boton(false, 'No puedo')}
      {voy === true && <span className="text-[12.5px] text-[#13703D]">¡Te esperamos!</span>}
      {voy === false && <span className="text-[12.5px] text-[#6B7393]">Tendrás la grabación después.</span>}
    </div>
  )
}

// ── Esta semana ─────────────────────────────────────────────────────────────

const ICONO: Record<string, React.ReactNode> = {
  presentacion: <FileText size={17} />,
  grabacion: <Film size={17} />,
  ejercicios: <Dumbbell size={17} />,
}
const NOMBRE: Record<string, string> = {
  presentacion: 'Presentación',
  grabacion: 'Grabación de la clase',
  ejercicios: 'Ejercicios',
}

function Paso({ href, icono, titulo, detalle, hecho }: { href?: string; icono: React.ReactNode; titulo: string; detalle?: string; hecho?: boolean }) {
  const dentro = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${hecho ? 'bg-[#E9F7EF] text-[#13703D]' : 'bg-[#EEF2FA] text-[#1D0084]'}`}>
        {hecho ? <Check size={17} strokeWidth={2.6} /> : icono}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-[#0B1033] truncate">{titulo}</span>
        {detalle ? <span className="block text-[12.5px] text-[#6B7393] truncate">{detalle}</span> : null}
      </span>
      {href ? <ArrowRight size={16} className="text-[#9AA1BC] shrink-0" /> : null}
    </>
  )
  const cls = 'flex items-center gap-3 px-4 py-3 border-t border-[#EEF1F7] first:border-t-0'
  return href ? (
    <Link href={href} className={`${cls} hover:bg-[#F7F9FD] transition-colors`}>
      {dentro}
    </Link>
  ) : (
    <div className={cls}>{dentro}</div>
  )
}

function FechaGrande({ fecha }: { fecha: string }) {
  const d = dia(fecha)
  return (
    <div className="w-[64px] shrink-0 rounded-xl overflow-hidden border border-[#E4E8F2] text-center bg-white">
      <div className="bg-[#1D0084] text-white text-[11px] font-bold uppercase tracking-wide py-1">{MESES[d.getMonth()]}</div>
      <div className="text-[26px] font-bold text-[#0B1033] leading-none pt-1.5" style={POPPINS}>
        {d.getDate()}
      </div>
      <div className="text-[11px] text-[#6B7393] pb-1.5 pt-0.5 capitalize">{DIAS[d.getDay()].slice(0, 3)}</div>
    </div>
  )
}

function TarjetaSemana({
  semana,
  curso,
  courseUuid,
  hoy,
  equipo,
  rotulo,
}: {
  semana: Semana
  curso: string
  courseUuid: string
  hoy: string
  equipo: boolean
  rotulo: string
}) {
  const org = useOrg() as any
  const { hora, profe, duracion } = useRecuadro(courseUuid)
  const ruta = (p: string) => getUriWithOrg(org?.slug || '', p)
  const actividad = (c: ClaseSemana) => ruta(`/course/${sinPrefijo(courseUuid)}/activity/${c.activity_uuid.replace('activity_', '')}`)
  const esHoy = semana.fecha === hoy
  const porVenir = !!semana.fecha && semana.fecha >= hoy
  const clases = semana.clases || []
  const ejercicios = clases.filter((c) => c.tipo === 'ejercicios')
  const tarea = semana.tarea?.estado
  const textoTarea =
    tarea === 'corregida' ? 'Corregida: escucha la corrección' : tarea === 'entregada' ? 'Entregada' : semana.abierta ? `Hasta el ${diaCorto(semana.limite)}` : 'Se abre el día de la clase'
  const linea = [semana.fecha ? `${DIAS[dia(semana.fecha).getDay()]} ${diaCorto(semana.fecha).replace(/^\S+\s/, '')}` : '', hora, profe ? `con ${profe}` : '', duracion]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="p-5 sm:p-6 flex gap-4">
        {semana.fecha ? <FechaGrande fecha={semana.fecha} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#025dc7]">{rotulo}</span>
            {esHoy && <span className="px-2 py-0.5 rounded-full bg-[#4da3ff] text-[#0a1656] text-[11px] font-bold">Hoy</span>}
          </div>
          <h2 className="mt-1 text-[21px] sm:text-[23px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
            {semana.tema || 'Clase de la semana'}
          </h2>
          <p className="mt-1 text-[13.5px] text-[#5B6382] first-letter:uppercase">
            {curso}
            {linea ? ` · ${linea}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {porVenir && !equipo ? <Vienes semana={semana} courseUuid={courseUuid} /> : null}
            {equipo && semana.confirmaciones ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[#3B4262]">
                <Users size={15} className="text-[#025dc7]" />
                {semana.confirmaciones.si} vienen · {semana.confirmaciones.no} no pueden
              </span>
            ) : null}
            <Link
              href={ruta(`/course/${sinPrefijo(courseUuid)}`)}
              className={`ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13.5px] font-bold ${
                esHoy ? 'bg-[#4da3ff] text-[#0a1656] hover:bg-[#5eb4ff]' : 'bg-[#EEF2FA] text-[#1D0084] hover:bg-[#E3EAF8]'
              }`}
            >
              <Video size={16} /> {esHoy ? 'Entrar a la clase' : 'Ver la clase'}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#EEF1F7] bg-[#FBFCFE]">
        {clases
          .filter((c) => c.tipo !== 'ejercicios')
          .map((c) => (
            <Paso key={c.activity_uuid} href={actividad(c)} icono={ICONO[c.tipo] || <FileText size={17} />} titulo={NOMBRE[c.tipo] || c.nombre} detalle={c.tipo === 'presentacion' ? 'Para repasar antes de la clase' : undefined} hecho={c.hecha} />
          ))}
        {ejercicios.length ? (
          <Paso
            href={actividad(ejercicios.find((c) => !c.hecha) || ejercicios[0])}
            icono={ICONO.ejercicios}
            titulo="Ejercicios"
            detalle={`${ejercicios.filter((c) => c.hecha).length} de ${ejercicios.length} hechos`}
            hecho={ejercicios.every((c) => c.hecha)}
          />
        ) : null}
        {semana.ocultas ? <Paso icono={<Clock size={17} />} titulo="Ejercicios y tarea" detalle="Se abren el día de la clase" /> : null}
        {semana.tiene_tarea ? (
          <Paso href={ruta(`/tarea/${semana.id}`)} icono={<PenLine size={17} />} titulo="Tarea" detalle={textoTarea} hecho={tarea === 'entregada' || tarea === 'corregida'} />
        ) : null}
      </div>
    </section>
  )
}

function SemanaDeUnaClase({ uuid, nombre }: { uuid: string; nombre: string }) {
  const { data } = useSemanasClase(uuid)
  if (!data) return <div className={`${TARJETA} h-[220px] animate-pulse`} />
  const { semanas, hoy, actual, proxima } = data
  const equipo = Boolean(data.equipo || data.admin)
  const enCurso = semanas.find((s) => s.id === actual) || null
  const siguiente = semanas.find((s) => s.id === proxima && s.id !== actual) || null
  if (!enCurso && !siguiente) return <Vacio texto={`${nombre}: todavía no hay ninguna semana preparada.`} />
  return (
    <div className="space-y-4">
      {enCurso && (
        <TarjetaSemana semana={enCurso} curso={nombre} courseUuid={uuid} hoy={hoy} equipo={equipo} rotulo={enCurso.fecha >= hoy ? 'Próxima clase' : 'Esta semana'} />
      )}
      {siguiente && <TarjetaSemana semana={siguiente} curso={nombre} courseUuid={uuid} hoy={hoy} equipo={equipo} rotulo={enCurso ? 'La semana que viene' : 'Próxima clase'} />}
    </div>
  )
}

export function ClasesEstaSemana() {
  const { visibles, cargando, Selector } = useClasesVisibles()
  return (
    <Envoltorio>
      <Cabecera titulo="Esta semana" texto="Tu clase en directo, lo que tienes que preparar y lo que te falta por hacer." />
      <Selector />
      {cargando ? (
        <div className={`${TARJETA} h-[220px] animate-pulse`} />
      ) : visibles.length === 0 ? (
        <Vacio texto="Todavía no tienes ninguna clase en directo." />
      ) : (
        <div className="space-y-8">
          {visibles.map((c) => (
            <SemanaDeUnaClase key={c.uuid} uuid={c.uuid} nombre={c.nombre} />
          ))}
        </div>
      )}
    </Envoltorio>
  )
}

// ── Tareas ──────────────────────────────────────────────────────────────────

const ESTADO: Record<string, { texto: string; cls: string }> = {
  pendiente: { texto: 'Por entregar', cls: 'bg-[#FFF6E5] text-[#8A5A00]' },
  entregada: { texto: 'Entregada', cls: 'bg-[#EEF2FA] text-[#1D0084]' },
  corregida: { texto: 'Corregida', cls: 'bg-[#E9F7EF] text-[#13703D]' },
}

function TareasDeUnaClase({ uuid, nombre, mostrarNombre }: { uuid: string; nombre: string; mostrarNombre: boolean }) {
  const { data } = useSemanasClase(uuid)
  const org = useOrg() as any
  if (!data) return null
  const lista = data.semanas.filter((s) => s.tiene_tarea).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  if (!lista.length) return null
  return (
    <div className={`${TARJETA} overflow-hidden`}>
      {mostrarNombre && <div className="px-4 py-2.5 text-[12.5px] font-semibold text-[#6B7393] border-b border-[#EEF1F7]">{nombre}</div>}
      {lista.map((s) => {
        const e = ESTADO[s.tarea?.estado || ''] || null
        const cerrada = !s.abierta
        return (
          <Link
            key={s.id}
            href={getUriWithOrg(org?.slug || '', `/tarea/${s.id}`)}
            className="flex items-center gap-3 px-4 py-3.5 border-t border-[#EEF1F7] first:border-t-0 hover:bg-[#F7F9FD]"
          >
            <PenLine size={17} className="text-[#1D0084] shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-semibold text-[#0B1033] truncate">{s.tema}</span>
              <span className="block text-[12.5px] text-[#6B7393]">
                {cerrada ? `Se abre el ${diaCorto(s.fecha)}` : `Entregar hasta el ${diaCorto(s.limite)}`}
              </span>
            </span>
            {e && !cerrada ? <span className={`shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold ${e.cls}`}>{e.texto}</span> : null}
          </Link>
        )
      })}
    </div>
  )
}

export function ClasesTareas() {
  const { visibles, cargando, Selector } = useClasesVisibles()
  return (
    <Envoltorio>
      <Cabecera titulo="Tareas" texto="Las tareas de tus clases. Se entregan con texto o con una nota de voz y te las corrige el profe." />
      <Selector />
      {cargando ? null : visibles.length === 0 ? (
        <Vacio texto="Todavía no tienes tareas." />
      ) : (
        <div className="space-y-5">
          {visibles.map((c) => (
            <TareasDeUnaClase key={c.uuid} uuid={c.uuid} nombre={c.nombre} mostrarNombre={visibles.length > 1} />
          ))}
        </div>
      )}
    </Envoltorio>
  )
}

// ── Clases grabadas ─────────────────────────────────────────────────────────

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function GrabadasDeUnaClase({ uuid, nombre, mostrarNombre }: { uuid: string; nombre: string; mostrarNombre: boolean }) {
  const { data } = useSemanasClase(uuid)
  const org = useOrg() as any
  const filas = useMemo(() => {
    if (!data) return []
    const ruta = (a: string) => getUriWithOrg(org?.slug || '', `/course/${sinPrefijo(uuid)}/activity/${a.replace('activity_', '')}`)
    const semanas = data.semanas
      .filter((s) => s.fecha && s.fecha < data.hoy)
      .map((s) => {
        const g = (s.clases || []).find((c) => c.tipo === 'grabacion')
        const p = (s.clases || []).find((c) => c.tipo === 'presentacion')
        return { fecha: s.fecha, tema: s.tema, href: g ? ruta(g.activity_uuid) : p ? ruta(p.activity_uuid) : '', tiene: g ? 'Grabación' : p ? 'Solo presentación' : 'Sin grabación', vista: !!g?.hecha }
      })
    const sueltas = (data.archivo || []).map((c) => ({ fecha: c.fecha || '', tema: c.tema || c.nombre, href: ruta(c.activity_uuid), tiene: c.profe ? `Grabación · con ${c.profe}` : 'Grabación', vista: c.hecha }))
    return [...semanas, ...sueltas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [data, org?.slug, uuid])
  if (!data || !filas.length) return null
  const porMes: Record<string, typeof filas> = {}
  for (const f of filas) {
    const d = f.fecha ? dia(f.fecha) : null
    const k = d ? `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` : 'Sin fecha'
    ;(porMes[k] = porMes[k] || []).push(f)
  }
  return (
    <div className="space-y-5">
      {mostrarNombre && <h2 className="text-[15px] font-bold text-[#0B1033]">{nombre}</h2>}
      {Object.entries(porMes).map(([mes, lista]) => (
        <div key={mes}>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A91AD]">{mes}</p>
          <div className={`${TARJETA} overflow-hidden`}>
            {lista.map((f, i) => (
              <Link
                key={i}
                href={f.href || '#'}
                className="flex items-center gap-3 px-4 py-3 border-t border-[#EEF1F7] first:border-t-0 hover:bg-[#F7F9FD]"
              >
                <span className="w-11 shrink-0 text-center">
                  <span className="block text-[18px] font-bold text-[#0B1033] leading-none" style={POPPINS}>
                    {f.fecha ? dia(f.fecha).getDate() : '–'}
                  </span>
                  <span className="block text-[11px] text-[#6B7393] capitalize">{f.fecha ? DIAS[dia(f.fecha).getDay()].slice(0, 3) : ''}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold text-[#0B1033] truncate">{f.tema}</span>
                  <span className="block text-[12.5px] text-[#6B7393]">{f.tiene}</span>
                </span>
                {f.vista ? <span className="shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#E9F7EF] text-[#13703D]">Vista</span> : <Film size={16} className="text-[#9AA1BC]" />}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ClasesGrabadas() {
  const { visibles, cargando, Selector } = useClasesVisibles()
  return (
    <Envoltorio>
      <Cabecera titulo="Clases grabadas" texto="Todas las clases que ya se han dado, para verlas o repasarlas cuando quieras." />
      <Selector />
      {cargando ? null : visibles.length === 0 ? (
        <Vacio texto="Todavía no hay clases grabadas." />
      ) : (
        <div className="space-y-8">
          {visibles.map((c) => (
            <GrabadasDeUnaClase key={c.uuid} uuid={c.uuid} nombre={c.nombre} mostrarNombre={visibles.length > 1} />
          ))}
        </div>
      )}
    </Envoltorio>
  )
}

