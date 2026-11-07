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
import { ajustesDirecto, CURSO_CLASE_SEMANAL_UUID } from '@/lib/nawar/cursos'
import { Vienes } from '@components/Pages/Clases/MisClasesAlumno'

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
    <span className="rounded-full bg-[#E3EBFA] text-[#1D0084] font-bold flex items-center justify-center shrink-0 text-[14px]" style={{ width: size, height: size }}>
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
  return (
    <div className="space-y-3">
      {data.clases.map((c) => {
        const s = c.semana
        const a = ajustesDirecto(config, c.course_uuid)
        const r: any = a.banner || (c.course_uuid === CURSO_CLASE_SEMANAL_UUID ? config?.weekly_class_banner : null) || {}
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
        const porVenir = !!s.fecha && s.fecha >= hoy
        const esHoy = s.fecha === hoy
        const linea = [s.fecha ? diaCorto(s.fecha) : '', String(r.schedule || '').trim(), r.teacher ? `con ${r.teacher}` : ''].filter(Boolean).join(' · ')
        return (
          <section
            key={c.course_uuid}
            className="rounded-2xl p-5 text-white overflow-hidden relative"
            style={{
              backgroundColor: '#1D0084',
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle 380px at 100% 0%, rgba(77,163,255,0.35) 0%, transparent 70%)',
              backgroundSize: '22px 22px, auto',
            }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#9CC9FF]">
              {esHoy ? 'Hoy hay clase' : porVenir ? 'Tu próxima clase' : 'Esta semana'} · {c.curso}
            </p>
            <h2 className="mt-1 text-[22px] font-bold leading-tight" style={POPPINS}>
              {s.tema || 'Clase de la semana'}
            </h2>
            {linea && <p className="mt-0.5 text-[14px] text-white/80 first-letter:uppercase">{linea}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {porVenir ? (
                <div className="rounded-xl bg-white px-2.5 py-2">
                  <Vienes semana={s} courseUuid={c.course_uuid} compacto />
                </div>
              ) : null}
              <Link
                href={getUriWithOrg(orgslug, esHoy ? `/course/${c.course_uuid}` : '/clases')}
                className="ml-auto inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] text-[14px] font-bold"
              >
                {esHoy ? <Video size={16} /> : null}
                {esHoy ? 'Entrar a la clase' : 'Ver mi semana'}
                {!esHoy ? <ArrowRight size={15} /> : null}
              </Link>
            </div>
          </section>
        )
      })}
    </div>
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
      const tablones = canales.filter((c) => c.kind === 'posts')
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
          <span className="w-9 h-9 rounded-full bg-[#E3EBFA] text-[#1D0084] font-bold flex items-center justify-center">{(miNombre || '?').slice(0, 1).toUpperCase()}</span>
          <span className="flex-1 text-[14px] text-[#8A91AD]">Comparte algo con la comunidad…</span>
          <span className="h-8 px-3 rounded-lg bg-[#1D0084] text-white text-[13px] font-semibold flex items-center">Publicar</span>
        </Link>
      ) : null}
      {isLoading ? (
        <div className="space-y-3">
          <div className={`${TARJETA} h-[150px] animate-pulse`} />
          <div className={`${TARJETA} h-[150px] animate-pulse`} />
        </div>
      ) : !data?.entradas.length ? (
        <div className={`${TARJETA} px-5 py-10 text-center text-[14px] text-[#6B7393]`}>Todavía no hay publicaciones. ¡Sé el primero!</div>
      ) : (
        <div className="space-y-3">
          {data.entradas.map((d) => {
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
                  {d.title ? <h3 className="text-[16.5px] font-bold text-[#0B1033] group-hover:text-[#1D0084]">{d.title}</h3> : null}
                  {cuerpo ? <p className="mt-1 text-[14.5px] leading-relaxed text-[#2B3150] line-clamp-3 whitespace-pre-line">{cuerpo}</p> : null}
                </Link>
                <div className="mt-3 pt-3 border-t border-[#EEF1F7] flex items-center gap-5 text-[13px] text-[#6B7393]">
                  <span className="inline-flex items-center gap-1.5">
                    <Heart size={15} /> {reacciones || 'Me gusta'}
                  </span>
                  <Link href={href} className="inline-flex items-center gap-1.5 hover:text-[#1D0084]">
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
