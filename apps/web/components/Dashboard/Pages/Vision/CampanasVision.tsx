'use client'

/**
 * El cuadro de mando de Visión: el negocio entero arriba, el gráfico de las
 * semanas y la tabla de campañas con su semáforo. Clic en una campaña =
 * su detalle (CampanaDetalle), donde se apuntan los números.
 */

import React from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { COLOR_SEMAFORO, ESTADO, euros, valorDe, type Campana, type Semaforo, type Tablero } from '@services/vision/vision'
import { META, TARJETA, Estado, Seccion } from '../Panel/ui'
import { Cifra, GraficoSemanas, pct } from './piezas'

function Punto({ s }: { s?: Semaforo }) {
  return s ? <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: COLOR_SEMAFORO[s] }} /> : null
}

const COLUMNAS: { clave: string; nombre: string; titulo?: string }[] = [
  { clave: 'coste_cents', nombre: 'Coste', titulo: 'Anuncios + otros gastos de la campaña' },
  { clave: 'leads', nombre: 'Leads' },
  { clave: 'coste_lead', nombre: '€/lead' },
  { clave: 'agendadas', nombre: 'Agend.' },
  { clave: 'asistencia', nombre: 'Asist.' },
  { clave: 'cierre', nombre: 'Cierre' },
  { clave: 'ventas', nombre: 'Ventas' },
  { clave: 'ingresos_cents', nombre: 'Cobrado' },
  { clave: 'cac', nombre: 'CAC' },
  { clave: 'roas', nombre: 'ROAS' },
  { clave: 'margen', nombre: 'Margen' },
]

const TONO_ESTADO = { gris: 'gris', azul: 'azul', verde: 'verde', rojo: 'rojo', ambar: 'ambar' } as const

