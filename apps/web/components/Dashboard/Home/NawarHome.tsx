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
import { AddressBook, ArrowRight, BookOpen, ChartBar, EnvelopeSimple, FolderSimple, Globe, PhoneCall, Question, Receipt, UsersThree, Wallet } from '@phosphor-icons/react'

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

  useEffect(() => {
    if (!org?.id || !token) return
    getSchoolStats(org.id, token).then((s) => setStats(s ?? 'error'))
    getContactos(org.id, '', token).then((r) => setContactos(r?.contactos ?? []))
  }, [org?.id, token])

  const s = stats && stats !== 'error' ? stats : null
  const mesActual = s?.sales?.by_month?.[s.sales.by_month.length - 1]
  const porAtender = (s?.requests ?? []).filter((r: any) => !r.contacted_at).length + (s?.sales?.funnel?.pending ?? []).filter((p) => !p.ya_alumno).length
  const ultimos = (contactos ?? []).slice(0, 6)
  const nombre = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  const accesos = [
    { href: '/dash/estadisticas?tab=contactos', label: 'Contactos', que: 'Quién es cada lead y qué ha visto', icon: <AddressBook size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=llamadas', label: 'Llamadas', que: 'Quién pidió llamada y qué contestó', icon: <PhoneCall size={20} weight="fill" /> },
    { href: '/dash/estadisticas', label: 'Estadísticas', que: 'Ventas, embudo, alumnos', icon: <ChartBar size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=facturas', label: 'Facturas', que: 'Cobros y facturas de Stripe', icon: <Receipt size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=gastos', label: 'Gastos', que: 'Lo que gastas, el margen y el coste por matrícula', icon: <Wallet size={20} weight="fill" /> },
    { href: '/dash/consultas', label: 'Consultas', que: 'Dudas de los alumnos', icon: <Question size={20} weight="fill" /> },
    { href: '/dash/avisos', label: 'Avisos y correos', que: 'Escribir a los alumnos', icon: <EnvelopeSimple size={20} weight="fill" /> },
    { href: '/dash/courses', label: 'Cursos', que: 'La formación y la clase semanal', icon: <BookOpen size={20} weight="fill" /> },
    { href: '/dash/recursos', label: 'Recursos y documentos', que: 'Archivos y enlaces, tuyos y de los alumnos', icon: <FolderSimple size={20} weight="fill" /> },
    { href: '/dash/estadisticas?tab=paginas', label: 'Páginas de la web', que: 'Por dónde llega la gente y qué ha visto', icon: <Globe size={20} weight="fill" /> },
    { href: '/dash/users/settings/usergroups', label: 'Equipo y grupos', que: 'Profes, closers, alumnos', icon: <UsersThree size={20} weight="fill" /> },
  ].filter((a) => !isCloser || a.label === 'Contactos' || a.label === 'Estadísticas')

  return (
    <div className="h-full w-full bg-[#F7F8FB] px-4 sm:px-9 py-6 sm:py-9 pb-24 lg:pb-10">
      <div className="max-w-[1200px] mx-auto space-y-5 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {saludo}{nombre ? `, ${nombre}` : ''}.
          </h1>
          <p className="text-[14px] text-gray-500 mt-1">Así va la escuela hoy.</p>
        </div>

        {stats === 'error' ? (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`${CARD} lg:col-span-2`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-gray-900">Últimos contactos</h2>
              <Link href="/dash/estadisticas?tab=contactos" className="text-[13px] font-semibold text-[#025dc7] inline-flex items-center gap-1">
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
                  <li key={c.email} className="py-2.5 flex items-center gap-3">
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
    </div>
  )
}
