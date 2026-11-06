'use client'

/**
 * «Avisar a la clase» (06/11/2026), desde cada semana de una clase en directo
 * (el equipo). Se elige a quién (toda la clase o los que aún no han hecho algo
 * de esa semana), por dónde (la campana de la escuela y/o el correo) y el
 * texto, que sale ya escrito según a quién va. «Mandármelo a mí» lo enseña
 * antes en tu bandeja y nada sale solo. Lo hace el servidor (`avisar_clase` en
 * apps/api/src/services/tareas/tareas.py).
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Bell, Loader2, Mail, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { confirmar } from '@lib/nawar/confirmar'
import { avisarClase, diaCorto, getDestinatarios, type Semana } from '@services/tareas/tareas'

const CAMPO =
  'w-full rounded-lg border border-[#DDE6F5] px-3 py-2 text-[14px] text-gray-900 outline-none focus:border-[#025dc7] bg-white'

/** El texto de serie para cada filtro. El correo ya empieza con «Hola {nombre},». */
export function textoDeSerie(filtro: string, s: Pick<Semana, 'tema' | 'limite'>): { titulo: string; texto: string } {
  const tema = s.tema || 'esta semana'
  switch (filtro) {
    case 'sin_presentacion':
      return {
        titulo: `Mira la presentación de ${tema}`,
        texto: 'Ya tienes la presentación de la clase en la página de tu clase. Échale un vistazo antes: así la aprovechas mucho más.',
      }
    case 'sin_grabacion':
      return {
        titulo: `Ya está la grabación de ${tema}`,
        texto: 'Ya puedes ver la grabación de la clase. Si no pudiste venir o quieres repasarla, la tienes en la página de tu clase.',
      }
    case 'sin_ejercicios':
      return {
        titulo: `Te quedan los ejercicios de ${tema}`,
        texto: 'Los ejercicios de esta semana te ayudan a fijar lo de la clase. Son unos minutos y los tienes en la página de tu clase.',
      }
    case 'sin_tarea':
      return {
        titulo: `Recuerda la tarea de ${tema}`,
        texto: `Recuerda que puedes entregar la tarea hasta el ${diaCorto(s.limite)}. Con texto o con una nota de voz, como prefieras: te la corregimos.`,
      }
    case 'sin_clase':
      return {
        titulo: `Te echamos de menos en la clase de ${tema}`,
        texto: 'En la clase no te vimos. Ya tienes la grabación en la página de tu clase para ponerte al día cuando puedas.',
      }
    default:
      return {
        titulo: `Esta semana: ${tema}`,
        texto: 'Ya tienes todo lo de esta semana en la página de tu clase: la presentación, la grabación y la tarea.',
      }
  }
}

