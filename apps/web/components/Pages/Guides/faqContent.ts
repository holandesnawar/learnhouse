/**
 * Las preguntas frecuentes de la formación, en un solo sitio.
 *
 * Las usan dos pantallas: el bloque de la portada del curso y la sección
 * "Preguntas frecuentes" del módulo 0. Antes de separarlo, cambiar una
 * respuesta obligaba a acordarse de las dos.
 */

export interface FaqItem {
  q: string
  a: string
}

export const FORMACION_FAQ_INTRO =
  'Todo lo que suele preguntarse al empezar. Si tu duda no está aquí, abre una consulta o escríbenos: contestamos siempre.'

export const FORMACION_FAQ: FaqItem[] = [
    {
      q: '¿Cuánto tiempo tengo que dedicarle al día?',
      a: 'Entre 20 y 30 minutos, cuatro o cinco días por semana. Es mucho mejor un rato corto casi todos los días que dos horas el domingo: un idioma se aprende por repetición, no por maratones. Y si un día solo tienes diez minutos, haz las flashcards y ese día ya cuenta.',
    },
    {
      q: '¿Tengo que seguir el orden de las lecciones?',
      a: 'Sí, y es importante. Cada lección da por sabido lo de la anterior: el vocabulario vuelve a aparecer, la gramática se apoya en lo ya visto y los diálogos mezclan las dos cosas. Volver atrás a repasar, todo lo que quieras; saltar hacia delante, mejor no.',
    },
    {
      q: '¿Por qué no veo todos los módulos desde el principio?',
      a: 'Los módulos se van abriendo poco a poco desde el día que entras. No es para hacerte esperar: es para que no te comas la formación entera en tres días y se te olvide en dos semanas. En el módulo que todavía no está abierto verás la fecha en la que se abre.',
    },
    {
      q: '¿Qué hago exactamente dentro de cada lección?',
      a: 'El orden de las partes está pensado, hazlo así la primera vez: el vídeo, después el Resumen (para fijar lo que acabas de ver), las Flashcards (el vocabulario), Oefening (los ejercicios), Lezen (leer), Luisteren (escuchar) y, cuando la lección lo tiene, Spreken (elegir qué dirías tú). Luego ya vuelves a lo que quieras.',
    },
    {
      q: 'Me he quedado atrás. ¿Empiezo otra vez desde el principio?',
      a: 'No hace falta, y además sería un error. Entra en Mi progreso, mira cuál fue la última lección que dejaste a medias y sigue por ahí. Nada caduca cada semana: la formación te espera.',
    },
    {
      q: 'No entiendo casi nada cuando escucho. ¿Es normal?',
      a: 'Totalmente normal, y es lo que más tarda en llegar para todo el mundo. Prueba así: escucha una vez sin mirar el texto (aunque solo pilles tres palabras), después con el texto delante, y luego otra vez sin él. Esa tercera vez es donde se nota el salto.',
    },
    {
      q: 'Tengo una duda de una lección. ¿Dónde la pregunto?',
      a: 'Tres caminos, según lo que sea. Consultas: para dudas de la lección; las responde el equipo y quedan visibles, así aprendemos todos. Mis mensajes: para algo personal o para mandarnos una nota de voz. Comunidad: para hablar con tus compañeros de clase.',
    },
    {
      q: '¿Podéis corregirme la pronunciación?',
      a: 'Sí, y es de lo más útil que puedes hacer. En Mis mensajes tienes el botón de nota de voz: grabas, te escuchas antes de enviarlo y te contestamos. Para la pronunciación funciona mucho mejor que describirlo por escrito.',
    },
    {
      q: '¿Necesito comprar un libro o estudiar gramática por mi cuenta?',
      a: 'No. Todo lo que necesitas para llegar al A1 está dentro de la formación: vocabulario, gramática, lectura, audio y práctica. Si en algún momento quieres un extra, pídenoslo y te recomendamos, pero no te hace falta para completarla.',
    },
    {
      q: '¿Se guarda mi progreso? ¿Puedo hacerlo desde el móvil?',
      a: 'Sí a las dos cosas. Todo se guarda en tu cuenta, no en el navegador: puedes empezar una lección en el ordenador y seguirla en el móvil. En Inicio, la tarjeta de arriba te lleva exactamente a donde lo dejaste.',
    },
    {
      q: '¿Qué es la racha y qué pasa si la pierdo?',
      a: 'La racha cuenta los días seguidos que entras a practicar. Está para animarte, no para castigarte: si la pierdes no pierdes nada de la formación ni de tu progreso. Vuelves y empieza otra vez, sin más.',
    },
    {
      q: 'No consigo entrar / he olvidado mi contraseña',
      a: 'En la pantalla de entrada tienes «¿Olvidaste tu contraseña?»: te llega un correo para poner una nueva (mira también en la carpeta de spam). Si aun así no entras, escríbenos a info@holandesnawar.com y lo resolvemos.',
    },
  ]
