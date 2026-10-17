/**
 * «Ordenar» del mapa de Visión (17/10/2026, "algo de más orden"): coloca las
 * tarjetas como un mapa mental, sin mover nada de lo que dicen las flechas.
 *
 * - La idea principal (la raíz con más tarjetas colgando) se queda donde está
 *   y sus ramas salen a derecha e izquierda, repartidas por turnos y en el
 *   orden de arriba abajo en que estaban (no se baraja lo que ya se ordenó).
 * - Cada rama crece hacia fuera como un árbol: un nivel por columna, los hijos
 *   apilados y el padre a la altura del centro de sus hijos.
 * - Lo que no cuelga de la principal (tarjetas sueltas o grupos aparte) va
 *   debajo, cada grupo como un árbol hacia la derecha.
 * - Una flecha que cierra un círculo no rompe nada: cada tarjeta se coloca
 *   una sola vez, colgando de la primera flecha que llega a ella.
 *
 * Función pura, con test (`__tests__/ordenarMapa.test.ts`).
 */

export type Caja = { id: string; x: number; y: number; w: number; h: number }
export type Union = { origen: string; destino: string }

const ENTRE_NIVELES = 110
const ENTRE_HERMANOS = 28
const ENTRE_GRUPOS = 90

export function ordenarMapa(cajas: Caja[], uniones: Union[]): Record<string, { x: number; y: number }> {
  const porId = new Map(cajas.map((c) => [c.id, c]))
  const hijos = new Map<string, string[]>()
  const padre = new Map<string, string>()
  for (const u of uniones) {
    if (!porId.has(u.origen) || !porId.has(u.destino) || u.origen === u.destino) continue
    if (padre.has(u.destino)) continue
    // Si el destino ya es antepasado del origen, la flecha cerraría un círculo.
    let a: string | undefined = u.origen
    let circulo = false
    while (a !== undefined) {
      if (a === u.destino) {
        circulo = true
        break
      }
      a = padre.get(a)
    }
    if (circulo) continue
    padre.set(u.destino, u.origen)
    hijos.set(u.origen, [...(hijos.get(u.origen) ?? []), u.destino])
  }
  // Los hijos, en el orden de arriba abajo en que están ahora.
  for (const [id, lista] of hijos) hijos.set(id, [...lista].sort((a, b) => porId.get(a)!.y - porId.get(b)!.y || porId.get(a)!.x - porId.get(b)!.x))

  const descendientes = (id: string): number => (hijos.get(id) ?? []).reduce((n, h) => n + 1 + descendientes(h), 0)
  const raices = cajas.filter((c) => !padre.has(c.id))
  if (!raices.length) return {}
  const principal = [...raices].sort((a, b) => descendientes(b.id) - descendientes(a.id) || a.y - b.y)[0]

  const alto = new Map<string, number>()
  const altoDe = (id: string): number => {
    const ya = alto.get(id)
    if (ya !== undefined) return ya
    const lista = hijos.get(id) ?? []
    const suyo = porId.get(id)!.h
    const deHijos = lista.reduce((s, h) => s + altoDe(h), 0) + Math.max(0, lista.length - 1) * ENTRE_HERMANOS
    const total = Math.max(suyo, deHijos)
    alto.set(id, total)
    return total
  }

  const salida: Record<string, { x: number; y: number }> = {}
  /** Coloca `id` con su rama dentro de la franja que empieza en `arriba`.
   *  `lado` 1 = hacia la derecha, -1 = hacia la izquierda. `borde` = el x del
   *  lado de la tarjeta que mira a su padre. */
  const colocar = (id: string, borde: number, arriba: number, lado: 1 | -1) => {
    const c = porId.get(id)!
    const franja = altoDe(id)
    const x = lado === 1 ? borde : borde - c.w
    salida[id] = { x: Math.round(x), y: Math.round(arriba + (franja - c.h) / 2) }
    const lista = hijos.get(id) ?? []
    const deHijos = lista.reduce((s, h) => s + altoDe(h), 0) + Math.max(0, lista.length - 1) * ENTRE_HERMANOS
    let y = arriba + (franja - deHijos) / 2
    const siguiente = lado === 1 ? x + c.w + ENTRE_NIVELES : x - ENTRE_NIVELES
    for (const h of lista) {
      colocar(h, siguiente, y, lado)
      y += altoDe(h) + ENTRE_HERMANOS
    }
  }

  // La principal: donde está, con sus ramas repartidas a los dos lados.
  const r = porId.get(principal.id)!
  salida[r.id] = { x: Math.round(r.x), y: Math.round(r.y) }
  const ramas = hijos.get(r.id) ?? []
  const derecha = ramas.filter((_, i) => i % 2 === 0)
  const izquierda = ramas.filter((_, i) => i % 2 === 1)
  const centro = r.y + r.h / 2
  let abajo = r.y + r.h
  for (const [lista, lado] of [
    [derecha, 1],
    [izquierda, -1],
  ] as const) {
    const total = lista.reduce((s, h) => s + altoDe(h), 0) + Math.max(0, lista.length - 1) * ENTRE_HERMANOS
    let y = centro - total / 2
    const borde = lado === 1 ? r.x + r.w + ENTRE_NIVELES : r.x - ENTRE_NIVELES
    for (const h of lista) {
      colocar(h, borde, y, lado)
      y += altoDe(h) + ENTRE_HERMANOS
    }
    abajo = Math.max(abajo, centro + total / 2)
  }

  // Lo que va suelto: debajo, de izquierda a derecha como estaba.
  let y = abajo + ENTRE_GRUPOS
  const izquierdaDelTodo = Math.min(...Object.values(salida).map((p) => p.x))
  for (const otra of raices.filter((c) => c.id !== principal.id).sort((a, b) => a.y - b.y || a.x - b.x)) {
    colocar(otra.id, izquierdaDelTodo, y, 1)
    y += altoDe(otra.id) + ENTRE_GRUPOS / 2
  }
  return salida
}
