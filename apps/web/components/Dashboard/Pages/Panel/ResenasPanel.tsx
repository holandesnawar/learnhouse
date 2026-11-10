'use client'

/**
 * Panel → Reseñas (10/11/2026): las reseñas en vídeo de los alumnos, de
 * principio a fin. Solo administradores (lo comprueba el servidor).
 *
 * - Arriba, las cuatro cifras, que hacen de filtro: invitadas sin grabar, por
 *   revisar, aprobadas y regalos por dar.
 * - «Invitar alumnos»: se eligen con casillas (arriba, quien más ha avanzado),
 *   con el mensaje y el regalo. Invitar dos veces no duplica.
 * - Cada reseña: ver el vídeo (se pide con la sesión, solo al pulsar), bajarlo,
 *   aprobar o descartar, la nota del equipo y «Regalo dado».
 *
 * El regalo es un agradecimiento por grabar y NO depende de que la reseña se
 * apruebe: por eso «Regalo dado» va aparte y también sale en las descartadas.
 * La lógica, en apps/api/src/services/resenas/resenas.py.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy, Download, Gift, Loader2, Play, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { confirmar } from '@/lib/nawar/confirmar'
import { NOMBRE_ESTADO, haceDias, minutos, ordenarResenas, peso } from '@/lib/nawar/resenas'
import {
  bajarVideo,
  borrarResena,
  cambiarResena,
  getInvitables,
  getResenas,
  invitarAlumnos,
  revisarResena,
  videoResena,
  type AlumnoInvitable,
  type ResenaPanel,
  type ResenasPanelDatos,
} from '@services/resenas/resenas'
import { BOTON, BOTON_PELIGRO, BOTON_PRINCIPAL, Estado, META, Meta, TARJETA, filtro, type Tono } from './ui'

type Filtro = 'todas' | 'grabada' | 'invitada' | 'aprobada' | 'descartada' | 'regalo'

const CAMPO =
  'w-full rounded-lg border border-[#D5DDEC] bg-white px-3 py-2 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] focus:ring-2 focus:ring-[#025dc7]/15'
const ETIQUETA = 'block text-[12px] font-semibold text-[#5A6480] mb-1'
const TONO: Record<string, Tono> = { invitada: 'gris', grabada: 'ambar', aprobada: 'verde', descartada: 'rojo' }

function dia(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).replace('.', '')
}

function regaloPorDar(r: ResenaPanel): boolean {
  return r.tiene_video && !!r.regalo && !r.regalo_dado_at
}

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(aviso)
  } catch {
    toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.')
  }
}

function Cifra({ n, nombre, activa, onClick }: { n: number; nombre: string; activa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-white px-4 py-3 text-left transition-colors ${activa ? 'border-[#1D0084]' : 'border-[#E2E8F4] hover:border-[#B9CBEA]'}`}
    >
      <p className="text-[24px] font-semibold leading-none text-[#0a1656] tabular-nums" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
        {n}
      </p>
      <p className="mt-1.5 text-[12.5px] text-[#6B7280]">{nombre}</p>
    </button>
  )
}

// ── Invitar ─────────────────────────────────────────────────────────────────

function Invitar({
  orgId,
  token,
  datos,
  onHecho,
  onCerrar,
}: {
  orgId: number
  token: string
  datos: ResenasPanelDatos
  onHecho: (d: ResenasPanelDatos) => void
  onCerrar: () => void
}) {
  const [alumnos, setAlumnos] = useState<AlumnoInvitable[] | null>(null)
  const [error, setError] = useState('')
  const [buscar, setBuscar] = useState('')
  const [elegidos, setElegidos] = useState<number[]>([])
  const [mensaje, setMensaje] = useState(datos.mensaje)
  const [regalo, setRegalo] = useState(datos.regalo)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    getInvitables(orgId, token)
      .then((d) => setAlumnos(d.alumnos))
      .catch((e) => setError(e?.message || 'No se pudo cargar la lista'))
  }, [orgId, token])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (alumnos || []).filter((a) => !q || a.nombre.toLowerCase().includes(q) || a.email.includes(q))
  }, [alumnos, buscar])

  const yaInvitados = (alumnos || []).filter((a) => a.resena).length
  const total = yaInvitados + elegidos.length

  function alternar(id: number) {
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))
  }

  async function invitar() {
    if (!elegidos.length) return
    setEnviando(true)
    try {
      const d = await invitarAlumnos(orgId, { user_ids: elegidos, mensaje, regalo }, token)
      toast.success(d.nuevas === 1 ? '1 alumno invitado' : `${d.nuevas} alumnos invitados`)
      onHecho(d)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo invitar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCerrar} role="dialog" aria-modal="true">
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F4] px-5 py-4">
          <h3 className="text-[16px] font-bold text-[#0a1656]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            Invitar alumnos a grabar su reseña
          </h3>
          <button onClick={onCerrar} className="text-[#6B7280] hover:text-[#111827]" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-[13.5px] leading-relaxed text-[#4B5563]">
            Les sale el aviso en la campana y la página para grabarla. No se manda ningún correo: si quieres, después copias la invitación para
            WhatsApp. Mejor pocos y bien elegidos: unos {datos.tope} como mucho.
          </p>

          <div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar un alumno" className={`${CAMPO} pl-9`} />
            </div>
            <div className="mt-2 max-h-[260px] overflow-y-auto rounded-lg border border-[#E2E8F4]">
              {error ? (
                <p className="px-3 py-4 text-[13.5px] text-red-600">{error}</p>
              ) : alumnos === null ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-[#9CA3AF]" />
                </div>
              ) : !lista.length ? (
                <p className="px-3 py-4 text-[13.5px] text-[#6B7280]">{alumnos.length ? 'Nadie con ese nombre.' : 'Todavía no hay alumnos.'}</p>
              ) : (
                lista.map((a) => {
                  const marcado = elegidos.includes(a.user_id)
                  const ya = !!a.resena
                  return (
                    <label
                      key={a.user_id}
                      className={`flex items-center gap-3 border-b border-[#EEF2F9] px-3 py-2.5 last:border-b-0 ${ya ? 'opacity-60' : 'cursor-pointer hover:bg-[#F8FAFE]'}`}
                    >
                      <input type="checkbox" className="sr-only" disabled={ya} checked={marcado} onChange={() => alternar(a.user_id)} />
                      <span
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 ${
                          marcado || ya ? 'border-[#025dc7] text-[#025dc7]' : 'border-[#B8C2DA]'
                        }`}
                      >
                        {marcado || ya ? <Check size={12} strokeWidth={3.4} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#111827]">{a.nombre}</span>
                        <Meta partes={[a.total ? `${a.pct} % de la formación` : '', haceDias(a.dias), ya ? `Ya invitado · ${NOMBRE_ESTADO[a.resena as keyof typeof NOMBRE_ESTADO].toLowerCase()}` : '']} />
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            {total > datos.tope ? (
              <p className="mt-2 text-[12.5px] text-[#8A6A2A]">
                Con estos serían {total} invitados. Se puede, pero con más de {datos.tope} cuesta ver y agradecer cada vídeo como toca.
              </p>
            ) : null}
          </div>

          <div>
            <label className={ETIQUETA}>El mensaje que leen en su página</label>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} maxLength={1500} className={`${CAMPO} resize-y leading-relaxed`} />
          </div>
          <div>
            <label className={ETIQUETA}>El regalo de agradecimiento</label>
            <input value={regalo} onChange={(e) => setRegalo(e.target.value)} maxLength={200} placeholder="Un mes de Spreekclub" className={CAMPO} />
            <p className={`${META} mt-1.5 !whitespace-normal`}>
              Es por grabarla, no por hablar bien: al alumno se le dice que es suyo diga lo que diga. Vacío = sin regalo.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F4] px-5 py-3.5">
          <p className={META}>{elegidos.length === 1 ? '1 elegido' : `${elegidos.length} elegidos`}</p>
          <div className="flex gap-2">
            <button onClick={onCerrar} className={BOTON}>
              Cancelar
            </button>
            <button onClick={invitar} disabled={!elegidos.length || enviando} className={BOTON_PRINCIPAL}>
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Invitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Una reseña ──────────────────────────────────────────────────────────────

function Fila({
  r,
  orgId,
  token,
  nombreUso,
  onCambio,
  onBorrada,
}: {
  r: ResenaPanel
  orgId: number
  token: string
  nombreUso: (id: string) => string
  onCambio: (r: ResenaPanel) => void
  onBorrada: (id: number) => void
}) {
  const [video, setVideo] = useState('')
  const [cargando, setCargando] = useState<'' | 'ver' | 'bajar' | 'estado' | 'regalo'>('')
  const [nota, setNota] = useState(r.nota || '')

  useEffect(() => setNota(r.nota || ''), [r.nota])
  // Si vuelve a grabarla, el vídeo que se estaba viendo ya no es el suyo.
  useEffect(() => {
    setVideo((u) => {
      if (u) URL.revokeObjectURL(u)
      return ''
    })
  }, [r.grabada_at])
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video)
  }, [video])

  async function hacer<T>(que: typeof cargando, f: () => Promise<T>): Promise<T | undefined> {
    setCargando(que)
    try {
      return await f()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo hacer')
    } finally {
      setCargando('')
    }
  }

  const ver = () => hacer('ver', async () => setVideo(await videoResena(orgId, r.id, token)))
  const bajar = () =>
    hacer('bajar', () => bajarVideo(orgId, r.id, `Resena-${(r.nombre.split(' ')[0] || 'alumno').replace(/[^\p{L}\p{N}]/gu, '')}.${r.video_mime.includes('webm') ? 'webm' : r.video_mime.includes('quicktime') ? 'mov' : 'mp4'}`, token))
  const estado = (e: 'aprobada' | 'descartada' | 'pendiente') =>
    hacer('estado', async () => {
      onCambio(await revisarResena(orgId, r.id, e, token))
    })
  const regalo = (dado: boolean) =>
    hacer('regalo', async () => {
      onCambio(await cambiarResena(orgId, r.id, { regalo_dado: dado }, token))
    })

  async function guardarNota() {
    if (nota.trim() === (r.nota || '').trim()) return
    try {
      onCambio(await cambiarResena(orgId, r.id, { nota }, token))
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la nota')
    }
  }

  async function borrar() {
    const ok = await confirmar(
      r.tiene_video
        ? `¿Borrar la reseña de ${r.nombre}? Se borra también su vídeo y no se puede recuperar.`
        : `¿Quitar la invitación de ${r.nombre}?`,
      { boton: r.tiene_video ? 'Sí, borrar' : 'Sí, quitar' }
    )
    if (!ok) return
    try {
      await borrarResena(orgId, r.id, token)
      onBorrada(r.id)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar')
    }
  }

  const plazo =
    r.estado === 'invitada' && r.plazo?.quedan !== null && r.plazo?.quedan !== undefined
      ? r.plazo.quedan >= 0
        ? r.plazo.quedan === 1
          ? 'le queda 1 día del plazo'
          : `le quedan ${r.plazo.quedan} días del plazo`
        : 'ya pasó el plazo que se le dio (puede grabarla igual)'
      : ''

  return (
    <div className={`${TARJETA} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#111827]">{r.nombre || 'Alumno'}</p>
          <Meta
            className="!whitespace-normal"
            partes={[
              r.invitada_at ? `Invitada el ${dia(r.invitada_at)}${r.invitada_por ? ` por ${r.invitada_por.split(' ')[0]}` : ''}` : '',
              r.grabada_at ? `grabada el ${dia(r.grabada_at)}` : plazo,
              r.tiene_video && r.video_seg ? minutos(r.video_seg) : '',
              r.tiene_video ? peso(r.video_bytes) : '',
              r.revisada_at ? `${r.estado} el ${dia(r.revisada_at)}${r.revisada_por ? ` por ${r.revisada_por.split(' ')[0]}` : ''}` : '',
            ]}
          />
        </div>
        <Estado tono={TONO[r.estado] || 'gris'}>{NOMBRE_ESTADO[r.estado]}</Estado>
      </div>

      {r.tiene_video ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            {video ? (
              <video src={video} controls playsInline className="w-full rounded-lg bg-black" />
            ) : (
              <button
                onClick={ver}
                disabled={cargando === 'ver'}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#E2E8F4] bg-[#F8FAFE] text-[13px] font-medium text-[#025dc7] hover:border-[#B9CBEA]"
                style={{ aspectRatio: '9 / 12' }}
              >
                {cargando === 'ver' ? <Loader2 size={20} className="animate-spin" /> : <Play size={22} />}
                {cargando === 'ver' ? 'Cargando el vídeo…' : 'Ver el vídeo'}
              </button>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            {r.texto ? (
              <div>
                <p className={ETIQUETA}>Lo que añadió por escrito</p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#111827]">{r.texto}</p>
              </div>
            ) : null}
            <div>
              <p className={ETIQUETA}>Su permiso</p>
              <p className="text-[13.5px] text-[#111827]">
                {r.usos.length ? r.usos.map(nombreUso).join(' · ') : 'Sin usos marcados'}
                {r.permiso_at ? <span className="text-[#6B7280]"> · aceptado el {dia(r.permiso_at)}</span> : null}
              </p>
              {r.permiso_texto ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12.5px] text-[#025dc7] hover:underline">Ver el texto que aceptó</summary>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#4B5563]">{r.permiso_texto}</p>
                </details>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {r.estado !== 'aprobada' ? (
                <button onClick={() => estado('aprobada')} disabled={!!cargando} className={BOTON_PRINCIPAL}>
                  <Check size={14} strokeWidth={3} /> Aprobar
                </button>
              ) : null}
              {r.estado !== 'descartada' ? (
                <button onClick={() => estado('descartada')} disabled={!!cargando} className={BOTON}>
                  Descartar
                </button>
              ) : null}
              {r.estado !== 'grabada' ? (
                <button onClick={() => estado('pendiente')} disabled={!!cargando} className={BOTON}>
                  Volver a pendiente
                </button>
              ) : null}
              <button onClick={bajar} disabled={!!cargando} className={BOTON}>
                {cargando === 'bajar' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Bajar vídeo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => copiar(r.whatsapp, 'Invitación copiada: pégala en WhatsApp')} className={BOTON}>
            <Copy size={14} /> Copiar invitación para WhatsApp
          </button>
          {r.estado === 'descartada' ? (
            <button onClick={() => estado('pendiente')} disabled={!!cargando} className={BOTON}>
              Volver a invitar
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-[#EEF2F9] pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className={ETIQUETA}>Nota del equipo (el alumno no la ve)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={guardarNota}
            rows={1}
            maxLength={3000}
            placeholder="Para qué la queremos usar, qué trozo es el bueno…"
            className={`${CAMPO} resize-y`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.regalo ? (
            r.regalo_dado_at ? (
              <button onClick={() => regalo(false)} disabled={!!cargando} title="Quitar la marca" className="inline-flex items-center gap-1.5 text-[12.5px] text-[#4B5563] hover:text-[#111827]">
                <Check size={13} strokeWidth={3} className="text-[#16A34A]" /> {r.regalo} · dado el {dia(r.regalo_dado_at)}
              </button>
            ) : r.tiene_video ? (
              <button onClick={() => regalo(true)} disabled={!!cargando} className={BOTON} title={r.regalo}>
                <Gift size={14} /> Regalo dado
              </button>
            ) : (
              <span className={META}>Regalo: {r.regalo}</span>
            )
          ) : null}
          <button onClick={borrar} className={BOTON_PELIGRO} title={r.tiene_video ? 'Borrar la reseña y su vídeo' : 'Quitar la invitación'}>
            <Trash2 size={14} /> {r.tiene_video ? 'Borrar' : 'Quitar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── La pantalla ─────────────────────────────────────────────────────────────

export default function ResenasPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [datos, setDatos] = useState<ResenasPanelDatos | null>(null)
  const [error, setError] = useState('')
  const [ver, setVer] = useState<Filtro>('todas')
  const [invitando, setInvitando] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    try {
      setDatos(await getResenas(org.id, token))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las reseñas')
    }
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filas = useMemo(() => {
    const todas = ordenarResenas(datos?.resenas || [])
    if (ver === 'todas') return todas
    if (ver === 'regalo') return todas.filter(regaloPorDar)
    return todas.filter((r) => r.estado === ver)
  }, [datos, ver])

  if (error && !datos) return <p className="py-10 text-center text-[14px] text-red-600">{error}</p>
  if (!datos)
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-[#9CA3AF]" />
      </div>
    )

  const c = datos.cifras
  const nombreUso = (id: string) => (datos.usos.find((u) => u.id === id)?.nombre || id).replace(' de Holandés Nawar', '').replace(/^En /, '')
  const alternar = (f: Filtro) => setVer((v) => (v === f ? 'todas' : f))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Cifra n={c.por_revisar} nombre="Grabadas, por revisar" activa={ver === 'grabada'} onClick={() => alternar('grabada')} />
        <Cifra n={c.invitadas} nombre="Invitadas, sin grabar" activa={ver === 'invitada'} onClick={() => alternar('invitada')} />
        <Cifra n={c.aprobadas} nombre="Aprobadas" activa={ver === 'aprobada'} onClick={() => alternar('aprobada')} />
        <Cifra n={c.regalos_por_dar} nombre="Regalos por dar" activa={ver === 'regalo'} onClick={() => alternar('regalo')} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setVer('todas')} className={filtro(ver === 'todas')}>
            Todas · {c.total}
          </button>
          {c.descartadas ? (
            <button onClick={() => alternar('descartada')} className={filtro(ver === 'descartada')}>
              Descartadas · {c.descartadas}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => copiar(datos.enlace, 'Enlace copiado')} className={BOTON} title={datos.enlace}>
            <Copy size={14} /> Copiar el enlace de la página
          </button>
          <button onClick={() => setInvitando(true)} className={BOTON_PRINCIPAL}>
            <UserPlus size={14} /> Invitar alumnos
          </button>
        </div>
      </div>

      {!datos.resenas.length ? (
        <div className={`${TARJETA} px-5 py-8 text-center`}>
          <p className="text-[15px] font-semibold text-[#0a1656]">Todavía no has pedido ninguna reseña</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-[#6B7280]">
            Elige a unos pocos alumnos que estén avanzando. Les sale un aviso en la escuela, graban un vídeo de un minuto y medio desde su móvil y
            te llega aquí para verlo.
          </p>
          <button onClick={() => setInvitando(true)} className={`${BOTON_PRINCIPAL} mt-4`}>
            <UserPlus size={14} /> Invitar alumnos
          </button>
        </div>
      ) : !filas.length ? (
        <p className="py-8 text-center text-[13.5px] text-[#6B7280]">Ninguna en este grupo.</p>
      ) : (
        <div className="space-y-3">
          {filas.map((r) => (
            <Fila
              key={r.id}
              r={r}
              orgId={org.id}
              token={token}
              nombreUso={nombreUso}
              onCambio={(nueva) => {
                setDatos((d) => (d ? { ...d, resenas: d.resenas.map((x) => (x.id === nueva.id ? nueva : x)) } : d))
                cargar()
              }}
              onBorrada={(id) => {
                setDatos((d) => (d ? { ...d, resenas: d.resenas.filter((x) => x.id !== id) } : d))
                cargar()
              }}
            />
          ))}
        </div>
      )}

      <p className={`${META} !whitespace-normal`}>
        Los vídeos son privados: solo los ves tú y quien los grabó. Para publicarlos, bájalos y súbelos donde toque, siempre dentro de los usos que
        marcó cada alumno.
      </p>

      {invitando ? (
        <Invitar
          orgId={org.id}
          token={token}
          datos={datos}
          onCerrar={() => setInvitando(false)}
          onHecho={(d) => {
            setDatos(d)
            setInvitando(false)
          }}
        />
      ) : null}
    </div>
  )
}
