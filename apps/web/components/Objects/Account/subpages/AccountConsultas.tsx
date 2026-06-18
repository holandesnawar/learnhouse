'use client'

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { listMyConsultas, htmlToText, type Consulta, CATEGORY_BY_ID } from '@/lib/consultas/consultas'
import { HelpCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]}, ${d.getFullYear()}`
}

export default function AccountConsultas() {
  const session = useLHSession() as any
  const email: string | undefined = session?.data?.user?.email
  const [items, setItems] = useState<Consulta[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!email) {
      setItems([])
      return
    }
    let active = true
    listMyConsultas(email)
      .then((d) => active && setItems(d))
      .catch(() => active && setItems([]))
    return () => {
      active = false
    }
  }, [email])

  return (
    <div className="bg-white rounded-xl nice-shadow">
      <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 mx-3 my-3 rounded-md">
        <h1 className="font-bold text-xl text-gray-800">Mis consultas</h1>
        <h2 className="text-gray-500 text-md">Tus preguntas y el estado de cada una.</h2>
      </div>

      <div className="mx-5 mb-5 min-h-[200px]">
      {items === null ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-[#DDE6F5] bg-white">
          <div className="p-3 bg-[#F0F5FF] rounded-full mb-3">
            <HelpCircle size={26} className="text-[#025dc7]" />
          </div>
          <p className="text-sm text-gray-500 max-w-xs">
            Aún no has creado ninguna consulta. Cuando tengas una duda, créala desde una lección o desde la sección de Consultas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const cat = CATEGORY_BY_ID[c.category]
            const answer = c.respuesta_nawar ? htmlToText(c.respuesta_nawar) : ''
            const isOpen = openId === c.id
            return (
              <div key={c.id} className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  className="w-full text-left p-4 sm:p-5 hover:bg-[#F0F5FF]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {cat && (
                          <span className="text-[10px] text-[#025dc7] font-semibold uppercase tracking-wider">{cat.short}</span>
                        )}
                        <span className="text-[11px] text-gray-400">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-[15px] font-semibold text-gray-900 leading-snug">{c.title}</p>
                    </div>
                    {c.resolved ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
                        <CheckCircle2 size={13} /> Respondida
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold uppercase tracking-wider">
                        <Clock size={13} /> Pendiente
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1 space-y-3">
                    {/* Tu pregunta */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tu pregunta</p>
                      <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">
                        {htmlToText(c.content)}
                      </p>
                    </div>
                    {/* Respuesta */}
                    {c.resolved && answer ? (
                      <div className="rounded-xl bg-[#F0F5FF] border-l-2 border-[#4da3ff] px-3.5 py-3">
                        <p className="text-[11px] font-bold text-[#025dc7] uppercase tracking-wider mb-1">Respuesta de Team Nawar</p>
                        <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-line">{answer}</p>
                      </div>
                    ) : (
                      <p className="text-[13px] text-gray-400 italic">Aún no la hemos respondido. Te avisaremos por email cuando lo hagamos.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
