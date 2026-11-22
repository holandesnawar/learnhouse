'use client'

/**
 * La portada del panel: los números de la semana y, de ahí, a lo que toca.
 *
 * Rehecha el 22/11/2026 (usuario: «diseño más clean general, de software
 * caro, no tan IA… investiga qué puede ser lo mejor para mí en la parte
 * admin»). Antes era un banner azul con cuatro tarjetas de cristal y cajas
 * blancas debajo, y no decía cómo iba la semana ni contra qué compararla.
 *
 * El administrador ve, de arriba abajo:
 * - el saludo y el selector de periodo (esta semana / 30 días / este mes);
 * - UNA tira de cifras (vendido con lo cobrado, ventas, llamadas, leads,
 *   alumnos activos), cada una con su flecha contra el periodo anterior;
 * - «Hoy» (lo que pide hacer algo ahora) y «Mis tareas» con el medidor
 *   flotar / mover;
 * - «Del clic a la venta» (visitas → datos → llamada → vino → compró);
 * - las últimas ventas, con lo vendido y lo cobrado.
 * Todo sale de UNA llamada (`/panel/org/{id}/inicio`, services/panel/inicio.py);
 * si un bloque no se puede calcular, lo dice y los demás salen.
 *
 * El closer no ve dinero: sus cifras salen del tablero, como siempre, con el
 * mismo estilo.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getContactos, ETAPA_TEXTO, hoyISO, type Contacto } from '@services/stats/contactos'
import {
  euros,
  fechaCorta,
  getInicio,
  getTablero,
  getTareas,
  type BalanceTareas,
  type CifraComparada,
  type InicioPanel,
  type PeriodoInicio,
  type Tablero,
  type Tarea,
} from '@services/panel/panel'
import FichaCliente from '@components/Dashboard/Pages/Panel/Ficha'
import CabeceraPagina from '@components/Dashboard/Pages/Panel/Cabecera'
import { FilaTarea, MedidorSemana, TareaForm, useEquipo } from '@components/Dashboard/Pages/Panel/Tareas'
import {
  BarraEmbudo,
  Cambio,
  Cifra,
  EnlaceSeccion,
  Estado,
  Fila,
  Seccion,
  Segmentado,
  SUB,
  TABLA,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
  Tira,
} from '@components/Dashboard/Pages/Panel/ui'
import { COLOR_COLUMNA } from '@/lib/nawar/coloresTablero'
import { colorCloser } from '@/lib/nawar/colorCloser'

const PERIODOS: { id: PeriodoInicio; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: '30', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
]

function fechaLarga(): string {
  try {
    const t = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
    return t.charAt(0).toUpperCase() + t.slice(1)
  } catch {
    return ''
  }
}

/** «↑ 18 %» o, si antes no había nada, «↑ 3». Sin con qué comparar, nada. */
function Flecha({ c, dinero = false }: { c?: CifraComparada; dinero?: boolean }) {
  if (!c || c.antes === null || c.dif === null) return null
  if (!c.sentido) return <span>igual</span>
  const texto = c.pct !== null ? `${Math.abs(c.pct)} %` : dinero ? euros(Math.abs(c.dif)) : String(Math.abs(c.dif))
  return <Cambio sentido={c.sentido}>{texto}</Cambio>
}

/** Junta trozos con « · », saltándose los vacíos. */
function Partes({ children }: { children: React.ReactNode[] }) {
  const llenas = children.filter((x) => x !== null && x !== undefined && x !== false && x !== '')
  return (
    <>
      {llenas.map((x, i) => (
        <React.Fragment key={i}>
          {i ? ' · ' : null}
          {x}
        </React.Fragment>
      ))}
    </>
  )
}

const MARCO = 'h-full w-full bg-white px-4 sm:px-9 lg:px-11 py-6 sm:py-8 pb-24 lg:pb-16'

