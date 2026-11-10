'use client'
/**
 * El Inicio de la sala de profes (10/11/2026). Usuario: "ahora está un poco
 * caótico para el profe que entre… al asignar un profe a una clase (Clase
 * semanal · Groep rood será de Paul), al entrar en la sala de profesores
 * tiene que ver como inicio tu siguiente clase, poder ver la presentación…
 * igual para la masterclass y el spreken uur (el monitor)".
 *
 * Antes salía una tarjeta por cada clase (todas a la vez). Ahora:
 * 1. **Tu próxima clase**, en grande: la primera de hoy en adelante que da
 *    esa persona (`agendaEquipo`: la semana o el «La da» de la clase). Con la
 *    presentación de los alumnos, la presentación completa del profe, sus
 *    notas, el mensaje del administrador y «Entrar a la sala» el día.
 * 2. **Después**: sus siguientes clases en una lista corta.
 * 3. **Pendiente de clases anteriores**: la grabación o lo que hay que corregir.
 * El calendario de todas las clases, con quién da cada una, va en su pestaña.
 * El administrador y el monitor ven la próxima de todas las suyas.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, Pencil } from 'lucide-react'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { esDe } from '@/lib/nawar/clasesProfes'
import { agendaEquipo, cuando, diaLegible, grupoDe, paraPreparar, quienDa, sinRepetirGemelas, type ClaseConGemela, type ClaseEnAgenda, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import { EditarSemanaProfe, Material, MensajeDelAdmin, Paso } from './PrepararClase'
import GrabacionDeSala from '@components/Pages/Grabaciones/GrabacionDeSala'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'
const BOTON =
  'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-[#DDE3EF] text-[13.5px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]'
const BOTON_AZUL = 'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold hover:bg-[#0a2690]'

const mayus = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t)

function Hero({
  item,
  hoy,
  ruta,
  token,
  admin,
  mia,
  onEditar,
  onLista,
  recargar,
}: {
  item: ClaseEnAgenda
  hoy: string
  ruta: (p: string) => string
  token: string
  admin: boolean
  mia: boolean
  onEditar: (s: SemanaEquipo) => void
  onLista: (s: SemanaEquipo) => void
  recargar: () => void
}) {
  const s = item.semana
  const uuid = s.courseUuid.replace(/^course_/, '')
  const curso = `/course/${uuid}`
  const esHoy = s.fecha === hoy
  const pres = s.presentaciones[0]
  const actividad = (a: string) => ruta(`${curso}/activity/${a.replace(/^activity_/, '')}`)

  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#EEF1F7]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">{mia ? 'Tu próxima clase' : 'Próxima clase'}</p>
        <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="text-[24px] sm:text-[28px] font-bold text-[#0B1033] leading-tight tracking-tight" style={POPPINS}>
              {mayus(esHoy ? 'hoy' : cuando(s.fecha, hoy).replace(/^el /, ''))}
              {item.hora ? <span className="text-[#5B6382] font-semibold"> · {item.hora}</span> : null}
            </p>
            <p className="mt-1.5 text-[17px] font-semibold text-[#0B1033] leading-snug">{s.tema || 'Sin tema todavía'}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-[#5B6382]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold text-[#3B4262]">{s.curso}</span>
              </span>
              <span>·</span>
              <span>{mia ? 'La das tú' : item.profe ? `La da ${item.profe}` : 'Sin profe puesto'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {esHoy ? (
              <Link href={ruta(`/sala/${uuid}`)} className={BOTON_AZUL}>
                Entrar a la sala
              </Link>
            ) : null}
            <button onClick={() => onEditar(s)} className={BOTON}>
              <Pencil size={14} /> Preparar
            </button>
            <Link href={ruta(curso)} className={BOTON}>
              Abrir la clase
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-4">
        <MensajeDelAdmin semana={s} admin={admin} token={token} onLeido={recargar} />
        <Material semana={s} token={token} />
        <ul className="mt-1 divide-y divide-[#EEF1F7]">
          <Paso
            hecho={!!pres}
            titulo={pres ? 'Presentación para los alumnos, subida' : 'Falta la presentación para los alumnos'}
            detalle={pres ? 'La que miran antes de la clase.' : 'Se sube en la página de la clase, en su semana.'}
            accion={
              pres ? (
                <Link href={actividad(pres.activity_uuid)} className={BOTON}>
                  Ver la presentación
                </Link>
              ) : (
                <Link href={ruta(curso)} className={BOTON_AZUL}>
                  Subir
                </Link>
              )
            }
          />
          <Paso
            hecho={false}
            titulo={esHoy ? 'Dar la clase, hoy' : `Dar la clase, ${cuando(s.fecha, hoy)}`}
            detalle={esHoy ? 'La sala está en la página de la clase y aquí arriba.' : 'La sala se abre el día de la clase.'}
          />
          <Paso
            hecho={!!s.lista?.pasada}
            apagado={!s.lista?.pasada}
            titulo={s.lista?.pasada ? `Asistencia · vinieron ${s.lista.vinieron}` : 'Asistencia: la cuenta la sala sola'}
            detalle={esHoy ? 'Si alguien vino por otro sitio, corrígelo.' : undefined}
            accion={
              esHoy ? (
                <button onClick={() => onLista(s)} className={BOTON}>
                  Corregir
                </button>
              ) : null
            }
          />
        </ul>
        {/* Desde el día de la clase: lo que grabó la sala, para publicarlo (10/11/2026). */}
        <GrabacionDeSala semana={{ id: s.semanaId, tema: s.tema, fecha: s.fecha }} courseUuid={uuid} hoy={hoy} />
      </div>
    </section>
  )
}

