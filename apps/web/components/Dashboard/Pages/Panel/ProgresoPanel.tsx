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

import { textoBienvenida } from '@/lib/nawar/bienvenida'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  abrirModulo,
  cambiarCorreoAlumno,
  darEnlaceContrasena,
  getAlumnosProgreso,
  quitarAperturaModulo,
  type AlumnoProgreso,
  type AperturaModulo,
} from '@services/panel/panel'
import { Bell, ChevronDown, Copy, KeyRound, Loader2, Lock, Mail, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import FichaCliente from './Ficha'
import RecordatorioModal from './RecordatorioModal'
import Atascados from './Atascados'
import {
  Barra,
  CambiarCorreo,
  Cifra,
  EnlaceContrasena,
  Iniciales,
  ModulosPorAvance,
  abrirAMano,
  cuando,
  deshacerAMano,
  fechaCorta,
  haceDias,
  modulo,
} from './AlumnoPiezas'
import { BOTON, BOTON_PRINCIPAL, Estado, TARJETA, filtro, type Tono } from './ui'

type Filtro = 'todos' | 'activo' | 'enfriando' | 'descolgado' | 'sin-empezar'
type Orden = 'entrada' | 'avance' | 'nombre'


const TONO: Record<AlumnoProgreso['estado']['id'], Tono> = {
  activo: 'verde',
  enfriando: 'ambar',
  descolgado: 'rojo',
  'sin-empezar': 'ambar',
  nunca: 'gris',
}

export function DetalleAlumno({
  a,
  onFicha,
  onRecordar,
  onAbrir,
  onDeshacer,
  apilado = false,
}: {
  a: AlumnoProgreso
  onFicha?: () => void
  onRecordar: () => void
  onAbrir: (m: AperturaModulo) => void
  onDeshacer: (m: AperturaModulo) => void
  /** En un panel estrecho (la ficha de Usuarios): una columna siempre. */
  apilado?: boolean
}) {
  return (
    <div
      className={`rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] p-4 grid gap-4 ${
        apilado ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'
      }`}
    >
      <dl className="space-y-2 text-[13px]">
        <div>
          <dt className="text-[#6B7280]">Estado</dt>
          <dd className="text-gray-900">{a.estado.texto}</dd>
        </div>
        <div>
          <dt className="text-[#6B7280]">Vídeo de bienvenida</dt>
          <dd className="text-gray-900">{textoBienvenida(a.bienvenida)}</dd>
        </div>
        <div>
          <dt className="text-[#6B7280]">Su objetivo</dt>
          <dd className="text-gray-900">
            {a.plan ? (
              <>
                {a.plan.texto || a.plan.objetivo}
                {a.plan.texto && a.plan.texto !== a.plan.objetivo ? ` (${a.plan.objetivo})` : ''}
                {a.plan.dias ? (
                  <span className="block text-[#6B7280]">
                    Se propuso estudiar {a.plan.dias} a las {a.plan.hora}, {a.plan.minutos} minutos
                  </span>
                ) : null}
              </>
            ) : (
              'Aún no lo ha dicho'
            )}
          </dd>
        </div>
        {a.plan?.conocerte && Object.keys(a.plan.conocerte).length ? (
          <div>
            <dt className="text-[#6B7280]">
              Al empezar nos contó{a.plan.conocerte_at ? ` (${fechaCorta(a.plan.conocerte_at)})` : ''}
            </dt>
            <dd className="text-gray-900 space-y-1">
              {a.plan.conocerte.de_donde || a.plan.conocerte.vive_en ? (
                <span className="block">
                  {[a.plan.conocerte.de_donde && `De ${a.plan.conocerte.de_donde}`, a.plan.conocerte.vive_en && `vive en ${a.plan.conocerte.vive_en}`]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              ) : null}
              {a.plan.conocerte.problema ? (
                <span className="block">
                  <span className="text-[#6B7280]">Lo que más le cuesta: </span>«{a.plan.conocerte.problema}»
                </span>
              ) : null}
              {a.plan.conocerte.en_4_meses ? (
                <span className="block">
                  <span className="text-[#6B7280]">Cómo se ve en 4 meses: </span>«{a.plan.conocerte.en_4_meses}»
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[#6B7280]">Lecturas de la semana</dt>
          <dd className="text-gray-900">
            {a.lecturas?.length ? (
              <ul className="space-y-0.5">
                {a.lecturas.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <span lang="nl">{l.titulo}</span>
                    {': '}
                    <span className={l.aciertos === l.total ? 'text-[#16A34A] font-semibold' : 'font-semibold'}>
                      {l.aciertos} de {l.total}
                    </span>
                    {l.veces && l.veces > 1 ? <span className="text-[#6B7280]"> · {l.veces} veces, la mejor {l.mejor}</span> : null}
                  </li>
                ))}
                {a.lecturas.length > 6 ? <li className="text-[#6B7280]">y {a.lecturas.length - 6} más</li> : null}
              </ul>
            ) : (
              'Aún no ha hecho los ejercicios de ninguna'
            )}
          </dd>
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
          <dt className="text-[#6B7280]">Cómo se le abren los módulos</dt>
          <dd className="text-gray-900">
            {a.por_avance
              ? 'Por avance: cada uno al terminar el anterior (80 % de las clases) y pasada su espera.'
              : 'Por las fechas de la primera convocatoria.'}
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
          {onFicha ? (
            <button onClick={onFicha} className={BOTON}>
              Ver su ficha
            </button>
          ) : null}
          <a href={`mailto:${a.email}`} className={BOTON}>
            <Mail size={14} /> Escribirle
          </a>
        </div>
        <EnlaceContrasena a={a} />
        <CambiarCorreo a={a} />
      </dl>

      <div>
        <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-[0.08em] mb-2">Por módulo</p>
        {a.por_avance && a.aperturas.length ? (
          <ModulosPorAvance a={a} onAbrir={onAbrir} onDeshacer={onDeshacer} />
        ) : a.modulos.length ? (
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
  )
}

function Fila({
  a,
  abierta,
  onToggle,
  onFicha,
  onRecordar,
  onAbrir,
  onDeshacer,
}: {
  a: AlumnoProgreso
  abierta: boolean
  onToggle: () => void
  onFicha: () => void
  onRecordar: () => void
  onAbrir: (m: AperturaModulo) => void
  onDeshacer: (m: AperturaModulo) => void
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
          <DetalleAlumno a={a} onFicha={onFicha} onRecordar={onRecordar} onAbrir={onAbrir} onDeshacer={onDeshacer} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * La ficha de un alumno, en un panel lateral (15/10/2026, "en la ficha del
 * alumno en Usuarios, si veo que estuvo 7 días sin entrar, enviarle un
 * recordatorio a mano"). Lo mismo que se ve al abrir su fila en Progreso:
 * cuándo entró, dónde se quedó, sus módulos y «Mandar recordatorio».
 *
 * Sale de la misma lista que Progreso (`GET /panel/org/{id}/alumnos`), así que
 * quien no está ahí (sin rol de alumno, en el grupo Testers o fuera de los
 * números) lo dice en vez de enseñar una ficha vacía.
 */
export function FichaAlumno({ userId, nombre, onClose }: { userId: number; nombre?: string; onClose: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [alumnos, setAlumnos] = useState<AlumnoProgreso[] | null>(null)
  const [error, setError] = useState('')
  const [recordar, setRecordar] = useState<AlumnoProgreso | null>(null)
  const [ficha, setFicha] = useState<string | null>(null)

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

  // Escape cierra la ficha, salvo que haya otra ventana encima (que se cierra ella).
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && !recordar && !ficha && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose, recordar, ficha])

  const a = alumnos?.find((x) => x.user_id === userId) || null

  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
        <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25" />
        <div className="relative h-full w-full sm:max-w-[560px] bg-white border-l border-[#E5E7EB] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <Iniciales nombre={a?.nombre || nombre || '?'} />
              <div className="min-w-0">
                <p className="text-[18px] font-semibold text-gray-900 truncate">{a?.nombre || nombre || 'Alumno'}</p>
                {a ? <p className="text-[12.5px] text-[#6B7280] truncate">{a.email}</p> : null}
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
              <X size={18} />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-4">
            {error ? (
              <p className="text-[13.5px] text-red-700">{error}</p>
            ) : !alumnos ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : !a ? (
              <p className="text-[13.5px] text-gray-700 leading-relaxed">
                No sale en el progreso de los alumnos: no tiene el rol de alumno, está en el grupo Testers o está fuera de los
                números. Por eso no se le puede mandar un recordatorio desde aquí.
              </p>
            ) : (
              <>
                {/* Lo primero: cuándo entró por última vez y el recordatorio, a la vista. */}
                <div className={`${TARJETA} p-4`}>
                  <Estado tono={TONO[a.estado.id]}>
                    <span className="text-[14px] font-semibold text-gray-900">{a.estado.texto}</span>
                  </Estado>
                  <p className="text-[12.5px] text-[#6B7280] mt-1 pl-3">
                    {a.ultima_entrada ? `Última vez: ${cuando(a.ultima_entrada)}` : `Alta: ${cuando(a.alta)}`}
                    {a.ultimo_recordatorio ? ` · Recordado ${haceDias(a.ultimo_recordatorio.sent_at)}` : ''}
                  </p>
                  <p className="text-[12.5px] text-[#6B7280] mt-0.5 pl-3 truncate">
                    {a.donde ? `Se quedó en ${a.donde.clase} · ${modulo(a.donde.modulo)}` : 'Todavía no ha abierto ninguna clase'}
                  </p>
                  <p className="text-[12.5px] text-[#6B7280] mt-0.5 pl-3">
                    {a.hechas} de {a.total} clases · {a.pct} %
                  </p>
                </div>
                <DetalleAlumno
                  a={a}
                  apilado
                  onFicha={() => setFicha(a.email)}
                  onRecordar={() => setRecordar(a)}
                  onAbrir={async (m) => (await abrirAMano(org.id, token, a, m)) && cargar()}
                  onDeshacer={async (m) => (await deshacerAMano(org.id, token, a, m)) && cargar()}
                />
              </>
            )}
          </div>
        </div>
      </div>
      {ficha ? <FichaCliente email={ficha} onClose={() => setFicha(null)} /> : null}
      {recordar ? <RecordatorioModal alumno={recordar} onClose={() => setRecordar(null)} onEnviado={cargar} /> : null}
    </>
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

  async function abrir(a: AlumnoProgreso, m: AperturaModulo) {
    if (await abrirAMano(org.id, token, a, m)) cargar()
  }

  async function deshacer(a: AlumnoProgreso, m: AperturaModulo) {
    if (await deshacerAMano(org.id, token, a, m)) cargar()
  }

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
      {/* Dos semanas o más sin terminar una clase de la formación (13/11/2026). */}
      <Atascados
        alumnos={alumnos}
        orgId={org.id}
        token={token}
        yo={session?.data?.user?.first_name || ''}
        onCorreo={(a) => setRecordar(a)}
        onFicha={(a) => setAbierta(a.user_id)}
        onCambio={cargar}
      />
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
                onAbrir={(m) => abrir(a, m)}
                onDeshacer={(m) => deshacer(a, m)}
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
