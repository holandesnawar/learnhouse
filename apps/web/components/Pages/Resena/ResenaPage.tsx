'use client'

/**
 * `/resena`: el alumno graba su reseña en vídeo sin salir de la escuela
 * (10/11/2026). Solo la ve quien ha sido invitado desde Panel → Reseñas.
 *
 * El orden de la página es el orden en que se hace: las cuatro preguntas,
 * unos consejos, grabar (con la cámara del navegador) o elegir un vídeo del
 * móvil, verlo, marcar el permiso y mandarlo. Sin el permiso marcado no se
 * manda nada.
 *
 * El regalo se presenta como lo que es, un agradecimiento por el tiempo: no
 * depende de que la reseña sea buena, y la pantalla lo dice.
 * Desde el 25/11/2026 se puede contestar POR ESCRITO (de serie), con foto
 * opcional y su propio permiso, o en vídeo. Lo que se va escribiendo se
 * guarda en el navegador por si se cierra la página.
 * La lógica, en apps/api/src/services/resenas/resenas.py.
 */

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, ImagePlus, Loader2, PenLine, Upload, Video, X } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getMiResena, mandarEscrita, mandarResena, miFoto, miVideo, type MiResena, type Resena } from '@services/resenas/resenas'
import { avisoDuracion, extensionDe, minutos, peso, textoPlazo } from '@/lib/nawar/resenas'
import GrabadorVideo, { type VideoGrabado } from './GrabadorVideo'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const BOTON = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0b2da0] px-5 text-[14.5px] font-semibold text-white hover:bg-[#09248a] disabled:opacity-50 transition-colors'
const BOTON_CLARO =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D5DDEC] bg-white px-5 text-[14.5px] font-semibold text-[#0a1656] hover:border-[#0b2da0] hover:text-[#0b2da0] disabled:opacity-50 transition-colors'

interface Elegido {
  blob: Blob
  seg: number
  tipo: string
  url: string
  nombre: string
}

/** Cuánto dura un vídeo elegido del móvil (0 si el navegador no lo sabe leer). */
function duracionDe(url: string): Promise<number> {
  return new Promise((resolver) => {
    const v = document.createElement('video')
    const fin = (n: number) => {
      v.removeAttribute('src')
      resolver(Number.isFinite(n) && n > 0 ? Math.round(n) : 0)
    }
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => fin(v.duration)
    v.onerror = () => fin(0)
    setTimeout(() => fin(0), 6000)
    v.src = url
  })
}

function Casilla({ marcada, onCambio, children }: { marcada: boolean; onCambio: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={marcada} onChange={(e) => onCambio(e.target.checked)} className="sr-only" />
      <span
        className={`mt-0.5 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border-2 ${
          marcada ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-[#B8C2DA]'
        }`}
      >
        {marcada ? <Check size={13} strokeWidth={3.4} /> : null}
      </span>
      <span className="text-[14px] leading-relaxed text-[#1F2937]">{children}</span>
    </label>
  )
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[16px] font-bold text-[#0a1656]" style={POPPINS}>
      {children}
    </h2>
  )
}

/** El vídeo ya mandado: se pide con la sesión solo cuando se quiere ver. */
function MiVideo({ token, seg }: { token: string; seg: number }) {
  const [url, setUrl] = useState('')
  const [cargando, setCargando] = useState(false)
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  async function ver() {
    setCargando(true)
    try {
      setUrl(await miVideo(token))
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cargar el vídeo')
    } finally {
      setCargando(false)
    }
  }
  if (url) return <video src={url} controls playsInline className="mx-auto w-full max-w-[300px] rounded-xl bg-black" />
  return (
    <button onClick={ver} disabled={cargando} className={BOTON_CLARO}>
      {cargando ? <Loader2 size={16} className="animate-spin" /> : <Video size={17} />} Ver mi vídeo{seg ? ` (${minutos(seg)})` : ''}
    </button>
  )
}

const BORRADOR = 'nawar.resena.borrador'

function leerBorrador(): { respuestas?: Record<string, string>; firma?: string } {
  try {
    return JSON.parse(localStorage.getItem(BORRADOR) || '{}') || {}
  } catch {
    return {}
  }
}

function CampoTexto({ valor, onCambio, placeholder, filas = 3 }: { valor: string; onCambio: (v: string) => void; placeholder?: string; filas?: number }) {
  return (
    <textarea
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      rows={filas}
      maxLength={2000}
      placeholder={placeholder}
      className="mt-2 w-full resize-y rounded-xl border border-[#DDE6F5] px-4 py-3 text-[15px] leading-relaxed text-gray-900 outline-none focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/20"
    />
  )
}

/** La reseña por escrito: las preguntas, la firma, la foto y el permiso. */
function FormularioEscrita({ datos, token, onHecho, onCancelar }: { datos: MiResena; token: string; onHecho: (d: MiResena) => void; onCancelar?: () => void }) {
  const resena = datos.resena as Resena
  const previa = resena.escrita
  const [respuestas, setRespuestas] = useState<Record<string, string>>(() => ({ ...(previa?.respuestas || {}), ...(leerBorrador().respuestas || {}) }))
  const [firma, setFirma] = useState<string>(() => leerBorrador().firma || previa?.firma || '')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState('')
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [permiso, setPermiso] = useState(false)
  const [usos, setUsos] = useState<string[]>(previa?.usos || [])
  const [enviando, setEnviando] = useState(false)
  const elegir = useRef<HTMLInputElement | null>(null)

  // Lo que va escribiendo se guarda en el navegador por si cierra la página.
  useEffect(() => {
    try {
      localStorage.setItem(BORRADOR, JSON.stringify({ respuestas, firma }))
    } catch {}
  }, [respuestas, firma])

  // La foto que ya mandó, si la hay.
  useEffect(() => {
    if (!resena.tiene_foto) return
    let vivo = true
    let url = ''
    miFoto(token)
      .then((u) => {
        url = u
        if (vivo) setFotoUrl((x) => x || u)
        else URL.revokeObjectURL(u)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [resena.tiene_foto, token])

  function fotoElegida(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > datos.max_foto_mb * 1024 * 1024) {
      toast.error(`Esa foto pesa ${peso(f.size)} y el máximo son ${datos.max_foto_mb} MB. Haz una captura de pantalla de ella y sube la captura.`)
      return
    }
    setFoto(f)
    setQuitarFoto(false)
    setFotoUrl(URL.createObjectURL(f))
  }

  function sinFoto() {
    setFoto(null)
    setFotoUrl('')
    setQuitarFoto(true)
  }

  const faltan = datos.preguntas_escrita.filter((p) => p.obligatoria && !(respuestas[p.id] || '').trim())
  const listo = !faltan.length && !!firma.trim() && permiso && usos.length > 0

  async function mandar() {
    if (faltan.length) return toast.error(`Contesta también: ${faltan[0].pregunta}`)
    if (!firma.trim()) return toast.error('Escribe cómo quieres que salga tu nombre')
    if (!permiso) return toast.error('Marca la casilla del permiso para poder mandarla')
    if (!usos.length) return toast.error('Marca al menos un sitio donde nos dejas usarla')
    setEnviando(true)
    try {
      const d = await mandarEscrita({ respuestas, firma: firma.trim(), usos, foto, quitarFoto }, token)
      try {
        localStorage.removeItem(BORRADOR)
      } catch {}
      onHecho(d)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo mandar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        {datos.preguntas_escrita.map((p, i) => (
          <div key={p.id}>
            <p className="text-[15.5px] font-semibold leading-snug text-[#0a1656]">
              <span className="mr-1.5 tabular-nums text-[#0b2da0]">{i + 1}.</span>
              {p.pregunta}
              {p.obligatoria ? null : <span className="ml-1.5 text-[12.5px] font-normal text-[#8A93A3]">(si quieres)</span>}
            </p>
            {p.ayuda ? <p className="mt-0.5 text-[13.5px] text-[#5A6480]">{p.ayuda}</p> : null}
            <CampoTexto valor={respuestas[p.id] || ''} onCambio={(v) => setRespuestas((r) => ({ ...r, [p.id]: v }))} filas={p.id === 'frase' ? 1 : 3} />
          </div>
        ))}
      </section>

      <section>
        <Titulo>Cómo quieres que salga tu nombre</Titulo>
        <p className="mt-1 text-[14px] text-[#5A6480]">Por ejemplo «María G., Rotterdam» o solo «María». Tú decides.</p>
        <input
          value={firma}
          onChange={(e) => setFirma(e.target.value)}
          maxLength={120}
          placeholder="María G., Rotterdam"
          className="mt-2 w-full max-w-sm rounded-xl border border-[#DDE6F5] px-4 py-3 text-[15px] text-gray-900 outline-none focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/20"
        />
      </section>

      <section>
        <Titulo>Una foto tuya</Titulo>
        <p className="mt-1 text-[14px] text-[#5A6480]">No es obligatoria, pero ayuda mucho a que se vea que eres una persona real. De cara y con buena luz; un selfie vale.</p>
        <input ref={elegir} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={fotoElegida} />
        {fotoUrl && !quitarFoto ? (
          <div className="mt-3 flex items-end gap-3">
            <img src={fotoUrl} alt="Tu foto" className="h-36 w-28 rounded-xl object-cover" />
            <div className="flex flex-col gap-2">
              <button onClick={() => elegir.current?.click()} className={BOTON_CLARO}>
                <ImagePlus size={16} /> Cambiar
              </button>
              <button onClick={sinFoto} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#5A6480] underline hover:text-[#0b2da0]">
                <X size={14} /> Quitar la foto
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => elegir.current?.click()} className={`${BOTON_CLARO} mt-3`}>
            <ImagePlus size={16} /> Subir una foto
          </button>
        )}
      </section>

      <section>
        <Titulo>Tu permiso</Titulo>
        <div className="mt-3 space-y-3">
          <Casilla marcada={permiso} onCambio={setPermiso}>
            {datos.permiso_escrita}
          </Casilla>
          <div className="ml-8 space-y-2.5 border-l border-[#E4E8F2] pl-4">
            <p className="text-[13px] font-semibold text-[#0a1656]">Dónde nos dejas usarla</p>
            {datos.usos.map((u) => (
              <Casilla key={u.id} marcada={usos.includes(u.id)} onCambio={(v) => setUsos((x) => (v ? [...x.filter((y) => y !== u.id), u.id] : x.filter((y) => y !== u.id)))}>
                {u.nombre}
              </Casilla>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button onClick={mandar} disabled={enviando || !listo} className={BOTON}>
          {enviando ? <Loader2 size={16} className="animate-spin" /> : null} Enviar mi reseña
        </button>
        {onCancelar ? (
          <button onClick={onCancelar} className="text-[13.5px] font-semibold text-[#5A6480] underline hover:text-[#0b2da0]">
            Dejar la que ya mandé
          </button>
        ) : null}
        {!listo ? (
          <p className="w-full text-[13px] text-[#6B7280]">
            {faltan.length
              ? `Faltan ${faltan.length === 1 ? 'una pregunta' : `${faltan.length} preguntas`} sin «(si quieres)».`
              : !firma.trim()
                ? 'Falta tu nombre.'
                : 'Marca el permiso y al menos un sitio para poder enviarla.'}{' '}
            Lo que escribes se guarda en este móvil u ordenador aunque cierres la página.
          </p>
        ) : null}
      </section>
    </div>
  )
}

function Formulario({ datos, token, onHecho, onCancelar }: { datos: MiResena; token: string; onHecho: (d: MiResena) => void; onCancelar?: () => void }) {
  const resena = datos.resena as Resena
  const [grabador, setGrabador] = useState(false)
  const [video, setVideo] = useState<Elegido | null>(null)
  const [texto, setTexto] = useState(resena.texto || '')
  const [permiso, setPermiso] = useState(false)
  const [usos, setUsos] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState<number | null>(null)
  const cancelar = useRef<(() => void) | null>(null)
  const elegir = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => {
    if (video?.url) URL.revokeObjectURL(video.url)
  }, [video?.url])
  useEffect(() => () => cancelar.current?.(), [])

  function grabado(v: VideoGrabado) {
    setGrabador(false)
    setVideo({ ...v, url: URL.createObjectURL(v.blob), nombre: `resena.${extensionDe(v.tipo)}` })
  }

  async function elegido(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > datos.max_mb * 1024 * 1024) {
      toast.error(`Ese vídeo pesa ${peso(f.size)} y el máximo son ${datos.max_mb} MB. Grábalo más corto (60-90 segundos).`)
      return
    }
    const url = URL.createObjectURL(f)
    const seg = await duracionDe(url)
    setGrabador(false)
    setVideo({ blob: f, seg, tipo: f.type || '', url, nombre: f.name || `resena.${extensionDe(f.type)}` })
  }

  function conUso(id: string, v: boolean) {
    setUsos((u) => (v ? [...u.filter((x) => x !== id), id] : u.filter((x) => x !== id)))
  }

  async function mandar() {
    if (!video) return
    if (!permiso) {
      toast.error('Marca la casilla del permiso para poder mandarlo')
      return
    }
    if (!usos.length) {
      toast.error('Marca al menos un sitio donde nos dejas usar el vídeo')
      return
    }
    setSubiendo(0)
    const envio = mandarResena({ video: video.blob, nombre: video.nombre, texto, usos, segundos: video.seg }, token, setSubiendo)
    cancelar.current = envio.cancelar
    try {
      const d = await envio.promesa
      cancelar.current = null
      onHecho(d)
    } catch (e: any) {
      if (e?.message !== 'Subida cancelada') toast.error(e?.message || 'No se pudo mandar el vídeo')
    } finally {
      cancelar.current = null
      setSubiendo(null)
    }
  }

  const duracion = video ? avisoDuracion(video.seg) : null

  return (
    <div className="space-y-8">
      <section>
        <Titulo>Las cuatro preguntas</Titulo>
        <p className="mt-1 text-[14px] text-[#5A6480]">No hace falta contestarlas una a una: son para que sepas de qué hablar.</p>
        <ol className="mt-3 space-y-2.5">
          {datos.preguntas.map((p, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#111827]">
              <span className="w-5 shrink-0 font-semibold text-[#0b2da0] tabular-nums">{i + 1}.</span>
              {p}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Titulo>Antes de grabar</Titulo>
        <ul className="mt-3 space-y-2">
          {datos.consejos.map((c, i) => (
            <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[#374151]">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#9AA6C4]" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Titulo>Tu vídeo</Titulo>
        <input ref={elegir} type="file" accept="video/*" className="hidden" onChange={elegido} />
        {grabador ? (
          <div className="mt-3">
            <GrabadorVideo onListo={grabado} onCerrar={() => setGrabador(false)} />
            <button onClick={() => elegir.current?.click()} className="mt-3 text-[13.5px] font-semibold text-[#5A6480] underline hover:text-[#0b2da0]">
              Mejor elijo un vídeo del móvil
            </button>
          </div>
        ) : video ? (
          <div className="mt-3">
            <video src={video.url} controls playsInline className="mx-auto w-full max-w-[300px] rounded-xl bg-black" />
            <p className="mt-2 text-center text-[13px] text-[#6B7280]">
              {video.seg ? `${minutos(video.seg)} · ` : ''}
              {peso(video.blob.size)}
              {duracion ? <span className={duracion.tono === 'bien' ? ' text-[#15803D]' : ' text-[#8A6A2A]'}> · {duracion.texto}</span> : null}
            </p>
            <p className="mt-1 text-center text-[13px] text-[#6B7280]">Míralo antes de mandarlo. Si no te convence, repítelo las veces que quieras.</p>
            {subiendo === null ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => {
                    setVideo(null)
                    setGrabador(true)
                  }}
                  className={BOTON_CLARO}
                >
                  <Video size={17} /> Repetir
                </button>
                <button onClick={() => elegir.current?.click()} className={BOTON_CLARO}>
                  <Upload size={16} /> Elegir otro
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => setGrabador(true)} className={BOTON}>
              <Video size={17} /> Grabar ahora
            </button>
            <button onClick={() => elegir.current?.click()} className={BOTON_CLARO}>
              <Upload size={16} /> Elegir un vídeo del móvil
            </button>
          </div>
        )}
      </section>

      {video ? (
        <>
          <section>
            <Titulo>¿Quieres añadir algo por escrito?</Titulo>
            <p className="mt-1 text-[14px] text-[#5A6480]">No es obligatorio.</p>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Una frase que resuma cómo te ha ido, algo que mejorarías…"
              className="mt-2 w-full resize-y rounded-xl border border-[#DDE6F5] px-4 py-3 text-[15px] leading-relaxed text-gray-900 outline-none focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/20"
            />
          </section>

          <section>
            <Titulo>Tu permiso</Titulo>
            <div className="mt-3 space-y-3">
              <Casilla marcada={permiso} onCambio={setPermiso}>
                {datos.permiso_texto}
              </Casilla>
              <div className="ml-8 space-y-2.5 border-l border-[#E4E8F2] pl-4">
                <p className="text-[13px] font-semibold text-[#0a1656]">Dónde nos dejas usarlo</p>
                {datos.usos.map((u) => (
                  <Casilla key={u.id} marcada={usos.includes(u.id)} onCambio={(v) => conUso(u.id, v)}>
                    {u.nombre}
                  </Casilla>
                ))}
              </div>
            </div>
          </section>

          <section>
            {subiendo === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={mandar} disabled={!permiso || !usos.length} className={BOTON}>
                  Enviar mi reseña
                </button>
                {onCancelar ? (
                  <button onClick={onCancelar} className="text-[13.5px] font-semibold text-[#5A6480] underline hover:text-[#0b2da0]">
                    Dejar la que ya mandé
                  </button>
                ) : null}
                {!permiso || !usos.length ? <p className="w-full text-[13px] text-[#6B7280]">Marca el permiso y al menos un sitio para poder enviarla.</p> : null}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[13.5px] font-semibold text-[#0a1656]">
                  <span>{subiendo >= 99 ? 'Guardando el vídeo…' : 'Subiendo el vídeo…'}</span>
                  <span className="tabular-nums">{subiendo} %</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8EDF8]">
                  <div className="h-full rounded-full bg-[#0b2da0] transition-[width] duration-200" style={{ width: `${Math.max(2, subiendo)}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-[#6B7280]">
                  No cierres esta página hasta que termine. Con datos del móvil puede tardar un par de minutos.{' '}
                  <button onClick={() => cancelar.current?.()} className="font-semibold underline hover:text-[#0b2da0]">
                    Cancelar
                  </button>
                </p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function MiFoto({ token }: { token: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let vivo = true
    let u = ''
    miFoto(token)
      .then((x) => {
        u = x
        if (vivo) setUrl(x)
        else URL.revokeObjectURL(x)
      })
      .catch(() => {})
    return () => {
      vivo = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [token])
  return url ? <img src={url} alt="Tu foto" className="h-36 w-28 rounded-xl object-cover" /> : null
}

function Recibida({ datos, token, onRepetir }: { datos: MiResena; token: string; onRepetir: (modo: 'escrita' | 'video') => void }) {
  const r = datos.resena as Resena
  const aprobada = r.estado === 'aprobada'
  const descartada = r.estado === 'descartada'
  const usosHechos = Array.from(new Set([...(r.usos || []), ...(r.escrita?.usos || [])]))
  const nombres = datos.usos.filter((u) => usosHechos.includes(u.id)).map((u) => u.nombre.replace(' de Holandés Nawar', '').toLowerCase())
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-2 border-[#16A34A] text-[#16A34A]">
          <Check size={14} strokeWidth={3.4} />
        </span>
        <div>
          <p className="text-[18px] font-bold text-[#0a1656]" style={POPPINS}>
            {aprobada ? '¡Gracias! Tu reseña está aprobada' : descartada ? 'Gracias por tu reseña' : '¡Gracias! Ya tenemos tu reseña'}
          </p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-[#374151]">
            {aprobada
              ? 'La usaremos solo en los sitios que marcaste. Si algún día quieres que la retiremos, escríbenos y la quitamos.'
              : descartada
                ? 'La hemos visto y al final no la vamos a publicar. No pasa nada: gracias de verdad por tu tiempo.'
                : 'La vemos en los próximos días. Mientras tanto, puedes cambiarla si quieres.'}
          </p>
        </div>
      </div>

      {r.tiene_escrita && r.escrita ? (
        <div className="flex gap-4">
          {r.tiene_foto ? <MiFoto token={token} /> : null}
          <div className="min-w-0 space-y-2 text-[14px] leading-relaxed text-[#374151]">
            {datos.preguntas_escrita
              .filter((p) => (r.escrita?.respuestas[p.id] || '').trim())
              .slice(0, 3)
              .map((p) => (
                <p key={p.id} className="line-clamp-3">
                  {r.escrita?.respuestas[p.id]}
                </p>
              ))}
            <p className="font-semibold text-[#0a1656]">— {r.escrita.firma}</p>
          </div>
        </div>
      ) : null}

      {r.tiene_video ? <MiVideo token={token} seg={r.video_seg} /> : null}

      <dl className="space-y-2 text-[14px]">
        {nombres.length ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-[#6B7280]">Nos dejas usarlo:</dt>
            <dd className="text-[#111827]">{nombres.join(' · ')}</dd>
          </div>
        ) : null}
        {r.regalo ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-[#6B7280]">Nuestro agradecimiento:</dt>
            <dd className="text-[#111827]">
              {r.regalo}
              {r.regalo_dado_at ? ' (ya lo tienes)' : '. Te escribimos para dártelo.'}
            </dd>
          </div>
        ) : null}
      </dl>

      {!aprobada ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onRepetir('escrita')} className={BOTON_CLARO}>
            <PenLine size={16} /> {r.tiene_escrita ? 'Cambiar lo que escribí' : 'Contestar por escrito'}
          </button>
          <button onClick={() => onRepetir('video')} className={BOTON_CLARO}>
            <Video size={17} /> {r.tiene_video ? 'Volver a grabar el vídeo' : 'Grabar también un vídeo'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function ResenaPage() {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const orgslug = org?.slug || ''
  const queryClient = useQueryClient()
  const clave = ['resenas', 'mia']
  const { data, error, isLoading } = useQuery<MiResena>({
    queryKey: clave,
    queryFn: () => getMiResena(token),
    enabled: !!token,
    retry: 1,
    staleTime: 0,
  })
  const [repetir, setRepetir] = useState(false)
  const [modo, setModo] = useState<'escrita' | 'video'>('escrita')

  if (isLoading || (!data && !error)) {
    return (
      <GeneralWrapperStyled>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </GeneralWrapperStyled>
    )
  }
  if (error || !data) {
    return (
      <GeneralWrapperStyled>
        <p className="py-16 text-center text-[14px] text-[#6B7280]">{(error as any)?.message || 'No se ha podido cargar la página.'}</p>
      </GeneralWrapperStyled>
    )
  }

  const r = data.resena
  // Una invitación retirada (descartada sin vídeo) es como no tener ninguna.
  const invitado = !!r && !(r.estado === 'descartada' && !r.tiene_video && !r.tiene_escrita)

  if (!invitado || !r) {
    return (
      <GeneralWrapperStyled>
        <div className="max-w-xl py-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl" style={POPPINS}>
            Tu opinión
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#374151]">
            De vez en cuando pedimos a algunos alumnos que nos cuenten cómo les va. Ahora mismo no tienes ninguna invitación
            pendiente.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#374151]">
            Si te apetece dejarnos una, escríbenos y te la abrimos.
          </p>
          <Link href={getUriWithOrg(orgslug, '/mensajes')} className={`${BOTON_CLARO} mt-5`}>
            Escribir al equipo
          </Link>
        </div>
      </GeneralWrapperStyled>
    )
  }

  const formulario = r.estado === 'invitada' || repetir
  const plazo = textoPlazo(r.plazo?.quedan)

  return (
    <GeneralWrapperStyled>
      <div className="max-w-2xl pb-16">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl" style={POPPINS}>
          Cuéntanos cómo te va
        </h1>
        {formulario ? (
          <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-[#374151]">
            {r.mensaje ? <p className="whitespace-pre-line">{r.mensaje}</p> : null}
            <p>
              {modo === 'video' ? 'Un vídeo en vertical de 60 a 90 segundos. ' : ''}{plazo}
            </p>
            <p>
              Cuenta lo que piensas de verdad, lo bueno y lo que mejorarías.
              {r.regalo ? (
                <>
                  {' '}
                  Como agradecimiento por tu tiempo: <span className="font-semibold text-[#0a1656]">{r.regalo.replace(/\.$/, '')}</span>. Es
                  tuyo por hacerla, digas lo que digas.
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          {formulario ? (
            <>
              {r.estado === 'invitada' ? (
                <div className="mb-8 inline-flex rounded-xl border border-[#DDE6F5] bg-[#F7F9FD] p-1" role="tablist">
                  {(
                    [
                      ['escrita', 'Por escrito', PenLine],
                      ['video', 'En vídeo', Video],
                    ] as const
                  ).map(([id, nombre, Icono]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={modo === id}
                      onClick={() => setModo(id)}
                      className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold transition-colors ${
                        modo === id ? 'bg-white text-[#0b2da0] shadow-[0_1px_2px_rgba(16,24,64,0.08)]' : 'text-[#5A6480] hover:text-[#0a1656]'
                      }`}
                    >
                      <Icono size={16} /> {nombre}
                    </button>
                  ))}
                </div>
              ) : null}
              {modo === 'escrita' ? (
                <FormularioEscrita
                  datos={data}
                  token={token}
                  onCancelar={repetir ? () => setRepetir(false) : undefined}
                  onHecho={(d) => {
                    queryClient.setQueryData(clave, d)
                    setRepetir(false)
                    toast.success('¡Reseña enviada! Gracias.')
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
                  }}
                />
              ) : (
                <Formulario
                  datos={data}
                  token={token}
                  onCancelar={repetir ? () => setRepetir(false) : undefined}
                  onHecho={(d) => {
                    queryClient.setQueryData(clave, d)
                    setRepetir(false)
                    toast.success('¡Reseña enviada! Gracias.')
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
                  }}
                />
              )}
            </>
          ) : (
            <Recibida
              datos={data}
              token={token}
              onRepetir={(m) => {
                setModo(m)
                setRepetir(true)
              }}
            />
          )}
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}
