'use client'

/**
 * «Mijn eerste week» (10/11/2026): tu primera semana en neerlandés, a tu medida.
 *
 * Dos pantallas en la misma dirección:
 * - Sin enlace personal: la portada y las preguntas (cinco toques y, al final,
 *   nombre, correo y WhatsApp). Mientras contesta, ve cómo se va escribiendo
 *   SU primera frase en neerlandés: es lo que enseña que esto no es un PDF.
 * - Con enlace (`?t=…`, o el que guarda el navegador): sus siete días. Cada
 *   día: sus frases con audio, una práctica corta, un reto para la calle y
 *   «He terminado». Se abre uno cada día (lo decide el servidor).
 *
 * El contenido lo arma el servidor (`apps/api/src/services/reto/reto.py`); de
 * un día cerrado no llegan ni las frases. Aquí solo se pinta.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Volume2 } from 'lucide-react'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { barajar } from '@/lib/exercises-app/barajar'

const LOGO_URL = 'https://d1yei2z3i6k35z.cloudfront.net/9533860/671a9c9265e23_Logo_Nawar_2.png'
const FONDO = {
  backgroundColor: '#1D0084',
  backgroundImage:
    'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
    'radial-gradient(ellipse 960px 560px at 50% 0%, rgba(11,109,240,0.50) 0%, transparent 65%), ' +
    'radial-gradient(ellipse 600px 400px at 100% 100%, rgba(77,163,255,0.16) 0%, transparent 65%)',
  backgroundSize: '28px 28px, auto, auto',
  backgroundRepeat: 'repeat, no-repeat, no-repeat',
} as const
const POPPINS = { fontFamily: 'var(--font-poppins), Poppins, system-ui, sans-serif' } as const
const CLAVE_TOKEN = 'nawar.reto.token'

interface Opcion {
  id: string
  nombre: string
  detalle?: string
  nl?: string
}
interface Opciones {
  vive: Opcion[]
  origenes: Opcion[]
  motivos: Opcion[]
  trabajos: Opcion[]
  niveles: Opcion[]
}
interface Frase {
  nl: string
  es: string
  practica: boolean
  oyes: boolean
}
interface Dia {
  n: number
  nl: string
  titulo: string
  abierto: boolean
  hecho: boolean
  se_abre: string
  intro?: string
  frases?: Frase[]
  ojo?: string
  reto?: string
  extra?: { titulo: string; palabras: string[] }
  presentacion?: { nl: string; es: string }
}
interface Plan {
  nombre: string
  dias: Dia[]
  hechos: number
  toca: number
  frases: number
  llamada: string
  todo_abierto: boolean
  hoy: string
}

const api = () => `${getAPIUrl()}reto`

async function pedir<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; sesion?: string } = {}): Promise<T> {
  const res = await fetch(`${api()}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opciones.sesion ? { Authorization: `Bearer ${opciones.sesion}` } : {}) },
    credentials: 'include',
    cache: 'no-store',
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) throw new Error(datos && typeof datos.detail === 'string' ? datos.detail : 'Algo no ha ido bien. Prueba otra vez.')
  return datos as T
}

/** Dice una frase en neerlandés: la voz de la escuela y, si falla, la del navegador. */
let sonando: HTMLAudioElement | null = null
async function decir(texto: string) {
  try {
    sonando?.pause()
    const res = await fetch(`/api/tts?text=${encodeURIComponent(texto)}`)
    if (!res.ok) throw new Error('sin voz')
    const audio = new Audio(URL.createObjectURL(await res.blob()))
    sonando = audio
    await audio.play()
  } catch {
    try {
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'nl-NL'
      u.rate = 0.9
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch {}
  }
}

function fechaLarga(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`))
  } catch {
    return iso
  }
}

export default function PrimeraSemana() {
  const params = useSearchParams()
  const session = useLHSession() as any
  const sesion: string = session?.data?.tokens?.access_token || ''
  const [token, setToken] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const deLaUrl = params.get('t') || ''
    let guardado = ''
    try {
      guardado = localStorage.getItem(CLAVE_TOKEN) || ''
    } catch {}
    // `?nuevo=1`: empezar otra vez aunque el navegador recuerde un plan (para probarlo).
    const t = params.get('nuevo') ? deLaUrl : deLaUrl || guardado
    setToken(t || null)
    setListo(true)
  }, [params])

  const entrar = useCallback((t: string) => {
    try {
      localStorage.setItem(CLAVE_TOKEN, t)
    } catch {}
    try {
      window.history.replaceState(null, '', `${window.location.pathname}?t=${encodeURIComponent(t)}`)
    } catch {}
    setToken(t)
    window.scrollTo(0, 0)
  }, [])
  const salir = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE_TOKEN)
      window.history.replaceState(null, '', window.location.pathname)
    } catch {}
    setToken(null)
  }, [])

  if (!listo) return <div className="fixed inset-0" style={FONDO} />
  return token ? <MiSemana token={token} sesion={sesion} onCaducado={salir} /> : <Portada utm={params} onListo={entrar} />
}

/* ── Portada y preguntas ─────────────────────────────────────────────── */

const BOTON_CLARO =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] disabled:opacity-50 text-[#0a1656] font-bold text-[15px] px-5 py-3.5 transition-colors'
const CAMPO =
  'w-full bg-[#F0F5FF] rounded-xl px-4 py-3 text-[15px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors'

function Portada({ utm, onListo }: { utm: URLSearchParams; onListo: (token: string) => void }) {
  const [op, setOp] = useState<Opciones | null>(null)
  const [paso, setPaso] = useState(0)
  const [r, setR] = useState({ vive: '', ciudad: '', origen: '', motivo: '', trabajo: '', nivel: '' })
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('+31 ')
  const [trampa, setTrampa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const tarjeta = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pedir<Opciones>('/opciones')
      .then(setOp)
      .catch(() => setError('No se han podido cargar las preguntas. Recarga la página.'))
  }, [])

  const ir = (n: number) => {
    setError('')
    setPaso(n)
    // En el móvil, que la tarjeta quede a la vista al cambiar de pregunta.
    setTimeout(() => tarjeta.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30)
  }
  const elegir = (campo: keyof typeof r, valor: string, siguiente: number) => {
    setR((x) => ({ ...x, [campo]: valor }))
    setTimeout(() => ir(siguiente), 160)
  }

  // Su primera frase, escribiéndose con lo que va contestando.
  const origenNl = op?.origenes.find((o) => o.id === r.origen)?.nl || ''
  const frase = [
    nombre.trim() ? `Hoi, ik ben ${nombre.trim().split(' ')[0]}.` : 'Hoi, ik ben …',
    origenNl ? `Ik kom uit ${origenNl}.` : '',
    r.vive === 'fuera' ? 'Ik ga binnenkort verhuizen.' : r.vive ? `Ik woon in ${r.ciudad.trim() || (r.vive === 'be' ? 'België' : 'Nederland')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      const res = await pedir<{ token: string }>('/empezar', {
        metodo: 'POST',
        cuerpo: {
          nombre,
          email,
          telefono,
          respuestas: r,
          website: trampa,
          referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 120) : '',
          ...Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement'].map((k) => [k, utm.get(k) || ''])),
        },
      })
      if (res.token) onListo(res.token)
      else setError('No se ha podido montar tu semana. Prueba otra vez.')
    } catch (e: any) {
      setError(e?.message || 'Algo no ha ido bien. Prueba otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  const PASOS = 6
  const Opcion = ({ activo, onClick, children, detalle }: { activo: boolean; onClick: () => void; children: React.ReactNode; detalle?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
        activo ? 'border-[#4da3ff] bg-[#EAF4FF]' : 'border-[#DDE6F5] bg-white hover:border-[#4da3ff]'
      }`}
    >
      <span className="block text-[15px] font-semibold text-[#0a1656]">{children}</span>
      {detalle ? <span className="block text-[13px] text-[#4B5878] mt-0.5">{detalle}</span> : null}
    </button>
  )

  return (
    <div className="nawar-auth-shell fixed inset-0 overflow-y-auto overscroll-none text-white" style={FONDO}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12">
        <img src={LOGO_URL} alt="Holandés Nawar" className="h-9 sm:h-10 w-auto" />

        <div className="mt-6 sm:mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-6 lg:gap-14 items-start">
          <div>
            <p className="text-[12px] font-bold tracking-[0.14em] uppercase text-[#4da3ff]">Mijn eerste week · gratis</p>
            <h1 className="mt-3 text-[30px] sm:text-[46px] font-bold leading-[1.1] tracking-[-0.02em]" style={POPPINS}>
              Tu primera semana en neerlandés, <span className="text-[#4da3ff]">hecha a tu medida</span>
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] leading-relaxed text-white/90 max-w-xl">
              Para aprender neerlandés siempre te piden algo antes: una suscripción, un libro, un curso. Aquí no. Siete días, diez minutos al día, con las frases
              de tu vida y tus datos ya puestos.
            </p>
            <div className="hidden lg:block"><Ventajas /></div>
            <p className="mt-4 lg:mt-6 text-[13.5px] text-white/75">Sin tarjeta y sin letra pequeña. Es gratis de verdad.</p>
          </div>

          <div ref={tarjeta} className="rounded-2xl bg-white p-5 sm:p-6 text-[#0a1656]">
            {/* Su frase, en directo */}
            <div className="rounded-xl bg-[#F0F5FF] px-4 py-3">
              <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">Tu primera frase</p>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-[#1D0084]">{frase}</p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              {paso > 0 ? (
                <button type="button" onClick={() => ir(paso - 1)} aria-label="Anterior" className="w-8 h-8 -ml-1.5 rounded-lg flex items-center justify-center text-[#4B5878] hover:bg-[#F0F5FF]">
                  <ArrowLeft size={16} />
                </button>
              ) : null}
              <div className="flex-1 h-1.5 rounded-full bg-[#E6ECF8] overflow-hidden">
                <div className="h-full rounded-full bg-[#4da3ff] transition-all" style={{ width: `${((paso + 1) / PASOS) * 100}%` }} />
              </div>
              <span className="text-[12px] font-semibold text-[#4B5878]">
                {paso + 1} de {PASOS}
              </span>
            </div>

            {!op ? (
              <p className="mt-6 flex items-center gap-2 text-[14px] text-[#4B5878]">
                {error ? error : <><Loader2 size={15} className="animate-spin" /> Cargando…</>}
              </p>
            ) : paso === 0 ? (
              <Pregunta titulo="¿Dónde vives?">
                {op.vive.map((v) => (
                  <Opcion key={v.id} activo={r.vive === v.id} onClick={() => elegir('vive', v.id, 1)}>
                    {v.nombre}
                  </Opcion>
                ))}
              </Pregunta>
            ) : paso === 1 ? (
              <Pregunta titulo="¿De dónde eres?" nota={r.vive !== 'fuera' ? 'Y, si quieres, la ciudad donde vives ahora.' : undefined}>
                <select value={r.origen} onChange={(e) => setR((x) => ({ ...x, origen: e.target.value }))} className={CAMPO}>
                  <option value="">Elige tu país…</option>
                  {op.origenes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
                {r.vive !== 'fuera' ? (
                  <input value={r.ciudad} onChange={(e) => setR((x) => ({ ...x, ciudad: e.target.value }))} placeholder="Tu ciudad: Utrecht, Antwerpen…" maxLength={40} className={CAMPO} />
                ) : null}
                <button type="button" disabled={!r.origen} onClick={() => ir(2)} className={BOTON_CLARO + ' w-full'}>
                  Siguiente <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </Pregunta>
            ) : paso === 2 ? (
              <Pregunta titulo="¿Para qué lo necesitas más?" nota="Elige la que más te pesa hoy.">
                {op.motivos.map((m) => (
                  <Opcion key={m.id} activo={r.motivo === m.id} detalle={m.detalle} onClick={() => elegir('motivo', m.id, 3)}>
                    {m.nombre}
                  </Opcion>
                ))}
              </Pregunta>
            ) : paso === 3 ? (
              <Pregunta titulo="¿A qué te dedicas?">
                <div className="grid grid-cols-2 gap-2">
                  {op.trabajos.map((t) => (
                    <Opcion key={t.id} activo={r.trabajo === t.id} onClick={() => elegir('trabajo', t.id, 4)}>
                      {t.nombre}
                    </Opcion>
                  ))}
                </div>
              </Pregunta>
            ) : paso === 4 ? (
              <Pregunta titulo="¿Cuánto neerlandés sabes?">
                {op.niveles.map((n) => (
                  <Opcion key={n.id} activo={r.nivel === n.id} onClick={() => elegir('nivel', n.id, 5)}>
                    {n.nombre}
                  </Opcion>
                ))}
              </Pregunta>
            ) : (
              <form onSubmit={enviar}>
                <Pregunta titulo="¿A quién se la preparamos?" nota="Te mandamos tu enlace personal para que entres cada día sin contraseña.">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" required maxLength={80} className={CAMPO} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu correo" autoComplete="email" required className={CAMPO} />
                  <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+31 6 12345678" autoComplete="tel" required className={CAMPO} />
                  <input value={trampa} onChange={(e) => setTrampa(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                  {error ? <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13.5px] text-red-700">{error}</p> : null}
                  <button type="submit" disabled={enviando} className={BOTON_CLARO + ' w-full'}>
                    {enviando ? <Loader2 size={16} className="animate-spin" /> : null} Montar mi primera semana <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                  <p className="text-[12px] leading-snug text-[#4B5878]">
                    WhatsApp con el prefijo de tu país. Al continuar aceptas la{' '}
                    <a href="https://www.holandesnawar.com/politica-de-privacidad" target="_blank" rel="noreferrer" className="underline">
                      política de privacidad
                    </a>
                    .
                  </p>
                </Pregunta>
              </form>
            )}
          </div>
        </div>
        <div className="lg:hidden"><Ventajas /></div>
      </div>
    </div>
  )
}

/** Lo que se lleva. En el móvil va debajo de la tarjeta: la primera pregunta tiene que verse sin bajar. */
function Ventajas() {
  return (
    <ul className="mt-6 space-y-3 max-w-xl">
              {[
                ['Tus frases, no las de un libro', 'Tu nombre, tu ciudad, tu trabajo y la situación que más te cuesta.'],
                ['Un día nuevo cada día', 'Frases con audio, una práctica corta y un reto para decirlo en la calle.'],
                ['El día 7 te presentas en neerlandés', 'Entero, de corrido y sin mirar.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 w-5 h-5 shrink-0 rounded-full border-2 border-[#4da3ff] flex items-center justify-center text-[#4da3ff]">
                    <Check size={11} strokeWidth={3.4} />
                  </span>
                  <span>
                    <span className="block text-[15.5px] font-semibold">{t}</span>
                    <span className="block text-[14px] text-white/80">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
  )
}

function Pregunta({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h2 className="text-[20px] font-bold text-[#1D0084] leading-tight" style={POPPINS}>
        {titulo}
      </h2>
      {nota ? <p className="mt-1 text-[13.5px] text-[#4B5878]">{nota}</p> : null}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  )
}

/* ── Sus siete días ──────────────────────────────────────────────────── */

const MODULOS = ['Over jou', 'Familie & vrienden', 'Eten en drinken', 'Het werk', "Hobby's & vrije tijd", 'Thuis & wonen', 'Gezondheid', 'Vervoer & reizen', 'De stad & afspraken', 'Dagelijks leven']

function MiSemana({ token, sesion, onCaducado }: { token: string; sesion: string; onCaducado: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [n, setN] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const arriba = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    pedir<Plan>(`/plan/${encodeURIComponent(token)}`, { sesion })
      .then((p) => {
        if (!vivo) return
        setPlan(p)
        setN((actual) => actual || p.toca)
      })
      .catch((e) => vivo && setError(e?.message || 'No se ha podido abrir tu semana.'))
    return () => {
      vivo = false
    }
  }, [token, sesion])

  const irA = (dia: number) => {
    setN(dia)
    setTimeout(() => arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  async function terminar(dia: number) {
    setGuardando(true)
    try {
      setPlan(await pedir<Plan>(`/plan/${encodeURIComponent(token)}/hecho`, { metodo: 'POST', cuerpo: { dia }, sesion }))
    } catch (e: any) {
      setError(e?.message || 'No se ha podido guardar.')
    } finally {
      setGuardando(false)
    }
  }

  function llamada() {
    if (!plan) return
    pedir(`/plan/${encodeURIComponent(token)}/llamada`, { metodo: 'POST' }).catch(() => {})
    window.open(plan.llamada, '_blank', 'noopener')
  }

  if (error && !plan)
    return (
      <div className="nawar-auth-shell fixed inset-0 overflow-y-auto text-white flex items-center justify-center px-6" style={FONDO}>
        <div className="max-w-sm text-center">
          <p className="text-[16px]">{error}</p>
          <button onClick={onCaducado} className={BOTON_CLARO + ' mt-5'}>
            Volver a empezar
          </button>
        </div>
      </div>
    )
  if (!plan) return <div className="fixed inset-0" style={FONDO} />

  const dia = plan.dias.find((d) => d.n === n) || plan.dias[0]
  const siguienteDia = plan.dias.find((d) => d.n === dia.n + 1)
  const completo = plan.hechos >= plan.dias.length

  return (
    <div className="min-h-screen bg-[#F4F7FD] text-[#0a1656]">
      <header className="text-white" style={FONDO}>
        <div className="mx-auto max-w-3xl px-5 sm:px-6 pt-6 pb-7">
          <div className="flex items-center justify-between">
            <img src={LOGO_URL} alt="Holandés Nawar" className="h-8 w-auto" />
            <span className="text-[12px] font-bold tracking-[0.12em] uppercase text-[#4da3ff]">Mijn eerste week</span>
          </div>
          <h1 className="mt-6 text-[26px] sm:text-[32px] font-bold leading-tight" style={POPPINS}>
            {completo ? `¡Lo has hecho, ${plan.nombre}!` : `Hola, ${plan.nombre}. Esta es tu semana.`}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-white/85">
            {plan.hechos} de {plan.dias.length} días hechos{plan.frases ? ` · ya sabes decir ${plan.frases} frases` : ''}
          </p>
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
            {plan.dias.map((d) => (
              <button
                key={d.n}
                onClick={() => irA(d.n)}
                aria-label={`Día ${d.n}`}
                className={`rounded-xl border py-2 sm:py-2.5 text-center transition-colors ${
                  d.n === dia.n ? 'bg-white text-[#1D0084] border-white' : d.abierto ? 'border-white/35 bg-white/10 hover:bg-white/20' : 'border-white/15 bg-transparent text-white/55'
                }`}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-80">Día</span>
                <span className="block text-[17px] font-bold leading-none mt-0.5">{d.n}</span>
                <span className="mt-1 flex justify-center h-3.5">
                  {d.hecho ? <Check size={14} strokeWidth={3.2} className={d.n === dia.n ? 'text-[#16A34A]' : 'text-[#7CE0A0]'} /> : !d.abierto ? <Lock size={11} /> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main ref={arriba} className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4 scroll-mt-4">
        {plan.todo_abierto ? (
          <p className="rounded-xl border border-[#E4D5A8] bg-[#FFFBF2] px-4 py-2.5 text-[13px] text-[#8A6A2A]">
            Vista de administrador: ves los siete días abiertos. Quien se apunta ve uno nuevo cada día.
          </p>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13.5px] text-red-700">{error}</p> : null}

        {completo ? <Final plan={plan} onLlamada={llamada} /> : null}

        {dia.abierto ? (
          <DiaAbierto key={dia.n} dia={dia} guardando={guardando} onTerminar={() => terminar(dia.n)} siguiente={siguienteDia} onSiguiente={() => siguienteDia && irA(siguienteDia.n)} />
        ) : (
          <section className="rounded-2xl border border-[#DDE6F5] bg-white p-6 text-center">
            <Lock size={22} className="mx-auto text-[#8FA0C2]" />
            <p className="mt-3 text-[12px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">
              Día {dia.n} · {dia.nl}
            </p>
            <h2 className="mt-1 text-[22px] font-bold text-[#1D0084]" style={POPPINS}>
              {dia.titulo}
            </h2>
            <p className="mt-2 text-[15px] text-[#4B5878]">Se abre el {fechaLarga(dia.se_abre)}. Un día cada día: así se queda.</p>
            <button onClick={() => irA(plan.toca)} className="mt-4 text-[14px] font-semibold text-[#025dc7] hover:underline">
              Ir al día que te toca
            </button>
          </section>
        )}

        {!completo ? <Despues onLlamada={llamada} /> : null}

        <p className="pt-2 pb-8 text-center text-[12.5px] text-[#6B7896]">
          ¿Dudas? Escríbenos a info@holandesnawar.com · Guarda esta página: es tu enlace personal.
        </p>
      </main>
    </div>
  )
}

function DiaAbierto({
  dia,
  guardando,
  onTerminar,
  siguiente,
  onSiguiente,
}: {
  dia: Dia
  guardando: boolean
  onTerminar: () => void
  siguiente?: Dia
  onSiguiente: () => void
}) {
  const [practicado, setPracticado] = useState(dia.hecho)
  const frases = dia.frases || []

  return (
    <>
      <section className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-7">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">
          Día {dia.n} · {dia.nl}
        </p>
        <h2 className="mt-1 text-[24px] sm:text-[28px] font-bold text-[#1D0084] leading-tight" style={POPPINS}>
          {dia.titulo}
        </h2>
        <p className="mt-2 text-[15.5px] leading-relaxed text-[#27324F]">{dia.intro}</p>

        {dia.presentacion ? (
          <div className="mt-5 rounded-xl bg-[#1D0084] p-4 sm:p-5 text-white">
            <div className="flex items-start gap-3">
              <button onClick={() => decir(dia.presentacion!.nl)} aria-label="Escuchar" className="mt-0.5 w-10 h-10 shrink-0 rounded-full bg-[#4da3ff] text-[#0a1656] flex items-center justify-center hover:bg-[#5eb4ff]">
                <Volume2 size={18} />
              </button>
              <div>
                <p className="text-[17px] sm:text-[18px] font-semibold leading-relaxed">{dia.presentacion.nl}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-white/80">{dia.presentacion.es}</p>
              </div>
            </div>
          </div>
        ) : null}

        <ul className="mt-5 divide-y divide-[#EEF2F9] border-y border-[#EEF2F9]">
          {frases.map((f) => (
            <li key={f.nl} className="flex items-center gap-3 py-3">
              <button onClick={() => decir(f.nl)} aria-label={`Escuchar: ${f.nl}`} className="w-9 h-9 shrink-0 rounded-full border border-[#CFE0FB] text-[#025dc7] flex items-center justify-center hover:bg-[#F0F5FF]">
                <Volume2 size={16} />
              </button>
              <div className="min-w-0">
                <p className="text-[16.5px] font-semibold text-[#1D0084] leading-snug">{f.nl}</p>
                <p className="text-[14px] text-[#4B5878] leading-snug">{f.es}</p>
              </div>
            </li>
          ))}
        </ul>

        {dia.extra ? (
          <div className="mt-4">
            <p className="text-[12px] font-bold tracking-[0.08em] uppercase text-[#4B5878]">{dia.extra.titulo}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dia.extra.palabras.map((p) => (
                <button key={p} onClick={() => decir(p)} className="rounded-lg border border-[#DDE6F5] bg-[#F7F9FE] px-2.5 py-1.5 text-[14px] font-medium text-[#1D0084] hover:border-[#4da3ff]">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {dia.ojo ? (
          <div className="mt-5 rounded-xl bg-[#F0F5FF] px-4 py-3">
            <p className="text-[11.5px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">Ojo, si hablas español</p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-[#27324F]">{dia.ojo}</p>
          </div>
        ) : null}
      </section>

      <Practica key={`p${dia.n}`} frases={frases.filter((f) => f.practica)} onHecha={() => setPracticado(true)} />

      <section className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-7">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">El reto de hoy, en la calle</p>
        <p className="mt-2 text-[16px] leading-relaxed text-[#27324F]">{dia.reto}</p>
        <div className="mt-5">
          {dia.hecho ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#15803D]">
                <span className="w-5 h-5 rounded-full border-2 border-[#16A34A] flex items-center justify-center">
                  <Check size={11} strokeWidth={3.4} />
                </span>
                Día {dia.n} hecho
              </span>
              {siguiente ? (
                siguiente.abierto ? (
                  <button onClick={onSiguiente} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b2da0] px-4 py-2.5 text-[14.5px] font-bold text-white hover:bg-[#0a2690]">
                    Ir al día {siguiente.n} <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                ) : (
                  <span className="text-[14px] text-[#4B5878]">
                    Mañana se abre el día {siguiente.n}: «{siguiente.titulo}».
                  </span>
                )
              ) : null}
            </div>
          ) : (
            <>
              <button onClick={onTerminar} disabled={guardando || !practicado} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2da0] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#0a2690] disabled:opacity-45">
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />} He terminado el día {dia.n}
              </button>
              {!practicado ? <p className="mt-2 text-[13px] text-[#4B5878]">Primero haz la práctica de arriba: son dos minutos.</p> : null}
            </>
          )}
        </div>
      </section>
    </>
  )
}

/* ── La práctica: qué significa y ordenar la frase ───────────────────── */

type Pregunta =
  | { tipo: 'significa'; frase: Frase; opciones: string[] }
  | { tipo: 'ordenar'; frase: Frase; fichas: string[] }

function montarPractica(frases: Frase[]): Pregunta[] {
  const lista: Pregunta[] = []
  const azar = barajar(frases)
  for (const f of azar.slice(0, 3)) {
    const otras = barajar(frases.filter((x) => x.es !== f.es)).slice(0, 2).map((x) => x.es)
    if (otras.length === 2) lista.push({ tipo: 'significa', frase: f, opciones: barajar([f.es, ...otras]) })
  }
  const largas = azar.filter((f) => {
    const n = f.nl.split(' ').length
    return n >= 3 && n <= 7
  })
  for (const f of largas.slice(0, 2)) {
    const palabras = f.nl.replace(/[.!?]$/, '').split(' ')
    let fichas = barajar(palabras)
    if (fichas.join(' ') === palabras.join(' ')) fichas = [...palabras].reverse()
    lista.push({ tipo: 'ordenar', frase: f, fichas })
  }
  return lista
}

function Practica({ frases, onHecha }: { frases: Frase[]; onHecha: () => void }) {
  const preguntas = useMemo(() => montarPractica(frases), [frases])
  const [i, setI] = useState(0)
  const [elegida, setElegida] = useState<string | null>(null)
  const [puestas, setPuestas] = useState<number[]>([])
  const [comprobada, setComprobada] = useState(false)
  const [aciertos, setAciertos] = useState(0)
  const fin = i >= preguntas.length

  useEffect(() => {
    if (fin) onHecha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin])

  if (!preguntas.length) return null
  const p = preguntas[Math.min(i, preguntas.length - 1)]
  const objetivo = p.frase.nl.replace(/[.!?]$/, '')
  const armada = p.tipo === 'ordenar' ? puestas.map((k) => p.fichas[k]).join(' ') : ''
  const bien = p.tipo === 'significa' ? elegida === p.frase.es : armada === objetivo

  function comprobar() {
    setComprobada(true)
    if (bien) setAciertos((a) => a + 1)
    decir(p.frase.nl)
  }
  function seguir() {
    setI((x) => x + 1)
    setElegida(null)
    setPuestas([])
    setComprobada(false)
  }

  return (
    <section className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">Práctica · 2 minutos</p>
        <p className="text-[12.5px] font-semibold text-[#4B5878]">{fin ? `${aciertos} de ${preguntas.length}` : `${i + 1} de ${preguntas.length}`}</p>
      </div>

      {fin ? (
        <div className="mt-3">
          <p className="text-[17px] font-semibold text-[#1D0084]">{aciertos === preguntas.length ? 'Perfecto. Ni un fallo.' : 'Hecho. Lo que has fallado, vuelve a escucharlo arriba.'}</p>
          <button
            onClick={() => {
              setI(0)
              setAciertos(0)
            }}
            className="mt-2 text-[14px] font-semibold text-[#025dc7] hover:underline"
          >
            Repetir la práctica
          </button>
        </div>
      ) : p.tipo === 'significa' ? (
        <div className="mt-3">
          <p className="text-[14px] text-[#4B5878]">¿Qué significa?</p>
          <button onClick={() => decir(p.frase.nl)} className="mt-1 inline-flex items-center gap-2 text-left text-[19px] font-bold text-[#1D0084]">
            <Volume2 size={18} className="shrink-0 text-[#025dc7]" /> {p.frase.nl}
          </button>
          <div className="mt-3 space-y-2">
            {p.opciones.map((o) => {
              const esBuena = o === p.frase.es
              const color = !comprobada
                ? elegida === o
                  ? 'border-[#4da3ff] bg-[#EAF4FF]'
                  : 'border-[#DDE6F5] hover:border-[#4da3ff]'
                : esBuena
                  ? 'border-[#16A34A] bg-[#F0FAF3]'
                  : elegida === o
                    ? 'border-[#DC2626] bg-[#FEF2F2]'
                    : 'border-[#DDE6F5] opacity-60'
              return (
                <button key={o} disabled={comprobada} onClick={() => setElegida(o)} className={`w-full text-left rounded-xl border px-4 py-3 text-[15px] font-medium text-[#0a1656] transition-colors ${color}`}>
                  {o}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[14px] text-[#4B5878]">Ordena la frase</p>
          <p className="mt-1 text-[17px] font-semibold text-[#27324F]">{p.frase.es}</p>
          <div className={`mt-3 min-h-[52px] rounded-xl border-2 border-dashed px-3 py-2.5 flex flex-wrap gap-1.5 ${comprobada ? (bien ? 'border-[#16A34A] bg-[#F0FAF3]' : 'border-[#DC2626] bg-[#FEF2F2]') : 'border-[#CFE0FB]'}`}>
            {puestas.map((k, pos) => (
              <button key={`${k}-${pos}`} disabled={comprobada} onClick={() => setPuestas((x) => x.filter((_, j) => j !== pos))} className="rounded-lg bg-[#1D0084] px-3 py-1.5 text-[15px] font-semibold text-white">
                {p.fichas[k]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.fichas.map((f, k) =>
              puestas.includes(k) ? null : (
                <button key={k} disabled={comprobada} onClick={() => setPuestas((x) => [...x, k])} className="rounded-lg border border-[#DDE6F5] bg-[#F7F9FE] px-3 py-1.5 text-[15px] font-semibold text-[#1D0084] hover:border-[#4da3ff]">
                  {f}
                </button>
              )
            )}
          </div>
          {comprobada && !bien ? <p className="mt-2 text-[14.5px] text-[#27324F]">Así se dice: <span className="font-semibold text-[#1D0084]">{p.frase.nl}</span></p> : null}
        </div>
      )}

      {!fin ? (
        <div className="mt-4 flex items-center gap-3">
          {comprobada ? (
            <>
              <span className={`text-[14.5px] font-semibold ${bien ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>{bien ? '¡Bien!' : 'Casi.'}</span>
              <button onClick={seguir} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#0b2da0] px-4 py-2.5 text-[14.5px] font-bold text-white hover:bg-[#0a2690]">
                Siguiente <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <button
              onClick={comprobar}
              disabled={p.tipo === 'significa' ? !elegida : puestas.length !== p.fichas.length}
              className="ml-auto rounded-xl bg-[#0b2da0] px-4 py-2.5 text-[14.5px] font-bold text-white hover:bg-[#0a2690] disabled:opacity-45"
            >
              Comprobar
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}

/* ── Lo que viene después ────────────────────────────────────────────── */

function Final({ plan, onLlamada }: { plan: Plan; onLlamada: () => void }) {
  return (
    <section className="rounded-2xl p-6 sm:p-8 text-white" style={FONDO}>
      <p className="text-[12px] font-bold tracking-[0.12em] uppercase text-[#4da3ff]">Semana completada</p>
      <h2 className="mt-2 text-[24px] sm:text-[30px] font-bold leading-tight" style={POPPINS}>
        En siete días has pasado de cero a {plan.frases} frases, {plan.nombre}
      </h2>
      <p className="mt-3 text-[15.5px] leading-relaxed text-white/90 max-w-xl">
        Esto ha sido una semana, por tu cuenta. La formación son dieciséis, con profes que te corrigen, clases en directo para hablar y un camino entero hasta el
        nivel A1. Si quieres saber cómo sería en tu caso, lo vemos en una llamada. Sin compromiso.
      </p>
      <button onClick={onLlamada} className={BOTON_CLARO + ' mt-5'}>
        Reservar mi llamada gratuita <ArrowRight size={15} strokeWidth={2.5} />
      </button>
    </section>
  )
}

function Despues({ onLlamada }: { onLlamada: () => void }) {
  return (
    <section className="rounded-2xl border border-[#DDE6F5] bg-white p-5 sm:p-7">
      <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#025dc7]">Después de esta semana</p>
      <h2 className="mt-1 text-[20px] font-bold text-[#1D0084] leading-tight" style={POPPINS}>
        Esto es la primera semana. La formación son dieciséis.
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#27324F]">
        Lo que estás haciendo aquí es una muestra de cómo se aprende dentro de la escuela. Dentro te esperan diez módulos, una masterclass en directo cada semana,
        grupos de conversación y profes que responden tus dudas.
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {MODULOS.map((m, i) => (
          <div key={m} className="flex items-center gap-2.5 rounded-lg bg-[#F7F9FE] px-3 py-2 text-[14px] text-[#4B5878]">
            <Lock size={13} className="shrink-0 text-[#8FA0C2]" />
            <span className="font-semibold text-[#27324F]">Módulo {i + 1}</span>
            <span className="truncate">{m}</span>
          </div>
        ))}
      </div>
      <button onClick={onLlamada} className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-bold text-[#025dc7] hover:underline">
        Quiero saber cómo sería en mi caso <ArrowRight size={15} strokeWidth={2.5} />
      </button>
    </section>
  )
}
