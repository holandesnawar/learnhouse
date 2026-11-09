'use client'
/**
 * La visita guiada de la escuela (09/11/2026). Los pasos y por qué, en
 * `lib/nawar/visitaGuiada.ts`.
 *
 * - Sale SOLA una vez por alumno, al entrar al Inicio. Se apunta en el
 *   servidor (`student_progress.onboarding_state.visita`), así no vuelve a
 *   salir ni en otro móvil u ordenador. Mirando la escuela como otra persona
 *   («Ver como») no sale sola: ese modo no deja guardar.
 * - «Visita por la escuela» del menú del perfil la vuelve a abrir a
 *   cualquiera (evento `nawar-visita`).
 * - Ordenador: se oscurece la pantalla y se ilumina la parte de la barra de
 *   la que se habla, con la tarjeta al lado. Móvil: la tarjeta abajo y se
 *   ilumina el botón del menú, que es donde está todo.
 * - Esc = saltar; flechas o Intro para moverse.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'
import { nombreVerComo } from '@components/Objects/VerComo/VerComo'
import {
  colocarTarjeta,
  pasosDeLaVisita,
  yaLaVio,
  VERSION_VISITA,
  type ClaseVisita,
} from '@/lib/nawar/visitaGuiada'

const GUARDADA = 'nawar.visita'
const ESPACIO = 6

type Caja = { top: number; left: number; width: number; height: number }

/** Abre la visita desde cualquier sitio (el menú del perfil). */
export function abrirVisita() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nawar-visita'))
}

function esMovil() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

