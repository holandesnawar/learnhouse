'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { listAllHighlights, HIGHLIGHT_COLORS, type LessonHighlight } from '@services/student/highlights'
import { NotePencil } from '@phosphor-icons/react'
import { Loader2, ArrowRight, StickyNote } from 'lucide-react'

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]}, ${d.getFullYear()}`
}

export default function MyNotesBoard({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const [items, setItems] = useState<LessonHighlight[] | null>(null)

  useEffect(() => {
    if (!accessToken) { setItems([]); return }
    let active = true
    listAllHighlights(accessToken).then((d) => active && setItems(d))
    return () => { active = false }
  }, [accessToken])

  // Group by lesson (activity_uuid), preserving recency order.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; courseUuid: string; activityUuid: string; rows: LessonHighlight[] }>()
    for (const h of items ?? []) {
      const key = h.activity_uuid || 'sin-leccion'
      if (!map.has(key)) {
        map.set(key, { name: h.activity_name || 'Lección', courseUuid: h.course_uuid, activityUuid: h.activity_uuid, rows: [] })
      }
      map.get(key)!.rows.push(h)
    }
    return Array.from(map.values())
  }, [items])

  const lessonHref = (courseUuid: string, activityUuid: string) =>
    courseUuid && activityUuid
      ? getUriWithOrg(orgslug, `/course/${courseUuid}/activity/${activityUuid.replace('activity_', '')}`)
      : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pt-2">
        <NotePencil size={24} weight="fill" className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mis notas</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-3 max-w-xl">
        Todo lo que has resaltado y anotado en las lecciones, en un solo sitio.
      </p>

      {items === null ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-[#DDE6F5] bg-white">
          <StickyNote size={30} className="text-[#025dc7] mb-3" />
          <p className="text-sm text-gray-500 max-w-sm">
            Aún no has resaltado nada. Dentro de una lección, selecciona un texto y elige un color o añade una nota; aquí aparecerá todo guardado.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const href = lessonHref(g.courseUuid, g.activityUuid)
            return (
              <div key={g.activityUuid} className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#DDE6F5] bg-[#F0F5FF]/50">
                  <h2 className="text-[15px] font-bold text-gray-900 truncate">{g.name}</h2>
                  {href && (
                    <Link href={href} className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#025dc7] hover:underline">
                      Ir a la lección <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <div className="divide-y divide-[#F0F5FF]">
                  {g.rows.map((h) => (
                    <div key={h.id} className="px-4 sm:px-5 py-3">
                      <p className="text-[14px] text-gray-800 leading-relaxed">
                        <span style={{ backgroundColor: HIGHLIGHT_COLORS[h.color]?.bg, borderRadius: 3, padding: '0 3px' }}>
                          {h.quote}
                        </span>
                      </p>
                      {h.note && h.note.trim() && (
                        <div className="mt-2 flex items-start gap-2">
                          <StickyNote size={14} className="text-[#025dc7] mt-0.5 shrink-0" />
                          <p className="text-[13.5px] text-gray-600 leading-relaxed whitespace-pre-line">{h.note}</p>
                        </div>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5">{fmtDate(h.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
