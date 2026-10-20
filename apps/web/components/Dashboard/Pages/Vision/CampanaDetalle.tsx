'use client'

/**
 * Una campaña de Visión por dentro: sus métricas con el semáforo, el embudo
 * con el % de cada paso, de dónde sale el dinero, las semanas, y donde se
 * apuntan los números (por día o por semana) y los pagos a mano.
 *
 * Lo que se deja vacío lo pone la escuela (leads, llamadas agendadas y
 * presentadas por el utm_campaign; ventas por las matrículas pagadas). Lo
 * apuntado a mano manda sobre lo de la escuela, campo a campo.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Map as MapaIcono, Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import {
  ESTADO,
  METODOS,
  borrarDato,
  borrarPago,
  euros,
  fechaCorta,
  getCampana,
  guardarDato,
  guardarPago,
  valorDe,
  type Ajustes,
  type Campana,
  type Dato,
  type MetricaInfo,
  type Metodo,
  type Pago,
} from '@services/vision/vision'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA, Seccion, filtro } from '../Panel/ui'
import { CAMPO, Cifra, GraficoSemanas, ROTULO, aCents, deCents, pct, textoFuente } from './piezas'

type Detalle = Campana & { ajustes: Ajustes; metricas: Record<string, MetricaInfo>; avisos_escuela: string[] }

const hoy = () => new Date().toISOString().slice(0, 10)

const CATEGORIAS: { id: string; nombre: string }[] = [
  { id: 'otros', nombre: 'Otros' },
  { id: 'profes', nombre: 'Profes (clase gratis…)' },
  { id: 'publicidad', nombre: 'Publicidad (UGC, creativos…)' },
  { id: 'herramientas', nombre: 'Software y herramientas' },
  { id: 'servicios', nombre: 'Gestoría y servicios' },
]

const ORIGEN: Record<string, string> = { escuela: 'de la escuela', 'a-mano': 'apuntado a mano', datos: 'de los números apuntados' }

export default function CampanaDetalle({
  orgId,
  token,
  id,
  onVolver,
  onVerEnMapa,
  onCambio,
}: {
  orgId: number
  token: string
  id: number
  onVolver: () => void
  onVerEnMapa: (mapaId: number | null, foco?: number) => void
  /** Ha cambiado algo: que el cuadro de mando se recargue al volver. */
  onCambio: () => void
}) {
  const [c, setC] = useState<Detalle | null>(null)
  const [error, setError] = useState('')
  const [formDato, setFormDato] = useState<Partial<Dato> | null>(null)
  const [formPago, setFormPago] = useState<Partial<Pago> | null>(null)

  const cargar = useCallback(async () => {
    const r = await getCampana(orgId, id, token)
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido abrir la campaña')
    setError('')
    setC(r.datos)
  }, [orgId, id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (error) {
    return (
      <div className="space-y-3">
        <button onClick={onVolver} className={BOTON}>
          <ArrowLeft size={14} /> Todas las campañas
        </button>
        <p className="text-[14px] text-gray-700">{error}</p>
      </div>
    )
  }
  if (!c) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={26} />
      </div>
    )
  }

  const f = c.cifras
  const m = c.metricas
  const s = c.semaforo
  const estado = ESTADO[c.estado] ?? ESTADO.pendiente
  const avisos = [...(c.avisos ?? []), ...(c.avisos_escuela ?? [])]

  const embudo: { nombre: string; n: number; fuente?: string }[] = [
    { nombre: 'Impresiones', n: f.impresiones, fuente: c.fuentes.impresiones },
    { nombre: 'Clics', n: f.clics, fuente: c.fuentes.clics },
    { nombre: 'Leads', n: f.leads, fuente: c.fuentes.leads },
    { nombre: 'Llamadas agendadas', n: f.agendadas, fuente: c.fuentes.agendadas },
    { nombre: 'Se presentaron', n: f.presentadas, fuente: c.fuentes.presentadas },
    { nombre: 'Ventas', n: f.ventas, fuente: c.fuentes.ventas },
  ]
  const tope = Math.max(1, ...embudo.map((p) => p.n))

  async function quitarDato(d: Dato) {
    if (!(await confirmar(`¿Borrar los números del ${fechaCorta(d.fecha)}?`, { boton: 'Borrar', peligro: true }))) return
    const r = await borrarDato(orgId, d.id, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    onCambio()
    cargar()
  }

  async function quitarPago(p: Pago) {
    if (!(await confirmar(`¿Borrar el pago de ${euros(p.importe_cents)}${p.alumno ? ` de ${p.alumno}` : ''}?`, { boton: 'Borrar', peligro: true }))) return
    const r = await borrarPago(orgId, p.id, token)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    onCambio()
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={onVolver} className={BOTON}>
          <ArrowLeft size={14} /> Campañas
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-gray-900 leading-tight truncate">{c.titulo}</h2>
          <p className={`${META} truncate`}>
            {estado.nombre} · {c.utm_campaign ? `utm_campaign = ${c.utm_campaign}` : 'sin utm_campaign: la escuela no puede poner sus números'}
            {c.inicio ? ` · desde ${fechaCorta(c.inicio)}` : ''}
            {c.fin ? ` hasta ${fechaCorta(c.fin)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onVerEnMapa(c.mapa_id, c.id)} className={BOTON}>
            <MapaIcono size={14} /> En el mapa
          </button>
          {c.submapa_id ? (
            <button onClick={() => onVerEnMapa(c.submapa_id)} className={BOTON}>
              Su mapa
            </button>
          ) : null}
        </div>
      </div>

      {avisos.length ? (
        <div className="space-y-1.5">
          {avisos.map((a, i) => (
            <p key={i} className="flex items-start gap-2 text-[13px] text-[#4B5563]">
              <AlertTriangle size={14} className="text-[#D97706] shrink-0 mt-0.5" />
              {a}
            </p>
          ))}
        </div>
      ) : null}

      {/* Las cifras que deciden. */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
          <Cifra
            rotulo="CAC"
            valor={valorDe('cac', f, m)}
            semaforo={s.cac}
            pie={`Máximo rentable: ${euros(f.cac_maximo)}`}
            fuerte
          />
          <Cifra rotulo="Margen" valor={valorDe('margen', f, m)} semaforo={s.margen} pie="Ingreso neto − coste" fuerte />
          <Cifra rotulo="ROAS" valor={valorDe('roas', f, m)} semaforo={s.roas} pie="Cobrado ÷ anuncios" fuerte />
          <Cifra rotulo="Neto por alumno" valor={valorDe('neto_por_alumno', f, m)} pie="Lo que deja cada venta" fuerte />
          <Cifra rotulo="CTR" valor={valorDe('ctr', f, m)} semaforo={s.ctr} />
          <Cifra rotulo="Coste por clic" valor={valorDe('cpc', f, m)} semaforo={s.cpc} />
          <Cifra rotulo="Coste por lead" valor={valorDe('coste_lead', f, m)} semaforo={s.coste_lead} />
          <Cifra rotulo="Coste por agendada" valor={valorDe('coste_agendada', f, m)} semaforo={s.coste_agendada} />
          <Cifra rotulo="Agendan" valor={pct(f.paso_agendar)} pie="De los leads" />
          <Cifra rotulo="Asistencia" valor={valorDe('asistencia', f, m)} semaforo={s.asistencia} pie="De las agendadas" />
          <Cifra rotulo="Cierre" valor={valorDe('cierre', f, m)} semaforo={s.cierre} pie="De las presentadas" />
          <Cifra rotulo="Coste total" valor={euros(f.coste_cents)} pie={`Anuncios ${euros(f.gasto_ads_cents)} · otros ${euros(f.otros_gastos_cents)}`} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Seccion titulo="El embudo">
          <div className={`${TARJETA} p-4 sm:p-5 space-y-2.5`}>
            {embudo.map((p, i) => {
              const antes = i ? embudo[i - 1].n : 0
              const paso = i && antes ? Math.round((p.n * 1000) / antes) / 10 : null
              return (
                <div key={p.nombre}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-gray-900 font-medium">{p.nombre}</span>
                    <span className="tabular-nums text-gray-900">
                      {p.n.toLocaleString('es-ES')}
                      {paso !== null ? <span className="text-[#9CA3AF]"> · {pct(paso)}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#025dc7]" style={{ width: `${Math.max(p.n ? 1.5 : 0, (p.n * 100) / tope)}%`, opacity: 1 - i * 0.11 }} />
                  </div>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{textoFuente(p.fuente as any)}</p>
                </div>
              )
            })}
          </div>
        </Seccion>

        <Seccion titulo="El dinero">
          <div className={`${TARJETA} p-4 sm:p-5`}>
            <dl className="text-[13.5px]">
              {[
                ['Cobrado', f.ingresos_cents, `${f.ventas} ${f.ventas === 1 ? 'venta' : 'ventas'} · ${textoFuente(c.fuentes.ventas)}`],
                ['− Devoluciones', -f.devoluciones_cents, ''],
                ['− Comisión de Klarna', -f.klarna_cents, c.ajustes.klarna_pct || c.ajustes.klarna_fijo_cents ? '' : 'pon su % en Ajustes'],
                ['= Ventas netas', f.ventas_netas_cents, ''],
                ['− Comisión del closer', -f.closer_cents, c.ajustes.closer.map((t) => `${String(t.pct).replace('.', ',')} %${t.desde ? ` desde ${fechaCorta(t.desde)}` : ''}`).join(' · ')],
                ['= Ingreso neto', f.ingreso_neto_cents, ''],
                ['− Anuncios', -f.gasto_ads_cents, textoFuente(c.fuentes.gasto_ads)],
                ['− Otros gastos de la campaña', -f.otros_gastos_cents, 'clase gratis, vídeo UGC…'],
              ].map(([nombre, cents, nota]) => (
                <div
                  key={String(nombre)}
                  className={`flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F9FAFB] ${String(nombre).startsWith('=') ? 'font-semibold' : ''}`}
                >
                  <dt className="text-[#4B5563] min-w-0">
                    {nombre}
                    {nota ? <span className="text-[#9CA3AF] text-[12px] font-normal"> · {nota}</span> : null}
                  </dt>
                  <dd className="tabular-nums text-gray-900 shrink-0 whitespace-nowrap">{euros(Number(cents) || 0)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 pt-2">
                <dt className="font-semibold text-gray-900">= Margen de la campaña</dt>
                <dd className={`tabular-nums font-semibold ${f.margen >= 0 ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>{euros(f.margen)}</dd>
              </div>
            </dl>
          </div>
        </Seccion>
      </div>

      <Seccion titulo="Semana a semana">
        <div className={`${TARJETA} p-4 sm:p-5`}>
          <GraficoSemanas semanas={c.semanas} />
        </div>
      </Seccion>

      {/* Los números apuntados. */}
      <Seccion
        titulo="Números apuntados"
        extra={
          <button onClick={() => setFormDato({ periodo: 'dia', fecha: hoy() })} className={BOTON_PRINCIPAL}>
            <Plus size={14} /> Apuntar
          </button>
        }
      >
        {formDato ? (
          <FormDato
            inicial={formDato}
            onCancelar={() => setFormDato(null)}
            onGuardar={async (datos) => {
              const r = await guardarDato(orgId, c.id, datos, token, formDato.id)
              if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
              toast.success('Apuntado')
              setFormDato(null)
              onCambio()
              cargar()
            }}
          />
        ) : null}
        {c.datos.length ? (
          <div className={`${TARJETA} overflow-x-auto`}>
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-[#9CA3AF] border-b border-[#F3F4F6]">
                  <th className="font-semibold py-2 pl-4 pr-3">Fecha</th>
                  <th className="font-semibold py-2 pr-3 text-right">Anuncios</th>
                  <th className="font-semibold py-2 pr-3 text-right">Impr.</th>
                  <th className="font-semibold py-2 pr-3 text-right">Clics</th>
                  <th className="font-semibold py-2 pr-3 text-right">Leads</th>
                  <th className="font-semibold py-2 pr-3 text-right">Agend.</th>
                  <th className="font-semibold py-2 pr-3 text-right">Present.</th>
                  <th className="font-semibold py-2 pr-3 text-right">Otros gastos</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {c.datos.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 pl-4 pr-3">
                      <p className="text-gray-900 font-medium">
                        {d.periodo === 'semana' ? `Semana del ${fechaCorta(d.fecha)}` : fechaCorta(d.fecha)}
                      </p>
                      {d.nota ? <p className="text-[12px] text-[#9CA3AF] truncate max-w-[220px]">{d.nota}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.gasto_cents ? euros(d.gasto_cents, true) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.impresiones || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.clics || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.leads ?? <span className="text-[#D1D5DB]">escuela</span>}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.agendadas ?? <span className="text-[#D1D5DB]">escuela</span>}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{d.presentadas ?? <span className="text-[#D1D5DB]">escuela</span>}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {d.otros_gastos_cents ? (
                        <span title={d.otros_concepto}>
                          {euros(d.otros_gastos_cents, true)}
                          {d.otros_concepto ? <span className="block text-[11.5px] text-[#9CA3AF] truncate max-w-[140px]">{d.otros_concepto}</span> : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setFormDato(d)} className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Cambiar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => quitarDato(d)} className="p-1.5 rounded-md text-[#6B7280] hover:text-red-600 hover:bg-red-50" aria-label="Borrar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !formDato ? (
          <p className={META}>
            Apunta lo que da Meta (gasto, impresiones, clics) por día o por semana. Leads, llamadas y ventas los pone la escuela sola si dejas esos
            campos vacíos.
          </p>
        ) : null}
      </Seccion>

      {/* Ventas y pagos. */}
      <Seccion
        titulo="Ventas"
        extra={
          <button onClick={() => setFormPago({ fecha: hoy(), metodo: 'unico', con_llamada: true })} className={BOTON}>
            <Plus size={14} /> Apuntar un pago
          </button>
        }
      >
        {formPago ? (
          <FormPago
            inicial={formPago}
            onCancelar={() => setFormPago(null)}
            onGuardar={async (datos) => {
              const r = await guardarPago(orgId, c.id, datos, token, formPago.id)
              if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
              toast.success('Pago apuntado')
              setFormPago(null)
              onCambio()
              cargar()
            }}
          />
        ) : null}
        {c.ventas_detalle.length ? (
          <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
            {c.ventas_detalle.map((v, i) => {
              const apuntado = c.pagos.find((p) => p.email && p.email === v.email) ?? (v.origen === 'a-mano' ? c.pagos.find((p) => !p.email && p.importe_cents === v.importe_cents && p.fecha === v.fecha) : undefined)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-gray-900 truncate">{apuntado?.alumno || v.email || 'Venta'}</p>
                    <p className={`${META} truncate`}>
                      {fechaCorta(v.fecha)} · {METODOS.find((x) => x.id === v.metodo)?.nombre ?? v.metodo}
                      {v.con_llamada ? ' · con llamada' : ' · sin llamada'} · {ORIGEN[v.origen] ?? v.origen}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold text-gray-900">{euros(v.importe_cents)}</span>
                  {apuntado ? (
                    <div className="flex gap-1">
                      <button onClick={() => setFormPago(apuntado)} className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Cambiar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => quitarPago(apuntado)} className="p-1.5 rounded-md text-[#6B7280] hover:text-red-600 hover:bg-red-50" aria-label="Borrar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setFormPago({ email: v.email, importe_cents: v.importe_cents, fecha: v.fecha, metodo: v.metodo, con_llamada: v.con_llamada })}
                      className="text-[12px] text-[#025dc7] hover:underline shrink-0"
                      title="Para decir que fue con Klarna o sin llamada"
                    >
                      Completar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : !formPago ? (
          <p className={META}>
            Sin ventas todavía. Las matrículas pagadas de quien llegó por este utm salen solas; un pago que no pasó por la escuela se apunta
            aquí.
          </p>
        ) : null}
        <p className={META}>
          «Completar» en una venta de la escuela sirve para decir que fue con Klarna o sin llamada: no la cuenta dos veces.
        </p>
      </Seccion>
    </div>
  )
}

function FormDato({ inicial, onGuardar, onCancelar }: { inicial: Partial<Dato>; onGuardar: (d: Partial<Dato>) => void; onCancelar: () => void }) {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  const [f, setF] = useState({
    periodo: (inicial.periodo ?? 'dia') as 'dia' | 'semana',
    fecha: inicial.fecha ?? hoy(),
    gasto: deCents(inicial.gasto_cents || null),
    impresiones: num(inicial.impresiones || null),
    clics: num(inicial.clics || null),
    leads: num(inicial.leads),
    agendadas: num(inicial.agendadas),
    presentadas: num(inicial.presentadas),
    ventas: num(inicial.ventas),
    ingresos: deCents(inicial.ingresos_cents ?? null),
    devoluciones: deCents(inicial.devoluciones_cents || null),
    otros: deCents(inicial.otros_gastos_cents || null),
    otros_concepto: inicial.otros_concepto ?? '',
    otros_categoria: inicial.otros_categoria ?? 'otros',
    nota: inicial.nota ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const poner = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }))
  const entero = (t: string) => (t.trim() === '' ? null : Math.max(0, Math.round(Number(t.replace(/\./g, '').replace(',', '.')) || 0)))

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setGuardando(true)
        await onGuardar({
          periodo: f.periodo,
          fecha: f.fecha,
          gasto_cents: aCents(f.gasto) ?? 0,
          impresiones: entero(f.impresiones) ?? 0,
          clics: entero(f.clics) ?? 0,
          leads: entero(f.leads),
          agendadas: entero(f.agendadas),
          presentadas: entero(f.presentadas),
          ventas: entero(f.ventas),
          ingresos_cents: aCents(f.ingresos),
          devoluciones_cents: aCents(f.devoluciones) ?? 0,
          otros_gastos_cents: aCents(f.otros) ?? 0,
          otros_concepto: f.otros_concepto,
          otros_categoria: f.otros_categoria,
          nota: f.nota,
        })
        setGuardando(false)
      }}
      className={`${TARJETA} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setF((v) => ({ ...v, periodo: 'dia' }))} className={filtro(f.periodo === 'dia')}>
            Un día
          </button>
          <button type="button" onClick={() => setF((v) => ({ ...v, periodo: 'semana' }))} className={filtro(f.periodo === 'semana')}>
            Una semana
          </button>
        </div>
        <label className="block w-[170px]">
          <span className={ROTULO}>{f.periodo === 'semana' ? 'Un día de esa semana' : 'Día'}</span>
          <input type="date" required value={f.fecha} onChange={poner('fecha')} className={CAMPO} />
        </label>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-gray-900 mb-2">Del anuncio (Meta, Google…)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label>
            <span className={ROTULO}>Gasto en anuncios (€)</span>
            <input inputMode="decimal" value={f.gasto} onChange={poner('gasto')} placeholder="0" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Impresiones</span>
            <input inputMode="numeric" value={f.impresiones} onChange={poner('impresiones')} placeholder="0" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Clics</span>
            <input inputMode="numeric" value={f.clics} onChange={poner('clics')} placeholder="0" className={CAMPO} />
          </label>
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-gray-900">Personas y ventas</p>
        <p className={`${META} mb-2`}>Vacío = lo pone la escuela. Escribe un número solo si quieres corregirla (manda lo tuyo).</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label>
            <span className={ROTULO}>Leads</span>
            <input inputMode="numeric" value={f.leads} onChange={poner('leads')} placeholder="escuela" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Agendadas</span>
            <input inputMode="numeric" value={f.agendadas} onChange={poner('agendadas')} placeholder="escuela" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Se presentaron</span>
            <input inputMode="numeric" value={f.presentadas} onChange={poner('presentadas')} placeholder="escuela" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Ventas</span>
            <input inputMode="numeric" value={f.ventas} onChange={poner('ventas')} placeholder="escuela" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Cobrado (€)</span>
            <input inputMode="decimal" value={f.ingresos} onChange={poner('ingresos')} placeholder="escuela" className={CAMPO} />
          </label>
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-gray-900 mb-2">Otros gastos y devoluciones</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label>
            <span className={ROTULO}>Otros gastos (€)</span>
            <input inputMode="decimal" value={f.otros} onChange={poner('otros')} placeholder="0" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Qué es</span>
            <input value={f.otros_concepto} onChange={poner('otros_concepto')} placeholder="Clase gratis, vídeo UGC…" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Categoría (para Gastos)</span>
            <select value={f.otros_categoria} onChange={poner('otros_categoria')} className={CAMPO}>
              {CATEGORIAS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={ROTULO}>Devoluciones (€)</span>
            <input inputMode="decimal" value={f.devoluciones} onChange={poner('devoluciones')} placeholder="0" className={CAMPO} />
          </label>
        </div>
      </div>

      <label className="block">
        <span className={ROTULO}>Nota</span>
        <input value={f.nota} onChange={poner('nota')} placeholder="Cambié el creativo, subí presupuesto…" className={CAMPO} />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
        </button>
        <button type="button" onClick={onCancelar} className={BOTON}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function FormPago({ inicial, onGuardar, onCancelar }: { inicial: Partial<Pago>; onGuardar: (p: Partial<Pago>) => void; onCancelar: () => void }) {
  const [f, setF] = useState({
    alumno: inicial.alumno ?? '',
    email: inicial.email ?? '',
    importe: deCents(inicial.importe_cents ?? null),
    metodo: (inicial.metodo ?? 'unico') as Metodo,
    fecha: inicial.fecha ?? hoy(),
    con_llamada: inicial.con_llamada ?? true,
    nota: inicial.nota ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const poner = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }))

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const importe = aCents(f.importe)
        if (!importe || importe <= 0) return toast.error('Pon el importe')
        setGuardando(true)
        await onGuardar({ alumno: f.alumno, email: f.email, importe_cents: importe, metodo: f.metodo, fecha: f.fecha, con_llamada: f.con_llamada, nota: f.nota })
        setGuardando(false)
      }}
      className={`${TARJETA} p-4 sm:p-5 space-y-3`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label>
          <span className={ROTULO}>Alumno</span>
          <input value={f.alumno} onChange={poner('alumno')} placeholder="Nombre" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Correo</span>
          <input type="email" value={f.email} onChange={poner('email')} placeholder="Para no contarla dos veces" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Importe (€)</span>
          <input inputMode="decimal" required value={f.importe} onChange={poner('importe')} placeholder="435" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Cómo pagó</span>
          <select value={f.metodo} onChange={poner('metodo')} className={CAMPO}>
            {METODOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={ROTULO}>Fecha</span>
          <input type="date" required value={f.fecha} onChange={poner('fecha')} className={CAMPO} />
        </label>
        <label className="flex items-center gap-2 pt-5 text-[13px] text-gray-800">
          <input type="checkbox" checked={f.con_llamada} onChange={(e) => setF((v) => ({ ...v, con_llamada: e.target.checked }))} />
          Pasó por llamada (lleva comisión del closer)
        </label>
      </div>
      <label className="block">
        <span className={ROTULO}>Nota</span>
        <input value={f.nota} onChange={poner('nota')} className={CAMPO} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
        </button>
        <button type="button" onClick={onCancelar} className={BOTON}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
