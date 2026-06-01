'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Video } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'

// UUID of the course where the recorded live classes live (created by the
// user in the academy admin). Anyone clicking "Ver clases grabadas" lands
// here, where each class is an activity inside a chapter.
const CLASES_COURSE_UUID = 'bfbcb42b-7dc3-4448-9df8-5d7b96135859'

interface FAQ {
  q: string
  a: string
}

// FAQs hardcoded for v1. If we ever want to make them editable from admin,
// move them to org_config like the community info panel does.
const FAQS: FAQ[] = [
  {
    q: '¿Cuándo es la clase en directo?',
    a: 'La clase es semanal. Te avisamos por email cada lunes con el día y la hora exactos, y también aparece en la sección de Eventos de la plataforma.',
  },
  {
    q: '¿Y si no puedo asistir?',
    a: 'Sin problema. Todas las clases se graban y suben aquí mismo. Tendrás acceso a ellas para siempre — pulsa "Ver clases grabadas" abajo.',
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
]

export default function ClaseSemanalClient({ orgslug }: { orgslug: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const courseHref = getUriWithOrg(orgslug, `/course/${CLASES_COURSE_UUID}`)

  return (
    <GeneralWrapperStyled>
      {/* Hero — same Nawar dark gradient we use on auth pages */}
      <div
        className="relative w-full overflow-hidden rounded-2xl text-white"
        style={{
          backgroundColor: '#1D0084',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
            'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
            'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
          backgroundSize: '28px 28px, auto, auto',
          backgroundRepeat: 'repeat, no-repeat, no-repeat',
        }}
      >
        <div className="px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-start gap-4 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-white/85">
            <Video size={12} /> Encuentros semanales
          </span>
          <h1
            className="font-bold leading-[1.1]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(28px, 5vw, 44px)',
              letterSpacing: '-0.02em',
            }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.72) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Tu clase semanal
            </span>{' '}
            <span style={{ color: '#4da3ff' }}>en directo</span>
          </h1>
          <p className="text-[15px] sm:text-[16px] text-white/75 leading-relaxed max-w-xl">
            Cada semana nos vemos en directo para repasar la formación,
            resolver tus dudas y practicar hablando holandés. Si no puedes
            asistir, la clase queda grabada aquí para siempre.
          </p>
          <Link
            href={courseHref}
            className="mt-2 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold text-[15px] transition-colors"
          >
            Ver clases grabadas
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-8 mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Preguntas frecuentes</h2>
        <div className="bg-white rounded-2xl nice-shadow overflow-hidden divide-y divide-[#DDE6F5]">
          {FAQS.map((faq, i) => {
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
    </GeneralWrapperStyled>
  )
}
