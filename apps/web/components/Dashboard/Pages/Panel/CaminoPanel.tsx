'use client'

/**
 * Panel → Alumnos → Camino (27/10/2026): el camino de 16 semanas de cada
 * alumno, en una tabla. Cuándo entró, en qué semana va, cuándo termina y a
 * cuántas clases en directo ha ido de verdad (las cuenta la sala de la
 * escuela). Lo de dentro está en apps/api/src/services/panel/camino.py.
 *
 * Pedido del usuario: "ver en columnas cada alumno: cuándo entró y cuántas
 * clases tomó ya, así veo cuál es cuál y cuándo se termina su camino".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { ArrowDown, ArrowUp, Loader2, Search } from 'lucide-react'
import { getCamino, type AlumnoCamino, type EstadoCamino } from '@services/panel/panel'
import { FichaAlumno } from './ProgresoPanel'
import { Estado, TARJETA, filtro, type Tono } from './ui'

type Filtro = 'todos' | 'en-curso' | 'ultimas' | 'terminado'
type Columna = 'nombre' | 'entro' | 'semana' | 'clases' | 'termina'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "27 oct 2026" a partir de AAAA-MM-DD, sin pasar por zonas horarias. */
function dia(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${d} ${MESES[m - 1]} ${y}`
}

const ESTADO: Record<EstadoCamino, { texto: string; tono: Tono }> = {
  'en-curso': { texto: 'En curso', tono: 'azul' },
  ultimas: { texto: 'Últimas semanas', tono: 'ambar' },
  terminado: { texto: 'Terminado', tono: 'verde' },
  'sin-empezar': { texto: 'Aún no empieza', tono: 'gris' },
  'sin-fecha': { texto: 'Sin fecha', tono: 'gris' },
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

function Barra({ semana, semanas, estado }: { semana: number; semanas: number; estado: EstadoCamino }) {
  const pct = Math.max(0, Math.min(100, (semana / semanas) * 100))
  const color = estado === 'terminado' ? '#16A34A' : estado === 'ultimas' ? '#D97706' : '#025dc7'
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-1.5 flex-1 min-w-[60px] rounded-full bg-[#F3F4F6] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[13px] tabular-nums text-gray-900 shrink-0">
        {semana ? `${semana} de ${semanas}` : '—'}
      </span>
    </div>
  )
}

function Termina({ a }: { a: AlumnoCamino }) {
  if (!a.termina) return <span className="text-[13px] text-[#9CA3AF]">—</span>
  const quedan =
    a.estado === 'terminado'
      ? 'Ya terminó'
      : a.dias_quedan === 0
        ? 'Hoy es el último día'
        : a.dias_quedan !== null
          ? `Faltan ${a.dias_quedan} días`
          : ''
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-gray-900">{dia(a.termina)}</p>
      <p className="text-[12px] text-[#6B7280]">{quedan}</p>
    </div>
  )
}

function Clases({ a }: { a: AlumnoCamino }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] tabular-nums text-gray-900">{a.clases_directo}</p>
      {a.clases_por_curso.length > 0 && (
        <p className="text-[12px] text-[#6B7280] truncate">{a.clases_por_curso.map((c) => `${c.curso} ${c.n}`).join(' · ')}</p>
      )}
    </div>
  )
}

export default function CaminoPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof getCamino>>['datos'] | null>(null)
  const [error, setError] = useState('')
  const [buscar, setBuscar] = useState('')
  const [ver, setVer] = useState<Filtro>('todos')
  const [grupo, setGrupo] = useState('')
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({ col: 'entro', asc: false })
  const [ficha, setFicha] = useState<AlumnoCamino | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getCamino(org.id, token)
    if (r.ok && r.datos) {
      setDatos(r.datos)
      setError('')
    } else setError(r.error || 'No se ha podido cargar')
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const alumnos = datos?.alumnos || []
  const semanas = datos?.semanas || 16

  const cuenta = useMemo(() => {
    const c = { todos: alumnos.length, 'en-curso': 0, ultimas: 0, terminado: 0 }
    for (const a of alumnos) {
      if (a.estado === 'en-curso') c['en-curso']++
      else if (a.estado === 'ultimas') c.ultimas++
      else if (a.estado === 'terminado') c.terminado++
    }
    return c
  }, [alumnos])

  const grupos = useMemo(() => Array.from(new Set(alumnos.flatMap((a) => a.grupos))).sort((x, y) => x.localeCompare(y, 'es')), [alumnos])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    const l = alumnos.filter((a) => {
      if (q && !`${a.nombre} ${a.email}`.toLowerCase().includes(q)) return false
      if (grupo && !a.grupos.includes(grupo)) return false
      return ver === 'todos' || a.estado === ver
    })
    const valor = (a: AlumnoCamino): string | number => {
      switch (orden.col) {
        case 'nombre':
          return a.nombre.toLowerCase()
        case 'semana':
          return a.semana
        case 'clases':
          return a.clases_directo
        case 'termina':
          return a.termina || '9999'
        default:
          return a.entro || '0000'
      }
    }
    return [...l].sort((x, y) => {
      const a = valor(x)
      const b = valor(y)
      const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es')
      return orden.asc ? c : -c
    })
  }, [alumnos, buscar, grupo, ver, orden])

  if (error) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!datos)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )

  const cambiar = (f: Filtro) => setVer((v) => (v === f ? 'todos' : f))
  const ordenar = (col: Columna) =>
    setOrden((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === 'nombre' || col === 'termina' }))
  const Cabecera = ({ col, children }: { col: Columna; children: React.ReactNode }) => (
    <button
      onClick={() => ordenar(col)}
      className="inline-flex items-center gap-1 text-left uppercase tracking-[0.08em] font-semibold hover:text-gray-900"
    >
      {children}
      {orden.col === col ? orden.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : null}
    </button>
  )
  const COLUMNAS = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Cifra label="Alumnos" valor={cuenta.todos} nota="Todos los que salen aquí" activo={ver === 'todos'} onClick={() => setVer('todos')} />
        <Cifra label="En curso" valor={cuenta['en-curso']} nota={`De la semana 1 a la ${semanas - 2}`} activo={ver === 'en-curso'} onClick={() => cambiar('en-curso')} />
        <Cifra label="Últimas semanas" valor={cuenta.ultimas} nota={`Semanas ${semanas - 1} y ${semanas}`} activo={ver === 'ultimas'} onClick={() => cambiar('ultimas')} />
        <Cifra label="Terminados" valor={cuenta.terminado} nota={`Pasaron las ${semanas} semanas`} activo={ver === 'terminado'} onClick={() => cambiar('terminado')} />
      </div>

      {datos.aviso && (
        <p className="text-[13px] text-[#8A6A2A] bg-[#FFFBF2] rounded-lg px-3 py-2">{datos.aviso}</p>
      )}

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
        {grupos.length > 0 && (
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className="h-9 px-2.5 rounded-md border border-[#E5E7EB] bg-white text-[13.5px] outline-none focus:border-[#025dc7]"
          >
            <option value="">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        {/* En el móvil no hay cabeceras: se ordena con estos botones. */}
        <div className="flex gap-1.5 overflow-x-auto lg:hidden">
          <button onClick={() => setOrden({ col: 'entro', asc: false })} className={filtro(orden.col === 'entro')}>
            Entró
          </button>
          <button onClick={() => setOrden({ col: 'termina', asc: true })} className={filtro(orden.col === 'termina')}>
            Termina
          </button>
          <button onClick={() => setOrden({ col: 'clases', asc: false })} className={filtro(orden.col === 'clases')}>
            Clases
          </button>
        </div>
      </div>

      <div className={`${TARJETA} overflow-hidden`}>
        <div
          className={`hidden lg:grid ${COLUMNAS} gap-x-5 px-4 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]`}
        >
          <Cabecera col="nombre">Alumno</Cabecera>
          <span>Grupo</span>
          <Cabecera col="entro">Entró</Cabecera>
          <Cabecera col="semana">Semana</Cabecera>
          <Cabecera col="clases">Clases en directo</Cabecera>
          <Cabecera col="termina">Termina</Cabecera>
        </div>
        {lista.length ? (
          <div className="divide-y divide-[#F3F4F6]">
            {lista.map((a) => (
              <div
                key={a.user_id}
                role="button"
                tabIndex={0}
                onClick={() => setFicha(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setFicha(a)
                }}
                className="cursor-pointer hover:bg-[#F9FAFB] transition-colors"
              >
                {/* Ordenador: una fila con columnas. */}
                <div className={`hidden lg:grid ${COLUMNAS} gap-x-5 items-center px-4 py-3`}>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-gray-900 truncate">{a.nombre}</p>
                    <p className="text-[12px] text-[#6B7280] truncate">{a.email}</p>
                  </div>
                  <p className="text-[12.5px] text-[#4B5563] truncate">{a.grupos.join(' · ') || '—'}</p>
                  <p className="text-[13px] text-gray-900">{dia(a.entro)}</p>
                  <div className="min-w-0 space-y-1">
                    <Barra semana={a.semana} semanas={semanas} estado={a.estado} />
                    <Estado tono={ESTADO[a.estado].tono}>{ESTADO[a.estado].texto}</Estado>
                  </div>
                  <Clases a={a} />
                  <Termina a={a} />
                </div>
                {/* Móvil: una tarjeta. */}
                <div className="lg:hidden px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 truncate">{a.nombre}</p>
                      <p className="text-[12px] text-[#6B7280] truncate">{a.grupos.join(' · ') || 'Sin grupo'}</p>
                    </div>
                    <Estado tono={ESTADO[a.estado].tono} className="shrink-0">
                      {ESTADO[a.estado].texto}
                    </Estado>
                  </div>
                  <Barra semana={a.semana} semanas={semanas} estado={a.estado} />
                  <p className="text-[12.5px] text-[#4B5563]">
                    Entró el {dia(a.entro)} · termina el {dia(a.termina)} · {a.clases_directo}{' '}
                    {a.clases_directo === 1 ? 'clase en directo' : 'clases en directo'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-[#9CA3AF] py-10 text-center">
            {alumnos.length ? 'Nadie coincide con ese filtro.' : 'Todavía no hay alumnos.'}
          </p>
        )}
      </div>

      <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
        Las {semanas} semanas cuentan desde el día que pagó; termina el último día de la semana {semanas}. Las clases en
        directo las cuenta la sala de la escuela (masterclass, Spreken Club, clase semanal) cuando la persona estuvo dentro{' '}
        {datos.minimo_min} minutos o más, una vez por sesión. Empezó a contar el 27/10/2026: lo que se hizo antes por Zoom no
        aparece. No salen las cuentas de prueba ni el grupo Testers.
      </p>

      {ficha ? <FichaAlumno userId={ficha.user_id} nombre={ficha.nombre} onClose={() => setFicha(null)} /> : null}
    </div>
  )
}