export default function InicioSala({
  clases,
  semanas,
  hoy,
  ruta,
  miNombre,
  admin,
  monitor,
  recargar,
  token,
  verCalendario,
}: {
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[] | null
  hoy: string
  ruta: (p: string) => string
  miNombre: string
  admin: boolean
  monitor: boolean
  recargar: () => void
  token: string
  verCalendario: () => void
}) {
  const [editar, setEditar] = useState<SemanaEquipo | null>(null)
  const [lista, setLista] = useState<SemanaEquipo | null>(null)

  if (semanas === null) return <div className={`${TARJETA} px-5 py-6 text-[14px] text-[#6B7393]`}>Cargando tus clases…</div>
  if (!clases.length) return <div className={`${TARJETA} px-5 py-6 text-[14.5px] text-[#3B4262]`}>Todavía no hay clases en directo.</div>

  // El profe ve lo suyo; el administrador y el monitor, todo lo que tienen.
  const filtra = !admin && !monitor
  const esMia = (p: string) => esDe(p, miNombre)
  const agenda = agendaEquipo(clases, semanas, hoy, esMia, 60)
  // Quien lo ve todo no ve dos veces la misma semana (una por grupo): una
  // línea con sus dos días (10/11/2026).
  const suyas: ClaseConGemela[] = filtra ? agenda.filter((a) => a.mia) : sinRepetirGemelas(agenda, semanas)
  const [primera, ...resto] = suyas
  const despues = resto.slice(0, 4)

  // Lo que quedó por hacer de las clases ya dadas (grabación, correcciones).
  const pendientes = paraPreparar(clases, semanas, hoy).filter(
    (f) => f.anterior && f.pendiente.length && (!filtra || esMia(quienDa(f.anterior, f.clase.profe)))
  )

  return (
    <div className="space-y-6">
      {primera ? (
        <Hero
          item={primera}
          hoy={hoy}
          ruta={ruta}
          token={token}
          admin={admin}
          mia={primera.mia}
          onEditar={setEditar}
          onLista={setLista}
          recargar={recargar}
        />
      ) : (
        <div className={`${TARJETA} px-5 sm:px-6 py-6`}>
          <p className="text-[17px] font-bold text-[#0B1033]" style={POPPINS}>
            {filtra ? 'Aún no tienes ninguna clase asignada' : 'No hay clases creadas de aquí en adelante'}
          </p>
          <p className="mt-1.5 text-[14px] text-[#5B6382] max-w-[560px]">
            {filtra
              ? 'Cuando te asignen una clase (o una semana de la masterclass), aparecerá aquí con su presentación y todo lo que necesitas para prepararla.'
              : 'Crea la semana en la página de cada clase para que salga aquí y en el calendario.'}
          </p>
          <button onClick={verCalendario} className={`${BOTON} mt-4`}>
            <CalendarDays size={15} /> Ver el calendario de clases
          </button>
        </div>
      )}

      {despues.length ? (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <h2 className="text-[17px] font-bold text-[#0B1033]" style={POPPINS}>
              {filtra ? 'Tus siguientes clases' : 'Después'}
            </h2>
            <button onClick={verCalendario} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#0b2da0] hover:underline">
              Calendario <ArrowRight size={14} />
            </button>
          </div>
          <ul className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
            {despues.map((a) => {
              const s = a.semana
              const listo = !!s.presentaciones.length
              return (
                <li key={s.key}>
                  <button onClick={() => setEditar(s)} className="w-full flex items-center gap-4 px-4 sm:px-5 py-3 text-left hover:bg-[#F8FAFE]">
                    <div className="w-[92px] shrink-0">
                      <p className="text-[13.5px] font-semibold text-[#0B1033] first-letter:uppercase">{diaLegible(s.fecha)}</p>
                      <p className="text-[12.5px] text-[#6B7393]">{a.hora || '—'}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold text-[#0B1033] truncate">{s.tema || 'Sin tema todavía'}</p>
                      <p className="flex items-center gap-1.5 text-[12.5px] text-[#5B6382] truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        {s.curso}
                        {a.gemela ? ` · y ${diaLegible(a.gemela.fecha)} en ${grupoDe(a.gemela.curso)}` : ''}
                        {!filtra || !a.mia ? ` · ${a.profe ? `la da ${a.profe}` : 'sin profe'}` : ''}
                      </p>
                    </div>
                    <span className={`hidden sm:inline-flex shrink-0 items-center gap-1 text-[12.5px] ${listo ? 'text-[#3B4262]' : 'text-[#8A6A2A]'}`}>
                      {listo ? <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> : null}
                      {listo ? 'Presentación lista' : 'Sin presentación'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {pendientes.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-[#0B1033] mb-2.5" style={POPPINS}>
            Pendiente de clases anteriores
          </h2>
          <ul className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
            {pendientes.map((f) => {
              const a = f.anterior as SemanaEquipo
              const curso = ruta(`/course/${f.clase.uuid.replace(/^course_/, '')}`)
              return (
                <li key={a.key} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold text-[#0B1033] truncate">{a.tema || 'Clase'}</p>
                    <p className="text-[12.5px] text-[#5B6382] truncate">
                      {f.clase.nombre} · {diaLegible(a.fecha)}
                    </p>
                  </div>
                  {f.pendiente.includes('grabacion') ? (
                    <Link href={ruta(`/grabaciones?clase=${f.clase.uuid.replace(/^course_/, '')}`)} className={BOTON}>
                      Publicar la grabación
                    </Link>
                  ) : null}
                  {f.pendiente.includes('corregir') ? (
                    <Link href={ruta('/seguimiento')} className={BOTON}>
                      Corregir {a.porCorregir} {a.porCorregir === 1 ? 'tarea' : 'tareas'}
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {editar ? (
        <EditarSemanaProfe
          semana={editar}
          profeDeLaClase={clases.find((c) => c.uuid === editar.courseUuid)?.profe || ''}
          admin={admin}
          token={token}
          onCerrar={() => setEditar(null)}
          onGuardada={() => {
            setEditar(null)
            recargar()
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
            recargar()
          }}
        />
      ) : null}
    </div>
  )
}
