'use client'
import React, { useMemo } from 'react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { CalendarDays, Clock, ArrowRight } from 'lucide-react'
import { CalendarBlank } from '@phosphor-icons/react'

interface LhEvent {
  id: string
  title: string
  date: string
  time?: string
  link?: string
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function readEvents(org: any): LhEvent[] {
  const e = org?.config?.config?.customization?.events || org?.config?.config?.events
  return Array.isArray(e?.events) ? e.events : []
}

export default function UpcomingEvents({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const todayStr = dayjs().format('YYYY-MM-DD')

  const upcoming = useMemo(() => {
    return readEvents(org)
      .filter((e) => e?.date && e.date >= todayStr)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 2) // solo los dos siguientes: el Inicio no es el calendario
  }, [org, todayStr])

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarBlank size={20} weight="fill" className="text-[#025dc7]" />
          <h2 className="text-lg font-bold text-gray-900">Próximos eventos</h2>
        </div>
        <Link
          href={getUriWithOrg(orgslug, '/calendario')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#025dc7] hover:underline"
        >
          Ver calendario <ArrowRight size={14} />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex items-center gap-3 py-5 px-5 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/30">
          <CalendarDays size={22} className="text-gray-300 shrink-0" />
          <p className="text-sm text-gray-400">No hay eventos próximos por ahora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {upcoming.map((ev) => {
            const d = dayjs(ev.date)
            const card = (
              <>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-12 text-center">
                    <div className="text-[11px] font-semibold text-[#025dc7] uppercase">{MONTHS_SHORT[d.month()]}</div>
                    <div className="text-xl font-bold text-gray-900 leading-none">{d.date()}</div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{ev.title}</h3>
                    {ev.time && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} /> {ev.time}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )
            return ev.link ? (
              <a
                key={ev.id}
                href={ev.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-white/5 nice-shadow rounded-2xl p-4 border border-transparent dark:border-white/10 hover:border-[#4da3ff]/40 transition-all"
              >
                {card}
              </a>
            ) : (
              <Link
                key={ev.id}
                href={getUriWithOrg(orgslug, '/calendario')}
                className="bg-white dark:bg-white/5 nice-shadow rounded-2xl p-4 border border-transparent dark:border-white/10 hover:border-[#4da3ff]/40 transition-all"
              >
                {card}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
