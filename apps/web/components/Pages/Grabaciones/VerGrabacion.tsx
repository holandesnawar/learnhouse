'use client'
/**
 * La grabación de una clase en directo, en su propia página (23/11/2026).
 *
 * Antes, una grabación subida como clase de vídeo se abría «como un curso»
 * (barra de capítulos, «46 % completado», «Anterior / Siguiente») y la que
 * grabó la sala, en una ventana. Ahora todas se abren igual: arriba la clase
 * (para volver), el TEMA, el día y quién la dio; el vídeo; y abajo la
 * grabación anterior y la siguiente de ESA clase, con su tema y su día.
 *
 * Cuenta como vista igual que antes:
 * - la de la sala, al pasar de la mitad (lo apunta `marcarVista`);
 * - un enlace o un reproductor de fuera (Bunny, YouTube, Vimeo), tras minuto
 *   y medio con la pestaña a la vista (no se sabe por dónde va el vídeo);
 * - un vídeo subido a la escuela, al llegar al 85 %.
 * Las clases de vídeo se apuntan en el recorrido del curso, como hacía su
 * pantalla de antes (así el Seguimiento sigue contando «vio la grabación»).
 */
import React, { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Cargando, Esqueleto } from '@components/Objects/Esqueleto'
import { claveSemanas } from '@components/Pages/Courses/SemanasClase'
import { getSemanas } from '@services/tareas/tareas'
import { marcarVista } from '@services/grabaciones/grabaciones'
import { markActivityAsComplete } from '@services/courses/activity'
import { getActivityMediaDirectory } from '@services/media/media'
import { queryKeys } from '@/lib/query/keys'
import { ajustesDirecto, conGrabadas, nombreDeClase } from '@/lib/nawar/cursos'
import { textosDeClase } from '@/lib/nawar/palabraClase'
import { tituloDeClase } from '@/lib/nawar/salaProfes'
import { diaDeSesion } from '@/lib/nawar/sesionDeLaSala'
import { grabacionDe, grabacionesDe, rutaGrabacion, vecinasDe, type GrabacionDeClase } from '@/lib/nawar/verGrabacion'
import ReproductorRecortado from './ReproductorRecortado'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const sinPrefijo = (uuid: string) => String(uuid || '').replace(/^course_/, '')
/** Segundos con la pestaña a la vista para dar por vista una grabación de un reproductor de fuera. */
const SEGUNDOS_PARA_VISTA = 90