/** La primera de las claves que se vea en pantalla. */
function buscar(claves: string[]): HTMLElement | null {
  for (const k of claves) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-visita="${k}"]`))
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && el.getClientRects().length) return el
    }
  }
  return null
}

function cajaDe(el: HTMLElement | null): Caja | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  // Un bloque largo (muchos canales) no puede salirse de la pantalla.
  const top = Math.max(r.top, 8)
  const bottom = Math.min(r.bottom, window.innerHeight - 8)
  if (bottom <= top) return null
  return { top: top - ESPACIO, left: r.left - ESPACIO, width: r.width + ESPACIO * 2, height: bottom - top + ESPACIO * 2 }
}

export default function VisitaGuiada({
  clases,
  esAlumno,
  enInicio,
}: {
  clases: ClaseVisita[]
  esAlumno: boolean
  enInicio: boolean
}) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token as string | undefined
  const nombre = (session?.data?.user?.first_name || '').trim()

  const [abierta, setAbierta] = useState(false)
  const [paso, setPaso] = useState(0)
  const [nuevo, setNuevo] = useState(false)
  const [caja, setCaja] = useState<Caja | null>(null)
  const [movil, setMovil] = useState(false)
  const [tam, setTam] = useState({ ancho: 340, alto: 230 })
  const tarjeta = useRef<HTMLDivElement>(null)
  const revisada = useRef(false)

  const pasos = useMemo(() => pasosDeLaVisita({ nombre, clases, nuevo }), [nombre, clases, nuevo])
  const actual = pasos[Math.min(paso, pasos.length - 1)]

  // ¿Le toca verla sola? Una vez por carga, solo alumnos y en el Inicio.
  useEffect(() => {
    if (revisada.current || !esAlumno || !enInicio || !token) return
    revisada.current = true
    try {
      if (localStorage.getItem(GUARDADA) === VERSION_VISITA) return
    } catch {}
    if (nombreVerComo()) return
    let vivo = true
    getStudentProgress(token).then((p) => {
      if (!vivo || !p) return
      const estado = p.onboarding_state || {}
      if (yaLaVio(estado)) {
        try {
          localStorage.setItem(GUARDADA, VERSION_VISITA)
        } catch {}
        return
      }
      // Quien ya conocía la escuela vio la bienvenida de antes.
      setNuevo(!estado.welcomed && !estado.dismissed)
      setTimeout(() => {
        if (vivo) {
          setPaso(0)
          setAbierta(true)
        }
      }, 900)
    })
    return () => {
      vivo = false
    }
  }, [esAlumno, enInicio, token])

  // Repetirla desde el perfil.
  useEffect(() => {
    const abrir = () => {
      setPaso(0)
      setAbierta(true)
    }
    window.addEventListener('nawar-visita', abrir)
    return () => window.removeEventListener('nawar-visita', abrir)
  }, [])

  const guardar = useCallback(async () => {
    try {
      localStorage.setItem(GUARDADA, VERSION_VISITA)
    } catch {}
    if (!token || nombreVerComo()) return
    // El servidor REEMPLAZA el objeto: se manda entero.
    const p = await getStudentProgress(token)
    const estado = p?.onboarding_state || {}
    if (yaLaVio(estado)) return
    await patchStudentProgress({ onboarding_state: { ...estado, visita: VERSION_VISITA } }, token)
  }, [token])

  const cerrar = useCallback(() => {
    setAbierta(false)
    guardar()
  }, [guardar])

  const siguiente = useCallback(() => {
    if (paso >= pasos.length - 1) cerrar()
    else setPaso((n) => n + 1)
  }, [paso, pasos.length, cerrar])
  const atras = useCallback(() => setPaso((n) => Math.max(0, n - 1)), [])

  // Medir lo que se ilumina (y volver a medir si cambia la pantalla).
  const medir = useCallback(() => {
    if (!actual) return
    const m = esMovil()
    setMovil(m)
    const el = buscar(m ? actual.movil : actual.objetivo)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' })
    }
    setCaja(cajaDe(el))
  }, [actual])

  useLayoutEffect(() => {
    if (!abierta) return
    medir()
    const t = setTimeout(medir, 250) // por si la barra aún se estaba pintando
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierta, paso, medir])

  useLayoutEffect(() => {
    if (!abierta || !tarjeta.current) return
    const r = tarjeta.current.getBoundingClientRect()
    if (Math.abs(r.width - tam.ancho) > 1 || Math.abs(r.height - tam.alto) > 1) setTam({ ancho: r.width, alto: r.height })
  })

  useEffect(() => {
    if (!abierta) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') siguiente()
      else if (e.key === 'ArrowLeft') atras()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierta, cerrar, siguiente, atras])

  if (!abierta || !actual || typeof document === 'undefined') return null

  const primero = paso === 0
  const ultimo = paso === pasos.length - 1
  const sitio =
    movil && !primero
      ? null
      : colocarTarjeta(caja, { ancho: window.innerWidth, alto: window.innerHeight }, tam)

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 2147483000 }} role="dialog" aria-modal="true" aria-label="Visita por la escuela">
      {/* Para que no se pueda tocar la escuela de detrás. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {caja ? (
        <div
          className="absolute pointer-events-none rounded-xl"
          style={{
            top: caja.top,
            left: caja.left,
            width: caja.width,
            height: caja.height,
            boxShadow: '0 0 0 9999px rgba(10, 22, 86, 0.55)',
            outline: '2px solid rgba(255,255,255,0.95)',
            transition: 'top .3s ease, left .3s ease, width .3s ease, height .3s ease',
          }}
        />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(10, 22, 86, 0.55)' }} />
      )}

      <div
        ref={tarjeta}
        className={`absolute bg-white rounded-2xl border border-[#E2E8F4] p-5 ${
          sitio ? 'w-[min(340px,calc(100vw-32px))]' : 'left-4 right-4'
        }`}
        style={
          sitio
            ? { top: sitio.top, left: sitio.left, transition: 'top .3s ease, left .3s ease', boxShadow: '0 12px 40px rgba(10,22,86,0.22)' }
            : { bottom: 'max(16px, env(safe-area-inset-bottom))', boxShadow: '0 12px 40px rgba(10,22,86,0.22)' }
        }
      >
        <div className="flex items-center gap-1.5 mb-3" aria-hidden>
          {pasos.slice(1).map((p, j) => {
            const i = j + 1
            return (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${i === paso ? 'w-5 bg-[#0b2da0]' : i < paso ? 'w-1.5 bg-[#0b2da0]/45' : 'w-1.5 bg-[#DCE3F1]'}`}
            />
            )
          })}
          <span className="ml-auto text-[12px] font-semibold text-[#6B7393]">
            {primero ? `${pasos.length - 1} pasos` : `${paso} de ${pasos.length - 1}`}
          </span>
        </div>
        <h2 className="font-[Poppins] text-[18px] font-bold leading-snug text-[#0a1656]">{actual.titulo}</h2>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#3B4262]">{actual.texto}</p>
        {movil && !primero && actual.movil[0] === 'menu' ? (
          <p className="mt-2 text-[13px] text-[#6B7393]">Lo tienes en el menú, arriba a la izquierda.</p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          {!ultimo ? (
            <button
              type="button"
              onClick={cerrar}
              className="text-[13.5px] font-semibold text-[#6B7393] hover:text-[#0B1033] px-1 py-2"
            >
              {primero ? 'Ahora no' : 'Saltar'}
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {!primero ? (
              <button
                type="button"
                onClick={atras}
                className="h-10 px-3.5 rounded-lg border border-[#E2E8F4] text-[14px] font-semibold text-[#2B3150] hover:border-[#C9D3E8]"
              >
                Atrás
              </button>
            ) : null}
            <button
              type="button"
              onClick={siguiente}
              autoFocus
              className="h-10 px-4 rounded-lg bg-[#0b2da0] hover:bg-[#0a2690] text-white text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#0b2da0]/40 focus-visible:ring-offset-2"
            >
              {primero ? 'Empezar' : ultimo ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
