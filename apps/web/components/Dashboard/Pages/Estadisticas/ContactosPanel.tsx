'use client'

/**
 * Contactos — una ficha por persona, con lo que ha hecho, lo que ha visto y
 * en qué campaña está.
 *
 * Es la pantalla que contesta, antes de escribir a alguien: ¿ya vio el
 * precio? ¿de qué anuncio viene? ¿descargó una guía, llegó al pago, ya paga?
 * Antes eso estaba en tres tablas y en systeme.io.
 *
 * La lista es ligera (sin historial); el historial y las etiquetas del CRM se
 * piden al abrir una ficha, porque las etiquetas se leen de systeme.io en
 * vivo y eso tarda.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import PorDia from './PorDia'
import {
  ETAPA_TEXTO,
  ESTADO_TEXTO,
  type EtapaContacto,
  getContactoDetalle,
  getContactos,
  type Contacto,
  type ContactoDetalle,
} from '@services/stats/contactos'
import { ChevronDown, ChevronRight, Loader2, Map as MapIcon, Search, Tag, X } from 'lucide-react'
import { ETAPAS, MAPA_WEB } from '@lib/nawar/mapaWeb'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'

function fecha(iso: string, conHora = false) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function EstadoPill({ estado }: { estado: Contacto['estado'] }) {
  const estilo =
    estado === 'alumno'
      ? 'bg-[#E8FBF3] text-[#0E9F6E]'
      : estado === 'matriculado-sin-pagar'
        ? 'bg-[#FFFBF2] text-[#8A6A2A]'
        : 'bg-[#EAF3FF] text-[#025dc7]'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${estilo}`}>
      {ESTADO_TEXTO[estado]}
    </span>
  )
}

const ESTILO_ETAPA: Record<EtapaContacto, string> = {
  lead: 'bg-[#F3F4F6] text-[#5A6480]',
  pidio: 'bg-[#EAF3FF] text-[#025dc7]',
  'en-pago': 'bg-[#FFFBF2] text-[#8A6A2A]',
  alumno: 'bg-[#E8FBF3] text-[#0E9F6E]',
}

function EtapaPill({ etapa }: { etapa: EtapaContacto }) {
  return (
    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ETAPA[etapa] || ESTILO_ETAPA.lead}`}>
      {ETAPA_TEXTO[etapa] || etapa}
    </span>
  )
}

/** Una línea por persona: quién es, cómo contactarla y lo último que hizo. */
function Fila({ c, onOpen, deMatricula }: { c: Contacto; onOpen: () => void; deMatricula: boolean }) {
  // Al closer le importa CUÁNDO se matriculó; al administrador, lo último que hizo.
  const cuando = deMatricula ? c.matricula_at : c.ultimo_contacto.when
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-[#DDE6F5] bg-[#F7FAFF] hover:bg-[#EEF4FF] px-3.5 py-2.5 flex items-center gap-3 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-gray-900 flex items-center gap-2 min-w-0">
          <span className="truncate">{c.nombre || c.email}</span>
          <EtapaPill etapa={c.etapa} />
        </p>
        <p className="text-[12px] text-gray-500 truncate">
          {c.email}
          {c.telefono ? ` · ${c.telefono}` : ''}
        </p>
        <p className="text-[12px] mt-0.5 text-[#5A6480] truncate">
          {deMatricula ? 'Se matriculó' : c.ultimo_contacto.que}
          <span className="text-[#9CA3AF]"> · {fecha(cuando, true)}</span>
          {c.vio_precio ? <span className="text-[#0E9F6E] font-semibold"> · vio el precio</span> : null}
          {c.utm_campaign ? <span className="text-[#025dc7]"> · {c.utm_campaign}</span> : null}
        </p>
      </div>
      <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
    </button>
  )
}

