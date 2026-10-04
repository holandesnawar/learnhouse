'use client'

/**
 * Panel → Alumnos → Progreso: cada alumno en una fila, con dónde se quedó y
 * cuándo entró por última vez. Solo administradores.
 *
 * Pedido del usuario (04/10/2026): "tengo que ver en qué lección se quedó cada
 * persona la última vez que entró, y qué día entró por última vez, más
 * moderno". Antes eso estaba repartido entre Clientes (que contaba lecciones y
 * siempre decía 0) y Estadísticas (solo agregados).
 *
 * Estilo de `ui.tsx`: blanco, gris y negro; el color solo en el punto de
 * estado. De dónde sale cada dato: `apps/api/src/services/panel/alumnos.py`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAlumnosProgreso, type AlumnoProgreso } from '@services/panel/panel'
import { Bell, ChevronDown, Loader2, Mail, Search } from 'lucide-react'
import FichaCliente from './FichaCliente'
import RecordatorioModal from './RecordatorioModal'
import { BOTON, BOTON_PRINCIPAL, Estado, TARJETA, filtro, type Tono } from './ui'

type Filtro = 'todos' | 'activo' | 'enfriando' | 'descolgado' | 'sin-empezar'
type Orden = 'entrada' | 'avance' | 'nombre'

const ZONA = 'Europe/Amsterdam'

const TONO: Record<AlumnoProgreso['estado']['id'], Tono> = {
  activo: 'verde',
  enfriando: 'ambar',
  descolgado: 'rojo',
  'sin-empezar': 'ambar',
  nunca: 'gris',
}

/** Día del calendario en Países Bajos ("2026-10-04"), para comparar días. */
function diaNL(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

/**
 * "Hoy, 18:05", "Ayer", "jue 2 oct", "12 sep". Con hora solo si el dato la
 * trae: la visita diaria se guarda por día, sin hora.
 */
function cuando(iso: string): string {
  if (!iso) return 'Nunca'
  const conHora = iso.length > 10
  const d = new Date(conHora ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const dia = conHora ? diaNL(d) : iso
  const hoy = diaNL(new Date())
  const ayer = diaNL(new Date(Date.now() - 86400000))
  const hora = conHora ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA }) : ''
  if (dia === hoy) return hora ? `Hoy, ${hora}` : 'Hoy'
  if (dia === ayer) return hora ? `Ayer, ${hora}` : 'Ayer'
  const dias = Math.round((new Date(`${hoy}T12:00:00`).getTime() - new Date(`${dia}T12:00:00`).getTime()) / 86400000)
  const fecha = new Date(`${dia}T12:00:00`).toLocaleDateString('es-ES', dias < 7 ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
  return dias < 7 ? fecha : `${fecha} · hace ${dias} días`
}

/** "MODULE 2 - FAMILIE" → "Módulo 2 · Familie". Lo demás, tal cual. */
function modulo(nombre: string): string {
  const m = /^\s*(?:module|módulo|modulo)\s+(\d+)\s*[-–:·]\s*(.+)$/i.exec(nombre || '')
  if (!m) return nombre
  // Solo la primera letra en mayúscula, como se escribe en neerlandés: "Eten en drinken".
  const minus = m[2].trim().toLowerCase()
  const resto = minus.charAt(0).toUpperCase() + minus.slice(1)
  return `Módulo ${m[1]} · ${resto}`
}

function Iniciales({ nombre }: { nombre: string }) {
  const ini = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className="w-9 h-9 shrink-0 rounded-full bg-[#F3F4F6] text-[12.5px] font-semibold text-gray-700 flex items-center justify-center">
      {ini || '·'}
    </span>
  )
}

function Barra({ pct, llena }: { pct: number; llena?: boolean }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
      <span
        className={`block h-full rounded-full ${llena ? 'bg-[#16A34A]' : 'bg-gray-900'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  )
}

function Cifra({ label, valor, nota, activo, onClick }: { label: string; valor: number; nota: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${TARJETA} text-left p-3.5 sm:p-4 transition-colors ${activo ? 'border-gray-900 ring-1 ring-gray-900' : 'hover:bg-[#F9FAFB]'}`}
    >
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-[24px] sm:text-[26px] font-semibold tabular-nums text-gray-900 leading-tight mt-1">{valor}</p>
      <p className="hidden sm:block text-[12px] text-[#9CA3AF] mt-0.5">{nota}</p>
    </button>
  )
}

function haceDias(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = Math.floor((Date.now() - t) / 86400000)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
}

