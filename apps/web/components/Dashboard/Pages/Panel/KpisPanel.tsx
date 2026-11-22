'use client'

/**
 * Estadísticas → KPIs (20/10/2026): "cuánto % de llamadas se cierra, cuántas
 * entran al día, qué porcentaje no se presenta, qué porcentaje ve el anuncio y
 * de ahí cuántos dejan su mail y datos y cuántos no, cuántos ven el vídeo y
 * continúan y cuántos en el vídeo se van".
 *
 * Todo lo calcula el servidor (apps/api/src/services/stats/kpis.py). Tres
 * unidades que no se mezclan: VISITAS (embudo de la web, anónimas), PERSONAS
 * (embudo de ventas, quien entró en el periodo) y LLAMADAS (con fecha en el
 * periodo). Administradores y el closer; al closer el servidor no le manda
 * el dinero (25/10/2026, "sin lo de ventas cobradas"), y aquí no sale el
 * bloque «Ventas cobradas en estos días».
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getKpis, type Kpis, type PasoEmbudoWeb } from '@services/stats/kpis'
import { euros } from '@services/stats/school'
import { Loader2 } from 'lucide-react'
import { Cifra, ENLACE, META, Seccion, TABLA, TD, TD_NUM, TH, TH_NUM, Tira, filtro } from './ui'

const PERIODOS = [7, 14, 30, 90]

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)
const num = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
const diaCorto = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}`
}

/** Una barra por paso: cuántos llegan y qué parte del anterior. Sin caja. */
function Escalones({
  pasos,
}: {
  pasos: { clave: string; nombre: string; n: number; detalle: string; caida?: string }[]
}) {
  const max = Math.max(1, ...pasos.map((p) => p.n))
  return (
    <div className="border-t border-[#E6E8EE]">
      {pasos.map((p, i) => (
        <div key={p.clave} className="py-2.5 border-b border-[#F0F1F5]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] text-[#0B1020]">{p.nombre}</span>
            <span className="text-[14px] font-semibold text-[#0B1020] tabular-nums shrink-0">{p.n.toLocaleString('es-ES')}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[#EDEFF4] overflow-hidden" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(p.n / max) * 100}%`, background: i === pasos.length - 1 ? '#1D0084' : '#AEB8E6' }} />
          </div>
          <p className="text-[12.5px] text-[#8A93A3] mt-1">
            {p.detalle}
            {p.caida ? <span className="text-[#C8322B]"> · {p.caida}</span> : null}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Una lista de «texto … cifra» con filete, sin caja. */
function Lista({ filas }: { filas: readonly (readonly [string, React.ReactNode, string?])[] }) {
  return (
    <div className="border-t border-[#E6E8EE] text-[14px]">
      {filas.map(([texto, valor, nota]) => (
        <div key={texto} className="py-2.5 flex items-baseline justify-between gap-3 border-b border-[#F0F1F5]">
          <span className="text-[#0B1020]">
            {texto}
            {nota ? <span className="block text-[12.5px] text-[#8A93A3]">{nota}</span> : null}
          </span>
          <span className="font-semibold text-[#0B1020] tabular-nums">{valor}</span>
        </div>
      ))}
    </div>
  )
}

function pasosWeb(lista: PasoEmbudoWeb[]) {
  return lista.map((p, i) => {
    const anterior = i ? lista[i - 1].n : 0
    const seVan = i && anterior > p.n ? anterior - p.n : 0
    return {
      clave: p.clave,
      nombre: p.nombre,
      n: p.n,
      detalle: i === 0 ? 'Visitas (una por pestaña del navegador)' : `${pct(p.pct_anterior)} del paso anterior`,
      caida: seVan ? `se quedan aquí ${seVan}` : '',
    }
  })
}

const SERIES = [
  { clave: 'entradas', nombre: 'Entradas (personas nuevas)' },
  { clave: 'reservas', nombre: 'Llamadas reservadas' },
  { clave: 'llamadas', nombre: 'Llamadas con fecha ese día' },
  { clave: 'ventas', nombre: 'Ventas' },
  { clave: 'visitas', nombre: 'Visitas a la web' },
] as const

export default function KpisPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<Kpis | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [serie, setSerie] = useState<(typeof SERIES)[number]['clave']>('entradas')
  const [embudo, setEmbudo] = useState<'todos' | 'anuncio' | 'web' | 'admision'>('anuncio')
  const [canal, setCanal] = useState<'todos' | 'ads' | 'organico'>('todos')
  const [tabla, setTabla] = useState(false)

  useEffect(() => {
    if (!org?.id || !accessToken) return
    let vivo = true
    setCargando(true)
    getKpis(org.id, dias, accessToken).then((r) => {
      if (!vivo) return
      setCargando(false)
      if (r.ok && r.datos) {
        setDatos(r.datos)
        setError('')
      } else setError(r.error || 'No se han podido leer los KPIs')
    })
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken, dias])

  const periodos = (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIODOS.map((d) => (
        <button key={d} onClick={() => setDias(d)} className={filtro(dias === d)}>
          {d} días
        </button>
      ))}
      {cargando && datos ? <Loader2 size={15} className="animate-spin text-gray-400 ml-1" /> : null}
    </div>
  )

  if (!datos) {
    return (
      <div className="space-y-5">
        {periodos}
        {cargando ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : (
          <p className="text-[14px] text-red-700">{error}</p>
        )}
      </div>
    )
  }

  const ll = datos.llamadas
  const v = datos.ventas
  const conDinero = !datos.para_closer && v.cobrado_cents !== undefined
  const conResultado = ll.presentadas + ll.no_vino
  const web = datos.embudo_web[embudo].canales[canal]
  const ventas = datos.embudo_ventas.pasos
  const nombreDe = Object.fromEntries(ventas.map((p) => [p.clave, p.nombre]))
  const baseDe: Record<string, string> = {
    admision: 'de los que entran',
    video: 'de los del proceso de admisión',
    preguntas: 'de los que entran',
    encajan: 'de los que terminan las preguntas',
    reservan: 'de los que entran',
    presentan: 'de los que reservan',
    pagan: 'de los que entran',
  }
  const filasSerie = datos.serie.map((d) => ({ dia: diaCorto(d.dia), valor: d[serie] }))
  const nombreSerie = SERIES.find((s) => s.clave === serie)?.nombre || ''

  return (
    <div className="space-y-9">
      <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {periodos}
        <p className={META}>
          Del {diaCorto(datos.desde)} al {diaCorto(datos.hasta)}
          {datos.calendly.conectado ? ' · llamadas de Calendly' : ' · sin Calendly: solo las llamadas con «¿Qué pasó?»'}
        </p>
      </div>
      {datos.calendly.error ? <p className="text-[13px] text-[#8A6A2A]">Calendly no ha contestado: {datos.calendly.error}</p> : null}
      {datos.calendly.corto ? (
        <p className={META}>Calendly solo da 45 días hacia atrás: las llamadas más antiguas solo cuentan si tienen «¿Qué pasó?» apuntado.</p>
      ) : null}

      <Tira>
        <Cifra
          rotulo="Entradas al día"
          valor={num(datos.entradas.por_dia)}
          nota={`${datos.entradas.n} en ${datos.dias} días · ${datos.entradas.ads} de anuncio`}
        />
        <Cifra rotulo="Llamadas reservadas" valor={datos.reservas.n} nota={`${num(datos.reservas.por_dia)} al día`} />
        <Cifra
          rotulo="Se presentan"
          valor={pct(ll.pct_asistencia)}
          nota={conResultado ? `${ll.presentadas} de ${conResultado} con resultado` : 'sin llamadas con resultado'}
        />
        <Cifra rotulo="No se presentan" valor={pct(ll.pct_no_show)} nota={`${ll.no_vino} llamada${ll.no_vino === 1 ? '' : 's'}`} />
        <Cifra rotulo="Cierre" valor={pct(ll.pct_cierre)} nota={`${ll.personas_cerradas} de ${ll.personas_presentadas} que se presentaron ya han pagado`} />
        <Cifra
          rotulo="Ventas"
          valor={v.n}
          nota={
            conDinero
              ? `${euros(v.vendido_cents ?? v.cobrado_cents ?? 0)} vendidos · ${euros(v.cobrado_cents || 0)} cobrados`
              : `en estos ${datos.dias} días`
          }
        />
      </Tira>
      {ll.sin_apuntar ? (
        <p className="text-[13px] text-[#9A6B12]">
          Hay {ll.sin_apuntar} llamada{ll.sin_apuntar === 1 ? '' : 's'} pasada{ll.sin_apuntar === 1 ? '' : 's'} sin «¿Qué pasó?»: no cuentan ni
          como presentadas ni como no-show.{' '}
          <Link href="/dash/estadisticas?tab=llamadas" className={ENLACE}>
            Apuntarlo en Llamadas
          </Link>
        </p>
      ) : null}
      </div>

      {/* ¿Sirve confirmar la llamada? (27/10): el seteo del closer en números. */}
      {ll.confirmacion ? (
        <Seccion titulo="¿Sirve confirmar la llamada?">
          <p className={META}>
            Cuántos no se presentan entre las llamadas que la persona confirmó antes (Llamadas → Por confirmar) y entre las que no. Cuenta
            desde el {diaCorto(ll.confirmacion.desde)}, cuando se empezó a marcar, y solo las llamadas con «¿Qué pasó?» apuntado.
          </p>
          <div className="max-w-xl">
            <Tira>
              <Cifra
                pequena
                rotulo="Confirmadas: no se presentan"
                valor={pct(ll.confirmacion.si.pct_no_show)}
                nota={ll.confirmacion.si.con_resultado ? `${ll.confirmacion.si.no_vino} de ${ll.confirmacion.si.con_resultado}` : 'todavía ninguna con resultado'}
              />
              <Cifra
                pequena
                rotulo="Sin confirmar: no se presentan"
                valor={pct(ll.confirmacion.no.pct_no_show)}
                nota={ll.confirmacion.no.con_resultado ? `${ll.confirmacion.no.no_vino} de ${ll.confirmacion.no.con_resultado}` : 'todavía ninguna con resultado'}
              />
            </Tira>
          </div>
        </Seccion>
      ) : null}

      <Seccion
        titulo="Cada día"
        extra={
          <button onClick={() => setTabla((t) => !t)} className={ENLACE}>
            {tabla ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        }
      >
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SERIES.map((s) => (
            <button key={s.clave} onClick={() => setSerie(s.clave)} className={filtro(serie === s.clave)}>
              {s.nombre}
            </button>
          ))}
        </div>
        <div>
          {tabla ? (
            <div className="overflow-x-auto">
              <table className={TABLA}>
                <thead>
                  <tr>
                    <th className={TH}>Día</th>
                    {['Visitas', 'Entradas', 'Reservas', 'Llamadas', 'Se presentan', 'No vienen', 'Ventas'].map((t) => (
                      <th key={t} className={TH_NUM}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...datos.serie].reverse().map((d) => (
                    <tr key={d.dia}>
                      <td className={`${TD} !py-2`}>{diaCorto(d.dia)}</td>
                      {[d.visitas, d.entradas, d.reservas, d.llamadas, d.presentadas, d.no_vino, d.ventas].map((n, i) => (
                        <td key={i} className={`${TD_NUM} !py-2 ${n ? '' : 'text-[#C5CAD6]'}`}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filasSerie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#F0F1F5" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#8A93A3' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E6E8EE' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis tick={{ fontSize: 11, fill: '#8A93A3' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip
                  cursor={{ fill: '#F7F8FA' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E6E8EE', boxShadow: 'none', fontSize: 12 }}
                  formatter={(v: any) => [v, nombreSerie]}
                  labelFormatter={(l: any) => `Día ${l}`}
                />
                <Bar isAnimationActive={false} dataKey="valor" fill="#1D0084" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Seccion>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        <Seccion titulo="Embudo de la web">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['anuncio', 'Anuncio'],
                ['web', 'Formación (web)'],
                ['admision', 'Proceso de admisión'],
                ['todos', 'Todos'],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} onClick={() => setEmbudo(id)} className={filtro(embudo === id)}>
                {texto}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['todos', 'Todo el tráfico'],
                ['ads', 'Llegan por anuncio'],
                ['organico', 'Orgánico'],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} onClick={() => setCanal(id)} className={filtro(canal === id)}>
                {texto}
              </button>
            ))}
          </div>
          {web[0]?.n ? (
            <Escalones pasos={pasosWeb(web)} />
          ) : (
            <p className="border-t border-[#E6E8EE] py-5 text-[13.5px] text-[#8A93A3]">Todavía no hay visitas en este embudo para estas fechas.</p>
          )}
          <p className={META}>
            Se cuentan desde el {diaCorto(datos.visitas_desde)}, sin nombres ni correos: una visita es una pestaña del navegador. El vídeo
            cuenta el play, la mitad y el final.
          </p>
        </Seccion>

        <Seccion titulo="Embudo de ventas (personas que entraron)">
          <Escalones
            pasos={ventas.map((p) => ({
              clave: p.clave,
              nombre: nombreDe[p.clave] || p.nombre,
              n: p.n,
              detalle: p.sobre === null ? `Entraron en estos ${datos.dias} días` : `${pct(p.pct)} ${baseDe[p.clave] || ''}`,
            }))}
          />
          <p className={META}>
            Es la misma gente de principio a fin: quien entró en estas fechas, hasta hoy. Quien entró ayer puede no haber reservado
            todavía.
          </p>
        </Seccion>
      </div>

      {/* Cada closer con sus llamadas (28/10, al entrar la segunda closer). */}
      {datos.por_closer?.length ? (
        <Seccion titulo="Por closer">
          <div className="overflow-x-auto">
            <table className={TABLA}>
              <thead>
                <tr>
                  <th className={TH}>Closer</th>
                  {['Agendadas', 'Se presentaron', 'No vinieron', 'No-show', 'Pagaron', 'Cierre'].map((t) => (
                    <th key={t} className={TH_NUM}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.por_closer.map((g) => (
                  <tr key={g.closer}>
                    <td className={`${TD} ${g.closer === 'Sin asignar' ? 'text-[#8A93A3]' : ''}`}>{g.closer}</td>
                    <td className={TD_NUM}>{g.agendadas}</td>
                    <td className={TD_NUM}>{g.presentadas}</td>
                    <td className={TD_NUM}>{g.no_vino}</td>
                    <td className={TD_NUM}>{pct(g.pct_no_show)}</td>
                    <td className={TD_NUM}>{g.cerradas}</td>
                    <td className={`${TD_NUM} font-semibold`}>{pct(g.pct_cierre)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={META}>
            Por el closer que lleva a cada persona ahora (Matrículas → Ventas). Cierre = de los que se presentaron, cuántos han pagado.
            Solo lo ven los administradores.
          </p>
        </Seccion>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        <Seccion titulo="Llamadas con fecha en estos días">
          <Lista
            filas={[
              ['Agendadas', ll.agendadas, 'sin contar las canceladas'],
              ['Se presentaron', ll.presentadas, ll.pagadas_sin_apuntar ? `${ll.pagadas_sin_apuntar} sin «¿Qué pasó?» pero ya pagaron` : ''],
              ['No vinieron', ll.no_vino, ''],
              ['Sin «¿Qué pasó?» apuntado', ll.sin_apuntar, ''],
              ['Todavía por hacer', ll.futuras, ''],
              ['Canceladas o cambiadas de hora', ll.canceladas, ''],
            ]}
          />
          <p className={META}>
            Resultados: {ll.resultados['pagado'] || 0} pagó · {ll.resultados['compra'] || 0} va a pagar · {ll.resultados['piensa'] || 0} lo piensa
            · {ll.resultados['no-encaja'] || 0} no encaja · {ll.resultados['no-vino'] || 0} no vino
            {ll.van_a_pagar_sin_pagar ? ` · ${ll.van_a_pagar_sin_pagar} dijeron «va a pagar» y aún no han pagado` : ''}
          </p>
        </Seccion>

        {conDinero ? (
        <Seccion titulo="Ventas de estos días">
          <Lista
            filas={[
              ['Ventas', String(v.n)],
              ['Vendido', euros(v.vendido_cents ?? v.cobrado_cents ?? 0)],
              ['Cobrado', euros(v.cobrado_cents || 0)],
              ['Por cobrar', (v.por_cobrar_cents ?? 0) > 0 ? euros(v.por_cobrar_cents ?? 0) : '—'],
              ['Ticket medio (sobre lo vendido)', v.ticket_medio_cents ? euros(v.ticket_medio_cents) : '—'],
              ['Después de una llamada', String(v.con_llamada ?? 0)],
              ['Pago único o Klarna', String(v.tipos?.unico ?? 0)],
              ['A plazos', String(v.tipos?.plazos ?? 0)],
              ['Otro importe o señal completada', String(v.tipos?.otro ?? 0)],
            ]}
          />
          <p className={META}>
            «Vendido» es el total de cada venta: una venta a plazos cuenta entera el día del primer pago. «Cobrado» es lo que ha
            entrado hasta hoy. Quien está fuera de los números (pruebas) no cuenta en nada de esta página.{' '}
            <Link href="/dash/estadisticas?tab=plazos" className={ENLACE}>
              Ver pagos a plazos
            </Link>
          </p>
        </Seccion>
        ) : null}
      </div>
    </div>
  )
}
