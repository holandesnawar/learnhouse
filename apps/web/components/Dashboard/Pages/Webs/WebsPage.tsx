'use client'

/**
 * Webs — la web de la escuela, desde el panel.
 *
 * Tres pestañas:
 * - Enlaces: atajos (holandesnawar.com/ig → donde digas, con UTM y contador)
 *   y redirecciones de URLs viejas. Funcionan al momento, sin despliegue: la
 *   web pregunta a la escuela cuando le piden una ruta que no tiene.
 * - Páginas: todas las páginas que existen de verdad en la web, sacadas de su
 *   código en cada despliegue, cruzadas con el mapa por etapas (qué enseña
 *   cada una, si lleva precio, a dónde manda). Lo que existe y no está en el
 *   mapa sale como "sin clasificar"; lo del mapa que ya no existe, avisado.
 * - UTM: el bloc de enlaces con utm_* de siempre.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { ETAPAS, MAPA_WEB } from '@lib/nawar/mapaWeb'
import {
  WEB_URL,
  borrarEnlace,
  crearEnlace,
  editarEnlace,
  getEnlaces,
  getInventarioWeb,
  type InventarioWeb,
  type WebLink,
  type WebLinkWrite,
} from '@services/webs/webs'
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Link2, Loader2, Pencil, Plus, Power, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import UtmNotepad from './UtmNotepad'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const INPUT =
  'bg-[#F0F5FF] rounded-xl px-3 py-2 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors w-full'
const BTN = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[14px] font-bold transition-colors disabled:opacity-60'
const BTN_SEC = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:bg-[#F0F5FF] transition-colors'

const VACIO: WebLinkWrite = { slug: '', destination: '', kind: 'enlace', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', note: '', active: true }

export default function WebsPage() {
  const [tab, setTab] = useState<'enlaces' | 'paginas' | 'utm'>('enlaces')
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'enlaces' || t === 'paginas' || t === 'utm') setTab(t)
  }, [])
  return (
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-6 sm:py-9 pb-24 lg:pb-10 space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 min-w-0">
        <Globe size={22} className="text-[#025dc7] shrink-0" />
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Webs</h1>
      </div>
      <div className="flex gap-1 border-b border-[#DDE6F5] overflow-x-auto">
        {[
          { id: 'enlaces' as const, label: 'Enlaces y redirecciones' },
          { id: 'paginas' as const, label: 'Páginas' },
          { id: 'utm' as const, label: 'Enlaces UTM' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-[#4da3ff] text-[#025dc7]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'enlaces' ? <Enlaces /> : tab === 'paginas' ? <Paginas /> : <UtmNotepad />}
    </div>
  )
}

/* ───────────────────────── Enlaces ───────────────────────── */

