'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Sparkles, Check, AlertTriangle, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useCommunities } from '@/hooks/queries/useCommunity'
import { getAPIUrl } from '@services/config/config'

/**
 * Sembrar la comunidad antes de abrir las puertas.
 *
 * **De una en una, no las cinco de golpe.** Cinco presentaciones apareciendo el
 * mismo minuto no engañan a nadie: se lee a bulto. Una hoy, otra en dos días y
 * otra la semana que viene se lee como una comunidad que arranca.
 *
 * Por eso cada persona tiene su propio botón de añadir y de retirar. Retirar
 * borra sus mensajes y su cuenta, así que probar no es una decisión sin
 * marcha atrás.
 */

interface Persona {
  key: string
  nombre: string
  ciudad: string
  bio: string
  dentro: boolean
  mensajes: number
}

export default function SeedCommunity() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { data: communities } = useCommunities(org?.id)

  const [channelId, setChannelId] = useState<string>('')
  const [done, setDone] = useState<any>(null)
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  // Qué fila está trabajando ahora mismo (para su spinner).
  const [busy, setBusy] = useState<string | null>(null)

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
        if (alive && d) setPersonas(d.personas || [])
      })
      .catch(() => {
        /* si falla, simplemente no enseñamos el estado */
      })
    return () => {
      alive = false
    }
  }, [org?.id, accessToken, done])

  const reload = async () => {
    if (!org?.id || !accessToken) return
    const r = await fetch(`${getAPIUrl()}superadmin/seed/community/${org.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (r.ok) setPersonas((await r.json()).personas || [])
  }

  /** El motivo de verdad, no un "algo ha fallado". */
  const detalle = async (res: Response) => {
    try {
      const d = await res.json()
      if (d?.detail) return String(d.detail)
    } catch {
      /* no era JSON */
    }
    return `El servidor respondió ${res.status}`
  }

  const anadir = async (p: Persona) => {
    if (!org?.id || !channelId) return
    setBusy(p.key)
    try {
      const res = await fetch(
        `${getAPIUrl()}superadmin/seed/community/${org.id}/${channelId}?keys=${p.key}`,
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) throw new Error(await detalle(res))
      const data = await res.json()
      if (Array.isArray(data?.errores) && data.errores.length) {
        toast.error(data.errores.join(' · '), { duration: 12000 })
      } else {
        toast.success(`${p.nombre.split(' ')[0]} se ha presentado en ${data.canal}`)
      }
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo añadir', { duration: 12000 })
    } finally {
      setBusy(null)
    }
  }

  const retirar = async (p: Persona) => {
    if (!org?.id) return
    if (!window.confirm(
      `¿Retirar a ${p.nombre}? Se borran sus ${p.mensajes} mensaje(s) y su cuenta.`
    )) return
    setBusy(p.key)
    try {
      const res = await fetch(
        `${getAPIUrl()}superadmin/seed/community/${org.id}/persona/${p.key}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) throw new Error(await detalle(res))
      toast.success(`${p.nombre.split(' ')[0]} retirada`)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo retirar', { duration: 12000 })
    } finally {
      setBusy(null)
    }
  }


  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <Sparkles size={19} className="text-[#025dc7]" />
          <h2 className="text-[17px] font-bold text-gray-900">Sembrar la comunidad</h2>
        </div>
        <p className="text-[14px] text-[#5A6480] leading-relaxed">
          Para que los primeros alumnos no entren en una comunidad vacía. Cada
          persona se añade <strong>cuando tú quieras</strong> y se retira igual
          de fácil: al añadirla publica su presentación en el canal elegido; al
          retirarla se borran sus mensajes y su cuenta.
        </p>

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

        <div className="mt-4 space-y-2">
          {(personas ?? []).map((p) => (
            <div
              key={p.key}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                p.dentro ? 'bg-[#F7FAFF] border-[#CFE0F8]' : 'bg-white border-[#E7EEF9]'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1D0084]">{p.nombre}</span>
                  {p.dentro && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                      <Check size={11} /> dentro
                      {p.mensajes > 0 && ` · ${p.mensajes}`}
                    </span>
                  )}
                </span>
                <span className="block text-[12.5px] text-[#5A6480] truncate">{p.bio}</span>
              </span>

              {p.dentro ? (
                <button
                  onClick={() => retirar(p)}
                  disabled={busy === p.key}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  {busy === p.key ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                  Retirar
                </button>
              ) : (
                <button
                  onClick={() => anadir(p)}
                  disabled={busy === p.key || !channelId}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[13px] font-bold transition-colors disabled:opacity-50"
                >
                  {busy === p.key ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Añadir
                </button>
              )}
            </div>
          ))}
          {personas === null && (
            <p className="flex items-center gap-2 text-[13px] text-[#8A96AB] py-2">
              <Loader2 size={13} className="animate-spin" /> Cargando…
            </p>
          )}
        </div>

        <p className="mt-4 text-[12.5px] text-[#8A96AB] leading-relaxed">
          Añade a una, y a la siguiente dentro de unos días. Todas a la vez el
          mismo minuto se nota, y entonces la comunidad parece menos de verdad,
          no más.
        </p>
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