export function AvisarClase({ semana, onClose }: { semana: Semana; onClose: () => void }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const queryClient = useQueryClient()
  const clave = ['tareas', 'destinatarios', semana.id]
  const { data, error, isLoading } = useQuery({
    queryKey: clave,
    queryFn: () => getDestinatarios(semana.id, token),
    enabled: !!token,
    staleTime: 0,
  })
  const [filtro, setFiltro] = useState('todos')
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [tocado, setTocado] = useState(false)
  const [campana, setCampana] = useState(true)
  const [correo, setCorreo] = useState(false)
  const [verNombres, setVerNombres] = useState(false)
  const [enviando, setEnviando] = useState('')

  // El texto cambia con el filtro mientras no se haya escrito a mano.
  useEffect(() => {
    if (tocado) return
    const t = textoDeSerie(filtro, semana)
    setTitulo(t.titulo)
    setTexto(t.texto)
  }, [filtro, semana, tocado])

  const elegido = useMemo(() => data?.filtros.find((f) => f.id === filtro), [data, filtro])
  const n = elegido?.alumnos.length || 0

  async function prueba() {
    if (!titulo.trim() || !texto.trim()) return toast.error('Escribe el título y el aviso')
    setEnviando('prueba')
    try {
      const r = await avisarClase(semana.id, { filtro, titulo, texto, campana, correo: true, prueba: true }, token)
      toast.success(`Te lo he mandado a ${r.a}`)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo mandar')
    } finally {
      setEnviando('')
    }
  }

  async function enviar() {
    if (!titulo.trim() || !texto.trim()) return toast.error('Escribe el título y el aviso')
    if (!campana && !correo) return toast.error('Elige por dónde: la campana, el correo o los dos')
    const por = [campana ? 'la campana' : '', correo ? 'el correo' : ''].filter(Boolean).join(' y ')
    const ok = await confirmar(`¿Mandar «${titulo.trim()}» a ${n} ${n === 1 ? 'alumno' : 'alumnos'} por ${por}?`, {
      boton: 'Mandar',
    })
    if (!ok) return
    setEnviando('enviar')
    try {
      const r = await avisarClase(semana.id, { filtro, titulo, texto, campana, correo }, token)
      toast.success(`Mandado a ${r.alumnos} ${r.alumnos === 1 ? 'alumno' : 'alumnos'}${r.correos ? ` (${r.correos} correos)` : ''}`)
      queryClient.invalidateQueries({ queryKey: clave })
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo mandar')
    } finally {
      setEnviando('')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 pb-24 sm:pb-6 font-normal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            Avisar a la clase
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="text-[12.5px] text-[#6B7280] mb-4">
          {semana.tema} · {diaCorto(semana.fecha)}. Solo a los alumnos de esta clase.
        </p>

        {isLoading ? (
          <p className="text-[13px] text-[#6B7280] flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Mirando quién ha hecho qué…
          </p>
        ) : error ? (
          <p className="text-[13px] text-[#B91C1C]">{(error as Error).message}</p>
        ) : data ? (
          <div className="space-y-4">
            <div>
              <p className="block text-[12px] font-semibold text-[#5A6480] mb-1.5">A quién</p>
              <div className="space-y-1">
                {data.filtros.map((f) => (
                  <label key={f.id} className="flex items-center gap-2.5 text-[13.5px] text-gray-900 cursor-pointer">
                    <input
                      type="radio"
                      name="filtro"
                      className="h-4 w-4 accent-[#025dc7]"
                      checked={filtro === f.id}
                      onChange={() => setFiltro(f.id)}
                    />
                    <span className="flex-1">{f.nombre}</span>
                    <span className="text-[12.5px] font-semibold tabular-nums text-[#5A6480]">{f.alumnos.length}</span>
                  </label>
                ))}
              </div>
              {n ? (
                <button onClick={() => setVerNombres((v) => !v)} className="mt-1.5 text-[12px] font-semibold text-[#025dc7] hover:underline">
                  {verNombres ? 'Ocultar quiénes' : `Ver quiénes (${n})`}
                </button>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#6B7280]">Nadie: todos lo han hecho ya.</p>
              )}
              {verNombres && n ? (
                <p className="mt-1 text-[12.5px] text-[#3F4A61] leading-relaxed">{elegido?.alumnos.map((a) => a.nombre).join(', ')}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#5A6480] mb-1">Título</label>
              <input
                value={titulo}
                onChange={(e) => {
                  setTocado(true)
                  setTitulo(e.target.value)
                }}
                className={CAMPO}
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#5A6480] mb-1">Aviso</label>
              <textarea
                value={texto}
                rows={4}
                onChange={(e) => {
                  setTocado(true)
                  setTexto(e.target.value)
                }}
                className={CAMPO + ' resize-y'}
              />
              <p className="mt-1 text-[11.5px] text-[#6B7280]">
                El correo empieza solo con «Hola» y su nombre, y lleva el botón «Ver la clase».
              </p>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="inline-flex items-center gap-2 text-[13.5px] text-gray-900 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#025dc7]" checked={campana} onChange={(e) => setCampana(e.target.checked)} />
                <Bell size={14} className="text-[#025dc7]" /> En la campana
              </label>
              <label className="inline-flex items-center gap-2 text-[13.5px] text-gray-900 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#025dc7]" checked={correo} onChange={(e) => setCorreo(e.target.checked)} />
                <Mail size={14} className="text-[#025dc7]" /> Por correo
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
              <button
                onClick={prueba}
                disabled={!!enviando}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#DDE6F5] px-4 py-2.5 text-[13.5px] font-semibold text-[#025dc7] hover:bg-[#F4F7FD] disabled:opacity-60"
              >
                {enviando === 'prueba' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Mandármelo a mí
              </button>
              <button
                onClick={enviar}
                disabled={!!enviando || !n}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4da3ff] px-5 py-2.5 text-[14px] font-bold text-[#0a1656] hover:bg-[#5eb4ff] disabled:opacity-60"
              >
                {enviando === 'enviar' ? <Loader2 size={15} className="animate-spin" /> : null}
                Mandar a {n} {n === 1 ? 'alumno' : 'alumnos'}
              </button>
            </div>

            {data.avisos.length ? (
              <div className="border-t border-[#EEF2F9] pt-3">
                <p className="text-[12px] font-semibold text-[#5A6480] mb-1.5">Ya mandados desde esta semana</p>
                <ul className="space-y-1.5">
                  {data.avisos.map((a) => (
                    <li key={a.id} className="text-[12.5px] text-[#3F4A61] leading-snug">
                      <span className="font-semibold text-gray-900">{a.titulo}</span> · a {a.alumnos || a.correos}{' '}
                      {(a.alumnos || a.correos) === 1 ? 'alumno' : 'alumnos'} por{' '}
                      {[a.campana ? 'campana' : '', a.correos ? 'correo' : ''].filter(Boolean).join(' y ')}
                      <span className="text-[#9CA3AF]">
                        {' '}
                        · {a.por ? `${a.por}, ` : ''}
                        {a.at ? new Date(a.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
