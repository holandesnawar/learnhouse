'use client'
/**
 * «Clases dadas» (antes «Archivo»; desde el 12/11/2026 cada clase abre su
 * ficha y el administrador ve arriba «Quién ha dado qué»).
 *
 * El archivo de las clases (08/11/2026): "ver clases anteriores, presentaciones
 * antiguas, nuevas, mejor orden de cómo pasó todo". Todas las semanas de todas
 * las clases en directo, mes a mes y lo más nuevo arriba, con su presentación,
 * su grabación, su tarea y cuántos vinieron. También las grabaciones de antes
 * que no tienen semana. Se filtra por clase, por lo que tiene y por el tema.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUriWithOrg } from '@services/config/config'
import { abrirArchivoProfe } from '@services/tareas/tareas'
import { clasesDadasPorProfe, diaLegible, porMeses, quienDa, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import FichaClase from './FichaClase'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

type Que = 'todo' | 'presentacion' | 'grabacion' | 'tarea'

export default function ArchivoClases({
  orgslug,
  semanas,
  clases,
  hoy,
  token = '',
  admin = false,
  nombres = [],
  recargar,
}: {
  orgslug: string
  semanas: SemanaEquipo[]
  clases: ClaseEquipo[]
  hoy: string
  token?: string
  admin?: boolean
  nombres?: string[]
  recargar?: () => void
}) {
  // La ficha abierta, por su clave (sigue al día al recargar).
  const [ficha, setFicha] = useState('')
  const abierta = (ficha && semanas.find((x) => x.key === ficha)) || null
  const profeDe = useMemo(() => Object.fromEntries(clases.map((c) => [c.uuid, c.profe])), [clases])
  // «Quién ha dado qué» (12/11/2026): solo el administrador, para sus cuentas.
  const dadas = useMemo(() => (admin ? clasesDadasPorProfe(semanas, profeDe, hoy, 3) : []), [admin, semanas, profeDe, hoy])
  const [clase, setClase] = useState('')
  const [que, setQue] = useState<Que>('todo')
  const [buscar, setBuscar] = useState('')
  const [cuando, setCuando] = useState<'pasadas' | 'todas'>('pasadas')
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const actividad = (s: SemanaEquipo, uuid: string) =>
    ruta(`/course/${s.courseUuid.replace(/^course_/, '')}/activity/${uuid.replace(/^activity_/, '')}`)

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return semanas.filter((s) => {
      if (clase && s.courseUuid !== clase) return false
      if (cuando === 'pasadas' && s.fecha && s.fecha > hoy) return false
      if (que === 'presentacion' && !s.presentaciones.length) return false
      if (que === 'grabacion' && !s.grabaciones.length && !s.grabacionSala) return false
      if (que === 'tarea' && !s.tieneTarea) return false
      if (q && !`${s.tema} ${s.curso} ${quienDa(s, profeDe[s.courseUuid] || s.profe)}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [semanas, clase, que, buscar, cuando, hoy, profeDe])
  const meses = porMeses(lista)

  const chip = (on: boolean) =>
    `shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors ${
      on ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3EF] text-[#3B4262] hover:border-[#0b2da0]'
    }`

  return (
    <div className="space-y-4">
      {dadas.length ? (
        <section className="rounded-2xl border border-[#E4E8F2] bg-white px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Quién ha dado qué</p>
          <div className="mt-2.5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            {dadas.map((m) => (
              <div key={m.mes} className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[#0B1033] first-letter:uppercase">
                  {m.titulo} <span className="font-normal text-[#6B7393]">· {m.total} {m.total === 1 ? 'clase' : 'clases'}</span>
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {m.profes.map((p) => (
                    <li key={p.nombre} className="text-[13.5px] text-[#0B1033]">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`font-semibold truncate ${p.nombre === 'Sin profe' ? 'text-[#8A6A2A]' : ''}`}>{p.nombre}</span>
                        <span className="tabular-nums font-semibold">{p.clases}</span>
                      </span>
                      <span className="block text-[12.5px] text-[#6B7393] truncate">{p.porClase.map((c) => `${c.clases} ${c.curso}`).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-[#6B7393]">Cuenta las clases ya dadas, por quién figura en cada una. Si una la dio otra persona, cámbialo en su ficha.</p>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A91AD]" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por tema o profe"
            className="w-full h-9 rounded-lg border border-[#DDE3EF] bg-white pl-9 pr-3 text-[14px] outline-none focus:border-[#0b2da0]"
          />
        </label>
        {clases.length > 1 ? (
          <select
            value={clase}
            onChange={(e) => setClase(e.target.value)}
            className="w-auto max-w-[260px] h-9 rounded-lg border border-[#DDE3EF] bg-white px-3 text-[13.5px] font-semibold text-[#3B4262]"
          >
            <option value="">Todas las clases</option>
            {clases.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.nombre}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex gap-1.5 overflow-x-auto">
          {(
            [
              ['todo', 'Todo'],
              ['presentacion', 'Con presentación'],
              ['grabacion', 'Con grabación'],
              ['tarea', 'Con tarea'],
            ] as [Que, string][]
          ).map(([id, t]) => (
            <button key={id} className={chip(que === id)} onClick={() => setQue(id)}>
              {t}
            </button>
          ))}
          <button className={chip(cuando === 'todas')} onClick={() => setCuando(cuando === 'todas' ? 'pasadas' : 'todas')}>
            También las que vienen
          </button>
        </div>
      </div>

      {!meses.length ? (
        <p className="rounded-2xl border border-[#E4E8F2] bg-white px-5 py-6 text-[14px] text-[#6B7393]">No hay clases con esos filtros.</p>
      ) : (
        meses.map((m) => (
          <section key={m.clave}>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#5B6382] mb-2 first-letter:uppercase">{m.titulo}</h3>
            <div className="rounded-2xl border border-[#E4E8F2] bg-white divide-y divide-[#EEF1F7]">
              {m.items.map((s) => {
                const futura = !!s.fecha && s.fecha > hoy
                return (
                  <div key={s.key} className="flex gap-3 sm:gap-4 px-4 py-3.5">
                    <div className="shrink-0 self-start w-12 text-center rounded-lg border border-[#E4E8F2] py-1.5">
                      <p className="text-[11px] font-semibold uppercase text-[#6B7393] leading-none">{diaLegible(s.fecha).split(' ')[2] || ''}</p>
                      <p className="text-[18px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                        {s.fecha ? Number(s.fecha.slice(8, 10)) : '–'}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5B6382]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="truncate">{s.curso}</span>
                        {s.fecha ? <span className="font-normal">· {diaLegible(s.fecha).split(' ')[0]}</span> : null}
                        {futura ? <span className="font-semibold text-[#0b2da0]">· Próxima</span> : null}
                      </p>
                      <p className="text-[15px] font-semibold text-[#0B1033] leading-snug mt-0.5">{s.tema || 'Sin tema'}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        {s.presentaciones.map((p) => (
                          <Link key={p.activity_uuid} href={actividad(s, p.activity_uuid)} className="font-semibold text-[#0b2da0] hover:underline">
                            {s.material?.archivos.length ? 'Presentación alumnos' : 'Presentación'}
                          </Link>
                        ))}
                        {(s.material?.archivos || []).map((a, i, todos) => (
                          <button
                            key={a.id}
                            onClick={() => abrirArchivoProfe(s.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))}
                            className="font-semibold text-[#0b2da0] hover:underline"
                            title={a.nombre}
                          >
                            {todos.length > 1 ? `Presentación completa ${i + 1}` : 'Presentación completa'}
                          </button>
                        ))}
                        {s.grabaciones.map((g, i) => (
                          <Link key={g.activity_uuid} href={actividad(s, g.activity_uuid)} className="font-semibold text-[#0b2da0] hover:underline">
                            {s.grabaciones.length > 1 ? `Grabación ${i + 1}` : 'Grabación'}
                          </Link>
                        ))}
                        {!s.suelta && !s.presentaciones.length ? <span className="text-[#8A91AD]">Sin presentación</span> : null}
                        {s.grabacionSala && !s.grabaciones.length ? <span className="text-[#3B4262]">Grabación publicada</span> : null}
                        {!s.suelta && !futura && !s.grabaciones.length && !s.grabacionSala ? <span className="text-[#8A91AD]">Sin grabación</span> : null}
                        {s.tieneTarea ? <span className="text-[#3B4262]">Tarea</span> : null}
                        {s.lista?.pasada ? <span className="text-[#3B4262]">Vinieron {s.lista.vinieron}</span> : null}
                        {quienDa(s, profeDe[s.courseUuid] || s.profe) ? <span className="text-[#6B7393]">con {quienDa(s, profeDe[s.courseUuid] || s.profe)}</span> : null}
                      </div>
                      {s.material?.despues?.texto ? <p className="mt-1 text-[13px] text-[#3B4262] line-clamp-2">{s.material.despues.texto}</p> : null}
                      {s.enunciado ? <p className="mt-1 text-[13px] text-[#5B6382] line-clamp-2">{s.enunciado}</p> : null}
                    </div>
                    {s.suelta ? (
                      <Link
                        href={ruta(`/course/${s.courseUuid.replace(/^course_/, '')}`)}
                        className="hidden sm:inline-flex self-center shrink-0 h-8 items-center px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#3B4262] hover:border-[#0b2da0]"
                      >
                        Abrir la clase
                      </Link>
                    ) : (
                      <button
                        onClick={() => setFicha(s.key)}
                        className="self-center shrink-0 h-8 inline-flex items-center px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]"
                      >
                        Ver la ficha
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
      {abierta ? (
        <FichaClase
          semana={abierta}
          clase={clases.find((c) => c.uuid === abierta.courseUuid)}
          hoy={hoy}
          ruta={ruta}
          admin={admin}
          nombres={nombres}
          token={token}
          onCerrar={() => setFicha('')}
          onCambio={() => recargar?.()}
        />
      ) : null}
    </div>
  )
}
