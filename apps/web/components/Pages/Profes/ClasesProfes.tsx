'use client'

/**
 * «Mis clases»: el tablero de los profes (04/11/2026).
 *
 * Pedido del usuario: "una sección para los profesores dentro de la escuela,
 * donde puedan ver la siguiente clase, la presentación, algunos recursos,
 * estilo kanban, para que vean su siguiente clase con antelación y llevarlo
 * por ahí, más profesional, y no por WhatsApp".
 *
 * Solo LEE lo que la escuela ya tiene, sin tocar el servidor:
 * - las clases en directo (`/tareas/org/{id}/clases`) y sus semanas
 *   (`/tareas/course/{uuid}/semanas`, con todo lo de dentro para el equipo);
 * - las tareas entregadas sin corregir (`/tareas/org/{id}/por-corregir`);
 * - el recuadro de cada clase (hora y profe), de la configuración de la escuela;
 * - las carpetas de Recursos que esa persona puede ver.
 *
 * Cada tarjeta es una semana. Su columna sale del día (lib/nawar/clasesProfes.ts)
 * y lo que falta por preparar, de lo que la semana tiene dentro. Para cambiar
 * algo (subir la presentación, la grabación, la tarea) se va a la clase.
 *
 * Sale en la escuela (`/mis-clases`, para todo el equipo) y en el panel
 * (Formación → Clases de los profes), con el mismo componente.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  FileText,
  FolderOpen,
  MessageSquare,
  PenLine,
  Presentation,
  Film,
  Video,
} from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { diaCorto, getClasesEnDirecto, getPorCorregir, getSemanas, type ClaseSemana, type Semana } from '@services/tareas/tareas'
import { abrirUrl, getRecursos, type Carpeta } from '@services/recursos/recursos'
import { ajustesDirecto, colorDeEtiqueta, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { COLUMNAS, columnaDe, cuandoCae, esDe, ordenar, preparacion, type Columna } from '@/lib/nawar/clasesProfes'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

/** Un color por clase, para reconocerla de un vistazo. La etiqueta manda (Groep rood → rojo). */
const PALETA = ['#025dc7', '#7C3AED', '#0E9F8E', '#DB2777', '#4da3ff', '#1D0084']
const POR_ETIQUETA: Record<string, string> = {
  rojo: '#DC2626',
  azul: '#2563EB',
  verde: '#16A34A',
  amarillo: '#CA8A04',
  morado: '#7C3AED',
}

type Tarjeta = {
  key: string
  semanaId: number
  courseUuid: string
  curso: string
  color: string
  tema: string
  fecha: string
  hora: string
  profe: string
  duracion: string
  presentaciones: ClaseSemana[]
  grabaciones: ClaseSemana[]
  ejercicios: ClaseSemana[]
  tieneTarea: boolean
  enunciado: string
  limite: string
  porCorregir: number
  sala: boolean
}

