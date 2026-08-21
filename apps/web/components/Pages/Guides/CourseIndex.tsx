'use client'

import React, { useMemo } from 'react'
import { CalendarClock, CheckCircle2, ListTree, Lock } from 'lucide-react'
import {
  buildFormacionProgress,
  type ChapterLike,
  type ModuleRow,
} from '@/lib/course/formacionProgress'

/**
 * El índice de la formación, sacado del curso de verdad.
 *
 * No es una lista escrita a mano: lee los capítulos y las clases tal y como
 * están en el curso, así que el día que añadas una lección aparece sola. Si
 * lo escribiéramos a mano, al mes estaría desactualizado y nadie se daría
 * cuenta hasta que un alumno lo dijera.
 *
 * Enseña también los módulos que el goteo todavía no ha abierto, con su
 * fecha: ver el camino entero motiva, y el alumno ya sabe que se abren poco
 * a poco.
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
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
    })
  } catch {
    return ''
  }
}

export default function CourseIndex({ chapters }: { chapters: ChapterLike[] }) {
  const modules: ModuleRow[] = useMemo(
    // Sin progreso a propósito: aquí se enseña QUÉ hay. El cómo vas está en
    // "Mi progreso", y mezclar las dos cosas convierte el índice en un panel.
    () => buildFormacionProgress(chapters || [], new Set<number>(), {}, true),
    [chapters]
  )

  const totals = useMemo(() => {
    let lessons = 0
    let sections = 0
    for (const m of modules) {
      lessons += m.classes.length
      for (const c of m.classes) sections += c.sections.length
    }
    return { modules: modules.length, lessons, sections }
  }, [modules])

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
        Todo lo que vas a aprender, de principio a fin. Los módulos se abren poco a
        poco: si alguno todavía tiene candado, ahí verás la fecha en la que te toca.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { n: totals.modules, one: 'módulo', many: 'módulos' },
          { n: totals.lessons, one: 'lección', many: 'lecciones' },
          { n: totals.sections, one: 'clase', many: 'clases' },
        ].map((t) => (
          <span
            key={t.one}
            className="inline-flex items-baseline gap-1.5 rounded-full bg-[#F0F5FF] px-3 py-1.5"
          >
            <span className="text-[15px] font-semibold text-[#1D0084] tabular-nums">{t.n}</span>
            <span className="text-[12px] text-[#5A6480]">{t.n === 1 ? t.one : t.many}</span>
          </span>
        ))}
      </div>

      <div className="mt-7 space-y-4">
        {modules.map((m, i) => {
          const { number, title } = cleanModuleTitle(m.title)
          const fecha = formatDate(m.unlockDate)
          const locked = isFuture(m.unlockDate)
          return (
            <section
              key={m.key}
              className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden"
            >
              <header className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-[#EEF3FB]">
                <span className="shrink-0 w-8 h-8 rounded-lg bg-[#1D0084] text-white text-[13px] font-semibold flex items-center justify-center tabular-nums">
                  {number || i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-[16px] sm:text-[17px] font-bold text-gray-900 leading-snug"
                    style={{
                      fontFamily:
                        'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
                    }}
                  >
                    {title}
                  </h2>
                  <p className="text-[12px] text-[#8A96AB] mt-0.5">
                    {m.classes.length} {m.classes.length === 1 ? 'lección' : 'lecciones'}
                  </p>
                </div>
                {locked && fecha && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A6480] bg-[#F0F5FF] rounded-full px-2.5 py-1">
                    <CalendarClock size={12} /> Se abre el {fecha}
                  </span>
                )}
              </header>

              {m.classes.length > 0 ? (
                <ol className="divide-y divide-[#F3F7FD]">
                  {m.classes.map((c) => (
                    <li key={c.key} className="px-4 sm:px-5 py-3">
                      <h3 className="text-[14.5px] font-semibold text-gray-900">{c.title}</h3>
                      {c.sections.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.sections.map((s) => (
                            <span
                              key={s.activityId}
                              className="inline-flex items-center rounded-md bg-[#F8FAFF] border border-[#E7EEF9] px-2 py-0.5 text-[11.5px] text-[#5A6480]"
                            >
                              {s.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-4 sm:px-5 py-4 text-[13px] text-[#8A96AB] flex items-center gap-2">
                  <Lock size={13} /> El contenido de este módulo se muestra cuando se abre.
                </p>
              )}
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-[13px] text-[#5A6480] flex items-start gap-2 leading-relaxed">
        <CheckCircle2 size={15} className="text-[#4da3ff] shrink-0 mt-0.5" />
        <span>
          Este índice sale del curso de verdad: cuando añadimos una lección,
          aparece aquí sola. Para ver por dónde vas, entra en{' '}
          <strong className="font-semibold text-[#1D0084]">Mi progreso</strong>.
        </span>
      </p>
    </article>
  )
}
