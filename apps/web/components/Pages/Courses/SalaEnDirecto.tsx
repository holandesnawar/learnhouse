'use client'

/**
 * La sala en directo de un curso, en su página (27/10/2026, empezando por el
 * Spreekclub): «Entrar a la sala» lleva a la videollamada DENTRO de la
 * escuela, con el nombre puesto. Ver apps/api/src/services/salas/salas.py.
 *
 * - Alumno: solo la ve si la sala está encendida, con quién hay dentro.
 * - El equipo (administradores, moderadores y profes, desde el 02/11/2026):
 *   la ve siempre; la enciende, la apaga y baja las grabaciones. Se graba
 *   SIEMPRE, sola, en cuanto entra alguien: ya no hay casilla (02/11/2026,
 *   "graba de principio a fin y listo"). Al alumno solo se le dice aquí, en
 *   una línea antes de entrar («La sesión se graba»); dentro de la sala, nada.
 *   La etiqueta («Groep rood»), solo los administradores.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Video, Users, Circle, Download, ChevronDown, ChevronUp, Power, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { ajustesDirecto, conGrabadas } from '@/lib/nawar/cursos'
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
        Aún no hay grabaciones. Cada clase se graba sola, de principio a fin, en cuanto entra alguien a la sala.
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

/**
 * `soloAjustes` (27/10/2026): en una clase en directo (la clase semanal y las
 * que se crean como ella) la entrada va en su recuadro, «Ir a la clase», así
 * que aquí solo quedan los ajustes del administrador. El alumno no ve nada.
 */
export default function SalaEnDirecto({ courseUuid, soloAjustes = false }: { courseUuid: string; soloAjustes?: boolean }) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const grabadas = conGrabadas(org?.config?.config, curso)
  const etiquetaGuardada = ajustesDirecto(org?.config?.config, curso).etiqueta
  const [etiqueta, setEtiqueta] = useState(etiquetaGuardada)
  // La configuración de la escuela puede llegar después de pintar.
  useEffect(() => setEtiqueta(etiquetaGuardada), [etiquetaGuardada])
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

  async function guardarEtiqueta() {
    const texto = etiqueta.trim()
    if (texto === etiquetaGuardada) return
    setGuardando(true)
    try {
      await guardarSala(curso, { etiqueta: texto }, token)
      toast.success(texto ? `Etiqueta: ${texto}` : 'Etiqueta quitada')
      // La barra y el título la leen de la configuración de la escuela.
      window.setTimeout(() => window.location.reload(), 700)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiar(cambios: { activo?: boolean; grabadas?: boolean }) {
    setGuardando(true)
    try {
      const r = await guardarSala(curso, cambios, token)
      setSala((s) => (s ? { ...s, ...r } : s))
      // Encender o apagar cambia cómo se pinta el curso entero (su recuadro,
      // «Ir a la clase»): se recarga para que lo coja de la escuela.
      if (cambios.activo !== undefined || cambios.grabadas !== undefined) window.setTimeout(() => window.location.reload(), 700)
      toast.success(
        cambios.grabadas !== undefined
          ? cambios.grabadas
            ? 'Las clases grabadas vuelven a salir en esta página'
            : 'Las clases grabadas ya no salen en esta página'
          : cambios.activo === true
          ? 'Sala encendida'
          : 'Sala apagada'
      )
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!sala) return null
  if (!sala.equipo && (soloAjustes || !sala.activo)) return null

  // ¿Enseña esta página sus clases grabadas? (27/10: en Spreekclub no van, y
  // por ahora en Masterclass tampoco). Solo en las clases en directo, con la
  // sala encendida o apagada.
  // Y la etiqueta que solo ve el administrador (29/10: «Groep rood» /
  // «Groep blauw»), para distinguir dos copias de la misma clase.
  const casillaGrabadas = soloAjustes ? (
    <div className="flex flex-col gap-2.5">
      <label className="inline-flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
        <input
          type="checkbox"
          checked={grabadas}
          disabled={guardando}
          onChange={(e) => cambiar({ grabadas: e.target.checked })}
          className="accent-[#025dc7]"
        />
        Enseñar las clases grabadas en esta página
      </label>
      {/* La etiqueta, solo administradores (02/11: "que no la pueda cambiar el profe"). */}
      {sala.admin ? (
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-gray-900">
        <span>Etiqueta (solo la ven los administradores)</span>
        <input
          value={etiqueta}
          maxLength={30}
          disabled={guardando}
          placeholder="Groep rood"
          onChange={(e) => setEtiqueta(e.target.value)}
          onBlur={guardarEtiqueta}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="h-8 w-40 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[13px] text-gray-900 outline-none focus:border-gray-900"
        />
      </label>
      ) : null}
    </div>
  ) : null

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
            puesto{soloAjustes ? ', y «Ir a la clase» lleva a la sala en vez de a Zoom' : ''}. Solo lo ve el equipo.
          </p>
          {!sala.con_clave && (
            <p className="text-[12.5px] text-[#8A6A2A] mt-1">Falta la clave de Daily en Railway (LEARNHOUSE_DAILY_API_KEY).</p>
          )}
          {casillaGrabadas ? <div className="mt-2.5">{casillaGrabadas}</div> : null}
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

  const ajustesAdmin = (clase: string) => (
    <div className={clase}>
      {!sala.con_clave && (
        <p className="text-[12.5px] text-[#8A6A2A] flex items-center gap-1.5">
          <AlertTriangle size={14} /> Falta la clave de Daily en Railway (LEARNHOUSE_DAILY_API_KEY).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {casillaGrabadas}
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
      <p className="text-[12px] text-[#5A6480]">Solo lo ve el equipo (administradores y profes).</p>
    </div>
  )

  // En una clase en directo, solo los ajustes, en una tarjeta pequeña.
  if (soloAjustes) {
    return (
      <div className="w-full rounded-2xl bg-white border border-[#E5E7EB] p-4">
        <p className="text-[14px] font-semibold text-gray-900 flex items-center gap-2">
          <Video size={16} className="text-[#025dc7]" /> Sala en directo · encendida
          <span className="font-normal text-[#5A6480]">
            · {sala.presentes.length ? `${sala.presentes.length} dentro ahora` : 'nadie dentro ahora'}
          </span>
        </p>
        {ajustesAdmin('mt-3 space-y-3')}
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
            Entras con tu nombre, sin salir de la escuela. La sesión se graba.
          </p>
        </div>
        <Link
          href={rutaSala(curso)}
          className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-2.5 px-4 rounded-lg text-[14px]"
        >
          <Video size={16} strokeWidth={2.5} /> Entrar a la sala
        </Link>
      </div>

      {sala.equipo && ajustesAdmin('mt-4 pt-4 border-t border-[#E5E7EB] space-y-3')}
    </div>
  )
}
