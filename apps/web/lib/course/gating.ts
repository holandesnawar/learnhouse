/**
 * Gating por FASES de la formación Nawar.
 *
 * Cada "lección" (capítulo) se divide en 3 fases que se desbloquean en orden y
 * EN LOTE (todas las actividades de la fase a la vez):
 *
 *   Fase 0 — Vídeo            (puerta: ver el vídeo ~90%)
 *   Fase 1 — Estudio+práctica (samenvatting + flashcards + Oefeningen)
 *                              puerta: completar SOLO los ejercicios (Oefeningen)
 *   Fase 2 — Aplicación       (lezen + luisteren + situación real)
 *                              puerta: completar las 3
 *
 * Al limpiar la última fase de un capítulo se desbloquea el vídeo del siguiente.
 * Una actividad completada queda desbloqueada para siempre (navegación libre
 * hacia atrás). La fuente de verdad es el "trail" del servidor; se admite un
 * set de completados "optimistas" para desbloquear al instante sin esperar al
 * refetch.
 *
 * El reparto por fases se deduce del NOMBRE de la lección (samenvatting, lezen…)
 * con respaldo al tipo de actividad. Es el diseño que pidió el usuario; si un
 * capítulo no sigue esta estructura, degrada con suavidad (lo desconocido cae en
 * la fase de estudio y nunca deja al alumno atascado sin motivo).
 */

export type GatingResult = {
  unlockedIds: Set<number>
  // Actividades-puerta pendientes de la fase que bloquea ahora mismo.
  pendingGates: { id: number; name: string; uuid: string }[]
  // A dónde mandar al alumno para "seguir donde lo dejó".
  resumeUuid: string | null
  resumeName: string | null
}

function lc(s: any): string {
  return (s || '').toString().toLowerCase()
}

/** Fase (tier) a la que pertenece una actividad: 0 vídeo · 1 estudio · 2 aplicación. */
export function tierOf(name: string, activityType?: string): 0 | 1 | 2 {
  const n = lc(name)
  // Fase 2 — aplicación (se comprueba primero para que "situación real" no caiga en vídeo)
  if (/lezen|lectura|leer|reading/.test(n)) return 2
  if (/luister|escucha|listening/.test(n)) return 2
  if (/situaci|situatie|gesprek|conversa|spreek|\breal\b/.test(n)) return 2
  // Fase 0 — vídeo
  if (/v[ií]deo/.test(n) || activityType === 'TYPE_VIDEO') return 0
  // Fase 1 — estudio + práctica
  if (/samenvatting|resumen|summary/.test(n)) return 1
  if (/flashcard/.test(n)) return 1
  if (/oefening|ejercicio|woordenschat|vocabular|woorden|quiz|test/.test(n)) return 1
  return 1
}

/** ¿Esta actividad es "puerta" (hay que completarla para abrir la siguiente fase)? */
export function isGate(name: string, activityType?: string): boolean {
  const n = lc(name)
  const tier = tierOf(name, activityType)
  if (tier === 0) return true // el vídeo es puerta (verlo)
  if (tier === 2) return true // lezen/luisteren/situación son puertas
  // Fase 1: solo los ejercicios (Oefeningen) son puerta; samenvatting y flashcards no.
  if (/samenvatting|resumen|summary/.test(n)) return false
  if (/flashcard/.test(n)) return false
  return true
}

function isIntroChapter(chapter: any): boolean {
  return /introduc/i.test(chapter?.name || '')
}

type Group = {
  key: string
  intro: boolean
  locked: boolean // capítulo con goteo (is_locked): no accesible y bloquea lo posterior
  activities: any[]
  gateIds: number[]
}

/** Agrupa las actividades del curso en fases ordenadas (capítulo → tier). */
export function buildGroups(course: any): Group[] {
  const groups: Group[] = []
  for (const ch of course?.chapters ?? []) {
    const intro = isIntroChapter(ch)
    const locked = !!ch?.is_locked
    const byTier: Record<number, any[]> = { 0: [], 1: [], 2: [] }
    for (const a of ch?.activities ?? []) {
      const tier = intro ? 1 : tierOf(a.name, a.activity_type)
      byTier[tier].push(a)
    }
    for (const tier of [0, 1, 2]) {
      const acts = byTier[tier]
      if (acts.length === 0) continue
      groups.push({
        key: `${ch.id}:${tier}`,
        intro,
        locked,
        activities: acts,
        gateIds: acts
          .filter((a: any) => isGate(a.name, a.activity_type))
          .map((a: any) => a.id),
      })
    }
  }
  return groups
}

function makeIsComplete(run: any, extra?: Set<number>) {
  return (activityId: number): boolean => {
    if (extra && extra.has(activityId)) return true
    return !!run?.steps?.find(
      (s: any) => s.activity_id === activityId && s.complete === true
    )
  }
}

/**
 * Calcula qué actividades están desbloqueadas, qué falta para seguir y a dónde
 * mandar al alumno para "continuar donde lo dejó".
 */
export function computeGating(
  course: any,
  run: any,
  extraComplete?: Set<number>
): GatingResult {
  const isComplete = makeIsComplete(run, extraComplete)
  const groups = buildGroups(course)
  const unlockedIds = new Set<number>()
  let gateOpen = true
  let pendingGates: { id: number; name: string; uuid: string }[] = []
  let resumeUuid: string | null = null
  let resumeName: string | null = null

  for (const g of groups) {
    if (g.locked) {
      // Goteo de contenido: capítulo no accesible y bloquea todo lo posterior.
      gateOpen = false
      continue
    }
    if (g.intro) {
      // Introducción: siempre abierta y no bloquea lo que sigue.
      for (const a of g.activities) unlockedIds.add(a.id)
      continue
    }
    if (gateOpen) {
      for (const a of g.activities) unlockedIds.add(a.id)
    } else {
      // Aún bloqueada, pero lo ya completado se mantiene abierto.
      for (const a of g.activities) if (isComplete(a.id)) unlockedIds.add(a.id)
    }
    const cleared = g.gateIds.every((id) => isComplete(id))
    if (!cleared && gateOpen) {
      // Esta es la fase que bloquea: recoge las puertas pendientes + a dónde ir.
      const pend = g.activities.filter(
        (a: any) => isGate(a.name, a.activity_type) && !isComplete(a.id)
      )
      pendingGates = pend.map((a: any) => ({
        id: a.id,
        name: a.name,
        uuid: a.activity_uuid?.replace('activity_', '') || '',
      }))
      if (pend[0]) {
        resumeUuid = pend[0].activity_uuid?.replace('activity_', '') || null
        resumeName = pend[0].name || null
      }
    }
    if (!cleared) gateOpen = false
  }

  return { unlockedIds, pendingGates, resumeUuid, resumeName }
}
