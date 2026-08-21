'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Sparkles, Users, Check, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useCommunities } from '@/hooks/queries/useCommunity'
import { getAPIUrl } from '@services/config/config'

/**
 * Sembrar la comunidad antes de abrir las puertas.
 *
 * El primero que entra no debería encontrarse una casa vacía: aquí se crean
 * cinco cuentas de arranque con sus presentaciones, para que la conversación
 * ya esté empezada.
 *
 * Se puede pulsar dos veces sin miedo: lo que ya existe no se duplica.
 */

const PERSONAS = [
  { name: 'Marta', detail: 'Rotterdam · pareja neerlandesa' },
  { name: 'Cristian', detail: 'Ámsterdam · hostelería' },
  { name: 'Lucía', detail: 'Utrecht · hijos en el colegio' },
  { name: 'Diego', detail: 'Eindhoven · quiere el inburgering' },
  { name: 'Yasmina', detail: 'La Haya · empieza de cero' },
]

export default function SeedCommunity() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { data: communities } = useCommunities(org?.id)

  const [channelId, setChannelId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<any>(null)
  const [existing, setExisting] = useState<string[] | null>(null)

  const channels: any[] = Array.isArray(communities) ? communities : []

  useEffect(() => {
    if (!channelId && channels.length) setChannelId(String(channels[0].id))
  }, [channels, channelId])

  // Qué cuentas hay ya, para no sembrar dos veces sin saberlo.
  useEffect(() => {
    if (!org?.id || !accessToken) return
    let alive = true
    fetch(`${getAPIUrl()}superadmin/seed/community/${org.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setExisting(d.existentes || [])
      })
      .catch(() => {
        /* si falla, simplemente no enseñamos el estado */
      })
    return () => {
      alive = false
    }
  }, [org?.id, accessToken, done])

  const run = async () => {
    if (!org?.id || !channelId) return
    setRunning(true)
    try {
      const res = await fetch(
        `${getAPIUrl()}superadmin/seed/community/${org.id}/${channelId}`,
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) {
        // El motivo de verdad, no un "algo ha fallado": sin él no hay forma de
        // saber qué arreglar.
        let detail = `El servidor respondió ${res.status}`
        try {
          const data = await res.json()
          if (data?.detail) detail = String(data.detail)
        } catch {
          const text = await res.text().catch(() => '')
          if (text) detail = text.slice(0, 300)
        }
        throw new Error(detail)
      }
      const data = await res.json()
      setDone(data)
      // Puede haber ido bien a medias: cuatro personas sí y una no.
      if (Array.isArray(data?.errores) && data.errores.length > 0) {
        toast.error(`No se pudo con: ${data.errores.join(' · ')}`, { duration: 12000 })
      } else {
        toast.success('Comunidad sembrada')
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo sembrar', { duration: 12000 })
      console.error(e)
    } finally {
      setRunning(false)
    }
  }

  const yaSembrado = (existing?.length ?? 0) >= PERSONAS.length

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <Sparkles size={19} className="text-[#025dc7]" />
          <h2 className="text-[17px] font-bold text-gray-900">Sembrar la comunidad</h2>
        </div>
        <p className="text-[14px] text-[#5A6480] leading-relaxed">
          Crea cinco cuentas de arranque y publica sus presentaciones en el canal
          que elijas, para que los primeros alumnos no entren en una comunidad
          vacía. Puedes pulsarlo dos veces: lo que ya existe no se duplica.
        </p>

        <div className="mt-4 rounded-xl bg-[#F8FAFF] border border-[#E7EEF9] p-4">
          <p className="text-[11px] font-semibold text-[#8A96AB] uppercase tracking-[0.08em] mb-2.5">
            Quiénes son
          </p>
          <ul className="space-y-1.5">
            {PERSONAS.map((p) => {
              const created = existing?.includes(
                // El backend devuelve nombre y apellido; basta con el nombre.
                existing.find((e) => e.startsWith(p.name)) || ''
              )
              return (
                <li key={p.name} className="flex items-center gap-2 text-[13.5px]">
                  {created ? (
                    <Check size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <Users size={13} className="text-[#8A96AB] shrink-0" />
                  )}
                  <span className="font-semibold text-[#1D0084]">{p.name}</span>
                  <span className="text-[#5A6480]">· {p.detail}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-4 space-y-1.5">
          <label className="text-[13px] font-semibold text-[#0a1656]">
            ¿En qué canal se publican?
          </label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded-lg bg-[#F0F5FF] border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] transition-colors"
          >
            {channels.length === 0 && <option value="">No hay canales todavía</option>}
            {channels.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={run}
          disabled={running || !channelId}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-sm font-bold transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {yaSembrado ? 'Volver a publicar lo que falte' : 'Sembrar la comunidad'}
        </button>

        {done && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <p className="text-[13.5px] text-emerald-800 leading-relaxed">
              Listo en <strong>{done.canal}</strong>: {done.mensajes_publicados}{' '}
              {done.mensajes_publicados === 1 ? 'mensaje publicado' : 'mensajes publicados'}
              {done.mensajes_ya_estaban > 0 && ` · ${done.mensajes_ya_estaban} ya estaban`}
              {done.cuentas_creadas?.length > 0 &&
                ` · cuentas nuevas: ${done.cuentas_creadas.join(', ')}`}
              .
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#EFE3C9] bg-[#FFFBF2] p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-[#8A6A2A]" />
          <h3 className="text-[14px] font-semibold text-[#8A6A2A]">Antes de pulsar</h3>
        </div>
        <ul className="space-y-2 text-[13.5px] text-[#5A6480] leading-relaxed">
          <li>
            · Estas cuentas <strong>se presentan y preguntan dudas</strong>, nada
            más. No opinan del producto: un testimonio falso es otra cosa y no
            está aquí.
          </li>
          <li>
            · <strong>No reciben correos</strong> y <strong>no se puede entrar</strong>{' '}
            con ellas.
          </li>
          <li>
            · Cuentan como alumnos, así que <strong>te tuercen las Estadísticas</strong>{' '}
            (activación, retención, margen). Quedan apuntadas en la configuración
            de la escuela para poder descontarlas.
          </li>
          <li>
            · <strong>Retíralas en la semana 2</strong>, cuando ya haya gente de
            verdad: que dejen de escribir, sin borrarlas de golpe.
          </li>
        </ul>
      </div>
    </div>
  )
}
