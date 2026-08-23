'use client'

import React, { useMemo, useState } from 'react'
import { CalendarClock, ListTree, Lock } from 'lucide-react'
import Collapsible from './Collapsible'
import {
  buildFormacionProgress,
  type ChapterLike,
  type ModuleRow,
} from '@/lib/course/formacionProgress'

/**
 * El índice de la formación, sacado del curso de verdad.
 *
 * No es una lista escrita a mano: lee los capítulos y las clases tal y como
 * están en el curso, así que el día que se añade una lección aparece sola. Si
 * lo escribiéramos a mano, al mes estaría desactualizado y nadie se daría
 * cuenta hasta que un alumno lo dijera.
 *
 * Se abre por niveles —módulo, después lección— y solo uno a la vez: con
 * cuatro módulos y seis lecciones cada uno, verlo todo desplegado es un muro
 * de texto que nadie lee.
 */

/** "MODULE 2 - FAMILIE & VRIENDEN" → "Familie & vrienden" (y su número). */
function cleanModuleTitle(raw: string): { number: string; title: string } {
  const text = (raw || '').trim()
  const m = text.match(/^\s*(?:m[oó]dulo|module)\s*(\d+)\s*[-—:.]?\s*(.*)$/i)
  if (!m) return { number: '', title: text }
  const rest = (m[2] || '').trim()
  const title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase() : text
  return { number: m[1], title }
}

/** ¿Esa fecha todavía no ha llegado? Entonces el módulo sigue cerrado. */
function isFuture(iso: string | null): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t > Date.now()
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  } catch {
    return ''
  }
}

/**
 * Qué es cada parte de una lección, en una línea.
 *
 * Se busca por palabra clave dentro del nombre de la clase, no por igualdad:
 * los nombres del curso llevan el número delante ("1.4 Lezen") y a veces
 * alguna palabra más. Si no se reconoce, no se inventa explicación.
 */
const SECTION_HINTS: Array<{ match: RegExp; hint: string }> = [
  { match: /samenvatting|resumen/i, hint: 'Lo que se explica en el vídeo, por escrito y con las frases clave.' },
  { match: /flashcard|woordenschat|vocabulario/i, hint: 'El vocabulario nuevo, carta a carta, para fijarlo.' },
  { match: /oefening|ejercicio|pr[aá]ctica/i, hint: 'Los ejercicios de la lección: aquí se comprueba si lo entendiste.' },
  { match: /lezen|lectura/i, hint: 'Un texto para leer, con preguntas de comprensión.' },
  { match: /luisteren|escucha/i, hint: 'Un diálogo para escuchar, con preguntas sobre lo que se dice.' },
  { match: /spreken|hablar/i, hint: 'Escuchas una situación y eliges qué dirías tú, sin texto delante.' },
  { match: /situaci[oó]n|echt nederlands/i, hint: 'Holandés real: un vídeo de la calle, con ejercicios.' },
  { match: /v[ií]deo|les\b|lecci[oó]n|clase/i, hint: 'El vídeo de la lección: la explicación de la profe.' },
]

function hintFor(label: string): string {
  const found = SECTION_HINTS.find((h) => h.match.test(label || ''))
  return found ? found.hint : ''
}

