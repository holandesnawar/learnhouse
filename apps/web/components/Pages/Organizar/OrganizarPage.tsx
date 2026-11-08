'use client'
/**
 * Organizar clases (rediseño, rama diseno, 08/11/2026).
 *
 * Una sola pantalla para la parte académica: qué clase ve cada grupo, quién
 * la da (profe o monitor), Groep rood y Groep blauw como UNA clase con dos
 * grupos, cómo va su semana, y en qué grupo está cada alumno.
 *
 * Lee `GET /panel/org/{id}/organizar` (el equipo). Cambiar es de
 * administradores: grupos de una clase, quién la da y mover alumnos.
 * Ver apps/api/src/services/panel/organizar.py.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ArrowRight, AlertTriangle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { colorDeEtiqueta } from '@/lib/nawar/cursos'
import { BotonVerComo } from '@components/Objects/VerComo/VerComo'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PUNTO: Record<string, string> = {
  rojo: '#DC2626',
  azul: '#2563EB',
  verde: '#16A34A',
  amarillo: '#D97706',
  morado: '#7C3AED',
  gris: '#9CA3AF',
}

type Cifras = {
  alumnos: number
  presentacion: number
  con_presentacion: boolean
  grabacion: number
  con_grabacion: boolean
  clase: number
  sabe_clase: boolean
  ejercicios: number
  con_ejercicios: boolean
  entregadas: number
  por_corregir: number
  con_tarea: boolean
}
type Clase = {
  uuid: string
  base: string
  nombre: string
  etiqueta: string
  publico: boolean
  publicado: boolean
  grupos: number[]
  profe: string
  hora: string
  dia: string
  sala: boolean
  alumnos: number
  semana: { id: number; tema: string; fecha: string } | null
  cifras: Cifras | null
}
type Familia = { nombre: string; clases: Clase[] }
type Grupo = { id: number; nombre: string; alumnos: { id: number; nombre: string }[]; otros: number; clases: string[] }
type Alumno = { id: number; nombre: string; email: string; grupos: number[]; clases: string[]; aviso: string }
type Datos = { familias: Familia[]; grupos: Grupo[]; alumnos: Alumno[]; equipo: { id: number; nombre: string; rol: string }[]; admin: boolean }

function useApi() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const base = `${getAPIUrl()}panel/org/${org?.id}/organizar`
  const llamar = async (ruta: string, metodo: string, cuerpo?: any) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.detail || 'No se pudo guardar')
    return r.json()
  }
  return { org, token, base, llamar }
}

function Punto({ etiqueta }: { etiqueta: string }) {
  if (!etiqueta) return null
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PUNTO[colorDeEtiqueta(etiqueta)] }} />
}

function Pestana({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-4 rounded-lg text-[14px] font-semibold transition-colors ${on ? 'bg-[#0b2da0] text-white' : 'text-[#3B4262] hover:bg-[#EEF3FF]'}`}
    >
      {children}
    </button>
  )
}

// ── Clases ──────────────────────────────────────────────────────────────────

function Cifra({ n, de, texto }: { n: number; de: number; texto: string }) {
  return (
    <div>
      <p className="text-[18px] font-semibold text-[#0B1033] tabular-nums" style={POPPINS}>
        {n}
        <span className="text-[13px] text-[#8A91AD] font-medium">/{de}</span>
      </p>
      <p className="text-[12px] text-[#6B7393]">{texto}</p>
    </div>
  )
}

function ChipGrupo({ nombre, quitar }: { nombre: string; quitar?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-[#EEF3FF] text-[#0b2da0] text-[12.5px] font-semibold">
      {nombre}
      {quitar ? (
        <button onClick={quitar} aria-label={`Quitar ${nombre}`} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white">
          <X size={12} />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  )
}

function AnadirGrupo({ grupos, excluir, onElegir, texto = 'Añadir grupo' }: { grupos: Grupo[]; excluir: number[]; onElegir: (id: number) => void; texto?: string }) {
  const libres = grupos.filter((g) => !excluir.includes(g.id))
  if (!libres.length) return null
  return (
    <label className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-[#C9D4EC] text-[12.5px] font-semibold text-[#3B4262] hover:border-[#0b2da0] hover:text-[#0b2da0] cursor-pointer">
      <Plus size={13} /> {texto}
      <select
        className="absolute inset-0 opacity-0 cursor-pointer"
        value=""
        onChange={(e) => e.target.value && onElegir(Number(e.target.value))}
      >
        <option value="">Elegir…</option>
        {libres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

function TarjetaClase({ c, datos, recargar }: { c: Clase; datos: Datos; recargar: () => void }) {
  const { org, llamar } = useApi()
  const ruta = (p: string) => getUriWithOrg(org?.slug || '', p)
  const nombreGrupo = (id: number) => datos.grupos.find((g) => g.id === id)?.nombre || `#${id}`
  const guardar = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      recargar()
    } catch (e: any) {
      toast.error(String(e?.message || 'No se pudo guardar'))
    }
  }
  const ponerGrupos = (ids: number[]) => guardar(() => llamar(`/clase/${c.uuid}/grupos`, 'PUT', { grupos: ids }), 'Guardado: ya la ven esos grupos')
  const ponerProfe = (profe: string) => guardar(() => llamar(`/clase/${c.uuid}/profe`, 'PUT', { profe }), profe ? `La da ${profe}` : 'Sin asignar')
  const cf = c.cifras
  const cuando = [DIAS[Number(c.dia)] || '', c.hora].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border border-[#E4E8F2] p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15.5px] font-semibold text-[#0B1033]">
            <Punto etiqueta={c.etiqueta} />
            {c.etiqueta || c.base}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6B7393]">
            {cuando || 'Sin día puesto'} · {c.alumnos} {c.alumnos === 1 ? 'alumno' : 'alumnos'}
            {!c.publicado ? ' · sin publicar' : ''}
          </p>
        </div>
        <Link href={ruta(`/course/${c.uuid}`)} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0] hover:underline">
          Abrir <ArrowRight size={14} />
        </Link>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A91AD] mb-1.5">La da</p>
        {datos.admin ? (
          <select
            value={datos.equipo.some((e) => e.nombre === c.profe) ? c.profe : c.profe ? '__otro' : ''}
            onChange={(e) => e.target.value !== '__otro' && ponerProfe(e.target.value)}
            className="h-9 w-full max-w-[280px] px-2.5 rounded-lg border border-[#DDE3F0] bg-white text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]"
          >
            <option value="">Sin asignar</option>
            {c.profe && !datos.equipo.some((e) => e.nombre === c.profe) ? <option value="__otro">{c.profe}</option> : null}
            {datos.equipo.map((e) => (
              <option key={e.id} value={e.nombre}>
                {e.nombre} · {e.rol}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[14px] text-[#0B1033]">{c.profe || 'Sin asignar'}</p>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A91AD] mb-1.5">La ven</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.grupos.length ? (
            c.grupos.map((g) => (
              <ChipGrupo key={g} nombre={nombreGrupo(g)} quitar={datos.admin ? () => ponerGrupos(c.grupos.filter((x) => x !== g)) : undefined} />
            ))
          ) : (
            <span className="text-[13px] text-[#8A6A2A]">{c.publico ? 'Todo el mundo (es pública)' : 'Todos los alumnos'}</span>
          )}
          {datos.admin ? <AnadirGrupo grupos={datos.grupos} excluir={c.grupos} onElegir={(id) => ponerGrupos([...c.grupos, id])} /> : null}
        </div>
      </div>

      <div className="rounded-lg bg-[#F7F9FD] p-3.5">
        {c.semana && cf ? (
          <>
            <p className="text-[13px] text-[#6B7393]">
              Esta semana · <b className="font-semibold text-[#0B1033]">{c.semana.tema}</b>
            </p>
            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cf.con_presentacion ? <Cifra n={cf.presentacion} de={cf.alumnos} texto="Vieron la presentación" /> : null}
              {cf.sabe_clase ? <Cifra n={cf.clase} de={cf.alumnos} texto="Fueron a clase" /> : null}
              {cf.con_ejercicios ? <Cifra n={cf.ejercicios} de={cf.alumnos} texto="Hicieron los ejercicios" /> : null}
              {cf.con_tarea ? <Cifra n={cf.entregadas} de={cf.alumnos} texto="Entregaron la tarea" /> : null}
            </div>
            {cf.por_corregir ? (
              <Link href={ruta('/seguimiento')} className="mt-2.5 inline-flex text-[13px] font-semibold text-[#0b2da0] hover:underline">
                {cf.por_corregir} {cf.por_corregir === 1 ? 'tarea' : 'tareas'} por corregir →
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-[#6B7393]">
            Sin semanas todavía.{' '}
            <Link href={ruta(`/course/${c.uuid}`)} className="font-semibold text-[#0b2da0] hover:underline">
              Crear la primera
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

function Clases({ datos, recargar }: { datos: Datos; recargar: () => void }) {
  if (!datos.familias.length) return <p className="text-[14px] text-[#6B7393]">Todavía no hay clases en directo.</p>
  return (
    <div className="space-y-5">
      {datos.familias.map((f) => (
        <section key={f.nombre} className={`${TARJETA} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-[20px] font-bold text-[#0B1033]" style={POPPINS}>
              {f.nombre}
            </h2>
            <p className="text-[13px] text-[#6B7393]">
              {f.clases.length > 1
                ? `Una clase, ${f.clases.length} grupos. «Nueva semana» se crea en todos a la vez; cada grupo sube su grabación.`
                : 'Un grupo'}
            </p>
          </div>
          <div className={`grid gap-4 ${f.clases.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {f.clases.map((c) => (
              <TarjetaClase key={c.uuid} c={c} datos={datos} recargar={recargar} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Grupos y alumnos ────────────────────────────────────────────────────────

function useMover(recargar: () => void) {
  const { llamar } = useApi()
  return async (user_id: number, sacar_de: number[], meter_en: number[], ok: string) => {
    try {
      await llamar('/alumno', 'POST', { user_id, sacar_de, meter_en })
      toast.success(ok)
      recargar()
    } catch (e: any) {
      toast.error(String(e?.message || 'No se pudo guardar'))
    }
  }
}

function Grupos({ datos, recargar }: { datos: Datos; recargar: () => void }) {
  const mover = useMover(recargar)
  const [abierto, setAbierto] = useState<number | null>(null)
  const nombreClase = (u: string) => {
    for (const f of datos.familias) for (const c of f.clases) if (c.uuid === u) return c.etiqueta ? `${c.base} · ${c.etiqueta}` : c.base
    return u
  }
  return (
    <div className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
      {datos.grupos.map((g) => {
        const on = abierto === g.id
        return (
          <div key={g.id}>
            <button onClick={() => setAbierto(on ? null : g.id)} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-[#F7F9FD]">
              <Punto etiqueta={g.nombre} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-[#0B1033]">{g.nombre}</span>
                <span className="block text-[13px] text-[#6B7393] truncate">
                  {g.clases.length ? `Ve: ${g.clases.map(nombreClase).join(' · ')}` : 'No ve ninguna clase en directo'}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-[#6B7393] tabular-nums">{g.alumnos.length} alumnos</span>
            </button>
            {on ? (
              <div className="px-5 pb-4">
                {g.alumnos.length ? (
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    {g.alumnos.map((a) => {
                      const otros = datos.grupos.filter((x) => x.id !== g.id)
                      return (
                        <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-[#F1F3F8]">
                          <span className="flex-1 min-w-0 text-[14px] text-[#2B3150] truncate">{a.nombre}</span>
                          {datos.admin ? (
                            <select
                              value=""
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === 'quitar') mover(a.id, [g.id], [], `${a.nombre} sale de ${g.nombre}`)
                                else if (v) {
                                  const destino = otros.find((x) => x.id === Number(v))
                                  mover(a.id, [g.id], [Number(v)], `${a.nombre} pasa a ${destino?.nombre}`)
                                }
                              }}
                              className="h-8 px-2 rounded-lg border border-[#DDE3F0] bg-white text-[12.5px] text-[#3B4262]"
                            >
                              <option value="">Mover a…</option>
                              {otros.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nombre}
                                </option>
                              ))}
                              <option value="quitar">Sacar del grupo</option>
                            </select>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#6B7393]">No hay alumnos en este grupo.</p>
                )}
                {g.otros ? <p className="mt-2 text-[12.5px] text-[#8A91AD]">Y {g.otros} del equipo.</p> : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ── Una semana en la clase del otro grupo (08/11/2026) ─────────────────────
// services/tareas/cambio_semana.py: sus tareas siguen en su clase; solo ese
// día va a la del otro grupo (lista y sala). La semana siguiente, la suya.

type OpcionSemana = {
  semana_id: number
  curso: string
  fecha: string
  dia: string
  tema: string
  destinos: { id: number; fecha: string; dia: string; tema: string; curso: string }[]
  cambio: number | null
}

function CambiarSemana({ alumno, onCerrar }: { alumno: Alumno; onCerrar: () => void }) {
  const { llamar } = useApi()
  const [lista, setLista] = useState<OpcionSemana[] | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(0)
  const cargar = () =>
    llamar(`/alumno/${alumno.id}/semanas`, 'GET')
      .then((d) => setLista(d.semanas || []))
      .catch((e) => setError(e?.message || 'No se ha podido cargar'))
  React.useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumno.id])
  async function poner(semanaId: number, destinoId: number) {
    setOcupado(semanaId)
    try {
      await llamar('/alumno/cambio', 'PUT', { user_id: alumno.id, semana_id: semanaId, destino_id: destinoId })
      toast.success(destinoId ? 'Hecho: esa semana va a la otra clase' : 'Hecho: vuelve a su clase')
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido')
    } finally {
      setOcupado(0)
    }
  }
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ zIndex: 'var(--z-modal, 1000)' as any }}>
      <div className="absolute inset-0 bg-[#0a1656]/40" onClick={onCerrar} />
      <div className="relative w-full sm:max-w-[560px] max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
              Cambiar una semana · {alumno.nombre}
            </h3>
            <p className="mt-1 text-[13.5px] text-[#5B6382]">
              Esa semana va a la clase del otro grupo. Sus tareas siguen en su clase y la semana siguiente vuelve a la suya.
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-[#6B7393] hover:bg-[#F2F5FB]">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {error ? <p className="text-[13.5px] text-[#B42323]">{error}</p> : null}
          {lista === null && !error ? <p className="text-[13.5px] text-[#6B7393]">Cargando…</p> : null}
          {lista && !lista.length ? (
            <p className="text-[13.5px] text-[#6B7393]">
              No hay semanas que vengan con la misma clase en el otro grupo. Hace falta que la semana esté creada en las dos clases.
            </p>
          ) : null}
          {(lista || []).map((o) => (
            <div key={o.semana_id} className="rounded-xl border border-[#E4E8F2] p-3.5">
              <p className="text-[12.5px] text-[#6B7393]">
                {o.curso} · {o.dia}
              </p>
              <p className="text-[14.5px] font-semibold text-[#0B1033]">{o.tema || 'Clase de la semana'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.cambio ? (
                  <>
                    <span className="inline-flex items-center h-8 px-3 rounded-lg bg-[#EAF0FE] text-[13px] font-semibold text-[#0b2da0]">
                      Va a la del {o.destinos.find((d) => d.id === o.cambio)?.dia || 'otro grupo'}
                    </span>
                    <button
                      disabled={ocupado === o.semana_id}
                      onClick={() => poner(o.semana_id, 0)}
                      className="h-8 px-3 rounded-lg border border-[#DDE3F0] text-[13px] font-semibold text-[#3B4262] hover:border-[#0b2da0]"
                    >
                      Deshacer
                    </button>
                  </>
                ) : (
                  o.destinos.map((d) => (
                    <button
                      key={d.id}
                      disabled={ocupado === o.semana_id}
                      onClick={() => poner(o.semana_id, d.id)}
                      className="h-8 px-3 rounded-lg border border-[#DDE3F0] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]"
                    >
                      Ir a la del {d.dia}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Alumnos({ datos, recargar }: { datos: Datos; recargar: () => void }) {
  const mover = useMover(recargar)
  const { org } = useApi()
  const [cambiando, setCambiando] = useState<Alumno | null>(null)
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState<number | 'avisos' | ''>('')
  const nombreGrupo = (id: number) => datos.grupos.find((g) => g.id === id)?.nombre || `#${id}`
  const nombreClase = (u: string) => {
    for (const f of datos.familias) for (const c of f.clases) if (c.uuid === u) return c.etiqueta || c.base
    return u
  }
  const lista = datos.alumnos.filter((a) => {
    if (q && !`${a.nombre} ${a.email}`.toLowerCase().includes(q.toLowerCase())) return false
    if (grupo === 'avisos') return !!a.aviso
    if (grupo !== '' && !a.grupos.includes(grupo)) return false
    return true
  })
  const conAviso = datos.alumnos.filter((a) => a.aviso).length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A91AD]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar alumno"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#DDE3F0] bg-white text-[14px] outline-none focus:border-[#0b2da0]"
          />
        </label>
        <select
          value={String(grupo)}
          onChange={(e) => setGrupo(e.target.value === '' ? '' : e.target.value === 'avisos' ? 'avisos' : Number(e.target.value))}
          className="h-9 px-2.5 rounded-lg border border-[#DDE3F0] bg-white text-[14px] text-[#3B4262]"
        >
          <option value="">Todos los grupos</option>
          {datos.grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
          {conAviso ? <option value="avisos">Para revisar ({conAviso})</option> : null}
        </select>
        <span className="text-[13px] text-[#6B7393]">{lista.length} alumnos</span>
      </div>
      <div className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
        {lista.map((a) => (
          <div key={a.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="sm:w-[220px] min-w-0">
              <p className="text-[14.5px] font-semibold text-[#0B1033] truncate">{a.nombre}</p>
              <p className="text-[12.5px] text-[#8A91AD] truncate">{a.email}</p>
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
              {a.grupos.map((g) => (
                <ChipGrupo
                  key={g}
                  nombre={nombreGrupo(g)}
                  quitar={datos.admin ? () => mover(a.id, [g], [], `${a.nombre} sale de ${nombreGrupo(g)}`) : undefined}
                />
              ))}
              {datos.admin ? (
                <AnadirGrupo grupos={datos.grupos} excluir={a.grupos} texto="Grupo" onElegir={(id) => mover(a.id, [], [id], `${a.nombre} entra en ${nombreGrupo(id)}`)} />
              ) : null}
            </div>
            <div className="sm:w-[240px] min-w-0">
              <p className="text-[12.5px] text-[#6B7393] truncate">{a.clases.length ? `Ve: ${a.clases.map(nombreClase).join(' · ')}` : ''}</p>
              {a.aviso ? (
                <p className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#8A6A2A]">
                  <AlertTriangle size={13} /> {a.aviso}
                </p>
              ) : null}
            </div>
            {/* Ver la escuela como la ve este alumno y cambiarle una semana (08/11). */}
            {datos.admin && org?.id ? (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => setCambiando(a)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDE3F0] bg-white text-[13px] font-semibold text-[#3B4262] hover:border-[#0b2da0]"
                >
                  Cambiar una semana
                </button>
                <BotonVerComo orgId={org.id} userId={a.id} nombre={a.nombre} />
              </div>
            ) : null}
          </div>
        ))}
        {!lista.length ? <p className="px-5 py-6 text-[14px] text-[#6B7393]">Nadie con ese filtro.</p> : null}
      </div>
      {cambiando ? <CambiarSemana alumno={cambiando} onCerrar={() => setCambiando(null)} /> : null}
    </div>
  )
}

