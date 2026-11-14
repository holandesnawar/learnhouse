'use client'

/**
 * Inicio → «Comparte algo con la comunidad» (13/11/2026). Antes era un botón
 * que llevaba a un canal; ahora se escribe aquí mismo, con tu foto, y sale en
 * el canal general de alumnos (usuario: «poder escribir ahí directamente tu
 * mensaje y enviar a la general»). Sin canal general a la vista, lleva al
 * primer tablón, como antes.
 */

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { createDiscussion } from '@services/communities/discussions'
import { canalGeneral, comoPublicacion, type CanalMinimo } from '@/lib/communities/canales'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'

export default function EscribirEnComunidad({
  canales,
  respaldo,
  hrefDe,
  onPublicado,
}: {
  canales: CanalMinimo[]
  /** Adonde llevar si no hay canal general. */
  respaldo?: CanalMinimo | null
  hrefDe: (c: CanalMinimo) => string
  onPublicado?: () => void
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const u = session?.data?.user || {}
  const nombre: string = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || ''
  const foto = u.avatar_image && u.user_uuid ? getUserAvatarMediaDirectory(u.user_uuid, u.avatar_image) : ''
  const general = canalGeneral(canales)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(false)
  const caja = useRef<HTMLTextAreaElement | null>(null)
  const ocupado = useRef(false)

  if (!general) {
    if (!respaldo) return null
    return (
      <Link href={hrefDe(respaldo)} className="rounded-2xl border border-[#E4E8F2] bg-white flex items-center gap-3 px-4 py-3 mb-4 hover:border-[#C9D4EC]">
        <AvatarPersona nombre={nombre} src={foto} size={36} />
        <span className="flex-1 text-[14px] text-[#8A91AD]">Comparte algo con la comunidad…</span>
        <span className="h-8 px-3 rounded-lg bg-[#0b2da0] text-white text-[13px] font-semibold flex items-center">Publicar</span>
      </Link>
    )
  }

  const nombreCanal = splitChannelEmoji(general.name).text || general.name

  function crecer() {
    const t = caja.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 220)}px`
  }

  async function publicar() {
    const limpio = texto.trim()
    if (!limpio || ocupado.current) return
    ocupado.current = true
    setEnviando(true)
    setError('')
    try {
      const p = comoPublicacion(limpio)
      await createDiscussion(general!.community_uuid, { ...p, label: 'general', emoji: null }, token)
      setTexto('')
      setHecho(true)
      requestAnimationFrame(crecer)
      onPublicado?.()
    } catch (e: any) {
      setError(String(e?.message || 'No se ha podido publicar. Prueba otra vez.'))
    } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#E4E8F2] bg-white px-4 py-3 mb-4 focus-within:border-[#C9D4EC]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <AvatarPersona nombre={nombre} src={foto} size={36} />
        </span>
        <textarea
          ref={caja}
          value={texto}
          rows={1}
          onChange={(e) => {
            setTexto(e.target.value)
            setHecho(false)
            crecer()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              publicar()
            }
          }}
          placeholder="Comparte algo con la comunidad…"
          aria-label={`Escribir en ${nombreCanal}`}
          className="flex-1 min-w-0 resize-none bg-transparent py-2 text-[14.5px] leading-snug text-[#0B1033] placeholder:text-[#8A91AD] outline-none"
        />
        <button
          type="button"
          onClick={publicar}
          disabled={enviando || !texto.trim()}
          className="shrink-0 mt-0.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-40"
        >
          {enviando ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
      {error ? <p className="mt-2 pl-12 text-[13px] text-red-600">{error}</p> : null}
      {hecho ? (
        <p className="mt-2 pl-12 text-[13px] text-[#3B4262]">
          Publicado en {nombreCanal}.{' '}
          <Link href={hrefDe(general)} className="font-semibold text-[#025dc7] hover:underline">
            Verlo
          </Link>
        </p>
      ) : texto.trim() ? (
        <p className="mt-1 pl-12 text-[12px] text-[#8A91AD]">Sale en {nombreCanal}, lo ven todos los alumnos.</p>
      ) : null}
    </div>
  )
}
