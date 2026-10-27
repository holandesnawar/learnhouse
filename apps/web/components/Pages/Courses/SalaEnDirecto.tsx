'use client'

/**
 * La sala en directo de un curso, en su página (27/10/2026, empezando por el
 * Spreekclub): «Entrar a la sala» lleva a la videollamada DENTRO de la
 * escuela, con el nombre puesto. Ver apps/api/src/services/salas/salas.py.
 *
 * - Alumno: solo la ve si la sala está encendida, con quién hay dentro.
 * - Administrador: la ve siempre; la enciende, decide si se graba sola al
 *   entrar el profe y baja las grabaciones.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Video, Users, Circle, Download, ChevronDown, ChevronUp, Power, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  enlaceGrabacion,
  getGrabaciones,
  getSala,
  guardarSala,
  rutaSala,
  type EstadoSala,
  type Grabacion,
} from '@services/salas/salas'

const fechaNL = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        timeZone: 'Europe/Amsterdam',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const duracion = (seg: number) => {
  const min = Math.round(seg / 60)
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`
}

function Grabaciones({ curso, token }: { curso: string; token: string }) {
  const [lista, setLista] = useState<Grabacion[] | null>(null)
  const [error, setError] = useState('')
  const [bajando, setBajando] = useState('')

  useEffect(() => {
    getGrabaciones(curso, token)
      .then((r) => setLista(r.grabaciones))
      .catch((e) => setError(e.message))
  }, [curso, token])

  async function bajar(id: string) {
    setBajando(id)
    try {
      const { url } = await enlaceGrabacion(curso, id, token)
      window.open(url, '_blank', 'noopener')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBajando('')
    }
  }

  if (error) return <p className="text-[13px] text-red-700">{error}</p>
  if (!lista) return <p className="text-[13px] text-[#5A6480]">Cargando…</p>
  if (!lista.length)
    return (
      <p className="text-[13px] text-[#5A6480]">
        Aún no hay grabaciones. Se graba sola cuando entra alguien del equipo (si la grabación está puesta).
      </p>
    )
  return (
    <ul className="divide-y divide-[#E5E7EB]">
      {lista.map((g) => (
        <li key={g.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-gray-900 capitalize">{fechaNL(g.inicio)}</p>
            <p className="text-[12px] text-[#5A6480]">
              {duracion(g.duracion_seg)}
              {g.personas ? ` · ${g.personas} personas` : ''}
              {g.estado && g.estado !== 'finished' ? ` · ${g.estado === 'in-progress' ? 'grabando ahora' : g.estado}` : ''}
            </p>
          </div>
          <button
            onClick={() => bajar(g.id)}
            disabled={!!bajando || g.estado === 'in-progress'}
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#025dc7] border border-[#E5E7EB] hover:border-[#025dc7] rounded-lg px-2.5 py-1.5 disabled:opacity-50"
          >
            <Download size={14} /> {bajando === g.id ? 'Preparando…' : 'Descargar'}
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function SalaEnDirecto({ courseUuid }: { courseUuid: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const [sala, setSala] = useState<EstadoSala | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [verGrabaciones, setVerGrabaciones] = useState(false)

  const cargar = useCallback(() => {
    if (!token || !curso) return
    getSala(curso, token)
      .then(setSala)
      .catch(() => setSala(null))
  }, [curso, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Quién hay dentro, al día mientras la página está a la vista.
  useEffect(() => {
    if (!sala?.activo) return
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') cargar()
    }, 30000)
    return () => window.clearInterval(t)
  }, [sala?.activo, cargar])

  async function cambiar(cambios: { activo?: boolean; grabar?: boolean }) {
    setGuardando(true)
    try {
      const r = await guardarSala(curso, cambios, token)
      setSala((s) => (s ? { ...s, ...r } : s))
      toast.success(
        cambios.activo === true
          ? 'Sala encendida'
          : cambios.activo === false
            ? 'Sala apagada'
            : r.grabar
              ? 'Se grabará sola al entrar el profe'
              : 'Ya no se graba'
      )
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!sala) return null
  if (!sala.activo && !sala.admin) return null

  // Apagada: solo la ve el administrador, en una línea, para encenderla.
  if (!sala.activo) {
    return (
      <div className="w-full rounded-2xl bg-white border border-[#E5E7EB] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 flex items-center gap-2">
            <Video size={16} className="text-[#025dc7]" /> Sala en directo dentro de la escuela · apagada
          </p>
          <p className="text-[13px] text-[#5A6480] mt-0.5">
            Al encenderla, quien ve este curso entra a la videollamada aquí mismo, sin otra pestaña y con su nombre
            puesto. Solo la ves tú.
          </p>
          {!sala.con_clave && (
            <p className="text-[12.5px] text-[#8A6A2A] mt-1">Falta la clave de Daily en Railway (LEARNHOUSE_DAILY_API_KEY).</p>
          )}
        </div>
        <button
          onClick={() => cambiar({ activo: true })}
          disabled={guardando}
          className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-2 px-3.5 rounded-lg text-[13.5px] disabled:opacity-50"
        >
          <Power size={15} /> Encender la sala
        </button>
      </div>
    )
  }

  const dentro = sala.presentes
  return (
    <div className="w-full rounded-2xl bg-white border border-[#DDE6F5] p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#025dc7] flex items-center gap-1.5">
            <Video size={14} /> Sala en directo
          </p>
          <p className="text-[15px] font-semibold text-gray-900 mt-1 flex items-center gap-2">
            {dentro.length ? (
              <>
                <Circle size={9} className="fill-[#16A34A] text-[#16A34A] shrink-0" />
                {dentro.length === 1 ? 'Hay 1 persona dentro' : `Hay ${dentro.length} personas dentro`}
              </>
            ) : (
              <>
                <Users size={16} className="text-[#5A6480] shrink-0" /> Ahora no hay nadie dentro
              </>
            )}
          </p>
          {dentro.length > 0 && <p className="text-[13px] text-[#3F4A61] mt-0.5 truncate">{dentro.join(', ')}</p>}
          <p className="text-[12.5px] text-[#5A6480] mt-1.5">
            Entras con tu nombre, sin salir de la escuela.
            {sala.grabar ? ' La sesión se graba cuando entra el profe.' : ''}
          </p>
        </div>
        <Link
          href={rutaSala(curso)}
          className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-2.5 px-4 rounded-lg text-[14px]"
        >
          <Video size={16} strokeWidth={2.5} /> Entrar a la sala
        </Link>
      </div>

      {sala.admin && (
        <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-3">
          {!sala.con_clave && (
            <p className="text-[12.5px] text-[#8A6A2A] flex items-center gap-1.5">
              <AlertTriangle size={14} /> Falta la clave de Daily en Railway (LEARNHOUSE_DAILY_API_KEY).
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
              <input
                type="checkbox"
                checked={sala.grabar}
                disabled={guardando}
                onChange={(e) => cambiar({ grabar: e.target.checked })}
                className="accent-[#025dc7]"
              />
              Grabar sola cuando entra alguien del equipo
            </label>
            <button
              onClick={() => setVerGrabaciones((v) => !v)}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#025dc7]"
            >
              Grabaciones {verGrabaciones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={() => cambiar({ activo: false })}
              disabled={guardando}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5A6480] hover:text-gray-900"
            >
              <Power size={13} /> Apagar la sala
            </button>
          </div>
          {verGrabaciones && <Grabaciones curso={curso} token={token} />}
          <p className="text-[12px] text-[#5A6480]">Solo lo ves tú (administradores).</p>
        </div>
      )}
    </div>
  )
}
