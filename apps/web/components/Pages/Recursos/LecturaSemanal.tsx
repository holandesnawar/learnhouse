'use client'

/**
 * La «Lectura semanal» (12/11/2026), arriba de Recursos y en el Inicio.
 *
 * Usuario: "en Recursos, la lectura de esta semana, y luego pasa a un archivo
 * de lecturas con el texto, todo lo que va escrito y su vídeo… que salga al
 * inicio también como lectura de esta semana". Cada lectura lleva (todo
 * opcional menos el título): la hoja en PDF hecha en Claude Design (se ve
 * aquí y se descarga para imprimir), el texto en neerlandés para leer en
 * pantalla y escuchar párrafo a párrafo, su traducción plegada, las palabras
 * de la semana con su audio, el vídeo (YouTube se ve dentro; NOS u otro, un
 * enlace) y el enlace a los ejercicios de la comunidad, que es donde se
 * contestan.
 *
 * Se publica sola el lunes de su semana: la de antes pasa al archivo. El
 * equipo (administradores y profes) la crea aquí mismo y ve las que vienen.
 * Servidor: `services/lecturas/lecturas.py`.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { BookOpenText, ChatsCircle, SpeakerHigh } from '@phosphor-icons/react'
import { ChevronDown, Download, ExternalLink, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import {
  borrarLectura,
  crearLectura,
  editarLectura,
  getLecturas,
  parrafos,
  quitarHoja,
  semanaTexto,
  subirHoja,
  youtubeId,
  type Lectura,
  type MisLecturas,
} from '@services/lecturas/lecturas'
import { mediaSrc } from '@services/messages/direct'
import { getUriWithOrg } from '@services/config/config'
import { confirmar } from '@lib/nawar/confirmar'

const PaginasPdf = dynamic(() => import('@components/Objects/Activities/DocumentPdf/PaginasPdf'), { ssr: false })

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'
const BOTON = 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#E4E8F2] bg-white text-[13.5px] font-semibold text-[#0b2da0] hover:border-[#C9D4EC]'
const BOTON_PRINCIPAL = 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-50'

export function useLecturas() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<MisLecturas | null>(null)
  const cargar = useCallback(() => {
    if (!accessToken) return
    getLecturas(accessToken).then(setDatos)
  }, [accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { datos, cargar, accessToken }
}

// ── Escuchar: la voz de la escuela (/api/tts) y, si falla, la del navegador ──

function useVoz() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [sonando, setSonando] = useState<string>('')
  const parar = useCallback(() => {
    audio.current?.pause()
    audio.current = null
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* sin voz del navegador */
    }
    setSonando('')
  }, [])
  const hablar = useCallback(
    (texto: string) => {
      if (sonando === texto) return parar()
      parar()
      setSonando(texto)
      const a = new Audio(`/api/tts?text=${encodeURIComponent(texto.slice(0, 790))}`)
      audio.current = a
      a.onended = () => setSonando('')
      a.play().catch(() => {
        try {
          const u = new SpeechSynthesisUtterance(texto)
          u.lang = 'nl-NL'
          u.onend = () => setSonando('')
          window.speechSynthesis.speak(u)
        } catch {
          setSonando('')
        }
      })
    },
    [sonando, parar]
  )
  useEffect(() => parar, [parar])
  return { hablar, sonando }
}

function BotonOir({ texto, voz, etiqueta }: { texto: string; voz: ReturnType<typeof useVoz>; etiqueta?: string }) {
  const activo = voz.sonando === texto
  return (
    <button
      type="button"
      onClick={() => voz.hablar(texto)}
      title={activo ? 'Parar' : 'Escuchar'}
      className={`shrink-0 inline-flex items-center gap-1 rounded-lg ${etiqueta ? 'h-8 px-2.5 text-[12.5px] font-semibold' : 'h-8 w-8 justify-center'} ${
        activo ? 'bg-[#0b2da0] text-white' : 'text-[#0b2da0] hover:bg-[#EAF0FE]'
      }`}
    >
      <SpeakerHigh size={16} weight={activo ? 'fill' : 'regular'} />
      {etiqueta ? <span>{activo ? 'Parar' : etiqueta}</span> : null}
    </button>
  )
}

// ── Lo que se ve de una lectura ──────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">{titulo}</h4>
      {children}
    </div>
  )
}

