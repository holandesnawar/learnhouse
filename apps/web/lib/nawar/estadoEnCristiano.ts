/**
 * Estado de la escuela: decir en cristiano qué es cada ruta (10/11/2026).
 *
 * El servidor apunta `GET /api/v1/tareas/course/{course_uuid}/semanas`. Quien
 * mira el panel no es técnico: aquí se traduce a «Las semanas de una clase en
 * directo». Si una ruta no está en la lista, sale tal cual (y el detalle
 * técnico va siempre debajo, plegado).
 *
 * Puro, con test (`__tests__/estadoEnCristiano.test.ts`). Al añadir una
 * pantalla nueva no hace falta tocar esto: solo sale la ruta.
 */

/** [trozo que tiene que estar en la ruta, lo que es]. El primero que casa, gana. */
const ACCIONES: [string, string][] = [
  ['/student/insights', 'El Inicio y «Mi progreso» del alumno'],
  ['/student/highlights', 'Subrayar y las notas de las lecciones'],
  ['/student/', 'Los datos del alumno (racha, posición)'],
  ['/exercise-attempts', 'Guardar el resultado de un ejercicio'],
  ['/trail/', 'Marcar una clase como hecha'],
  ['/tareas/semana', 'Una semana de una clase en directo'],
  ['/tareas/course', 'Las semanas de una clase en directo'],
  ['/tareas/audio', 'Una nota de voz de una tarea'],
  ['/tareas/', 'Las tareas y el seguimiento de las clases'],
  ['/salas/', 'Las salas en directo'],
  ['/community-engagement/notifications', 'La campana de avisos'],
  ['/community-engagement', 'Los «sin leer» de la comunidad'],
  ['/discussions', 'Publicar o leer en la comunidad'],
  ['/communities', 'Los canales de la comunidad'],
  ['/messages', 'Mensajes con el equipo'],
  ['/consultas', 'Las consultas'],
  ['/recursos', 'Recursos'],
  ['/payments/webhook', 'El aviso de Stripe de un pago'],
  ['/payments/', 'Pagos y matrícula'],
  ['/ebook/', 'El ebook de Black Friday'],
  ['/reto/', 'El reto «Mijn eerste week»'],
  ['/contactos/', 'Panel: contactos y llamadas'],
  ['/panel/', 'Panel: matrículas, alumnos y tareas'],
  ['/stats/', 'Panel: estadísticas'],
  ['/vision/', 'Panel: Visión'],
  ['/estudio/', 'Panel: el Estudio'],
  ['/correos/', 'Panel: correos'],
  ['/equipo/', 'La sala de profesores'],
  ['/notifications/drip-diario', 'La tarea diaria (módulos y avisos)'],
  ['/notifications', 'Avisos por correo'],
  ['/backup/', 'La copia de seguridad de los archivos'],
  ['/courses/', 'Abrir un curso o su lista de clases'],
  ['/chapters', 'Los módulos de un curso'],
  ['/activities', 'Abrir una clase'],
  ['/orgs/', 'Los datos de la escuela (ajustes, logo, menú)'],
  ['/auth/', 'Entrar en la escuela'],
  ['/users/', 'La cuenta de una persona'],
  ['/health', 'La comprobación de salud'],
  ['/content', 'Un archivo (imagen, audio, PDF)'],
]

const PAGINAS: [RegExp, string][] = [
  [/^\/?$/, 'El Inicio'],
  [/^\/course\/[^/]+\/activity\//, 'Una lección o clase'],
  [/^\/course\//, 'La página de un curso'],
  [/^\/leccion\//, 'Una lección (desde un QR)'],
  [/^\/community\//, 'Un canal de la comunidad'],
  [/^\/communit/, 'La comunidad'],
  [/^\/mensajes/, 'Mensajes'],
  [/^\/consultas|^\/responder-consultas/, 'Consultas'],
  [/^\/clases/, 'Mis clases'],
  [/^\/sala\//, 'La sala en directo'],
  [/^\/tarea\//, 'Una tarea'],
  [/^\/ejercicios\/progreso/, 'Mi progreso'],
  [/^\/ejercicios/, 'Ejercicios'],
  [/^\/mis-notas/, 'Mis notas'],
  [/^\/recursos/, 'Recursos'],
  [/^\/empieza-aqui/, 'Empieza aquí'],
  [/^\/equipo|^\/mis-clases/, 'La sala de profesores'],
  [/^\/organizar/, 'Organizar clases'],
  [/^\/seguimiento/, 'Seguimiento semanal'],
  [/^\/dash/, 'El panel'],
  [/^\/login/, 'La pantalla de entrar'],
  [/^\/auth\/crear-cuenta/, 'Crear la contraseña tras pagar'],
  [/^\/auth\/matricula/, 'La caja de pago'],
  [/^\/auth\//, 'Una página de acceso'],
  [/^\/account/, 'Mi cuenta'],
  [/^\/certificates/, 'El certificado'],
]

const VERBO: Record<string, string> = { GET: 'Al abrir', POST: 'Al guardar o enviar', PUT: 'Al cambiar', PATCH: 'Al cambiar', DELETE: 'Al borrar' }

/** «Las semanas de una clase en directo», o la ruta tal cual si no se conoce. */
export function accionDe(ruta: string): string {
  const r = ruta || ''
  for (const [trozo, que] of ACCIONES) if (r.includes(trozo)) return que
  return r.replace(/^\/api\/v1/, '') || '(sin ruta)'
}

/** «Al guardar o enviar · Las tareas…». */
export function accionConVerbo(metodo: string, ruta: string): string {
  const verbo = VERBO[(metodo || '').toUpperCase()]
  return verbo ? `${verbo}: ${accionDe(ruta)}` : accionDe(ruta)
}

/** La pantalla de la escuela, por su dirección: «Una lección o clase». */
export function paginaDe(pagina: string): string {
  // En producción cada página va detrás de /orgs/<escuela>: se quita.
  const p = (pagina || '').replace(/^\/orgs\/[^/]+/, '') || '/'
  for (const [patron, que] of PAGINAS) if (patron.test(p)) return que
  return p
}

/** 1840 → «1,8 s»; 320 → «320 ms». */
export function tiempo(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`
}

/** 3 → «3 veces»; 1 → «1 vez». */
export function veces(n: number): string {
  return `${n} ${n === 1 ? 'vez' : 'veces'}`
}

/** A cuántas personas: «a 2 personas», «a 1 persona y a gente sin sesión». */
export function aQuien(personas: number, anonimas: number): string {
  const trozos: string[] = []
  if (personas > 0) trozos.push(`a ${personas} ${personas === 1 ? 'persona' : 'personas'}`)
  if (anonimas > 0) trozos.push(personas > 0 ? 'y a gente sin sesión' : 'a gente sin sesión')
  return trozos.join(' ')
}

/** 90061 s → «1 día y 1 h». */
export function haceTanto(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} ${d === 1 ? 'día' : 'días'}${h ? ` y ${h} h` : ''}`
  if (h > 0) return `${h} h${m ? ` y ${m} min` : ''}`
  return `${Math.max(1, m)} min`
}