function Fila({
  a,
  abierta,
  onToggle,
  onFicha,
  onRecordar,
}: {
  a: AlumnoProgreso
  abierta: boolean
  onToggle: () => void
  onFicha: () => void
  onRecordar: () => void
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full text-left px-4 py-3.5 hover:bg-[#F9FAFB] transition-colors">
        {/* Móvil: lo justo en tres líneas. Quién y cuándo, dónde se quedó y el avance. */}
        <div className="lg:hidden">
          <div className="flex items-center gap-3">
            <Iniciales nombre={a.nombre} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-semibold text-gray-900 truncate">{a.nombre}</p>
                <Estado tono={TONO[a.estado.id]} className="shrink-0">
                  <span className="text-[12.5px] font-medium text-gray-900">{cuando(a.ultima_entrada).split(' · ')[0]}</span>
                </Estado>
              </div>
              <p className="text-[12.5px] text-[#4B5563] truncate">
                {a.donde ? (
                  <>
                    <span className="text-gray-900">{a.donde.clase}</span>
                    <span className="text-[#D1D5DB]"> · </span>
                    {modulo(a.donde.modulo)}
                  </>
                ) : (
                  <span className="text-[#9CA3AF]">Todavía no ha abierto ninguna clase</span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-2.5 pl-12 flex items-center gap-3">
            <Barra pct={a.pct} llena={a.total > 0 && a.hechas >= a.total} />
            <span className="shrink-0 text-[12px] tabular-nums text-[#6B7280]">
              {a.hechas}/{a.total} · {a.pct} %
            </span>
          </div>
        </div>

        {/* Ordenador: una tabla. */}
        <div className="hidden lg:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_16px] gap-x-5 items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Iniciales nombre={a.nombre} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 truncate">{a.nombre}</p>
              <p className="text-[12px] text-[#6B7280] truncate">{a.email}</p>
            </div>
          </div>

          <div className="min-w-0">
            {a.donde ? (
              <>
                <p className="text-[13.5px] font-medium text-gray-900 truncate">{a.donde.clase}</p>
                <p className="text-[12px] text-[#6B7280] truncate">
                  {modulo(a.donde.modulo)}
                  <span className="text-[#D1D5DB]"> · </span>
                  {a.donde.como === 'termino' ? 'la terminó' : a.donde.como === 'repaso' ? 'repasando' : 'la abrió'}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-[#9CA3AF]">Todavía no ha abierto ninguna clase</p>
            )}
          </div>

          <div className="min-w-0">
            <Estado tono={TONO[a.estado.id]}>
              <span className="text-[13.5px] font-medium text-gray-900">{cuando(a.ultima_entrada)}</span>
            </Estado>
            <p className="text-[12px] text-[#6B7280] truncate pl-3">
              {!a.ultima_entrada ? `Alta ${cuando(a.alta)}` : a.entradas_7d ? `${a.entradas_7d} ${a.entradas_7d === 1 ? 'día' : 'días'} esta semana` : 'Ningún día esta semana'}
            </p>
            {a.ultimo_recordatorio ? (
              <p className="text-[12px] text-[#6B7280] truncate pl-3 flex items-center gap-1">
                <Bell size={11} /> Recordado {haceDias(a.ultimo_recordatorio.sent_at)}
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[13.5px] font-semibold tabular-nums text-gray-900">{a.pct} %</span>
              <span className="text-[12px] tabular-nums text-[#6B7280]">
                {a.hechas}/{a.total} clases
              </span>
            </div>
            <Barra pct={a.pct} llena={a.total > 0 && a.hechas >= a.total} />
          </div>

          <ChevronDown size={16} className={`text-[#9CA3AF] transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {abierta ? (
        <div className="px-4 pb-4 lg:pl-16">
          <div className="rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <dl className="space-y-2 text-[13px]">
              <div>
                <dt className="text-[#6B7280]">Estado</dt>
                <dd className="text-gray-900">{a.estado.texto}</dd>
              </div>
              <div>
                <dt className="text-[#6B7280]">Le falta primero</dt>
                <dd className="text-gray-900">
                  {a.siguiente ? `${modulo(a.siguiente.modulo)} · ${a.siguiente.clase}` : a.total ? 'Nada: ha terminado la formación' : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[#6B7280]">Constancia</dt>
                <dd className="text-gray-900">
                  Ha entrado {a.dias_que_entro} {a.dias_que_entro === 1 ? 'día' : 'días'} en total
                  {a.racha > 1 ? ` · racha de ${a.racha} días` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-[#6B7280]">Alumno desde</dt>
                <dd className="text-gray-900">{a.alta ? new Date(`${a.alta}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</dd>
              </div>
              <div>
                <dt className="text-[#6B7280]">Último recordatorio</dt>
                <dd className="text-gray-900">
                  {a.ultimo_recordatorio
                    ? `${haceDias(a.ultimo_recordatorio.sent_at)}${a.ultimo_recordatorio.por ? `, por ${a.ultimo_recordatorio.por}` : ''}`
                    : 'Ninguno todavía'}
                </dd>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={onRecordar} className={BOTON_PRINCIPAL}>
                  <Bell size={14} /> Mandar recordatorio
                </button>
                <button onClick={onFicha} className={BOTON}>
                  Ver su ficha
                </button>
                <a href={`mailto:${a.email}`} className={BOTON}>
                  <Mail size={14} /> Escribirle
                </a>
              </div>
            </dl>

            <div>
              <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-[0.08em] mb-2">Por módulo</p>
              {a.modulos.length ? (
                <ul className="space-y-2">
                  {a.modulos.map((m) => {
                    const pct = m.total ? Math.round((m.hechas * 100) / m.total) : 0
                    return (
                      <li key={m.nombre} className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-3 text-[12.5px]">
                        <span className="truncate text-gray-800">{modulo(m.nombre)}</span>
                        <Barra pct={pct} llena={m.total > 0 && m.hechas === m.total} />
                        <span className="text-right tabular-nums text-[#6B7280]">
                          {m.hechas}/{m.total}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">El curso no tiene clases publicadas.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ProgresoPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [alumnos, setAlumnos] = useState<AlumnoProgreso[] | null>(null)
  const [error, setError] = useState('')
  const [buscar, setBuscar] = useState('')
  const [ver, setVer] = useState<Filtro>('todos')
  const [orden, setOrden] = useState<Orden>('entrada')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [ficha, setFicha] = useState<string | null>(null)
  const [recordar, setRecordar] = useState<AlumnoProgreso | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getAlumnosProgreso(org.id, token)
    if (r.ok && r.datos) {
      setAlumnos(r.datos.alumnos)
      setError('')
    } else setError(r.error || 'No se ha podido cargar')
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cuenta = useMemo(() => {
    const c = { todos: 0, activo: 0, enfriando: 0, descolgado: 0, 'sin-empezar': 0 }
    for (const a of alumnos || []) {
      c.todos++
      if (a.estado.id === 'activo') c.activo++
      else if (a.estado.id === 'enfriando') c.enfriando++
      else if (a.estado.id === 'descolgado') c.descolgado++
      else c['sin-empezar']++ // sin-empezar y nunca
    }
    return c
  }, [alumnos])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    let l = (alumnos || []).filter((a) => {
      if (q && !`${a.nombre} ${a.email}`.toLowerCase().includes(q)) return false
      if (ver === 'todos') return true
      if (ver === 'sin-empezar') return a.estado.id === 'sin-empezar' || a.estado.id === 'nunca'
      return a.estado.id === ver
    })
    if (orden === 'avance') l = [...l].sort((x, y) => y.pct - x.pct || y.hechas - x.hechas)
    else if (orden === 'nombre') l = [...l].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
    return l
  }, [alumnos, buscar, ver, orden])

  if (error) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!alumnos)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )

  const cambiar = (f: Filtro) => setVer((v) => (v === f ? 'todos' : f))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Cifra label="Activos" valor={cuenta.activo} nota="Entraron en los últimos 3 días" activo={ver === 'activo'} onClick={() => cambiar('activo')} />
        <Cifra label="Se enfrían" valor={cuenta.enfriando} nota="De 4 a 7 días sin entrar" activo={ver === 'enfriando'} onClick={() => cambiar('enfriando')} />
        <Cifra label="Descolgados" valor={cuenta.descolgado} nota="Más de una semana sin entrar" activo={ver === 'descolgado'} onClick={() => cambiar('descolgado')} />
        <Cifra label="Sin empezar" valor={cuenta['sin-empezar']} nota="No han hecho ninguna clase" activo={ver === 'sin-empezar'} onClick={() => cambiar('sin-empezar')} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-[#E5E7EB] bg-white text-[13.5px] outline-none focus:border-[#025dc7]"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button onClick={() => setOrden('entrada')} className={filtro(orden === 'entrada')}>
            Última vez
          </button>
          <button onClick={() => setOrden('avance')} className={filtro(orden === 'avance')}>
            Avance
          </button>
          <button onClick={() => setOrden('nombre')} className={filtro(orden === 'nombre')}>
            Nombre
          </button>
        </div>
      </div>

      <div className={`${TARJETA} overflow-hidden`}>
        <div className="hidden lg:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_16px] gap-x-5 px-4 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]">
          <span>Alumno</span>
          <span>Se quedó en</span>
          <span>Última vez</span>
          <span>Avance</span>
          <span />
        </div>
        {lista.length ? (
          <div className="divide-y divide-[#F3F4F6]">
            {lista.map((a) => (
              <Fila
                key={a.user_id}
                a={a}
                abierta={abierta === a.user_id}
                onToggle={() => setAbierta((v) => (v === a.user_id ? null : a.user_id))}
                onFicha={() => setFicha(a.email)}
                onRecordar={() => setRecordar(a)}
              />
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-[#9CA3AF] py-10 text-center">
            {alumnos.length ? 'Nadie coincide con ese filtro.' : 'Todavía no hay alumnos.'}
          </p>
        )}
      </div>

      <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
        «Se quedó en» es la última clase que abrió o terminó. La hora sale cuando la escuela la tiene; si solo entró sin abrir
        ninguna clase, se sabe el día pero no la hora. No salen las cuentas de prueba quitadas de los números.
      </p>

      {ficha ? <FichaCliente email={ficha} onClose={() => setFicha(null)} /> : null}
      {recordar ? <RecordatorioModal alumno={recordar} onClose={() => setRecordar(null)} onEnviado={cargar} /> : null}
    </div>
  )
}
