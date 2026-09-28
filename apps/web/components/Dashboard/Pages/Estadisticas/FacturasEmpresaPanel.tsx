'use client'

/**
 * Facturas de la empresa: lo que paga la escuela (profes, software,
 * publicidad, gestoría…), con su PDF o foto, en un solo sitio y repartido por
 * categoría. Es el mismo dato que Gastos: cada factura ES un gasto, así que
 * nada se apunta dos veces. Aquí se ve como lista de papeles; en Gastos, como
 * números del negocio.
 *
 * Programa de facturas simple, NO contabilidad: para el IVA y los libros sigue
 * mandando el gestor. Por eso el botón de bajarlo todo en CSV.
 * Las facturas se guardan en privado (solo administradores): ver
 * `apps/api/src/services/stats/gastos.py` y `routers/local_content.py`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  abrirFactura,
  borrarGasto,
  euros,
  getGastos,
  guardarGasto,
  subirFactura,
  type Gasto,
  type PanelGastos,
} from '@services/stats/school'
import { hoyISO } from '@services/stats/contactos'
import { Download, FileText, Loader2, Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const INPUT =
  'w-full bg-[#F0F5FF] rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff]'
const LABEL = 'block text-[11px] font-semibold text-[#8A96AB] mb-1'

type Periodo = 'mes' | 'anterior' | 'anio' | 'todo'

function enPeriodo(fecha: string, p: Periodo): boolean {
  const hoy = hoyISO()
  if (p === 'todo') return true
  if (p === 'anio') return fecha.slice(0, 4) === hoy.slice(0, 4)
  if (p === 'mes') return fecha.slice(0, 7) === hoy.slice(0, 7)
  const d = new Date(`${hoy.slice(0, 7)}-01T12:00:00`)
  d.setMonth(d.getMonth() - 1)
  return fecha.slice(0, 7) === d.toISOString().slice(0, 7)
}

function csv(filas: Gasto[], cat: Record<string, string>): string {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const cab = ['Fecha', 'Proveedor', 'Concepto', 'Categoría', 'Nº factura', 'Importe (€)', 'Factura adjunta', 'Nota']
  const lineas = filas.map((g) =>
    [
      g.fecha,
      g.proveedor || '',
      g.concepto,
      cat[g.categoria] || g.categoria,
      g.numero || '',
      (g.importe_cents / 100).toFixed(2).replace('.', ','),
      g.tiene_archivo ? 'sí' : 'no',
      g.nota || '',
    ]
      .map(esc)
      .join(';')
  )
  return [cab.map(esc).join(';'), ...lineas].join('\n')
}

function NuevaFactura({ datos, onHecho }: { datos: PanelGastos; onHecho: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const vacio = { fecha: hoyISO(), proveedor: '', concepto: '', categoria: 'profes', importe: '', numero: '', fijo_id: 0 }
  const [f, setF] = useState(vacio)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [encima, setEncima] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function guardar() {
    const importe = Number(String(f.importe).replace(',', '.'))
    if (!f.fecha || !(importe > 0)) {
      toast.error('Pon la fecha y el importe de la factura')
      return
    }
    setGuardando(true)
    const r = await guardarGasto(
      org?.id,
      { fecha: f.fecha, categoria: f.categoria, concepto: f.concepto || f.proveedor, importe, nota: '', proveedor: f.proveedor, numero: f.numero, fijo_id: f.fijo_id },
      accessToken
    )
    if (!r.ok || !r.id) {
      setGuardando(false)
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    if (archivo) {
      const s = await subirFactura(org?.id, r.id, archivo, accessToken)
      if (!s.ok) toast.error(`La factura se apuntó, pero el archivo no se subió: ${s.error}`)
    }
    setGuardando(false)
    setF({ ...vacio, categoria: f.categoria })
    setArchivo(null)
    toast.success('Factura guardada')
    onHecho()
  }

  const fijo = datos.fijos.find((x) => x.id === f.fijo_id)

  return (
    <div className={CARD}>
      <p className="text-[14px] font-bold text-gray-900 mb-3">Añadir una factura</p>
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* El papel: arrastrar o elegir */}
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setEncima(true)
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault()
            setEncima(false)
            const file = e.dataTransfer.files?.[0]
            if (file) setArchivo(file)
          }}
          className={`rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${
            encima ? 'border-[#4da3ff] bg-[#EAF3FF]' : archivo ? 'border-[#0E9F6E] bg-[#E8FBF3]' : 'border-[#C9D6EC] bg-[#F7F9FD] hover:border-[#4da3ff]'
          }`}
        >
          {archivo ? (
            <>
              <FileText size={22} className="mx-auto text-[#0E9F6E]" />
              <p className="mt-1.5 text-[12.5px] font-semibold text-gray-900 break-all">{archivo.name}</p>
              <p className="text-[11px] text-[#5A6480]">Toca para cambiarla</p>
            </>
          ) : (
            <>
              <Upload size={22} className="mx-auto text-[#025dc7]" />
              <p className="mt-1.5 text-[12.5px] font-semibold text-gray-900">Arrastra aquí la factura</p>
              <p className="text-[11px] text-[#5A6480]">o toca para elegirla · PDF o foto</p>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </button>

        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <label>
              <span className={LABEL}>Fecha</span>
              <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={INPUT} />
            </label>
            <label>
              <span className={LABEL}>Quién te la hace</span>
              <input value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} placeholder="Laura, Zoom, Meta…" className={INPUT} />
            </label>
            <label className="col-span-2 sm:col-span-1">
              <span className={LABEL}>Qué es</span>
              <input value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder="Clases de septiembre" className={INPUT} />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_120px_130px_minmax(0,1fr)] gap-2">
            <label>
              <span className={LABEL}>Categoría</span>
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className={INPUT}>
                {Object.entries(datos.categorias).map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={LABEL}>Importe €</span>
              <input value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} inputMode="decimal" placeholder="0,00" className={INPUT} />
            </label>
            <label>
              <span className={LABEL}>Nº de factura</span>
              <input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="Opcional" className={INPUT} />
            </label>
            <label className="col-span-2 sm:col-span-1">
              <span className={LABEL}>¿Es de un gasto fijo?</span>
              <select
                value={f.fijo_id}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  const fx = datos.fijos.find((x) => x.id === id)
                  setF({
                    ...f,
                    fijo_id: id,
                    ...(fx
                      ? { categoria: fx.categoria, proveedor: f.proveedor || fx.concepto, importe: f.importe || String(fx.importe_cents / 100).replace('.', ',') }
                      : {}),
                  })
                }}
                className={INPUT}
              >
                <option value={0}>No, es un gasto suelto</option>
                {datos.fijos.map((x) => (
                  <option key={x.id} value={x.id}>
                    Sí: {x.concepto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-[11.5px] text-[#8A96AB]">
              {fijo
                ? `Es el papel de «${fijo.concepto}»: no se suma otra vez, ese gasto ya cuenta solo cada mes.`
                : 'Cuenta en Gastos como gasto de ese mes.'}
            </p>
            <button
              onClick={guardar}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[13px] font-bold disabled:opacity-50"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Guardar factura
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fila({ g, cat, orgId, accessToken, onCambio }: { g: Gasto; cat: Record<string, string>; orgId: number; accessToken: string; onCambio: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function subir(file: File | null | undefined) {
    if (!file || !g.id) return
    setSubiendo(true)
    const r = await subirFactura(orgId, g.id, file, accessToken)
    setSubiendo(false)
    if (!r.ok) return toast.error(r.error || 'No se ha podido subir')
    toast.success('Factura adjuntada')
    onCambio()
  }
  async function quitar() {
    if (!g.id || !(await confirmar('¿Borrar esta factura? También sale de Gastos.'))) return
    if (!(await borrarGasto(orgId, g.id, accessToken))) return toast.error('No se ha podido borrar')
    onCambio()
  }
  async function ver() {
    if (!g.id) return
    if (!(await abrirFactura(orgId, g.id, accessToken))) toast.error('No se ha podido abrir la factura')
  }

  return (
    <li className="py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1">
      <span className="text-[12px] text-gray-500 tabular-nums w-[78px] shrink-0">{g.fecha}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-900 truncate">{g.proveedor || g.concepto || 'Sin concepto'}</p>
        <p className="text-[11.5px] text-[#5A6480] truncate">
          {[
            g.proveedor && g.concepto ? g.concepto : '',
            g.numero ? `nº ${g.numero}` : '',
            g.fijo_id ? 'factura de un gasto fijo' : '',
            g.anuncio_id ? 'desde Anuncios' : '',
            g.antiguo_id ? 'apuntado antes en Estadísticas' : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span className="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#EAF3FF] text-[#025dc7]">{cat[g.categoria] || g.categoria}</span>
      <span className={`shrink-0 w-[84px] text-right text-[13px] font-semibold tabular-nums ${g.fijo_id ? 'text-[#8A96AB]' : 'text-gray-900'}`}>
        {euros(g.importe_cents)}
      </span>
      <span className="shrink-0 w-[108px] flex justify-end">
        {g.tiene_archivo ? (
          <button onClick={ver} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#025dc7] hover:underline">
            <FileText size={13} /> Ver factura
          </button>
        ) : g.id ? (
          <>
            <button
              onClick={() => input.current?.click()}
              disabled={subiendo}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#8A6A2A] hover:underline disabled:opacity-50"
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} Sin factura
            </button>
            <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          </>
        ) : null}
      </span>
      {g.id ? (
        <button onClick={quitar} aria-label="Borrar factura" className="shrink-0 text-gray-400 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      ) : (
        <span className="w-[14px] shrink-0" />
      )}
    </li>
  )
}

export default function FacturasEmpresaPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<PanelGastos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [categoria, setCategoria] = useState<string>('')
  const [soloSinFactura, setSoloSinFactura] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setDatos(await getGastos(org.id, accessToken))
    setCargando(false)
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const delPeriodo = useMemo(() => (datos?.gastos ?? []).filter((g) => enPeriodo(g.fecha, periodo)), [datos, periodo])
  const porCategoria = useMemo(() => {
    const m: Record<string, number> = {}
    for (const g of delPeriodo) if (!g.fijo_id) m[g.categoria] = (m[g.categoria] ?? 0) + g.importe_cents
    return m
  }, [delPeriodo])
  const visibles = delPeriodo.filter((g) => (!categoria || g.categoria === categoria) && (!soloSinFactura || (g.id && !g.tiene_archivo)))
  const total = Object.values(porCategoria).reduce((a, b) => a + b, 0)
  const sinFactura = delPeriodo.filter((g) => g.id && !g.tiene_archivo).length

  function bajarCsv() {
    if (!datos) return
    const blob = new Blob(['﻿' + csv(visibles, datos.categorias)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `facturas-empresa-${periodo}-${hoyISO()}.csv`
    a.click()
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }
  if (!datos) return <div className={CARD}>No se han podido cargar las facturas. Prueba a actualizar.</div>
  const cat = datos.categorias

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#5A6480] leading-relaxed max-w-3xl">
        Lo que paga la escuela, con su factura. Cada factura cuenta también en Gastos, así que no hay que apuntar nada dos veces.
        Para el IVA y los libros sigue mandando tu gestor: bájale el CSV.
      </p>

      <NuevaFactura datos={datos} onHecho={cargar} />

      {/* Periodo y reparto por categoría */}
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="inline-flex rounded-lg bg-[#F0F5FF] p-1">
            {(
              [
                ['mes', 'Este mes'],
                ['anterior', 'Mes pasado'],
                ['anio', 'Este año'],
                ['todo', 'Todo'],
              ] as const
            ).map(([id, n]) => (
              <button
                key={id}
                onClick={() => setPeriodo(id)}
                className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold ${periodo === id ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480]'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={bajarCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12.5px] font-bold"
          >
            <Download size={14} /> CSV para la gestoría
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setCategoria('')}
            className={`text-left rounded-xl px-3 py-2.5 border ${!categoria ? 'border-[#1D0084] bg-[#F5F3FF]' : 'border-[#E6EBF5] bg-white hover:border-[#4da3ff]'}`}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8A96AB]">Total</p>
            <p className="text-[18px] font-semibold tabular-nums text-[#1D0084]">{euros(total)}</p>
          </button>
          {Object.entries(cat).map(([id, n]) => (
            <button
              key={id}
              onClick={() => setCategoria(categoria === id ? '' : id)}
              className={`text-left rounded-xl px-3 py-2.5 border ${categoria === id ? 'border-[#1D0084] bg-[#F5F3FF]' : 'border-[#E6EBF5] bg-white hover:border-[#4da3ff]'}`}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8A96AB] truncate">{n}</p>
              <p className="text-[18px] font-semibold tabular-nums text-gray-900">{euros(porCategoria[id] ?? 0)}</p>
            </button>
          ))}
        </div>
        {datos.fijos_al_mes_cents ? (
          <p className="mt-2 text-[11.5px] text-[#8A96AB]">
            Aparte, los gastos fijos: {euros(datos.fijos_al_mes_cents)} al mes (en Gastos). Sus facturas, si las subes aquí, no suman otra vez.
          </p>
        ) : null}
      </div>

      {/* La lista */}
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <p className="text-[14px] font-bold text-gray-900">
            {visibles.length} {visibles.length === 1 ? 'factura' : 'facturas'}
            {categoria ? ` de ${cat[categoria]}` : ''}
          </p>
          {sinFactura ? (
            <button
              onClick={() => setSoloSinFactura((v) => !v)}
              className={`text-[12px] font-semibold rounded-full px-2.5 py-1 ${soloSinFactura ? 'bg-[#8A6A2A] text-white' : 'bg-[#FFFBF2] text-[#8A6A2A]'}`}
            >
              {sinFactura} sin el papel
            </button>
          ) : null}
        </div>
        {visibles.length ? (
          <ul className="divide-y divide-[#EEF2F9]">
            {visibles.map((g) => (
              <Fila key={g.id ?? (g.anuncio_id ? `a-${g.anuncio_id}` : `v-${g.antiguo_id}`)} g={g} cat={cat} orgId={org?.id} accessToken={accessToken} onCambio={cargar} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#8A96AB] py-6 text-center">No hay facturas en este periodo.</p>
        )}
      </div>
    </div>
  )
}
