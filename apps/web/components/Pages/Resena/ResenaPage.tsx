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
 * La lógica, en apps/api/src/services/resenas/resenas.py.
 */

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Loader2, Upload, Video } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getMiResena, mandarResena, miVideo, type MiResena, type Resena } from '@services/resenas/resenas'
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

function Recibida({ datos, token, onRepetir }: { datos: MiResena; token: string; onRepetir: () => void }) {
  const r = datos.resena as Resena
  const aprobada = r.estado === 'aprobada'
  const descartada = r.estado === 'descartada'
  const nombres = datos.usos.filter((u) => r.usos.includes(u.id)).map((u) => u.nombre.replace(' de Holandés Nawar', '').toLowerCase())
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-2 border-[#16A34A] text-[#16A34A]">
          <Check size={14} strokeWidth={3.4} />
        </span>
        <div>
          <p className="text-[18px] font-bold text-[#0a1656]" style={POPPINS}>
            {aprobada ? '¡Gracias! Tu reseña está aprobada' : descartada ? 'Gracias por tu vídeo' : '¡Gracias! Ya tenemos tu vídeo'}
          </p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-[#374151]">
            {aprobada
              ? 'La usaremos solo en los sitios que marcaste. Si algún día quieres que la retiremos, escríbenos y la quitamos.'
              : descartada
                ? 'Lo hemos visto y al final no lo vamos a publicar. No pasa nada: gracias de verdad por tu tiempo. Si quieres, puedes grabar otro.'
                : 'Lo vemos en los próximos días. Mientras tanto, si no te convence, puedes volver a grabarlo.'}
          </p>
        </div>
      </div>

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
        <button onClick={onRepetir} className={BOTON_CLARO}>
          <Video size={17} /> Volver a grabarla
        </button>
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
  const invitado = !!r && !(r.estado === 'descartada' && !r.tiene_video)

  if (!invitado || !r) {
    return (
      <GeneralWrapperStyled>
        <div className="max-w-xl py-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl" style={POPPINS}>
            Tu opinión en vídeo
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#374151]">
            De vez en cuando pedimos a algunos alumnos que nos cuenten en un vídeo corto cómo les va. Ahora mismo no tienes ninguna invitación
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
              Un vídeo en vertical de 60 a 90 segundos. {plazo}
            </p>
            <p>
              Cuenta lo que piensas de verdad, lo bueno y lo que mejorarías.
              {r.regalo ? (
                <>
                  {' '}
                  Como agradecimiento por tu tiempo: <span className="font-semibold text-[#0a1656]">{r.regalo.replace(/\.$/, '')}</span>. Es
                  tuyo por grabarla, digas lo que digas.
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          {formulario ? (
            <Formulario
              datos={data}
              token={token}
              onCancelar={repetir && r.tiene_video ? () => setRepetir(false) : undefined}
              onHecho={(d) => {
                queryClient.setQueryData(clave, d)
                setRepetir(false)
                toast.success('¡Reseña enviada! Gracias.')
                if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
              }}
            />
          ) : (
            <Recibida datos={data} token={token} onRepetir={() => setRepetir(true)} />
          )}
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}
