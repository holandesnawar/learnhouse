'use client'

/**
 * Anuncios: qué trajo cada campaña. Se apunta la campaña con el mismo
 * utm_campaign que lleva su enlace y lo que se ha gastado; la escuela cruza
 * eso con los leads y dice cuántos trajo, cuántos se matricularon, cuántos
 * pagaron y cuánto costó cada uno. Solo administradores.
 * El cálculo vive en `apps/api/src/services/panel/ads.py`.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  borrarCampana,
  cambiarCampana,
  crearCampana,
  euros,
  fechaCorta,
  getAds,
  type Campana,
  type CampanaNueva,
  type PanelAds,
} from '@services/panel/panel'
import FichaCliente from './FichaCliente'
import { ChevronDown, ChevronRight, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const INPUT =
  'w-full bg-[#F0F5FF] rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff]'

const ETAPA: Record<string, { texto: string; clase: string }> = {
  lead: { texto: 'Lead', clase: 'bg-[#F3F4F6] text-[#5A6480]' },
  pidio: { texto: 'Pidió plaza', clase: 'bg-[#EAF3FF] text-[#025dc7]' },
  'en-pago': { texto: 'Llegó al pago', clase: 'bg-[#FFFBF2] text-[#8A6A2A]' },
  alumno: { texto: 'Alumno', clase: 'bg-[#E8FBF3] text-[#0E9F6E]' },
}

function Cifra({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className={CARD}>
      <p className="text-[10px] sm:text-[11px] font-semibold text-[#8A96AB] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-[22px] sm:text-[26px] font-semibold tabular-nums leading-tight mt-1 text-[#1D0084]">{valor}</p>
      {nota ? <p className="text-[11.5px] text-gray-500 mt-0.5 leading-snug">{nota}</p> : null}
    </div>
  )
}

function Dato({ label, valor, fuerte = false }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8A96AB]">{label}</p>
      <p className={`text-[14px] tabular-nums ${fuerte ? 'font-bold text-[#1D0084]' : 'font-semibold text-gray-900'}`}>{valor}</p>
    </div>
  )
}

function FormCampana({
  plataformas,
  inicial,
  onGuardar,
  onCancelar,
}: {
  plataformas: Record<string, string>
  inicial?: Partial<CampanaNueva>
  onGuardar: (d: CampanaNueva) => Promise<boolean>
  onCancelar?: () => void
}) {
  const [f, setF] = useState({
    nombre: inicial?.nombre ?? '',
    plataforma: inicial?.plataforma ?? 'meta',
    utm_campaign: inicial?.utm_campaign ?? '',
    inicio: inicial?.inicio ?? '',
    fin: inicial?.fin ?? '',
    gasto: inicial?.gasto !== undefined ? String(inicial.gasto) : '',
  })
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    setGuardando(true)
    const ok = await onGuardar({ ...f, gasto: f.gasto ? Number(String(f.gasto).replace(',', '.')) : 0 })
    setGuardando(false)
    if (ok && !inicial) setF({ nombre: '', plataforma: f.plataforma, utm_campaign: '', inicio: '', fin: '', gasto: '' })
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre: «Reels guía de las bases, sept»" className={INPUT} />
        <select value={f.plataforma} onChange={(e) => setF({ ...f, plataforma: e.target.value })} className={INPUT}>
          {Object.entries(plataformas).map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
        <input
          value={f.utm_campaign}
          onChange={(e) => setF({ ...f, utm_campaign: e.target.value })}
          placeholder="utm_campaign del enlace"
          className={`${INPUT} font-mono`}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[150px_170px_140px_auto] gap-2 items-end">
        <label className="block">
          <span className="block text-[11px] font-semibold text-[#8A96AB] mb-1">Empieza</span>
          <input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-[#8A96AB] mb-1">Termina (si ya acabó)</span>
          <input type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-[#8A96AB] mb-1">Gastado hasta hoy</span>
          <input value={f.gasto} onChange={(e) => setF({ ...f, gasto: e.target.value })} inputMode="decimal" placeholder="€" className={INPUT} />
        </label>
        <div className="flex gap-2 justify-end col-span-2 sm:col-span-1">
          {onCancelar ? (
            <button onClick={onCancelar} className="px-3 py-2 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:bg-[#F0F5FF]">
              Cancelar
            </button>
          ) : null}
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[13px] font-bold disabled:opacity-50"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {inicial ? 'Guardar' : 'Apuntar'}
          </button>
        </div>
      </div>
      <p className="text-[11.5px] text-[#8A96AB] leading-relaxed">
        El <span className="font-mono">utm_campaign</span> tiene que ser exactamente el del enlace del anuncio (lo ves en Enlaces UTM): es
        lo que une la campaña con la gente que llegó por ella. El gasto se va sumando a Gastos como publicidad.
      </p>
    </div>
  )
}

function FilaCampana({
  c,
  plataformas,
  onCambio,
  onAbrir,
}: {
  c: Campana
  plataformas: Record<string, string>
  onCambio: () => void
  onAbrir: (email: string) => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [abierta, setAbierta] = useState(false)
  const [editando, setEditando] = useState(false)

  async function quitar() {
    if (!window.confirm(`¿Borrar la campaña «${c.nombre}»? La gente que trajo no se toca.`)) return
    const r = await borrarCampana(org?.id, c.id, accessToken)
    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
    onCambio()
  }

  return (
    <div className="border-b border-[#EEF2F9] last:border-b-0">
      <button onClick={() => setAbierta((a) => !a)} className="w-full text-left px-4 py-3 hover:bg-[#F8FAFF] transition-colors">
        <div className="flex items-start gap-2">
          {abierta ? <ChevronDown size={16} className="mt-0.5 text-[#8A96AB] shrink-0" /> : <ChevronRight size={16} className="mt-0.5 text-[#8A96AB] shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{c.nombre}</p>
            <p className="text-[11.5px] text-[#5A6480] truncate">
              {plataformas[c.plataforma] || c.plataforma} · <span className="font-mono">{c.utm_campaign}</span>
              {c.inicio ? ` · ${fechaCorta(c.inicio)}${c.fin ? ` – ${fechaCorta(c.fin)}` : ''}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-2.5 ml-6 grid grid-cols-3 sm:grid-cols-6 gap-3">
          <Dato label="Gastado" valor={c.gasto_cents ? euros(c.gasto_cents) : '—'} />
          <Dato label="Leads" valor={String(c.leads)} fuerte />
          <Dato label="€ por lead" valor={c.coste_por_lead_cents !== null ? euros(c.coste_por_lead_cents) : '—'} />
          <Dato label="Matrículas" valor={String(c.matriculas)} />
          <Dato label="Ventas" valor={String(c.ventas)} fuerte />
          <Dato label="Retorno" valor={c.retorno !== null ? `×${c.retorno.toLocaleString('es-ES')}` : '—'} />
        </div>
      </button>
      {abierta ? (
        <div className="px-4 pb-4 ml-6 space-y-3">
          {editando ? (
            <FormCampana
              plataformas={plataformas}
              inicial={{ ...c, gasto: c.gasto_cents / 100 }}
              onCancelar={() => setEditando(false)}
              onGuardar={async (d) => {
                const r = await cambiarCampana(org?.id, c.id, d, accessToken)
                if (!r.ok) {
                  toast.error(r.error || 'No se ha podido guardar')
                  return false
                }
                setEditando(false)
                onCambio()
                return true
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-[#5A6480]">
                {c.ingresos_cents ? `Ingresos: ${euros(c.ingresos_cents)}` : 'Sin ventas todavía'}
                {c.coste_por_venta_cents !== null ? ` · ${euros(c.coste_por_venta_cents)} por venta` : ''}
              </span>
              <button onClick={() => setEditando(true)} className="ml-auto font-semibold text-[#025dc7] hover:underline">
                Cambiar gasto o fechas
              </button>
              <button onClick={quitar} aria-label="Borrar campaña" className="text-gray-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          )}
          {c.personas.length ? (
            <ul className="rounded-xl border border-[#E6EBF5] divide-y divide-[#EEF2F9]">
              {c.personas.map((p) => (
                <li key={p.email}>
                  <button onClick={() => onAbrir(p.email)} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#F8FAFF]">
                    <span className="flex-1 min-w-0 text-[13px] text-gray-900 truncate">{p.nombre || p.email}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ETAPA[p.etapa]?.clase || ETAPA.lead.clase}`}>
                      {ETAPA[p.etapa]?.texto || p.etapa}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#8A96AB] w-14 text-right">{fechaCorta(p.when)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-[#8A96AB]">Todavía no ha llegado nadie con este utm_campaign.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function AnunciosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<PanelAds | null>(null)
  const [error, setError] = useState('')
  const [nueva, setNueva] = useState<Partial<CampanaNueva> | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getAds(org.id, accessToken)
    if (r.ok && r.datos) setDatos(r.datos)
    else setError(r.error || 'No se han podido cargar')
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function crear(d: CampanaNueva) {
    const r = await crearCampana(org?.id, d, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return false
    }
    toast.success('Campaña apuntada')
    setNueva(null)
    cargar()
    return true
  }

  if (!datos) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={24} />}
      </div>
    )
  }

  const t = datos.total
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[#5A6480] leading-relaxed max-w-3xl">
        Apunta cada campaña con lo que has gastado y verás qué trajo: leads, matrículas y ventas, y cuánto costó cada uno. Cuenta
        cualquiera que haya llegado por su enlace, aunque comprara semanas después.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Cifra label="Gastado en anuncios" valor={euros(t.gasto_cents)} />
        <Cifra label="Leads" valor={String(t.leads)} nota={t.gasto_cents && t.leads ? `${euros(Math.round(t.gasto_cents / t.leads))} por lead` : undefined} />
        <Cifra label="Ventas" valor={String(t.ventas)} nota={t.ingresos_cents ? euros(t.ingresos_cents) : undefined} />
        <Cifra label="Retorno" valor={t.retorno !== null ? `×${t.retorno.toLocaleString('es-ES')}` : '—'} nota="Lo que entró por cada euro gastado" />
      </div>

      <div className={CARD}>
        <p className="text-[14px] font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Megaphone size={15} className="text-[#025dc7]" /> Apuntar una campaña
        </p>
        <FormCampana key={JSON.stringify(nueva)} plataformas={datos.plataformas} inicial={nueva ?? undefined} onGuardar={crear} />
      </div>

      <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
        {datos.campanas.length ? (
          datos.campanas.map((c) => <FilaCampana key={c.id} c={c} plataformas={datos.plataformas} onCambio={cargar} onAbrir={setAbierta} />)
        ) : (
          <p className="text-[13.5px] text-[#8A96AB] py-10 text-center">Todavía no hay campañas apuntadas.</p>
        )}
      </div>

      {datos.sin_apuntar.length ? (
        <div className={CARD}>
          <p className="text-[14px] font-bold text-gray-900">Llegan leads de campañas que no has apuntado</p>
          <p className="text-[12.5px] text-[#5A6480] mt-1 mb-3">Apúntalas para ver lo que te han costado.</p>
          <ul className="divide-y divide-[#EEF2F9]">
            {datos.sin_apuntar.map((s) => (
              <li key={s.utm_campaign} className="py-2 flex items-center gap-3">
                <span className="flex-1 min-w-0 font-mono text-[12.5px] text-gray-800 truncate">{s.utm_campaign}</span>
                <span className="text-[12px] text-[#5A6480]">
                  {s.leads} {s.leads === 1 ? 'lead' : 'leads'}
                  {s.ventas ? ` · ${s.ventas} ${s.ventas === 1 ? 'venta' : 'ventas'}` : ''}
                </span>
                <button
                  onClick={() => {
                    setNueva({ utm_campaign: s.utm_campaign, nombre: s.utm_campaign })
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="text-[12.5px] font-semibold text-[#025dc7] hover:underline"
                >
                  Apuntar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
