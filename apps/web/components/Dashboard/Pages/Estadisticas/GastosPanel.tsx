'use client'

/**
 * Gastos: cuadro de mando, NO contabilidad. Se apuntan importes (profes,
 * publicidad, herramientas) para cruzarlos con lo que han pagado los alumnos y
 * ver lo que ningún programa de contabilidad cruza: coste por matrícula,
 * margen y coste por alumno. Las facturas de verdad van al programa del
 * gestor (Moneybird / Holded). Solo administradores.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { borrarFijo, borrarGasto, cambiarFijo, crearFijo, deleteManualEntry, euros, getGastos, guardarGasto, type Gasto, type GastoFijo, type PanelGastos } from '@services/stats/school'
import { hoyISO } from '@services/stats/contactos'
import { Loader2, Plus, Repeat, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const LABEL = 'text-[10px] sm:text-[11px] font-semibold text-[#8A96AB] uppercase tracking-[0.08em]'
const INPUT =
  'w-full bg-[#F0F5FF] rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] border border-transparent outline-none focus:bg-white focus:border-[#4da3ff]'

function Cifra({ label, valor, nota, color = 'text-[#1D0084]' }: { label: string; valor: string; nota?: string; color?: string }) {
  return (
    <div className={CARD}>
      <p className={LABEL}>{label}</p>
      <p className={`text-[22px] sm:text-[26px] font-semibold tabular-nums leading-tight mt-1 ${color}`}>{valor}</p>
      {nota ? <p className="text-[11.5px] text-gray-500 mt-0.5 leading-snug">{nota}</p> : null}
    </div>
  )
}

const MES_ACTUAL = () => new Date().toISOString().slice(0, 7)

function mesLargo(mes: string) {
  if (!mes) return ''
  const d = new Date(`${mes}-01T12:00:00`)
  return Number.isNaN(d.getTime()) ? mes : d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

/**
 * Gastos que se repiten cada mes (herramientas, cuotas, un profe fijo). Se
 * apuntan una vez y cuentan solos en cada mes; "Dar de baja" los para desde
 * este mes sin borrar lo que costaron antes.
 */
