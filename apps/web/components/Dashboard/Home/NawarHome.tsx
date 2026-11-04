'use client'

/**
 * La portada del panel: el negocio de un vistazo, y de ahí a lo que toca.
 *
 * Sustituye a DashboardHome, la de LearnHouse (bienvenida, "crear curso",
 * uso del plan, cursos recientes…): pensada para quien monta cursos, no
 * para quien lleva una escuela.
 *
 * Repaso del 04/11/2026 (usuario: "el panel es caótico… no encuentro lo
 * importante… colores sin vida"):
 * - Arriba, una cabecera con el fondo azul de la escuela, el saludo y las
 *   cuatro cifras que importan (al closer, las suyas: nuevas, por llamar,
 *   agendadas y sus tareas de hoy).
 * - «Lo que toca hoy»: lo que pide una acción ahora, cada cosa con su botón.
 * - El tablero de Matrículas con los mismos colores que el tablero.
 * - Fuera el bloque «Ir a»: repetía la barra de la izquierda.
 *
 * Los números salen de las mismas llamadas que Estadísticas y Contactos.
 * Si algo no carga, la tarjeta lo dice y el resto sigue.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { euros, getSchoolStats, type SchoolStats } from '@services/stats/school'
import { getContactos, type Contacto } from '@services/stats/contactos'
import { ETAPA_TEXTO } from '@services/stats/contactos'
import { ArrowRight, CheckCircle, Kanban, ListChecks, PhoneCall, Tag, Sparkle } from '@phosphor-icons/react'
import { euros as eurosPanel, getAds, getPorDecidir, getTablero, getTareas, type PanelAds, type Tablero, type Tarea } from '@services/panel/panel'
import { hoyISO } from '@services/stats/contactos'
import FichaCliente from '@components/Dashboard/Pages/Panel/FichaCliente'
import { FilaTarea, TareaForm } from '@components/Dashboard/Pages/Panel/Tareas'
import { FONDO_MARCA, POPPINS } from '@/lib/nawar/marca'
import { COLOR_COLUMNA } from '@/lib/nawar/coloresTablero'

const CARD = 'rounded-2xl border border-[#E2E8F4] bg-white p-4 sm:p-5'

function Titulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-[16px] font-bold text-[#0a1656]" style={POPPINS}>
        {children}
      </h2>
      {extra}
    </div>
  )
}

function VerTodo({ href, children = 'Ver todo' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1 shrink-0">
      {children} <ArrowRight size={14} />
    </Link>
  )
}

/** Una cifra dentro de la cabecera azul. */
function Cifra({ etiqueta, valor, nota, href }: { etiqueta: string; valor: string; nota?: string; href?: string }) {
  const inner = (
    <div className="h-full rounded-xl bg-white/10 border border-white/15 px-3.5 py-3 hover:bg-white/[0.14] transition-colors">
      <p className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{etiqueta}</p>
      <p className="text-[24px] sm:text-[28px] font-semibold text-white tabular-nums leading-tight mt-0.5">{valor}</p>
      {nota ? <p className="text-[12px] text-white/70 mt-0.5 truncate">{nota}</p> : null}
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

/** Una cosa que toca hacer hoy, con su botón. */
function Toca({ icono, color, texto, boton, href }: { icono: React.ReactNode; color: string; texto: React.ReactNode; boton: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F4F7FD] transition-colors">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ background: color }}>
        {icono}
      </span>
      <span className="flex-1 min-w-0 text-[13.5px] text-[#1F2A44] leading-snug">{texto}</span>
      <span className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1 shrink-0">
        {boton} <ArrowRight size={14} />
      </span>
    </Link>
  )
}

function fechaLarga(): string {
  try {
    const t = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
    return t.charAt(0).toUpperCase() + t.slice(1)
  } catch {
    return ''
  }
}

export default function NawarHome() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token = session?.data?.tokens?.access_token
  const { isCloser } = useAdminStatus()
  const [stats, setStats] = useState<SchoolStats | null | 'error'>(null)
  const [contactos, setContactos] = useState<Contacto[] | null>(null)
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [yo, setYo] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ads, setAds] = useState<PanelAds | null>(null)
  // Alumnos que han pagado y esperan que se elija su grupo: programa nuevo o
  // beta (Tandas y grupos, 25/10/2026). El aviso es aquí y en la campana, no
  // por correo.
  const [porDecidir, setPorDecidir] = useState<{ id: number; nombre: string }[]>([])

  useEffect(() => {
    if (!org?.id || !token) return
    // El closer no ve los números: no se le piden (darían 403).
    if (!isCloser) getSchoolStats(org.id, token).then((s) => setStats(s ?? 'error'))
    if (!isCloser) getAds(org.id, token).then((r) => setAds(r.ok && r.datos ? r.datos : null))
    if (!isCloser) getPorDecidir(org.id, token).then((r) => setPorDecidir(r.ok && r.datos ? r.datos.alumnos : []))
    getContactos(org.id, '', token).then((r) => setContactos(r?.contactos ?? []))
    getTablero(org.id, token).then((r) => setTablero(r.ok && r.datos ? r.datos : null))
    getTareas(org.id, token, { pendientes: true }).then((r) => {
      if (r.ok && r.datos) {
        setTareas(r.datos.tareas)
        setYo(r.datos.yo)
      } else setTareas([])
    })
  }, [org?.id, token, isCloser])

  const misTareas = (tareas ?? []).filter((t) => t.asignado_id === yo && t.estado !== 'hecha')
  const hoy = hoyISO()
  const urgentes = misTareas.filter((t) => t.fecha && t.fecha <= hoy).length
  const cuenta = (ids: string[]) => (tablero?.tarjetas ?? []).filter((t) => ids.includes(t.etapa) && !t.oculto).length
  const columnas = (tablero?.etapas ?? []).map((e) => ({ ...e, n: cuenta([e.id]) }))
  const nuevas = cuenta(['nuevo'])
  const porLlamar = cuenta(['llamar', 'no-contesta'])
  const agendadas = cuenta(['agendado'])

  const s = stats && stats !== 'error' ? stats : null
  const mesActual = s?.sales?.by_month?.[s.sales.by_month.length - 1]
  const porAtender = (s?.requests ?? []).filter((r: any) => !r.contacted_at).length + (s?.sales?.funnel?.pending ?? []).filter((p) => !p.ya_alumno).length
  const ultimos = (contactos ?? []).slice(0, 6)
  const nombre = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const tc = (n: number) => (tablero ? String(n) : '…')

  // Lo que pide hacer algo hoy. Si no hay nada, se dice.
  const toca: React.ReactNode[] = []
  if (porDecidir.length > 0) {
    toca.push(
      <Toca
        key="decidir"
        icono={<Tag size={18} weight="fill" />}
        color="#7C3AED"
        href="/dash/estadisticas?tab=tandas"
        boton="Elegir"
        texto={
          <>
            <strong className="font-semibold">
              {porDecidir.length === 1 ? `${porDecidir[0].nombre} ha pagado` : `${porDecidir.length} alumnos nuevos han pagado`}
            </strong>
            : elige {porDecidir.length === 1 ? 'su grupo' : 'el grupo de cada uno'}.
          </>
        }
      />
    )
  }
  if (nuevas > 0) {
    toca.push(
      <Toca
        key="nuevas"
        icono={<PhoneCall size={18} weight="fill" />}
        color={COLOR_COLUMNA.nuevo}
        href="/dash/estadisticas?tab=matriculas"
        boton="Llamar"
        texto={
          <>
            <strong className="font-semibold">{nuevas === 1 ? '1 matrícula nueva' : `${nuevas} matrículas nuevas`}</strong> de las
            últimas 48 horas: cuanto antes se llama, más se cierra.
          </>
        }
      />
    )
  }
  if (urgentes > 0) {
    toca.push(
      <Toca
        key="tareas"
        icono={<ListChecks size={18} weight="bold" />}
        color="#DC2626"
        href="/dash/estadisticas?tab=tareas"
        boton="Ver"
        texto={
          <>
            <strong className="font-semibold">{urgentes === 1 ? '1 tarea' : `${urgentes} tareas`}</strong> para hoy o vencidas.
          </>
        }
      />
    )
  }
  if (porLlamar > 0) {
    toca.push(
      <Toca
        key="llamar"
        icono={<Kanban size={18} weight="fill" />}
        color={COLOR_COLUMNA.llamar}
        href="/dash/estadisticas?tab=matriculas"
        boton="Abrir"
        texto={
          <>
            <strong className="font-semibold">{porLlamar === 1 ? '1 persona' : `${porLlamar} personas`}</strong> por llamar o que no
            contestaron.
          </>
        }
      />
    )
  }

  return (
    <div className="h-full w-full bg-[#F4F7FD] px-4 sm:px-9 py-6 sm:py-9 pb-24 lg:pb-10">
      <div className="max-w-[1200px] mx-auto space-y-5 sm:space-y-6">
        {/* La cabecera: el mismo azul que la barra de la escuela. */}
        <div className="relative overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6 text-white" style={FONDO_MARCA}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/65">{fechaLarga()}</p>
          <h1 className="mt-1 text-[24px] sm:text-[30px] font-bold leading-tight" style={POPPINS}>
            {saludo}
            {nombre ? `, ${nombre}` : ''}.
          </h1>
          <p className="text-[14px] text-white/80 mt-0.5">Así va la escuela hoy.</p>

          {isCloser ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
              <Cifra etiqueta="Nuevas" valor={tc(nuevas)} nota="Últimas 48 horas" href="/dash/estadisticas?tab=matriculas" />
              <Cifra etiqueta="Por llamar" valor={tc(porLlamar)} nota="Y las que no contestaron" href="/dash/estadisticas?tab=matriculas" />
              <Cifra etiqueta="Agendadas" valor={tc(agendadas)} nota="Con llamada reservada" href="/dash/estadisticas?tab=llamadas" />
              <Cifra etiqueta="Tus tareas" valor={tareas ? String(urgentes) : '…'} nota="Para hoy o vencidas" href="/dash/estadisticas?tab=tareas" />
            </div>
          ) : stats === 'error' ? (
            <p className="mt-4 text-[13.5px] text-white/85">No se han podido cargar los números. Prueba a recargar.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
              <Cifra etiqueta="Por atender" valor={s ? String(porAtender) : '…'} nota="Pidieron plaza o dejaron el pago" href="/dash/estadisticas?tab=matriculas" />
              <Cifra etiqueta="Ventas este mes" valor={s ? String(mesActual?.sales ?? 0) : '…'} nota={s && mesActual ? euros(mesActual.revenue_cents) : undefined} href="/dash/estadisticas" />
              <Cifra
                etiqueta="Últimos 30 días"
                valor={s ? euros(s.sales?.last_30_days?.revenue_cents ?? 0) : '…'}
                nota={s ? `${s.sales?.last_30_days?.sales ?? 0} ventas` : undefined}
                href="/dash/estadisticas"
              />
              <Cifra
                etiqueta="Alumnos activos"
                valor={s ? String(s.students?.active_30d ?? 0) : '…'}
                nota={s ? `de ${s.students?.total ?? 0}, últimos 30 días` : undefined}
                href="/dash/estadisticas?tab=progreso"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Lo que toca hoy: cada cosa con su botón. */}
          <div className={`${CARD} lg:col-span-3`}>
            <Titulo>Lo que toca hoy</Titulo>
            {tablero === null && tareas === null ? (
              <p className="text-[13px] text-gray-400">Cargando…</p>
            ) : toca.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#F0FDF4] px-3.5 py-3 text-[13.5px] text-[#15803D]">
                <CheckCircle size={20} weight="fill" className="shrink-0" />
                Nada urgente por ahora. Todo al día.
              </div>
            ) : (
              <div className="-mx-1 space-y-0.5">{toca}</div>
            )}
          </div>

          {/* Mis tareas: lo que me toca, sin ir a otra pantalla. */}
          <div className={`${CARD} lg:col-span-2`}>
            <Titulo extra={<VerTodo href="/dash/estadisticas?tab=tareas">Todas</VerTodo>}>Mis tareas</Titulo>
            <TareaForm compacto onCreada={(t) => setTareas((ts) => [t, ...(ts ?? [])])} />
            {tareas === null ? (
              <p className="text-[13px] text-gray-400 mt-2">Cargando…</p>
            ) : misTareas.length === 0 ? (
              <p className="text-[13px] text-gray-500 mt-3 inline-flex items-center gap-1.5">
                <Sparkle size={14} className="text-[#4da3ff]" weight="fill" /> No tienes nada pendiente.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-[#EEF2FA]">
                {misTareas.slice(0, 5).map((t) => (
                  <FilaTarea
                    key={t.id}
                    tarea={t}
                    onCambio={(n) => setTareas((ts) => (ts ?? []).map((x) => (x.id === n.id ? n : x)))}
                    onBorrada={(id) => setTareas((ts) => (ts ?? []).filter((x) => x.id !== id))}
                    onAbrirPersona={setAbierta}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* El tablero de matrículas de un vistazo, con los colores del tablero. */}
        <div className={CARD}>
          <Titulo extra={<VerTodo href="/dash/estadisticas?tab=matriculas">Abrir el tablero</VerTodo>}>Matrículas</Titulo>
          {tablero === null ? (
            <p className="text-[13px] text-gray-400">Cargando…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {columnas.map((c) => (
                <Link
                  key={c.id}
                  href="/dash/estadisticas?tab=matriculas"
                  className="rounded-xl border border-[#E8EDF7] bg-[#FAFBFF] hover:border-[#B9CBEA] hover:bg-white px-3 py-2.5 transition-colors"
                >
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5A6480] truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR_COLUMNA[c.id] || '#94A3B8' }} />
                    <span className="truncate">{c.nombre}</span>
                  </p>
                  <p className="text-[22px] font-semibold tabular-nums leading-tight text-[#0a1656] mt-0.5">{c.n}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Anuncios: qué está trayendo cada campaña. Solo si hay alguna. */}
        {ads && ads.campanas.length ? (
          <div className={CARD}>
            <Titulo extra={<VerTodo href="/dash/estadisticas?tab=anuncios" />}>Anuncios</Titulo>
            <ul className="divide-y divide-[#EEF2FA]">
              {[...ads.campanas]
                .sort((a, b) => b.leads - a.leads)
                .slice(0, 4)
                .map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center gap-3">
                    <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-gray-900 truncate">{c.nombre}</span>
                    <span className="text-[12.5px] text-gray-500 tabular-nums">
                      {c.leads} {c.leads === 1 ? 'lead' : 'leads'} · {c.ventas} {c.ventas === 1 ? 'venta' : 'ventas'}
                    </span>
                    <span className="w-24 text-right text-[12.5px] font-semibold tabular-nums text-[#1D0084]">
                      {c.coste_por_lead_cents !== null ? `${eurosPanel(c.coste_por_lead_cents)}/lead` : '—'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        <div className={CARD}>
          <Titulo extra={<VerTodo href={isCloser ? '/dash/estadisticas?tab=matriculas' : '/dash/estadisticas?tab=contactos'} />}>
            {isCloser ? 'Últimas matrículas' : 'Últimos contactos'}
          </Titulo>
          {contactos === null ? (
            <p className="text-[13px] text-gray-400">Cargando…</p>
          ) : ultimos.length === 0 ? (
            <p className="text-[13px] text-gray-500">Todavía no hay contactos.</p>
          ) : (
            <ul className="divide-y divide-[#EEF2FA]">
              {ultimos.map((c) => (
                <li key={c.email} className="py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#F8FAFF] -mx-2 px-2 rounded-lg" onClick={() => setAbierta(c.email)}>
                  <span className="w-8 h-8 rounded-full bg-[#EEF3FF] text-[#025dc7] text-[12px] font-bold flex items-center justify-center shrink-0 uppercase">
                    {(c.nombre || c.email || '?').trim().charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.nombre || c.email}</p>
                    <p className="text-[12px] text-gray-500 truncate">
                      {c.ultimo_contacto.que}
                      {c.utm_campaign ? ` · ${c.utm_campaign}` : ''}
                    </p>
                  </div>
                  {/* La misma etapa que en Contactos (antes decía "Lead" a quien ya
                      había pedido plaza). */}
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4B5563]">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          c.etapa === 'alumno' ? '#16A34A' : c.etapa === 'en-pago' ? '#D97706' : c.etapa === 'pidio' ? '#2563EB' : '#9CA3AF',
                      }}
                    />
                    {ETAPA_TEXTO[c.etapa] || 'Lead'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
