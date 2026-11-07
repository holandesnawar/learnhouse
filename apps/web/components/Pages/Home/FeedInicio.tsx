'use client'
/**
 * El Inicio como feed (rediseño, rama `diseno`, 07/11/2026), como en Circle:
 *  - `ProximaClase`: la clase en directo de esta semana con «¿Vienes?».
 *  - `FeedComunidad`: lo último publicado en los tablones de la comunidad
 *    (Victorias, Noticias…), mezclado y por fecha, con un hueco para escribir.
 * Los datos son los de siempre: `/tareas/mi-semana` y las publicaciones de
 * cada canal tipo tablón que ve el alumno.
 */
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Heart, MessageCircle, Video, ArrowRight } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getCommunities, type Community } from '@services/communities/communities'
import { getDiscussions, type DiscussionWithAuthor } from '@services/communities/discussions'
import { getMiSemana, diaCorto, type MiSemana } from '@services/tareas/tareas'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import { esCanalEsencial } from '@/lib/nawar/empiezaAqui'
import { ajustesDirecto, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { Vienes, pasosDeSemana, FilaPaso } from '@components/Pages/Clases/MisClasesAlumno'

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
  if (!data || !data.clases.length) return null
  const config = org?.config?.config
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
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
      {data.clases.map((c) => {
        const s = c.semana
        const a = ajustesDirecto(config, c.course_uuid)
        const r: any = a.banner || (c.course_uuid === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
        const porVenir = !!s.fecha && s.fecha >= hoy
        const esHoy = s.fecha === hoy
        const linea = [s.fecha ? diaCorto(s.fecha) : '', String(r.schedule || '').trim(), r.teacher ? `con ${r.teacher}` : ''].filter(Boolean).join(' · ')
        const pasos = pasosDeSemana(s, c.course_uuid, ruta, hoy)
        const quedan = pasos.filter((p) => p.estado === 'pendiente').length
        return (
          <div key={c.course_uuid} className="mt-3 border-t border-[#EEF1F7] first:border-t-0">
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[#0b2da0] first-letter:uppercase">
                  {esHoy ? 'Hoy hay clase' : porVenir ? 'Tu próxima clase' : 'Clase de esta semana'}
                  {linea ? <span className="text-[#8A91AD] font-medium"> · {linea}</span> : null}
                </p>
                <h3 className="mt-1 text-[19px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                  {s.tema || 'Clase de la semana'}
                </h3>
                <p className="mt-0.5 text-[13px] text-[#8A91AD]">
                  {quedan ? `Te ${quedan === 1 ? 'queda 1 cosa' : `quedan ${quedan} cosas`} por hacer` : '¡Lo tienes todo hecho esta semana!'}
                </p>
              </div>
              {esHoy ? (
                <Link
                  href={ruta(`/course/${c.course_uuid}`)}
                  className="shrink-0 inline-flex items-center h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold hover:bg-[#0a2690]"
                >
                  Entrar a la clase
                </Link>
              ) : null}
            </div>
            {porVenir ? (
              <div className="px-5 pb-3">
                <Vienes semana={s} courseUuid={c.course_uuid} />
              </div>
            ) : null}
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

/** Lo destacado: lo fijado por el equipo y lo que más gustó en dos semanas. */
export function DestacadosComunidad({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data } = useQuery<Entrada[]>({
    queryKey: ['comunidad', 'destacados', org?.id],
    queryFn: async () => {
      const canales: Community[] = ((await getCommunities(org.id, 1, 50, null, token)) || []).filter((c: Community) => c.kind === 'posts' && !esCanalEsencial(c.name))
      const listas = await Promise.all(
        canales.map((c) =>
          getDiscussions(c.community_uuid, 'recent', 1, 15, null, token)
            .then((ds) => (ds || []).map((d) => ({ ...d, canal: c })))
            .catch(() => [] as Entrada[])
        )
      )
      const hace = new Date(Date.now() - 14 * 864e5).toISOString()
      const puntos = (d: Entrada) => (d.is_pinned ? 1000 : 0) + (d.upvote_count || 0) + (d.reactions || []).reduce((n, r) => n + r.count, 0)
      return listas
        .flat()
        .filter((d) => d.is_pinned || (d.creation_date || '') >= hace)
        .sort((a, b) => puntos(b) - puntos(a))
        .slice(0, 2)
    },
    enabled: !!org?.id && !!token,
    staleTime: 60_000,
  })
  if (!data?.length) return null
  const canalHref = (c: Community) => getUriWithOrg(orgslug, `/community/${c.community_uuid.replace('community_', '')}`)
  return (
    <section>
      <h2 className="text-[16px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
        Destacado en la comunidad
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {data.map((d) => {
          const { emoji, text } = splitChannelEmoji(d.canal.name)
          const autor = [d.author?.first_name, d.author?.last_name].filter(Boolean).join(' ') || d.author?.username || 'Alguien'
          return (
            <Link
              key={d.discussion_uuid}
              href={`${canalHref(d.canal)}/discussion/${d.discussion_uuid.replace('discussion_', '')}`}
              className={`${TARJETA} p-4 hover:border-[#C9D4EC] flex flex-col`}
            >
              <span className="text-[12px] font-semibold text-[#8A91AD]">
                {emoji ? `${emoji} ` : ''}
                {text}
              </span>
              <span className="mt-1.5 text-[15px] font-bold text-[#0B1033] leading-snug line-clamp-2">{d.title || textoPlano(d.content).slice(0, 80)}</span>
              <span className="mt-1 text-[13.5px] text-[#4A5272] line-clamp-2">{textoPlano(d.content)}</span>
              <span className="mt-auto pt-3 flex items-center gap-2 text-[12.5px] text-[#8A91AD]">
                <Avatar a={d.author} size={22} />
                <span className="truncate">{autor}</span>
                <span className="ml-auto inline-flex items-center gap-1">
                  <Heart size={13} /> {(d.upvote_count || 0) + (d.reactions || []).reduce((n, r) => n + r.count, 0)}
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
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const { data, isLoading } = useQuery<{ entradas: Entrada[]; tablones: Community[] }>({
    queryKey: ['comunidad', 'feed', org?.id],
    queryFn: async () => {
      const canales: Community[] = (await getCommunities(org.id, 1, 50, null, token)) || []
      const tablones = canales.filter((c) => c.kind === 'posts' && !esCanalEsencial(c.name))
      const listas = await Promise.all(
        tablones.map((c) =>
          getDiscussions(c.community_uuid, 'recent', 1, 8, null, token)
            .then((ds) => (ds || []).map((d) => ({ ...d, canal: c })))
            .catch(() => [] as Entrada[])
        )
      )
      const entradas = listas.flat().sort((a, b) => (b.creation_date || '').localeCompare(a.creation_date || '')).slice(0, 12)
      return { entradas, tablones }
    },
    enabled: !!org?.id && !!token,
    staleTime: 60_000,
  })
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const canalHref = (c: Community) => ruta(`/community/${c.community_uuid.replace('community_', '')}`)
  const primero = data?.tablones?.[0]
  const miNombre: string = session?.data?.user?.first_name || session?.data?.user?.username || ''
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
      {primero ? (
        <Link href={canalHref(primero)} className={`${TARJETA} flex items-center gap-3 px-4 py-3 mb-4 hover:border-[#C9D4EC]`}>
          <span className="w-9 h-9 rounded-full bg-[#E3EBFA] text-[#0b2da0] font-bold flex items-center justify-center">{(miNombre || '?').slice(0, 1).toUpperCase()}</span>
          <span className="flex-1 text-[14px] text-[#8A91AD]">Comparte algo con la comunidad…</span>
          <span className="h-8 px-3 rounded-lg bg-[#0b2da0] text-white text-[13px] font-semibold flex items-center">Publicar</span>
        </Link>
      ) : null}
      {(data?.tablones || []).length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
          {[{ community_uuid: '', name: 'Todo' } as Community, ...(data?.tablones || [])].map((c) => {
            const { emoji, text } = splitChannelEmoji(c.name)
            const on = filtro === c.community_uuid
            return (
              <button
                key={c.community_uuid || 'todo'}
                type="button"
                onClick={() => setFiltro(c.community_uuid)}
                className={`shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border ${on ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3F0] text-[#3B4262] hover:border-[#C9D4EC]'}`}
              >
                {emoji ? `${emoji} ` : ''}
                {text}
              </button>
            )
          })}
        </div>
      ) : null}
      {isLoading ? (
        <div className="space-y-3">
          <div className={`${TARJETA} h-[150px] animate-pulse`} />
          <div className={`${TARJETA} h-[150px] animate-pulse`} />
        </div>
      ) : !entradas.length ? (
        <div className={`${TARJETA} px-5 py-10 text-center text-[14px] text-[#6B7393]`}>Todavía no hay publicaciones. ¡Sé el primero!</div>
      ) : (
        <div className="space-y-3">
          {entradas.map((d) => {
            const { emoji, text } = splitChannelEmoji(d.canal.name)
            const autor = [d.author?.first_name, d.author?.last_name].filter(Boolean).join(' ') || d.author?.username || 'Alguien'
            const cuerpo = textoPlano(d.content)
            const reacciones = (d.reactions || []).reduce((n, r) => n + r.count, 0) + (d.upvote_count || 0)
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
                        {emoji ? `${emoji} ` : ''}
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
                  <span className="inline-flex items-center gap-1.5">
                    <Heart size={15} /> {reacciones || 'Me gusta'}
                  </span>
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
