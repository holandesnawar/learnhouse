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
import { quitarPersona } from './quitarPersona'
import EnlacePago from './EnlacePago'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Eye,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  PhoneCall,
  Sparkles,
  Tag,
  X,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BOTON, BOTON_PELIGRO, Estado, META } from './ui'
import { avisoTrasBorrar, borrarContacto, cuandoLlamar, mandarATemplada, type VolverALlamar } from '@services/stats/contactos'
import { confirmar } from '@lib/nawar/confirmar'
import { numeroWhatsApp } from '@/lib/nawar/telefono'

const ETAPAS: { id: EtapaTablero; nombre: string }[] = [
  { id: 'nuevo', nombre: 'Nuevo' },
  { id: 'contactado', nombre: 'Contactado' },
  { id: 'revision', nombre: 'En revisión' },
  { id: 'propuesta', nombre: 'Propuesta' },
  { id: 'perdido', nombre: 'Perdido' },
]

function Bloque({ icono, titulo, children, derecha }: { icono: React.ReactNode; titulo: string; children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-[13.5px] font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-gray-400">{icono}</span>
          {titulo}
        </h3>
        {derecha}
      </div>
      {children}
    </section>
  )
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
  const { isAdmin } = useAdminStatus()
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
                <ul className="divide-y divide-[#F3F4F6]">
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
                <p className="text-[12.5px] text-[#9CA3AF]">Todavía no ha pagado nada.</p>
              )}
            </Bloque>
  ) : null
  // Por dónde va en la formación: clases hechas, la última y lo que le toca.
  const av = ficha?.avance
  const bloqueAvance = av ? (
    <Bloque
      icono={<BookOpen size={15} />}
      titulo="Formación"
      derecha={<span className="text-[12.5px] font-semibold tabular-nums text-gray-900">{av.hechas} de {av.total} clases · {av.pct} %</span>}
    >
      <div className="space-y-1 text-[12.5px]">
        {av.ultima ? (
          <p className="text-gray-800">
            <span className="text-[#6B7280]">Lo último que hizo:</span> {av.ultima.modulo} · {av.ultima.clase}
            {av.ultima.fecha ? <span className="text-[#9CA3AF]"> · {fechaCorta(av.ultima.fecha)}</span> : null}
          </p>
        ) : (
          <p className="text-[#9CA3AF]">Todavía no ha terminado ninguna clase.</p>
        )}
        {av.siguiente && av.hechas ? (
          <p className="text-gray-800">
            <span className="text-[#6B7280]">Le falta primero:</span> {av.siguiente.modulo} · {av.siguiente.clase}
          </p>
        ) : null}
      </div>
      {av.modulos.length ? (
        <ul className="mt-3 space-y-1.5">
          {av.modulos.map((m) => (
            <li key={m.nombre} className="flex items-center gap-2.5 text-[12px]">
              <span className="w-[42%] shrink-0 truncate text-gray-700">{m.nombre}</span>
              <span className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <span
                  className={`block h-full rounded-full ${m.total && m.hechas === m.total ? 'bg-[#15803D]' : 'bg-gray-800'}`}
                  style={{ width: `${m.total ? Math.round((m.hechas * 100) / m.total) : 0}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-[#6B7280]">
                {m.hechas}/{m.total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Bloque>
  ) : null
  const tel = numeroWhatsApp(ficha?.telefono)

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <div className="relative h-full w-full sm:max-w-[560px] bg-[#F9FAFB] border-l border-[#E5E7EB] overflow-y-auto">
        {/* Cabecera fija: quién es y cómo hablarle */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 sm:px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-gray-900 truncate">{ficha?.nombre || email}</p>
              <p className="text-[12.5px] text-[#6B7280] truncate">
                {email}
                {ficha?.telefono ? ` · ${ficha.telefono}` : ''}
              </p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tel ? (
              <a
                href={`https://wa.me/${tel}`}
                target="_blank"
                rel="noreferrer"
                className={BOTON}
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            ) : null}
            {tel ? (
              <a href={`tel:+${tel}`} className={BOTON}>
                <Phone size={13} /> Llamar
              </a>
            ) : null}
            <a href={`mailto:${email}`} className={BOTON}>
              <Mail size={13} /> Correo
            </a>
            {ficha?.fuera_de_metricas && (isAdmin || onQuitar) ? (
              // Fuera de los números (una prueba): volver a contar es lo
              // contrario de borrar, así que va en gris y sin papelera; y al
              // lado, borrar su rastro de verdad (notas, llamadas, tareas…),
              // que es lo que se busca con una prueba. El pago y la cuenta,
              // si los hay, se quedan (02/10: "le di a borrar y nada").
              <>
                <button
                  onClick={async () => {
                    if (onQuitar) return onQuitar()
                    const r = await quitarPersona(org?.id, accessToken, { email: ficha.email, nombre: ficha.nombre, esAlumno: true, fuera: true })
                    if (r) {
                      onCambio?.()
                      setFicha({ ...ficha, fuera_de_metricas: false })
                    }
                  }}
                  className={BOTON}
                >
                  <Eye size={13} /> Volver a contar
                </button>
                <button
                  onClick={async () => {
                    if (
                      !(await confirmar(
                        `¿Borrar el rastro de ${ficha.nombre || ficha.email}? Se borran sus notas, llamadas, tareas, solicitudes y matrículas sin pagar, y deja de salir en el panel. Si pagó, el pago y la factura se quedan, y su cuenta también.`,
                        { boton: 'Borrar su rastro', peligro: true }
                      ))
                    )
                      return
                    const r = await borrarContacto(org?.id, ficha.email, accessToken)
                    if (!r.ok) return toast.error(r.error || 'No se ha podido borrar')
                    const aviso = avisoTrasBorrar(r.quedan)
                    toast.success(aviso === 'Borrado' ? 'Borrado' : 'Borrado su rastro. Sigue fuera de los números.')
                    onCambio?.()
                    onClose()
                  }}
                  className={BOTON_PELIGRO}
                >
                  <Trash2 size={13} /> Borrar su rastro
                </button>
              </>
            ) : onQuitar ? (
              <button
                onClick={onQuitar}
                className={BOTON_PELIGRO}
              >
                <Trash2 size={13} /> {quitarEtiqueta}
              </button>
            ) : isAdmin && ficha ? (
              // Sin botón de fuera (tablero, Tareas, Clientes, inicio): el de
              // siempre, con la misma regla que Contactos (ver quitarPersona).
              <button
                onClick={async () => {
                  const r = await quitarPersona(org?.id, accessToken, {
                    email: ficha.email,
                    nombre: ficha.nombre,
                    esAlumno: ficha.tablero.etapa === 'alumno',
                    fuera: ficha.fuera_de_metricas,
                  })
                  if (!r) return
                  onCambio?.()
                  if (r === 'borrado' || r === 'fuera') onClose()
                  else setFicha({ ...ficha, fuera_de_metricas: false })
                }}
                className={BOTON_PELIGRO}
              >
                {ficha.fuera_de_metricas ? null : <Trash2 size={13} />}
                {ficha.fuera_de_metricas ? 'Volver a contar' : ficha.tablero.etapa === 'alumno' ? 'Quitar de los números' : 'Borrar'}
              </button>
            ) : null}
            {ficha?.fuera_de_metricas ? (
              <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-gray-500 text-[12px] font-semibold">
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
                <p className="text-[13px] text-[#15803D] font-semibold flex items-center gap-1.5">
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
                              ? 'bg-gray-600 text-white'
                              : 'bg-gray-900 text-white'
                            : 'border border-[#E5E7EB] bg-white text-gray-800 hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <EnlacePago email={ficha.email} nombre={ficha.nombre} telefono={ficha.telefono} />
                    {ficha.templada?.estado === 'pendiente' ? (
                      <span className="inline-flex items-center gap-1.5 h-8 text-[12.5px] text-[#4B5563]">
                        <PhoneCall size={13} className="text-gray-500" />
                        En llamadas templadas{ficha.templada.llamar_el ? ` · llamar ${cuandoLlamar(ficha.templada.llamar_el)}` : ''}
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          const r = await mandarATemplada(
                            org?.id,
                            { email: ficha.email, nombre: ficha.nombre, telefono: ficha.telefono },
                            accessToken
                          )
                          if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido mandar')
                          setFicha({ ...ficha, templada: r.datos.templada })
                          toast.success('En Llamadas templadas, para llamar hoy')
                          onCambio?.()
                        }}
                        className={BOTON}
                      >
                        <PhoneCall size={13} /> Mandar a llamadas templadas
                      </button>
                    )}
                  </div>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-2">
                    {ficha.tablero.movido_por
                      ? `Movido por ${ficha.tablero.movido_por} ${haceCuanto(ficha.tablero.desde)}`
                      : `Aquí desde ${haceCuanto(ficha.tablero.desde)}`}
                  </p>
                </>
              )}
              {esAlumno ? null : (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Le estamos hablando por</p>
                <div className="flex flex-wrap gap-1.5">
                  {CANALES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => mover(ficha.tablero.etapa === 'alumno' ? 'contactado' : ficha.tablero.etapa, ficha.tablero.canal === c.id ? '' : c.id)}
                      disabled={esAlumno}
                      className={`px-2.5 py-1 rounded-md text-[12px] font-semibold ${
                        ficha.tablero.canal === c.id ? 'bg-gray-900 text-white' : 'border border-[#E5E7EB] bg-white text-gray-700 hover:bg-[#F9FAFB]'
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
            {esAlumno ? bloqueAvance : null}

            {/* Sus llamadas de Calendly y lo que pasó en cada una (se apunta en Llamadas). */}
            {ficha.llamadas?.length ? (
              <Bloque icono={<CalendarDays size={15} />} titulo="Llamadas">
                <ul className="divide-y divide-[#F3F4F6] -my-1">
                  {ficha.llamadas.map((c) => {
                    const cancelada = c.estado === 'cancelada'
                    const pasada = new Date(c.fin || c.inicio).getTime() < Date.now()
                    const cuando = new Date(c.inicio).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    return (
                      <li key={c.id || c.inicio} className="py-2 flex items-start gap-3">
                        <span className={`w-[140px] shrink-0 text-[13px] tabular-nums ${cancelada ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{cuando}</span>
                        <div className="flex-1 min-w-0">
                          {cancelada ? (
                            <Estado>{c.reprogramada ? 'Reprogramada' : 'Cancelada'}</Estado>
                          ) : c.resultado ? (
                            <Estado tono={c.resultado.resultado === 'compra' || c.resultado.resultado === 'pagado' ? 'verde' : c.resultado.resultado === 'piensa' ? 'ambar' : 'gris'}>{c.resultado.nombre}</Estado>
                          ) : pasada ? (
                            <Estado tono="rojo">Sin apuntar qué pasó</Estado>
                          ) : (
                            <Estado tono="azul">Programada</Estado>
                          )}
                          {c.resultado?.nota ? <p className={`${META} !whitespace-normal mt-0.5`}>{c.resultado.nota}</p> : null}
                        </div>
                        {c.enlace && !cancelada && !pasada ? (
                          <a href={c.enlace} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[#025dc7] hover:underline shrink-0">
                            Entrar
                          </a>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </Bloque>
            ) : null}

            {/* Qué ha visto y de dónde viene */}
            <Bloque icono={<Eye size={15} />} titulo="Qué ha visto">
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${ficha.vio_precio ? 'text-[#15803D]' : 'text-gray-500'}`}
                >
                  {ficha.vio_precio ? 'Ha visto el precio' : 'No ha visto el precio'}
                </span>
                {ficha.utm.campaign ? (
                  <span className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-[#B45309]">Campaña: {ficha.utm.campaign}</span>
                ) : null}
              </div>
              {ficha.vio_precio && ficha.precio_por ? <p className="text-[12.5px] text-gray-700 mt-2">{ficha.precio_por}</p> : null}
              {ficha.vino_de ? <p className="text-[12.5px] text-[#6B7280] mt-2">Llegó por {ficha.vino_de}.</p> : null}
              {ficha.paginas.length ? (
                <ol className="mt-2.5 space-y-1">
                  {ficha.paginas.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-[12.5px] text-gray-800">
                      <span className="w-5 h-5 shrink-0 rounded-full border border-[#E5E7EB] bg-white text-gray-800 text-[10.5px] font-bold flex items-center justify-center">{i + 1}</span>
                      <Globe size={12} className="text-[#9CA3AF] shrink-0" />
                      <span className="truncate">{p.nombre}</span>
                      {p.precio ? <span className="shrink-0 text-[10.5px] font-semibold text-[#15803D]">con precio</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12px] text-[#9CA3AF] mt-2">No tenemos su recorrido por la web.</p>
              )}
            </Bloque>

            {/* Tareas */}
            <Bloque icono={<CheckCircle2 size={15} />} titulo={(() => { const n = ficha.tareas.filter((t) => t.estado !== 'hecha').length; return n ? `Tareas · ${n} ${n === 1 ? 'pendiente' : 'pendientes'}` : 'Tareas' })()}>
              <TareaForm email={ficha.email} compacto onCreada={tareaCambiada} />
              {ficha.tareas.length ? (
                <div className="mt-2 divide-y divide-[#F3F4F6]">
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
                  <p className="text-[12.5px] text-[#9CA3AF]">No se ha podido consultar: {ficha.systeme.motivo || 'sin respuesta'}.</p>
                ) : ficha.systeme.existe === false ? (
                  <p className="text-[12.5px] text-[#6B7280]">
                    Este correo <strong>no está</strong> en systeme.io.
                  </p>
                ) : (
                  <>
                    {ficha.systeme.etiquetas.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ficha.systeme.etiquetas.map((t) => (
                          <span key={t} className="rounded-full text-gray-700 px-2.5 py-1 text-[12px] font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-[#6B7280]">Está en el CRM pero sin ninguna etiqueta.</p>
                    )}
                    {ficha.systeme.campos.length ? (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                        {ficha.systeme.campos.map((c) => (
                          <React.Fragment key={c.slug}>
                            <dt className="text-[#9CA3AF]">{c.slug}</dt>
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
                <ul className="divide-y divide-[#F3F4F6]">
                  {ficha.correos.map((c, i) => (
                    <li key={i} className="py-1.5 flex items-start justify-between gap-3 text-[12.5px]">
                      <span className={`min-w-0 ${c.ok ? 'text-gray-800' : 'text-red-700'}`}>
                        {c.asunto}
                        {c.ok ? '' : ' · no salió'}
                      </span>
                      <span className="shrink-0 text-[#9CA3AF]">{fechaCorta(c.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[#9CA3AF]">Ninguno registrado todavía.</p>
              )}
              <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
                Solo los que manda la escuela, desde el 28 de septiembre. Los de systeme.io se ven en systeme.io.
              </p>
            </Bloque>

            {/* Línea de tiempo */}
            <Bloque icono={<Sparkles size={15} />} titulo="Todo lo que ha pasado">
              <ol className="relative border-l-2 border-[#E5E7EB] ml-1.5 space-y-2.5">
                {ficha.linea.map((i, k) => (
                  <li key={k} className="pl-3.5 relative">
                    <span
                      className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        i.tipo === 'correo' ? 'bg-[#4da3ff]' : i.tipo === 'nota' ? 'bg-[#E4B252]' : i.tipo === 'tarea' ? 'bg-[#9CA3AF]' : 'bg-[#1D0084]'
                      }`}
                    />
                    <p className="text-[12.5px] text-gray-800 leading-snug">
                      {i.tipo === 'correo' ? 'Correo: ' : i.tipo === 'nota' ? `Nota de ${i.autor}: ` : i.tipo === 'tarea' ? 'Tarea: ' : ''}
                      {i.texto}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
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
