'use client'

import React, { useEffect } from 'react'
import { BookOpen, HelpCircle, Lightbulb } from 'lucide-react'
import { GUIDES, type Guide, type GuideBlock } from './guidesContent'
import { FORMACION_FAQ, FORMACION_FAQ_INTRO } from './faqContent'
import CourseIndex from './CourseIndex'
import Collapsible from './Collapsible'
import type { ChapterLike } from '@/lib/course/formacionProgress'
import { getSchoolUrl } from '@services/config/config'

/** Convierte **negritas** en <strong> y *cursivas* en <em>. Nada más. */
/**
 * `{escuela}` → el dominio de la escuela, sacado de la configuración.
 *
 * Así el texto de las guías no lleva el dominio escrito a mano: el día que se
 * cambia, se cambia una variable de Railway y la guía se actualiza sola.
 */
function conDominio(text: string): string {
  return text.replace(/\{escuela\}/g, getSchoolUrl().replace(/^https?:\/\//, ''))
}

function rich(raw: string): React.ReactNode {
  const text = conDominio(raw)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[#1D0084]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.t) {
    case 'h2':
      return (
        <h2
          className="text-[19px] sm:text-[21px] font-bold text-gray-900 mt-9 mb-3 first:mt-0 leading-snug"
          style={{
            fontFamily:
              'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
          }}
        >
          {block.text}
        </h2>
      )

    case 'p':
      return (
        <p className="text-[15px] text-[#3F4A61] leading-relaxed mb-3">{rich(block.text)}</p>
      )

    case 'ul':
      return (
        <ul className="mb-4 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] text-[#3F4A61] leading-relaxed">
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-[#4da3ff] shrink-0" />
              <span className="min-w-0">{rich(item)}</span>
            </li>
          ))}
        </ul>
      )

    case 'ol':
      return (
        <ol className="mb-4 space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-[#3F4A61] leading-relaxed">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">{rich(item)}</span>
            </li>
          ))}
        </ol>
      )

    case 'callout':
      return (
        <div className="my-5 flex gap-3 rounded-xl bg-[#F0F5FF] px-4 py-3.5">
          <Lightbulb size={17} className="text-[#025dc7] shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#0a1656] leading-relaxed min-w-0">{rich(block.text)}</p>
        </div>
      )

    case 'quote':
      return (
        <p
          className="my-6 text-[17px] sm:text-[19px] font-semibold text-[#1D0084] leading-snug border-l-[3px] border-[#4da3ff] pl-4"
          style={{
            fontFamily:
              'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
          }}
        >
          {rich(block.text)}
        </p>
      )

    case 'item':
      return (
        <div className="mb-3 rounded-xl border border-[#DDE6F5] bg-white px-4 py-3.5">
          <p className="text-[14.5px] font-semibold text-[#1D0084] leading-snug">{block.title}</p>
          <p className="text-[14px] text-[#3F4A61] leading-relaxed mt-1">{rich(block.text)}</p>
        </div>
      )

    case 'table':
      // En móvil la tabla se desplaza dentro de su caja: la página nunca se
      // mueve de lado.
      return (
        <div className="my-4 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left border-collapse">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="text-[11px] font-semibold text-[#8A96AB] uppercase tracking-[0.08em] pb-2 px-3 border-b border-[#DDE6F5]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="align-top">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`py-2.5 px-3 text-[14px] leading-relaxed border-b border-[#EEF3FB] ${
                        j === 0 ? 'font-semibold text-[#1D0084] whitespace-nowrap' : 'text-[#3F4A61]'
                      }`}
                    >
                      {rich(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    default:
      return null
  }
}

/**
 * Una guía de la escuela, dentro de una clase del curso.
 *
 * Es contenido, no ejercicio: se da por vista al abrirla, igual que el
 * resumen de una lección.
 */
export default function SchoolGuide({
  guideId,
  chapters,
  onComplete,
}: {
  guideId: string
  /** Solo para el índice: los capítulos del curso donde está la actividad. */
  chapters?: ChapterLike[]
  onComplete?: () => void
}) {
  const guide: Guide | undefined = GUIDES[guideId]
  const isFaq = guideId === 'faq'
  const isIndex = guideId === 'indice'
  // Una pregunta abierta cada vez: abrir la siguiente cierra la anterior.
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  // Se marca como vista al abrirla (es lectura, no hay nada que aprobar).
  useEffect(() => {
    if (guide || isFaq || isIndex) onComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideId])

  if (isIndex) return <CourseIndex chapters={chapters ?? []} />

  if (isFaq) {
    return (
      <article className="max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle size={15} className="text-[#025dc7]" />
          <span className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-[0.08em]">
            Antes de empezar
          </span>
        </div>
        <h1
          className="text-[24px] sm:text-[30px] font-bold text-gray-900 leading-tight"
          style={{
            fontFamily:
              'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
          }}
        >
          Preguntas frecuentes
        </h1>
        <p className="text-[15px] text-[#5A6480] leading-relaxed mt-2">
          {FORMACION_FAQ_INTRO}
        </p>

        <div className="mt-6 space-y-2.5">
          {FORMACION_FAQ.map((faq, i) => (
            <Collapsible
              key={i}
              open={openFaq === i}
              onToggle={() => setOpenFaq((cur) => (cur === i ? null : i))}
              header={
                <span className="text-[15px] font-semibold text-[#1D0084] leading-snug">
                  {faq.q}
                </span>
              }
            >
              <p className="px-4 sm:px-5 py-4 text-[14.5px] text-[#3F4A61] leading-relaxed">
                {rich(faq.a)}
              </p>
            </Collapsible>
          ))}
        </div>

        <div className="mt-6 flex gap-3 rounded-xl bg-[#F0F5FF] px-4 py-3.5">
          <Lightbulb size={17} className="text-[#025dc7] shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#0a1656] leading-relaxed min-w-0">
            ¿Tu duda no está aquí? Abre una consulta desde cualquier lección o
            escríbenos por <strong className="font-semibold">Mis mensajes</strong>.
            Contestamos siempre.
          </p>
        </div>
      </article>
    )
  }

  if (!guide) {
    return (
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 text-center">
        <p className="text-[14px] text-[#5A6480]">
          Esta guía ya no existe. Elige otra desde el panel.
        </p>
      </div>
    )
  }

  return (
    <article className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={15} className="text-[#025dc7]" />
        <span className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-[0.08em]">
          {guide.eyebrow}
        </span>
      </div>
      <h1
        className="text-[24px] sm:text-[30px] font-bold text-gray-900 leading-tight"
        style={{
          fontFamily:
            'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
        }}
      >
        {guide.title}
      </h1>
      <p className="text-[15px] text-[#5A6480] leading-relaxed mt-2 mb-2">{guide.intro}</p>

      <div className="mt-6">
        {guide.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </article>
  )
}