export function CuerpoLectura({ l }: { l: Lectura }) {
  const voz = useVoz()
  const [traduccion, setTraduccion] = useState(false)
  const [hojaAbierta, setHojaAbierta] = useState(!l.texto)
  const [visorNavegador, setVisorNavegador] = useState(false)
  const hoja = l.hoja?.url ? mediaSrc(l.hoja.url) : ''
  const yt = l.video ? youtubeId(l.video) : ''
  const trozos = parrafos(l.texto || '')

  return (
    <div className="space-y-6">
      {hoja || l.comunidad ? (
        <div className="flex flex-wrap gap-2">
          {hoja ? (
            <>
              <button type="button" onClick={() => setHojaAbierta((v) => !v)} className={BOTON}>
                <FileText size={15} /> {hojaAbierta ? 'Esconder la hoja' : 'Ver la hoja'}
              </button>
              <a href={hoja} download={l.hoja?.name || 'lectura.pdf'} target="_blank" rel="noopener" className={BOTON}>
                <Download size={15} /> Descargar para imprimir
              </a>
            </>
          ) : null}
          {l.comunidad ? (
            <a href={l.comunidad} className={BOTON_PRINCIPAL}>
              <ChatsCircle size={16} /> Los ejercicios, en la comunidad
            </a>
          ) : null}
        </div>
      ) : null}

      {hoja && hojaAbierta ? (
        <div className="rounded-xl border border-[#EEF1F7] bg-[#F7F9FD] p-2 sm:p-3">
          {visorNavegador ? (
            <iframe src={`${hoja}#navpanes=0&view=FitH`} className="w-full h-[80vh] rounded-lg bg-white" title={l.titulo} />
          ) : (
            <PaginasPdf url={hoja} alFallar={() => setVisorNavegador(true)} />
          )}
        </div>
      ) : null}

      {trozos.length ? (
        <Seccion titulo="El texto">
          <div className="space-y-3">
            {trozos.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <p lang="nl" className="flex-1 text-[16px] leading-[1.7] text-[#0B1033]">
                  {p}
                </p>
                <BotonOir texto={p} voz={voz} />
              </div>
            ))}
          </div>
          {l.traduccion ? (
            <div>
              <button type="button" onClick={() => setTraduccion((v) => !v)} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#0b2da0]">
                <ChevronDown size={15} className={traduccion ? 'rotate-180' : ''} /> {traduccion ? 'Esconder el español' : 'Ver en español'}
              </button>
              {traduccion ? <p className="mt-2 whitespace-pre-line text-[14.5px] leading-[1.65] text-[#4A5272]">{l.traduccion}</p> : null}
            </div>
          ) : null}
        </Seccion>
      ) : null}

      {l.palabras?.length ? (
        <Seccion titulo="Palabras de la semana">
          <ul className="grid sm:grid-cols-2 gap-2">
            {l.palabras.map((p, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border border-[#EEF1F7] px-3 py-2.5">
                <BotonOir texto={p.ejemplo ? `${p.nl}. ${p.ejemplo}` : p.nl} voz={voz} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[#0B1033]" lang="nl">
                    {p.nl}
                  </span>
                  {p.es ? <span className="block text-[13.5px] text-[#4A5272]">{p.es}</span> : null}
                  {p.ejemplo ? (
                    <span className="block text-[13px] text-[#6B7393] italic mt-0.5" lang="nl">
                      {p.ejemplo}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {l.video ? (
        <Seccion titulo="Escucha">
          <p className="text-[13.5px] text-[#4A5272]">Escúchalo aunque no lo entiendas todo: fíjate en las palabras de la semana.</p>
          {yt ? (
            <div className="relative w-full max-w-[640px] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
                title={l.titulo}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a href={l.video} target="_blank" rel="noopener" className={BOTON}>
              <ExternalLink size={15} /> Ver el vídeo
            </a>
          )}
        </Seccion>
      ) : null}

      <div className="rounded-xl bg-[#F4F7FD] px-4 py-3 text-[13.5px] text-[#3B4262]">
        <span className="font-semibold text-[#0B1033]">Esta semana en la comunidad: </span>
        el miércoles, un mini ejercicio; el viernes, una pregunta para charlar. Contesta allí.
      </div>
    </div>
  )
}

// ── El bloque de Recursos ────────────────────────────────────────────────

export default function LecturaSemanal() {
  const { datos, cargar, accessToken } = useLecturas()
  const [editando, setEditando] = useState<Lectura | 'nueva' | null>(null)
  const [abierta, setAbierta] = useState<string>('')

  if (!datos) return null
  const { actual, archivo, proximas, equipo, org_id } = datos
  if (!actual && !archivo.length && !equipo) return null

  async function quitar(l: Lectura) {
    if (!(await confirmar(`¿Quitar la lectura «${l.titulo}»?`, { peligro: true, boton: 'Quitar' }))) return
    await borrarLectura(org_id, l.id, accessToken).catch(() => null)
    cargar()
  }

  const Acciones = ({ l }: { l: Lectura }) =>
    equipo ? (
      <div className="shrink-0 flex items-center gap-1">
        <button type="button" onClick={() => setEditando(l)} title="Cambiar" className="p-2 rounded-lg text-[#6B7393] hover:text-[#0b2da0]">
          <Pencil size={15} />
        </button>
        <button type="button" onClick={() => quitar(l)} title="Quitar" className="p-2 rounded-lg text-[#A3AAC2] hover:text-red-600">
          <Trash2 size={15} />
        </button>
      </div>
    ) : null

  return (
    <div id="lectura" className="space-y-5 scroll-mt-20">
      {editando ? (
        <EditorLectura
          orgId={org_id}
          accessToken={accessToken}
          lectura={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onHecho={() => {
            setEditando(null)
            cargar()
          }}
        />
      ) : null}

      <section className={TARJETA}>
        <div className="px-5 pt-4 pb-3 border-b border-[#EEF1F7] flex items-start gap-3">
          <BookOpenText size={24} className="text-[#0b2da0] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">
              Lectura de la semana{actual ? ` · ${semanaTexto(actual.semana)}` : ''}
            </p>
            {actual ? (
              <>
                <h2 style={POPPINS} className="text-[20px] font-bold text-[#0B1033] leading-snug" lang="nl">
                  {actual.titulo}
                </h2>
                {actual.titulo_es ? <p className="text-[14px] text-[#4A5272]">{actual.titulo_es}</p> : null}
              </>
            ) : (
              <p className="text-[14px] text-[#4A5272] mt-1">Esta semana todavía no hay lectura.</p>
            )}
          </div>
          {actual ? <Acciones l={actual} /> : null}
          {equipo ? (
            <button type="button" onClick={() => setEditando('nueva')} className={`${BOTON_PRINCIPAL} shrink-0`}>
              <Plus size={15} /> <span className="hidden sm:inline">Nueva lectura</span>
            </button>
          ) : null}
        </div>
        {actual ? (
          <div className="px-5 py-5">
            <CuerpoLectura l={actual} />
          </div>
        ) : null}
      </section>

      {equipo && proximas.length ? (
        <section className={TARJETA}>
          <h3 className="px-5 pt-4 pb-2 text-[14.5px] font-bold text-[#0B1033]">Programadas · solo las ve el equipo</h3>
          <ul className="divide-y divide-[#EEF1F7]">
            {proximas.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-medium text-[#0B1033] truncate">{l.titulo}</span>
                  <span className="block text-[12.5px] text-[#8A91AD]">Se publica el lunes · {semanaTexto(l.semana)}</span>
                </span>
                <Acciones l={l} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {archivo.length ? (
        <section className={TARJETA}>
          <h3 className="px-5 pt-4 pb-2 text-[14.5px] font-bold text-[#0B1033]">Archivo de lecturas</h3>
          <ul className="divide-y divide-[#EEF1F7]">
            {archivo.map((l) => {
              const abierto = abierta === l.id
              return (
                <li key={l.id}>
                  <div className="flex items-center">
                    <button type="button" onClick={() => setAbierta(abierto ? '' : l.id)} className="flex-1 min-w-0 flex items-center gap-3 px-5 py-3 text-left">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-medium text-[#0B1033] truncate" lang="nl">
                          {l.titulo}
                        </span>
                        <span className="block text-[12.5px] text-[#8A91AD] truncate">
                          {semanaTexto(l.semana)}
                          {l.titulo_es ? ` · ${l.titulo_es}` : ''}
                        </span>
                      </span>
                      <ChevronDown size={17} className={`text-[#8A91AD] shrink-0 ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                    <span className="pr-3">
                      <Acciones l={l} />
                    </span>
                  </div>
                  {abierto ? (
                    <div className="px-5 pb-5">
                      <CuerpoLectura l={l} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

// ── Crear y cambiar una lectura (equipo) ─────────────────────────────────

const CAMPO = 'w-full h-10 px-3 rounded-lg border border-[#DDE3F0] text-[14px] outline-none focus:border-[#0b2da0]'
const AREA = 'w-full px-3 py-2 rounded-lg border border-[#DDE3F0] text-[14px] leading-relaxed outline-none focus:border-[#0b2da0]'

function lunesDe(d: Date): string {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function EditorLectura({
  orgId,
  accessToken,
  lectura,
  onCerrar,
  onHecho,
}: {
  orgId: number
  accessToken: string
  lectura: Lectura | null
  onCerrar: () => void
  onHecho: () => void
}) {
  const [semana, setSemana] = useState(lectura?.semana || lunesDe(new Date()))
  const [titulo, setTitulo] = useState(lectura?.titulo || '')
  const [tituloEs, setTituloEs] = useState(lectura?.titulo_es || '')
  const [texto, setTexto] = useState(lectura?.texto || '')
  const [traduccion, setTraduccion] = useState(lectura?.traduccion || '')
  const [palabras, setPalabras] = useState((lectura?.palabras || []).map((p) => [p.nl, p.es, p.ejemplo].filter(Boolean).join(' | ')).join('\n'))
  const [video, setVideo] = useState(lectura?.video || '')
  const [comunidad, setComunidad] = useState(lectura?.comunidad || '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!titulo.trim() || !semana) return
    setGuardando(true)
    setError('')
    try {
      const datos = { semana, titulo, titulo_es: tituloEs, texto, traduccion, palabras, video, comunidad }
      const hecha = lectura ? await editarLectura(orgId, lectura.id, datos, accessToken) : await crearLectura(orgId, datos, accessToken)
      if (archivo) await subirHoja(orgId, hecha.id, archivo, accessToken)
      onHecho()
    } catch (e: any) {
      setError(String(e?.message || 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  async function sinHoja() {
    if (!lectura) return
    await quitarHoja(orgId, lectura.id, accessToken).catch(() => null)
    onHecho()
  }

  return (
    <section className={`${TARJETA} p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#0B1033]">{lectura ? 'Cambiar la lectura' : 'Nueva lectura'}</h2>
        <button type="button" onClick={onCerrar} className="p-1.5 rounded-lg text-[#6B7393]" aria-label="Cerrar">
          <X size={17} />
        </button>
      </div>
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#3B4262] mb-1">Semana</span>
        <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} className={CAMPO} />
        <span className="block text-[12px] text-[#6B7393] mt-1">Sale sola el lunes de esa semana. La de antes pasa al archivo.</span>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título en neerlandés (Fietsen in Nederland)" className={CAMPO} />
        <input value={tituloEs} onChange={(e) => setTituloEs(e.target.value)} placeholder="Título en español (La bici en Países Bajos)" className={CAMPO} />
      </div>
      <div className="rounded-lg border border-dashed border-[#C9D4EC] bg-[#FAFBFE] px-3 py-2.5 space-y-1.5">
        <span className="block text-[13px] font-semibold text-[#3B4262]">La hoja en PDF (la de Claude Design)</span>
        {lectura?.hoja?.url && !archivo ? (
          <div className="flex items-center gap-2 text-[13px] text-[#3B4262]">
            <FileText size={15} className="text-[#0b2da0]" />
            <span className="truncate flex-1">{lectura.hoja.name}</span>
            <button type="button" onClick={sinHoja} className="text-[12.5px] font-semibold text-red-600">
              Quitar
            </button>
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-[13.5px] text-[#0b2da0] font-semibold cursor-pointer">
          <Upload size={15} />
          <span className="truncate">{archivo ? archivo.name : lectura?.hoja?.url ? 'Cambiar el PDF' : 'Elegir el PDF'}</span>
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
      </div>
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#3B4262] mb-1">El texto en neerlandés (para leer en pantalla y escuchar)</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} className={AREA} placeholder="Una línea en blanco entre párrafo y párrafo" />
      </label>
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#3B4262] mb-1">La traducción (sale plegada)</span>
        <textarea value={traduccion} onChange={(e) => setTraduccion(e.target.value)} rows={4} className={AREA} />
      </label>
      <label className="block">
        <span className="block text-[13px] font-semibold text-[#3B4262] mb-1">Palabras de la semana</span>
        <textarea
          value={palabras}
          onChange={(e) => setPalabras(e.target.value)}
          rows={5}
          className={AREA}
          placeholder={'Una por línea: palabra | traducción | ejemplo\nde fiets | la bici | Ik ga met de fiets naar mijn werk.'}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Enlace del vídeo (YouTube, NOS…)" className={CAMPO} />
        <input value={comunidad} onChange={(e) => setComunidad(e.target.value)} placeholder="Enlace a los ejercicios en la comunidad" className={CAMPO} />
      </div>
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <button type="button" disabled={guardando || !titulo.trim() || !semana} onClick={guardar} className={BOTON_PRINCIPAL}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : null}
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}

// ── En el Inicio ─────────────────────────────────────────────────────────

export function LecturaEnInicio({ orgslug }: { orgslug: string }) {
  const { datos } = useLecturas()
  const l = datos?.actual
  if (!l) return null
  return (
    <Link
      href={`${getUriWithOrg(orgslug, '/recursos')}#lectura`}
      className={`${TARJETA} flex items-center gap-3 px-4 py-3.5 hover:border-[#C9D4EC]`}
    >
      <BookOpenText size={26} className="text-[#0b2da0] shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Lectura de la semana</span>
        <span className="block text-[14.5px] font-semibold text-[#0B1033] truncate" lang="nl">
          {l.titulo}
        </span>
        {l.titulo_es ? <span className="block text-[13px] text-[#6B7393] truncate">{l.titulo_es}</span> : null}
      </span>
    </Link>
  )
}
