'use client'

/**
 * Páginas de la web, pensado para el closer (lo ve también el administrador):
 * por dónde llega la gente, qué ha visto cada una y qué sabe ya quien viene
 * de ella antes de que la llames. Arriba, los números de /agendar, que es la
 * página que le trae las llamadas.
 *
 * Los datos de las páginas están escritos a mano en lib/nawar/mapaWeb.ts
 * (MAPA_WEB y SABE_POR_RUTA): si cambia una página en la web, se cambia allí.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getEmbudoAgendar, type PasoAgendar } from '@services/stats/contactos'
import { ETAPAS, MAPA_WEB, SABE_POR_RUTA } from '@lib/nawar/mapaWeb'
import { ArrowRight, ExternalLink, PhoneCall } from 'lucide-react'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5'
const WEB = 'https://www.holandesnawar.com'

function enlace(ruta: string): string | null {
  if (ruta.startsWith('/')) return `${WEB}${ruta}`
  if (ruta.startsWith('app.')) return `https://${ruta}`
  return null
}

function Paso({ label, n, de, nota }: { label: string; n: number; de?: number; nota?: string }) {
  const pct = de ? Math.round((n * 100) / de) : null
  return (
    <div className="rounded-xl bg-[#F7FAFF] border border-[#E7EEF9] px-3.5 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB]">{label}</p>
      <p className="text-[24px] font-semibold text-[#1D0084] tabular-nums leading-tight mt-0.5">{n}</p>
      <p className="text-[11.5px] text-gray-500">{pct !== null ? `${pct}% del paso anterior` : nota || ' '}</p>
    </div>
  )
}

function Agendar() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Record<string, PasoAgendar> | null>(null)
  const [ventana, setVentana] = useState<'7d' | '30d' | 'total'>('30d')

  useEffect(() => {
    if (!org?.id || !accessToken) return
    getEmbudoAgendar(org.id, accessToken).then((d) => setDatos(d as any))
  }, [org?.id, accessToken])

  const d = datos?.[ventana]
  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall size={16} className="text-[#025dc7]" /> /agendar · la página que trae tus llamadas
          </p>
          <p className="text-[12.5px] text-[#5A6480] mt-1 leading-relaxed max-w-2xl">
            Nombre, correo y teléfono, y nueve preguntas (nivel, dónde vive, para qué, edad, ocupación, qué espera conseguir,
            horas, dinero y compromiso). Quien encaja confirma que asistirá y elige hora en Calendly. No enseña el precio. Todo
            sale en Llamadas, con sus respuestas, aunque se vaya a mitad.
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-[#F0F5FF] p-1 shrink-0">
          {(
            [
              ['7d', '7 días'],
              ['30d', '30 días'],
              ['total', 'Siempre'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVentana(id)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-semibold ${
                ventana === id ? 'bg-white text-[#1D0084] shadow-sm' : 'text-[#5A6480]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!d ? (
        <p className="text-[12.5px] text-gray-500 mt-3">{datos === null ? 'Cargando…' : 'Sin datos.'}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Paso label="Empezaron" n={d.empezaron} nota="Dejaron nombre y teléfono" />
          <Paso label="Terminaron" n={d.terminaron} de={d.empezaron} />
          <Paso label="Encajan" n={d.encajan} de={d.terminaron} />
          <Paso label="Reservaron hora" n={d.reservaron} de={d.encajan} />
        </div>
      )}
      {d && d.empezaron > d.terminaron ? (
        <p className="mt-2.5 text-[12.5px] text-[#5A6480]">
          <strong className="text-gray-900">{d.empezaron - d.terminaron}</strong> se fueron a mitad: salen en Llamadas como
          «No terminó», con lo que llegaron a contestar. Son buenas llamadas en frío.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`${WEB}/agendar`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12.5px] font-bold"
        >
          Ver la página <ExternalLink size={13} />
        </a>
        <a
          href="/dash/estadisticas?tab=llamadas"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[12.5px] font-bold"
        >
          Ir a Llamadas <ArrowRight size={13} />
        </a>
      </div>
    </div>
  )
}

export default function PaginasPanel() {
  const { isAdmin } = useAdminStatus()
  return (
    <div className="space-y-5 max-w-5xl">
      <p className="text-[13px] text-[#5A6480] leading-relaxed">
        Por dónde llega la gente, qué ha visto cada página y, sobre todo, <strong className="text-gray-800">qué sabe ya
        quien viene de ella</strong> antes de que la llames: si ha visto el precio o no cambia cómo empiezas la llamada.
      </p>

      <Agendar />

      {ETAPAS.map((et) => {
        const paginas = MAPA_WEB.filter((p) => p.etapa === et.id && !p.redirigeA)
        if (!paginas.length) return null
        return (
          <section key={et.id} className="space-y-2">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">{et.nombre}</h2>
              <p className="text-[12.5px] text-gray-500">{et.que}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {paginas.map((p) => {
                const url = enlace(p.ruta)
                const sabe = SABE_POR_RUTA[p.ruta]
                return (
                  <div key={p.ruta} className="rounded-xl border border-[#DDE6F5] bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-gray-900">{p.nombre}</p>
                      <div className="flex gap-1 shrink-0">
                        {p.precio ? (
                          <span className="rounded-full bg-[#E8FBF3] text-[#0E9F6E] px-2 py-0.5 text-[10.5px] font-semibold">con precio</span>
                        ) : (
                          <span className="rounded-full bg-[#F3F4F6] text-[#6B7590] px-2 py-0.5 text-[10.5px] font-semibold">sin precio</span>
                        )}
                        {p.ads ? (
                          <span className="rounded-full bg-[#FFFBF2] text-[#8A6A2A] px-2 py-0.5 text-[10.5px] font-semibold">anuncios</span>
                        ) : null}
                      </div>
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11.5px] text-[#025dc7] hover:underline break-all">
                        {p.ruta} <ExternalLink size={11} />
                      </a>
                    ) : (
                      <p className="font-mono text-[11.5px] text-[#5A6480]">{p.ruta}</p>
                    )}
                    <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">{p.que}</p>
                    {sabe ? (
                      <p className="text-[12.5px] mt-2 rounded-lg bg-[#F0F5FF] px-2.5 py-2 text-[#0a1656] leading-relaxed">
                        <strong>Si te llega de aquí:</strong> {sabe}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {isAdmin ? (
        <p className="text-[11.5px] text-[#9CA3AF]">
          Estas fichas están escritas a mano (las páginas viven en el otro repo). La lista que manda la propia web está en{' '}
          <a href="/dash/webs?tab=paginas" className="text-[#025dc7] hover:underline">
            Web → Lista técnica
          </a>
          .
        </p>
      ) : null}
    </div>
  )
}
