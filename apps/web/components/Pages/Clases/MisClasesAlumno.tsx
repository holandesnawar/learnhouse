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
import { DIAS, MESES, dia, sinPrefijo, pasosDeSemana, FilaPaso } from './pasosSemana'

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
        on ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3F0] text-[#3B4262] hover:border-[#0b2da0]/40'
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

export function Vienes({
  semana,
  courseUuid,
  compacto = false,
  textos = ['Voy', 'No puedo'],
  segmento = false,
}: {
  semana: Semana
  courseUuid: string
  compacto?: boolean
  textos?: [string, string]
  /** Un solo control con dos mitades, sin mensajes (Inicio, 08/11). */
  segmento?: boolean
}) {
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
            : 'bg-white border-[#DDE3F0] text-[#2B3150] hover:border-[#0b2da0]/40'
        }`}
      >
        {va ? <Check size={15} strokeWidth={2.6} /> : <X size={15} strokeWidth={2.6} />}
        {texto}
      </button>
    )
  }
  if (segmento) {
    const parte = (va: boolean, texto: string) => {
      const on = voy === va
      return (
        <button
          type="button"
          onClick={() => elegir(va)}
          disabled={guardando}
          aria-pressed={on}
          className={`h-9 px-4 text-[13.5px] font-semibold transition-colors ${
            on ? (va ? 'bg-[#0b2da0] text-white' : 'bg-[#EEF1F7] text-[#0B1033]') : 'bg-white text-[#3B4262] hover:bg-[#F5F7FC]'
          }`}
        >
          {texto}
        </button>
      )
    }
    return (
      <div className="inline-flex rounded-lg border border-[#DDE3F0] overflow-hidden divide-x divide-[#DDE3F0]">
        {parte(true, textos[0])}
        {parte(false, textos[1])}
      </div>
    )
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacto ? '' : 'pt-1'}`}>
      {!compacto && <span className="text-[13.5px] font-semibold text-[#2B3150] mr-1">¿Vienes a la clase?</span>}
      {boton(true, textos[0])}
      {boton(false, textos[1])}
      {voy === true && <span className="text-[12.5px] text-[#13703D]">¡Te esperamos!</span>}
      {voy === false && <span className="text-[12.5px] text-[#6B7393]">Tendrás la grabación después.</span>}
    </div>
  )
}

// ── Esta semana ─────────────────────────────────────────────────────────────

export { pasosDeSemana, FilaPaso, type PasoSemana } from './pasosSemana'

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
  const esHoy = semana.fecha === hoy
  const pasos = pasosDeSemana(semana, courseUuid, ruta, hoy)
  const hechos = pasos.filter((p) => p.estado === 'hecho').length
  const cuando = semana.fecha ? `${DIAS[dia(semana.fecha).getDay()]} ${dia(semana.fecha).getDate()} ${MESES[dia(semana.fecha).getMonth()]}` : ''
  const meta = [curso, hora, profe ? `con ${profe}` : '', duracion].filter(Boolean).join(' · ')

  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="px-5 sm:px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0b2da0]">
          <span className="uppercase tracking-[0.08em]">{rotulo}</span>
          {cuando ? <span className="text-[#8A91AD] font-medium first-letter:uppercase">· {cuando}</span> : null}
          {esHoy && <span className="ml-1 px-2 py-0.5 rounded-md bg-[#EAF0FE] text-[#0b2da0] text-[11px] font-bold">Hoy</span>}
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[21px] sm:text-[23px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
              {semana.tema || 'Clase de la semana'}
            </h2>
            <p className="mt-1 text-[13.5px] text-[#5B6382]">{meta}</p>
          </div>
          <Link
            href={ruta(`/course/${sinPrefijo(courseUuid)}`)}
            className={`shrink-0 inline-flex items-center h-9 px-4 rounded-lg text-[13.5px] font-semibold ${
              esHoy ? 'bg-[#0b2da0] text-white hover:bg-[#0a2690]' : 'border border-[#DDE3F0] text-[#0B1033] hover:bg-[#F7F9FD]'
            }`}
          >
            {esHoy ? 'Entrar a la clase' : 'Ver la clase'}
          </Link>
        </div>
        {/* «¿Vas a asistir?» va arriba del Inicio (08/11); aquí solo el equipo ve las cuentas. */}
        {equipo && semana.confirmaciones ? (
          <div className="mt-4">
            {semana.confirmaciones ? (
              <span className="text-[13px] text-[#3B4262]">
                <b>{semana.confirmaciones.si}</b> vienen · <b>{semana.confirmaciones.no}</b> no pueden
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {pasos.length ? (
        <div className="border-t border-[#EEF1F7]">
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[12px] font-semibold text-[#8A91AD]">Tu semana</span>
            <span className="text-[12px] text-[#8A91AD]">
              {hechos} de {pasos.length}
            </span>
          </div>
          <div className="pb-2">
            {pasos.map((p) => (
              <FilaPaso key={p.key} p={p} />
            ))}
          </div>
        </div>
      ) : null}
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
  pendiente: { texto: 'Por entregar', cls: 'text-[#8A6A2A]' },
  entregada: { texto: 'Entregada', cls: 'text-[#5B6382]' },
  corregida: { texto: 'Corregida', cls: 'text-[#5B6382]' },
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
            <PenLine size={17} className="text-[#0b2da0] shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-semibold text-[#0B1033] truncate">{s.tema}</span>
              <span className="block text-[12.5px] text-[#6B7393]">
                {cerrada ? `Se abre el ${diaCorto(s.fecha)}` : `Entregar hasta el ${diaCorto(s.limite)}`}
              </span>
            </span>
            {e && !cerrada ? (
              <span className={`shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium ${e.cls}`}>
                {s.tarea?.estado === 'corregida' ? <Check size={14} strokeWidth={2.5} className="text-[#16A34A]" /> : null}
                {e.texto}
              </span>
            ) : null}
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
                {f.vista ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5B6382]">
                    <Check size={14} strokeWidth={2.5} className="text-[#16A34A]" /> Vista
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] font-semibold text-[#0b2da0]">Ver</span>
                )}
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