export default function CampanasVision({
  tablero,
  onAbrir,
  onIrAlMapa,
}: {
  tablero: Tablero
  onAbrir: (id: number) => void
  onIrAlMapa: () => void
}) {
  const { negocio, campanas, metricas } = tablero
  const avisos = [...(tablero.avisos ?? []), ...(negocio?.avisos ?? [])]
  const v = (c: Campana, clave: string) => valorDe(clave, c.cifras, metricas)

  return (
    <div className="space-y-6">
      {/* El negocio entero. */}
      <Seccion titulo="El negocio, en total" extra={<span className={META}>Desde el inicio de la convocatoria</span>}>
        <div className={`${TARJETA} p-4 sm:p-5 space-y-5`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
            <Cifra
              rotulo="Resultado"
              valor={euros(negocio.resultado_cents)}
              semaforo={negocio.resultado_cents >= 0 ? 'verde' : 'rojo'}
              pie={negocio.margen_pct !== null ? `${pct(negocio.margen_pct)} de lo cobrado` : undefined}
              fuerte
            />
            <Cifra rotulo="Cobrado" valor={euros(negocio.ingresos_cents)} pie={`${negocio.ventas} ${negocio.ventas === 1 ? 'venta' : 'ventas'}`} fuerte />
            <Cifra rotulo="Ingreso neto" valor={euros(negocio.ingreso_neto_cents)} pie="Tras devoluciones, Klarna y closer" fuerte />
            <Cifra
              rotulo="Coste por alumno"
              valor={euros(negocio.coste_por_alumno_cents)}
              pie="Gastos + profe ÷ ventas"
              fuerte
            />
          </div>
          <div className="border-t border-[#F3F4F6] pt-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-2">Cómo se llega al resultado</p>
            <dl className="grid sm:grid-cols-2 gap-x-10 text-[13.5px]">
              {[
                ['Cobrado', negocio.ingresos_cents, ''],
                ['− Devoluciones', -negocio.devoluciones_cents, ''],
                ['− Comisión de Klarna', -negocio.klarna_cents, ''],
                ['− Comisión del closer', -negocio.closer_cents, ''],
                [
                  '− Profe de la clase semanal',
                  -negocio.profe_cents,
                  negocio.profe_semanas ? `${negocio.profe_semanas} semanas` : 'pon desde cuándo en Ajustes',
                ],
                ['− Gastos (pantalla Gastos)', -negocio.gastos_cents, 'anuncios y gastos de campañas incluidos'],
              ].map(([nombre, cents, nota]) => (
                <div key={String(nombre)} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F9FAFB]">
                  <dt className="text-[#4B5563]">
                    {nombre}
                    {nota ? <span className="text-[#9CA3AF] text-[12px]"> · {nota}</span> : null}
                  </dt>
                  <dd className="tabular-nums font-medium text-gray-900 whitespace-nowrap">{euros(Number(cents) || 0)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 py-1.5 sm:col-span-2">
                <dt className="font-semibold text-gray-900">= Resultado</dt>
                <dd className={`tabular-nums font-semibold ${negocio.resultado_cents >= 0 ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>
                  {euros(negocio.resultado_cents)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Seccion>

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

      <Seccion titulo="Semana a semana" extra={<span className={META}>Todas las campañas juntas</span>}>
        <div className={`${TARJETA} p-4 sm:p-5`}>
          <GraficoSemanas semanas={tablero.semanas} />
        </div>
      </Seccion>

      <Seccion titulo="Campañas" extra={<span className={META}>{campanas.length ? 'Clic en una para ver y apuntar sus datos' : ''}</span>}>
        {!campanas.length ? (
          <div className={`${TARJETA} p-6 text-center space-y-2`}>
            <p className="text-[14px] font-semibold text-gray-900">Aún no hay campañas</p>
            <p className={META}>
              En el mapa, «Añadir» → «Campaña» (por ejemplo dentro de la vertical Campañas). Ponle el mismo utm_campaign que lleva el
              enlace del anuncio y la escuela pondrá sola los leads, las llamadas y las ventas.
            </p>
            <button onClick={onIrAlMapa} className="text-[13px] font-medium text-[#025dc7] hover:underline">
              Ir al mapa
            </button>
          </div>
        ) : (
          <>
            {/* Ordenador: tabla. */}
            <div className={`${TARJETA} hidden md:block overflow-x-auto`}>
              <table className="w-full text-[13px] min-w-[980px]">
                <thead>
                  <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-[#9CA3AF] border-b border-[#F3F4F6]">
                    <th className="font-semibold py-2.5 pl-4 pr-3">Campaña</th>
                    {COLUMNAS.map((c) => (
                      <th key={c.clave} title={c.titulo} className="font-semibold py-2.5 pr-3 text-right whitespace-nowrap">
                        {c.nombre}
                      </th>
                    ))}
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {campanas.map((c) => {
                    const e = ESTADO[c.estado] ?? ESTADO.pendiente
                    return (
                      <tr key={c.id} onClick={() => onAbrir(c.id)} className="cursor-pointer hover:bg-[#F9FAFB]">
                        <td className="py-3 pl-4 pr-3 max-w-[260px]">
                          <p className="font-semibold text-gray-900 truncate">
                            {c.titulo}
                            {c.urgente ? <span className="ml-2 text-[10.5px] font-bold uppercase text-[#DC2626]">Urgente</span> : null}
                          </p>
                          <p className="text-[12px] text-[#9CA3AF] truncate">
                            <Estado tono={TONO_ESTADO[e.tono]} className="!text-[12px] !text-[#9CA3AF]">
                              {e.nombre}
                            </Estado>
                            {c.utm_campaign ? ` · ${c.utm_campaign}` : ' · sin utm'}
                          </p>
                        </td>
                        {COLUMNAS.map((col) => (
                          <td key={col.clave} className="py-3 pr-3 text-right tabular-nums whitespace-nowrap text-gray-900">
                            <Punto s={c.semaforo[col.clave]} />
                            {col.clave === 'agendadas' || col.clave === 'leads' || col.clave === 'ventas'
                              ? (c.cifras as any)[col.clave]
                              : v(c, col.clave)}
                          </td>
                        ))}
                        <td className="pr-3 text-[#D1D5DB]">
                          <ChevronRight size={15} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas. */}
            <div className="md:hidden space-y-2">
              {campanas.map((c) => (
                <button key={c.id} onClick={() => onAbrir(c.id)} className={`${TARJETA} w-full text-left p-3.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[14px] text-gray-900 truncate">{c.titulo}</p>
                    <ChevronRight size={15} className="text-[#D1D5DB] shrink-0" />
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] truncate">{c.utm_campaign || 'sin utm'}</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2">
                    <Cifra rotulo="Leads" valor={String(c.cifras.leads)} />
                    <Cifra rotulo="Ventas" valor={String(c.cifras.ventas)} />
                    <Cifra rotulo="Coste" valor={v(c, 'coste_cents')} />
                    <Cifra rotulo="CAC" valor={v(c, 'cac')} semaforo={c.semaforo.cac} />
                    <Cifra rotulo="ROAS" valor={v(c, 'roas')} semaforo={c.semaforo.roas} />
                    <Cifra rotulo="Margen" valor={v(c, 'margen')} semaforo={c.semaforo.margen} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Seccion>
    </div>
  )
}