export default function OrganizarPage() {
  const { org, token, base } = useApi()
  const qc = useQueryClient()
  const [pestana, setPestana] = useState<'clases' | 'grupos' | 'alumnos'>('clases')
  const { data, isError } = useQuery<Datos>({
    queryKey: ['organizar', org?.id],
    queryFn: async () => {
      const r = await fetch(base, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    },
    enabled: !!org?.id && !!token,
    staleTime: 15_000,
  })
  const recargar = () => qc.invalidateQueries({ queryKey: ['organizar', org?.id] })
  const conAviso = useMemo(() => (data?.alumnos || []).filter((a) => a.aviso).length, [data])

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight" style={POPPINS}>
        Organizar clases
      </h1>
      <p className="mt-1 text-[14.5px] text-[#5B6382]">Qué clase ve cada grupo, quién la da y en qué grupo está cada alumno. Todo en un sitio.</p>

      <div className="mt-5 mb-5 flex flex-wrap items-center gap-1.5">
        <Pestana on={pestana === 'clases'} onClick={() => setPestana('clases')}>
          Clases
        </Pestana>
        <Pestana on={pestana === 'grupos'} onClick={() => setPestana('grupos')}>
          Grupos
        </Pestana>
        <Pestana on={pestana === 'alumnos'} onClick={() => setPestana('alumnos')}>
          Alumnos{conAviso ? <span className="ml-1.5 inline-flex min-w-[20px] h-5 px-1.5 rounded-full bg-[#FDF3E1] text-[#8A6A2A] text-[11px] font-bold items-center justify-center">{conAviso}</span> : null}
        </Pestana>
        {data && !data.admin ? <span className="ml-auto text-[12.5px] text-[#8A91AD]">Solo los administradores pueden cambiar cosas aquí.</span> : null}
      </div>

      {isError ? (
        <p className="text-[14px] text-[#6B7393]">Esta pantalla es del equipo de la escuela.</p>
      ) : !data ? (
        <div className={`${TARJETA} h-[320px] animate-pulse`} />
      ) : pestana === 'clases' ? (
        <Clases datos={data} recargar={recargar} />
      ) : pestana === 'grupos' ? (
        <Grupos datos={data} recargar={recargar} />
      ) : (
        <Alumnos datos={data} recargar={recargar} />
      )}
    </div>
  )
}