export default function CourseIndex({ chapters }: { chapters: ChapterLike[] }) {
  const modules: ModuleRow[] = useMemo(
    // Sin progreso a propósito: aquí se enseña QUÉ hay. El cómo vas está en
    // "Mi progreso", y mezclar las dos cosas convierte el índice en un panel.
    () => buildFormacionProgress(chapters || [], new Set<number>(), {}, true),
    [chapters]
  )

  // Uno abierto cada vez, en los dos niveles: abrir el siguiente cierra el
  // anterior, que es lo cómodo cuando hay muchos.
  const [openModule, setOpenModule] = useState<string | null>(null)
  const [openLesson, setOpenLesson] = useState<string | null>(null)

  const toggleModule = (key: string) => {
    setOpenModule((cur) => (cur === key ? null : key))
    setOpenLesson(null)
  }

  if (!modules.length) {
    return (
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 text-center">
        <p className="text-[14px] text-[#5A6480]">
          El índice aparecerá aquí en cuanto el curso tenga sus módulos.
        </p>
      </div>
    )
  }

  return (
    <article className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <ListTree size={15} className="text-[#025dc7]" />
        <span className="text-[11px] font-semibold text-[#025dc7] uppercase tracking-[0.08em]">
          El camino completo
        </span>
      </div>
      <h1
        className="text-[24px] sm:text-[30px] font-bold text-gray-900 leading-tight"
        style={{
          fontFamily:
            'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
        }}
      >
        Índice de contenido
      </h1>
      <p className="text-[15px] text-[#5A6480] leading-relaxed mt-2">
        Todo lo que vas a aprender, de principio a fin. Abre un módulo para ver sus
        lecciones, y una lección para ver sus partes. Los módulos se van abriendo
        poco a poco: si alguno todavía no está, ahí verás la fecha.
      </p>

      <div className="mt-6 space-y-2.5">
        {modules.map((m, i) => {
          const { number, title } = cleanModuleTitle(m.title)
          const fecha = formatDate(m.unlockDate)
          const locked = isFuture(m.unlockDate)
          const isOpen = openModule === m.key

          return (
            <Collapsible
              key={m.key}
              open={isOpen}
              onToggle={() => toggleModule(m.key)}
              header={
                <>
                  <span className="block text-[11px] font-semibold text-[#025dc7] uppercase tracking-[0.08em]">
                    Módulo {number || i + 1}
                  </span>
                  <h2
                    className="text-[16px] sm:text-[17px] font-semibold text-gray-900 leading-snug mt-0.5"
                    style={{
                      fontFamily:
                        'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
                    }}
                  >
                    {title}
                  </h2>
                </>
              }
              aside={
                locked && fecha ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A6480] bg-[#F0F5FF] rounded-full px-2.5 py-1">
                    <CalendarClock size={12} /> {fecha}
                  </span>
                ) : (
                  <span className="text-[12px] text-[#8A96AB] tabular-nums">
                    {m.classes.length} {m.classes.length === 1 ? 'lección' : 'lecciones'}
                  </span>
                )
              }
            >
              {m.classes.length > 0 ? (
                <div className="py-1.5 divide-y divide-[#F3F7FD]">
                  {m.classes.map((c) => {
                    const lessonKey = `${m.key}:${c.key}`
                    return (
                      <Collapsible
                        key={c.key}
                        tone="row"
                        open={openLesson === lessonKey}
                        onToggle={() =>
                          setOpenLesson((cur) => (cur === lessonKey ? null : lessonKey))
                        }
                        header={
                          <span className="text-[14.5px] font-semibold text-gray-900">
                            {c.title}
                          </span>
                        }
                        aside={
                          <span className="text-[12px] text-[#8A96AB] tabular-nums">
                            {c.sections.length}{' '}
                            {c.sections.length === 1 ? 'parte' : 'partes'}
                          </span>
                        }
                      >
                        <ol className="space-y-2 pt-1">
                          {c.sections.map((s, si) => {
                            const hint = hintFor(s.label)
                            return (
                              <li key={s.activityId} className="flex gap-2.5">
                                <span className="shrink-0 mt-[3px] w-5 h-5 rounded-full bg-[#F0F5FF] text-[#025dc7] text-[11px] font-semibold flex items-center justify-center tabular-nums">
                                  {si + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[13.5px] font-semibold text-[#1D0084] leading-snug">
                                    {s.label}
                                  </p>
                                  {hint && (
                                    <p className="text-[12.5px] text-[#5A6480] leading-relaxed mt-0.5">
                                      {hint}
                                    </p>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      </Collapsible>
                    )
                  })}
                </div>
              ) : (
                <p className="px-4 sm:px-5 py-4 text-[13px] text-[#8A96AB] flex items-center gap-2">
                  <Lock size={13} /> El contenido de este módulo se ve cuando se abre.
                </p>
              )}
            </Collapsible>
          )
        })}
      </div>

      <p className="mt-6 text-[13px] text-[#5A6480] leading-relaxed">
        Para ver por dónde vas y qué te falta, entra en{' '}
        <strong className="font-semibold text-[#1D0084]">Mi progreso</strong>.
      </p>
    </article>
  )
}
