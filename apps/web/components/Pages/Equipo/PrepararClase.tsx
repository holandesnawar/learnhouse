'use client'
/**
 * La tarjeta de cada clase en la sala de profes (09/11/2026).
 *
 * Pedido: "que yo pueda añadir la presentación completa (no es la misma que la
 * que se da con antelación antes de la clase)… poder yo como admin añadir y
 * cambiar cosas de la sala… como la siguiente clase… para que el profe ya sepa
 * dónde está todo para preparar la clase".
 *
 * - Arriba, la PRÓXIMA clase de verdad (`paraPreparar`: la primera de hoy en
 *   adelante, no la semana del calendario), con su tema y su día.
 * - «Para preparar la clase»: la presentación completa (archivos o enlaces que
 *   solo ve el equipo) y las notas para el profe. «Editar» cambia el tema, el
 *   día, las notas y el material (`services/tareas/material_profe.py`).
 * - Los pasos: la presentación para los alumnos (la de antes de la clase),
 *   dar la clase (con la sala el mismo día) y pasar lista.
 * - «Clase anterior»: lo que le falta (lista, grabación, corregir).
 * - «Después»: la que va detrás.
 */
import React, { useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowRight, Check, FileText, Link2, MessageSquare, Paperclip, Pencil, X } from 'lucide-react'
import {
  abrirArchivoProfe,
  editarSemana,
  enlaceProfe,
  guardarNotasProfe,
  mensajeLeido,
  mensajeProfe,
  quienProfe,
  quitarProfe,
  subirArchivoProfe,
  type ArchivoProfe,
  type MaterialProfe,
} from '@services/tareas/tareas'
import { cuando, diaLegible, quienDa, type ClaseParaPreparar, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'
const BOTON =
  'shrink-0 h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]'
const BOTON_AZUL = 'shrink-0 h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#0b2da0] text-white text-[13px] font-semibold'
const CAMPO = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'

export function Paso({ hecho, titulo, detalle, accion, apagado = false }: { hecho: boolean; titulo: string; detalle?: string; accion?: React.ReactNode; apagado?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={`shrink-0 w-[21px] h-[21px] rounded-full border-2 flex items-center justify-center ${
          hecho ? 'border-[#16A34A] text-[#16A34A]' : apagado ? 'border-dashed border-[#C9D4EC]' : 'border-[#AEB9D3]'
        }`}
      >
        {hecho ? <Check size={12} strokeWidth={3.4} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[14.5px] leading-snug ${apagado ? 'text-[#8A91AD]' : 'text-[#0B1033]'} ${hecho ? '' : 'font-semibold'}`}>{titulo}</p>
        {detalle ? <p className="text-[12.5px] text-[#6B7393]">{detalle}</p> : null}
      </div>
      {accion}
    </li>
  )
}

function fechaCorta(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  } catch {
    return ''
  }
}

/** El mensaje del administrador para el profe de esa semana, con «Leído». */
export function MensajeDelAdmin({ semana, admin, token, onLeido }: { semana: SemanaEquipo; admin: boolean; token: string; onLeido: () => void }) {
  const msg = semana.material?.mensaje
  const [enviando, setEnviando] = useState(false)
  if (!msg?.texto) return null
  const leer = async () => {
    setEnviando(true)
    try {
      await mensajeLeido(semana.semanaId, token)
      onLeido()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido marcar')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-[#0b2da0]/25 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">
        <MessageSquare size={14} /> Mensaje de {msg.por || 'la dirección'}
        {msg.at ? <span className="normal-case tracking-normal font-medium text-[#6B7393]">· {fechaCorta(msg.at)}</span> : null}
      </p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#0B1033] whitespace-pre-wrap">{msg.texto}</p>
      <div className="mt-2 flex items-center gap-2 text-[12.5px]">
        {msg.leido_por ? (
          <span className="inline-flex items-center gap-1 text-[#3B4262]">
            <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> Leído por {msg.leido_por}
            {msg.leido_at ? ` · ${fechaCorta(msg.leido_at)}` : ''}
          </span>
        ) : admin ? (
          <span className="text-[#8A6A2A]">Aún sin leer</span>
        ) : (
          <button onClick={leer} disabled={enviando} className={BOTON_AZUL}>
            <Check size={13} /> Leído
          </button>
        )}
      </div>
    </div>
  )
}

export function Material({ semana, token }: { semana: SemanaEquipo; token: string }) {
  const m = semana.material || { notas: '', archivos: [] }
  const abrir = (a: ArchivoProfe) =>
    abrirArchivoProfe(semana.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))
  return (
    <div className="mt-3 rounded-xl bg-[#F5F8FE] border border-[#E4EBF8] px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Para preparar la clase</p>
      {m.archivos.length ? (
        <ul className="mt-2 space-y-1.5">
          {m.archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5">
              {a.tipo === 'enlace' ? <Link2 size={16} className="text-[#0b2da0] shrink-0" /> : <FileText size={16} className="text-[#0b2da0] shrink-0" />}
              <button onClick={() => abrir(a)} className="min-w-0 flex-1 text-left text-[14px] font-semibold text-[#0B1033] hover:text-[#0b2da0] truncate">
                {a.nombre}
              </button>
              <button onClick={() => abrir(a)} className={BOTON}>
                Abrir
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13.5px] text-[#5B6382]">Aún no hay presentación completa para dar la clase.</p>
      )}
      {m.notas ? <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#2B3150] whitespace-pre-wrap">{m.notas}</p> : null}
    </div>
  )
}

export function EditarSemanaProfe({
  semana,
  profeDeLaClase = '',
  admin = false,
  token,
  onCerrar,
  onGuardada,
}: {
  semana: SemanaEquipo
  profeDeLaClase?: string
  admin?: boolean
  token: string
  onCerrar: () => void
  onGuardada: () => void
}) {
  const [tema, setTema] = useState(semana.tema)
  const [fecha, setFecha] = useState(semana.fecha)
  const [notas, setNotas] = useState(semana.material?.notas || '')
  const [profe, setProfe] = useState(semana.material?.profe || '')
  const [mensaje, setMensaje] = useState(semana.material?.mensaje?.texto || '')
  const [material, setMaterial] = useState<MaterialProfe>(semana.material || { notas: '', archivos: [] })
  const [nombreEnlace, setNombreEnlace] = useState('')
  const [url, setUrl] = useState('')
  const [ocupado, setOcupado] = useState('')
  const archivo = useRef<HTMLInputElement>(null)
  const [cambios, setCambios] = useState(false)

  const subir = async (f?: File | null) => {
    if (!f) return
    setOcupado('subir')
    try {
      setMaterial(await subirArchivoProfe(semana.semanaId, f, token))
      setCambios(true)
      toast.success('Subido')
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido subir')
    } finally {
      setOcupado('')
      if (archivo.current) archivo.current.value = ''
    }
  }
  const anadirEnlace = async () => {
    setOcupado('enlace')
    try {
      setMaterial(await enlaceProfe(semana.semanaId, nombreEnlace, url, token))
      setNombreEnlace('')
      setUrl('')
      setCambios(true)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido añadir')
    } finally {
      setOcupado('')
    }
  }
  const quitar = async (a: ArchivoProfe) => {
    setOcupado(a.id)
    try {
      setMaterial(await quitarProfe(semana.semanaId, a.id, token))
      setCambios(true)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido quitar')
    } finally {
      setOcupado('')
    }
  }
  const guardar = async () => {
    setOcupado('guardar')
    try {
      if (tema.trim() !== semana.tema || fecha !== semana.fecha) await editarSemana(semana.semanaId, { tema: tema.trim(), fecha }, token)
      if (notas.trim() !== (semana.material?.notas || '').trim()) await guardarNotasProfe(semana.semanaId, notas, token)
      if (admin && profe.trim() !== (semana.material?.profe || '').trim()) await quienProfe(semana.semanaId, profe, token)
      if (admin && mensaje.trim() !== (semana.material?.mensaje?.texto || '').trim()) await mensajeProfe(semana.semanaId, mensaje, token)
      toast.success('Guardado')
      onGuardada()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido guardar')
    } finally {
      setOcupado('')
    }
  }
  const cerrar = () => (cambios ? onGuardada() : onCerrar())

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-[#0a1656]/40 p-0 sm:p-4" onClick={cerrar}>
      <div
        className="w-full sm:max-w-[560px] max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">{semana.curso}</p>
            <h2 className="text-[19px] font-bold text-[#0B1033]" style={POPPINS}>
              Preparar la clase
            </h2>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_170px]">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#3B4262]">Tema</span>
            <input value={tema} onChange={(e) => setTema(e.target.value)} className={`${CAMPO} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#3B4262]">Día de la clase</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${CAMPO} mt-1`} />
          </label>
        </div>

        {admin ? (
          <div className="mt-5 rounded-xl bg-[#F5F8FE] border border-[#E4EBF8] p-4 space-y-3">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#3B4262]">La da esta semana</span>
              <input
                value={profe}
                onChange={(e) => setProfe(e.target.value)}
                placeholder={profeDeLaClase ? `Vacío = ${profeDeLaClase} (el de la clase)` : 'Nombre del profe'}
                className={`${CAMPO} mt-1`}
              />
              <span className="block mt-1 text-[12.5px] text-[#6B7393]">
                Su nombre de pila, como en su cuenta. Esta semana le sale a esa persona en su sala de profes.
              </span>
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#3B4262]">Mensaje para el profe</span>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={3}
                placeholder="Lo verá arriba de esta clase, con tu nombre, y lo marcará como leído."
                className={`${CAMPO} mt-1 resize-y`}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-[13px] font-semibold text-[#3B4262]">Presentación completa (para dar la clase)</p>
          <p className="text-[12.5px] text-[#6B7393]">Solo la ve el equipo. La de los alumnos, la que miran antes de la clase, va aparte, en la clase.</p>
          {material.archivos.length ? (
            <ul className="mt-2 divide-y divide-[#EEF1F7] rounded-xl border border-[#E4E8F2]">
              {material.archivos.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  {a.tipo === 'enlace' ? <Link2 size={16} className="text-[#0b2da0] shrink-0" /> : <FileText size={16} className="text-[#0b2da0] shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[#0B1033] truncate">{a.nombre}</span>
                    <span className="block text-[12px] text-[#6B7393]">{a.por ? `Lo añadió ${a.por}` : ''}</span>
                  </span>
                  <button
                    onClick={() => abrirArchivoProfe(semana.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))}
                    className={BOTON}
                  >
                    Abrir
                  </button>
                  <button onClick={() => quitar(a)} disabled={ocupado === a.id} aria-label="Quitar" className="p-1.5 rounded-lg text-[#8A91AD] hover:text-[#B42323]">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input
              ref={archivo}
              type="file"
              accept=".pdf,.pptx,.ppt,.key,.odp,.docx,.doc,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.mp4"
              className="hidden"
              onChange={(e) => subir(e.target.files?.[0])}
            />
            <button onClick={() => archivo.current?.click()} disabled={!!ocupado} className={BOTON_AZUL}>
              <Paperclip size={14} /> {ocupado === 'subir' ? 'Subiendo…' : 'Subir archivo'}
            </button>
            <span className="text-[12.5px] text-[#6B7393]">PDF, PowerPoint, Keynote… hasta 80 MB</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input value={nombreEnlace} onChange={(e) => setNombreEnlace(e.target.value)} placeholder="Nombre (opcional)" className={CAMPO} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="o pega un enlace (Google Slides, Canva…)" className={CAMPO} />
            <button onClick={anadirEnlace} disabled={!url.trim() || !!ocupado} className={`${BOTON} disabled:opacity-50`}>
              Añadir enlace
            </button>
          </div>
        </div>

        <label className="block mt-5">
          <span className="text-[13px] font-semibold text-[#3B4262]">Notas para el profe</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={5}
            placeholder="Cómo dar la clase, qué repasar, a quién preguntar, qué hacer si sobra tiempo…"
            className={`${CAMPO} mt-1 resize-y`}
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={cerrar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
            Cancelar
          </button>
          <button onClick={guardar} disabled={!!ocupado} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-60">
            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TarjetaPreparar({
  fila,
  hoy,
  ruta,
  token,
  puedeEditar,
  admin = false,
  onLeido,
  onLista,
  onEditar,
}: {
  fila: ClaseParaPreparar<ClaseEquipo>
  hoy: string
  ruta: (p: string) => string
  token: string
  puedeEditar: boolean
  admin?: boolean
  onLeido?: () => void
  onLista: (s: SemanaEquipo) => void
  onEditar: (s: SemanaEquipo) => void
}) {
  const { clase, siguiente: sig, despues, anterior, pendiente } = fila
  const curso = `/course/${clase.uuid.replace(/^course_/, '')}`
  const actividad = (uuid: string) => ruta(`${curso}/activity/${uuid.replace(/^activity_/, '')}`)
  const esHoy = sig?.fecha === hoy
  const pres = sig?.presentaciones[0]

  return (
    <section className={`${TARJETA} overflow-hidden`}>
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: clase.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
            {clase.nombre}
          </h3>
          <p className="mt-0.5 text-[13px] text-[#5B6382]">
            {[quienDa(sig, clase.profe) ? `La da ${quienDa(sig, clase.profe)}` : 'Sin profe puesto', clase.hora].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Link href={ruta(curso)} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0]">
          Abrir la clase <ArrowRight size={14} />
        </Link>
      </div>

      {sig ? (
        <div className="px-5 pb-3 pt-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">
                Próxima clase · {cuando(sig.fecha, hoy)}
                {sig.hora ? ` · ${sig.hora}` : ''}
              </p>
              <p className="mt-0.5 text-[18px] font-bold text-[#0B1033] leading-snug" style={POPPINS}>
                {sig.tema || 'Sin tema'}
              </p>
            </div>
            {puedeEditar ? (
              <button onClick={() => onEditar(sig)} className={BOTON}>
                <Pencil size={13} /> Editar
              </button>
            ) : null}
          </div>

          <MensajeDelAdmin semana={sig} admin={admin} token={token} onLeido={() => onLeido?.()} />
          <Material semana={sig} token={token} />

          <ul className="mt-1 divide-y divide-[#EEF1F7]">
            <Paso
              hecho={!!pres}
              titulo={pres ? 'Presentación para los alumnos, subida' : 'Subir la presentación para los alumnos'}
              detalle={pres ? 'La miran antes de la clase.' : 'La que miran antes de la clase (en la página de la clase).'}
              accion={
                pres ? (
                  <Link href={actividad(pres.activity_uuid)} className={BOTON}>
                    Ver
                  </Link>
                ) : (
                  <Link href={ruta(curso)} className={BOTON_AZUL}>
                    Subir
                  </Link>
                )
              }
            />
            <Paso
              hecho={false}
              titulo={esHoy ? 'Dar la clase, hoy' : `Dar la clase, ${cuando(sig.fecha, hoy)}`}
              detalle={sig.hora ? `A las ${sig.hora}` : undefined}
              accion={
                esHoy ? (
                  <Link href={ruta(`/sala/${clase.uuid.replace(/^course_/, '')}`)} className={BOTON_AZUL}>
                    Entrar a la sala
                  </Link>
                ) : null
              }
            />
            <Paso
              hecho={!!sig.lista?.pasada}
              apagado={!sig.lista?.pasada}
              titulo={sig.lista?.pasada ? `Lista pasada · vinieron ${sig.lista.vinieron}` : 'Asistencia: la cuenta la sala sola'}
              detalle={esHoy ? 'Quien entra a la sala cuenta solo. Si alguien vino por otro sitio, corrígelo aquí.' : 'Quien entra a la sala cuenta solo.'}
              accion={
                esHoy ? (
                  <button onClick={() => onLista(sig)} className={BOTON}>
                    {sig.lista?.pasada ? 'Ver la lista' : 'Corregir'}
                  </button>
                ) : null
              }
            />
          </ul>
        </div>
      ) : (
        <div className="px-5 pt-3 pb-4">
          <p className="text-[14.5px] text-[#3B4262]">No hay ninguna clase creada de aquí en adelante.</p>
          <Link href={ruta(curso)} className={`${BOTON_AZUL} mt-2.5`}>
            Crear la semana
          </Link>
        </div>
      )}

      {anterior ? (
        <div className="px-5 py-3 border-t border-[#EEF1F7]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">
            Clase anterior · {anterior.tema || 'Sin tema'} · {diaLegible(anterior.fecha)}
          </p>
          {pendiente.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {pendiente.includes('lista') ? (
                <button onClick={() => onLista(anterior)} className={BOTON_AZUL}>
                  Pasar lista
                </button>
              ) : null}
              {pendiente.includes('grabacion') ? (
                <Link href={ruta(curso)} className={BOTON_AZUL}>
                  Subir la grabación
                </Link>
              ) : null}
              {pendiente.includes('corregir') ? (
                <Link href={ruta('/seguimiento')} className={BOTON_AZUL}>
                  Corregir {anterior.porCorregir} {anterior.porCorregir === 1 ? 'tarea' : 'tareas'}
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] text-[#3B4262]">
              <Check size={14} strokeWidth={3} className="text-[#16A34A]" /> Todo hecho: lista, grabación y correcciones.
            </p>
          )}
        </div>
      ) : null}

      <div className="px-5 py-3 border-t border-[#EEF1F7] bg-[#FAFBFE] text-[13px] text-[#5B6382] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-[#3B4262]">Después:</span>
        {despues ? (
          <>
            <span>
              {despues.tema || 'Sin tema'} · {diaLegible(despues.fecha)}
              {quienDa(despues, clase.profe) !== quienDa(sig, clase.profe) && quienDa(despues, clase.profe)
                ? ` · la da ${quienDa(despues, clase.profe)}`
                : ''}
            </span>
            <span className={despues.material?.archivos.length ? 'text-[#15803D]' : 'text-[#8A6A2A]'}>
              · {despues.material?.archivos.length ? 'presentación completa lista' : 'sin presentación completa'}
            </span>
            {puedeEditar ? (
              <button onClick={() => onEditar(despues)} className="font-semibold text-[#0b2da0] hover:underline">
                Preparar
              </button>
            ) : null}
          </>
        ) : (
          <span>aún no está creada</span>
        )}
      </div>
    </section>
  )
}
