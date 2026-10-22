// @ts-nocheck
/**
 * «Esta semana» del Inicio contada por las clases terminadas del curso
 * (`trail_step`), no por `lesson_completion`:
 *   bun test lib/exercises-app/__tests__/semanaClases.test.ts
 */
import { describe, expect, test } from 'bun:test'
import { computeInsights, fechasDeClases, semanaConClases } from '@services/student/insights'

// Miércoles 2026-10-21 12:00 local — la semana va del lunes 19 al domingo 25.
const NOW = new Date('2026-10-21T12:00:00')

const paso = (activity_id, creation_date, complete = true) => ({ activity_id, creation_date, complete })

describe('fechasDeClases', () => {
  test('una fecha por clase terminada, la primera vez, y en UTC', () => {
    const runs = [
      {
        course_id: 7,
        steps: [
          paso(1, '2026-10-20 09:00:00.123456'),
          paso(1, '2026-10-21 10:00:00'), // la misma clase otra vez: vale la primera
          paso(2, '2026-10-19 08:00:00'),
          paso(3, '2026-10-19 08:00:00', false), // sin terminar: no cuenta
          paso(4, ''), // sin fecha: no cuenta
        ],
      },
    ]
    const fechas = fechasDeClases(runs).map((d) => d.toISOString()).sort()
    expect(fechas).toEqual(['2026-10-19T08:00:00.000Z', '2026-10-20T09:00:00.000Z'])
  })

  test('sin recorrido, nada', () => {
    expect(fechasDeClases(undefined)).toEqual([])
    expect(fechasDeClases([{ steps: null }])).toEqual([])
  })
})

describe('semanaConClases', () => {
  test('a quien estudió en la formación ya no le sale 0', () => {
    // Sin ninguna lesson_completion (lo normal dentro de la formación).
    const base = computeInsights(null, [], {}, [], NOW).week
    expect(base.lessonsCompleted).toBe(0)

    const clases = fechasDeClases([
      {
        course_id: 7,
        steps: [
          paso(1, '2026-10-19 09:00:00'),
          paso(2, '2026-10-20 09:00:00'),
          paso(3, '2026-10-20 18:00:00'),
          paso(4, '2026-10-14 09:00:00'), // semana pasada
        ],
      },
    ])
    const w = semanaConClases(base, clases, NOW)
    expect(w.lessonsCompleted).toBe(3)
    expect(w.lessonsPrevWeek).toBe(1)
    expect(w.activeDays).toEqual(['2026-10-19', '2026-10-20'])
  })

  test('los días de prácticas y racha se mantienen', () => {
    const week = { ...computeInsights(null, [], {}, [], NOW).week, activeDays: ['2026-10-21'], practices: 2 }
    const w = semanaConClases(week, fechasDeClases([{ steps: [paso(1, '2026-10-19 09:00:00')] }]), NOW)
    expect(w.activeDays).toEqual(['2026-10-19', '2026-10-21'])
    expect(w.practices).toBe(2)
  })

  test('sin ninguna clase hecha, se queda la cuenta de antes', () => {
    const week = computeInsights(
      null,
      [{ lesson_id: 'les-1-voorstellen', module_id: 'over-jou', completed_at: '2026-10-20T10:00:00', time_seconds: 0 }],
      {},
      [],
      NOW
    ).week
    expect(semanaConClases(week, [], NOW)).toBe(week)
    expect(week.lessonsCompleted).toBe(1)
  })
})
