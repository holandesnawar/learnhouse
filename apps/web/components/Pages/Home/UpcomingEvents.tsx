'use client'
import React, { useMemo } from 'react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { CalendarDays, Clock, ArrowRight } from 'lucide-react'
import { CalendarBlank } from '@phosphor-icons/react'
import { useMisGrupos } from '@/hooks/queries/useMisGrupos'
import { eventoParaMi } from '@/lib/nawar/eventosGrupo'

interface LhEvent {
  id: string
  title: string
  date: string
  time?: string
  link?: string
  grupos?: number[]
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function readEvents(org: any): LhEvent[] {
  const e = org?.config?.config?.customization?.events || org?.config?.config?.events
  return Array.isArray(e?.events) ? e.events : []
}

export default function UpcomingEvents({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const todayStr = dayjs().format('YYYY-MM-DD')
  // Solo los de su grupo (25/10/2026): a los nuevos no se les anuncia la
  // clase semanal de la beta.
  const { data: yo } = useMisGrupos()

  const upcoming = useMemo(() => {
    return readEvents(org)
      .filter((e) => eventoParaMi(e, yo))
      .filter((e) => e?.date && e.date >= todayStr)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 4) // los cuatro siguientes: el Inicio no es el calendario
  }, [org, todayStr, yo])

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return (
    <div className="rounded-2xl border border-[#E4E8F2] bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14.5px] font-semibold text-[#0B1033]">Próximos eventos</h2>
        <Link href={getUriWithOrg(orgslug, '/calendario')} className="text-[12.5px] font-semibold text-[#0b2da0] hover:underline">
          Calendario
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="px-4 pb-4 text-[13.5px] text-[#8A91AD]">No hay eventos próximos por ahora.</p>
      ) : (
        <ul className="pb-2">
          {upcoming.map((ev) => {
            const d = dayjs(ev.date)
            const dentro = (
              <>
                <span className="shrink-0 w-11 text-center">
                  <span className="block text-[11px] font-semibold text-[#0b2da0] uppercase leading-none">{MONTHS_SHORT[d.month()]}</span>
                  <span className="block text-[19px] font-semibold text-[#0B1033] leading-tight">{d.date()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-[#0B1033] leading-snug line-clamp-2">{ev.title}</span>
                  <span className="block text-[12.5px] text-[#8A91AD]">
                    {DIAS[d.day()]}
                    {ev.time ? ` · ${ev.time}` : ''}
                  </span>
                </span>
              </>
            )
            const cls = 'flex items-center gap-3 px-4 py-2.5 hover:bg-[#F7F9FD]'
            return ev.link ? (
              <li key={ev.id}>
                <a href={ev.link} target="_blank" rel="noopener noreferrer" className={cls}>
                  {dentro}
                </a>
              </li>
            ) : (
              <li key={ev.id}>
                <Link href={getUriWithOrg(orgslug, '/calendario')} className={cls}>
                  {dentro}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
