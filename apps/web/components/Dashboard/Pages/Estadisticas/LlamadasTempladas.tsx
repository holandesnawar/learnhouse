'use client'

/**
 * Llamadas templadas — dentro de Panel → Llamadas (05/10/2026).
 *
 * Gente que mostró interés y se quedó ahí. Entra sola quien dejó sus datos en
 * /agendar o en el proceso de admisión y no terminó las preguntas (antes
 * salían en «Solicitudes de llamada» como «No terminó»), y el closer o un
 * administrador puede apuntar a quien quiera: nombre, móvil, notas y un día
 * aproximado para llamar. El correo es opcional.
 *
 * Orden: lo que toca hoy o ya se pasó, arriba; luego por fecha; al final las
 * que no tienen fecha. Lo calcula la escuela (`services/contactos/templadas.py`).
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  cambiarTemplada,
  crearTemplada,
  cuandoLlamar,
  getTempladas,
  hoyISO,
  quitarTemplada,
  type DatosTemplada,
  type Templada,
} from '@services/stats/contactos'
import { Check, ChevronDown, ChevronRight, Loader2, Phone, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import { BOTON, BOTON_PELIGRO, BOTON_PRINCIPAL, ENLACE, Estado, META, Meta, Seccion, TARJETA } from '../Panel/ui'
import { numeroWhatsApp } from '@/lib/nawar/telefono'

const ATAJOS: [string, number][] = [
  ['Hoy', 0],
  ['Mañana', 1],
  ['En 3 días', 3],
  ['En una semana', 7],
  ['En 2 semanas', 14],
  ['En un mes', 30],
]

const CAMPO =
  'w-full h-9 px-3 rounded-md border border-[#D1D5DB] bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#025dc7] focus:ring-2 focus:ring-[#025dc7]/15'
const ETIQUETA = 'block text-[12.5px] font-medium text-gray-700 mb-1'

function diaCorto(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function TocaLlamar({ t }: { t: Templada }) {
  if (!t.llamar_el) return null
  if (t.toca === 'vencida') return <Estado tono="rojo">Tocaba {cuandoLlamar(t.llamar_el)}</Estado>
  if (t.toca === 'hoy') return <Estado tono="rojo">Llamar hoy</Estado>
  return <Estado tono="gris">Llamar {cuandoLlamar(t.llamar_el)}</Estado>
}

/** Nombre, móvil, correo, cuándo y notas: el mismo formulario para apuntar y para editar. */
function Formulario({
  inicial,
  correoFijo,
  guardando,
  textoBoton,
  onGuardar,
  onCancelar,
}: {
  inicial: DatosTemplada
  correoFijo?: boolean
  guardando: boolean
  textoBoton: string
  onGuardar: (d: DatosTemplada) => void
  onCancelar?: () => void
}) {
  const [d, setD] = useState<DatosTemplada>(inicial)
  const pon = (k: keyof DatosTemplada) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar(d)
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={ETIQUETA}>Nombre</label>
          <input className={CAMPO} value={d.nombre || ''} onChange={pon('nombre')} placeholder="María García" />
        </div>
        <div>
          <label className={ETIQUETA}>Móvil</label>
          <input className={CAMPO} value={d.telefono || ''} onChange={pon('telefono')} placeholder="+31 6 1234 5678" inputMode="tel" />
        </div>
        <div>
          <label className={ETIQUETA}>Correo (si lo tienes)</label>
          <input
            className={`${CAMPO} ${correoFijo ? 'bg-[#F9FAFB] text-gray-500' : ''}`}
            value={d.email || ''}
            onChange={pon('email')}
            placeholder="maria@gmail.com"
            inputMode="email"
            readOnly={correoFijo}
          />
        </div>
      </div>
      <div>
        <label className={ETIQUETA}>Cuándo llamar (más o menos)</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {ATAJOS.map(([texto, dias]) => {
            const valor = hoyISO(dias)
            return (
              <button
                key={texto}
                type="button"
                onClick={() => setD((x) => ({ ...x, llamar_el: valor }))}
                className={`h-8 px-2.5 rounded-md border text-[12.5px] font-medium transition-colors ${
                  d.llamar_el === valor ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-[#E5E7EB] text-gray-700 hover:bg-[#F9FAFB]'
                }`}
              >
                {texto}
              </button>
            )
          })}
          <input type="date" className={`${CAMPO} !w-auto`} value={d.llamar_el || ''} onChange={pon('llamar_el')} />
          {d.llamar_el ? (
            <button type="button" onClick={() => setD((x) => ({ ...x, llamar_el: '' }))} className={`${ENLACE} !text-gray-500`}>
              Sin fecha
            </button>
          ) : null}
        </div>
      </div>
      <div>
        <label className={ETIQUETA}>Notas</label>
        <textarea
          className={`${CAMPO} !h-auto py-2 min-h-[84px] leading-relaxed`}
          value={d.notas || ''}
          onChange={pon('notas')}
          placeholder="Qué le interesa, por qué no siguió, qué le dijiste…"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {textoBoton}
        </button>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className={BOTON}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default function LlamadasTempladas({ verFicha }: { verFicha: (email: string) => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [pendientes, setPendientes] = useState<Templada[] | null>(null)
  const [cerradas, setCerradas] = useState<Templada[]>([])
  const [fallo, setFallo] = useState('')
  const [nueva, setNueva] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | 'nueva' | null>(null)
  const [verCerradas, setVerCerradas] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    const r = await getTempladas(org.id, accessToken)
    if (!r.ok || !r.datos) {
      setFallo(r.error || 'No se han podido cargar')
      return
    }
    setFallo('')
    setPendientes(r.datos.pendientes)
    setCerradas(r.datos.cerradas)
  }, [org?.id, accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function apuntar(d: DatosTemplada) {
    setGuardando('nueva')
    const r = await crearTemplada(org.id, d, accessToken)
    setGuardando(null)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return
    }
    toast.success('Apuntada')
    setNueva(false)
    cargar()
  }

  async function cambiar(t: Templada, d: DatosTemplada, aviso = 'Guardado') {
    setGuardando(t.id)
    const r = await cambiarTemplada(org.id, t.id, d, accessToken)
    setGuardando(null)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido guardar')
      return false
    }
    toast.success(aviso)
    cargar()
    return true
  }

  async function quitar(t: Templada) {
    const quien = t.nombre || t.telefono || t.email
    const pregunta =
      t.origen === 'mano'
        ? `¿Borrar a ${quien} de las llamadas templadas? Sus notas de aquí se pierden.`
        : `¿Quitar a ${quien} de las llamadas templadas? No vuelve a entrar sola. Su ficha y su historial no se tocan.`
    if (!(await confirmar(pregunta))) return
    const r = await quitarTemplada(org.id, t.id, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    setAbierta(null)
    cargar()
  }

  const total = pendientes?.length ?? 0
  const tocan = (pendientes || []).filter((t) => t.toca === 'hoy' || t.toca === 'vencida').length

  return (
    <Seccion
      titulo={`Llamadas templadas${pendientes ? ` · ${total}${tocan ? `, ${tocan} para hoy` : ''}` : ''}`}
      extra={
        !nueva ? (
          <button onClick={() => setNueva(true)} className={`${BOTON} whitespace-nowrap`}>
            <Plus size={13} /> Apuntar
          </button>
        ) : null
      }
    >
      <p className={META}>
        Gente que mostró interés y se quedó ahí. Entra sola quien dejó sus datos en «agendar llamada» o en el proceso de admisión y no
        terminó las preguntas. Y aquí puedes apuntar a quien quieras, aunque solo tengas su móvil.
      </p>

      {nueva ? (
        <div className={`${TARJETA} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-medium text-gray-900">Apuntar a alguien</p>
            <button onClick={() => setNueva(false)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <Formulario
            inicial={{ llamar_el: '' }}
            guardando={guardando === 'nueva'}
            textoBoton="Apuntar"
            onGuardar={apuntar}
            onCancelar={() => setNueva(false)}
          />
        </div>
      ) : null}

      {fallo ? (
        <div className={`${TARJETA} p-4`}>
          <p className="text-[14px] text-gray-600">{fallo}</p>
        </div>
      ) : pendientes === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-gray-400" size={20} />
        </div>
      ) : pendientes.length === 0 ? (
        <div className={`${TARJETA} p-4`}>
          <p className="text-[14px] text-gray-600">No hay nadie pendiente.</p>
        </div>
      ) : (
        <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
          {pendientes.map((t) => {
            const open = abierta === t.id
            const wa = numeroWhatsApp(t.telefono)
            return (
              <div key={t.id}>
                <button onClick={() => setAbierta(open ? null : t.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F9FAFB]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 truncate">{t.nombre || t.telefono || t.email}</p>
                      <TocaLlamar t={t} />
                    </div>
                    <Meta
                      partes={[
                        t.origen === 'mano' ? `Apuntada por ${t.creado_por || 'el equipo'}` : t.origen_nombre,
                        t.telefono,
                        diaCorto(t.created_at),
                      ]}
                    />
                    {t.notas || t.detalle ? (
                      <p className={`text-[12.5px] text-gray-700 mt-0.5 ${open ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
                        {t.notas || t.detalle}
                      </p>
                    ) : null}
                  </div>
                  {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                </button>

                {open ? (
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    {t.origen !== 'mano' && t.detalle && t.notas ? <p className={META}>{t.detalle}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      {t.telefono ? (
                        <a href={`tel:${t.telefono.replace(/[^\d+]/g, '')}`} className={BOTON}>
                          <Phone size={13} /> Llamar
                        </a>
                      ) : null}
                      {wa ? (
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={BOTON}>
                          WhatsApp
                        </a>
                      ) : null}
                      {t.email ? (
                        <button onClick={() => verFicha(t.email)} className={BOTON}>
                          Ver ficha
                        </button>
                      ) : null}
                      <button onClick={() => cambiar(t, { estado: 'hecha' }, 'Hecha')} disabled={guardando === t.id} className={BOTON}>
                        <Check size={13} /> Ya está hecha
                      </button>
                      <button onClick={() => quitar(t)} className={`${BOTON_PELIGRO} ml-auto`}>
                        <Trash2 size={13} /> {t.origen === 'mano' ? 'Borrar' : 'Quitar'}
                      </button>
                    </div>
                    <Formulario
                      key={`${t.id}-${t.updated_at}`}
                      inicial={{ nombre: t.nombre, telefono: t.telefono, email: t.email, notas: t.notas, llamar_el: t.llamar_el }}
                      correoFijo={t.origen !== 'mano'}
                      guardando={guardando === t.id}
                      textoBoton="Guardar"
                      onGuardar={(d) => {
                        const { email, ...resto } = d
                        cambiar(t, t.origen === 'mano' ? d : resto)
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {cerradas.length > 0 ? (
        <div>
          <button
            onClick={() => setVerCerradas((v) => !v)}
            className="text-[13px] font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 mb-2"
          >
            {verCerradas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Hechas o quitadas · {cerradas.length}
          </button>
          {verCerradas ? (
            <div className={`${TARJETA} divide-y divide-[#F3F4F6]`}>
              {cerradas.map((t) => (
                <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-gray-800 truncate">{t.nombre || t.telefono || t.email}</p>
                    <Meta partes={[t.estado === 'hecha' ? 'Hecha' : 'Quitada', diaCorto(t.hecha_at), t.notas]} />
                  </div>
                  <button onClick={() => cambiar(t, { estado: 'pendiente' }, 'Vuelve a la lista')} className={BOTON}>
                    <RotateCcw size={13} /> Devolver
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Seccion>
  )
}
