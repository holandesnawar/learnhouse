'use client'
/**
 * La sala de profes (08/11/2026, rama diseno): el Inicio del equipo de clases.
 *
 * Pedido del usuario: "que los profes y monitores no tengan el mismo inicio que
 * los alumnos, que vean directamente lo que tienen que hacer y se vea más como
 * que están en el grupo de profes, como Teams… no solo preparar la clase, sino
 * ver clases anteriores, presentaciones antiguas, nuevas, mejor orden de cómo
 * pasó todo, SOPs, mejor kanban, tareas".
 *
 * Como un equipo de Teams: arriba el nombre del equipo y quién está, y debajo
 * pestañas.
 * - **Hoy**: la próxima clase, lo que toca con las clases (presentación,
 *   lista, grabación, correcciones, check-in; calculado de lo que cada semana
 *   tiene dentro), mis tareas, el equipo y cómo va cada clase esta semana.
 * - **Tareas**: el tablero del equipo (por hacer · en curso · hecho).
 * - **Clases**: el tablero de semanas de siempre («Preparar clases»).
 * - **Archivo**: todas las clases que se han dado, mes a mes.
 * - **Manual**: los SOP del equipo.
 *
 * La pestaña va en la dirección (`?vista=`), así se puede enlazar.
 * Servidor: apps/api/src/services/equipo/equipo.py (tareas y manual); lo de
 * las clases sale de apps/api/src/services/tareas/tareas.py.
 */
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Plus } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { getUriWithOrg } from '@services/config/config'
import { mediaSrc } from '@services/messages/direct'
import { cambiarTareaEquipo, getSalaProfes, type DocManual, type Miembro, type TareaEquipo } from '@services/equipo/equipo'
import ClasesProfes from '@components/Pages/Profes/ClasesProfes'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { lunesDe } from '@/lib/nawar/semanasTrabajo'
import { cuando, diaLegible, loQueToca, misTareas, proximaClase, semanaDeCadaClase, type Pendiente, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import useClasesEquipo, { type ClaseEquipo } from './useClasesEquipo'
import TableroEquipo, { POPPINS, TareaModal, TarjetaTarea } from './TableroEquipo'
import ArchivoClases from './ArchivoClases'
import ManualEquipo from './ManualEquipo'

type Vista = 'hoy' | 'tareas' | 'clases' | 'archivo' | 'manual'
const VISTAS: { id: Vista; titulo: string }[] = [
  { id: 'hoy', titulo: 'Hoy' },
  { id: 'tareas', titulo: 'Tareas' },
  { id: 'clases', titulo: 'Preparar clases' },
  { id: 'archivo', titulo: 'Archivo' },
  { id: 'manual', titulo: 'Manual' },
]

const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'

function Equipo({ miembros, tareas }: { miembros: Miembro[]; tareas: TareaEquipo[] }) {
  return (
    <section className={`${TARJETA} px-4 py-4`}>
      <h3 className="text-[15px] font-bold text-[#0B1033]" style={POPPINS}>
        El equipo
      </h3>
      <ul className="mt-3 space-y-2.5">
        {miembros.map((m) => {
          const abiertas = tareas.filter((t) => t.asignado_id === m.id && t.estado !== 'hecho').length
          return (
            <li key={m.id} className="flex items-center gap-2.5">
              <AvatarPersona nombre={m.nombre} src={m.avatar ? mediaSrc(m.avatar) : null} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#0B1033] truncate">{m.nombre}</p>
                <p className="text-[12px] text-[#6B7393]">{m.rol}</p>
              </div>
              {abiertas ? <span className="text-[12px] text-[#5B6382]">{abiertas === 1 ? '1 tarea' : `${abiertas} tareas`}</span> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Check0({ hecho }: { hecho: boolean }) {
  return (
    <span
      className={`shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center ${hecho ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#C9D4EC]'}`}
    >
      {hecho ? <Check size={11} strokeWidth={3} /> : null}
    </span>
  )
}

function EstaSemana({ semanas, hoy, ruta }: { semanas: SemanaEquipo[]; hoy: string; ruta: (p: string) => string }) {
  const lista = semanaDeCadaClase(semanas, hoy, lunesDe(hoy))
  return (
    <section className={`${TARJETA} px-4 py-4`}>
      <h3 className="text-[15px] font-bold text-[#0B1033]" style={POPPINS}>
        Las clases esta semana
      </h3>
      {!lista.length ? (
        <p className="mt-2 text-[13.5px] text-[#6B7393]">No hay clases esta semana.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {lista.map((s) => {
            const pasada = s.fecha < hoy
            return (
              <li key={s.key}>
                <Link href={ruta(`/course/${s.courseUuid.replace(/^course_/, '')}`)} className="block group">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5B6382]">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.curso} · {diaLegible(s.fecha)}
                  </p>
                  <p className="text-[14px] font-semibold text-[#0B1033] group-hover:text-[#0b2da0]">{s.tema || 'Sin tema'}</p>
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-[#3B4262]">
                  <span className="inline-flex items-center gap-1.5">
                    <Check0 hecho={s.presentaciones.length > 0} /> Presentación
                  </span>
                  {s.tieneTarea ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check0 hecho /> Tarea
                    </span>
                  ) : null}
                  {pasada || s.fecha === hoy ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check0 hecho={!!s.lista?.pasada} /> Lista
                    </span>
                  ) : null}
                  {pasada ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check0 hecho={s.grabaciones.length > 0} /> Grabación
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Proxima({ s, hoy, ruta, onLista }: { s: SemanaEquipo; hoy: string; ruta: (p: string) => string; onLista: () => void }) {
  const curso = `/course/${s.courseUuid.replace(/^course_/, '')}`
  const pres = s.presentaciones[0]
  return (
    <section className="rounded-2xl bg-[#0b2da0] text-white px-5 sm:px-6 py-5 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle 360px at 100% 0%, rgba(77,163,255,0.35), transparent 70%)' }}
      />
      <div className="relative">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#B9D8FF]">Tu próxima clase · {cuando(s.fecha, hoy)}</p>
        <h2 className="mt-1 text-[22px] sm:text-[24px] font-bold leading-tight" style={POPPINS}>
          {s.tema || 'Sin tema todavía'}
        </h2>
        <p className="mt-1 text-[14px] text-white/90">
          {s.curso}
          {s.hora ? ` · ${s.hora}` : ''}
          {s.profe ? ` · con ${s.profe}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {pres ? (
            <Link
              href={ruta(`${curso}/activity/${pres.activity_uuid.replace(/^activity_/, '')}`)}
              className="h-9 inline-flex items-center px-3.5 rounded-lg bg-white text-[#0b2da0] text-[13.5px] font-semibold"
            >
              Ver la presentación
            </Link>
          ) : (
            <Link href={ruta(curso)} className="h-9 inline-flex items-center px-3.5 rounded-lg bg-white text-[#0b2da0] text-[13.5px] font-semibold">
              Subir la presentación
            </Link>
          )}
          {s.fecha === hoy ? (
            <Link href={ruta(`/sala/${s.courseUuid.replace(/^course_/, '')}`)} className="h-9 inline-flex items-center px-3.5 rounded-lg border border-white/40 text-[13.5px] font-semibold">
              Entrar a la sala
            </Link>
          ) : null}
          {s.fecha <= hoy && s.lista ? (
            <button onClick={onLista} className="h-9 inline-flex items-center px-3.5 rounded-lg border border-white/40 text-[13.5px] font-semibold">
              {s.lista.pasada ? `Lista · vinieron ${s.lista.vinieron}` : 'Pasar lista'}
            </button>
          ) : null}
          <Link href={ruta(curso)} className="h-9 inline-flex items-center gap-1 px-3 text-[13.5px] font-semibold text-white/90 hover:text-white">
            Abrir la clase <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function FilaPendiente({ p, ruta, onLista }: { p: Pendiente; ruta: (path: string) => string; onLista: (s: SemanaEquipo) => void }) {
  const curso = p.semana ? `/course/${p.semana.courseUuid.replace(/^course_/, '')}` : ''
  const destino = p.tipo === 'corregir' || p.tipo === 'checkin' ? ruta('/seguimiento') : ruta(curso)
  const boton =
    p.tipo === 'presentacion' ? 'Subir' : p.tipo === 'grabacion' ? 'Subir' : p.tipo === 'lista' ? 'Pasar lista' : p.tipo === 'corregir' ? 'Corregir' : 'Ver'
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`shrink-0 w-[18px] h-[18px] rounded-full border ${p.urgente ? 'border-[#B42318]' : 'border-[#C9D4EC]'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-[#0B1033] leading-snug">{p.texto}</p>
        <p className={`text-[12.5px] ${p.urgente ? 'text-[#B42318]' : 'text-[#6B7393]'}`}>{p.detalle}</p>
      </div>
      {p.tipo === 'lista' && p.semana ? (
        <button
          onClick={() => onLista(p.semana!)}
          className="shrink-0 h-8 px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]"
        >
          {boton}
        </button>
      ) : (
        <Link href={destino} className="shrink-0 h-8 inline-flex items-center px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]">
          {boton}
        </Link>
      )}
    </li>
  )
}

function Hoy({
  orgId,
  token,
  yo,
  admin,
  miembros,
  tareas,
  setTareas,
  clases,
  semanas,
  porCorregir,
  checkins,
  hoy,
  ruta,
  irA,
  manual,
  recargarClases,
}: {
  orgId: number
  token: string
  yo: number
  admin: boolean
  miembros: Miembro[]
  tareas: TareaEquipo[]
  setTareas: React.Dispatch<React.SetStateAction<TareaEquipo[]>>
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[] | null
  porCorregir: number
  checkins: number
  hoy: string
  ruta: (p: string) => string
  irA: (v: Vista, doc?: number) => void
  manual: DocManual[]
  recargarClases: () => void
}) {
  const [abierta, setAbierta] = useState<TareaEquipo | null>(null)
  const [nueva, setNueva] = useState(false)
  const [lista, setLista] = useState<SemanaEquipo | null>(null)
  const pendientes = semanas ? loQueToca(semanas, hoy, porCorregir, checkins) : []
  const proxima = semanas ? proximaClase(semanas, hoy) : null
  const mias = misTareas(tareas, yo)

  async function hecha(t: TareaEquipo) {
    setTareas((ts) => ts.map((x) => (x.id === t.id ? { ...x, estado: 'hecho', done_at: new Date().toISOString() } : x)))
    try {
      const c = await cambiarTareaEquipo(orgId, t.id, { estado: 'hecho' }, token)
      setTareas((ts) => ts.map((x) => (x.id === c.id ? c : x)))
    } catch {
      setTareas((ts) => ts.map((x) => (x.id === t.id ? t : x)))
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        {semanas === null ? (
          <div className={`${TARJETA} px-5 py-6 text-[14px] text-[#6B7393]`}>Cargando las clases…</div>
        ) : proxima ? (
          <Proxima s={proxima} hoy={hoy} ruta={ruta} onLista={() => setLista(proxima)} />
        ) : null}

        <section className={TARJETA}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <h3 className="text-[16px] font-bold text-[#0B1033]" style={POPPINS}>
              Lo que toca con las clases
            </h3>
            {pendientes.length ? <span className="text-[13px] text-[#6B7393]">{pendientes.length}</span> : null}
          </div>
          {semanas !== null && !pendientes.length ? (
            <p className="px-4 pb-4 text-[14px] text-[#5B6382]">Todo al día: presentaciones, listas y grabaciones.</p>
          ) : (
            <ul className="divide-y divide-[#EEF1F7]">
              {pendientes.map((p) => (
                <FilaPendiente key={p.id} p={p} ruta={ruta} onLista={setLista} />
              ))}
            </ul>
          )}
        </section>

        <section className={TARJETA}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <h3 className="text-[16px] font-bold text-[#0B1033]" style={POPPINS}>
              Mis tareas
            </h3>
            {mias.length ? <span className="text-[13px] text-[#6B7393]">{mias.length}</span> : null}
            <button onClick={() => setNueva(true)} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0]">
              <Plus size={14} /> Nueva
            </button>
            <button onClick={() => irA('tareas')} className="text-[13px] font-semibold text-[#5B6382] hover:text-[#0b2da0]">
              Ver el tablero
            </button>
          </div>
          {!mias.length ? (
            <p className="px-4 pb-4 text-[14px] text-[#5B6382]">No tienes tareas pendientes.</p>
          ) : (
            <ul className="divide-y divide-[#EEF1F7]">
              {mias.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    onClick={() => hecha(t)}
                    aria-label="Marcar como hecha"
                    className="shrink-0 w-[18px] h-[18px] rounded-full border border-[#C9D4EC] hover:border-[#16A34A] hover:text-[#16A34A] flex items-center justify-center text-transparent"
                  >
                    <Check size={11} strokeWidth={3} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <TarjetaTarea t={t} hoy={hoy} clases={clases} miembros={miembros} onAbrir={() => setAbierta(t)} compacta />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <Equipo miembros={miembros} tareas={tareas} />
        {semanas ? <EstaSemana semanas={semanas} hoy={hoy} ruta={ruta} /> : null}
        {manual.length ? (
          <section className={`${TARJETA} px-4 py-4`}>
            <h3 className="text-[15px] font-bold text-[#0B1033]" style={POPPINS}>
              Manual del equipo
            </h3>
            <ul className="mt-2 space-y-1">
              {manual.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <button onClick={() => irA('manual', d.id)} className="text-left text-[14px] text-[#1F2440] hover:text-[#0b2da0]">
                    {d.titulo}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => irA('manual')} className="mt-2 text-[13px] font-semibold text-[#0b2da0]">
              Abrir el manual
            </button>
          </section>
        ) : null}
      </div>

      {abierta || nueva ? (
        <TareaModal
          orgId={orgId}
          token={token}
          tarea={abierta}
          miembros={miembros}
          clases={clases}
          yo={yo}
          admin={admin}
          onCerrar={() => {
            setAbierta(null)
            setNueva(false)
          }}
          onGuardada={(t) => {
            setTareas((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [t, ...ts]))
            setAbierta(null)
            setNueva(false)
          }}
          onBorrada={(id) => {
            setTareas((ts) => ts.filter((x) => x.id !== id))
            setAbierta(null)
          }}
        />
      ) : null}
      {lista ? (
        <PasarLista
          semanaId={lista.semanaId}
          tema={lista.tema}
          curso={lista.curso}
          token={token}
          onCerrar={() => setLista(null)}
          onGuardada={() => {
            setLista(null)
            recargarClases()
          }}
        />
      ) : null}
    </div>
  )
}

export default function SalaProfes() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { isAdmin } = useAdminStatus() as any
  const orgslug: string = org?.slug || ''
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const vistaUrl = (params?.get('vista') || 'hoy') as Vista
  const vista: Vista = VISTAS.some((v) => v.id === vistaUrl) ? vistaUrl : 'hoy'
  const [docAbrir, setDocAbrir] = useState<number | null>(null)
  // La barra lateral marca la pestaña abierta: se le avisa al cambiar.
  useEffect(() => {
    window.dispatchEvent(new Event('nawar-vista'))
  }, [vista])

  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [tareas, setTareas] = useState<TareaEquipo[]>([])
  const [manual, setManual] = useState<DocManual[]>([])
  const [yo, setYo] = useState<{ id: number; admin: boolean }>({ id: session?.data?.user?.id || 0, admin: !!isAdmin })
  const [error, setError] = useState('')
  const { clases, semanas, porCorregir, checkins, hoy, recargar } = useClasesEquipo(org, token)

  useEffect(() => {
    if (!org?.id || !token) return
    getSalaProfes(org.id, token)
      .then((d) => {
        setMiembros(d.miembros)
        setTareas(d.tareas)
        setManual(d.manual)
        setYo(d.yo)
      })
      .catch((e) => setError(e?.message || 'No se ha podido cargar la sala de profes'))
  }, [org?.id, token])

  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const irA = (v: Vista, doc?: number) => {
    setDocAbrir(doc ?? null)
    const q = new URLSearchParams(params?.toString() || '')
    if (v === 'hoy') q.delete('vista')
    else q.set('vista', v)
    const s = q.toString()
    router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false })
  }

  const u = session?.data?.user || {}
  const nombre = u.first_name || u.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const urgentes = useMemo(() => (semanas ? loQueToca(semanas, hoy, porCorregir, checkins).filter((p) => p.urgente).length : 0), [semanas, hoy, porCorregir, checkins])

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Como la cabecera de un equipo de Teams: quiénes somos y las pestañas. */}
      <header>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Sala de profes</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight leading-tight" style={POPPINS}>
              {saludo}
              {nombre ? `, ${nombre}` : ''}
            </h1>
            <p className="mt-1 text-[14.5px] text-[#5B6382]">
              {urgentes ? `${urgentes === 1 ? 'Hay 1 cosa urgente' : `Hay ${urgentes} cosas urgentes`} con las clases.` : 'El equipo de clases de Holandés Nawar.'}
            </p>
          </div>
          {miembros.length ? (
            <div className="ml-auto flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {miembros.slice(0, 6).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-white" title={`${m.nombre} · ${m.rol}`}>
                    <AvatarPersona nombre={m.nombre} src={m.avatar ? mediaSrc(m.avatar) : null} size={32} />
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-[#5B6382]">{miembros.length === 1 ? '1 persona' : `${miembros.length} personas`}</span>
            </div>
          ) : null}
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-[#E4E8F2] -mx-4 px-4 sm:mx-0 sm:px-0">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => irA(v.id)}
              className={`shrink-0 h-10 px-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
                vista === v.id ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-transparent text-[#5B6382] hover:text-[#0B1033]'
              }`}
            >
              {v.titulo}
              {v.id === 'tareas' && misTareas(tareas, yo.id).length ? (
                <span className="ml-1.5 text-[12px] font-semibold text-[#6B7393]">{misTareas(tareas, yo.id).length}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p> : null}

      <div className="mt-6">
        {vista === 'hoy' ? (
          <Hoy
            orgId={org?.id}
            token={token}
            yo={yo.id}
            admin={yo.admin}
            miembros={miembros}
            tareas={tareas}
            setTareas={setTareas}
            clases={clases}
            semanas={semanas}
            porCorregir={porCorregir}
            checkins={checkins}
            hoy={hoy}
            ruta={ruta}
            irA={irA}
            manual={manual}
            recargarClases={recargar}
          />
        ) : vista === 'tareas' ? (
          <TableroEquipo orgId={org?.id} token={token} tareas={tareas} setTareas={setTareas} miembros={miembros} clases={clases} yo={yo.id} admin={yo.admin} hoy={hoy} />
        ) : vista === 'clases' ? (
          <ClasesProfes />
        ) : vista === 'archivo' ? (
          semanas === null ? (
            <p className="text-[14px] text-[#6B7393]">Cargando las clases…</p>
          ) : (
            <ArchivoClases orgslug={orgslug} semanas={semanas} clases={clases} hoy={hoy} />
          )
        ) : (
          <ManualEquipo key={docAbrir ?? 'm'} orgId={org?.id} token={token} manual={manual} setManual={setManual} admin={yo.admin} abrir={docAbrir} />
        )}
      </div>
    </div>
  )
}
