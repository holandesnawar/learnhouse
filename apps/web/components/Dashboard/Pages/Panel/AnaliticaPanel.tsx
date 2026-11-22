'use client'

/**
 * Web → Analítica (17/11/2026; por pestañas y con comparación desde el
 * 22/11/2026: «lo sigo viendo pobre»). Pedido del usuario: "ver las analíticas
 * más importantes de las webs dentro del panel… filtrar y ver de dónde viene x
 * tráfico, cuántos leads se convirtieron por paid vs orgánico, quién agendó
 * llamada gracias a qué utm… que esté bien hecho". Y la campaña de Black
 * Friday como filtro.
 *
 * Todo lo calcula el servidor (apps/api/src/services/stats/analitica.py): las
 * VISITAS (sesiones anónimas de toda la web, desde el 17/11) y las PERSONAS
 * (quien dejó sus datos en las fechas, y si reservó, vino y pagó aunque fuera
 * después). Cada cifra se compara con el periodo de antes (mismo largo).
 *
 * Seis vistas, en `?vista=`: Resumen · De dónde vienen · Páginas · Embudo ·
 * Quién visita · Personas. Cada fila de las tablas de origen se toca para
 * filtrar por ella. Solo administradores: lleva lo vendido.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAnalitica, type Analitica, type Cifras, type FiltrosAnalitica, type Modelo, type PaginaVista } from '@services/stats/analitica'
import { euros } from '@services/stats/school'
import { Loader2, X } from 'lucide-react'
import FichaCliente from './Ficha'
import {
  Antes,
  BarraParte,
  BotonCSV,
  COLOR_ORGANICO,
  COLOR_PAGO,
  DiaADia,
  EmbudoDibujado,
  MEDIDAS,
  MapaCalor,
  Pagina,
  TablaCifras,
  coma,
  descargarCSV,
  diaTexto,
  duracion,
  fecha,
  franjaTexto,
  nombreDePagina,
  num,
  pct,
  type Medida,
} from './AnaliticaPiezas'
import { Cifra, ENLACE, Estado, META, SUB, Seccion, Segmentado, TABLA, TD, TD_NUM, TH, TH_NUM, Tira, filtro } from './ui'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Periodo = '7' | '30' | '90' | 'mes' | 'mes-pasado' | 'a-mano'

function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = new Date()
  if (p === 'mes') return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) }
  if (p === 'mes-pasado') {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) }
  }
  const dias = Number(p) || 30
  const desde = new Date(hoy)
  desde.setDate(hoy.getDate() - (dias - 1))
  return { desde: iso(desde), hasta: iso(hoy) }
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
  { id: 'a-mano', label: 'Fechas…' },
]

const VISTAS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'origen', label: 'De dónde vienen' },
  { id: 'paginas', label: 'Páginas' },
  { id: 'embudo', label: 'Embudo' },
  { id: 'quien', label: 'Quién visita' },
  { id: 'personas', label: 'Personas' },
] as const
type Vista = (typeof VISTAS)[number]['id']
const esVista = (v: string | null): v is Vista => VISTAS.some((x) => x.id === v)

const SELECT =
  'h-8 rounded-lg border border-[#E6E8EE] bg-white px-2 text-[13px] text-[#0B1020] outline-none focus:border-[#0B1020] max-w-full'

const euroFino = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** La tira de seis cifras, cada una con su cambio respecto a antes. */
function TiraResumen({ r, a }: { r: Cifras; a: Cifras | null }) {
  return (
    <Tira>
      <Cifra
        rotulo="Visitas"
        valor={num(r.visitas)}
        nota={
          a && a.visitas !== null ? (
            <Antes ahora={r.visitas} antes={a.visitas} />
          ) : (
            'sesiones en la web'
          )
        }
      />
      <Cifra
        rotulo="Leads"
        valor={num(r.leads)}
        nota={
          <>
            {a ? <Antes ahora={r.leads} antes={a.leads} corto /> : null}
            {a ? ' · ' : ''}
            {r.visitas ? `${pct(r.pct_lead)} de las visitas` : 'dejaron sus datos'}
          </>
        }
      />
      <Cifra
        rotulo="Reservaron"
        valor={num(r.reservaron)}
        nota={
          <>
            {a ? <Antes ahora={r.reservaron} antes={a.reservaron} corto /> : null}
            {a ? ' · ' : ''}
            {pct(r.pct_reserva)} de los leads
          </>
        }
      />
      <Cifra
        rotulo="Vinieron"
        valor={num(r.vinieron)}
        nota={
          r.reservaron ? (
            <>
              {pct(r.pct_vino)}
              {r.no_vinieron ? (
                <>
                  {' · '}
                  <span className="font-medium text-[#C8322B]">{r.no_vinieron} no</span>
                </>
              ) : null}
            </>
          ) : (
            'a la llamada'
          )
        }
      />
      <Cifra
        rotulo="Compraron"
        valor={num(r.pagaron)}
        nota={
          <>
            {a ? <Antes ahora={r.pagaron} antes={a.pagaron} corto /> : null}
            {a ? ' · ' : ''}
            {r.vinieron ? `${pct(r.pct_pago_llamada)} de los que vinieron` : `${pct(r.pct_pago)} de los leads`}
          </>
        }
      />
      <Cifra
        rotulo="Vendido"
        valor={euros(r.cents)}
        nota={
          <>
            {a ? <Antes ahora={r.cents} antes={a.cents} corto /> : null}
            {a ? ' · ' : ''}
            {(r.por_cobrar_cents ?? 0) > 0 ? `cobrado ${euros(r.cobrado_cents ?? r.cents)}` : r.cents_por_visita ? `${euroFino(r.cents_por_visita)} por visita` : 'en ventas'}
          </>
        }
      />
    </Tira>
  )
}

