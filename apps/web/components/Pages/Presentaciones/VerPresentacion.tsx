'use client'
/**
 * La presentación de una clase en directo, en su propia página (22/11/2026).
 *
 * Usuario, con la clase PDF abierta con la pantalla de un curso: «la interfaz
 * sigue siendo la misma, como un curso; no se sabe cuál presentación es la
 * primera que se subió y cuál es la siguiente».
 *
 * Arriba, la clase (para volver), el TEMA, el día y quién la da, y «Descargar
 * para imprimir». Las páginas las pinta la escuela (`PaginasPdf`). Abajo, la
 * semana anterior y la siguiente de ESA clase que tienen presentación, con su
 * tema y su día.
 *
 * - El alumno ve la que le toca (la versión de su clase si ya está guardada;
 *   si no, la de antes): las mismas reglas que su semana
 *   (lib/nawar/verPresentacion.ts ← pasosDeSemana). Abrir la de antes la
 *   marca como vista, igual que hacía la página del curso.
 * - El equipo elige entre todas las de esa clase (quién la ve, quién la
 *   subió, si tiene notas) y tiene «Abrir en la pizarra».
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Download, PenLine } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import PaginasPdf from '@components/Objects/Activities/DocumentPdf/PaginasPdf'
import { Cargando, Esqueleto } from '@components/Objects/Esqueleto'
import { claveSemanas } from '@components/Pages/Courses/SemanasClase'
import { getClaseDeSemana, urlPdfAntes, urlPdfConNotas, urlPdfFuente } from '@services/pizarra/pizarra'
import { getSemanas, type Semana } from '@services/tareas/tareas'
import { markActivityAsComplete } from '@services/courses/activity'
import { queryKeys } from '@/lib/query/keys'
import { ajustesDirecto, nombreDeClase } from '@/lib/nawar/cursos'
import { textosDeClase } from '@/lib/nawar/palabraClase'
import { tituloDeClase } from '@/lib/nawar/salaProfes'
import { diaDeSesion } from '@/lib/nawar/sesionDeLaSala'
import { tipoDeClase } from '@/lib/nawar/visitaGuiada'
import { opcionesDe, opcionInicial, vecinas, type OpcionPresentacion } from '@/lib/nawar/verPresentacion'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const sinPrefijo = (uuid: string) => String(uuid || '').replace(/^course_/, '')

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

/** Un lado del pie: «← Semana anterior · Mijn huis · miércoles 11 nov». */
function Vecina({ semana, lado, href, palabra }: { semana: Semana | null; lado: 'anterior' | 'siguiente'; href: string; palabra: (t: string) => string }) {
  if (!semana) return <span className="hidden sm:block" />
  const derecha = lado === 'siguiente'
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group flex min-w-0 items-center gap-3 rounded-xl border border-[#E2E7F0] bg-white px-4 py-3 transition-colors hover:border-[#0b2da0] ${derecha ? 'justify-end text-right sm:col-start-2' : ''}`}
    >
      {derecha ? null : <ArrowLeft size={17} className="shrink-0 text-[#6B7393] group-hover:text-[#0b2da0]" />}
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-[#6B7393]">{derecha ? 'Siguiente' : palabra('Semana anterior')}</span>
        <span className="block truncate text-[14.5px] font-semibold text-[#0B1033]">{palabra(tituloDeClase(semana.tema, semana.fecha))}</span>
        <span className="block text-[12.5px] text-[#6B7393] first-letter:uppercase">{diaDeSesion(semana.fecha)}</span>
      </span>
      {derecha ? <ArrowRight size={17} className="shrink-0 text-[#6B7393] group-hover:text-[#0b2da0]" /> : null}
    </Link>
  )
}

export default function VerPresentacion({ semanaId }: { semanaId: string }) {
  const id = Number(semanaId)
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const org = useOrg() as any
  const orgslug: string = org?.slug || ''
  const queryClient = useQueryClient()
  const ruta = (p: string) => getUriWithOrg(orgslug, p)

  // De qué clase es esta semana y si quien mira es del equipo de esa clase.
  const clase = useQuery({
    queryKey: ['presentacion', 'clase', id],
    queryFn: () => getClaseDeSemana(id, token),
    enabled: !!token && Number.isFinite(id) && id > 0,
    staleTime: 60_000,
    retry: false,
  })
  const courseUuid = clase.data?.course_uuid || ''
  // Las semanas de la clase: las mismas que su página (misma caché).
  const semanas = useQuery({
    queryKey: claveSemanas(courseUuid),
    queryFn: () => getSemanas(courseUuid, token),
    enabled: !!token && !!courseUuid,
    staleTime: 30_000,
    retry: 1,
  })

  const equipo = !!clase.data?.equipo && !!(semanas.data?.equipo || semanas.data?.admin)
  const hoy = semanas.data?.hoy || ''
  const nombreCurso = nombreDeClase(clase.data?.curso || '')
  const t = useMemo(() => textosDeClase(clase.data?.curso), [clase.data?.curso])
  const sencilla = tipoDeClase(String(clase.data?.curso || '')) !== 'semanal'
  const semana = useMemo(() => (semanas.data?.semanas || []).find((s) => s.id === id) || null, [semanas.data, id])
  const opciones = useMemo(() => (semana ? opcionesDe(semana, equipo) : []), [semana, equipo])
  const [elegida, setElegida] = useState('')
  const abierta: OpcionPresentacion | null = useMemo(
    () => opciones.find((o) => o.id === elegida) || (semana ? opcionInicial(opciones, semana, equipo, hoy) : null),
    [opciones, elegida, semana, equipo, hoy]
  )
  const { anterior, siguiente } = useMemo(
    () => (semanas.data ? vecinas(semanas.data.semanas || [], id, equipo, sencilla, hoy) : { anterior: null, siguiente: null }),
    [semanas.data, id, equipo, sencilla, hoy]
  )

  // El PDF de la que está abierta, pedido con la sesión.
  const [url, setUrl] = useState('')
  const [fallo, setFallo] = useState('')
  const [sinVisor, setSinVisor] = useState(false)
  const clave = abierta ? `${abierta.id}|${abierta.semanaPdf || ''}|${abierta.actividad || ''}` : ''
  useEffect(() => {
    setUrl('')
    setFallo('')
    setSinVisor(false)
    if (!abierta || !token) return
    let vivo = true
    let hecha = ''
    const pedir =
      abierta.tipo === 'clase'
        ? urlPdfConNotas(abierta.semanaPdf || id, token)
        : equipo && abierta.fuente
          ? urlPdfFuente(id, abierta.fuente, token)
          : urlPdfAntes(id, token, abierta.actividad || '')
    pedir
      .then((u) => {
        hecha = u
        if (vivo) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((e: any) => vivo && setFallo(e?.message || 'No se ha podido abrir la presentación'))
    return () => {
      vivo = false
      if (hecha) URL.revokeObjectURL(hecha)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, token, id, equipo])

  // El alumno que abre la de antes de la clase: cuenta como vista (lo mismo
  // que hacía la página del curso al abrir la clase PDF). Una vez.
  const marcada = useRef('')
  useEffect(() => {
    if (equipo || !url || !abierta || abierta.tipo !== 'antes' || !abierta.actividad || abierta.hecha) return
    if (marcada.current === abierta.actividad) return
    marcada.current = abierta.actividad
    markActivityAsComplete(orgslug, courseUuid, abierta.actividad, token)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: claveSemanas(courseUuid) })
        if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
      })
      .catch(() => {
        marcada.current = ''
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, abierta?.actividad, abierta?.hecha, equipo])

  // ── Pantalla ────────────────────────────────────────────────────────────
  const volver = courseUuid ? ruta(`/course/${sinPrefijo(courseUuid)}`) : ruta('/')
  if (clase.isError) {
    return (
      <Aviso titulo="No se puede abrir esta presentación" texto={(clase.error as any)?.message || 'Puede que ya no exista o que no sea de una de tus clases.'}>
        <Link href={ruta('/')} className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white hover:bg-[#0a2690]">
          Ir al inicio
        </Link>
      </Aviso>
    )
  }
  const cargando = !clase.data || (!semanas.data && !semanas.isError)
  const profe = (semana?.material_profe?.profe || ajustesDirecto(org?.config?.config ?? org?.config, courseUuid).banner?.profe || '').trim()
  const titulo = semana ? t(tituloDeClase(semana.tema, semana.fecha)) : clase.data?.tema || ''
  const cuando = [diaDeSesion(semana?.fecha || clase.data?.fecha || '', hoy), profe ? `con ${profe}` : ''].filter(Boolean).join(' · ')
  const nombreArchivo = `${(semana?.tema || 'Presentación').trim()}${abierta?.tipo === 'clase' ? ' - notas de la clase' : ''}.pdf`

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#F4F6FB]">
      <div className="border-b border-[#E6EAF2] bg-white">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link href={volver} prefetch={false} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#0b2da0] hover:underline">
            <ArrowLeft size={15} /> {nombreCurso || t('La clase')}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {cargando ? (
                <Cargando className="space-y-2">
                  <Esqueleto ancho={220} alto={24} />
                  <Esqueleto ancho={160} alto={12} />
                </Cargando>
              ) : (
                <>
                  <h1 className="break-words text-[23px] font-bold leading-tight text-[#0B1033] sm:text-[27px]" style={POPPINS}>
                    {titulo || t('Presentación de la clase')}
                  </h1>
                  {cuando ? <p className="mt-1 text-[13.5px] text-[#6B7393] first-letter:uppercase">{cuando}</p> : null}
                </>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {equipo && abierta?.fuente ? (
                <a
                  href={ruta(`/pizarra/${id}?fuente=${encodeURIComponent(abierta.fuente)}`)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E2E7F0] bg-white px-3.5 text-[13.5px] font-semibold text-[#0B1033] hover:bg-[#F7F9FD]"
                >
                  <PenLine size={15} /> Abrir en la pizarra
                </a>
              ) : null}
              {url ? (
                <a href={url} download={nombreArchivo} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white hover:bg-[#0a2690]">
                  <Download size={15} /> Descargar para imprimir
                </a>
              ) : null}
            </div>
          </div>

          {/* El equipo: todas las de esta clase, para saber cuál es cuál. */}
          {equipo && opciones.length > 1 ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label={t('Presentaciones de esta clase')}>
              {opciones.map((o) => {
                const activa = abierta?.id === o.id
                return (
                  <button
                    key={o.id}
                    role="tab"
                    aria-selected={activa}
                    onClick={() => setElegida(o.id)}
                    className={`min-w-[180px] max-w-[300px] shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      activa ? 'border-[#0b2da0] bg-[#F5F8FF]' : 'border-[#E2E7F0] bg-white hover:border-[#C9D3E6]'
                    }`}
                  >
                    <span className="block truncate text-[13.5px] font-semibold text-[#0B1033]">{t(o.titulo)}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-[#6B7393]">
                      {t(o.detalle)}
                      {o.enPizarra ? ' · en la pizarra' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : equipo && abierta ? (
            <p className="text-[12.5px] text-[#6B7393]">
              {t(abierta.detalle)}
              {abierta.enPizarra ? ' · en la pizarra' : ''}
            </p>
          ) : !equipo && abierta ? (
            <p className="text-[12.5px] text-[#6B7393]">{t(abierta.detalle)}</p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[960px] px-3 py-5 sm:px-6 sm:py-8">
        {cargando ? (
          <p className="animate-pulse py-24 text-center text-[14px] text-[#6B7393]">Abriendo la presentación…</p>
        ) : !semana || !abierta ? (
          <Aviso
            titulo={t('Esta clase todavía no tiene presentación')}
            texto={equipo ? t('Súbela desde la ficha de la clase, en la sala de profesores.') : t('En cuanto esté, la verás aquí y en la semana de tu clase.')}
          >
            <Link href={equipo ? ruta(`/equipo?vista=presentaciones&ficha=${id}`) : volver} className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#0b2da0] px-4 text-[14px] font-semibold text-white hover:bg-[#0a2690]">
              {equipo ? t('Abrir la ficha de la clase') : t('Volver a la clase')}
            </Link>
          </Aviso>
        ) : fallo ? (
          <Aviso titulo="No se ha podido abrir" texto={fallo} />
        ) : !url ? (
          <p className="animate-pulse py-24 text-center text-[14px] text-[#6B7393]">Abriendo la presentación…</p>
        ) : sinVisor ? (
          <iframe src={url} title="Presentación" className="h-[calc(100dvh-14rem)] w-full rounded-lg border border-[#E6EAF2] bg-white" />
        ) : (
          <PaginasPdf key={url} url={url} alFallar={() => setSinVisor(true)} />
        )}

        {anterior || siguiente ? (
          <nav aria-label={t('Otras clases')} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Vecina semana={anterior} lado="anterior" href={anterior ? ruta(`/presentacion/${anterior.id}`) : '#'} palabra={t} />
            <Vecina semana={siguiente} lado="siguiente" href={siguiente ? ruta(`/presentacion/${siguiente.id}`) : '#'} palabra={t} />
          </nav>
        ) : null}
      </div>
    </div>
  )
}
