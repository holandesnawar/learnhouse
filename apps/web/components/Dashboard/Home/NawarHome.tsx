'use client'

/**
 * La portada del panel: el negocio de un vistazo, y de ahí a lo que toca.
 *
 * Sustituye a DashboardHome, la de LearnHouse (bienvenida, "crear curso",
 * uso del plan, cursos recientes…): pensada para quien monta cursos, no
 * para quien lleva una escuela. Aquí: ventas de este mes, quién espera que
 * le escribas, alumnos activos y accesos a lo que se usa cada día.
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
import { AddressBook, ArrowRight, BookOpen, ChartBar, EnvelopeSimple, FolderSimple, Globe, Kanban, ListChecks, Megaphone, PhoneCall, Question, Receipt, UserCheck, UsersThree, Wallet } from '@phosphor-icons/react'
import { euros as eurosPanel, getAds, getTablero, getTareas, type PanelAds, type Tablero, type Tarea } from '@services/panel/panel'
import { hoyISO } from '@services/stats/contactos'
import FichaCliente from '@components/Dashboard/Pages/Panel/FichaCliente'
import { FilaTarea, TareaForm } from '@components/Dashboard/Pages/Panel/Tareas'

const CARD = 'rounded-2xl border border-[#E6EBF5] bg-white p-4 sm:p-5'

function Cifra({ etiqueta, valor, nota, href }: { etiqueta: string; valor: string; nota?: string; href?: string }) {
  const inner = (
    <div className={`${CARD} h-full`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{etiqueta}</p>
      <p className="text-[26px] sm:text-[30px] font-semibold text-[#1D0084] tabular-nums leading-tight mt-1">{valor}</p>
      {nota ? <p className="text-[12.5px] text-gray-500 mt-1">{nota}</p> : null}
    </div>
  )
  return href ? <Link href={href} className="block hover:-translate-y-0.5 transition-transform">{inner}</Link> : inner
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

  useEffect(() => {
    if (!org?.id || !token) return
    // El closer no ve los números: no se le piden (darían 403).
    if (!isCloser) getSchoolStats(org.id, token).then((s) => setStats(s ?? 'error'))
    if (!isCloser) getAds(org.id, token).then((r) => setAds(r.ok && r.datos ? r.datos : null))
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
  const columnas = (tablero?.etapas ?? []).map((e) => ({
    ...e,
    n: (tablero?.tarjetas ?? []).filter((t) => t.etapa === e.id && !t.oculto).length,
  }))

  const s = stats && stats !== 'error' ? stats : null
  const mesActual = s?.sales?.by_month?.[s.sales.by_month.length - 1]
  const porAtender = (s?.requests ?? []).filter((r: any) => !r.contacted_at).length + (s?.sales?.funnel?.pending ?? []).filter((p) => !p.ya_alumno).length
  const ultimos = (contactos ?? []).slice(0, 6)
  const nombre = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  const accesos = [
    { href: '/dash/estadisticas?tab=matriculas', label: 'Matrículas', que: 'En qué punto está cada persona', icon: <Kanban size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=tareas', label: 'Tareas', que: 'Lo tuyo y lo del equipo', icon: <ListChecks size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=contactos', label: 'Contactos', que: 'Quién es cada lead y qué ha visto', icon: <AddressBook size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=llamadas', label: 'Llamadas', que: 'Quién pidió llamada y qué contestó', icon: <PhoneCall size={20} weight="fill" /> },
    { href: '/dash/estadisticas', label: 'Estadísticas', que: 'Ventas, embudo, alumnos', icon: <ChartBar size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=clientes', label: 'Clientes', que: 'Quién ha pagado y si sigue entrando', icon: <UserCheck size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=anuncios', label: 'Anuncios', que: 'Qué trae cada campaña y cuánto cuesta', icon: <Megaphone size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=facturas', label: 'Facturas', que: 'Cobros y facturas de Stripe', icon: <Receipt size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=gastos', label: 'Gastos', que: 'Lo que gastas, el margen y el coste por matrícula', icon: <Wallet size={20} weight="fill" /> },
    { href: '/dash/consultas', label: 'Consultas', que: 'Dudas de los alumnos', icon: <Question size={20} weight="fill" /> },
    { href: '/dash/avisos', label: 'Avisos y correos', que: 'Escribir a los alumnos', icon: <EnvelopeSimple size={20} weight="fill" /> },
    { href: '/dash/courses', label: 'Cursos', que: 'La formación y la clase semanal', icon: <BookOpen size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=recursos', label: 'Recursos', que: 'Archivos y enlaces, tuyos y de los alumnos', icon: <FolderSimple size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=paginas', label: 'Páginas de la web', que: 'Por dónde llega la gente y qué ha visto', icon: <Globe size={20} weight="fill" /> },
    { href: '/dash/users/settings/usergroups', label: 'Equipo y grupos', que: 'Profes, closers, alumnos', icon: <UsersThree size={20} weight="fill" /> },
  ]
    // Lo de cada día: el resto está en la barra de la izquierda y repetirlo
    // aquí entero era una segunda barra.
    .filter((a) =>
      isCloser
        ? ['Matrículas', 'Llamadas', 'Tareas', 'Páginas de la web'].includes(a.label)
        : ['Matrículas', 'Tareas', 'Clientes', 'Anuncios', 'Gastos', 'Consultas', 'Avisos y correos'].includes(a.label)
    )

  return (
    <div className="h-full w-full bg-[#F7F8FB] px-4 sm:px-9 py-6 sm:py-9 pb-24 lg:pb-10">
      <div className="max-w-[1200px] mx-auto space-y-5 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {saludo}{nombre ? `, ${nombre}` : ''}.
          </h1>
          <p className="text-[14px] text-gray-500 mt-1">Así va la escuela hoy.</p>
        </div>

        {isCloser ? null : stats === 'error' ? (
          <div className={CARD}>
            <p className="text-[13.5px] text-gray-700">No se han podido cargar los números. Prueba a recargar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cifra
              etiqueta="Por atender"
              valor={s ? String(porAtender) : '…'}
              nota="Pidieron plaza o dejaron el pago a medias"
              href="/dash/estadisticas?tab=contactos"
            />
            <Cifra
              etiqueta="Ventas este mes"
              valor={s ? String(mesActual?.sales ?? 0) : '…'}
              nota={s && mesActual ? euros(mesActual.revenue_cents) : undefined}
              href="/dash/estadisticas"
            />
            <Cifra
              etiqueta="Últimos 30 días"
              valor={s ? euros(s.sales?.last_30_days?.revenue_cents ?? 0) : '…'}
              nota={s ? `${s.sales?.last_30_days?.sales ?? 0} ventas` : undefined}
              href="/dash/estadisticas"
            />
            <Cifra
              etiqueta="Alumnos activos"
              valor={s ? String(s.students?.active_30d ?? 0) : '…'}
              nota={s ? `de ${s.students?.total ?? 0}, en los últimos 30 días` : undefined}
              href="/dash/estadisticas"
            />
          </div>
        )}

        {/* El tablero de matrículas de un vistazo: cada columna lleva a él. */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-gray-900">Matrículas</h2>
            <Link href="/dash/estadisticas?tab=matriculas" className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
              Abrir el tablero <ArrowRight size={14} />
            </Link>
          </div>
          {tablero === null ? (
            <p className="text-[13px] text-gray-400">Cargando…</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {columnas.map((c) => (
                <Link
                  key={c.id}
                  href="/dash/estadisticas?tab=matriculas"
                  className="rounded-xl bg-[#F5F7FB] hover:bg-[#EAF3FF] px-3 py-2.5 transition-colors"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 truncate">{c.nombre}</p>
                  <p className={`text-[22px] font-semibold tabular-nums leading-tight ${c.id === 'alumno' ? 'text-[#0E9F6E]' : c.id === 'perdido' ? 'text-gray-400' : 'text-[#1D0084]'}`}>
                    {c.n}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mis tareas: lo que me toca hoy, sin ir a otra pantalla. */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[15px] font-bold text-gray-900">
              Mis tareas
              {urgentes ? <span className="ml-2 rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[11.5px] font-semibold">{urgentes} para hoy o vencidas</span> : null}
            </h2>
            <Link href="/dash/estadisticas?tab=tareas" className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
              Todas <ArrowRight size={14} />
            </Link>
          </div>
          <TareaForm compacto onCreada={(t) => setTareas((ts) => [t, ...(ts ?? [])])} />
          {tareas === null ? (
            <p className="text-[13px] text-gray-400 mt-2">Cargando…</p>
          ) : misTareas.length === 0 ? (
            <p className="text-[13px] text-gray-500 mt-3">No tienes nada pendiente.</p>
          ) : (
            <div className="mt-1 divide-y divide-[#EEF2FA]">
              {misTareas.slice(0, 6).map((t) => (
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

        {/* Anuncios: qué está trayendo cada campaña. Solo si hay alguna. */}
        {ads && ads.campanas.length ? (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-gray-900">Anuncios</h2>
              <Link href="/dash/estadisticas?tab=anuncios" className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`${CARD} lg:col-span-2`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-gray-900">{isCloser ? 'Últimas matrículas' : 'Últimos contactos'}</h2>
              <Link href={isCloser ? '/dash/estadisticas?tab=matriculas' : '/dash/estadisticas?tab=contactos'} className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
            {contactos === null ? (
              <p className="text-[13px] text-gray-400">Cargando…</p>
            ) : ultimos.length === 0 ? (
              <p className="text-[13px] text-gray-500">Todavía no hay contactos.</p>
            ) : (
              <ul className="divide-y divide-[#EEF2FA]">
                {ultimos.map((c) => (
                  <li key={c.email} className="py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#F8FAFF] -mx-2 px-2 rounded-lg" onClick={() => setAbierta(c.email)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.nombre || c.email}</p>
                      <p className="text-[12px] text-gray-500 truncate">
                        {c.ultimo_contacto.que}
                        {c.utm_campaign ? ` · ${c.utm_campaign}` : ''}
                      </p>
                    </div>
                    {/* La misma etapa que en Contactos (antes decía "Lead" a quien ya
                        había pedido plaza). */}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.etapa === 'alumno'
                          ? 'bg-[#E8FBF3] text-[#0E9F6E]'
                          : c.etapa === 'en-pago'
                            ? 'bg-[#FFFBF2] text-[#8A6A2A]'
                            : c.etapa === 'pidio'
                              ? 'bg-[#EAF3FF] text-[#025dc7]'
                              : 'bg-[#F3F4F6] text-[#5A6480]'
                      }`}
                    >
                      {ETAPA_TEXTO[c.etapa] || 'Lead'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <h2 className="text-[15px] font-bold text-gray-900 mb-3">Ir a</h2>
            <ul className="space-y-1">
              {accesos.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-[#F5F7FB] transition-colors">
                    <span className="w-9 h-9 rounded-lg bg-[#EEF3FF] text-[#025dc7] flex items-center justify-center shrink-0">{a.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-gray-900">{a.label}</span>
                      <span className="block text-[12px] text-gray-500 truncate">{a.que}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {abierta ? <FichaCliente email={abierta} onClose={() => setAbierta(null)} /> : null}
    </div>
  )
}