export default function NawarHome() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token = session?.data?.tokens?.access_token
  const { isCloser } = useAdminStatus()
  const [abierta, setAbierta] = useState<string | null>(null)

  // Las tareas: las ven los dos (cada uno, las suyas).
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [yo, setYo] = useState(0)
  const [balance, setBalance] = useState<BalanceTareas | null>(null)
  function leerTareas() {
    if (!org?.id || !token) return
    getTareas(org.id, token, { pendientes: true }).then((r) => {
      if (r.ok && r.datos) {
        setTareas(r.datos.tareas)
        setYo(r.datos.yo)
        setBalance(r.datos.balance ?? null)
      } else setTareas([])
    })
  }
  useEffect(() => {
    leerTareas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, token])

  const misTareas = (tareas ?? []).filter((t) => t.asignado_id === yo && t.estado !== 'hecha')
  const urgentes = misTareas.filter((t) => t.fecha && t.fecha <= hoyISO()).length
  const nombre = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const hora = new Date().getHours()
  const saludo = `${hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'}${nombre ? `, ${nombre}` : ''}`

  const bloqueTareas = (
    <Seccion titulo="Mis tareas" extra={<EnlaceSeccion href="/dash/estadisticas?tab=tareas">Todas</EnlaceSeccion>}>
      <MedidorSemana balance={balance} compacto />
      <div className="border-t border-[#E6E8EE]">
        {tareas === null ? (
          <p className="py-3 text-[13px] text-[#8A93A3]">Cargando…</p>
        ) : misTareas.length === 0 ? (
          <p className="py-3 text-[13.5px] text-[#8A93A3]">No tienes nada pendiente.</p>
        ) : (
          <div className="divide-y divide-[#F0F1F5]">
            {misTareas.slice(0, 5).map((t) => (
              <FilaTarea
                key={t.id}
                tarea={t}
                onCambio={(n) => {
                  setTareas((ts) => (ts ?? []).map((x) => (x.id === n.id ? n : x)))
                  leerTareas()
                }}
                onBorrada={(id) => setTareas((ts) => (ts ?? []).filter((x) => x.id !== id))}
                onAbrirPersona={setAbierta}
              />
            ))}
          </div>
        )}
        {misTareas.length > 5 ? (
          <Link href="/dash/estadisticas?tab=tareas" className="block py-2 text-[13px] text-[#8A93A3] hover:text-[#0B1020]">
            y {misTareas.length - 5} más
          </Link>
        ) : null}
        <div className="border-t border-[#F0F1F5] pt-1">
          <TareaForm compacto onCreada={(t) => setTareas((ts) => [t, ...(ts ?? [])])} />
        </div>
      </div>
    </Seccion>
  )

  return (
    <div className={MARCO}>
      <div className="max-w-[1180px] mx-auto">
        {isCloser ? (
          <InicioCloser saludo={saludo} urgentes={tareas ? urgentes : null} bloqueTareas={bloqueTareas} onAbrir={setAbierta} />
        ) : (
          <InicioAdmin saludo={saludo} urgentes={urgentes} bloqueTareas={bloqueTareas} onAbrir={setAbierta} />
        )}
      </div>
      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}

/* ───────────────────────── administrador ───────────────────────── */

