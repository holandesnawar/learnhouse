/**
 * El WhatsApp para un alumno que lleva dos semanas o más sin terminar ninguna
 * clase de la formación (Panel → Alumnos → Progreso, 13/11/2026). No se manda
 * solo: se abre WhatsApp con el texto puesto y quien escribe lo retoca.
 * De dónde sale quién está atascado: `apps/api/src/services/panel/alumnos.py`.
 */

export function mensajeAtascado(p: { nombre: string; yo: string; clase: string; enlace: string; sinEmpezar: boolean }): string {
  const nombre = (p.nombre || '').trim().split(/\s+/)[0] || ''
  const saludo = `Hola${nombre ? ` ${nombre}` : ''}, soy ${p.yo ? p.yo : 'del equipo'} de Holandés Nawar. ¿Qué tal vas?`
  const motivo = p.sinEmpezar
    ? 'He visto que todavía no has empezado con las lecciones de la formación y quería saber si te puedo ayudar a arrancar.'
    : 'He visto que llevas unos días sin avanzar en las lecciones de la formación y quería saber si te has atascado con algo o te puedo ayudar.'
  const paso = p.clase
    ? `Te toca «${p.clase}», son unos minutos${p.enlace ? `: ${p.enlace}` : '.'}`
    : p.enlace
      ? `Puedes seguir por aquí: ${p.enlace}`
      : ''
  return [saludo, motivo, paso].filter(Boolean).join('\n\n')
}

/** «18 días sin terminar una clase» / «Entró hace 20 días y no ha empezado». */
export function resumenAtasco(dias: number | null, sinEmpezar: boolean): string {
  if (dias === null) return ''
  return sinEmpezar ? `Entró hace ${dias} días y no ha hecho ninguna clase` : `${dias} días sin terminar una clase`
}
