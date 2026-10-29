'use client'

/**
 * Panel → Correos (29/10/2026): qué está pasando con el email marketing.
 * Pedido: "una sección para mí sobre lo que pasa con los mails, estilo CRM
 * newsletter: quién está dónde, a quién le llegó qué".
 *
 * Tres vistas, como las herramientas de email marketing (ver la cabecera de
 * apps/api/src/services/correos/correos.py):
 * - **Recorrido**: la campaña como tarjetas de correo en sus dos ramas (no
 *   compró / compró el ebook), cada una con a cuántos les llegó, cuántos lo
 *   tienen como próximo, quién volvió por él y quién reservó o pagó después.
 *   «Ver» enseña el correo tal cual llega.
 * - **Personas**: dónde está cada una, su último correo y el próximo. Al
 *   tocarla, su línea de tiempo: cada correo y cada cosa que hizo.
 * - **Envíos**: todo lo que ha mandado la escuela, el más nuevo arriba, con
 *   los que no salieron en rojo.
 * Solo administradores. Estilo de `ui.tsx`.
 *
 * Desde el 29/10 los correos de Black Friday los manda systeme.io: el
 * servidor devuelve `campana.fuente = 'systeme'`, los pasos de sus campañas
 * («le llegó» calculado con su calendario) y sus newsletters. «Ver» abre el
 * correo en systeme.io, que es donde vive.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleAlert, ExternalLink, Eye, Loader2, Mail, MousePointerClick, Search, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  getCorreos,
  getPersonaCorreos,
  type DetallePersona,
  type NewsletterCorreo,
  type PanelCorreos,
  type PasoCorreo,
  type PersonaCorreos,
  type Situacion,
} from '@services/correos/correos'
import FichaCliente from './FichaCliente'
import VistaCorreo, { EDITAR_CORREOS as EDITAR } from './VistaCorreo'
import { BOTON, ENLACE, Estado, META, Meta, Seccion, TARJETA, filtro, type Tono } from './ui'

const ZONA = 'Europe/Amsterdam'

const TONO: Record<Situacion, Tono> = {
  pago: 'verde',
  reservo: 'azul',
  llamada: 'azul',
  comprador: 'gris',
  'sin-comprar': 'gris',
  'no-encaja': 'ambar',
  baja: 'rojo',
}
const ORDEN_SITUACIONES: { id: Situacion; nombre: string }[] = [
  { id: 'sin-comprar', nombre: 'Sin comprar' },
  { id: 'comprador', nombre: 'Compraron el ebook' },
  { id: 'llamada', nombre: 'Empezaron la llamada' },
  { id: 'reservo', nombre: 'Reservaron' },
  { id: 'pago', nombre: 'Pagaron' },
  { id: 'no-encaja', nombre: 'No encajan' },
  { id: 'baja', nombre: 'De baja' },
]

/** «jue 29 oct · 18:05», en hora de Países Bajos. */
function diaHora(iso: string) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: ZONA }).replace(/\./g, '').replace(',', '')
  return `${dia} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA })}`
}
/** «2026-11-27» → «vie 27 nov»; «hoy» y «mañana» si toca. */
function dia(fecha: string, hoy: string) {
  if (!fecha) return ''
  if (fecha === hoy) return 'hoy'
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d, 12))
  const manana = new Date(Date.UTC(...(hoy.split('-').map(Number) as [number, number, number])) + 86_400_000 + 43_200_000)
  if (f.toISOString().slice(0, 10) === manana.toISOString().slice(0, 10)) return 'mañana'
  return f.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\./g, '').replace(',', '')
}

function Cifra({ rotulo, valor, pie }: { rotulo: string; valor: number | string; pie?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] truncate">{rotulo}</p>
      <p className="mt-0.5 text-[24px] font-semibold tabular-nums text-gray-900 leading-tight">{valor}</p>
      {pie ? <p className="text-[12px] text-[#9CA3AF] truncate">{pie}</p> : null}
    </div>
  )
}