function Enlaces() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [lista, setLista] = useState<WebLink[] | null>(null)
  const [draft, setDraft] = useState<WebLinkWrite>(VACIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setLista(await getEnlaces(org.id, accessToken))
  }, [org?.id, accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async () => {
    if (!draft.slug.trim() || !draft.destination.trim()) {
      toast.error('Faltan el atajo y el destino')
      return
    }
    setOcupado(true)
    try {
      if (editando === null) await crearEnlace(org.id, draft, accessToken)
      else await editarEnlace(org.id, editando, draft, accessToken)
      setDraft(VACIO)
      setEditando(null)
      await cargar()
      toast.success(editando === null ? 'Enlace creado. Ya funciona.' : 'Guardado')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  const editar = (l: WebLink) => {
    setDraft({ slug: l.slug, destination: l.destination, kind: l.kind, utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign, utm_content: l.utm_content, note: l.note, active: l.active })
    setEditando(l.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const alternar = async (l: WebLink) => {
    try {
      await editarEnlace(org.id, l.id, { ...l, active: !l.active }, accessToken)
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cambiar')
    }
  }

  const quitar = async (l: WebLink) => {
    if (!window.confirm(`¿Borrar «/${l.slug}»? Quien tenga ese enlace verá un 404.`)) return
    try {
      await borrarEnlace(org.id, l.id, accessToken)
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar')
    }
  }

  const copiar = async (l: WebLink) => {
    try {
      await navigator.clipboard.writeText(`${WEB_URL}/${l.slug}`)
      setCopiado(l.id)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      toast.error('Tu navegador no ha dejado copiar')
    }
  }

  const campo = (k: keyof WebLinkWrite, ph: string) => (
    <input value={String(draft[k] ?? '')} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph} className={INPUT} />
  )

  const enlaces = (lista ?? []).filter((l) => l.kind === 'enlace')
  const redirecciones = (lista ?? []).filter((l) => l.kind === 'redireccion')

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
          <Link2 size={16} className="text-[#025dc7]" />
          {editando === null ? 'Nuevo enlace o redirección' : 'Editar'}
        </h3>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
          Un <strong>enlace</strong> es un atajo para repartir: <code>holandesnawar.com/ig</code> → donde tú digas,
          con sus UTM pegadas y contando clics. Una <strong>redirección</strong> es una URL vieja que no puede quedarse
          en 404. Los dos funcionan al momento, sin despliegue.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-500 shrink-0">{WEB_URL.replace('https://', '')}/</span>
            {campo('slug', 'ig, guia, clase-jueves…')}
          </div>
          {campo('destination', 'Destino: https://… o /formacion-nawar')}
          <div className="flex gap-2">
            {(['enlace', 'redireccion'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setDraft({ ...draft, kind: k })}
                className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${draft.kind === k ? 'bg-[#1D0084] text-white' : 'bg-[#F0F5FF] text-[#1D0084]'}`}
              >
                {k === 'enlace' ? 'Enlace (atajo)' : 'Redirección'}
              </button>
            ))}
          </div>
          {campo('note', 'Para qué es (opcional)')}
          {draft.kind === 'enlace' ? (
            <>
              {campo('utm_source', 'utm_source (ej. instagram)')}
              {campo('utm_medium', 'utm_medium (ej. bio)')}
              {campo('utm_campaign', 'utm_campaign (ej. octubre)')}
              {campo('utm_content', 'utm_content (opcional)')}
            </>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={guardar} disabled={ocupado} className={BTN}>
            {ocupado ? <Loader2 size={15} className="animate-spin" /> : editando === null ? <Plus size={15} /> : <Check size={15} />}
            {editando === null ? 'Crear' : 'Guardar cambios'}
          </button>
          {editando !== null ? (
            <button onClick={() => { setDraft(VACIO); setEditando(null) }} className={BTN_SEC}>Cancelar</button>
          ) : null}
        </div>
      </div>

      {[
        { titulo: 'Enlaces', filas: enlaces, vacio: 'Todavía no hay atajos. Crea el primero arriba: /ig para la bio de Instagram, por ejemplo.' },
        { titulo: 'Redirecciones', filas: redirecciones, vacio: 'No hay redirecciones creadas desde aquí. Las dos fijas de la web se ven en la pestaña Páginas.' },
      ].map((g) => (
        <div key={g.titulo} className={CARD}>
          <h3 className="text-[14px] font-bold text-gray-900 mb-3">{g.titulo}</h3>
          {lista === null ? (
            <p className="text-[13px] text-gray-400">Cargando…</p>
          ) : g.filas.length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF] py-4 text-center">{g.vacio}</p>
          ) : (
            <div className="space-y-2">
              {g.filas.map((l) => (
                <div key={l.id} className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${l.active ? 'border-[#E7EEF9]' : 'border-[#E7EEF9] opacity-55'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-gray-900 flex flex-wrap items-center gap-x-2">
                      <span className="font-mono text-[#025dc7]">/{l.slug}</span>
                      {!l.active ? <span className="text-[11px] font-semibold text-[#8A6A2A] bg-[#FFFBF2] rounded-full px-2 py-0.5">apagado</span> : null}
                      {l.kind === 'enlace' ? <span className="text-[11.5px] text-gray-500 tabular-nums">{l.clicks} {l.clicks === 1 ? 'clic' : 'clics'}</span> : null}
                    </p>
                    <p className="text-[12px] text-gray-500 break-all mt-0.5">→ {l.destino_final}</p>
                    {l.note ? <p className="text-[12px] text-[#9CA3AF] mt-0.5">{l.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copiar(l)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold">
                      {copiado === l.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiado === l.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button onClick={() => editar(l)} aria-label="Editar" className="p-1.5 rounded-lg text-gray-500 hover:bg-[#F0F5FF]"><Pencil size={14} /></button>
                    <button onClick={() => alternar(l)} aria-label={l.active ? 'Apagar' : 'Encender'} title={l.active ? 'Apagar (sin borrarlo)' : 'Encender'} className="p-1.5 rounded-lg text-gray-500 hover:bg-[#F0F5FF]"><Power size={14} /></button>
                    <button onClick={() => quitar(l)} aria-label="Borrar" className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── Páginas ───────────────────────── */

function normaliza(r: string): string {
  return r.replace(/\/+$/, '') || '/'
}

function Paginas() {
  const [inv, setInv] = useState<InventarioWeb | null | 'error'>(null)
  const cargar = useCallback(async () => {
    setInv(null)
    setInv((await getInventarioWeb()) ?? 'error')
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const datos = inv && inv !== 'error' ? inv : null
  const existentes = useMemo(() => new Set((datos?.paginas ?? []).map(normaliza)), [datos])
  const enMapa = useMemo(() => new Set(MAPA_WEB.map((p) => normaliza(p.ruta))), [])
  const sinClasificar = (datos?.paginas ?? []).map(normaliza).filter((r) => !enMapa.has(r) && !r.includes('[') && !r.startsWith('/blog') && !r.startsWith('/admin'))

  return (
    <div className="space-y-4">
      <div className={`${CARD} flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex-1">
          <p className="text-[13.5px] font-semibold text-gray-900">Lo que hay en la web, de verdad</p>
          <p className="text-[12.5px] text-gray-500">
            La lista de páginas la manda la propia web, sacada de su código en cada despliegue.
            {datos ? ` Actualizada ${new Date(datos.generado).toLocaleString('es-ES')}.` : ''}
          </p>
        </div>
        <button onClick={cargar} className={BTN_SEC}><RefreshCw size={14} /> Actualizar</button>
      </div>

      {inv === 'error' ? (
        <div className={CARD}>
          <p className="text-[13.5px] text-[#8A6A2A] flex items-center gap-2"><AlertTriangle size={15} /> No se ha podido leer la web. Puede estar desplegándose; prueba en un minuto.</p>
        </div>
      ) : null}

      {ETAPAS.map((et) => (
        <div key={et.id} className={CARD}>
          <p className="text-[13.5px] font-bold text-gray-900">{et.nombre}</p>
          <p className="text-[12px] text-gray-500 mb-2">{et.que}</p>
          <div className="space-y-1">
            {MAPA_WEB.filter((p) => p.etapa === et.id).map((p) => {
              const externa = !p.ruta.startsWith('/')
              const existe = externa || existentes.has(normaliza(p.ruta)) || !datos
              const href = externa ? `https://${p.ruta}` : `${WEB_URL}${p.ruta}`
              return (
                <div key={p.ruta} className={`rounded-lg border px-3 py-2 text-[12.5px] ${p.redirigeA || !existe ? 'border-[#E7EEF9] opacity-70' : 'border-[#DDE6F5]'}`}>
                  <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{p.nombre}</span>
                    <a href={href} target="_blank" rel="noopener" className="font-mono text-[11.5px] text-[#025dc7] break-all inline-flex items-center gap-1">
                      {p.ruta} <ExternalLink size={11} />
                    </a>
                    {p.precio ? (
                      <span className="rounded-full bg-[#E8FBF3] text-[#0E9F6E] px-1.5 py-0.5 text-[10.5px] font-semibold">enseña el precio</span>
                    ) : (
                      <span className="rounded-full bg-[#F3F4F6] text-[#6B7590] px-1.5 py-0.5 text-[10.5px] font-semibold">sin precio</span>
                    )}
                    {p.ads ? <span className="rounded-full bg-[#FFFBF2] text-[#8A6A2A] px-1.5 py-0.5 text-[10.5px] font-semibold">anuncios</span> : null}
                    {datos && !existe && !p.redirigeA ? (
                      <span className="rounded-full bg-red-50 text-red-600 px-1.5 py-0.5 text-[10.5px] font-semibold">ya no existe en la web</span>
                    ) : null}
                  </p>
                  <p className="text-gray-600 mt-0.5">{p.que}</p>
                  <p className="text-gray-500 mt-0.5">
                    <span className="text-[#8A96AB]">Botón:</span> {p.boton}
                    {p.etiquetas.length ? <> · <span className="text-[#8A96AB]">Etiqueta:</span> {p.etiquetas.join(', ')}</> : null}
                    {p.redirigeA ? <> · <span className="text-[#8A6A2A]">Redirige a {p.redirigeA}</span></> : null}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {datos ? (
        <div className={CARD}>
          <p className="text-[13.5px] font-bold text-gray-900">Otras páginas que existen</p>
          <p className="text-[12px] text-gray-500 mb-2">Están en la web pero no en el mapa por etapas (legales, contacto, gracias…).</p>
          {sinClasificar.length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF]">Ninguna.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sinClasificar.map((r) => (
                <a key={r} href={`${WEB_URL}${r}`} target="_blank" rel="noopener" className="font-mono text-[12px] text-[#025dc7] bg-[#F0F5FF] rounded-lg px-2 py-1">{r}</a>
              ))}
            </div>
          )}
          {datos.redirecciones.length ? (
            <>
              <p className="text-[13.5px] font-bold text-gray-900 mt-4">Redirecciones fijas de la web</p>
              <p className="text-[12px] text-gray-500 mb-2">Las que van en el código. Las nuevas se crean en la pestaña Enlaces.</p>
              <ul className="text-[12.5px] space-y-1">
                {datos.redirecciones.map((r) => (
                  <li key={r.desde} className="font-mono text-gray-700">{r.desde} → {r.hacia} <span className="text-gray-400">({r.status})</span></li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
