'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { getUriWithOrg } from '@services/config/config'
import { Check, CalendarDays, User, MessagesSquare, BookOpen, ArrowRight, Rocket } from 'lucide-react'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'
import { getCommunities } from '@services/communities/communities'
import { getDiscussions } from '@services/communities/discussions'

interface StepItem {
  id: string
  title: string
  cta: string
  href: string
  icon: React.ReactNode
  isDone: boolean
}

// Pasos que se marcan al hacer clic (visitar). El de comunidad NO está aquí:
// se marca solo cuando el alumno publica de verdad en el canal de presentaciones.
const VISITABLE: string[] = ['clase_en_vivo', 'profile']
// Plegado/desplegado es una preferencia de este ordenador: puede vivir en el
// navegador. Lo demás (bienvenida vista, panel descartado) va al SERVIDOR: si
// no, el alumno que entra desde el móvil vuelve a ver el popup de bienvenida y
// el que borra cookies lo ve otra vez. Era parte del "sale a veces sí y a veces

// El primer paso llevaba a un "vídeo de bienvenida" que NO EXISTE: prometía
// algo que el alumno iba a buscar y no iba a encontrar, justo el primer día.
// Se cambia por la clase en vivo, que sí existe, es semanal y es lo que de
// verdad diferencia a esta escuela de un curso grabado.
const CLASE_EN_VIVO_PATH = '/calendario'

// El canal «Presentaciones» de la comunidad.
//
// Va directo al canal y no al listado: mandar al listado obliga al alumno a
// buscarlo, y este paso se hace UNA vez en la vida — cada clic de más se paga
// en gente que no llega. Mismo criterio que el botón de Victorias.
// Si algún día se borra ese canal, aquí va el identificador del nuevo (sale de
// la barra del navegador al abrirlo).
const CANAL_PRESENTACIONES = 'dfb8999d-42a9-4b36-92b4-ff924b1a0f91'

// Widget flotante "Primeros pasos" para el alumno (abajo-derecha, plegable).
// Sustituye a la tarjeta grande del Inicio: aparece al entrar, se puede minimizar
// a una pastilla y desaparece solo cuando se completan todos los pasos.
/**
 * Dos formas de enseñar lo mismo, con una sola lógica detrás.
 *
 * `panel` es la lista fija del Inicio: vive en el flujo de la página, no tapa
 * nada y se va tachando sola. Es donde el alumno lee los pasos.
 *
 * `aviso` es la pastilla pequeña que sale en el resto de páginas y solo sirve
 * para recordar que la lista existe y llevar hasta ella. No repite los pasos:
 * si los repitiera habría dos sitios diciendo lo mismo y uno de los dos se
 * quedaría desactualizado.
 *
 * Antes esto era un panel flotante con los pasos dentro, y en el móvil tapaba
 * el final de la página justo al alumno que acaba de entrar, que es el que más
 * necesita verla entera.
 */