function hoyNL(): string {
  // El día de Países Bajos, como el resto de la escuela.
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default function ClasesProfes({ enPanel = false }: { enPanel?: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const orgslug: string = org?.slug || ''
  const config = org?.config?.config
  // La configuración se lee al cargar, sin ser dependencia del efecto: si el
  // objeto cambia de identidad en otro render, no se vuelve a pedir todo.
  const configRef = useRef(config)
  configRef.current = config
  const miNombre: string = session?.data?.user?.first_name || session?.data?.user?.username || ''

  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null)
  const [cursos, setCursos] = useState<{ uuid: string; nombre: string; color: string }[]>([])
  const [carpetas, setCarpetas] = useState<Carpeta[] | null>(null)
  const [fallos, setFallos] = useState<string[]>([])
  const [error, setError] = useState('')
  const [hoy, setHoy] = useState(hoyNL())
  const [filtro, setFiltro] = useState<string>('todas')
  const [soloMias, setSoloMias] = useState(false)
  const [columnaMovil, setColumnaMovil] = useState<Columna>('esta')
  const [verDadas, setVerDadas] = useState(4)

  useEffect(() => {
    if (!org?.id || !token) return
    let vivo = true
    const config = configRef.current
    ;(async () => {
      try {
        const [{ clases }, corregir] = await Promise.all([
          getClasesEnDirecto(org.id, token),
          getPorCorregir(org.id, token).catch(() => ({ entregas: [] as any[] })),
        ])
        const porSemana: Record<number, number> = {}
        for (const e of corregir.entregas || []) porSemana[e.tarea_id] = (porSemana[e.tarea_id] || 0) + 1
        const conColor = clases.map((c, i) => {
          const et = ajustesDirecto(config, c.uuid).etiqueta
          const tono = et ? POR_ETIQUETA[colorDeEtiqueta(et)] : ''
          return { ...c, color: tono || PALETA[i % PALETA.length] }
        })
        const resultados = await Promise.allSettled(conColor.map((c) => getSemanas(c.uuid, token)))
        const lista: Tarjeta[] = []
        const malos: string[] = []
        let diaServidor = ''
        resultados.forEach((r, i) => {
          const c = conColor[i]
          if (r.status !== 'fulfilled') {
            malos.push(c.nombre)
            return
          }
          diaServidor = diaServidor || r.value.hoy
          const ajustes = ajustesDirecto(config, c.uuid)
          const recuadro: any =
            ajustes.banner || (c.uuid === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
          for (const s of r.value.semanas as Semana[]) {
            const clasesDe = s.clases || []
            lista.push({
              key: `${c.uuid}-${s.id}`,
              semanaId: s.id,
              courseUuid: c.uuid,
              curso: c.nombre,
              color: c.color,
              tema: s.tema || '',
              fecha: s.fecha || '',
              hora: String(recuadro.schedule || '').trim(),
              profe: String(recuadro.teacher || '').trim(),
              duracion: String(recuadro.duration || '').trim(),
              presentaciones: clasesDe.filter((x) => x.tipo === 'presentacion'),
              grabaciones: clasesDe.filter((x) => x.tipo === 'grabacion'),
              ejercicios: clasesDe.filter((x) => x.tipo === 'ejercicios'),
              tieneTarea: !!s.tiene_tarea,
              enunciado: s.enunciado || '',
              limite: s.limite || '',
              porCorregir: porSemana[s.id] || 0,
              sala: ajustes.activo || ajustes.directo,
            })
          }
        })
        if (!vivo) return
        if (diaServidor) setHoy(diaServidor)
        setCursos(conColor)
        setTarjetas(lista)
        setFallos(malos)
      } catch (e: any) {
        if (vivo) setError(e?.message || 'No se han podido cargar las clases.')
      }
    })()
    getRecursos(token).then((cs) => vivo && setCarpetas(cs))
    return () => {
      vivo = false
    }
  }, [org?.id, token])

  // «Solo las mías» solo tiene sentido si alguna clase lleva su nombre en el recuadro.
  const hayMias = useMemo(() => (tarjetas || []).some((t) => esDe(t.profe, miNombre)), [tarjetas, miNombre])
  useEffect(() => {
    if (hayMias && !enPanel) setSoloMias(true)
  }, [hayMias, enPanel])

  const visibles = (tarjetas || []).filter(
    (t) => (filtro === 'todas' || t.courseUuid === filtro) && (!soloMias || esDe(t.profe, miNombre))
  )
  const porColumna = (col: Columna) => ordenar(visibles.filter((t) => columnaDe(t.fecha, hoy) === col), col)
  const siguiente = ordenar(
    visibles.filter((t) => t.fecha && t.fecha >= hoy),
    'esta'
  )[0]

  const ruta = (p: string) => getUriWithOrg(orgslug, p)

  return (
    <div className="space-y-6">
      {/* La próxima clase, grande: lo primero que hay que ver. */}
      {tarjetas === null && !error ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 text-[14px] text-[#6B7280]">Cargando tus clases…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[14px] text-red-700">{error}</div>
      ) : (
        <>
          {siguiente ? <Siguiente t={siguiente} hoy={hoy} ruta={ruta} /> : null}

          {/* Filtros: por clase y, si las hay, solo las suyas. */}
          {cursos.length > 1 || hayMias ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {hayMias ? (
                <button
                  onClick={() => setSoloMias((v) => !v)}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${
                    soloMias ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#DDE6F5] text-[#1D0084] hover:border-[#4da3ff]'
                  }`}
                >
                  Solo las mías
                </button>
              ) : null}
              {cursos.length > 1 ? (
                <>
                  <Chip activo={filtro === 'todas'} onClick={() => setFiltro('todas')}>
                    Todas las clases
                  </Chip>
                  {cursos.map((c) => (
                    <Chip key={c.uuid} activo={filtro === c.uuid} onClick={() => setFiltro(c.uuid)} color={c.color}>
                      {c.nombre}
                    </Chip>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}

          {/* Móvil: una columna cada vez. */}
          <div className="lg:hidden flex gap-1 rounded-xl bg-[#EEF3FF] p-1 overflow-x-auto">
            {COLUMNAS.map((c) => {
              const n = porColumna(c.id).length
              return (
                <button
                  key={c.id}
                  onClick={() => setColumnaMovil(c.id)}
                  className={`shrink-0 flex-1 h-9 px-2.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                    columnaMovil === c.id ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480]'
                  }`}
                >
                  {c.corto} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {COLUMNAS.map((c) => {
              const todas = porColumna(c.id)
              const lista = c.id === 'dadas' ? todas.slice(0, verDadas) : todas
              return (
                <section
                  key={c.id}
                  className={`${columnaMovil === c.id ? 'block' : 'hidden'} lg:block rounded-2xl bg-[#F1F5FD] border border-[#E3EAF7] p-3`}
                >
                  <div className="flex items-center justify-between px-1 pb-2.5">
                    <h2 className="text-[14px] font-bold text-[#0a1656]" style={POPPINS}>
                      {c.titulo}
                    </h2>
                    <span className="min-w-[24px] h-6 px-2 rounded-full bg-white text-[12px] font-bold text-[#025dc7] flex items-center justify-center tabular-nums">
                      {todas.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {lista.length === 0 ? (
                      <p className="px-2 py-6 text-center text-[13px] text-[#8A94AD]">{c.vacio}</p>
                    ) : (
                      lista.map((t) => <TarjetaClase key={t.key} t={t} hoy={hoy} ruta={ruta} />)
                    )}
                    {c.id === 'dadas' && todas.length > lista.length ? (
                      <button
                        onClick={() => setVerDadas((n) => n + 8)}
                        className="w-full h-9 rounded-xl text-[13px] font-semibold text-[#025dc7] hover:bg-white transition-colors"
                      >
                        Ver {Math.min(8, todas.length - lista.length)} más
                      </button>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </div>

          {fallos.length ? (
            <p className="text-[12.5px] text-[#8A6A2A]">No se han podido cargar las semanas de: {fallos.join(', ')}.</p>
          ) : null}
          {tarjetas && tarjetas.length === 0 ? (
            <p className="text-[13.5px] text-[#5A6480]">
              Todavía no hay semanas creadas. Se crean en la página de cada clase en directo, con «Nueva semana».
            </p>
          ) : null}
        </>
      )}

      <Recursos carpetas={carpetas} ruta={ruta} enPanel={enPanel} />
    </div>
  )
}

function Chip({ activo, onClick, color, children }: { activo: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${
        activo ? 'bg-white border-[#4da3ff] text-[#1D0084]' : 'bg-white/70 border-[#DDE6F5] text-[#5A6480] hover:text-[#1D0084]'
      }`}
    >
      {color ? <span className="w-2 h-2 rounded-full" style={{ background: color }} /> : null}
      {children}
    </button>
  )
}

function Linea({ t }: { t: Tarjeta }) {
  const partes = [t.fecha ? diaCorto(t.fecha) : 'Sin día', t.hora, t.profe ? `con ${t.profe}` : ''].filter(Boolean)
  return <span className="first-letter:uppercase">{partes.join(' · ')}</span>
}

/** La próxima clase en grande, con lo que hay que hacer antes. */
function Siguiente({ t, hoy, ruta }: { t: Tarjeta; hoy: string; ruta: (p: string) => string }) {
  const prep = preparacion(
    { fecha: t.fecha, presentaciones: t.presentaciones.length, grabaciones: t.grabaciones.length, tieneTarea: t.tieneTarea, porCorregir: t.porCorregir },
    hoy
  )
  const cuando = cuandoCae(t.fecha, hoy)
  const pres = t.presentaciones[0]
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white"
      style={{
        backgroundColor: '#0b2da0',
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(rgba(9,30,150,0.45), rgba(9,30,150,0.45)), url('/fondo-barra.png')",
        backgroundSize: '22px 22px, cover, cover',
        backgroundPosition: '0 0, center, center',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/70">
            Tu próxima clase{cuando ? ` · ${cuando}` : ''}
          </p>
          <h2 className="mt-1 text-[22px] sm:text-[26px] font-bold leading-tight" style={POPPINS}>
            {t.tema || 'Clase sin tema'}
          </h2>
          <p className="mt-1 text-[14px] text-white/85">
            {t.curso} · <Linea t={t} />
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {prep.pasos.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 text-[13px] text-white/90">
                {p.hecho ? (
                  <span className="w-4 h-4 rounded-full bg-[#4da3ff] flex items-center justify-center">
                    <Check size={11} strokeWidth={3} className="text-[#0a1656]" />
                  </span>
                ) : (
                  <CircleAlert size={15} className="text-[#FFD48A]" />
                )}
                {p.texto}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {pres ? (
            <Link
              href={ruta(`/course/${t.courseUuid}/activity/${pres.activity_uuid.replace('activity_', '')}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] px-4 py-2.5 text-[14px] font-bold text-[#0a1656]"
            >
              <Presentation size={16} /> Ver la presentación
            </Link>
          ) : null}
          {cuando === 'Hoy' && t.sala ? (
            <Link
              href={ruta(`/sala/${t.courseUuid}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2.5 text-[14px] font-bold text-white"
            >
              <Video size={16} /> Entrar a la sala
            </Link>
          ) : null}
          <Link
            href={ruta(`/course/${t.courseUuid}`)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2.5 text-[14px] font-bold text-white"
          >
            Abrir la clase <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function TarjetaClase({ t, hoy, ruta }: { t: Tarjeta; hoy: string; ruta: (p: string) => string }) {
  const [abierta, setAbierta] = useState(false)
  const prep = preparacion(
    { fecha: t.fecha, presentaciones: t.presentaciones.length, grabaciones: t.grabaciones.length, tieneTarea: t.tieneTarea, porCorregir: t.porCorregir },
    hoy
  )
  const cuando = cuandoCae(t.fecha, hoy)
  const pct = prep.total ? Math.round((prep.hechos / prep.total) * 100) : 0
  const actividad = (c: ClaseSemana) => ruta(`/course/${t.courseUuid}/activity/${c.activity_uuid.replace('activity_', '')}`)

  return (
    <article className="rounded-xl bg-white border border-[#E1E8F5] p-3.5 hover:border-[#B9D3F7] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 min-w-0 text-[12px] font-semibold text-[#5A6480]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
          <span className="truncate">{t.curso}</span>
        </span>
        {cuando ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              cuando === 'Hoy' ? 'bg-[#4da3ff] text-[#0a1656]' : 'bg-[#EEF3FF] text-[#025dc7]'
            }`}
          >
            {cuando}
          </span>
        ) : null}
      </div>
      <h3 className="mt-1.5 text-[15px] font-bold text-[#0a1656] leading-snug" style={POPPINS}>
        {t.tema || 'Clase sin tema'}
      </h3>
      <p className="mt-0.5 text-[12.5px] text-[#6B7280] flex items-center gap-1.5">
        <CalendarDays size={13} className="shrink-0 text-[#8A94AD]" />
        <Linea t={t} />
      </p>

      <div className="mt-3 h-1.5 rounded-full bg-[#EEF2F9] overflow-hidden" title={`${prep.hechos} de ${prep.total} listo`}>
        <div className={`h-full rounded-full ${pct === 100 ? 'bg-[#16A34A]' : 'bg-[#4da3ff]'}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-2.5 space-y-1">
        {prep.pasos.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
            {p.hecho ? (
              <span className="w-4 h-4 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                <Check size={10} strokeWidth={3.5} className="text-white" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full border-2 border-[#E4B252] shrink-0" />
            )}
            <span className={p.hecho ? 'text-[#4B5563]' : 'text-[#8A6A2A] font-semibold'}>{p.texto}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.presentaciones.map((c) => (
          <Link key={c.activity_uuid} href={actividad(c)} className={BOTON_SUAVE}>
            <FileText size={13} /> Presentación
          </Link>
        ))}
        {t.grabaciones.map((c) => (
          <Link key={c.activity_uuid} href={actividad(c)} className={BOTON_SUAVE}>
            <Film size={13} /> Grabación
          </Link>
        ))}
        {cuando === 'Hoy' && t.sala ? (
          <Link href={ruta(`/sala/${t.courseUuid}`)} className={`${BOTON_SUAVE} !bg-[#4da3ff] !text-[#0a1656]`}>
            <Video size={13} /> Sala
          </Link>
        ) : null}
        {t.porCorregir > 0 ? (
          <Link href={ruta('/seguimiento')} className={BOTON_SUAVE}>
            <PenLine size={13} /> Corregir
          </Link>
        ) : null}
        <Link href={ruta(`/course/${t.courseUuid}`)} className={BOTON_SUAVE}>
          Abrir la clase <ArrowRight size={12} />
        </Link>
      </div>

      {t.tieneTarea || t.ejercicios.length ? (
        <div className="mt-2.5 border-t border-[#EEF2F9] pt-2">
          <button
            onClick={() => setAbierta((v) => !v)}
            className="w-full flex items-center justify-between text-[12.5px] font-semibold text-[#025dc7]"
            aria-expanded={abierta}
          >
            {t.tieneTarea ? 'Ver la tarea y los ejercicios' : 'Ver los ejercicios'}
            <ChevronDown size={15} className={`transition-transform ${abierta ? 'rotate-180' : ''}`} />
          </button>
          {abierta ? (
            <div className="mt-2 space-y-2 text-[12.5px] text-[#374151]">
              {t.tieneTarea ? (
                <div className="rounded-lg bg-[#F7F9FE] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94AD]">
                    Tarea{t.limite ? ` · hasta el ${diaCorto(t.limite)}` : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.enunciado}</p>
                </div>
              ) : null}
              {t.ejercicios.length ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94AD]">Ejercicios</p>
                  <ul className="mt-1 space-y-0.5">
                    {t.ejercicios.map((c) => (
                      <li key={c.activity_uuid}>
                        <Link href={actividad(c)} className="text-[#025dc7] hover:underline">
                          {c.nombre}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

const BOTON_SUAVE =
  'inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[#EEF3FF] text-[12px] font-semibold text-[#025dc7] hover:bg-[#E1EBFF] transition-colors'

/** Las carpetas de Recursos que ve esta persona, para preparar las clases. */
function Recursos({ carpetas, ruta, enPanel }: { carpetas: Carpeta[] | null; ruta: (p: string) => string; enPanel: boolean }) {
  if (carpetas === null) return null
  const todos = ruta(enPanel ? '/dash/estadisticas?tab=recursos' : '/recursos')
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold text-[#0a1656] flex items-center gap-2" style={POPPINS}>
          <FolderOpen size={19} className="text-[#025dc7]" /> Recursos para preparar las clases
        </h2>
        <Link href={todos} className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1 shrink-0">
          Ver todos <ArrowRight size={14} />
        </Link>
      </div>
      {carpetas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#CFDBF2] bg-white px-4 py-5 text-[13.5px] text-[#5A6480]">
          Todavía no hay recursos para ti. El equipo los sube en Recursos, en una carpeta que puedan ver los profes.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {carpetas.slice(0, 6).map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
              <p className="text-[14px] font-bold text-[#0a1656] truncate" style={POPPINS}>
                {c.name}
              </p>
              {c.description ? <p className="text-[12.5px] text-[#6B7280] mt-0.5 line-clamp-2">{c.description}</p> : null}
              <ul className="mt-2 space-y-1">
                {c.items.slice(0, 4).map((it) => (
                  <li key={it.id}>
                    <a
                      href={abrirUrl(it)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[13px] text-[#025dc7] hover:underline min-w-0"
                    >
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">{it.title || it.file_name}</span>
                    </a>
                  </li>
                ))}
                {c.items.length > 4 ? (
                  <li className="text-[12px] text-[#8A94AD]">y {c.items.length - 4} más</li>
                ) : c.items.length === 0 ? (
                  <li className="text-[12px] text-[#8A94AD]">Carpeta vacía</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** La cabecera de la página en la escuela, con el botón para hablar con el equipo. */
export function CabeceraMisClases() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Clock size={24} className="text-[#025dc7]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mis clases</h1>
        </div>
        <p className="mt-1 text-[14px] text-[#5A6480] max-w-2xl">
          Tus próximas clases con su presentación, lo que falta por preparar y los recursos. Si necesitas algo del
          equipo, escríbenos desde Mensajes.
        </p>
      </div>
      <Link
        href="/mensajes"
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] px-4 py-2.5 text-[14px] font-bold text-[#0a1656]"
      >
        <MessageSquare size={16} /> Escribir al equipo
      </Link>
    </div>
  )
}