function NumeroPaso({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`text-[16px] font-semibold tabular-nums leading-tight ${valor && fuerte ? 'text-[#15803D]' : 'text-gray-900'}`}>{valor}</p>
      <p className="text-[11px] text-[#6B7280] leading-tight">{etiqueta}</p>
    </div>
  )
}

function TarjetaCorreo({ paso, onVer }: { paso: PasoCorreo; onVer: (p: PasoCorreo) => void }) {
  return (
    <div className={`${TARJETA} p-3.5 ${paso.apagado ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-[#F3F4F6] text-[#4B5563] flex items-center justify-center">
          <Mail size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] truncate">
            {paso.apagado ? 'Apagado · ' : ''}
            {paso.cuando}
          </p>
          <p className="text-[14px] font-medium text-gray-900 leading-snug">{paso.asunto}</p>
        </div>
        {paso.enlace ? (
          // Vive en systeme.io: se ve y se edita allí.
          <a href={paso.enlace} target="_blank" rel="noopener noreferrer" className={`${BOTON} shrink-0`} aria-label={`Abrir «${paso.asunto}» en systeme.io`}>
            <ExternalLink size={13} /> Ver
          </a>
        ) : (
          <button onClick={() => onVer(paso)} className={`${BOTON} shrink-0`} aria-label={`Ver el correo «${paso.asunto}»`}>
            <Eye size={13} /> Ver
          </button>
        )}
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#F3F4F6] grid grid-cols-5 gap-2">
        <NumeroPaso etiqueta="le llegó" valor={paso.enviados} />
        <NumeroPaso etiqueta="esperan" valor={paso.esperando} />
        <NumeroPaso etiqueta="volvieron" valor={paso.volvieron} />
        <NumeroPaso etiqueta="reservaron" valor={paso.reservaron_despues} fuerte />
        <NumeroPaso etiqueta="pagaron" valor={paso.pagaron_despues} fuerte />
      </div>
    </div>
  )
}

function Rama({ titulo, que, pasos, onVer }: { titulo: string; que: string; pasos: PasoCorreo[]; onVer: (p: PasoCorreo) => void }) {
  const fila = pasos.filter((p) => !p.lateral)
  const lado = pasos.filter((p) => p.lateral)
  return (
    <div className="min-w-0">
      <div className="mb-3">
        <p className="text-[14px] font-semibold text-gray-900">{titulo}</p>
        <p className={META}>{que}</p>
      </div>
      <ol className="relative">
        {fila.map((p, i) => (
          <li key={p.id} className="relative pl-6 pb-3 last:pb-0">
            {/* La línea que une un correo con el siguiente. */}
            {i < fila.length - 1 ? <span className="absolute left-[7px] top-4 bottom-0 w-px bg-[#E5E7EB]" aria-hidden /> : null}
            <span className="absolute left-0 top-3 w-[15px] h-[15px] rounded-full border-2 border-white bg-[#9CA3AF] ring-1 ring-[#E5E7EB]" aria-hidden />
            <TarjetaCorreo paso={p} onVer={onVer} />
          </li>
        ))}
      </ol>
      {lado.map((p) => (
        <div key={p.id} className="mt-4 pl-6">
          <p className="mb-1.5 text-[12px] font-medium text-[#6B7280]">Aparte, sustituye al de ese día:</p>
          <div className="border-l-2 border-dashed border-[#D1D5DB] pl-3">
            <TarjetaCorreo paso={p} onVer={onVer} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Una newsletter de systeme.io: no se sabe a quién le llegó, solo quién volvió por su botón. */
function TarjetaNewsletter({ n }: { n: NewsletterCorreo }) {
  return (
    <div className={`${TARJETA} p-3.5`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-[#F3F4F6] text-[#4B5563] flex items-center justify-center">
          <Mail size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] truncate">{n.para}</p>
          <p className="text-[14px] font-medium text-gray-900 leading-snug">{n.asunto}</p>
        </div>
        <a href={n.enlace} target="_blank" rel="noopener noreferrer" className={`${BOTON} shrink-0`} aria-label={`Abrir «${n.asunto}» en systeme.io`}>
          <ExternalLink size={13} /> Ver
        </a>
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#F3F4F6] grid grid-cols-3 gap-2">
        <NumeroPaso etiqueta="volvieron" valor={n.volvieron} />
        <NumeroPaso etiqueta="reservaron" valor={n.reservaron_despues} fuerte />
        <NumeroPaso etiqueta="pagaron" valor={n.pagaron_despues} fuerte />
      </div>
    </div>
  )
}

/** Lo que le ha llegado a una persona y lo que ha hecho. */
function PersonaPanel({ email, onClose, onFicha }: { email: string; onClose: () => void; onFicha: (email: string) => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [d, setD] = useState<DetallePersona | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!org?.id || !token) return
    getPersonaCorreos(org.id, email, token).then((r) => (r.ok ? setD(r.datos) : setError(r.error)))
  }, [org?.id, token, email])
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: ZONA })
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-white border-l border-[#E5E7EB] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#F3F4F6]">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-gray-900 truncate">{d?.nombre || email}</p>
            <p className={`${META} truncate`}>{email}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6]">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {error ? <p className="text-[13.5px] text-red-600">{error}</p> : null}
          {!d && !error ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-gray-400" size={22} />
            </div>
          ) : null}
          {d ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Estado tono={TONO[d.situacion]}>{d.etiqueta}</Estado>
                <button onClick={() => onFicha(d.email)} className={ENLACE}>
                  Ver su ficha
                </button>
              </div>
              <div className={`${TARJETA} px-3.5 py-3`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Próximo correo</p>
                {d.proximo ? (
                  <p className="mt-1 text-[14px] text-gray-900">
                    <span className="font-medium">{d.proximo.asunto}</span>
                    <span className="text-[#6B7280]"> · {dia(d.proximo.dia, hoy)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[13.5px] text-[#6B7280]">
                    {d.situacion === 'reservo' || d.situacion === 'pago'
                      ? 'Ninguno: ya cumplió el objetivo.'
                      : d.situacion === 'baja'
                        ? 'Ninguno: se dio de baja.'
                        : d.situacion === 'no-encaja'
                          ? 'Ninguno: no encaja, salió de la campaña.'
                          : d.aviso
                            ? d.aviso
                            : d.en_campana || d.situacion === 'comprador' || d.situacion === 'sin-comprar'
                              ? 'Ninguno: ya le llegó todo lo que le tocaba.'
                              : 'No está en la campaña de Black Friday.'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900 mb-2">Lo que le ha llegado y lo que ha hecho</p>
                {d.linea.length ? (
                  <ol className="relative">
                    {d.linea.map((x, i) => (
                      <li key={i} className="relative pl-6 pb-3.5 last:pb-0">
                        {i < d.linea.length - 1 ? <span className="absolute left-[9px] top-5 bottom-0 w-px bg-[#E5E7EB]" aria-hidden /> : null}
                        <span
                          className={`absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full flex items-center justify-center ${
                            x.tipo === 'correo' ? (x.ok ? 'bg-[#F3F4F6] text-[#4B5563]' : 'bg-red-50 text-red-600') : 'bg-[#EAF3FF] text-[#025dc7]'
                          }`}
                          aria-hidden
                        >
                          {x.tipo === 'correo' ? <Mail size={11} /> : <MousePointerClick size={11} />}
                        </span>
                        <p className={`text-[13.5px] leading-snug ${x.tipo === 'correo' ? 'text-gray-900' : 'text-[#025dc7] font-medium'}`}>{x.texto}</p>
                        <Meta
                          partes={[
                            diaHora(x.cuando),
                            x.campana,
                            x.calculado ? 'calculado' : '',
                            x.tipo === 'correo' && !x.ok ? <span className="text-red-600 font-medium">no salió</span> : '',
                          ]}
                        />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={META}>Todavía no le ha llegado ningún correo.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

export default function CorreosPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<PanelCorreos | null>(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<'recorrido' | 'personas' | 'envios'>('recorrido')
  const [viendo, setViendo] = useState<PasoCorreo | null>(null)
  const [persona, setPersona] = useState('')
  const [ficha, setFicha] = useState('')
  const [buscar, setBuscar] = useState('')
  const [situacion, setSituacion] = useState<Situacion | ''>('')
  const [envio, setEnvio] = useState<'todos' | 'bf' | 'otros' | 'fallos'>('todos')

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getCorreos(org.id, token)
    if (r.ok) setDatos(r.datos)
    else setError(r.error)
  }, [org?.id, token])
  useEffect(() => {
    cargar()
  }, [cargar])
  // Se recuerda la vista elegida en este navegador.
  useEffect(() => {
    try {
      const v = localStorage.getItem('nawar.correos.vista')
      if (v === 'recorrido' || v === 'personas' || v === 'envios') setVista(v)
    } catch {}
  }, [])
  const elegir = (v: typeof vista) => {
    setVista(v)
    try {
      localStorage.setItem('nawar.correos.vista', v)
    } catch {}
  }

  const q = buscar.trim().toLowerCase()
  const personas = useMemo(
    () =>
      (datos?.personas || []).filter(
        (p) => (!situacion || p.situacion === situacion) && (!q || p.email.includes(q) || p.nombre.toLowerCase().includes(q))
      ),
    [datos?.personas, situacion, q]
  )
  const envios = useMemo(
    () =>
      (datos?.envios || []).filter(
        (e) =>
          (envio === 'todos' || (envio === 'bf' && e.campana) || (envio === 'otros' && !e.campana) || (envio === 'fallos' && !e.ok)) &&
          (!q || e.email.includes(q) || e.asunto.toLowerCase().includes(q) || e.nombre.toLowerCase().includes(q))
      ),
    [datos?.envios, envio, q]
  )

  if (error) {
    return (
      <div className={`${TARJETA} p-5`}>
        <p className="text-[14px] text-gray-600">{error}</p>
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }
  const r = datos.resumen
  const hoy = datos.campana.hoy
  // Desde el 29/10 los correos los manda systeme.io y aquí se calculan.
  const systeme = datos.campana.fuente === 'systeme'

  return (
    <div className="space-y-7">
      {/* ── La campaña y sus cifras ── */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-gray-900">Campaña de Black Friday</p>
            <Meta
              partes={[
                systeme ? (
                  <Estado key="c" tono={datos.campana.activa ? 'verde' : 'ambar'}>
                    {datos.campana.activa && datos.campana.systeme_desde
                      ? `Correos de systeme.io desde el ${dia(datos.campana.systeme_desde, hoy)}`
                      : 'Correos de systeme.io: falta poner desde qué día están encendidos'}
                  </Estado>
                ) : (
                  <Estado key="c" tono={datos.campana.activa ? 'verde' : 'gris'}>
                    {datos.campana.activa ? 'Correos encendidos' : 'Correos apagados'}
                  </Estado>
                ),
                datos.campana.hasta
                  ? // «hasta hoy» / «hasta mañana», pero «hasta el lun 30 nov».
                    ((d) => (d === 'hoy' || d === 'mañana' ? `hasta ${d}` : `hasta el ${d}`))(dia(datos.campana.hasta, hoy))
                  : '',
                systeme ? `${r.enviados} correos (calculados)` : `${r.enviados} correos enviados`,
                `${r.enviados_7d} esta semana`,
              ]}
              className="mt-0.5 whitespace-normal"
            />
          </div>
          <Link href={EDITAR} className={BOTON}>
            {systeme ? 'Ajustes' : 'Editar textos y ajustes'} <ArrowRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Cifra rotulo="Han entrado" valor={r.entraron} pie="dejaron sus datos" />
          <Cifra rotulo="Compraron el ebook" valor={r.compraron} />
          <Cifra rotulo="Reciben correos" valor={r.activos} pie="les queda alguno" />
          <Cifra rotulo="Reservaron llamada" valor={r.reservaron} />
          <Cifra rotulo="Pagaron" valor={r.pagaron} pie="la formación" />
          <Cifra rotulo="Bajas" valor={r.bajas} pie={r.no_encajan ? `${r.no_encajan} no encajan` : undefined} />
        </div>
        {r.fallidos_7d ? (
          <p className="flex items-center gap-1.5 text-[13px] text-red-600">
            <CircleAlert size={14} /> {r.fallidos_7d} {r.fallidos_7d === 1 ? 'correo no salió' : 'correos no salieron'} esta semana: están en
            «Envíos», en rojo.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => elegir('recorrido')} className={filtro(vista === 'recorrido')}>
          Recorrido
        </button>
        <button onClick={() => elegir('personas')} className={filtro(vista === 'personas')}>
          Personas · {datos.personas.length}
        </button>
        <button onClick={() => elegir('envios')} className={filtro(vista === 'envios')}>
          Envíos
        </button>
        {vista !== 'recorrido' ? (
          <div className="relative ml-auto w-full sm:w-64 mt-2 sm:mt-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder={vista === 'personas' ? 'Buscar persona' : 'Buscar persona o asunto'}
              className="w-full h-8 pl-8 pr-2.5 rounded-md border border-[#E5E7EB] bg-white text-[13px] outline-none focus:border-gray-900"
            />
          </div>
        ) : null}
      </div>

      {/* ── Recorrido ── */}
      {vista === 'recorrido' ? (
        <div className="space-y-4">
          <p className={META}>
            {systeme ? (
              <>
                Los correos los manda <b className="font-medium text-gray-700">systeme.io</b>. <b className="font-medium text-gray-700">Le llegó</b> se
                calcula con el calendario de su campaña desde el día en que se encendieron (Avisos → Ebook Black Friday); «Ver» lo abre en
                systeme.io.{' '}
              </>
            ) : null}
            Cada tarjeta es un correo de la campaña. <b className="font-medium text-gray-700">Le llegó</b>: a cuántos.{' '}
            <b className="font-medium text-gray-700">Esperan</b>: lo tienen como próximo. <b className="font-medium text-gray-700">Volvieron</b>:
            entraron desde su botón e hicieron algo. <b className="font-medium text-gray-700">Reservaron / pagaron</b>: después de recibirlo.
          </p>
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            <Rama
              titulo={datos.grupos.sin_comprar}
              que={
                systeme
                  ? 'Campaña «No compradores» de systeme.io: empieza al apuntarse a la lista y sale al comprar el ebook.'
                  : 'Desbloqueó la oferta o abrió el pago y no compró: todo le lleva al ebook.'
              }
              pasos={datos.pasos.filter((p) => p.grupo === 'sin_comprar')}
              onVer={setViendo}
            />
            <Rama
              titulo={datos.grupos.compradores}
              que={
                systeme
                  ? 'Campaña «Compradores» de systeme.io: todo le lleva a la oferta y a la llamada. Sale al reservar, pagar o no encajar.'
                  : 'Compró el ebook: todo le lleva a la llamada. Se para al reservar o pagar.'
              }
              pasos={datos.pasos.filter((p) => p.grupo === 'compradores')}
              onVer={setViendo}
            />
          </div>
          {datos.newsletters?.length ? (
            <div className="pt-2">
              <p className="text-[14px] font-semibold text-gray-900">Newsletters</p>
              <p className={`${META} mb-3`}>
                Se mandan a mano desde systeme.io. De ellas no se sabe a quién le llegaron: solo quién volvió por su botón y qué hizo después.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {datos.newsletters.map((n) => (
                  <TarjetaNewsletter key={n.id} n={n} />
                ))}
              </div>
            </div>
          ) : null}
          <p className={`${META} pt-1`}>
            Las aperturas y los clics dentro del correo no se miden: las del iPhone son falsas (Apple abre todos los correos) y harían falta
            avisos de Resend. Lo que sí se ve es quién volvió desde un correo y qué hizo después.
          </p>
        </div>
      ) : null}

      {/* ── Personas ── */}
      {vista === 'personas' ? (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button onClick={() => setSituacion('')} className={filtro(!situacion)}>
              Todas · {datos.personas.length}
            </button>
            {ORDEN_SITUACIONES.map((s) => (
              <button key={s.id} onClick={() => setSituacion(situacion === s.id ? '' : s.id)} className={filtro(situacion === s.id)}>
                {s.nombre} · {r.por_situacion[s.id] ?? 0}
              </button>
            ))}
          </div>
          {personas.length ? (
            <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
              <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_140px_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-4 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
                <span>Persona</span>
                <span>Dónde está</span>
                <span>Último correo</span>
                <span>Próximo</span>
              </div>
              {personas.map((p) => (
                <FilaPersona key={p.email} p={p} hoy={hoy} onAbrir={() => setPersona(p.email)} />
              ))}
            </div>
          ) : (
            <div className={`${TARJETA} p-4`}>
              <p className="text-[13.5px] text-gray-600">
                {datos.personas.length ? 'Nadie con ese filtro.' : 'Todavía no ha entrado nadie en la campaña de Black Friday.'}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Envíos ── */}
      {vista === 'envios' ? (
        <Seccion titulo="Todo lo que ha mandado la escuela">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {(
              [
                ['todos', 'Todos'],
                ['bf', 'Black Friday'],
                ['otros', 'Otros de la escuela'],
                ['fallos', 'No salieron'],
              ] as const
            ).map(([id, nombre]) => (
              <button key={id} onClick={() => setEnvio(id)} className={filtro(envio === id)}>
                {nombre}
              </button>
            ))}
          </div>
          {envios.length ? (
            <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
              {envios.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setPersona(e.email)}
                  className="w-full text-left px-4 py-2.5 grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.4fr)_110px] gap-x-4 gap-y-0.5 hover:bg-[#F9FAFB]"
                >
                  <span className="text-[12.5px] text-[#6B7280] tabular-nums">{diaHora(e.cuando)}</span>
                  <span className="min-w-0 text-[13.5px] text-gray-900 truncate">{e.nombre || e.email}</span>
                  <span className="min-w-0 text-[13.5px] text-gray-700 truncate">
                    {e.asunto}
                    {e.campana ? <span className="text-[#9CA3AF]"> · {e.campana}</span> : null}
                  </span>
                  <span>{e.ok ? <Estado tono="verde">Enviado</Estado> : <Estado tono="rojo">No salió</Estado>}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`${TARJETA} p-4`}>
              <p className="text-[13.5px] text-gray-600">Nada con ese filtro.</p>
            </div>
          )}
          <p className={META}>Los últimos 300. El registro empezó el 28/09: lo de antes no está, y lo que manda systeme.io tampoco.</p>
        </Seccion>
      ) : null}

      {viendo ? <VistaCorreo id={viendo.id} asunto={viendo.asunto} onClose={() => setViendo(null)} /> : null}
      {persona ? <PersonaPanel email={persona} onClose={() => setPersona('')} onFicha={(e) => setFicha(e)} /> : null}
      {ficha ? <FichaCliente email={ficha} onClose={() => setFicha('')} /> : null}
    </div>
  )
}

function FilaPersona({ p, hoy, onAbrir }: { p: PersonaCorreos; hoy: string; onAbrir: () => void }) {
  return (
    <button
      onClick={onAbrir}
      className="w-full text-left px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_140px_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1 hover:bg-[#F9FAFB]"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-gray-900 truncate">{p.nombre || p.email}</span>
        <span className={`block ${META} truncate`}>
          {p.nombre ? `${p.email} · ` : ''}
          {p.via}
        </span>
      </span>
      <span className="md:pt-0.5">
        <Estado tono={TONO[p.situacion]}>{p.etiqueta}</Estado>
      </span>
      <span className="min-w-0">
        {p.ultimo ? (
          <>
            <span className="block text-[13px] text-gray-800 truncate">{p.ultimo.asunto}</span>
            <span className={`block ${META}`}>
              {diaHora(p.ultimo.cuando)} · {p.recibidos} {p.recibidos === 1 ? 'correo' : 'correos'}
            </span>
          </>
        ) : (
          <span className={META}>Ninguno todavía</span>
        )}
      </span>
      <span className="min-w-0">
        {p.proximo ? (
          <>
            <span className="block text-[13px] text-gray-800 truncate">{p.proximo.asunto}</span>
            <span className={`block ${META}`}>{dia(p.proximo.dia, hoy)}</span>
          </>
        ) : (
          <span className={META}>—</span>
        )}
      </span>
    </button>
  )
}