export default function StudentOnboarding({
  orgslug,
  modo = 'aviso',
}: {
  orgslug: string
  modo?: 'panel' | 'aviso'
}) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const pathname = usePathname() || ''
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const user = session?.data?.user
  const hasAvatar = !!user?.avatar_image
  const hasBio = !!(user?.bio && String(user.bio).trim())

  const { data: trailData, isFetched: trailFetched, refetch: refetchTrail } = useTrail(org?.id)
  const hasStartedCourse = (trailData?.runs?.length || 0) > 0
  const currentUserId = user?.id

  const [loaded, setLoaded] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  // Copia del estado guardado en el servidor: al escribir hay que mandarlo
  // entero (el backend reemplaza el objeto, no lo mezcla).
  const [serverState, setServerState] = useState<Record<string, any>>({})
  const [dismissed, setDismissed] = useState(false)
  const [presented, setPresented] = useState(false)
  const [communityChecked, setCommunityChecked] = useState(false)
  const [forceReady, setForceReady] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // Antes había aquí un detector de "popups abiertos" que escondía el widget en
  // cuanto encontraba CUALQUIER elemento a pantalla completa en la página. Como
  // eso lo cumplen muchas cosas (cajones, fondos decorativos), el panel salía
  // unas veces sí y otras no, sin patrón. Fuera: los modales de verdad se
  // pintan muy por encima (z-index de modal) y ya tapan el widget solos.

  // Detecta si el alumno YA ha publicado en el canal de presentaciones (de verdad,
  // no solo al hacer clic). Marca el paso "Preséntate en Comunidad". Se re-comprueba
  // al navegar (pathname) para que el check aparezca al volver de publicar.
  useEffect(() => {
    if (!accessToken || !org?.id || !currentUserId) return
    if (presented) {
      setCommunityChecked(true)
      return
    }
    let active = true
    ;(async () => {
      try {
        const comms: any[] = await getCommunities(org.id, 1, 100, null, accessToken)
        if (!active || !Array.isArray(comms) || comms.length === 0) return
        const target = comms.find((c) => /present/i.test(c?.name || '')) || comms[0]
        const discussions: any[] = await getDiscussions(target.community_uuid, 'recent', 1, 100, null, accessToken)
        if (!active) return
        setPresented(Array.isArray(discussions) && discussions.some((d) => d?.author?.id === currentUserId))
      } catch {
        /* ignore */
      } finally {
        if (active) setCommunityChecked(true)
      }
    })()
    return () => {
      active = false
    }
  }, [accessToken, org?.id, currentUserId, presented, pathname])

  // El check "primera lección" también se refresca al navegar (el trail se
  // cachea; sin esto no se marcaba hasta recargar la página entera).
  useEffect(() => {
    if (trailFetched && !hasStartedCourse) refetchTrail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Red de seguridad: si alguna señal tarda demasiado (API lenta), mostramos
  // el widget igualmente pasados unos segundos con lo que haya.
  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setLoaded(true)
      return
    }
    let active = true
    getStudentProgress(accessToken)
      .then((p) => {
        if (!active) return
        const state = (p?.onboarding_state ?? {}) as Record<string, any>
        setServerState(state)
        setVisited(new Set(Array.isArray(state.visited) ? state.visited : []))
        setDismissed(state.dismissed === true)
        // La bienvenida se enseña UNA vez por alumno, no una vez por navegador.
        setShowWelcome(state.welcomed !== true)
        setLoaded(true)
      })
      .catch(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [accessToken])

  const steps: StepItem[] = [
    {
      id: 'clase_en_vivo',
      title: 'Mira cuándo es tu clase en vivo',
      cta: 'Ver',
      href: getUriWithOrg(orgslug, CLASE_EN_VIVO_PATH),
      icon: <CalendarDays size={19} />,
      isDone: visited.has('clase_en_vivo'),
    },
    {
      id: 'profile',
      title: 'Completa tu perfil',
      cta: 'Ir',
      href: getUriWithOrg(orgslug, '/account/general'),
      icon: <User size={19} />,
      isDone: hasAvatar || hasBio || visited.has('profile'),
    },
    {
      id: 'community',
      title: 'Preséntate en Comunidad',
      cta: 'Entrar',
      href: getUriWithOrg(orgslug, `/community/${CANAL_PRESENTACIONES}`),
      icon: <MessagesSquare size={19} />,
      isDone: presented,
    },
    {
      id: 'first_lesson',
      title: 'Haz tu primera lección',
      cta: 'Empezar',
      href: getUriWithOrg(orgslug, '/courses'),
      icon: <BookOpen size={19} />,
      isDone: hasStartedCourse,
    },
  ]

  const done = steps.filter((s) => s.isDone).length
  const total = steps.length
  const allDone = done === total
  const pct = Math.round((done / total) * 100)

  // No mostrar: sin cargar, todo hecho, sin sesión, o dentro de una lección (modo enfoque).
  // Páginas "de enfoque" donde el widget estorba: dentro de una lección, en la
  // configuración de la cuenta/perfil y en consultas (su barra/modal inferior).
  const isFocusPage =
    (pathname.includes('/course/') && pathname.includes('/activity/')) ||
    pathname.includes('/account') ||
    pathname.includes('consulta')

  // CLAVE anti-parpadeo: no pintamos NADA hasta que todas las señales de los
  // pasos (progreso, trail, comunidad) estén resueltas. Antes, el popup de
  // bienvenida salía al instante y desaparecía ~1s después cuando llegaban los
  // datos y resultaba que ya estaba todo hecho — en cada carga de página.
  const signalsReady = loaded && (forceReady || (trailFetched && communityChecked))
  if (!signalsReady || allDone || dismissed || !accessToken) return null
  // El aviso flotante sí se calla en las páginas de enfoque; el panel no,
  // porque solo se monta en el Inicio.
  if (modo === 'aviso' && isFocusPage) return null

  /** El backend REEMPLAZA onboarding_state, así que se manda entero. */
  function saveState(patch: Record<string, any>) {
    if (!accessToken) return
    const next = { ...serverState, visited: Array.from(visited), ...patch }
    setServerState(next)
    patchStudentProgress({ onboarding_state: next }, accessToken)
  }

  function markVisited(id: string) {
    if (!VISITABLE.includes(id) || !accessToken) return
    const next = new Set(visited)
    next.add(id)
    setVisited(next)
    saveState({ visited: Array.from(next) })
  }

  // Lista de pasos (reutilizada en el panel y en el popup de bienvenida).
  const stepsList = (
    <ol className="divide-y divide-[#F0F5FF]">
      {steps.map((s) => (
        <li key={s.id} className="px-3.5 py-2.5 flex items-center gap-3">
          <div
            className={`w-8 h-8 flex items-center justify-center shrink-0 ${
              s.isDone ? 'text-emerald-500' : 'text-[#025dc7]'
            }`}
          >
            {s.isDone ? <Check size={20} strokeWidth={3} /> : s.icon}
          </div>
          <span
            className={`flex-1 min-w-0 text-[13px] leading-snug ${
              s.isDone ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'
            }`}
          >
            {s.title}
          </span>
          {!s.isDone && (
            <Link
              href={s.href}
              onClick={() => markVisited(s.id)}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-semibold text-[12px] transition-colors"
            >
              {s.cta}
              <ArrowRight size={13} />
            </Link>
          )}
        </li>
      ))}
    </ol>
  )

  function dismissWelcome() {
    setShowWelcome(false)
    saveState({ welcomed: true })
  }

  /** "No volver a mostrar": decisión del alumno, guardada en su cuenta. */
  function dismissForGood() {
    setDismissed(true)
    saveState({ welcomed: true, dismissed: true })
  }

  // Popup de bienvenida — solo la primera vez (tamaño grande, centrado).
  const welcomeModal =
    showWelcome && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-onboarding
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
            onClick={dismissWelcome}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 mx-auto mb-2 flex items-center justify-center">
                  <Rocket size={40} className="text-[#025dc7]" />
                </div>
                <h2
                  className="text-[22px] font-bold text-gray-900"
                  style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
                >
                  ¡Te damos la bienvenida!
                </h2>
                <p className="text-[14px] text-gray-500 mt-1">
                  Completa estos primeros pasos para sacarle el máximo a tu formación.
                </p>
              </div>
              <div className="border-t border-[#DDE6F5]">{stepsList}</div>
              <div className="px-6 py-4">
                <button
                  onClick={dismissWelcome}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold text-[15px] transition-colors"
                >
                  ¡Vamos allá!
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  // ── El panel del Inicio ──
  if (modo === 'panel') {
    return (
      <div id="empieza-aqui" className="mb-8 bg-white rounded-2xl border border-[#DDE6F5] nice-shadow overflow-hidden scroll-mt-24">
        <div
          className="px-5 py-5 text-white relative"
          style={{
            backgroundColor: '#1D0084',
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
              'radial-gradient(circle 400px at 100% 0%, rgba(11,109,240,0.4) 0%, transparent 65%)',
            backgroundSize: '28px 28px, auto',
            backgroundRepeat: 'repeat, no-repeat',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="text-lg font-bold leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                Empieza aquí
              </h2>
              <p className="text-sm text-white/70 mt-0.5">
                {done} de {total} hechos
              </p>
            </div>
            <button
              onClick={dismissForGood}
              className="shrink-0 text-[11.5px] text-white/50 hover:text-white/90 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
              title="No volver a mostrar estos pasos"
            >
              Ocultar
            </button>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#4da3ff] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {stepsList}
      </div>
    )
  }

  // ── El aviso: solo señala que la lista existe ──
  //
  // En el Inicio no sale: ahí está el panel, y dos cosas diciendo lo mismo en
  // la misma pantalla sobran.
  const esInicio = pathname === '/' || /\/orgs\/[^/]+\/?$/.test(pathname)
  if (esInicio) return <>{welcomeModal}</>

  return (
    <>
      {welcomeModal}
      <Link
        href={getUriWithOrg(orgslug, '/#empieza-aqui')}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 bg-white rounded-2xl nice-shadow border border-[#DDE6F5] pl-3 pr-3.5 py-2.5 hover:shadow-lg transition-shadow"
      >
        <Rocket size={18} className="text-[#025dc7] shrink-0" />
        <span className="text-[13px] font-bold text-gray-900 leading-none">
          Te faltan {total - done} {total - done === 1 ? 'paso' : 'pasos'}
        </span>
        <ArrowRight size={15} className="text-[#025dc7] shrink-0" />
      </Link>
    </>
  )
}
