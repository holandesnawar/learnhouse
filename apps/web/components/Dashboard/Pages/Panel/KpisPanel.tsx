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
import { ENLACE, META, Seccion, TARJETA, filtro } from './ui'

const PERIODOS = [7, 14, 30, 90]

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)
const num = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
const diaCorto = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}`
}

function Cifra({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className={`${TARJETA} px-4 py-3.5 min-w-0`}>
      <p className="text-[12px] font-medium text-[#6B7280]">{titulo}</p>
      <p className="mt-1 text-[26px] font-semibold text-gray-900 leading-none tabular-nums">{valor}</p>
      {sub ? <p className={`${META} mt-1.5 leading-snug`}>{sub}</p> : null}
    </div>
  )
}

/** Una barra por paso: cuántos llegan y qué parte del anterior. */
function Escalones({
  pasos,
}: {
  pasos: { clave: string; nombre: string; n: number; detalle: string; caida?: string }[]
}) {
  const max = Math.max(1, ...pasos.map((p) => p.n))
  return (
    <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
      {pasos.map((p) => (
        <div key={p.clave} className="px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] text-gray-900">{p.nombre}</span>
            <span className="text-[14px] font-semibold text-gray-900 tabular-nums shrink-0">{p.n}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-[#025dc7]" style={{ width: `${(p.n / max) * 100}%` }} />
          </div>
          <p className={`${META} mt-1`}>
            {p.detalle}
            {p.caida ? <span className="text-[#B4413C]"> · {p.caida}</span> : null}
          </p>
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
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Cifra
          titulo="Entradas al día"
          valor={num(datos.entradas.por_dia)}
          sub={`${datos.entradas.n} en ${datos.dias} días · ${datos.entradas.ads} de anuncio`}
        />
        <Cifra titulo="Llamadas reservadas" valor={String(datos.reservas.n)} sub={`${num(datos.reservas.por_dia)} al día`} />
        <Cifra
          titulo="Se presentan"
          valor={pct(ll.pct_asistencia)}
          sub={conResultado ? `${ll.presentadas} de ${conResultado} llamada${conResultado === 1 ? '' : 's'} con resultado` : 'Sin llamadas con resultado'}
        />
        <Cifra titulo="No se presentan" valor={pct(ll.pct_no_show)} sub={`${ll.no_vino} llamada${ll.no_vino === 1 ? '' : 's'}`} />
        <Cifra
          titulo="Cierre"
          valor={pct(ll.pct_cierre)}
          sub={`${ll.personas_cerradas} de ${ll.personas_presentadas} que se presentaron ya han pagado`}
        />
        <Cifra
          titulo="Ventas"
          valor={String(v.n)}
          sub={
            conDinero
              ? `${euros(v.cobrado_cents || 0)} cobrados${v.ticket_medio_cents ? ` · ${euros(v.ticket_medio_cents)} de media` : ''}`
              : `en estos ${datos.dias} días`
          }
        />
      </div>
      {ll.sin_apuntar ? (
        <p className="text-[13px] text-[#8A6A2A]">
          Hay {ll.sin_apuntar} llamada{ll.sin_apuntar === 1 ? '' : 's'} pasada{ll.sin_apuntar === 1 ? '' : 's'} sin «¿Qué pasó?»: no cuentan ni
          como presentadas ni como no-show.{' '}
          <Link href="/dash/estadisticas?tab=llamadas" className={ENLACE}>
            Apuntarlo en Llamadas
          </Link>
        </p>
      ) : null}

      {/* ¿Sirve confirmar la llamada? (27/10): el seteo del closer en números. */}
      {ll.confirmacion ? (
        <Seccion titulo="¿Sirve confirmar la llamada?">
          <p className={META}>
            Cuántos no se presentan entre las llamadas que la persona confirmó antes (Llamadas → Por confirmar) y entre las que no. Cuenta
            desde el {diaCorto(ll.confirmacion.desde)}, cuando se empezó a marcar, y solo las llamadas con «¿Qué pasó?» apuntado.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <Cifra
              titulo="Confirmadas: no se presentan"
              valor={pct(ll.confirmacion.si.pct_no_show)}
              sub={
                ll.confirmacion.si.con_resultado
                  ? `${ll.confirmacion.si.no_vino} de ${ll.confirmacion.si.con_resultado}`
                  : 'Todavía ninguna con resultado'
              }
            />
            <Cifra
              titulo="Sin confirmar: no se presentan"
              valor={pct(ll.confirmacion.no.pct_no_show)}
              sub={
                ll.confirmacion.no.con_resultado
                  ? `${ll.confirmacion.no.no_vino} de ${ll.confirmacion.no.con_resultado}`
                  : 'Todavía ninguna con resultado'
              }
            />
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
        <div className={`${TARJETA} p-3 sm:p-4`}>
          {tabla ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-[#6B7280]">
                    <th className="font-medium py-1.5 pr-3">Día</th>
                    <th className="font-medium py-1.5 pr-3">Visitas</th>
                    <th className="font-medium py-1.5 pr-3">Entradas</th>
                    <th className="font-medium py-1.5 pr-3">Reservas</th>
                    <th className="font-medium py-1.5 pr-3">Llamadas</th>
                    <th className="font-medium py-1.5 pr-3">Se presentan</th>
                    <th className="font-medium py-1.5 pr-3">No vienen</th>
                    <th className="font-medium py-1.5">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...datos.serie].reverse().map((d) => (
                    <tr key={d.dia} className="border-t border-[#F3F4F6] text-gray-900">
                      <td className="py-1.5 pr-3">{diaCorto(d.dia)}</td>
                      <td className="py-1.5 pr-3">{d.visitas}</td>
                      <td className="py-1.5 pr-3">{d.entradas}</td>
                      <td className="py-1.5 pr-3">{d.reservas}</td>
                      <td className="py-1.5 pr-3">{d.llamadas}</td>
                      <td className="py-1.5 pr-3">{d.presentadas}</td>
                      <td className="py-1.5 pr-3">{d.no_vino}</td>
                      <td className="py-1.5">{d.ventas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filasSerie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: 6, border: '1px solid #E5E7EB', boxShadow: 'none', fontSize: 12 }}
                  formatter={(v: any) => [v, nombreSerie]}
                  labelFormatter={(l: any) => `Día ${l}`}
                />
                <Bar isAnimationActive={false} dataKey="valor" fill="#025dc7" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Seccion>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
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
            <div className={`${TARJETA} px-4 py-6`}>
              <p className="text-[13.5px] text-gray-700">Todavía no hay visitas en este embudo para estas fechas.</p>
            </div>
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
          <div className={`${TARJETA} overflow-x-auto`}>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[12px] text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Closer</th>
                  <th className="px-3 py-2.5 font-medium text-right">Agendadas</th>
                  <th className="px-3 py-2.5 font-medium text-right">Se presentaron</th>
                  <th className="px-3 py-2.5 font-medium text-right">No vinieron</th>
                  <th className="px-3 py-2.5 font-medium text-right">No-show</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pagaron</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {datos.por_closer.map((g) => (
                  <tr key={g.closer}>
                    <td className={`px-4 py-2.5 ${g.closer === 'Sin asignar' ? 'text-gray-500' : 'font-medium text-gray-900'}`}>{g.closer}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{g.agendadas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{g.presentadas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{g.no_vino}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pct(g.pct_no_show)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{g.cerradas}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{pct(g.pct_cierre)}</td>
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

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Seccion titulo="Llamadas con fecha en estos días">
          <div className={`${TARJETA} divide-y divide-[#F3F4F6] text-[13.5px]`}>
            {(
              [
                ['Agendadas', ll.agendadas, 'sin contar las canceladas'],
                ['Se presentaron', ll.presentadas, ll.pagadas_sin_apuntar ? `${ll.pagadas_sin_apuntar} sin «¿Qué pasó?» pero ya pagaron` : ''],
                ['No vinieron', ll.no_vino, ''],
                ['Sin «¿Qué pasó?» apuntado', ll.sin_apuntar, ''],
                ['Todavía por hacer', ll.futuras, ''],
                ['Canceladas o cambiadas de hora', ll.canceladas, ''],
              ] as const
            ).map(([texto, n, nota]) => (
              <div key={texto} className="px-4 py-2.5 flex items-baseline justify-between gap-3">
                <span className="text-gray-900">
                  {texto}
                  {nota ? <span className={`${META} block`}>{nota}</span> : null}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{n}</span>
              </div>
            ))}
          </div>
          <p className={META}>
            Resultados: {ll.resultados['pagado'] || 0} pagó · {ll.resultados['compra'] || 0} va a pagar · {ll.resultados['piensa'] || 0} lo piensa
            · {ll.resultados['no-encaja'] || 0} no encaja · {ll.resultados['no-vino'] || 0} no vino
            {ll.van_a_pagar_sin_pagar ? ` · ${ll.van_a_pagar_sin_pagar} dijeron «va a pagar» y aún no han pagado` : ''}
          </p>
        </Seccion>

        {conDinero ? (
        <Seccion titulo="Ventas cobradas en estos días">
          <div className={`${TARJETA} divide-y divide-[#F3F4F6] text-[13.5px]`}>
            {(
              [
                ['Ventas', String(v.n)],
                ['Cobrado', euros(v.cobrado_cents || 0)],
                ['Después de una llamada', String(v.con_llamada ?? 0)],
                ['Pago único o Klarna', String(v.tipos?.unico ?? 0)],
                ['A plazos', String(v.tipos?.plazos ?? 0)],
                ['Otro importe o señal completada', String(v.tipos?.otro ?? 0)],
              ] as const
            ).map(([texto, valor]) => (
              <div key={texto} className="px-4 py-2.5 flex items-baseline justify-between gap-3">
                <span className="text-gray-900">{texto}</span>
                <span className="font-semibold text-gray-900 tabular-nums">{valor}</span>
              </div>
            ))}
          </div>
          <p className={META}>
            En los plazos, «cobrado» es lo que ha entrado hasta hoy, no el total. Quien está fuera de los números (pruebas) no cuenta en
            nada de esta página.{' '}
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
