'use client'

/**
 * Seguimiento de una persona: cuándo volver a llamarla y las notas de cada
 * llamada. Lo usan el closer y los administradores, dentro de la ficha de
 * Contactos y de cada llamada abierta.
 *
 * Existe porque el closer no tenía dónde apuntar nada: "llamar el jueves,
 * duda por el precio" acababa en una libreta o en la cabeza. Con la fecha
 * puesta, esa persona le sale arriba en Contactos el día que toca.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  anadirNota,
  borrarNota,
  cuandoLlamar,
  getSeguimiento,
  hoyISO,
  ponerRecordatorio,
  type NotaContacto,
  type VolverALlamar,
} from '@services/stats/contactos'
import { BellRing, Loader2, NotebookPen, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

function fechaHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Seguimiento({
  email,
  onCambioFecha,
}: {
  email: string
  /** Para que la lista de fuera marque la línea sin recargar. */
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const miId = session?.data?.user?.id
  const { isAdmin } = useAdminStatus()

  const [cargando, setCargando] = useState(true)
  const [notas, setNotas] = useState<NotaContacto[]>([])
  const [llamar, setLlamar] = useState<VolverALlamar | null>(null)
  const [texto, setTexto] = useState('')
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!org?.id || !accessToken || !email) return
    let vivo = true
    setCargando(true)
    getSeguimiento(org.id, email, accessToken).then((r) => {
      if (!vivo) return
      setNotas(r.datos?.notas ?? [])
      setLlamar(r.datos?.volver_a_llamar ?? null)
      setFecha(r.datos?.volver_a_llamar?.fecha ?? '')
      setMotivo(r.datos?.volver_a_llamar?.motivo ?? '')
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [org?.id, accessToken, email])

  async function guardarFecha(nueva: string, nuevoMotivo = motivo) {
    setGuardando(true)
    const r = await ponerRecordatorio(org?.id, email, nueva, nuevoMotivo, accessToken)
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    const v = r.datos?.volver_a_llamar ?? null
    setLlamar(v)
    setFecha(v?.fecha ?? '')
    if (!v) setMotivo('')
    onCambioFecha?.(email, v)
    toast.success(v ? `Volver a llamar ${cuandoLlamar(v.fecha)}` : 'Fecha quitada')
  }

  async function guardarNota() {
    if (!texto.trim()) return
    setGuardando(true)
    const r = await anadirNota(org?.id, email, texto, accessToken)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar la nota')
      return
    }
    setNotas((prev) => [r.datos as NotaContacto, ...prev])
    setTexto('')
  }

  async function quitarNota(n: NotaContacto) {
    if (!window.confirm('¿Borrar esta nota?')) return
    const r = await borrarNota(org?.id, n.id, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido borrar')
      return
    }
    setNotas((prev) => prev.filter((x) => x.id !== n.id))
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500 py-2">
        <Loader2 size={14} className="animate-spin" /> Cargando notas…
      </div>
    )
  }

  const vencida = llamar?.fecha && llamar.fecha < hoyISO()

  return (
    <div className="space-y-3">
      {/* Volver a llamar */}
      <div className="rounded-xl border border-[#DDE6F5] bg-white px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] flex items-center gap-1.5">
          <BellRing size={12} /> Volver a llamar
        </p>
        {llamar ? (
          <p className={`mt-1 text-[13.5px] font-semibold ${vencida ? 'text-red-600' : 'text-[#1D0084]'}`}>
            {vencida ? 'Se pasó la fecha: ' : ''}
            {cuandoLlamar(llamar.fecha)}
            {llamar.motivo ? <span className="font-normal text-gray-600"> · {llamar.motivo}</span> : null}
          </p>
        ) : (
          <p className="mt-1 text-[12.5px] text-gray-500">Sin fecha. Ponla si has quedado en volver a hablar.</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[
            { label: 'Mañana', dias: 1 },
            { label: 'En 3 días', dias: 3 },
            { label: 'En una semana', dias: 7 },
          ].map((o) => (
            <button
              key={o.dias}
              onClick={() => guardarFecha(hoyISO(o.dias))}
              disabled={guardando}
              className="px-2.5 py-1 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-semibold disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
          <input
            type="date"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => {
              setFecha(e.target.value)
              if (e.target.value) guardarFecha(e.target.value)
            }}
            className="px-2 py-1 rounded-lg border border-[#DDE6F5] text-[12px] text-[#1D0084] bg-white"
          />
          {llamar ? (
            <button
              onClick={() => guardarFecha('')}
              disabled={guardando}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <X size={12} /> Quitar
            </button>
          ) : null}
        </div>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          onBlur={() => {
            if (llamar && motivo !== (llamar.motivo || '')) guardarFecha(llamar.fecha, motivo)
          }}
          placeholder="Motivo (opcional): «lo habla con su pareja», «cobra el día 25»…"
          className="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] text-[12.5px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4da3ff]"
        />
      </div>

      {/* Notas */}
      <div className="rounded-xl border border-[#DDE6F5] bg-white px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] flex items-center gap-1.5">
          <NotebookPen size={12} /> Notas
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Qué le frena, qué le dijiste, qué quedó pendiente…"
          className="mt-2 w-full px-2.5 py-2 rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] text-[13px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4da3ff] resize-y"
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={guardarNota}
            disabled={guardando || !texto.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[12px] font-bold disabled:opacity-40"
          >
            Guardar nota
          </button>
        </div>
        {notas.length === 0 ? (
          <p className="text-[12px] text-gray-400 mt-1">Todavía no hay notas.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-lg bg-[#F7FAFF] border border-[#E7EEF9] px-3 py-2">
                <p className="text-[13px] text-gray-900 whitespace-pre-wrap break-words">{n.texto}</p>
                <p className="mt-1 text-[11px] text-gray-500 flex items-center justify-between gap-2">
                  <span>
                    {n.autor} · {fechaHora(n.created_at)}
                  </span>
                  {isAdmin || n.autor_id === miId ? (
                    <button onClick={() => quitarNota(n)} aria-label="Borrar nota" className="text-gray-400 hover:text-red-600">
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