function Aviso({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-[17px] font-semibold text-[#0B1033]" style={POPPINS}>
        {titulo}
      </p>
      {texto ? <p className="mt-2 text-[14px] leading-relaxed text-[#4A5272]">{texto}</p> : null}
      {children}
    </div>
  )
}

/** Un lado del pie: «← Grabación anterior · Mijn huis · miércoles 11 nov». */
function Vecina({ g, lado, href, palabra }: { g: GrabacionDeClase | null; lado: 'anterior' | 'siguiente'; href: string; palabra: (t: string) => string }) {
  if (!g) return <span className="hidden sm:block" />
  const derecha = lado === 'siguiente'
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group flex min-w-0 items-center gap-3 rounded-xl border border-[#E2E7F0] bg-white px-4 py-3 transition-colors hover:border-[#0b2da0] ${derecha ? 'justify-end text-right sm:col-start-2' : ''}`}
    >
      {derecha ? null : <ArrowLeft size={17} className="shrink-0 text-[#6B7393] group-hover:text-[#0b2da0]" />}
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-[#6B7393]">{derecha ? 'Grabación siguiente' : 'Grabación anterior'}</span>
        <span className="block truncate text-[14.5px] font-semibold text-[#0B1033]">{palabra(tituloDeClase(g.tema, g.fecha))}</span>
        <span className="block text-[12.5px] text-[#6B7393] first-letter:uppercase">{[diaDeSesion(g.fecha), g.profe ? `con ${g.profe}` : ''].filter(Boolean).join(' · ')}</span>
      </span>
      {derecha ? <ArrowRight size={17} className="shrink-0 text-[#6B7393] group-hover:text-[#0b2da0]" /> : null}
    </Link>
  )
}

export default function VerGrabacion({ courseuuid, clave }: { courseuuid: string; clave: string }) {
  const courseUuid = sinPrefijo(courseuuid)
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const orgslug: string = org?.slug || ''
  const queryClient = useQueryClient()
  const ruta = (p: string) => getUriWithOrg(orgslug, p)

  // Las semanas de la clase: las mismas que su página (misma caché).
  const semanas = useQuery({
    queryKey: claveSemanas(courseUuid),
    queryFn: () => getSemanas(courseUuid, token),
    enabled: !!token && !!courseUuid,
    staleTime: 30_000,
    retry: 1,
  })
  const config = org?.config?.config
  const equipo = !!(semanas.data?.equipo || semanas.data?.admin)
  const hoy = semanas.data?.hoy || ''
  const curso = semanas.data?.curso || ''
  const nombreCurso = curso ? nombreDeClase({ name: curso, course_uuid: courseUuid } as any) : ''
  const t = useMemo(() => textosDeClase(curso), [curso])
  const lista = useMemo(() => grabacionesDe(semanas.data, conGrabadas(config, courseUuid)), [semanas.data, config, courseUuid])
  const g = useMemo(() => grabacionDe(lista, clave), [lista, clave])
  const { anterior, siguiente } = useMemo(() => vecinasDe(lista, clave), [lista, clave])

  // ── Cuenta como vista ───────────────────────────────────────────────────
  const apuntada = useRef('')
  function vista() {
    if (!g || !token || g.vista || apuntada.current === g.clave) return
    apuntada.current = g.clave
    const recargar = () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
    }
    // En blando: si no se puede apuntar (p. ej. mirando «como un alumno»), el vídeo sigue.
    if (g.de === 'clase') {
      // El equipo no se apunta clases del curso por mirar una grabación.
      if (equipo || !g.actividad) return
      markActivityAsComplete(orgslug, courseUuid, g.actividad, token)
        .then(recargar)
        .catch(() => {
          apuntada.current = ''
        })
    } else if (g.semanaId) {
      marcarVista(g.semanaId, token)
        .then((r) => (r?.vista ? recargar() : undefined))
        .catch(() => undefined)
    }
  }
  // Un reproductor de fuera no dice por dónde va: minuto y medio a la vista.
  const deFuera = !!g && (g.de === 'enlace' || (g.de === 'clase' && g.video?.tipo !== 'archivo'))
  useEffect(() => {
    if (!g || !deFuera || g.vista) return
    let segundos = 0
    const reloj = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      segundos += 1
      if (segundos >= SEGUNDOS_PARA_VISTA) {
        clearInterval(reloj)
        vista()
      }
    }, 1000)
    return () => clearInterval(reloj)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.clave, deFuera, g?.vista, token, equipo])

  // ── Pantalla ────────────────────────────────────────────────────────────
  const volver = ruta(`/course/${courseUuid}`)
  const cargando = !semanas.data && !semanas.isError
  const profe = (g?.profe || ajustesDirecto(config, courseUuid).banner?.teacher || '').trim()
  const titulo = g ? t(tituloDeClase(g.tema, g.fecha)) : ''
  const cuando = g ? [diaDeSesion(g.fecha, hoy), profe ? `con ${profe}` : ''].filter(Boolean).join(' · ') : ''
  const marco = 'relative w-full overflow-hidden rounded-xl bg-black'

  let video: React.ReactNode = null
  if (g) {
    const enlace = g.de === 'enlace' ? g.sala?.enlace?.url : g.de === 'clase' && g.video?.tipo !== 'archivo' ? g.video?.url : ''
    if (g.de === 'sala' && g.sala?.partes?.length) {
      video = <ReproductorRecortado key={g.clave} courseUuid={courseUuid} partes={g.sala.partes} clave={g.clave} autoPlay={false} onMitad={vista} />
    } else if (enlace) {
      video = (
        <div className={marco} style={{ paddingTop: '56.25%' }}>
          <iframe
            key={g.clave}
            src={enlace}
            title={titulo || t('La clase grabada')}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )
    } else if (g.de === 'clase' && g.video?.tipo === 'archivo' && g.video.archivo && g.actividad && org?.org_uuid) {
      video = (
        <div className={marco} style={{ paddingTop: '56.25%' }}>
          <video
            key={g.clave}
            src={getActivityMediaDirectory(org.org_uuid, `course_${courseUuid}`, g.actividad, g.video.archivo, 'video')}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration > 0 && v.currentTime / v.duration >= 0.85) vista()
            }}
            onEnded={vista}
          />
        </div>
      )
    }
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#F4F6FB]">
      <div className="border-b border-[#E6EAF2] bg-white">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link href={volver} prefetch={false} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#0b2da0] hover:underline">
            <ArrowLeft size={15} /> {nombreCurso || t('La clase')}
          </Link>
          <div className="min-w-0">
            {cargando ? (
              <Cargando className="space-y-2">
                <Esqueleto ancho={220} alto={24} />
                <Esqueleto ancho={160} alto={12} />
              </Cargando>
            ) : (
              <>
                <h1 className="break-words text-[23px] font-bold leading-tight text-[#0B1033] sm:text-[27px]" style={POPPINS}>
                  {titulo || t('Grabación de la clase')}
                </h1>
                {cuando ? <p className="mt-1 text-[13.5px] text-[#6B7393] first-letter:uppercase">{cuando}</p> : null}
                {g ? <p className="mt-1 text-[12.5px] text-[#6B7393]">{t('La grabación de la clase, por si no pudiste venir o quieres repasar.')}</p> : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[960px] px-3 py-5 sm:px-6 sm:py-8">
        {cargando ? (
          <p className="animate-pulse py-24 text-center text-[14px] text-[#6B7393]">Abriendo la grabación…</p>
        ) : semanas.isError ? (
          <Aviso titulo="No se puede abrir esta grabación" texto={(semanas.error as any)?.message || 'Puede que no sea de una de tus clases.'}>
            <Link href={ruta('/')} className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white hover:bg-[#0a2690]">
              Ir al inicio
            </Link>
          </Aviso>
        ) : !g || !video ? (
          <Aviso titulo={t('Esta grabación no está aquí')} texto={t('Puede que aún no esté publicada o que se haya quitado. Las que hay están en la página de la clase.')}>
            <Link href={volver} className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white hover:bg-[#0a2690]">
              {t('Volver a la clase')}
            </Link>
          </Aviso>
        ) : (
          video
        )}

        {anterior || siguiente ? (
          <nav aria-label={t('Otras grabaciones de la clase')} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Vecina g={anterior} lado="anterior" href={anterior ? ruta(rutaGrabacion(courseUuid, anterior.clave)) : '#'} palabra={t} />
            <Vecina g={siguiente} lado="siguiente" href={siguiente ? ruta(rutaGrabacion(courseUuid, siguiente.clave)) : '#'} palabra={t} />
          </nav>
        ) : null}
      </div>
    </div>
  )
}
