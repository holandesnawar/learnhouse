'use client'

/**
 * La ficha completa de una persona, en un panel lateral que se abre desde el
 * tablero, las tareas o Contactos. Pensada para indagar sin salir de donde
 * estás: en qué columna está y por dónde se le habla, qué vio de la web, qué
 * pagó, qué correos le mandó la escuela, las notas, las tareas y todo lo que ha
 * pasado con ella en una línea de tiempo.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  CANALES,
  euros,
  fechaCorta,
  getFichaCliente,
  haceCuanto,
  moverTarjeta,
  type Canal,
  type EtapaTablero,
  type FichaCliente as Ficha,
  type Tarea,
} from '@services/panel/panel'
import Seguimiento from '@components/Dashboard/Pages/Estadisticas/Seguimiento'
import { FilaTarea, TareaForm } from './Tareas'
import {
  CheckCircle2,
  CreditCard,
  Eye,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { VolverALlamar } from '@services/stats/contactos'

const ETAPAS: { id: EtapaTablero; nombre: string }[] = [
  { id: 'nuevo', nombre: 'Nuevo' },
  { id: 'contactado', nombre: 'Contactado' },
  { id: 'revision', nombre: 'En revisión' },
  { id: 'propuesta', nombre: 'Propuesta' },
  { id: 'perdido', nombre: 'Perdido' },
]

function Bloque({ icono, titulo, children, derecha }: { icono: React.ReactNode; titulo: string; children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E6EBF5] bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
          <span className="text-[#025dc7]">{icono}</span>
          {titulo}
        </h3>
        {derecha}
      </div>
      {children}
    </section>
  )
}

function soloDigitos(tel: string) {
  return (tel || '').replace(/[^\d]/g, '')
}

export default function FichaCliente({
  email,
  onClose,
  onCambio,
  onCambioFecha,
  onQuitar,
  quitarEtiqueta = 'Borrar',
}: {
  email: string
  onClose: () => void
  /** Para que la lista de fuera se refresque (tablero, contactos). */
  onCambio?: () => void
  onCambioFecha?: (email: string, v: VolverALlamar | null) => void
  /** Solo administradores: borrar (lead) o quitar de los números (alumno). */
  onQuitar?: () => void
  quitarEtiqueta?: string
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getFichaCliente(org.id, email, accessToken)
    if (r.ok && r.datos) setFicha(r.datos)
    else setError(r.error || 'No se ha podido cargar')
  }, [org?.id, accessToken, email])

  useEffect(() => {
    setFicha(null)
    setError('')
    cargar()
  }, [cargar])

  // Escape cierra, como cualquier panel lateral.
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  async function mover(etapa: EtapaTablero, canal?: Canal) {
    if (!ficha) return
    const r = await moverTarjeta(org?.id, { email: ficha.email, etapa, canal }, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido mover')
      return
    }
    setFicha({ ...ficha, tablero: { ...ficha.tablero, etapa, canal: canal ?? ficha.tablero.canal } })
    onCambio?.()
  }

  function tareaCambiada(t: Tarea) {
    if (!ficha) return
    const hay = ficha.tareas.some((x) => x.id === t.id)
    setFicha({ ...ficha, tareas: hay ? ficha.tareas.map((x) => (x.id === t.id ? t : x)) : [t, ...ficha.tareas] })
    onCambio?.()
  }

  const esAlumno = ficha?.tablero.etapa === 'alumno'
  const bloquePagos = ficha ? (
    <Bloque
              icono={<CreditCard size={15} />}
              titulo="Pagos"
              derecha={ficha.pagos.length ? <span className="text-[13px] font-bold text-[#1D0084]">{euros(ficha.total_pagado_cents)}</span> : null}
            >
              {ficha.pagos.length ? (
                <ul className="divide-y divide-[#EEF2F9]">
                  {ficha.pagos.map((p, i) => (
                    <li key={i} className="py-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="text-gray-800">
                        {fechaCorta(p.fecha)} · {p.producto === 'formacion-a0-a1' ? 'Formación A0-A1' : p.producto || 'Pago'}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-900">{euros(p.importe_cents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[#8A96AB]">Todavía no ha pagado nada.</p>
              )}
            </Bloque>
  ) : null
  const tel = soloDigitos(ficha?.telefono || '')

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-[#0a1656]/30" />
      <div className="relative h-full w-full sm:max-w-[560px] bg-[#F7F9FD] shadow-2xl overflow-y-auto">
        {/* Cabecera fija: quién es y cómo hablarle */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#E6EBF5] px-4 sm:px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-gray-900 truncate">{ficha?.nombre || email}</p>
              <p className="text-[12.5px] text-[#5A6480] truncate">
                {email}
                {ficha?.telefono ? ` · ${ficha.telefono}` : ''}
              </p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-lg text-[#5A6480] hover:bg-[#F0F5FF]">
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tel ? (
              <a
                href={`https://wa.me/${tel}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8FBF3] text-[#0E9F6E] text-[12.5px] font-bold"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            ) : null}
            {tel ? (
              <a href={`tel:+${tel}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12.5px] font-bold">
                <Phone size={13} /> Llamar
              </a>
            ) : null}
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12.5px] font-bold">
              <Mail size={13} /> Correo
            </a>
            {onQuitar ? (
              <button
                onClick={onQuitar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[12.5px] font-bold hover:bg-red-100"
              >
                {quitarEtiqueta}
              </button>
            ) : null}
            {ficha?.fuera_de_metricas ? (
              <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-[#F3F4F6] text-[#6B7590] text-[12px] font-semibold">
                Fuera de los números
              </span>
            ) : null}
          </div>
        </div>

        {!ficha ? (
          <div className="flex justify-center py-16">
            {error ? <p className="text-[13px] text-red-700">{error}</p> : <Loader2 className="animate-spin text-gray-400" size={22} />}
          </div>
        ) : (
          <div className="p-3 sm:p-4 space-y-3">
            {/* Dónde está en el tablero */}
            <Bloque icono={<Sparkles size={15} />} titulo="Matrícula">
              {esAlumno ? (
                <p className="text-[13px] text-[#0E9F6E] font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Ya es alumno
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {ETAPAS.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => mover(e.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                          ficha.tablero.etapa === e.id
                            ? e.id === 'perdido'
                              ? 'bg-[#6B7590] text-white'
                              : 'bg-[#1D0084] text-white'
                            : 'bg-[#F0F5FF] text-[#025dc7] hover:bg-[#e3edff]'
                        }`}
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-[#8A96AB] mt-2">
                    {ficha.tablero.movido_por
                      ? `Movido por ${ficha.tablero.movido_por} ${haceCuanto(ficha.tablero.desde)}`
                      : `Aquí desde ${haceCuanto(ficha.tablero.desde)}`}
                  </p>
                </>
              )}
              {esAlumno ? null : (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A96AB] mb-1.5">Le estamos hablando por</p>
                <div className="flex flex-wrap gap-1.5">
                  {CANALES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => mover(ficha.tablero.etapa === 'alumno' ? 'contactado' : ficha.tablero.etapa, ficha.tablero.canal === c.id ? '' : c.id)}
                      disabled={esAlumno}
                      className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${
                        ficha.tablero.canal === c.id ? 'bg-[#4da3ff] text-[#0a1656]' : 'bg-[#F3F4F6] text-[#5A6480] hover:bg-[#EAF3FF]'
                      } disabled:opacity-50`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </Bloque>

            {/* A un alumno, lo primero que interesa es lo que ha pagado. */}
            {esAlumno ? bloquePagos : null}

            {/* Qué ha visto y de dónde viene */}
            <Bloque icono={<Eye size={15} />} titulo="Qué ha visto">
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ficha.vio_precio ? 'bg-[#E8FBF3] text-[#0E9F6E]' : 'bg-[#F3F4F6] text-[#6B7590]'}`}
                >
                  {ficha.vio_precio ? 'Ha visto el precio' : 'No ha visto el precio'}
                </span>
                {ficha.utm.campaign ? (
                  <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold bg-[#FFFBF2] text-[#8A6A2A]">Campaña: {ficha.utm.campaign}</span>
                ) : null}
              </div>
              {ficha.vino_de ? <p className="text-[12.5px] text-[#5A6480] mt-2">Llegó por {ficha.vino_de}.</p> : null}
              {ficha.paginas.length ? (
                <ol className="mt-2.5 space-y-1">
                  {ficha.paginas.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-[12.5px] text-gray-800">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-[#F0F5FF] text-[#025dc7] text-[10.5px] font-bold flex items-center justify-center">{i + 1}</span>
                      <Globe size={12} className="text-[#8A96AB] shrink-0" />
                      <span className="truncate">{p.nombre}</span>
                      {p.precio ? <span className="shrink-0 text-[10.5px] font-semibold text-[#0E9F6E]">con precio</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12px] text-[#8A96AB] mt-2">No tenemos su recorrido por la web.</p>
              )}
            </Bloque>

            {/* Tareas */}
            <Bloque icono={<CheckCircle2 size={15} />} titulo={(() => { const n = ficha.tareas.filter((t) => t.estado !== 'hecha').length; return n ? `Tareas · ${n} ${n === 1 ? 'pendiente' : 'pendientes'}` : 'Tareas' })()}>
              <TareaForm email={ficha.email} compacto onCreada={tareaCambiada} />
              {ficha.tareas.length ? (
                <div className="mt-2 divide-y divide-[#EEF2F9]">
                  {ficha.tareas.map((t) => (
                    <FilaTarea
                      key={t.id}
                      tarea={t}
                      onCambio={tareaCambiada}
                      onBorrada={(id) => setFicha({ ...ficha, tareas: ficha.tareas.filter((x) => x.id !== id) })}
                    />
                  ))}
                </div>
              ) : null}
            </Bloque>

            {/* Notas y volver a llamar (lo mismo que en Contactos) */}
            <Bloque icono={<NotebookPen size={15} />} titulo="Notas y volver a llamar">
              <Seguimiento email={ficha.email} onCambioFecha={onCambioFecha} />
            </Bloque>

            {/* Lo que systeme.io sabe: sus etiquetas son "en qué campaña de correos está". */}
            {ficha.systeme ? (
              <Bloque icono={<Tag size={15} />} titulo="En el CRM (systeme.io)">
                {!ficha.systeme.ok ? (
                  <p className="text-[12.5px] text-[#8A96AB]">No se ha podido consultar: {ficha.systeme.motivo || 'sin respuesta'}.</p>
                ) : ficha.systeme.existe === false ? (
                  <p className="text-[12.5px] text-[#5A6480]">
                    Este correo <strong>no está</strong> en systeme.io.
                  </p>
                ) : (
                  <>
                    {ficha.systeme.etiquetas.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ficha.systeme.etiquetas.map((t) => (
                          <span key={t} className="rounded-full bg-[#EAF3FF] text-[#025dc7] px-2.5 py-1 text-[12px] font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-[#5A6480]">Está en el CRM pero sin ninguna etiqueta.</p>
                    )}
                    {ficha.systeme.campos.length ? (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                        {ficha.systeme.campos.map((c) => (
                          <React.Fragment key={c.slug}>
                            <dt className="text-[#8A96AB]">{c.slug}</dt>
                            <dd className="text-gray-800 break-words">{String(c.valor)}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    ) : null}
                  </>
                )}
              </Bloque>
            ) : null}

            {esAlumno ? null : bloquePagos}

            {/* Correos */}
            <Bloque icono={<Mail size={15} />} titulo="Correos de la escuela">
              {ficha.correos.length ? (
                <ul className="divide-y divide-[#EEF2F9]">
                  {ficha.correos.map((c, i) => (
                    <li key={i} className="py-1.5 flex items-start justify-between gap-3 text-[12.5px]">
                      <span className={`min-w-0 ${c.ok ? 'text-gray-800' : 'text-red-700'}`}>
                        {c.asunto}
                        {c.ok ? '' : ' · no salió'}
                      </span>
                      <span className="shrink-0 text-[#8A96AB]">{fechaCorta(c.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[#8A96AB]">Ninguno registrado todavía.</p>
              )}
              <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
                Solo los que manda la escuela, desde el 28 de septiembre. Los de systeme.io se ven en systeme.io.
              </p>
            </Bloque>

            {/* Línea de tiempo */}
            <Bloque icono={<Sparkles size={15} />} titulo="Todo lo que ha pasado">
              <ol className="relative border-l-2 border-[#E6EBF5] ml-1.5 space-y-2.5">
                {ficha.linea.map((i, k) => (
                  <li key={k} className="pl-3.5 relative">
                    <span
                      className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        i.tipo === 'correo' ? 'bg-[#4da3ff]' : i.tipo === 'nota' ? 'bg-[#E4B252]' : i.tipo === 'tarea' ? 'bg-[#8A96AB]' : 'bg-[#1D0084]'
                      }`}
                    />
                    <p className="text-[12.5px] text-gray-800 leading-snug">
                      {i.tipo === 'correo' ? 'Correo: ' : i.tipo === 'nota' ? `Nota de ${i.autor}: ` : i.tipo === 'tarea' ? 'Tarea: ' : ''}
                      {i.texto}
                    </p>
                    <p className="text-[11px] text-[#8A96AB]">
                      {fechaCorta(i.cuando)} · {haceCuanto(i.cuando)}
                    </p>
                  </li>
                ))}
              </ol>
            </Bloque>
          </div>
        )}
      </div>
    </div>
  )
}
