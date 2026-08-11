'use client'

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  listMyConsultas,
  htmlToText,
  catClasses,
  formatConsultaDate,
  CATEGORY_BY_ID,
  TEAM_LOGO,
  type Consulta,
} from '@/lib/consultas/consultas'
import {
  HelpCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircleQuestion,
  ChevronDown,
} from 'lucide-react'

/**
 * "Mis consultas" — las preguntas del alumno y su estado.
 *
 * Usa la misma piel que el tablón de Consultas (tarjetas blancas con sombra,
 * etiquetas de categoría, respuesta firmada por Team Nawar con su foto) para
 * que no parezcan dos aplicaciones distintas. Lo que cambia es el formato:
 * aquí la consulta se despliega en su sitio, sin abrir una ventana encima.
 */
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
    <div className="space-y-5">
      <div className="flex items-center gap-2 pt-2">
        <MessageCircleQuestion size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mis consultas</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-3 max-w-xl">
        Tus preguntas y el estado de cada una. Pulsa una para ver la respuesta.
      </p>

      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl bg-white nice-shadow">
          <HelpCircle size={30} className="text-[#025dc7] mb-3" />
          <p className="text-sm text-gray-500 max-w-xs">
            Aún no has creado ninguna consulta. Cuando tengas una duda, créala
            desde una lección o desde la sección de Consultas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const cat = CATEGORY_BY_ID[c.category]
            const answer = c.respuesta_nawar ? htmlToText(c.respuesta_nawar) : ''
            const isOpen = openId === c.id
            return (
              <div
                key={c.id}
                className={`rounded-2xl bg-white nice-shadow border transition-all ${
                  isOpen ? 'border-[#4da3ff]/40' : 'border-transparent hover:border-[#4da3ff]/40'
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  className="w-full text-left p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${catClasses(cat?.color)}`}
                    >
                      {cat?.name || c.category || 'General'}
                    </span>
                    {c.resolved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4da3ff]/12 text-[#025dc7]">
                        <CheckCircle2 size={12} /> Respondida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                        <Clock size={12} /> Pendiente
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`ml-auto shrink-0 text-gray-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  <p className="text-[15px] font-bold text-gray-900 leading-snug">{c.title}</p>
                  {!isOpen && (
                    <p className="text-[13px] text-gray-500 leading-snug mt-1 line-clamp-2">
                      {htmlToText(c.content)}
                    </p>
                  )}
                  <p className="text-[12px] text-gray-400 mt-2">
                    {formatConsultaDate(c.created_at)}
                  </p>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 -mt-1">
                    <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {htmlToText(c.content)}
                    </p>

                    {c.resolved && answer ? (
                      <div className="mt-6 flex gap-3 items-start">
                        <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-[#1D0084] ring-2 ring-[#F0F5FF]">
                          {/* El logo es un cuadrado redondeado: dentro del
                              círculo asomaban las esquinas del fondo. Un zoom
                              leve lo hace llenarlo sin recortar la marca. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={TEAM_LOGO}
                            alt="Team Nawar"
                            className="absolute inset-0 w-full h-full object-cover object-center scale-[1.22]"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="font-bold text-gray-900 text-[15px]">Team Nawar</span>
                            <CheckCircle2 size={15} className="text-[#025dc7]" />
                          </div>
                          <div className="p-4 rounded-2xl rounded-tl-md bg-[#F0F5FF] border border-[#DDE6F5]">
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                              {answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex items-center gap-2 text-[13px] text-gray-500 bg-[#F7F9FD] rounded-xl px-3.5 py-3">
                        <Clock size={15} className="text-amber-500 shrink-0" />
                        Todavía no la hemos respondido. Te avisamos por email en
                        cuanto lo hagamos.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
