'use client'

/**
 * La videollamada del curso, DENTRO de la escuela (27/10/2026). Pide a la API
 * una entrada con el nombre de quien entra y pinta la sala de Daily: sin otra
 * pestaña, sin app y sin escribir el nombre. Ver
 * apps/api/src/services/salas/salas.py.
 *
 * Va con la librería de Daily (`@daily-co/daily-js`, cargada solo aquí) y no
 * con un iframe suelto por dos cosas que solo da la librería: los COLORES de
 * la marca (`TEMA_NAWAR`; sin él, Daily sale en su verde) y saber cuándo se
 * pulsa «Salir» para volver al curso. Si la librería no carga, se pinta el
 * iframe suelto de antes: nadie se queda sin sala por eso.
 *
 * ⚠️ La cámara y el micro dependen también de la cabecera Permissions-Policy
 * de nginx (docker/nginx.conf), que NO puede prohibirlos (`camera=()` los
 * bloqueaba en toda la escuela).
 *
 * 02/11/2026:
 * - **Pantalla completa** ("echo de menos la pantalla completa"): un botón
 *   nuestro, que pone la sala a toda la ventana (también en el iPhone, donde el
 *   navegador no deja poner a pantalla completa un trozo de página) y, si el
 *   navegador deja, la pantalla entera. El contenedor de Daily no se mueve: solo
 *   cambia su caja, así la llamada no se corta. Además, el botón de pantalla
 *   completa de la propia sala de Daily (`showFullscreenButton`), con el permiso
 *   `fullscreen` en su iframe.
 * - **Grabar, sin botones ni avisos** (02/11/2026: "graba de principio a fin
 *   y listo"): se graba siempre, la empieza el primero que entra y nadie ve el
 *   botón de grabar (lo esconde la entrada que da la escuela). Esta pantalla
 *   no dice nada de la grabación; solo si Daily NO deja grabar, el equipo
 *   (anfitrión) ve el motivo, y el alumno nada. Si a los 6 s de entrar nadie ha
 *   empezado a grabar y quien entra es anfitrión, la empieza él
 *   (`startRecording`).
 *
 * 08/11/2026 ("cuando estás en la sala y tocas una pestaña te saca de la clase
 * directo: un aviso, ¿quieres salir?"): mientras se está DENTRO de la llamada,
 * cualquier enlace de la escuela (la barra, «Volver al curso», la campana…)
 * pregunta antes «Vas a salir de la clase». Se escucha el clic en la fase de
 * captura del documento, antes que el `Link` de Next, y solo si el «sí» se
 * navega. Cerrar la pestaña o recargar lo pregunta el navegador
 * (`beforeunload`). «Salir» dentro de la llamada no pregunta: ya se ha elegido.
 *
 * 12/11/2026 ("con una pantalla no sirve… ¿cómo comparte el profe la
 * pizarra?"): el equipo tiene «Pizarra». Se abre la pizarra de la semana AL
 * LADO de la llamada (la llamada pasa a una columna estrecha, sin cortarse:
 * su caja no se mueve en la página, solo cambia de tamaño) y «Enseñar a la
 * clase» pone la pizarra a TODA la pestaña (encima de la llamada, que sigue
 * sonando debajo) y comparte ESTA pestaña en la llamada
 * (`startScreenShare` con `preferCurrentTab`: Chrome pregunta «¿Compartir
 * esta pestaña?»). Los alumnos ven lo que ve el profe, con su zoom.
 * ⚠️ Mandar un lienzo propio a la llamada (`startScreenShare({ mediaStream })`)
 * NO vale aquí: Daily solo lo deja en su modo «call object», no en la sala
 * ya hecha (Prebuilt) que usa la escuela. Comprobado en daily-js 0.93.
 *
 * 12/11/2026, segunda vuelta ("estando ya dentro de la llamada, compartir solo
 * esa parte de la página"): «Enseñar a la clase» ya NO comparte la pestaña.
 * La pizarra entra en la MISMA sala como un segundo participante,
 * «Pizarra · Paul» (un «call object» de Daily aparte, con
 * `allowMultipleCallInstances`, sin cámara ni micro y sin escuchar a nadie),
 * y comparte como pantalla un lienzo en el que la pizarra copia diez veces
 * por segundo SOLO la página que se ve (`lienzo` de PizarraClase). Sin el
 * cuadro de Chrome, también en Safari, y la llamada sigue a la vista al
 * lado. La entrada la da `POST /salas/course/{curso}/pizarra`. Si su pantalla
 * se corta (red), se vuelve a poner sola.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Loader2, Maximize2, Minimize2, PenLine, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { entrarPizarra, entrarSala, getSala, guardarSala, type EntradaSala } from '@services/salas/salas'
import { getSemanas, diaCorto, type Semana } from '@services/tareas/tareas'
import { confirmar } from '@/lib/nawar/confirmar'

// La pizarra solo se carga si el profe la abre (pdf.js pesa).
const PizarraClase = dynamic(() => import('@components/Pages/Pizarra/PizarraClase'), { ssr: false })

// Los colores de la sala, los de la marca: el azul de los botones (#4da3ff
// con letra #0a1656) sobre el azul oscuro (#1D0084). Daily deja cambiar diez.
const TEMA_NAWAR = {
  colors: {
    accent: '#4DA3FF',
    accentText: '#0A1656',
    background: '#0D1452',
    backgroundAccent: '#1A2470',
    baseText: '#FFFFFF',
    border: '#2B3A8F',
    mainAreaBg: '#070B33',
    mainAreaBgAccent: '#1D0084',
    mainAreaText: '#FFFFFF',
    supportiveText: '#B8C4E6',
  },
}

const ALTO = 'h-[calc(100dvh-150px)] min-h-[460px]'

type Grabacion = { estado: 'esperando' | 'grabando' | 'parada' | 'error'; motivo?: string }

export default function SalaPage({ courseUuid }: { courseUuid: string }) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const curso = String(courseUuid || '').replace(/^course_/, '')
  const router = useRouter()
  const contenedor = useRef<HTMLDivElement>(null)
  const [entrada, setEntrada] = useState<EntradaSala | null>(null)
  const [error, setError] = useState('')
  const [sinLibreria, setSinLibreria] = useState(false)
  const [grande, setGrande] = useState(false)
  const [grabacion, setGrabacionEstado] = useState<Grabacion>({ estado: 'esperando' })
  // Lo mismo, para leerlo desde los avisos de Daily sin esperar a pintar.
  const grabacionRef = useRef<Grabacion['estado']>('esperando')
  const setGrabacion = (g: Grabacion) => {
    grabacionRef.current = g.estado
    setGrabacionEstado(g)
  }
  const volver = `/course/${curso}`
  // Dentro de la llamada (entre «joined-meeting» y «left-meeting»).
  const [dentro, setDentro] = useState(false)
  const llamadaRef = useRef<any>(null)

  // ── La pizarra al lado de la llamada (equipo) ────────────────────────────
  const [pizarra, setPizarra] = useState(false)
  const [semanas, setSemanas] = useState<Semana[] | null>(null)
  const [hoy, setHoy] = useState('')
  const [semanaId, setSemanaId] = useState<number | null>(null)
  const [ensenando, setEnsenando] = useState(false)

  async function abrirPizarra() {
    setPizarra(true)
    if (semanas || !token) return
    try {
      const datos = await getSemanas(curso, token)
      const lista = [...(datos.semanas || [])].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      setSemanas(lista)
      setHoy(datos.hoy)
      // La de hoy; si no, la próxima; si no, la de esta semana; si no, la última.
      const deHoy = lista.find((x) => x.fecha === datos.hoy)
      setSemanaId(deHoy?.id ?? datos.proxima ?? datos.actual ?? lista[lista.length - 1]?.id ?? null)
    } catch (e: any) {
      setSemanas([])
      toast.error(e?.message || 'No se pudieron leer las semanas de esta clase')
    }
  }

  // ── «Enseñar a la clase»: la pizarra como otro participante ──────────────
  const lienzoRef = useRef<HTMLCanvasElement | null>(null)
  const ponerLienzo = useCallback((c: HTMLCanvasElement | null) => {
    lienzoRef.current = c
  }, [])
  const emisionRef = useRef<{ cliente: any; stream: MediaStream | null; parando: boolean } | null>(null)

  async function pararEmision() {
    const em = emisionRef.current
    emisionRef.current = null
    setEnsenando(false)
    if (!em) return
    em.parando = true
    try {
      em.stream?.getTracks().forEach((t) => t.stop())
    } catch {
      /* ya parado */
    }
    try {
      await em.cliente?.leave()
    } catch {
      /* ya fuera */
    }
    try {
      em.cliente?.destroy()
    } catch {
      /* ya cerrado */
    }
  }

  async function alternarEmision() {
    if (ensenando || emisionRef.current) return pararEmision()
    if (!llamadaRef.current) {
      toast.error('Entra primero en la llamada')
      return
    }
    const lienzo = lienzoRef.current as any
    if (!lienzo?.captureStream) {
      toast.error('Este navegador no deja enseñar la pizarra. Prueba con Chrome.')
      return
    }
    setEnsenando(true) // la pizarra empieza a copiar la página en el lienzo
    const em: { cliente: any; stream: MediaStream | null; parando: boolean } = { cliente: null, stream: null, parando: false }
    emisionRef.current = em
    const compartir = async () => {
      em.stream?.getTracks().forEach((t) => t.stop())
      em.stream = lienzo.captureStream(10) as MediaStream
      // Es TEXTO, no vídeo en movimiento (12/11/2026: "se ve fatal lo
      // compartido", salía borroso). Sin esto el navegador trata el lienzo
      // como una cámara y, con poco ancho de banda, le BAJA LA RESOLUCIÓN;
      // con la pista marcada como texto mantiene la resolución y baja los
      // fotogramas, que aquí da igual.
      for (const pista of em.stream.getVideoTracks()) {
        try {
          ;(pista as any).contentHint = 'text'
          if ((pista as any).contentHint !== 'text') (pista as any).contentHint = 'detail'
        } catch {
          /* navegador sin contentHint */
        }
      }
      // Una sola capa, al tamaño del lienzo (sin reducir) y con ancho de
      // banda de sobra para que se lea la letra pequeña.
      try {
        await em.cliente.startScreenShare({
          mediaStream: em.stream,
          screenVideoSendSettings: {
            maxQuality: 'low',
            encodings: { low: { maxBitrate: 3000000, maxFramerate: 10, scaleResolutionDownBy: 1 } },
          },
        })
      } catch {
        // Si Daily no acepta esos ajustes, con su preajuste para texto.
        await em.cliente.startScreenShare({ mediaStream: em.stream, screenVideoSendSettings: 'detail-optimized' })
      }
    }
    try {
      const datos = await entrarPizarra(curso, token)
      const { default: DailyIframe } = await import('@daily-co/daily-js')
      if (em.parando) return
      em.cliente = DailyIframe.createCallObject({
        allowMultipleCallInstances: true,
        videoSource: false,
        audioSource: false,
        startVideoOff: true,
        startAudioOff: true,
        subscribeToTracksAutomatically: false,
      } as any)
      // Si Daily corta la pantalla de la pizarra (un corte de red…), se
      // vuelve a poner sola; si la pizarra sale de la llamada, se avisa.
      let reintentos = 0
      em.cliente.on('local-screen-share-stopped', () => {
        if (em.parando || emisionRef.current !== em || reintentos >= 5) return
        reintentos += 1
        window.setTimeout(() => {
          if (!em.parando && emisionRef.current === em) compartir().catch(() => undefined)
        }, 1500)
      })
      em.cliente.on('left-meeting', () => {
        if (em.parando || emisionRef.current !== em) return
        pararEmision()
        toast.error('La pizarra ha salido de la llamada. Pulsa «Enseñar a la clase» otra vez.')
      })
      await Promise.race([
        em.cliente.join({ url: datos.url, token: datos.token }),
        new Promise((_, no) => window.setTimeout(() => no(new Error('la llamada no contesta (20 s)')), 20000)),
      ])
      if (em.parando) return
      await compartir()
    } catch (e: any) {
      if (em.parando) return
      pararEmision()
      toast.error('No se pudo enseñar la pizarra: ' + (e?.message || e?.errorMsg || 'inténtalo otra vez'))
    }
  }
  // Al salir de la sala, la pizarra sale también de la llamada.
  useEffect(
    () => () => {
      const em = emisionRef.current
      emisionRef.current = null
      if (!em) return
      em.parando = true
      try {
        em.stream?.getTracks().forEach((t) => t.stop())
        em.cliente?.destroy()
      } catch {
        /* ya cerrada */
      }
    },
    []
  )

  // Las semanas que se pueden abrir: las de cerca de hoy primero.
  const opcionesSemana = useMemo(() => {
    if (!semanas) return []
    return semanas.slice().reverse()
  }, [semanas])

  // Salir de la página estando en la llamada: se pregunta antes.
  useEffect(() => {
    if (!dentro) return
    let preguntando = false
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      let destino: URL
      try {
        destino = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (destino.origin !== window.location.origin) return
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      if (preguntando) return
      preguntando = true
      confirmar('Vas a salir de la clase.\nSi sales, se corta tu llamada. ¿Quieres salir?', {
        boton: 'Sí, salir de la clase',
        peligro: true,
      }).then((ok) => {
        preguntando = false
        if (ok) {
          setDentro(false)
          router.push(destino.pathname + destino.search + destino.hash)
        }
      })
    }
    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('click', alClic, true)
    window.addEventListener('beforeunload', alCerrar)
    return () => {
      document.removeEventListener('click', alClic, true)
      window.removeEventListener('beforeunload', alCerrar)
    }
  }, [dentro, router])

  // Pantalla completa: la caja de la sala a toda la ventana y, si el
  // navegador deja, la pantalla entera. Esc (o salir del modo del navegador)
  // la devuelve a su sitio.
  async function alternarGrande() {
    const poner = !grande
    setGrande(poner)
    try {
      if (poner && !document.fullscreenElement) await document.documentElement.requestFullscreen?.()
      if (!poner && document.fullscreenElement) await document.exitFullscreen?.()
    } catch {
      /* el iPhone no deja: se queda a toda la ventana */
    }
  }
  useEffect(() => {
    const alCambiar = () => {
      if (!document.fullscreenElement) setGrande(false)
    }
    const conEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGrande(false)
    }
    document.addEventListener('fullscreenchange', alCambiar)
    window.addEventListener('keydown', conEsc)
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar)
      window.removeEventListener('keydown', conEsc)
    }
  }, [])

  // La sala aún apagada (12/11/2026): se espera y se vuelve a probar sola.
  const [esperando, setEsperando] = useState(false)
  // El equipo (profes incluidos) la enciende y la apaga desde aquí mismo.
  const [soyEquipo, setSoyEquipo] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [reintento, setReintento] = useState(0)
  useEffect(() => {
    if (!token || !curso) return
    getSala(curso, token)
      .then((e) => setSoyEquipo(!!e.equipo))
      .catch(() => undefined)
  }, [token, curso])
  async function encender() {
    setCambiando(true)
    try {
      await guardarSala(curso, { activo: true }, token)
      toast.success('Sala encendida. Entrando…')
      setReintento((n) => n + 1)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo encender la sala')
    } finally {
      setCambiando(false)
    }
  }
  async function apagar() {
    const ok = await confirmar(
      'Apagar la sala.\nQuien esté dentro sigue en la llamada hasta que salga, pero nadie más podrá entrar y «Entrar a la clase» dejará de llevar aquí. ¿Apagarla?',
      { boton: 'Sí, apagar la sala', peligro: true }
    )
    if (!ok) return
    setCambiando(true)
    try {
      await guardarSala(curso, { activo: false }, token)
      toast.success('Sala apagada')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo apagar la sala')
    } finally {
      setCambiando(false)
    }
  }
  useEffect(() => {
    if (!token || !curso || entrada) return
    let vivo = true
    let t: number | undefined
    const probar = () =>
      entrarSala(curso, token)
        .then((e) => {
          if (!vivo) return
          setEsperando(false)
          setEntrada(e)
        })
        .catch((e) => {
          if (!vivo) return
          const msg = String(e?.message || '')
          if (/no est[aá] abierta/i.test(msg)) {
            setEsperando(true)
            t = window.setTimeout(probar, 10000)
          } else setError(msg || 'No se pudo entrar a la sala')
        })
    probar()
    return () => {
      vivo = false
      window.clearTimeout(t)
    }
    // Una entrada por visita: pedir otra al cambiar la sesión volvería a
    // montar la sala en mitad de la llamada. `reintento`: al encenderla aquí.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, curso, reintento])

  // La sala de Daily, con la librería y los colores de la marca.
  useEffect(() => {
    if (!entrada || sinLibreria || !contenedor.current) return
    let vivo = true
    let llamada: any = null
    // Volver a grabar, solo el anfitrión y con freno: como mucho 6 veces por
    // visita y 15 s entre una y otra, para no hacer un bucle si Daily la corta
    // nada más empezar.
    let intentos = 0
    let ultimo = 0
    let espera: number | undefined
    const grabarDeNuevo = (ms: number) => {
      if (!entrada.grabar || !entrada.anfitrion) return
      window.clearTimeout(espera)
      espera = window.setTimeout(() => {
        if (!vivo || !llamada) return
        if (grabacionRef.current === 'grabando' || grabacionRef.current === 'error') return
        try {
          if (llamada.meetingState() !== 'joined-meeting') return
        } catch {
          return
        }
        if (intentos >= 6) return
        const pronto = 15000 - (Date.now() - ultimo)
        if (pronto > 0) return grabarDeNuevo(pronto)
        intentos += 1
        ultimo = Date.now()
        try {
          llamada.startRecording()
        } catch {
          /* lo dirá recording-error */
        }
      }, ms)
    }
    ;(async () => {
      try {
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        if (!vivo || !contenedor.current) return
        // Una sola sala a la vez: Daily no deja dos en la misma página.
        if (!emisionRef.current) DailyIframe.getCallInstance()?.destroy()
        llamada = DailyIframe.createFrame(contenedor.current, {
          // La pizarra del profe entra como otra instancia (12/11/2026).
          allowMultipleCallInstances: true,
          iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '16px' },
          showLeaveButton: true,
          showFullscreenButton: true,
          theme: TEMA_NAWAR,
        })
        // El botón de pantalla completa de Daily necesita este permiso en su iframe.
        try {
          const marco = llamada.iframe?.()
          if (marco) {
            const permisos = marco.getAttribute('allow') || ''
            if (!permisos.includes('fullscreen')) marco.setAttribute('allow', `${permisos} fullscreen;`.trim())
            marco.allowFullscreen = true
          }
        } catch {
          /* sin el botón de Daily: queda el nuestro */
        }
        // «Salir» dentro de la llamada = de vuelta al curso. Solo con la sala
        // en pantalla: al irse a otra página por la barra, cerrar la llamada
        // también avisa de «left-meeting», y no hay que mandarle al curso.
        llamadaRef.current = llamada
        llamada.on('joined-meeting', () => vivo && setDentro(true))
        llamada.on('left-meeting', () => {
          if (!vivo) return
          setDentro(false)
          router.push(volver)
        })
        // ¿Se está grabando? (02/11/2026)
        llamada.on('recording-started', () => vivo && setGrabacion({ estado: 'grabando' }))
        llamada.on('recording-stopped', () => {
          if (!vivo) return
          setGrabacion({ estado: 'parada' })
          // Nadie la para a mano (no hay botón): si se ha parado, es que Daily
          // la ha cortado (todos sin cámara ni micro unos minutos, tiempo
          // máximo…). El anfitrión la vuelve a poner. Con un poco de azar para
          // que dos anfitriones no lo intenten a la vez.
          grabarDeNuevo(3000 + Math.random() * 3000)
        })
        llamada.on('recording-error', (ev: any) => {
          const motivo = String(ev?.errorMsg || ev?.error || 'Daily no ha podido grabar')
          // Otra persona ya la había empezado: no es un fallo.
          if (/already|in progress|ya/i.test(motivo)) return
          if (vivo) setGrabacion({ estado: 'error', motivo })
        })
        if (entrada.grabar) {
          // Si a los 6 s nadie la ha empezado, la empieza el anfitrión.
          llamada.on('joined-meeting', () => grabarDeNuevo(6000))
        }
      } catch {
        if (vivo) setSinLibreria(true)
        return
      }
      // Si entrar falla (entrada caducada…), Daily lo enseña dentro de la sala.
      llamada.join({ url: entrada.url, token: entrada.token }).catch(() => {})
    })()
    return () => {
      vivo = false
      window.clearTimeout(espera)
      llamadaRef.current = null
      try {
        llamada?.destroy()
      } catch {
        /* ya cerrada */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, sinLibreria])

  return (
    <div className="w-full px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={volver}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#025dc7] hover:text-[#1D0084]"
        >
          <ArrowLeft size={16} /> Volver al curso
        </Link>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
          {entrada?.curso ? `Sala · ${entrada.curso}` : 'Sala en directo'}
        </h1>
        {entrada?.anfitrion && !error && !sinLibreria ? (
          <button
            onClick={() => {
              if (!pizarra) return abrirPizarra()
              if (ensenando) pararEmision()
              setPizarra(false)
            }}
            className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-semibold ${
              pizarra ? 'border-[#0b2da0] bg-[#0b2da0] text-white' : 'border-[#0b2da0] bg-white text-[#0b2da0] hover:bg-[#F0F5FF]'
            }`}
            title="Abrir la presentación de la semana al lado de la llamada, escribir encima y enseñarla"
          >
            <PenLine size={14} /> {pizarra ? 'Cerrar la pizarra' : 'Pizarra'}
          </button>
        ) : null}
        {entrada && !error && soyEquipo ? (
          <button
            onClick={apagar}
            disabled={cambiando}
            className={`${entrada?.anfitrion && !sinLibreria ? '' : 'ml-auto '}inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#D1D5DB] bg-white text-[13px] font-medium text-gray-800 hover:bg-[#F9FAFB] disabled:opacity-60`}
            title="Al acabar la clase: que nadie más pueda entrar"
          >
            <Power size={14} /> Apagar la sala
          </button>
        ) : null}
        {entrada && !error ? (
          <button
            onClick={alternarGrande}
            className={`${(entrada?.anfitrion && !sinLibreria) || soyEquipo ? '' : 'ml-auto '}inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#D1D5DB] bg-white text-[13px] font-medium text-gray-800 hover:bg-[#F9FAFB]`}
          >
            <Maximize2 size={14} /> Pantalla completa
          </button>
        ) : null}
      </div>

      {/* Solo el equipo ve por qué no se graba; el alumno, nada. */}
      {grabacion.estado === 'error' && entrada?.anfitrion ? (
        <p className="bg-[#FFFBF2] text-[#8A6A2A] rounded-xl px-3 py-2 text-[13px] flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> No se está grabando. Lo que dice Daily: {grabacion.motivo}
        </p>
      ) : null}

      {entrada?.aviso && entrada.anfitrion && (
        <p className="bg-[#FFFBF2] text-[#8A6A2A] rounded-xl px-3 py-2 text-[13px] flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {entrada.aviso}
        </p>
      )}

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[13.5px] flex items-start gap-2 max-w-xl">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {error}
            <br />
            <button onClick={() => window.location.reload()} className="font-semibold underline mr-4">
              Volver a intentarlo
            </button>
            <Link href={volver} className="font-semibold underline">
              Volver al curso
            </Link>
          </span>
        </div>
      ) : !entrada && esperando ? (
        <div className="max-w-xl rounded-2xl border border-[#DDE6F5] bg-white px-5 py-6">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-[#0a1656]">
            <Loader2 size={18} className="animate-spin text-[#0b2da0]" /> La clase aún no ha comenzado
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#171a2e]">
            Empieza en cuanto el profe abra la sala. No hace falta recargar: quédate en esta página y entrarás sola o solo.
          </p>
          {soyEquipo ? (
            <button
              onClick={encender}
              disabled={cambiando}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0b2da0] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {cambiando ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />} Encender la sala y entrar
            </button>
          ) : null}
        </div>
      ) : !entrada ? (
        <div className="flex items-center gap-2 text-[14px] text-[#5A6480] py-10">
          <Loader2 size={18} className="animate-spin" /> Preparando la sala…
        </div>
      ) : (
        <>
          {/* Pantalla completa: la misma caja, a toda la ventana (la llamada no se corta). */}
          <div
            className={
              (grande ? 'fixed inset-0 z-[100] bg-[#070B33] ' : 'relative ') +
              (pizarra ? `grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] ${grande ? 'p-3 pt-14 lg:grid-rows-1' : ''}` : '')
            }
          >
            {pizarra ? (
              <div
                className={`min-w-0 overflow-hidden rounded-2xl border bg-white ${ensenando ? 'border-[#B4413C] ring-2 ring-[#B4413C]/30' : 'border-[#DDE6F5]'} ${grande ? 'h-[60vh] lg:h-full' : ALTO}`}
              >
                {semanas === null ? (
                  <div className="flex h-full items-center justify-center gap-2 text-[14px] text-[#5A6480]">
                    <Loader2 size={18} className="animate-spin" /> Buscando la semana…
                  </div>
                ) : !semanaId ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-[15px] font-semibold text-[#0a1656]">Esta clase aún no tiene semanas</p>
                    <p className="text-[13.5px] text-[#5A6480]">Crea la semana de hoy (con su presentación en PDF) desde la página de la clase y vuelve a abrir la pizarra.</p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    {ensenando ? (
                      <div className="flex shrink-0 items-center gap-2 border-b border-[#F3D3D1] bg-[#FDF3F2] px-3 py-1.5 text-[12.5px] font-semibold text-[#9B2C26]">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#B4413C]" /> Los alumnos ven esta página en la llamada
                      </div>
                    ) : opcionesSemana.length > 1 ? (
                      <div className="flex shrink-0 items-center gap-2 border-b border-[#E2E8F4] bg-[#F7F9FD] px-3 py-1.5 text-[12.5px] text-[#5A6480]">
                        Semana:
                        <select
                          value={semanaId}
                          onChange={(e) => {
                            if (ensenando) pararEmision()
                            setSemanaId(Number(e.target.value))
                          }}
                          className="rounded-md border border-[#D5DEEE] bg-white px-2 py-1 text-[12.5px] text-[#0a1656]"
                        >
                          {opcionesSemana.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.tema || 'Semana'} · {diaCorto(x.fecha)}
                              {x.fecha === hoy ? ' (hoy)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="min-h-0 flex-1">
                      <PizarraClase
                        key={semanaId}
                        semanaId={String(semanaId)}
                        enSala={{
                          ensenando,
                          // En local no hay Daily: las pruebas fingen estar dentro.
                          puede: dentro || (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && !!(window as any).__salaDentro),
                          alternar: alternarEmision,
                          lienzo: ponerLienzo,
                          cerrar: () => {
                            if (ensenando) pararEmision()
                            setPizarra(false)
                          },
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {sinLibreria ? (
              <iframe
                onLoad={() => setDentro(true)}
                title="Sala en directo"
                src={`${entrada.url}?t=${encodeURIComponent(entrada.token)}`}
                allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                className={`w-full bg-[#070B33] ${grande ? 'h-full' : `rounded-2xl border border-[#DDE6F5] ${ALTO}`}`}
              />
            ) : (
              <div
                ref={contenedor}
                className={`w-full overflow-hidden bg-[#070B33] ${grande ? (pizarra ? 'h-[40vh] rounded-2xl lg:h-full' : 'h-full') : `rounded-2xl ${pizarra ? 'h-[360px] lg:h-[calc(100dvh-150px)] lg:min-h-[460px]' : ALTO}`}`}
              />
            )}
            {grande ? (
              <button
                onClick={alternarGrande}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white/90 text-[13px] font-semibold text-[#0a1656] hover:bg-white"
              >
                <Minimize2 size={14} /> Salir de pantalla completa
              </button>
            ) : null}
          </div>
          <p className="text-[12px] text-[#5A6480]">
            Entras como <strong className="text-gray-900">{entrada.nombre}</strong>
            {entrada.anfitrion ? ' (anfitrión: puedes silenciar y compartir pantalla)' : ''}. Si el navegador te
            pregunta por la cámara y el micrófono, dale a «Permitir».
          </p>
        </>
      )}
    </div>
  )
}
