'use client'

/**
 * Insignias de la formación (13/11/2026): una por módulo superado.
 * - `TusInsignias`: la fila de Mi progreso, con las conseguidas y las que
 *   faltan (cuántas clases quedan para la siguiente).
 * - `InsigniaNueva`: la tarjeta del Inicio cuando acaba de conseguir una, con
 *   «Compartir en Victorias» (ve y cambia el texto antes de publicar) y
 *   «Ahora no». Las dos la quitan con la misma marca que la campana.
 * Sobrio a propósito: un círculo con borde y el número, sin medallas de
 * colores (regla de la escuela: nada que parezca un juego infantil).
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getInsignias, textoParaCompartir, type Insignia, type MisInsignias } from '@services/student/insignias'
import { getCommunities, type Community } from '@services/communities/communities'
import { createDiscussion } from '@services/communities/discussions'
import { dismissNotification } from '@services/communities/engagement'
import { canalVictorias, comoPublicacion } from '@/lib/communities/canales'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const AZUL = '#0b2da0'

function useInsignias() {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const q = useQuery<MisInsignias>({
    queryKey: ['insignias', token ? 'yo' : ''],
    queryFn: () => getInsignias(token),
    enabled: !!token,
    staleTime: 60_000,
  })
  return { ...q, token }
}

function dia(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function Sello({ i, size = 52 }: { i: Insignia; size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        border: i.conseguida ? `2px solid ${AZUL}` : '2px dashed #C9D1E3',
        color: i.conseguida ? AZUL : '#A3AAC2',
        background: i.conseguida ? '#F2F6FE' : 'transparent',
      }}
    >
      <span className="font-bold tabular-nums" style={{ ...POPPINS, fontSize: size * 0.4, lineHeight: 1 }}>
        {i.numero}
      </span>
      {i.conseguida ? (
        <span
          className="absolute -right-1 -bottom-1 inline-flex items-center justify-center rounded-full bg-white"
          style={{ width: size * 0.38, height: size * 0.38, border: '2px solid #16A34A', color: '#16A34A' }}
        >
          <Check size={size * 0.2} strokeWidth={3.4} />
        </span>
      ) : null}
    </span>
  )
}

export function TusInsignias() {
  const { data } = useInsignias()
  const lista = data?.insignias || []
  if (!lista.length) return null
  const conseguidas = lista.filter((i) => i.conseguida).length
  const siguiente = lista.find((i) => !i.conseguida && i.total > 0)
  const faltan = siguiente ? Math.max(0, siguiente.necesarias - siguiente.hechas) : 0
  return (
    <section id="insignias" className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[17px] font-bold text-[#0B1033]" style={POPPINS}>
          Tus insignias
        </h2>
        <p className="text-[13px] text-[#5B6382]">
          {conseguidas} de {lista.length}
        </p>
      </div>
      <div className="rounded-2xl border border-[#E4E8F2] bg-white p-4 sm:p-5">
        <ul className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
          {lista.map((i) => (
            <li key={i.id} className="flex flex-col items-center text-center shrink-0 w-[76px]" title={i.nombre}>
              <Sello i={i} />
              <span className={`mt-2 text-[12px] font-semibold leading-tight ${i.conseguida ? 'text-[#0B1033]' : 'text-[#8A91AD]'}`}>Módulo {i.numero}</span>
              <span className="text-[11.5px] text-[#8A91AD] leading-tight">{i.conseguida ? dia(i.cuando) : i.total ? `${i.hechas} de ${i.necesarias}` : 'Pronto'}</span>
            </li>
          ))}
        </ul>
        {siguiente ? (
          <p className="mt-3 text-[13.5px] text-[#3B4262]">
            {faltan > 0 ? (
              <>
                Te {faltan === 1 ? 'queda' : 'quedan'} <strong className="font-semibold text-[#0B1033]">{faltan} {faltan === 1 ? 'clase' : 'clases'}</strong> para la insignia del
                módulo {siguiente.numero}
                {siguiente.nombre ? ` (${siguiente.nombre})` : ''}.
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] text-[#3B4262]">Las tienes todas.</p>
        )}
      </div>
    </section>
  )
}

export function InsigniaNueva({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const { data, token } = useInsignias()
  const qc = useQueryClient()
  const [compartir, setCompartir] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [publicada, setPublicada] = useState<{ numero: number; href: string } | null>(null)
  // La más reciente primero: es la que acaba de conseguir.
  const nueva = [...(data?.nuevas || [])].sort((a, b) => (b.cuando || '').localeCompare(a.cuando || ''))[0]

  const { data: victorias } = useQuery<Community | null>({
    queryKey: ['comunidad', 'victorias', org?.id],
    queryFn: async () => canalVictorias<Community>(((await getCommunities(org.id, 1, 50, null, token)) || []) as Community[]),
    enabled: !!org?.id && !!token && !!nueva,
    staleTime: 5 * 60_000,
  })

  if (publicada) {
    return (
      <div className="rounded-2xl border border-[#E4E8F2] bg-white px-4 py-3.5 text-[14px] text-[#3B4262]">
        Compartido en Victorias.{' '}
        <Link href={publicada.href} className="font-semibold text-[#025dc7] hover:underline">
          Verlo
        </Link>
      </div>
    )
  }
  if (!nueva) return null
  const t = textoParaCompartir(nueva)

  async function quitar() {
    await dismissNotification(nueva!.id, token)
    qc.setQueryData<MisInsignias>(['insignias', 'yo'], (d) => (d ? { ...d, nuevas: d.nuevas.filter((x) => x.id !== nueva!.id) } : d))
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function publicar() {
    if (!victorias || enviando) return
    setEnviando(true)
    setError('')
    try {
      const p = comoPublicacion(texto.trim() || t.texto, t.titulo)
      await createDiscussion(victorias.community_uuid, { ...p, label: 'general', emoji: null }, token)
      const href = getUriWithOrg(orgslug, `/community/${victorias.community_uuid.replace('community_', '')}`)
      await quitar()
      setPublicada({ numero: nueva!.numero, href })
      qc.invalidateQueries({ queryKey: ['comunidad', 'feed'] })
    } catch (e: any) {
      setError(String(e?.message || 'No se ha podido publicar. Prueba otra vez.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#C9D6F5] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <Sello i={nueva} size={60} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Insignia nueva</p>
          <p className="text-[18px] font-bold text-[#0B1033] leading-snug" style={POPPINS}>
            Has superado el módulo {nueva.numero}
          </p>
          {nueva.nombre ? <p className="text-[13.5px] text-[#5B6382]">{nueva.nombre}</p> : null}
        </div>
      </div>
      {compartir ? (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-[#0B1033]">{t.titulo}</p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-[#DDE3F0] px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]"
          />
          <p className="mt-1 text-[12px] text-[#8A91AD]">Sale en Victorias con tu nombre. Puedes contar qué te ha costado más o qué has usado ya en la calle.</p>
          {error ? <p className="mt-1.5 text-[13px] text-red-600">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={publicar} disabled={enviando} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-50">
              {enviando ? 'Publicando…' : 'Publicar en Victorias'}
            </button>
            <button type="button" onClick={() => setCompartir(false)} className="h-9 px-3.5 rounded-lg border border-[#E4E8F2] text-[13.5px] font-semibold text-[#3B4262]">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {victorias ? (
            <button
              type="button"
              onClick={() => {
                setTexto(t.texto)
                setCompartir(true)
              }}
              className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold"
            >
              Compartir en Victorias
            </button>
          ) : null}
          <Link href={getUriWithOrg(orgslug, '/ejercicios/progreso#insignias')} className="h-9 px-3.5 inline-flex items-center rounded-lg border border-[#E4E8F2] text-[13.5px] font-semibold text-[#0b2da0]">
            Ver mis insignias
          </Link>
          <button type="button" onClick={quitar} className="h-9 px-2 text-[13.5px] font-medium text-[#6B7393] hover:text-[#0B1033]">
            Ahora no
          </button>
        </div>
      )}
    </div>
  )
}