function Ficha({ email, onClose, sinCrm = false }: { email: string; onClose: () => void; sinCrm?: boolean }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [d, setD] = useState<ContactoDetalle | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    getContactoDetalle(org?.id, email, accessToken).then((r) => {
      if (!vivo) return
      setD(r)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [org?.id, email, accessToken])

  const tel = (d?.telefono || '').replace(/[^\d+]/g, '')
  const wa = tel ? `https://wa.me/${tel.replace(/^\+/, '').replace(/^00/, '')}` : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1D0084]/30" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full max-w-[520px] h-full bg-white shadow-2xl overflow-y-auto p-5 sm:p-7">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 rounded-lg p-2 text-gray-500 hover:bg-[#F0F5FF]"
        >
          <X size={18} />
        </button>

        {cargando ? (
          <div className="flex items-center gap-2 text-[13.5px] text-gray-500 py-10">
            <Loader2 size={16} className="animate-spin" /> Cargando la ficha…
          </div>
        ) : !d ? (
          <p className="text-[13.5px] text-gray-700 py-10">No se ha podido cargar esta ficha.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB]">
                Contacto
              </p>
              <h2 className="text-[22px] font-bold text-[#1D0084] leading-tight mt-1 pr-8">
                {d.nombre || d.email}
              </h2>
              <p className="text-[13px] text-gray-600 mt-1">
                {d.email}
                {d.telefono ? ` · ${d.telefono}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <EstadoPill estado={d.estado} />
                {d.vio_precio ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#E8FBF3] text-[#0E9F6E]">
                    Ya vio el precio
                  </span>
                ) : (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7590]">
                    Sin rastro de haber visto el precio
                  </span>
                )}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[#4da3ff] text-[#0a1656]"
                  >
                    Escribir por WhatsApp
                  </a>
                ) : null}
              </div>
            </div>

            {/* De dónde viene: lo que decide cómo empezar el mensaje. */}
            <div className={CARD}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] mb-2">
                De dónde viene
              </p>
              <dl className="text-[13px] space-y-1.5">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-gray-500">Vino de</dt>
                  <dd className="text-gray-900">{d.vino_de || 'Sin rastro'}</dd>
                </div>
                {d.camino ? (
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-gray-500">Camino</dt>
                    <dd className="text-gray-900">{d.camino}</dd>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-gray-500">Campaña</dt>
                  <dd className="text-gray-900">
                    {d.utm_campaign || <span className="text-[#9CA3AF]">Orgánico o sin UTM</span>}
                    {d.utm_source ? (
                      <span className="text-gray-500">
                        {' '}
                        · {d.utm_source}
                        {d.utm_medium ? ` / ${d.utm_medium}` : ''}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Lo que systeme.io tiene: sus etiquetas son "en qué campaña de correos está".
                El closer no lo necesita para llamar: se le ahorra. */}
            {sinCrm ? null : <div className={CARD}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] mb-2 flex items-center gap-1.5">
                <Tag size={12} /> En el CRM (systeme.io)
              </p>
              {!d.systeme.ok ? (
                <p className="text-[13px] text-[#8A6A2A]">
                  No se ha podido consultar: {d.systeme.motivo || 'sin respuesta'}.
                </p>
              ) : d.systeme.existe === false ? (
                <p className="text-[13px] text-gray-600">
                  Este correo <strong>no está</strong> en systeme.io.
                </p>
              ) : (
                <>
                  {d.systeme.etiquetas.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {d.systeme.etiquetas.map((t) => (
                        <span
                          key={t}
                          className="inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold bg-[#EAF3FF] text-[#025dc7]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-600">Está en el CRM pero sin ninguna etiqueta.</p>
                  )}
                  {d.systeme.campos.length ? (
                    <dl className="mt-3 text-[12.5px] space-y-1">
                      {d.systeme.campos.map((c) => (
                        <div key={c.slug} className="flex gap-3">
                          <dt className="w-32 shrink-0 text-gray-500 truncate">{c.slug}</dt>
                          <dd className="text-gray-900 truncate">{c.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </>
              )}
            </div>}

            {/* El historial, de lo más reciente a lo más antiguo. */}
            <div className={CARD}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] mb-3">
                Qué ha hecho
              </p>
              <ol className="space-y-3">
                {[...d.eventos].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[#4da3ff] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-gray-900">{e.que}</p>
                      <p className="text-[12px] text-gray-500">
                        {fecha(e.when, true)}
                        {e.tag ? ` · etiqueta «${e.tag}»` : ''}
                        {e.utm_campaign ? ` · campaña ${e.utm_campaign}` : ''}
                        {e.recorrido ? ` · pasó por: ${e.recorrido.split(',').join(' → ')}` : ''}
                        {e.kind === 'pago' && typeof e.extra?.importe_cents === 'number'
                          ? ` · ${(Number(e.extra.importe_cents) / 100).toLocaleString('es-ES', { style: 'currency', currency: String(e.extra.currency || 'eur').toUpperCase() })}`
                          : ''}
                      </p>
                      {/* La cualificación de /agendar: las respuestas, una a una,
                          y la nota. Es lo que hay que leer antes de la llamada. */}
                      {e.kind === 'cualificacion' && Array.isArray(e.extra?.respuestas) ? (
                        <div className="mt-1.5 rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] px-3 py-2">
                          <p className="text-[12px] font-semibold text-[#1D0084] mb-1">
                            {e.extra?.apto ? 'Encaja' : 'No encaja por ahora'} · {String(e.extra?.puntuacion ?? '')} puntos
                            {!e.extra?.apto && e.extra?.motivo_fuera ? ` · ${String(e.extra.motivo_fuera)}` : ''}
                          </p>
                          <ul className="space-y-0.5">
                            {(e.extra.respuestas as any[]).map((r, j) => (
                              <li key={j} className="text-[12px] text-gray-700">
                                <span className="text-gray-500">{r.pregunta}</span> — <strong>{r.respuesta}</strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

/**
 * El mapa de la web: las páginas ordenadas por etapa, con qué enseña cada una,
 * a dónde manda y con qué etiqueta entra la gente. Es consulta, no trabajo de
 * cada día: va al final y plegado. Los datos están a mano en lib/nawar/mapaWeb.ts.
 */
function MapaWeb() {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className={CARD}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left text-[13.5px] font-semibold text-[#025dc7] hover:text-[#1D0084]"
      >
        <span className="inline-flex items-center gap-1.5">
          <MapIcon size={15} /> Mapa de la web: qué página lleva a cada etapa
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto ? (
        <div className="mt-3 space-y-4">
          {ETAPAS.map((et) => (
            <div key={et.id}>
              <p className="text-[12.5px] font-bold text-gray-900">{et.nombre}</p>
              <p className="text-[12px] text-gray-500 mb-1.5">{et.que}</p>
              <div className="space-y-1">
                {MAPA_WEB.filter((p) => p.etapa === et.id).map((p) => (
                  <div
                    key={p.ruta}
                    className={`rounded-lg border px-3 py-2 text-[12.5px] ${
                      p.redirigeA ? 'border-[#E7EEF9] opacity-60' : 'border-[#DDE6F5]'
                    }`}
                  >
                    <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{p.nombre}</span>
                      <span className="font-mono text-[11.5px] text-[#025dc7] break-all">{p.ruta}</span>
                      {p.precio ? (
                        <span className="rounded-full bg-[#E8FBF3] text-[#0E9F6E] px-1.5 py-0.5 text-[10.5px] font-semibold">
                          enseña el precio
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#F3F4F6] text-[#6B7590] px-1.5 py-0.5 text-[10.5px] font-semibold">
                          sin precio
                        </span>
                      )}
                      {p.ads ? (
                        <span className="rounded-full bg-[#FFFBF2] text-[#8A6A2A] px-1.5 py-0.5 text-[10.5px] font-semibold">
                          anuncios
                        </span>
                      ) : null}
                    </p>
                    <p className="text-gray-600 mt-0.5">{p.que}</p>
                    <p className="text-gray-500 mt-0.5">
                      <span className="text-[#8A96AB]">Botón:</span> {p.boton}
                      {p.etiquetas.length ? (
                        <>
                          {' · '}
                          <span className="text-[#8A96AB]">Etiqueta:</span> {p.etiquetas.join(', ')}
                        </>
                      ) : null}
                      {p.redirigeA ? (
                        <>
                          {' · '}
                          <span className="text-[#8A6A2A]">Redirige a {p.redirigeA}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11.5px] text-[#9CA3AF]">
            Este mapa está escrito a mano (las páginas viven en el otro repo). Si se cambia una
            página en la web, hay que cambiarlo aquí también.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Las etapas, en orden. Las del closer son solo las de matrícula. */
const ETAPAS_ADMIN: { id: EtapaContacto; nombre: string; que: string }[] = [
  { id: 'lead', nombre: 'Leads', que: 'Dejaron el correo: guía, Instagram o lista de espera' },
  { id: 'pidio', nombre: 'Pidieron plaza', que: 'Formulario de plaza o de llamada, sin pagar' },
  { id: 'en-pago', nombre: 'Llegaron al pago', que: 'Y no terminaron de pagar' },
  { id: 'alumno', nombre: 'Alumnos', que: 'Pagaron o tienen cuenta' },
]
const ETAPAS_CLOSER = ETAPAS_ADMIN.filter((e) => e.id !== 'lead').map((e) =>
  e.id === 'alumno' ? { ...e, nombre: 'Ya son alumnos', que: 'Ya pagaron: no hace falta llamar' } : e
)

export default function ContactosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isCloser } = useAdminStatus()

  const [q, setQ] = useState('')
  const [datos, setDatos] = useState<{ total: number; mostrados: number; contactos: Contacto[] } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<EtapaContacto | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setCargando(true)
    setDatos(await getContactos(org.id, '', accessToken))
    setCargando(false)
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  // El servidor ya le manda al closer solo las matrículas; esto es por si
  // acaso y para ordenar por la fecha buena.
  const lista = useMemo(() => {
    const todos = datos?.contactos ?? []
    return isCloser ? todos.filter((c) => c.matricula_at) : todos
  }, [datos, isCloser])

  const etapas = isCloser ? ETAPAS_CLOSER : ETAPAS_ADMIN
  const cuenta = (id: EtapaContacto) => lista.filter((c) => c.etapa === id).length

  // El buscador filtra en el navegador: la lista ya viene entera y así
  // responde al instante, sin un viaje por letra.
  const t = q.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      lista.filter((c) => {
        if (etapa && c.etapa !== etapa) return false
        if (!t) return true
        return (
          c.email.includes(t) ||
          c.nombre.toLowerCase().includes(t) ||
          c.telefono.includes(t) ||
          c.utm_campaign.toLowerCase().includes(t) ||
          c.etiquetas.some((e) => e.toLowerCase().includes(t))
        )
      }),
    [lista, etapa, t]
  )

  const fechaDe = (c: Contacto) => (isCloser ? c.matricula_at : c.ultimo_contacto.when)
  const fila = (c: Contacto) => <Fila c={c} deMatricula={isCloser} onOpen={() => setAbierto(c.email)} />

  return (
    <section className="space-y-4">
      <p className="text-[13px] text-[#5A6480] leading-relaxed">
        {isCloser
          ? 'Todas las matrículas: quien pidió plaza o llegó al pago. Ordenadas por el día en que se matricularon. Abre una para ver lo que ha hecho y sus respuestas.'
          : 'Una ficha por persona que ha dejado sus datos, en la etapa más lejana a la que llegó. Ordenadas por el día de su último movimiento. Toca una etapa para ver solo esa.'}
      </p>

      {/* Las etapas SON los filtros, y suman el total: cada persona está en una sola. */}
      <div className={`grid grid-cols-2 ${etapas.length === 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-2.5`}>
        {etapas.map((e, i) => {
          const activa = etapa === e.id
          return (
            <button
              key={e.id}
              onClick={() => setEtapa(activa ? null : e.id)}
              className={`text-left rounded-xl border px-3.5 py-3 transition-colors ${
                activa ? 'border-[#1D0084] bg-[#1D0084] text-white' : 'border-[#DDE6F5] bg-white hover:border-[#4da3ff]'
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${activa ? 'text-white/75' : 'text-[#8A96AB]'}`}>
                {i + 1} · {e.nombre}
              </p>
              <p className={`text-[24px] font-semibold tabular-nums leading-tight mt-0.5 ${activa ? 'text-white' : 'text-[#1D0084]'}`}>
                {cuenta(e.id)}
              </p>
              <p className={`text-[11.5px] leading-snug ${activa ? 'text-white/80' : 'text-gray-500'}`}>{e.que}</p>
            </button>
          )
        })}
      </div>

      <div className={CARD}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, correo o teléfono"
              className="w-full bg-[#F0F5FF] rounded-xl pl-9 pr-3 py-2.5 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors"
            />
          </label>
          <p className="text-[12.5px] text-[#5A6480] shrink-0">
            {etapa ? (
              <>
                Solo <strong>{etapas.find((e) => e.id === etapa)?.nombre}</strong> · {visibles.length}{' '}
                <button onClick={() => setEtapa(null)} className="text-[#025dc7] font-semibold hover:underline">
                  ver todos
                </button>
              </>
            ) : (
              <>
                {visibles.length} {isCloser ? 'matrículas' : 'contactos'}
              </>
            )}
          </p>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 text-[13.5px] text-gray-500 py-6">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : !datos ? (
          <p className="text-[13.5px] text-gray-700 py-2">No se han podido cargar los contactos.</p>
        ) : visibles.length === 0 ? (
          <p className="text-[13.5px] text-gray-700 py-2">
            {lista.length === 0
              ? isCloser
                ? 'Todavía no se ha matriculado nadie.'
                : 'Todavía no hay ningún contacto guardado.'
              : 'Nadie coincide con esa búsqueda.'}
          </p>
        ) : t ? (
          // Buscando: todo junto, sin grupos plegados que escondan el resultado.
          <div className="space-y-1.5">
            {visibles.map((c) => (
              <React.Fragment key={c.email}>{fila(c)}</React.Fragment>
            ))}
          </div>
        ) : (
          <PorDia
            items={[...visibles].sort((a, b) => (fechaDe(b) || '').localeCompare(fechaDe(a) || ''))}
            fecha={fechaDe}
            clave={(c) => c.email}
            recordarComo={isCloser ? 'contactos-closer' : 'contactos'}
            render={fila}
          />
        )}
        {datos && datos.total > datos.mostrados && !isCloser ? (
          <p className="text-[12px] text-[#9CA3AF] mt-3">
            Se enseñan los {datos.mostrados} más recientes de {datos.total}. Usa el buscador para el
            resto.
          </p>
        ) : null}
      </div>

      {isCloser ? null : <MapaWeb />}

      {abierto ? <Ficha email={abierto} sinCrm={isCloser} onClose={() => setAbierto(null)} /> : null}
    </section>
  )
}
