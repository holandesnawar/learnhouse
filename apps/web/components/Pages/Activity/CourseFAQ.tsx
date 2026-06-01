'use client'
import React, { useState } from 'react'
import { ChevronDown, Video } from 'lucide-react'

interface FAQ {
  q: string
  a: string
}

// Per-course static FAQ blocks. Keyed by course_uuid. Anything not in the map
// renders nothing — only the specific courses we want to "introduce" with a
// FAQ get one. Future-proof: when we want admin-edited FAQs, swap this for
// `course.extra_metadata.faq` and surface an editor.
const COURSE_FAQS: Record<string, { intro?: string; items: FAQ[] }> = {
  'bfbcb42b-7dc3-4448-9df8-5d7b96135859': {
    intro:
      'Cada semana nos vemos en directo para repasar la formación, resolver tus dudas y practicar hablando holandés. Si no puedes asistir, la clase queda grabada aquí para siempre.',
    items: [
      {
        q: '¿Cuándo es la clase en directo?',
        a: 'La clase es semanal. Te avisamos por email cada lunes con el día y la hora exactos, y también aparece en la sección de Eventos de la plataforma.',
      },
      {
        q: '¿Y si no puedo asistir?',
        a: 'Sin problema. Todas las clases se graban y aparecen aquí abajo. Tendrás acceso a ellas para siempre.',
      },
      {
        q: '¿Dónde se hace?',
        a: 'En directo por videollamada. El enlace lo recibes por email un par de horas antes y también aparece en el evento de Eventos.',
      },
      {
        q: '¿Qué pasa en cada clase?',
        a: 'Repasamos lecciones de la formación, resolvemos vuestras dudas en directo y practicamos hablando en holandés. Tú decides el ritmo: trae tus preguntas o disfruta del repaso.',
      },
      {
        q: '¿Puedo enviar mi duda antes para que la resolvamos en directo?',
        a: 'Sí. Abre una consulta desde cualquier lección o desde "Consultas" en el menú. Las preguntas más votadas las cubrimos en la siguiente clase.',
      },
      {
        q: '¿Hay material para descargar?',
        a: 'Cuando una clase tiene fichas o ejercicios, te los dejamos enlazados desde la actividad del curso. Puedes volver cuando quieras.',
      },
    ],
  },
}

export default function CourseFAQ({ courseUuid }: { courseUuid: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const data = COURSE_FAQS[courseUuid]
  if (!data) return null

  return (
    <div className="my-6">
      <div className="flex items-center gap-2 mb-3">
        <Video size={20} className="text-[#025dc7]" />
        <h2 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
          Preguntas frecuentes
        </h2>
      </div>
      {data.intro && (
        <p className="text-[14px] sm:text-[15px] text-gray-600 leading-relaxed mb-4 max-w-2xl">
          {data.intro}
        </p>
      )}
      <div className="bg-white rounded-2xl nice-shadow overflow-hidden border border-[#DDE6F5] divide-y divide-[#DDE6F5]">
        {data.items.map((faq, i) => {
          const open = openIdx === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-[#F0F5FF]/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] sm:text-[15px] font-bold text-gray-900 leading-snug">
                  {faq.q}
                </p>
                {open && (
                  <p className="text-[13px] sm:text-[14px] text-gray-600 leading-relaxed mt-2 whitespace-pre-line">
                    {faq.a}
                  </p>
                )}
              </div>
              <ChevronDown
                size={18}
                className={`shrink-0 mt-1 text-[#025dc7] transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