/** Una tabla de páginas (más vistas, de salida, blog). */
function TablaPaginas({ filas, columnas, csv, vacio, tope = 12 }: { filas: PaginaVista[]; columnas: ('sesiones' | 'entradas' | 'salidas' | 'datos')[]; csv: string; vacio: string; tope?: number }) {
  const [todas, setTodas] = useState(false)
  if (!filas.length) return <p className={`${META} py-3`}>{vacio}</p>
  const vistas = todas ? filas : filas.slice(0, tope)
  const titulo = { sesiones: 'Visitas', entradas: 'Entraron por aquí', salidas: 'Se fueron desde aquí', datos: 'Dejaron sus datos' }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`${TABLA} min-w-[420px]`}>
          <thead>
            <tr>
              <th className={TH}>Página</th>
              {columnas.map((c) => (
                <th key={c} className={TH_NUM}>
                  {titulo[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vistas.map((p) => (
              <tr key={p.pagina}>
                <td className={`${TD} max-w-[280px]`}>
                  <Pagina ruta={p.pagina} />
                </td>
                {columnas.map((c) => (
                  <td key={c} className={TD_NUM}>
                    {c === 'salidas' ? (
                      <>
                        {num(p.salidas)} <span className="text-[12.5px] text-[#8A93A3]">({pct(p.pct_salida)})</span>
                      </>
                    ) : c === 'datos' ? (
                      p.medidas ? (
                        <>
                          {num(p.datos)} <span className="text-[12.5px] text-[#8A93A3]">({pct(p.pct_datos)})</span>
                        </>
                      ) : (
                        '—'
                      )
                    ) : (
                      num(p[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 mt-1.5">
        {filas.length > tope ? (
          <button type="button" onClick={() => setTodas(!todas)} className={ENLACE}>
            {todas ? 'Ver menos' : `Ver las ${filas.length}`}
          </button>
        ) : (
          <span />
        )}
        <BotonCSV
          onClick={() =>
            descargarCSV(
              csv,
              ['Página', 'Dirección', 'Visitas', 'Entraron por aquí', 'Se fueron desde aquí', 'Dejaron sus datos'],
              filas.map((p) => [nombreDePagina(p.pagina), p.pagina, p.sesiones, p.entradas, p.salidas, p.medidas ? p.datos : '']),
            )
          }
        />
      </div>
    </div>
  )
}

export default function AnaliticaPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [vista, setVista] = useState<Vista>('resumen')
  const [f, setF] = useState<FiltrosAnalitica>(() => ({
    ...rango('30'),
    modelo: 'ficha',
    canal: '',
    fuente: '',
    campana: '',
    anuncio: '',
    bf_todo: false,
    pais: '',
    comparar: true,
  }))
  const [datos, setDatos] = useState<Analitica | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [medida, setMedida] = useState<Medida>('visitas')
  const [quien, setQuien] = useState<'todas' | 'reservaron' | 'pagaron'>('reservaron')
  const [abierta, setAbierta] = useState<string | null>(null)
  const ultima = useRef(0)

  // La vista va en la dirección (?vista=) para poder mandar el enlace.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    if (esVista(v)) setVista(v)
  }, [])
  const irA = (v: Vista) => {
    setVista(v)
    try {
      const q = new URLSearchParams(window.location.search)
      if (v === 'resumen') q.delete('vista')
      else q.set('vista', v)
      const texto = q.toString()
      window.history.replaceState(null, '', texto ? `?${texto}` : window.location.pathname)
    } catch {
      /* sin historial: la vista cambia igual */
    }
  }

  useEffect(() => {
    if (!org?.id || !token) return
    const n = ++ultima.current
    setCargando(true)
    getAnalitica(org.id, f, token).then((r) => {
      if (n !== ultima.current) return
      setCargando(false)
      if (r.ok && r.datos) {
        setDatos(r.datos)
        setError('')
      } else setError(r.error || 'No se han podido leer los datos')
    })
  }, [org?.id, token, f])

  const poner = (cambio: Partial<FiltrosAnalitica>) => setF((x) => ({ ...x, ...cambio }))
  const elegirPeriodo = (p: Periodo) => {
    setPeriodo(p)
    if (p !== 'a-mano') poner(rango(p))
  }
  const hayFiltros = !!(f.canal || f.fuente || f.campana || f.anuncio || f.pais)

  const personas = useMemo(() => {
    const lista = datos?.personas || []
    if (quien === 'reservaron') return lista.filter((p) => p.reservo)
    if (quien === 'pagaron') return lista.filter((p) => p.pago)
    return lista
  }, [datos, quien])

  if (!datos && !error) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[#4B5565] py-10">
        <Loader2 size={16} className="animate-spin" /> Leyendo la analítica…
      </div>
    )
  }

  const r = datos?.resumen
  const ant = datos?.anterior || null
  const a = ant?.resumen || null
  const q = datos?.quien
  const pag = datos?.paginas_detalle
  const dias = datos ? Math.round((new Date(datos.hasta).getTime() - new Date(datos.desde).getTime()) / 86400000) + 1 : 0
  const medido = datos?.medido_desde ? fecha(datos.medido_desde) : ''
  const sinMedir = q && q.sesiones > 0 && q.medidas === 0
  const notaMedido = medido ? `Se cuenta desde el ${medido}; las visitas de antes no traen ese dato.` : ''

  return (
    <div className="space-y-6">
      {/* ── vistas y «ahora» ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto -mx-1 px-1">
          <Segmentado opciones={VISTAS.map((v) => ({ id: v.id, label: v.label }))} valor={vista} onChange={irA} />
        </div>
        {datos?.ahora !== null && datos?.ahora !== undefined ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-[#4B5565]" title="Sesiones que han abierto una página en los últimos 5 minutos. Se actualiza al recargar.">
            <i className="inline-block w-2 h-2 rounded-full" style={{ background: datos.ahora ? '#0E8A4F' : '#C5CAD6' }} />
            <b className="font-semibold text-[#0B1020] tabular-nums">{datos.ahora}</b>
            {datos.ahora === 1 ? 'persona en la web ahora' : 'personas en la web ahora'}
          </span>
        ) : null}
      </div>

      {/* ── fechas y filtros ── */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 max-w-full">
            {PERIODOS.map((p) => (
              <button key={p.id} className={filtro(periodo === p.id)} onClick={() => elegirPeriodo(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'a-mano' ? (
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-[#4B5565]">
              Del
              <input type="date" className={SELECT} value={f.desde} max={f.hasta} onChange={(e) => e.target.value && poner({ desde: e.target.value })} />
              al
              <input type="date" className={SELECT} value={f.hasta} min={f.desde} onChange={(e) => e.target.value && poner({ hasta: e.target.value })} />
            </span>
          ) : null}
          {cargando ? <Loader2 size={15} className="animate-spin text-[#8A93A3]" /> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>select]:w-full sm:[&>select]:w-auto [&>select:first-child]:col-span-2">
          <select className={SELECT} value={f.comparar ? '1' : '0'} onChange={(e) => poner({ comparar: e.target.value === '1' })} aria-label="Comparar">
            <option value="1">Comparar con los {dias || ''} días de antes</option>
            <option value="0">Sin comparar</option>
          </select>
          <select className={SELECT} value={f.canal} onChange={(e) => poner({ canal: e.target.value as FiltrosAnalitica['canal'] })} aria-label="Pago u orgánico">
            <option value="">Todo el tráfico</option>
            <option value="ads">Solo anuncios de pago</option>
            <option value="organico">Solo orgánico</option>
          </select>
          <select className={SELECT} value={f.fuente} onChange={(e) => poner({ fuente: e.target.value })} aria-label="Fuente">
            <option value="">Todas las fuentes</option>
            {datos?.opciones.fuentes.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            {f.fuente && !datos?.opciones.fuentes.includes(f.fuente) ? <option value={f.fuente}>{f.fuente}</option> : null}
          </select>
          <select className={SELECT} value={f.campana} onChange={(e) => poner({ campana: e.target.value, bf_todo: e.target.value === 'black-friday' ? f.bf_todo : false })} aria-label="Campaña">
            <option value="">Todas las campañas</option>
            {datos?.opciones.campanas.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre}
              </option>
            ))}
            <option value="-">Sin campaña</option>
          </select>
          {datos?.opciones.anuncios.length ? (
            <select className={SELECT} value={f.anuncio} onChange={(e) => poner({ anuncio: e.target.value })} aria-label="Anuncio">
              <option value="">Todos los anuncios</option>
              {datos.opciones.anuncios.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <select className={SELECT} value={f.pais} onChange={(e) => poner({ pais: e.target.value })} aria-label="País">
            <option value="">Todos los países</option>
            {(datos?.opciones.paises || []).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            {f.pais && !(datos?.opciones.paises || []).includes(f.pais) ? <option value={f.pais}>{f.pais}</option> : null}
          </select>
          {hayFiltros ? (
            <button className={`${ENLACE} inline-flex items-center gap-1`} onClick={() => poner({ canal: '', fuente: '', campana: '', anuncio: '', pais: '', bf_todo: false })}>
              <X size={13} /> Quitar filtros
            </button>
          ) : null}
        </div>
        {f.campana === 'black-friday' ? (
          <label className="flex items-start gap-2 text-[13px] text-[#4B5565]">
            <input type="checkbox" className="mt-0.5" checked={f.bf_todo} onChange={(e) => poner({ bf_todo: e.target.checked })} />
            <span>
              Contar también a quien pasó por Black Friday aunque hubiera llegado antes por otro sitio (por ejemplo, una guía en
              septiembre). Sin marcar, solo quien llegó por Black Friday.
            </span>
          </label>
        ) : null}
        {f.pais ? (
          <p className={META}>
            El país de una visita sale de la zona horaria de su navegador (desde el {medido}); el de una persona, del prefijo de su teléfono.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-[13.5px] text-[#C8322B] border border-[#F1C9C6] rounded-lg px-4 py-3">{error}</p> : null}

      {datos && r ? (
        <>
          {/* ════════════ Resumen ════════════ */}
          {vista === 'resumen' ? (
            <div className="space-y-10">
              <div>
                <TiraResumen r={r} a={a} />
                <p className={`${META} mt-2.5 leading-relaxed`}>
                  Leads = quien dejó sus datos del {fecha(datos.desde)} al {fecha(datos.hasta)}; reservaron, vinieron y compraron cuenta lo que hicieron
                  ellos, aunque fuera después.
                  {ant ? ` Se compara con el ${fecha(ant.desde)} – ${fecha(ant.hasta)}.` : ''}
                  {ant && !ant.visitas_comparables ? ` Las visitas no se comparan: se cuentan desde el ${fecha(datos.visitas_desde)}.` : ''}
                </p>
              </div>

              <Seccion
                titulo="Día a día"
                extra={
                  <div className="max-w-[72vw] sm:max-w-none overflow-x-auto">
                    <Segmentado opciones={MEDIDAS.map((m) => ({ id: m.id, label: m.label }))} valor={medida} onChange={setMedida} />
                  </div>
                }
              >
                <DiaADia serie={datos.serie} antes={ant?.serie || null} medida={medida} sinVisitasAntes={!ant?.visitas_comparables} />
              </Seccion>

              <Seccion
                titulo="Del clic a la venta"
                extra={
                  r.ventas_por_100_visitas !== null && r.ventas_por_100_visitas !== undefined ? (
                    <span className={META}>
                      De cada 100 visitas, {coma(r.ventas_por_100_visitas)} compran
                      {a?.ventas_por_100_visitas !== null && a?.ventas_por_100_visitas !== undefined ? ` · antes ${coma(a.ventas_por_100_visitas)}` : ''}
                    </span>
                  ) : null
                }
              >
                <EmbudoDibujado r={r} />
              </Seccion>

              <div className="grid lg:grid-cols-[1.5fr_1fr] gap-x-14 gap-y-10 items-start [&>*]:min-w-0">
                <Seccion
                  titulo="De dónde vienen"
                  extra={
                    <button type="button" className={ENLACE} onClick={() => irA('origen')}>
                      Ver campañas y anuncios
                    </button>
                  }
                >
                  <TablaCifras
                    filas={datos.por_fuente}
                    primera="Fuente"
                    csv="analitica-fuentes"
                    conPorVisita
                    elegido={f.fuente}
                    onElegir={(v) => poner({ fuente: v === '-' ? '' : v })}
                    vacio="Nada en estas fechas."
                    tope={6}
                    compacta
                  />
                </Seccion>
                <div className="space-y-8">
                  <Seccion
                    titulo="Desde qué país"
                    extra={
                      <button type="button" className={ENLACE} onClick={() => irA('quien')}>
                        Quién visita
                      </button>
                    }
                  >
                    {q && q.paises.length ? (
                      <div>
                        {q.paises.slice(0, 5).map((p) => (
                          <BarraParte key={p.pais} nombre={p.pais} n={p.visitas} pctValor={p.pct} max={q.paises[0].visitas} />
                        ))}
                      </div>
                    ) : (
                      <p className={META}>{sinMedir ? `El país se cuenta desde el ${medido}: en estas fechas aún no hay visitas con ese dato.` : 'Sin visitas en estas fechas.'}</p>
                    )}
                  </Seccion>
                  {q ? (
                    <Seccion titulo="Cómo entran">
                      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13.5px]">
                        <dt className="text-[#8A93A3]">Desde el móvil</dt>
                        <dd className="tabular-nums text-right">{q.movil + q.ordenador ? pct(Math.round((q.movil * 100) / (q.movil + q.ordenador))) : '—'}</dd>
                        <dt className="text-[#8A93A3]">Ven una sola página y se van</dt>
                        <dd className="tabular-nums text-right">{pct(q.pct_rebote)}</dd>
                        <dt className="text-[#8A93A3]">Páginas por visita</dt>
                        <dd className="tabular-nums text-right">{coma(q.paginas_por_visita)}</dd>
                        <dt className="text-[#8A93A3]">Tiempo en la web</dt>
                        <dd className="tabular-nums text-right">{duracion(q.segundos)}</dd>
                        <dt className="text-[#8A93A3]">Ya habían venido antes</dt>
                        <dd className="tabular-nums text-right">{q.medidas ? pct(q.pct_vuelven) : '—'}</dd>
                      </dl>
                    </Seccion>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ════════════ De dónde vienen ════════════ */}
          {vista === 'origen' ? (
            <div className="space-y-10">
              <p className={META}>Toca una fila para quedarte solo con ella: de la fuente a sus campañas, y de la campaña a sus anuncios.</p>
              <Seccion titulo="Por fuente" filete>
                <TablaCifras
                  filas={datos.por_fuente}
                  primera="De dónde vienen"
                  csv="analitica-fuentes"
                  conGasto
                  conPorVisita
                  elegido={f.fuente}
                  onElegir={(v) => poner({ fuente: v === '-' ? '' : v })}
                  vacio="Nada en estas fechas."
                />
              </Seccion>
              <Seccion titulo="Por campaña" filete>
                <TablaCifras
                  filas={datos.por_campana}
                  primera="Campaña"
                  csv="analitica-campanas"
                  conGasto
                  elegido={f.campana}
                  onElegir={(v) => poner({ campana: v, bf_todo: false })}
                  vacio="Nada en estas fechas."
                />
                {datos.por_campana.some((c) => c.gasto_cents) ? (
                  <p className={META}>El gasto es el apuntado en Panel → Anuncios, repartido por días entre estas fechas. Retorno = vendido ÷ gasto.</p>
                ) : null}
              </Seccion>
              <Seccion titulo="Por anuncio o enlace" nota="Lo que lleva el enlace en utm_content: el anuncio de Meta, el reel, el setter…" filete>
                <TablaCifras
                  filas={datos.por_anuncio}
                  primera="Anuncio o enlace"
                  csv="analitica-anuncios"
                  conVisitas={false}
                  elegido={f.anuncio}
                  onElegir={(v) => poner({ anuncio: v === '-' ? '' : v })}
                  vacio="Ningún lead con anuncio (utm_content) en estas fechas."
                />
              </Seccion>
              <div className={`${META} leading-relaxed space-y-1.5`}>
                <p>
                  <b className="font-semibold text-[#4B5565]">Cómo se cuenta.</b> Pago = llegó con un enlace de anuncio (utm_medium paid, cpc…) o por la
                  página del anuncio. La fuente sale del enlace (utm_source); si no lo lleva, de la web de la que venía (Instagram, Google…); si no se
                  sabe, «Directo». Black Friday junta su campaña y todo lo que pasa por blackfriday.holandesnawar.com, aunque llegue sin campaña.
                </p>
                <p>
                  Quien reserva directo en Calendly (el enlace de un setter) cuenta por la campaña de su enlace de Calendly
                  {datos.calendly.conectado ? '' : ' (ahora mismo Calendly no contesta: esas reservas no salen)'}. Quien está fuera de los números no
                  cuenta.
                </p>
                <label className="flex flex-wrap items-center gap-2 text-[13px] text-[#4B5565] pt-1">
                  A quién se le da el mérito de cada persona:
                  <select className={SELECT} value={f.modelo} onChange={(e) => poner({ modelo: e.target.value as Modelo })}>
                    {(Object.keys(datos.modelos || { ficha: '', primera: '', ultima: '' }) as Modelo[]).map((m) => (
                      <option key={m} value={m}>
                        {datos.modelos[m] || m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {/* ════════════ Páginas ════════════ */}
          {vista === 'paginas' ? (
            <div className="space-y-10">
              <Seccion
                titulo="Páginas por las que entran"
                nota="La primera página de cada visita: cuántos entran por ella, cuántos se van sin ver nada más y cuántos acaban dejando sus datos en esa visita."
                filete
              >
                {pag && pag.entrada.length ? (
                  <div>
                    <div className="overflow-x-auto">
                      <table className={`${TABLA} min-w-[560px]`}>
                        <thead>
                          <tr>
                            <th className={TH}>Página</th>
                            <th className={TH_NUM}>Entraron</th>
                            <th className={TH_NUM}>Se van sin más</th>
                            <th className={TH_NUM}>Dejaron sus datos</th>
                            <th className={TH_NUM}>Entrada → datos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pag.entrada.slice(0, 20).map((p) => (
                            <tr key={p.pagina}>
                              <td className={`${TD} max-w-[300px]`}>
                                <Pagina ruta={p.pagina} />
                              </td>
                              <td className={`${TD_NUM} font-semibold`}>{num(p.entraron)}</td>
                              <td className={TD_NUM}>{pct(p.pct_rebote)}</td>
                              <td className={TD_NUM}>{p.medidas ? num(p.datos) : '—'}</td>
                              <td className={TD_NUM}>{p.medidas ? pct(p.pct_datos) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <span className={META}>«Dejaron sus datos» {notaMedido.charAt(0).toLowerCase() + notaMedido.slice(1)}</span>
                      <BotonCSV
                        onClick={() =>
                          descargarCSV(
                            'analitica-paginas-de-entrada',
                            ['Página', 'Dirección', 'Entraron', 'Se van sin más %', 'Visitas medidas', 'Dejaron sus datos', 'Entrada a datos %'],
                            pag.entrada.map((p) => [nombreDePagina(p.pagina), p.pagina, p.entraron, p.pct_rebote ?? '', p.medidas, p.datos, p.pct_datos ?? '']),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <p className={META}>Aún no hay visitas contadas en estas fechas.</p>
                )}
              </Seccion>

              <div className="grid lg:grid-cols-2 gap-x-14 gap-y-10 items-start [&>*]:min-w-0">
                <Seccion titulo="Páginas más vistas" filete>
                  <TablaPaginas filas={pag?.vistas || []} columnas={['sesiones', 'entradas']} csv="analitica-paginas" vacio="Aún no hay visitas contadas en estas fechas." />
                </Seccion>
                <Seccion titulo="Por dónde se van" nota="La última página que vieron, y qué parte de quien la vio se fue desde ella." filete>
                  <TablaPaginas filas={pag?.salida || []} columnas={['salidas']} csv="analitica-paginas-de-salida" vacio="Aún no hay visitas contadas en estas fechas." />
                </Seccion>
              </div>

              <div className="grid lg:grid-cols-2 gap-x-14 gap-y-10 items-start [&>*]:min-w-0">
                <Seccion titulo="Artículos del blog" nota="Cuántos leen cada uno y cuántos acaban dejando sus datos en esa visita." filete>
                  <TablaPaginas filas={pag?.blog || []} columnas={['sesiones', 'entradas', 'datos']} csv="analitica-blog" vacio="Nadie ha leído el blog en estas fechas." />
                </Seccion>
                <Seccion titulo="Dónde dejan sus datos" nota="La primera página por la que pasó cada lead (por su ficha), y en qué acabó." filete>
                  {datos.donde_dejan.length === 0 ? (
                    <p className={META}>Nadie en estas fechas.</p>
                  ) : (
                    <table className={TABLA}>
                      <thead>
                        <tr>
                          <th className={TH}>Página</th>
                          <th className={TH_NUM}>Leads</th>
                          <th className={TH_NUM}>Reservaron</th>
                          <th className={TH_NUM}>Pagaron</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datos.donde_dejan.slice(0, 15).map((p) => (
                          <tr key={p.marca || '-'}>
                            <td className={`${TD} first-letter:uppercase`}>{p.nombre}</td>
                            <td className={`${TD_NUM} font-semibold`}>{num(p.leads)}</td>
                            <td className={TD_NUM}>{num(p.reservaron)}</td>
                            <td className={TD_NUM}>{num(p.pagaron)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Seccion>
              </div>
            </div>
          ) : null}

          {/* ════════════ Embudo ════════════ */}
          {vista === 'embudo' ? (
            <div className="space-y-10">
              <Seccion
                titulo="Del clic a la venta"
                nota="La altura de las columnas va a escala de raíz, para que los pasos pequeños se vean: la cifra exacta es la de debajo."
                extra={
                  r.ventas_por_100_visitas !== null && r.ventas_por_100_visitas !== undefined ? (
                    <span className={META}>De cada 100 visitas, {coma(r.ventas_por_100_visitas)} compran</span>
                  ) : null
                }
              >
                <EmbudoDibujado r={r} />
              </Seccion>

              {datos.tiempos ? (
                <Seccion titulo="Cuánto tardan" nota="La mediana: la mitad tarda menos y la otra mitad, más. Entre paréntesis, la media.">
                  <Tira>
                    {(
                      [
                        ['De dejar sus datos a reservar', datos.tiempos.lead_reserva],
                        ['De reservar a comprar', datos.tiempos.reserva_pago],
                        ['De dejar sus datos a comprar', datos.tiempos.lead_pago],
                      ] as const
                    ).map(([rotulo, t]) => (
                      <Cifra
                        key={rotulo}
                        rotulo={rotulo}
                        valor={t.mediana_dias === null ? '—' : t.mediana_dias < 1 ? `${Math.max(1, Math.round(t.mediana_dias * 24))} h` : coma(t.mediana_dias)}
                        sufijo={t.mediana_dias !== null && t.mediana_dias >= 1 ? 'días' : undefined}
                        nota={t.n ? `${t.n} ${t.n === 1 ? 'persona' : 'personas'} (media ${coma(t.media_dias)} días)` : 'nadie en estas fechas'}
                      />
                    ))}
                  </Tira>
                </Seccion>
              ) : null}

              <Seccion titulo="Anuncios de pago y orgánico, lado a lado" nota="Toca uno para quedarte solo con ese tráfico.">
                <div className="grid md:grid-cols-2 gap-x-14 gap-y-8 [&>*]:min-w-0">
                  {datos.por_canal.map((c) => {
                    const color = c.valor === 'ads' ? COLOR_PAGO : COLOR_ORGANICO
                    return (
                      <button
                        key={c.valor}
                        type="button"
                        onClick={() => poner({ canal: f.canal === c.valor ? '' : (c.valor as 'ads' | 'organico') })}
                        className={`text-left rounded-[10px] p-4 -m-4 hover:bg-[#F7F8FA] transition-colors ${f.canal === c.valor ? 'bg-[#F7F8FA]' : ''}`}
                      >
                        <div className="flex items-baseline justify-between gap-3 mb-3">
                          <Estado color={color} className="!text-[14px] !font-semibold !text-[#0B1020]">
                            {c.nombre}
                          </Estado>
                          <span className="text-[14px] font-semibold tabular-nums">
                            {euros(c.cents)} <span className="text-[12.5px] font-normal text-[#8A93A3]">vendido</span>
                          </span>
                        </div>
                        <EmbudoDibujado r={c} color={color} claro={c.valor === 'ads' ? '#CFDDFB' : '#CBE8D8'} compacto />
                      </button>
                    )
                  })}
                </div>
              </Seccion>
            </div>
          ) : null}

          {/* ════════════ Quién visita ════════════ */}
          {vista === 'quien' && q ? (
            <div className="space-y-10">
              <div>
                <Tira>
                  <Cifra rotulo="Desde el móvil" valor={q.movil + q.ordenador ? pct(Math.round((q.movil * 100) / (q.movil + q.ordenador))) : '—'} nota={`${num(q.ordenador)} desde el ordenador`} />
                  <Cifra rotulo="Se van sin más" valor={pct(q.pct_rebote)} nota="ven una sola página" />
                  <Cifra rotulo="Páginas por visita" valor={coma(q.paginas_por_visita)} nota={`${num(q.sesiones)} visitas`} />
                  <Cifra rotulo="Tiempo en la web" valor={duracion(q.segundos)} nota="de quien ve más de una página" />
                  <Cifra rotulo="Ya habían venido" valor={q.medidas ? pct(q.pct_vuelven) : '—'} nota={q.medidas ? `${num(q.vuelven)} vuelven · ${num(q.nuevos)} nuevos` : `desde el ${medido}`} />
                  <Cifra rotulo="Dejan sus datos" valor={q.medidas ? pct(q.pct_datos) : '—'} nota={q.medidas ? `${num(q.dejaron_datos)} de ${num(q.medidas)} visitas` : `desde el ${medido}`} />
                </Tira>
                <p className={`${META} mt-2.5`}>
                  El país, si ya habían venido y si dejaron sus datos se cuentan desde el {medido}
                  {q.medidas < q.sesiones ? `: de las ${num(q.sesiones)} visitas de estas fechas, ${num(q.medidas)} traen ese dato.` : '.'} Nada de esto identifica a nadie.
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-x-14 gap-y-10 items-start [&>*]:min-w-0">
                <Seccion
                  titulo="Visitas por país"
                  nota="Por la zona horaria del navegador, sin mirar la IP."
                  filete
                >
                  {q.paises.length ? (
                    <table className={TABLA}>
                      <thead>
                        <tr>
                          <th className={TH}>País</th>
                          <th className={TH_NUM}>Visitas</th>
                          <th className={TH_NUM}>% de las visitas</th>
                          <th className={TH_NUM}>Dejan sus datos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.paises.map((p) => (
                          <tr key={p.pais} className="cursor-pointer hover:bg-[#F7F8FA]" onClick={() => poner({ pais: f.pais === p.pais ? '' : p.pais })} title="Tocar para filtrar por este país">
                            <td className={`${TD} font-medium`}>{p.pais}</td>
                            <td className={TD_NUM}>{num(p.visitas)}</td>
                            <td className={`${TD_NUM} text-[#4B5565]`}>{pct(p.pct)}</td>
                            <td className={TD_NUM}>
                              {num(p.datos)} <span className="text-[12.5px] text-[#8A93A3]">({pct(p.pct_datos)})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {q.paises.length ? (
                    <div className="flex justify-end">
                      <BotonCSV
                        onClick={() =>
                          descargarCSV(
                            'analitica-paises',
                            ['País', 'Visitas', '% de las visitas', 'Dejaron sus datos', '% que deja sus datos'],
                            q.paises.map((p) => [p.pais, p.visitas, p.pct ?? '', p.datos, p.pct_datos ?? '']),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <p className={META}>{sinMedir ? `El país se cuenta desde el ${medido}: en estas fechas aún no hay visitas con ese dato.` : 'Sin visitas en estas fechas.'}</p>
                  )}
                </Seccion>
                <Seccion titulo="Leads por país" nota="Por el prefijo del teléfono que dejó cada persona." filete>
                  {q.paises_personas.length ? (
                    <table className={TABLA}>
                      <thead>
                        <tr>
                          <th className={TH}>País</th>
                          <th className={TH_NUM}>Leads</th>
                          <th className={TH_NUM}>Reservaron</th>
                          <th className={TH_NUM}>Pagaron</th>
                          <th className={TH_NUM}>Vendido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.paises_personas.map((p) => (
                          <tr key={p.pais}>
                            <td className={`${TD} font-medium`}>
                              {p.pais}
                              {p.pais === 'Sin dato' ? <span className={SUB}>sin teléfono o sin prefijo</span> : null}
                            </td>
                            <td className={TD_NUM}>{num(p.leads)}</td>
                            <td className={TD_NUM}>{num(p.reservaron)}</td>
                            <td className={TD_NUM}>{num(p.pagaron)}</td>
                            <td className={`${TD_NUM} font-semibold`}>{p.cents ? euros(p.cents) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className={META}>Nadie en estas fechas.</p>
                  )}
                </Seccion>
              </div>

              <div className="grid lg:grid-cols-[1.4fr_1fr] gap-x-14 gap-y-10 items-start [&>*]:min-w-0">
                <Seccion titulo="Cuándo visitan" extra={<span className={META}>hora de Países Bajos</span>}>
                  <MapaCalor calor={q.calor} />
                  {q.mejores.length ? (
                    <p className="text-[13px] text-[#4B5565]">
                      El mejor rato:{' '}
                      <b className="font-semibold text-[#0B1020]">
                        {q.mejores
                          .slice(0, 2)
                          .map((m) => `${diaTexto(m.dia).toLowerCase()} de ${franjaTexto(m.franja)}`)
                          .join(' y ')}
                      </b>
                      .
                    </p>
                  ) : null}
                </Seccion>
                <Seccion titulo="Móvil u ordenador, nuevos o repiten">
                  <div>
                    <BarraParte nombre="Móvil" n={q.movil} pctValor={q.movil + q.ordenador ? Math.round((q.movil * 100) / (q.movil + q.ordenador)) : null} max={q.movil + q.ordenador} />
                    <BarraParte nombre="Ordenador" n={q.ordenador} pctValor={q.movil + q.ordenador ? Math.round((q.ordenador * 100) / (q.movil + q.ordenador)) : null} max={q.movil + q.ordenador} />
                  </div>
                  {q.medidas ? (
                    <div>
                      <BarraParte nombre="Primera vez" n={q.nuevos} pctValor={Math.round((q.nuevos * 100) / q.medidas)} max={q.medidas} />
                      <BarraParte nombre="Ya habían venido" n={q.vuelven} pctValor={q.pct_vuelven} max={q.medidas} />
                    </div>
                  ) : (
                    <p className={META}>Si ya habían venido se cuenta desde el {medido}.</p>
                  )}
                </Seccion>
              </div>
            </div>
          ) : null}

          {/* ════════════ Personas ════════════ */}
          {vista === 'personas' ? (
            <Seccion
              titulo="Quién es cada uno"
              nota={`${num(datos.personas_total)} ${datos.personas_total === 1 ? 'persona dejó' : 'personas dejaron'} sus datos en estas fechas. Toca una para abrir su ficha.`}
              extra={
                <>
                  <div className="max-w-[60vw] sm:max-w-none overflow-x-auto">
                    <Segmentado
                      opciones={[
                        { id: 'reservaron', label: 'Reservaron' },
                        { id: 'pagaron', label: 'Pagaron' },
                        { id: 'todas', label: 'Todos' },
                      ]}
                      valor={quien}
                      onChange={setQuien}
                    />
                  </div>
                  <BotonCSV
                    onClick={() =>
                      descargarCSV(
                        'analitica-personas',
                        ['Nombre', 'Correo', 'Entró', 'Canal', 'Fuente', 'Campaña', 'Anuncio', 'Primera página', 'País', 'Reservó', 'Vino', 'Pagó', 'Vendido €', 'Cobrado €'],
                        personas.map((p) => [
                          p.nombre,
                          p.email,
                          p.entro.slice(0, 10),
                          p.canal === 'ads' ? 'Pago' : 'Orgánico',
                          p.fuente,
                          p.campana_nombre,
                          p.anuncio,
                          p.primera_pagina,
                          p.pais || '',
                          p.reservo ? p.reservo.slice(0, 10) : '',
                          p.vino ? 'sí' : p.no_vino ? 'no vino' : '',
                          p.pago ? 'sí' : '',
                          p.cents ? (p.cents / 100).toFixed(2).replace('.', ',') : '',
                          p.pago ? ((p.cobrado_cents ?? p.cents) / 100).toFixed(2).replace('.', ',') : '',
                        ]),
                      )
                    }
                  />
                </>
              }
              junto
            >
              <div className="border-t border-[#E6E8EE]">
                {personas.length === 0 ? (
                  <p className={`${META} py-4`}>Nadie con estos filtros.</p>
                ) : (
                  personas.slice(0, 200).map((p) => (
                    <button
                      key={p.email}
                      onClick={() => setAbierta(p.email)}
                      className="w-full text-left py-[11px] border-b border-[#F0F1F5] hover:bg-[#F7F8FA] flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[#0B1020] truncate">{p.nombre || p.email}</p>
                        <p className={`${META} truncate`}>
                          <span className={p.canal === 'ads' ? 'font-medium text-[#2F6FED]' : ''}>{p.fuente}</span>
                          {p.campana_nombre ? ` · ${p.campana_nombre}` : ''}
                          {p.anuncio ? ` · ${p.anuncio}` : ''}
                          {p.primera_pagina ? ` · entró por ${p.primera_pagina}` : ''}
                          {p.pais && p.pais !== 'Sin dato' ? ` · ${p.pais}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
                        <span className={META}>Lead {fecha(p.entro)}</span>
                        {p.reservo ? <Estado tono="azul">Reservó {fecha(p.reservo)}</Estado> : null}
                        {p.vino ? <Estado tono="azul">Vino</Estado> : p.no_vino ? <Estado tono="rojo">No vino</Estado> : null}
                        {p.pago ? (
                          <Estado tono="verde">
                            {p.cents && (p.cobrado_cents ?? p.cents) < p.cents
                              ? `Compró ${euros(p.cents)} · cobrado ${euros(p.cobrado_cents ?? 0)}`
                              : `Pagó${p.cents ? ` ${euros(p.cents)}` : ''}`}
                          </Estado>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
                {personas.length > 200 ? <p className={`${META} py-2.5`}>Y {personas.length - 200} más: afina con los filtros o descarga el CSV.</p> : null}
              </div>
            </Seccion>
          ) : null}
        </>
      ) : null}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