function GastosFijos({ datos, orgId, accessToken, onCambio }: { datos: PanelGastos; orgId: number; accessToken: string; onCambio: () => void }) {
  const [form, setForm] = useState({ concepto: '', categoria: 'herramientas', importe: '', desde: MES_ACTUAL() })
  const [guardando, setGuardando] = useState(false)
  const cat = datos.categorias

  async function anadir() {
    const importe = Number(String(form.importe).replace(',', '.'))
    if (!form.concepto.trim() || !(importe > 0)) {
      toast.error('Pon qué es y cuánto cuesta al mes')
      return
    }
    setGuardando(true)
    const r = await crearFijo(orgId, { ...form, importe }, accessToken)
    setGuardando(false)
    if (!r.ok) return toast.error(r.error || 'No se ha podido guardar')
    setForm({ concepto: '', categoria: form.categoria, importe: '', desde: MES_ACTUAL() })
    toast.success('Gasto fijo apuntado')
    onCambio()
  }
  async function baja(f: GastoFijo) {
    if (!(await confirmar(`¿Dar de baja «${f.concepto}»? Deja de contar a partir del mes que viene; lo de antes se queda.`, { boton: 'Dar de baja', peligro: false }))) return
    const r = await cambiarFijo(orgId, f.id, { hasta: MES_ACTUAL() }, accessToken)
    if (!r.ok) return toast.error(r.error || 'No se ha podido cambiar')
    onCambio()
  }
  async function reactivar(f: GastoFijo) {
    const r = await cambiarFijo(orgId, f.id, { hasta: '' }, accessToken)
    if (!r.ok) return toast.error(r.error || 'No se ha podido cambiar')
    onCambio()
  }
  async function quitar(f: GastoFijo) {
    if (!(await confirmar(`¿Borrar «${f.concepto}» del todo? También desaparece de los meses pasados. Si solo ya no lo pagas, mejor «Dar de baja».`))) return
    const r = await borrarFijo(orgId, f.id, accessToken)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    onCambio()
  }

  const activos = datos.fijos.filter((f) => f.activo)
  const inactivos = datos.fijos.filter((f) => !f.activo)

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
          <Repeat size={15} className="text-[#025dc7]" /> Gastos fijos mensuales
        </p>
        <p className="text-[13px] text-[#5A6480]">
          Ahora: <strong className="text-[#1D0084] tabular-nums">{euros(datos.fijos_al_mes_cents)}</strong> al mes
        </p>
      </div>
      <p className="text-[12.5px] text-[#5A6480] mb-3">Se apuntan una vez y cuentan solos cada mes: herramientas, cuotas, un profe con sueldo fijo.</p>
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_150px_120px_140px_auto] gap-2">
        <input
          value={form.concepto}
          onChange={(e) => setForm({ ...form, concepto: e.target.value })}
          placeholder="Qué es: «Calendly», «Zoom», «Profe clase semanal»"
          className={`${INPUT} col-span-2 sm:col-span-1`}
        />
        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={INPUT}>
          {Object.entries(cat).map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <input value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} inputMode="decimal" placeholder="€ al mes" className={INPUT} />
        <input type="month" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} className={INPUT} aria-label="Desde" />
        <button
          onClick={anadir}
          disabled={guardando}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[13px] font-bold disabled:opacity-50"
        >
          <Plus size={14} /> Añadir
        </button>
      </div>
      {datos.fijos.length ? (
        <ul className="mt-3 divide-y divide-[#EEF2F9]">
          {[...activos, ...inactivos].map((f) => (
            <li key={f.id} className={`py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${f.activo ? '' : 'opacity-55'}`}>
              <span className="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EAF3FF] text-[#025dc7]">{cat[f.categoria] || f.categoria}</span>
              <span className="flex-1 min-w-0 text-[13px] text-gray-800 truncate">{f.concepto}</span>
              <span className="text-[12px] text-[#8A96AB]">
                {f.activo ? `desde ${mesLargo(f.desde)}` : f.hasta ? `hasta ${mesLargo(f.hasta)}` : `empieza ${mesLargo(f.desde)}`}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-gray-900">{euros(f.importe_cents)}/mes</span>
              {f.activo ? (
                <button onClick={() => baja(f)} className="text-[12px] font-semibold text-[#5A6480] hover:text-gray-900">
                  Dar de baja
                </button>
              ) : f.hasta ? (
                <button onClick={() => reactivar(f)} className="text-[12px] font-semibold text-[#025dc7] hover:underline">
                  Reactivar
                </button>
              ) : null}
              <button onClick={() => quitar(f)} aria-label="Borrar gasto fijo" className="text-gray-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Ingresos contra gastos, mes a mes: dos barras por mes, la escala la marca el mayor. */
function IngresosVsGastos({ datos }: { datos: PanelGastos }) {
  const meses = [...datos.meses].slice(0, 12).reverse()
  if (!meses.length) return null
  const max = Math.max(1, ...meses.map((m) => Math.max(m.ingresos_cents, m.gastos_cents)))
  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[14px] font-bold text-gray-900">Ingresos y gastos por mes</p>
        <div className="flex items-center gap-3 text-[11.5px] text-[#5A6480]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-[#0E9F6E]" /> Ingresos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-[#E5484D]" /> Gastos
          </span>
        </div>
      </div>
      <div className="space-y-2.5">
        {meses.map((m) => (
          <div key={m.mes} className="grid grid-cols-[112px_minmax(0,1fr)_92px] items-center gap-3">
            <span className="text-[12px] text-[#5A6480] capitalize truncate">{m.label}</span>
            <div className="space-y-1">
              <div className="h-2.5 rounded-full bg-[#0E9F6E]" style={{ width: `${Math.max(m.ingresos_cents ? 1.5 : 0, (m.ingresos_cents / max) * 100)}%` }} />
              <div className="h-2.5 rounded-full bg-[#E5484D]" style={{ width: `${Math.max(m.gastos_cents ? 1.5 : 0, (m.gastos_cents / max) * 100)}%` }} />
            </div>
            <span className={`text-right text-[12.5px] font-semibold tabular-nums ${m.margen_cents < 0 ? 'text-red-600' : 'text-[#0E9F6E]'}`}>
              {m.margen_cents >= 0 ? '+' : ''}
              {euros(m.margen_cents)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GastosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [datos, setDatos] = useState<PanelGastos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState({ fecha: hoyISO(), categoria: 'profes', concepto: '', importe: '', nota: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setDatos(await getGastos(org.id, accessToken))
    setCargando(false)
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function anadir() {
    const importe = Number(String(form.importe).replace(',', '.'))
    if (!form.fecha || !(importe > 0)) {
      toast.error('Pon la fecha y un importe mayor que cero')
      return
    }
    setGuardando(true)
    const r = await guardarGasto(org?.id, { ...form, importe }, accessToken)
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    setForm((f) => ({ ...f, concepto: '', importe: '', nota: '' }))
    toast.success('Gasto apuntado')
    cargar()
  }

  async function quitar(g: Gasto) {
    if (!(await confirmar('¿Borrar este gasto?'))) return
    const ok = g.antiguo_id
      ? await deleteManualEntry(org?.id, g.antiguo_id, accessToken)
      : await borrarGasto(org?.id, g.id as number, accessToken)
    if (!ok) {
      toast.error('No se ha podido borrar')
      return
    }
    cargar()
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }
  if (!datos) {
    return (
      <div className={CARD}>
        <p className="text-[14px] text-gray-600">No se han podido cargar los gastos. Prueba a actualizar.</p>
      </div>
    )
  }

  const t = datos.total
  const cat = datos.categorias

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[#5A6480] leading-relaxed max-w-3xl">
        Apunta aquí lo que gastas (profes, publicidad, herramientas) para ver cómo va el negocio. Los ingresos salen solos
        de lo que han pagado los alumnos. <strong className="text-gray-800">No es la contabilidad</strong>: las facturas
        siguen yendo al programa de tu gestor.
      </p>

      {/* Las cuatro cifras que deciden algo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Cifra label="Ingresos" valor={euros(t.ingresos_cents)} nota={`${t.ventas} ${t.ventas === 1 ? 'venta' : 'ventas'}`} />
        <Cifra label="Gastos" valor={euros(t.gastos_cents)} nota="Todo lo apuntado" />
        <Cifra
          label="Margen"
          valor={euros(t.margen_cents)}
          nota={t.margen_pct !== null ? `${t.margen_pct}% de lo ingresado` : 'Sin ingresos todavía'}
          color={t.margen_cents < 0 ? 'text-red-600' : 'text-[#0E9F6E]'}
        />
        <Cifra
          label="Coste por matrícula"
          valor={t.coste_por_matricula_cents !== null ? euros(t.coste_por_matricula_cents) : '—'}
          nota="Publicidad entre ventas: lo que cuesta traer a un alumno"
        />
      </div>

      <IngresosVsGastos datos={datos} />

      <GastosFijos datos={datos} orgId={org?.id} accessToken={accessToken} onCambio={cargar} />

      {/* Apuntar un gasto */}
      <div className={CARD}>
        <p className="text-[14px] font-bold text-gray-900 mb-3">Apuntar un gasto suelto</p>
        <div className="grid grid-cols-2 sm:grid-cols-[130px_150px_minmax(0,1fr)_120px] gap-2">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={INPUT} />
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={INPUT}>
            {Object.entries(cat).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
          <input
            value={form.concepto}
            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            placeholder="Concepto: «Clases de Laura, septiembre»"
            className={`${INPUT} col-span-2 sm:col-span-1`}
          />
          <input
            value={form.importe}
            onChange={(e) => setForm({ ...form, importe: e.target.value })}
            inputMode="decimal"
            placeholder="Importe €"
            className={INPUT}
          />
        </div>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="Nota (opcional)"
            className={`${INPUT} flex-1`}
          />
          <button
            onClick={anadir}
            disabled={guardando}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[13px] font-bold disabled:opacity-50"
          >
            <Plus size={14} /> Apuntar
          </button>
        </div>
      </div>

      {/* Mes a mes */}
      <div className={CARD}>
        <p className="text-[14px] font-bold text-gray-900 mb-3">Mes a mes</p>
        {datos.meses.length === 0 ? (
          <p className="text-[13px] text-gray-500">Aún no hay ventas ni gastos apuntados.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[#8A96AB]">
                  <th className="py-2 px-1 font-semibold">Mes</th>
                  <th className="py-2 px-1 font-semibold text-right">Ventas</th>
                  <th className="py-2 px-1 font-semibold text-right">Ingresos</th>
                  <th className="py-2 px-1 font-semibold text-right">Gastos</th>
                  <th className="py-2 px-1 font-semibold text-right">Margen</th>
                  <th className="py-2 px-1 font-semibold text-right">Coste/matrícula</th>
                  <th className="py-2 px-1 font-semibold text-right">Coste/alumno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F9]">
                {datos.meses.map((m) => (
                  <tr key={m.mes}>
                    <td className="py-2.5 px-1 font-semibold text-gray-900 capitalize">{m.label}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{m.ventas}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{euros(m.ingresos_cents)}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums" title={Object.entries(m.por_categoria).filter(([, v]) => v).map(([k, v]) => `${cat[k] || k}: ${euros(v)}`).join(' · ')}>
                      {euros(m.gastos_cents)}
                    </td>
                    <td className={`py-2.5 px-1 text-right tabular-nums font-semibold ${m.margen_cents < 0 ? 'text-red-600' : 'text-[#0E9F6E]'}`}>
                      {euros(m.margen_cents)}
                    </td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{m.coste_por_matricula_cents !== null ? euros(m.coste_por_matricula_cents) : '—'}</td>
                    <td className="py-2.5 px-1 text-right tabular-nums">{m.coste_por_alumno_cents !== null ? euros(m.coste_por_alumno_cents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-[#9CA3AF] leading-relaxed">
          Coste por matrícula = publicidad del mes entre las ventas del mes. Coste por alumno = todo el gasto del mes entre
          los {datos.alumnos} alumnos que hay ahora.
          {datos.desde ? ` Las ventas cuentan desde el ${datos.desde} (antes eran pruebas).` : ''} Pasa el ratón por
          encima de un gasto para ver el reparto por categoría.
        </p>
      </div>

      {/* Lo apuntado */}
      <div className={CARD}>
        <p className="text-[14px] font-bold text-gray-900 mb-3">Lo apuntado</p>
        {datos.gastos.length === 0 ? (
          <p className="text-[13px] text-gray-500">Todavía no has apuntado ningún gasto.</p>
        ) : (
          <ul className="divide-y divide-[#EEF2F9]">
            {datos.gastos.map((g) => (
              <li key={g.id ?? (g.anuncio_id ? `anuncio-${g.anuncio_id}` : `antiguo-${g.antiguo_id}`)} className="py-2.5 flex items-center gap-3">
                <span className="text-[12px] text-gray-500 tabular-nums w-[82px] shrink-0">{g.fecha}</span>
                <span className="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EAF3FF] text-[#025dc7]">
                  {cat[g.categoria] || g.categoria}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-gray-800 truncate" title={g.nota || undefined}>
                  {g.concepto || <span className="text-gray-400">Sin concepto</span>}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-gray-900">{euros(g.importe_cents)}</span>
                {g.anuncio_id ? (
                  <a href="/dash/estadisticas?tab=anuncios" className="text-[12px] font-semibold text-[#025dc7] hover:underline">
                    Anuncios
                  </a>
                ) : (
                  <button onClick={() => quitar(g)} aria-label="Borrar gasto" className="text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
