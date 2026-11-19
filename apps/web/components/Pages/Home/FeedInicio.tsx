'use client'
/**
 * El Inicio como feed (rediseño, rama `diseno`, 07/11/2026), como en Circle:
 *  - `SiguienteClase`: arriba del todo, la próxima clase en directo con su
 *    fecha y «¿Vas a asistir? Sí / No» (08/11: solo aquí, no en Esta semana).
 *  - `ProximaClase`: lo que te toca esta semana, como lista.
 *  - `FeedComunidad`: lo último publicado en los tablones de la comunidad
 *    (Victorias, Noticias…), mezclado y por fecha, con un hueco para escribir.
 * Los datos son los de siempre: `/tareas/mi-semana` y las publicaciones de
 * cada canal tipo tablón que ve el alumno.
 */
import React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Video, ArrowRight } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getCommunities, type Community } from '@services/communities/communities'
import { getDiscussions, toggleReaction, type DiscussionWithAuthor } from '@services/communities/discussions'
import { EMOJI_ME_GUSTA, conMeGusta, meGusta, repartirFeed } from '@/lib/nawar/inicioFeed'
import { hiloDe, sinTituloRepetido } from '@/lib/communities/delChat'
import { getMiSemana, diaCorto, type MiSemana } from '@services/tareas/tareas'
import { textosDeClase } from '@/lib/nawar/palabraClase'
import { tipoDeClase } from '@/lib/nawar/visitaGuiada'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import { esCanalEsencial } from '@/lib/nawar/empiezaAqui'
import { ajustesDirecto, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { Vienes, pasosDeSemana, FilaPaso } from '@components/Pages/Clases/MisClasesAlumno'
import { useSemanasClase } from '@components/Pages/Courses/SemanasClase'
import { useCursosEnDirecto } from '@/hooks/queries/useCursosEnDirecto'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import EscribirEnComunidad from './EscribirEnComunidad'
import { Cargando, Esqueleto, EsqueletoLineas } from '@components/Objects/Esqueleto'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'

function haceCuanto(iso: string): string {
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function textoPlano(html: string | null): string {
  // Las publicaciones se guardan como documento del editor (JSON): se sacan
  // sus textos, un párrafo por línea. Si no lo es, se trata como HTML.
  try {
    const doc = JSON.parse(String(html || ''))
    if (doc && Array.isArray(doc.content)) {
      const lineas = doc.content.map((b: any) => {
        const partes: string[] = []
        const recorrer = (n: any) => {
          if (!n) return
          if (n.type === 'text' && typeof n.text === 'string') partes.push(n.text)
          if (Array.isArray(n.content)) n.content.forEach(recorrer)
        }
        recorrer(b)
        return partes.join('')
      })
      return lineas.join('\n').trim()
    }
  } catch {
    /* no es JSON: HTML o texto */
  }
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function Avatar({ a, size = 38 }: { a: DiscussionWithAuthor['author']; size?: number }) {
  const nombre = [a?.first_name, a?.last_name].filter(Boolean).join(' ') || a?.username || '?'
  const src = a?.avatar_image ? getUserAvatarMediaDirectory(a.user_uuid, a.avatar_image) : ''
  if (src) return <img src={src} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  return (
    <span className="rounded-full bg-[#E3EBFA] text-[#0b2da0] font-bold flex items-center justify-center shrink-0 text-[14px]" style={{ width: size, height: size }}>
      {nombre.slice(0, 1).toUpperCase()}
    </span>
  )
}

// ── La siguiente clase, con «¿Vas a asistir?» ──────────────────────────────

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(f: string): string {
  const d = new Date(`${f}T12:00:00`)
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`
}

function UnaSiguiente({ uuid, nombre, orgslug }: { uuid: string; nombre: string; orgslug: string }) {
  const org = useOrg() as any
  const { data } = useSemanasClase(uuid)
  if (!data) return null
  const { semanas, hoy, actual, proxima } = data
  const enCurso = semanas.find((s) => s.id === actual)
  const semana = enCurso && enCurso.fecha >= hoy ? enCurso : semanas.find((s) => s.id === proxima) || null
  if (!semana || !semana.fecha) return null
  const a = ajustesDirecto(org?.config?.config, uuid)
  const r: any = a.banner || (uuid.replace(/^course_/, '') === CURSO_CLASE_SEMANAL_UUID ? org?.config?.config?.weekly_class_banner : null) || {}
  const hora = String(r.schedule || '').trim()
  const esHoy = semana.fecha === hoy
  const cuando = esHoy ? 'Hoy' : fechaLarga(semana.fecha)
  const detalle = [semana.tema, r.teacher ? `con ${r.teacher}` : ''].filter(Boolean).join(' · ')
  const t = textosDeClase(nombre)
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4">
      <Link href={getUriWithOrg(orgslug, `/course/${uuid.replace(/^course_/, '')}`)} className="group min-w-0 flex-1">
        <p className="text-[12.5px] text-[#6B7393]">{t('Tu próxima clase')} · {nombre}</p>
        <p className="mt-0.5 text-[16.5px] font-semibold text-[#0B1033] first-letter:uppercase group-hover:text-[#0b2da0]">
          {cuando}
          {hora ? `, ${hora}` : ''}
        </p>
        {detalle ? <p className="text-[13.5px] text-[#5B6382] truncate">{detalle}</p> : null}
      </Link>
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        {esHoy ? (
          // El día de la clase, a la sala (desde el 12/11 «Entrar a la clase»
          // lleva siempre a la sala, aunque aún esté apagada: allí espera).
          // Si esta semana va a la clase del otro grupo, a la sala de esa.
          <Link
            href={getUriWithOrg(orgslug, `/sala/${String(semana.cambio?.course_uuid || uuid).replace(/^course_/, '')}`)}
            className="inline-flex items-center h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold hover:bg-[#0a2690]"
          >
            {t('Entrar a la clase')}
          </Link>
        ) : (
          <span className="text-[13px] text-[#6B7393] hidden md:inline">¿Vienes?</span>
        )}
        <Vienes semana={semana} courseUuid={uuid} segmento textos={['Asistiré', 'No puedo']} />
      </div>
    </div>
  )
}

/** Arriba del Inicio: la próxima clase en directo de cada una que ve el alumno. */
export function SiguienteClase({ orgslug }: { orgslug: string }) {
  const { data: cursos } = useCursosEnDirecto()
  const { isStaff } = useAdminStatus() as any
  if (isStaff || !cursos?.length) return null
  return (
    <section className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
      {cursos.map((c) => (
        <UnaSiguiente key={c.uuid} uuid={c.uuid} nombre={c.nombre} orgslug={orgslug} />
      ))}
    </section>
  )
}

// ── La clase de esta semana ─────────────────────────────────────────────────

export function ProximaClase({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data } = useQuery<MiSemana>({
    queryKey: ['tareas', 'mi-semana', org?.id],
    queryFn: () => getMiSemana(org.id, token),
    enabled: !!org?.id && !!token,
    staleTime: 30_000,
    retry: 1,
  })
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  // La Masterclass y el Spreek Club (18/11/2026): antes de la sesión no hay
  // nada que hacer («la presentación no la tienen que ver antes»): la fecha y
  // «Entrar» ya salen arriba, en «Tu próxima clase». Su semana sale aquí cuando
  // ya se ha dado (la grabación, la presentación de la sesión).
  const clases = (data?.clases || []).filter((c) => tipoDeClase(c.curso || '') === 'semanal' || !(c.semana.fecha && c.semana.fecha >= hoy))
  if (!data || !clases.length) return null
  const config = org?.config?.config
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  return (
    <section className={TARJETA}>
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-[16px] font-bold text-[#0B1033]" style={POPPINS}>
          Lo que te toca esta semana
        </h2>
        <Link href={ruta('/clases')} className="text-[13px] font-semibold text-[#0b2da0] hover:underline">
          Mis clases
        </Link>
      </div>
      {clases.map((c) => {
        const s = c.semana
        const t = textosDeClase(c.curso)
        const a = ajustesDirecto(config, c.course_uuid)
        const r: any = a.banner || (c.course_uuid === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
        const porVenir = !!s.fecha && s.fecha >= hoy
        const linea = [s.fecha ? diaCorto(s.fecha) : '', String(r.schedule || '').trim(), r.teacher ? `con ${r.teacher}` : ''].filter(Boolean).join(' · ')
        const pasos = pasosDeSemana(s, c.course_uuid, ruta, hoy, c.curso)
        const quedan = pasos.filter((p) => p.estado === 'pendiente').length
        return (
          <div key={c.course_uuid} className="mt-3 border-t border-[#EEF1F7] first:border-t-0">
            <div className="px-5 pt-4 pb-3">
              {porVenir ? (
                // La fecha, el tema y «¿Vienes?» / «Entrar a la clase» ya salen
                // justo encima, en «Tu próxima clase» (16/11/2026: salía dos
                // veces seguida). Aquí, solo de qué clase son los pasos.
                <p className="text-[12.5px] font-semibold text-[#0b2da0]">{c.curso || t('Tu clase')}</p>
              ) : (
                <>
                  <p className="text-[12.5px] font-semibold text-[#0b2da0] first-letter:uppercase">
                    {t('Clase de esta semana')}
                    {linea ? <span className="text-[#8A91AD] font-medium"> · {linea}</span> : null}
                  </p>
                  <h3 className="mt-1 text-[19px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                    {s.tema || t('Clase de la semana')}
                  </h3>
                </>
              )}
              <p className="mt-0.5 text-[13px] text-[#8A91AD]">
                {quedan ? `Te ${quedan === 1 ? 'queda 1 cosa' : `quedan ${quedan} cosas`} por hacer` : '¡Lo tienes todo hecho esta semana!'}
              </p>
            </div>
            <div className="pb-2">
              {pasos.map((p) => (
                <FilaPaso key={p.key} p={p} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/**
 * Los canales que ve el alumno. MISMA clave y misma petición que la barra
 * lateral (`useCanales` de OrgSidebar): react-query la pide una sola vez.
 */
function useCanalesComunidad() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  return useQuery<Community[]>({
    queryKey: ['comunidad', 'canales', org?.id],
    queryFn: async () => {
      const r = await getCommunities(org.id, 1, 50, null, token)
      return Array.isArray(r) ? r : []
    },
    enabled: !!org?.id && !!token,
    staleTime: 5 * 60_000,
  })
}

const claveTablones = (orgId: unknown) => ['comunidad', 'tablones-inicio', orgId]

/**
 * Las publicaciones de los tablones, UNA lectura para «Destacado» y «Lo
 * último» (16/11/2026: antes cada bloque pedía los canales y cada tablón por
 * su cuenta, el doble de peticiones).
 */
function useTablonesInicio() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data: canales } = useCanalesComunidad()
  const tablones = (canales || []).filter((c) => c.kind === 'posts' && !esCanalEsencial(c.name))
  const q = useQuery<Entrada[]>({
    queryKey: [...claveTablones(org?.id), tablones.map((c) => c.community_uuid).join(',')],
    queryFn: async () => {
      const listas = await Promise.all(
        tablones.map((c) =>
          getDiscussions(c.community_uuid, 'recent', 1, 15, null, token)
            .then((ds) => (ds || []).filter((d) => !hiloDe(d.content as any)).map((d) => ({ ...d, canal: c })))
            .catch(() => [] as Entrada[])
        )
      )
      return listas.flat()
    },
    enabled: !!org?.id && !!token && canales !== undefined,
    staleTime: 60_000,
  })
  const reparto = React.useMemo(() => repartirFeed(q.data || []), [q.data])
  return { ...q, canales: canales || [], tablones, ...reparto, cargando: canales === undefined || q.isLoading }
}

/** El corazón de una publicación: da o quita el ❤️ del tablón, con su cifra. */
function MeGusta({ d }: { d: Entrada }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const qc = useQueryClient()
  const [ocupado, setOcupado] = React.useState(false)
  const { total, mio } = meGusta(d)
  const cambiar = (dar: boolean) =>
    qc.setQueriesData<Entrada[]>({ queryKey: claveTablones(org?.id) }, (viejo) =>
      viejo?.map((e) => (e.discussion_uuid === d.discussion_uuid ? { ...e, reactions: conMeGusta(e.reactions, dar) } : e))
    )
  const pulsar = async () => {
    if (!token || ocupado) return
    setOcupado(true)
    const dar = !mio
    cambiar(dar)
    try {
      await toggleReaction(d.discussion_uuid, EMOJI_ME_GUSTA, token)
    } catch {
      cambiar(!dar)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <button
      type="button"
      onClick={pulsar}
      disabled={!token || ocupado}
      aria-pressed={mio}
      className={`inline-flex items-center gap-1.5 hover:text-[#0b2da0] ${mio ? 'text-[#0b2da0] font-semibold' : ''}`}
    >
      <Heart size={15} fill={mio ? 'currentColor' : 'none'} /> {total || 'Me gusta'}
    </button>
  )
}

/** Lo destacado: lo fijado por el equipo y lo que más gustó en dos semanas. */
export function DestacadosComunidad({ orgslug }: { orgslug: string }) {
  const { destacadas: data } = useTablonesInicio()
  if (!data?.length) return null
  const canalHref = (c: Community) => getUriWithOrg(orgslug, `/community/${c.community_uuid.replace('community_', '')}`)
  return (
    <section>
      <h2 className="text-[16px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
        Destacado en la comunidad
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {data.map((d) => {
          const { text } = splitChannelEmoji(d.canal.name)
          const autor = [d.author?.first_name, d.author?.last_name].filter(Boolean).join(' ') || d.author?.username || 'Alguien'
          return (
            <Link
              key={d.discussion_uuid}
              href={`${canalHref(d.canal)}/discussion/${d.discussion_uuid.replace('discussion_', '')}`}
              className={`${TARJETA} p-4 hover:border-[#C9D4EC] flex flex-col`}
            >
              <span className="text-[12px] font-semibold text-[#8A91AD]">
                {text}
              </span>
              <span className="mt-1.5 text-[15px] font-bold text-[#0B1033] leading-snug line-clamp-2">{d.title || textoPlano(d.content).slice(0, 80)}</span>
              <span className="mt-1 text-[13.5px] text-[#4A5272] line-clamp-2">{sinTituloRepetido(d.title || '', textoPlano(d.content))}</span>
              <span className="mt-auto pt-3 flex items-center gap-2 text-[12.5px] text-[#8A91AD]">
                <Avatar a={d.author} size={22} />
                <span className="truncate">{autor}</span>
                <span className="ml-auto inline-flex items-center gap-1">
                  <Heart size={13} /> {meGusta(d).total}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ── Lo último de la comunidad ───────────────────────────────────────────────

type Entrada = DiscussionWithAuthor & { canal: Community }


export function FeedComunidad({ orgslug }: { orgslug: string }) {
  const { ultimas, tablones, canales, cargando: isLoading, refetch } = useTablonesInicio()
  const data = { entradas: ultimas, tablones, canales }
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const canalHref = (c: Community) => ruta(`/community/${c.community_uuid.replace('community_', '')}`)
  const primero = data?.tablones?.[0]
  const [filtro, setFiltro] = React.useState('')
  const entradas = (data?.entradas || []).filter((d) => !filtro || d.canal.community_uuid === filtro)

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
          Lo último en la comunidad
        </h2>
        <Link href={ruta('/communities')} className="text-[13px] font-semibold text-[#025dc7] hover:underline">
          Ver todo
        </Link>
      </div>
      <EscribirEnComunidad canales={data?.canales || []} respaldo={primero} hrefDe={(c) => canalHref(c as Community)} onPublicado={() => refetch()} />
      {(data?.tablones || []).length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
          {[{ community_uuid: '', name: 'Todo' } as Community, ...(data?.tablones || [])].map((c) => {
            const { text } = splitChannelEmoji(c.name)
            const on = filtro === c.community_uuid
            return (
              <button
                key={c.community_uuid || 'todo'}
                type="button"
                onClick={() => setFiltro(c.community_uuid)}
                className={`shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border ${on ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3F0] text-[#3B4262] hover:border-[#C9D4EC]'}`}
              >
                {text}
              </button>
            )
          })}
        </div>
      ) : null}
      {isLoading ? (
        <Cargando className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className={`${TARJETA} p-4 sm:p-5`}>
              <div className="flex items-center gap-3">
                <Esqueleto ancho={36} alto={36} redondo="circulo" />
                <div className="flex-1 space-y-1.5">
                  <Esqueleto ancho="38%" alto={12} />
                  <Esqueleto ancho="22%" alto={10} />
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <Esqueleto ancho="55%" alto={15} />
                <EsqueletoLineas lineas={2} />
              </div>
            </div>
          ))}
        </Cargando>
      ) : !entradas.length ? (
        <div className={`${TARJETA} px-5 py-10 text-center text-[14px] text-[#6B7393]`}>Todavía no hay publicaciones. ¡Sé el primero!</div>
      ) : (
        <div className="space-y-3">
          {entradas.map((d) => {
            const { text } = splitChannelEmoji(d.canal.name)
            const autor = [d.author?.first_name, d.author?.last_name].filter(Boolean).join(' ') || d.author?.username || 'Alguien'
            const cuerpo = sinTituloRepetido(d.title || '', textoPlano(d.content))
            const href = `${canalHref(d.canal)}/discussion/${d.discussion_uuid.replace('discussion_', '')}`
            return (
              <article key={d.discussion_uuid} className={`${TARJETA} p-4 sm:p-5`}>
                <div className="flex items-center gap-3">
                  <Avatar a={d.author} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#0B1033] truncate">{autor}</p>
                    <p className="text-[12.5px] text-[#8A91AD] truncate">
                      en{' '}
                      <Link href={canalHref(d.canal)} className="text-[#3B4262] hover:underline">
                        {text}
                      </Link>{' '}
                      · {haceCuanto(d.creation_date)}
                    </p>
                  </div>
                </div>
                <Link href={href} className="block mt-3 group">
                  {d.title ? <h3 className="text-[16.5px] font-bold text-[#0B1033] group-hover:text-[#0b2da0]">{d.title}</h3> : null}
                  {cuerpo ? <p className="mt-1 text-[14.5px] leading-relaxed text-[#2B3150] line-clamp-3 whitespace-pre-line">{cuerpo}</p> : null}
                </Link>
                <div className="mt-3 pt-3 border-t border-[#EEF1F7] flex items-center gap-5 text-[13px] text-[#6B7393]">
                  <MeGusta d={d} />
                  <Link href={href} className="inline-flex items-center gap-1.5 hover:text-[#0b2da0]">
                    <MessageCircle size={15} /> Comentar
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