function InicioAdmin({
  saludo,
  urgentes,
  bloqueTareas,
  onAbrir,
}: {
  saludo: string
  urgentes: number
  bloqueTareas: React.ReactNode
  onAbrir: (email: string) => void
}) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token = session?.data?.tokens?.access_token
  const equipo = useEquipo()
  const [periodo, setPeriodo] = useState<PeriodoInicio>('semana')
  const [datos, setDatos] = useState<InicioPanel | null | 'error'>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    try {
      const g = localStorage.getItem('nawar.inicio.periodo')
      if (g === 'semana' || g === '30' || g === 'mes') setPeriodo(g)
    } catch {}
  }, [])
  useEffect(() => {
    if (!org?.id || !token) return
    let vivo = true
    setCargando(true)
    getInicio(org.id, periodo, token).then((r) => {
      if (!vivo) return
      setDatos(r.ok && r.datos ? r.datos : 'error')
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [org?.id, token, periodo])
  function elegir(p: PeriodoInicio) {
    setPeriodo(p)
    try {
      localStorage.setItem('nawar.inicio.periodo', p)
    } catch {}
  }

  const d = datos && datos !== 'error' ? datos : null
  const c = d?.cifras
  const antes = d?.rango.antes_texto || ''
  const v = (x: React.ReactNode) => (d ? x : '…')

  const filasHoy = [...(d?.hoy_filas ?? [])]
  if (urgentes > 0)
    filasHoy.splice(Math.min(filasHoy.length, 1), 0, {
      clave: 'tareas',
      tono: 'rojo',
      titulo: 'Tareas tuyas para hoy o vencidas',
      n: urgentes,
      detalle: '',
      href: '/dash/estadisticas?tab=tareas',
    })
  const max = Math.max(1, ...(d?.embudo ?? []).map((p) => p.n))

  return (
    <div className={cargando && d ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <CabeceraPagina sobre={fechaLarga()} titulo={saludo} acciones={<Segmentado opciones={PERIODOS} valor={periodo} onChange={elegir} />} />

      {datos === 'error' ? (
        <p className="mt-7 text-[14px] text-[#4B5565]">No se han podido cargar los números. Prueba a recargar la página.</p>
      ) : (
        <Tira className="mt-7">
          <Cifra
            rotulo="Vendido"
            valor={v(c?.vendido ? euros(c.vendido.valor) : '—')}
            href="/dash/estadisticas"
            nota={
              c?.vendido ? (
                <Partes>
                  {[<Flecha key="f" c={c.vendido} dinero />, `cobrado ${euros(c.vendido.cobrado_cents)}`]}
                </Partes>
              ) : null
            }
          />
          <Cifra
            rotulo="Ventas"
            valor={v(c?.ventas ? c.ventas.valor : '—')}
            href="/dash/estadisticas?tab=clientes"
            nota={
              c?.ventas ? (
                <Partes>
                  {[
                    c.ventas.antes !== null && c.ventas.sentido ? (
                      <span key="f">
                        <Cambio sentido={c.ventas.sentido}>{Math.abs(c.ventas.dif ?? 0)}</Cambio> {c.ventas.sentido > 0 ? 'más' : 'menos'} {antes}
                      </span>
                    ) : c.ventas.antes !== null ? (
                      `igual ${antes}`
                    ) : null,
                    c.ventas.a_plazos ? `${c.ventas.a_plazos} a plazos` : null,
                  ]}
                </Partes>
              ) : null
            }
          />
          <Cifra
            rotulo="Llamadas"
            valor={v(c?.llamadas ? c.llamadas.valor : '—')}
            sufijo={c?.llamadas && c.llamadas.con_resultado ? `de ${c.llamadas.con_resultado}` : undefined}
            href="/dash/estadisticas?tab=kpis"
            nota={
              c?.llamadas ? (
                <Partes>
                  {[
                    c.llamadas.con_resultado ? (
                      <span key="v">
                        vinieron{c.llamadas.no_vino ? <span className="text-[#C8322B] font-medium"> · {c.llamadas.no_vino} no</span> : null}
                      </span>
                    ) : (
                      'ninguna con resultado todavía'
                    ),
                    c.llamadas.futuras ? `${c.llamadas.futuras} por venir` : null,
                  ]}
                </Partes>
              ) : null
            }
          />
          <Cifra
            rotulo="Leads"
            valor={v(c?.leads ? c.leads.valor : '—')}
            href="/dash/webs"
            nota={
              c?.leads ? (
                <Partes>{[<Flecha key="f" c={c.leads} />, `${c.leads.visitas.toLocaleString('es-ES')} ${c.leads.visitas === 1 ? 'visita' : 'visitas'}`]}</Partes>
              ) : null
            }
          />
          <Cifra
            rotulo="Alumnos activos"
            valor={v(c?.alumnos ? c.alumnos.activos : '—')}
            sufijo={c?.alumnos ? `de ${c.alumnos.total}` : undefined}
            href="/dash/estadisticas?tab=progreso"
            nota={
              c?.alumnos
                ? c.alumnos.sin_avanzar
                  ? `${c.alumnos.sin_avanzar} sin avanzar hace 14 días`
                  : 'entraron en los últimos 7 días'
                : null
            }
          />
        </Tira>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-10 lg:gap-14">
        <Seccion titulo="Hoy">
          {datos === null ? (
            <p className="border-t border-[#E6E8EE] py-3 text-[13px] text-[#8A93A3]">Cargando…</p>
          ) : d && d.hoy_filas === null && !filasHoy.length ? (
            <p className="border-t border-[#E6E8EE] py-3 text-[13.5px] text-[#8A93A3]">No se ha podido calcular lo de hoy.</p>
          ) : filasHoy.length === 0 ? (
            <p className="border-t border-[#E6E8EE] py-3 text-[13.5px] text-[#8A93A3]">Nada pendiente. Todo al día.</p>
          ) : (
            <div>
              {filasHoy.map((f) => (
                <Fila key={f.clave} tono={f.tono as any} titulo={f.titulo} detalle={f.detalle || undefined} n={f.n} accion="Abrir" href={f.href} />
              ))}
            </div>
          )}
        </Seccion>
        {bloqueTareas}
      </div>

      <Seccion
        junto
        className="mt-10"
        titulo="Del clic a la venta"
        nota={d ? `Quien dejó sus datos ${d.rango.periodo === 'semana' ? 'esta semana' : d.rango.periodo === 'mes' ? 'este mes' : 'en estos 30 días'}, y hasta dónde ha llegado` : undefined}
        extra={<EnlaceSeccion href="/dash/webs">Ver la analítica</EnlaceSeccion>}
      >
        {datos === null ? (
          <p className="text-[13px] text-[#8A93A3]">Cargando…</p>
        ) : !d?.embudo ? (
          <p className="text-[13.5px] text-[#8A93A3]">No se ha podido calcular.</p>
        ) : (
          d.embudo.map((p, i) => (
            <BarraEmbudo
              key={p.clave}
              nombre={p.nombre}
              n={p.n}
              max={max}
              pct={p.pct !== null ? `${String(p.pct).replace('.', ',')} %` : ''}
              fuerte={i === d.embudo!.length - 1}
            />
          ))
        )}
      </Seccion>

      <Seccion className="mt-10" titulo="Últimas ventas" extra={<EnlaceSeccion href="/dash/estadisticas?tab=clientes">Todos los clientes</EnlaceSeccion>}>
        {datos === null ? (
          <p className="text-[13px] text-[#8A93A3]">Cargando…</p>
        ) : !d?.ventas ? (
          <p className="text-[13.5px] text-[#8A93A3]">No se han podido leer las ventas.</p>
        ) : d.ventas.length === 0 ? (
          <p className="border-t border-[#E6E8EE] py-3 text-[13.5px] text-[#8A93A3]">Todavía no hay ventas.</p>
        ) : (
          <>
            {/* Ordenador: tabla. Móvil: filas apiladas. */}
            <table className={`${TABLA} hidden md:table`}>
              <thead>
                <tr>
                  <th className={TH}>Persona</th>
                  <th className={TH}>Forma de pago</th>
                  <th className={TH}>Closer</th>
                  <th className={TH_NUM}>Vendido</th>
                  <th className={TH_NUM}>Cobrado</th>
                  <th className={TH_NUM}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {d.ventas.map((x) => (
                  <tr key={x.email + x.dia} onClick={() => onAbrir(x.email)} className="cursor-pointer hover:bg-[#F7F8FA]">
                    <td className={TD}>
                      {x.nombre}
                      {x.origen ? <span className={SUB}>{x.origen}</span> : null}
                    </td>
                    <td className={TD}>
                      {x.pago.texto}
                      {x.pago.detalle ? <span className={SUB} style={x.pago.aviso ? { color: '#C8322B' } : undefined}>{x.pago.detalle}</span> : null}
                    </td>
                    <td className={TD}>
                      {x.closer ? (
                        <Estado color={colorCloser(x.closer_id ?? 0, equipo?.equipo ?? [], x.closer)}>{x.closer}</Estado>
                      ) : (
                        <span className="text-[13px] text-[#B4BAC6]">—</span>
                      )}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>{euros(x.vendido_cents)}</td>
                    <td className={TD_NUM}>{euros(x.cobrado_cents)}</td>
                    <td className={`${TD_NUM} text-[#8A93A3]`}>{fechaCorta(x.dia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="md:hidden">
              {d.ventas.map((x) => (
                <Fila
                  key={x.email + x.dia}
                  onClick={() => onAbrir(x.email)}
                  titulo={x.nombre}
                  detalle={
                    <span style={x.pago.aviso ? { color: '#C8322B' } : undefined}>
                      {[x.pago.texto, x.pago.detalle, x.closer, fechaCorta(x.dia)].filter(Boolean).join(' · ')}
                    </span>
                  }
                  n={
                    <span className="text-right">
                      {euros(x.vendido_cents)}
                      {x.cobrado_cents !== x.vendido_cents ? <span className={`${SUB} font-normal`}>cobrado {euros(x.cobrado_cents)}</span> : null}
                    </span>
                  }
                />
              ))}
            </div>
          </>
        )}
      </Seccion>
    </div>
  )
}

/* ───────────────────────── closer ───────────────────────── */

function InicioCloser({
  saludo,
  urgentes,
  bloqueTareas,
  onAbrir,
}: {
  saludo: string
  urgentes: number | null
  bloqueTareas: React.ReactNode
  onAbrir: (email: string) => void
}) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token = session?.data?.tokens?.access_token
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [contactos, setContactos] = useState<Contacto[] | null>(null)

  useEffect(() => {
    if (!org?.id || !token) return
    getTablero(org.id, token).then((r) => setTablero(r.ok && r.datos ? r.datos : { etapas: [], tarjetas: [] } as any))
    getContactos(org.id, '', token).then((r) => setContactos(r?.contactos ?? []))
  }, [org?.id, token])

  const cuenta = (ids: string[]) => (tablero?.tarjetas ?? []).filter((t) => ids.includes(t.etapa) && !t.oculto).length
  const columnas = (tablero?.etapas ?? []).map((e) => ({ ...e, n: cuenta([e.id]) }))
  const nuevas = cuenta(['nuevo'])
  const porLlamar = cuenta(['llamar', 'no-contesta'])
  const agendadas = cuenta(['agendado'])
  const tc = (n: number) => (tablero ? n : '…')
  const ultimos = (contactos ?? []).slice(0, 6)

  return (
    <div>
      <CabeceraPagina sobre={fechaLarga()} titulo={saludo} />
      <Tira className="mt-7">
        <Cifra rotulo="Nuevas" valor={tc(nuevas)} nota="de las últimas 48 horas" href="/dash/estadisticas?tab=matriculas" />
        <Cifra rotulo="Por llamar" valor={tc(porLlamar)} nota="y las que no contestaron" href="/dash/estadisticas?tab=matriculas" />
        <Cifra rotulo="Agendadas" valor={tc(agendadas)} nota="con llamada reservada" href="/dash/estadisticas?tab=llamadas" />
        <Cifra
          rotulo="Tus tareas"
          valor={urgentes === null ? '…' : urgentes}
          nota="para hoy o vencidas"
          href="/dash/estadisticas?tab=tareas"
          color={urgentes ? '#C8322B' : undefined}
        />
      </Tira>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-10 lg:gap-14">
        <Seccion titulo="Hoy">
          {tablero === null ? (
            <p className="border-t border-[#E6E8EE] py-3 text-[13px] text-[#8A93A3]">Cargando…</p>
          ) : !nuevas && !porLlamar && !urgentes ? (
            <p className="border-t border-[#E6E8EE] py-3 text-[13.5px] text-[#8A93A3]">Nada pendiente. Todo al día.</p>
          ) : (
            <div>
              {nuevas > 0 ? (
                <Fila
                  tono="rojo"
                  titulo="Matrículas nuevas sin llamar"
                  detalle="De las últimas 48 horas: cuanto antes, más se cierra"
                  n={nuevas}
                  accion="Llamar"
                  href="/dash/estadisticas?tab=matriculas"
                />
              ) : null}
              {urgentes ? <Fila tono="rojo" titulo="Tareas para hoy o vencidas" n={urgentes} accion="Ver" href="/dash/estadisticas?tab=tareas" /> : null}
              {porLlamar > 0 ? (
                <Fila tono="ambar" titulo="Por llamar o que no contestaron" n={porLlamar} accion="Abrir" href="/dash/estadisticas?tab=matriculas" />
              ) : null}
            </div>
          )}
        </Seccion>
        {bloqueTareas}
      </div>

      <Seccion className="mt-10" titulo="Matrículas" extra={<EnlaceSeccion href="/dash/estadisticas?tab=matriculas">Abrir el tablero</EnlaceSeccion>}>
        {tablero === null ? (
          <p className="text-[13px] text-[#8A93A3]">Cargando…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-8 border-t border-[#E6E8EE]">
            {columnas.map((col) => (
              <Link
                key={col.id}
                href="/dash/estadisticas?tab=matriculas"
                className="flex items-center justify-between gap-2 py-2.5 border-b border-[#F0F1F5] hover:opacity-70"
              >
                <Estado color={COLOR_COLUMNA[col.id] || '#C5CAD6'} className="min-w-0 truncate">
                  {col.nombre}
                </Estado>
                <span className="text-[14px] font-semibold tabular-nums text-[#0B1020]">{col.n}</span>
              </Link>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion className="mt-10" titulo="Últimas matrículas" extra={<EnlaceSeccion href="/dash/estadisticas?tab=matriculas">Ver todo</EnlaceSeccion>}>
        {contactos === null ? (
          <p className="text-[13px] text-[#8A93A3]">Cargando…</p>
        ) : ultimos.length === 0 ? (
          <p className="border-t border-[#E6E8EE] py-3 text-[13.5px] text-[#8A93A3]">Todavía no hay contactos.</p>
        ) : (
          <div>
            {ultimos.map((p) => (
              <Fila
                key={p.email}
                onClick={() => onAbrir(p.email)}
                titulo={p.nombre || p.email}
                detalle={`${p.ultimo_contacto.que}${p.utm_campaign ? ` · ${p.utm_campaign}` : ''}`}
                accion={
                  <Estado tono={p.etapa === 'alumno' ? 'verde' : p.etapa === 'en-pago' ? 'ambar' : p.etapa === 'pidio' ? 'azul' : 'gris'}>
                    {ETAPA_TEXTO[p.etapa] || 'Lead'}
                  </Estado>
                }
              />
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}
