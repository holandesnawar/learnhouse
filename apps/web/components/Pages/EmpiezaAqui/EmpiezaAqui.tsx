'use client'
/**
 * «Empieza aquí» → Bienvenida (rediseño, rama diseno, 07/11/2026).
 *
 * La primera página de quien acaba de entrar, como el «Start here» de las
 * comunidades de Circle: cinco pasos con su check, lo que hay que saber (las
 * publicaciones del canal «Empieza aquí») y cómo está montada la escuela.
 *
 * «Preséntate» se marca solo si ya publicó en el canal de presentaciones; los
 * demás pasos se marcan al abrirlos (o con «Hecho») y se recuerdan en este
 * navegador.
 */
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Check, ArrowRight, BookOpen, Video, MessagesSquare, Smartphone, Compass, Hand } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getCommunities, type Community } from '@services/communities/communities'
import { getDiscussions, type DiscussionWithAuthor } from '@services/communities/discussions'
import { CURSO_FORMACION_UUID } from '@/lib/nawar/cursos'
import { esCanalDePresentarse, esCanalEsencial } from '@/lib/nawar/empiezaAqui'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'

function textoPlano(c: string | null): string {
  if (!c) return ''
  try {
    const d = JSON.parse(c)
    const partes: string[] = []
    const andar = (n: any) => {
      if (!n) return
      if (n.type === 'text' && n.text) partes.push(n.text)
      ;(n.content || []).forEach(andar)
      if (n.type === 'paragraph') partes.push('\n')
    }
    andar(d)
    return partes.join('').trim()
  } catch {
    return c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

type Paso = { id: string; titulo: string; texto: string; href: string; boton: string; icono: React.ReactNode }

export default function EmpiezaAqui({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const yo = session?.data?.user
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const clave = `nawar.empieza.${yo?.id || 'anon'}`

  const [hechos, setHechos] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      setHechos(JSON.parse(localStorage.getItem(clave) || '{}') || {})
    } catch {
      setHechos({})
    }
  }, [clave])
  const marcar = (id: string, valor = true) => {
    setHechos((h) => {
      const n = { ...h, [id]: valor }
      try {
        localStorage.setItem(clave, JSON.stringify(n))
      } catch {}
      return n
    })
  }

  const { data } = useQuery<{ canales: Community[]; fijadas: (DiscussionWithAuthor & { canal: Community })[]; presentado: boolean }>({
    queryKey: ['empieza-aqui', org?.id, yo?.id],
    queryFn: async () => {
      const canales: Community[] = (await getCommunities(org.id, 1, 50, null, token)) || []
      const inicio = canales.find((c) => esCanalEsencial(c.name))
      const presentaciones = canales.find((c) => esCanalDePresentarse(c.name))
      const [fijadas, pres] = await Promise.all([
        inicio ? getDiscussions(inicio.community_uuid, 'recent', 1, 6, null, token).catch(() => []) : Promise.resolve([]),
        presentaciones ? getDiscussions(presentaciones.community_uuid, 'recent', 1, 50, null, token).catch(() => []) : Promise.resolve([]),
      ])
      const presentado = (pres || []).some((d: any) => d?.author?.id === yo?.id || d?.author_id === yo?.id)
      return {
        canales,
        fijadas: ((fijadas || []) as DiscussionWithAuthor[]).map((d) => ({ ...d, canal: inicio as Community })).reverse(),
        presentado,
      }
    },
    enabled: !!org?.id && !!token,
    staleTime: 60_000,
  })

  const canalHref = (c?: Community) => (c ? ruta(`/community/${c.community_uuid.replace('community_', '')}`) : ruta('/communities'))
  const presentaciones = (data?.canales || []).find((c) => esCanalDePresentarse(c.name))

  const pasos: Paso[] = useMemo(
    () => [
      { id: 'conoce', titulo: 'Conoce la escuela', texto: 'Dos minutos para saber dónde está cada cosa.', href: '#asi-es', boton: 'Ver cómo es', icono: <Compass size={18} /> },
      { id: 'presentate', titulo: 'Preséntate', texto: 'Cuéntanos quién eres, dónde vives y para qué quieres el neerlandés.', href: canalHref(presentaciones), boton: 'Presentarme', icono: <Hand size={18} /> },
      { id: 'clase', titulo: 'Mira tu clase de esta semana', texto: 'La presentación, el día y la hora. Dinos si vienes.', href: ruta('/clases'), boton: 'Ver mi clase', icono: <Video size={18} /> },
      { id: 'formacion', titulo: 'Empieza el módulo 1', texto: 'Con 20 minutos al día basta. La escuela recuerda dónde lo dejas.', href: ruta(`/course/${CURSO_FORMACION_UUID}`), boton: 'Empezar', icono: <BookOpen size={18} /> },
      { id: 'movil', titulo: 'Tenla en el móvil', texto: 'iPhone: Compartir → Ver más → Añadir a pantalla de inicio. Android: menú ⋮ → Instalar aplicación.', href: '', boton: 'Hecho', icono: <Smartphone size={18} /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presentaciones?.community_uuid, orgslug]
  )
  const hecho = (p: Paso) => (p.id === 'presentate' && data?.presentado) || !!hechos[p.id]
  const n = pasos.filter(hecho).length
  const siguiente = pasos.find((p) => !hecho(p))
  const nombre = yo?.first_name || yo?.username || ''

  return (
    <div className="max-w-[880px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
      <section className="rounded-2xl bg-[#0b2da0] text-white px-5 sm:px-8 py-7 sm:py-9 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle 420px at 100% 0%, rgba(77,163,255,0.35), transparent 70%), radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: 'auto, 26px 26px' }} />
        <div className="relative">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9CC9FF]">Empieza aquí</p>
          <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold leading-tight" style={POPPINS}>
            {nombre ? `Bienvenida a la escuela, ${nombre}` : 'Bienvenida a la escuela'}
          </h1>
          <p className="mt-2 text-[15px] text-white/90 max-w-[560px]">Cinco pasos para arrancar con buen pie. Hazlos a tu ritmo: esta página te espera aquí.</p>
        </div>
      </section>

      <section className={`${TARJETA} divide-y divide-[#EEF1F7]`}>
        {/* El progreso y el botón, fuera del azul (08/11: «no se ve que hay un botón»). */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-4 sm:px-6 py-4">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="flex-1 max-w-[280px] h-1.5 rounded-full bg-[#EEF1F7] overflow-hidden">
              <div className="h-full rounded-full bg-[#0b2da0] transition-all" style={{ width: `${(n / pasos.length) * 100}%` }} />
            </div>
            <span className="text-[13.5px] font-semibold text-[#3B4262] tabular-nums">
              {n} de {pasos.length} hechos
            </span>
          </div>
          {siguiente ? (
            siguiente.href ? (
              <Link
                href={siguiente.href}
                onClick={() => siguiente.href.startsWith('#') || marcar(siguiente.id)}
                className="shrink-0 self-start sm:self-auto inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690]"
              >
                Siguiente: {siguiente.titulo.toLowerCase()} <ArrowRight size={16} />
              </Link>
            ) : null
          ) : (
            <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#16A34A]">
              <Check size={17} /> ¡Listo! Ya tienes todo en marcha.
            </p>
          )}
        </div>
        {pasos.map((p, i) => {
          const ok = hecho(p)
          return (
            <div key={p.id} className="flex items-start gap-4 px-4 sm:px-6 py-4">
              <button
                type="button"
                onClick={() => p.id !== 'presentate' && marcar(p.id, !ok)}
                aria-label={ok ? 'Hecho' : 'Marcar como hecho'}
                className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-[1.5px] bg-white ${ok ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#C9D2E6] text-[#8A91AD]'}`}
              >
                {ok ? <Check size={14} strokeWidth={2.5} /> : <span className="text-[12px] font-semibold">{i + 1}</span>}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-[15.5px] font-semibold ${ok ? 'text-[#8A91AD] line-through decoration-[#C9D2E6]' : 'text-[#0B1033]'}`}>{p.titulo}</p>
                <p className="mt-0.5 text-[14px] text-[#4A5272] leading-relaxed">{p.texto}</p>
              </div>
              {!ok ? (
                p.href ? (
                  <Link
                    href={p.href}
                    onClick={() => p.id !== 'presentate' && !p.href.startsWith('#') && marcar(p.id)}
                    className="shrink-0 hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#DDE3F0] text-[13.5px] font-semibold text-[#0b2da0] hover:bg-[#F5F8FF]"
                  >
                    {p.boton} <ArrowRight size={14} />
                  </Link>
                ) : (
                  <button type="button" onClick={() => marcar(p.id)} className="shrink-0 hidden sm:inline-flex items-center h-9 px-3.5 rounded-lg border border-[#DDE3F0] text-[13.5px] font-semibold text-[#0b2da0] hover:bg-[#F5F8FF]">
                    {p.boton}
                  </button>
                )
              ) : null}
            </div>
          )
        })}
      </section>

      {data?.fijadas?.length ? (
        <section>
          <h2 className="text-[18px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
            Lo que tienes que saber
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.fijadas.map((d) => (
              <Link
                key={d.discussion_uuid}
                href={`${canalHref(d.canal)}/discussion/${d.discussion_uuid.replace('discussion_', '')}`}
                className={`${TARJETA} p-4 sm:p-5 hover:border-[#C9D4EC] block`}
              >
                <h3 className="text-[15.5px] font-bold text-[#0B1033]">{d.title}</h3>
                <p className="mt-1.5 text-[14px] text-[#4A5272] leading-relaxed line-clamp-4 whitespace-pre-line">{textoPlano(d.content)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0]">
                  Leer <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section id="asi-es" className="scroll-mt-20">
        <h2 className="text-[18px] font-bold text-[#0B1033] mb-3" style={POPPINS}>
          Así es la escuela
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icono: <BookOpen size={20} />, t: 'Formación', d: 'El camino de A0 a A1: módulos con lecciones, ejercicios, lectura y escucha.', href: ruta(`/course/${CURSO_FORMACION_UUID}`) },
            { icono: <Video size={20} />, t: 'Mis clases', d: 'Tu clase en directo de cada semana: presentación, ejercicios, tarea y grabación.', href: ruta('/clases') },
            { icono: <MessagesSquare size={20} />, t: 'Comunidad', d: 'Preséntate, comparte tus victorias y pregunta tus dudas.', href: ruta('/communities') },
          ].map((x) => (
            <Link key={x.t} href={x.href} onClick={() => marcar('conoce')} className={`${TARJETA} p-4 sm:p-5 hover:border-[#C9D4EC] block`}>
              <span className="block text-[#0b2da0] [&_svg]:w-[30px] [&_svg]:h-[30px] [&_svg]:stroke-[1.6]">{x.icono}</span>
              <h3 className="mt-3 text-[15.5px] font-bold text-[#0B1033]">{x.t}</h3>
              <p className="mt-1 text-[14px] text-[#4A5272] leading-relaxed">{x.d}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
