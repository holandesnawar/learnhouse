import type { ExerciseItem } from './types'

/* ─────────────────────────────────────────────────────────────────────────────
   SITUACIONES REALES — biblioteca de vídeos (entrevistas, noticias, situaciones
   cotidianas) con ejercicios dinámicos para comprensión auditiva.

   Reutiliza el mismo motor de ejercicios que las lecciones (ExerciseRunner), así
   que cada situación se ve y se comporta igual que la práctica de una lección.

   Cada situación puede además embeberse en el curso como una "lección auditiva":
   en una actividad Embed se guarda  embed_url = "nawar-video:<id>"  y el curso la
   renderiza nativa (sin iframe externo, con la barra de progreso del curso).

   Para añadir un vídeo nuevo: copia un objeto del array, cambia los datos y pega
   el enlace Embed de Bunny (o un ID/enlace de YouTube). Yo (Claude) lo monto a
   partir del material que me pases.
───────────────────────────────────────────────────────────────────────────── */

export type SituacionCategory = 'noticia' | 'entrevista' | 'situacion'
export type SituacionLevel = 'A0' | 'A1' | 'A2'

export interface SituacionVideo {
  /** 'bunny' → enlace Embed de Bunny; 'youtube' → ID o enlace del vídeo. */
  provider: 'bunny' | 'youtube'
  /** Para Bunny: el enlace iframe.mediadelivery.net/embed/... (o player....).
   *  Para YouTube: el ID (dQw4w9WgXcQ) o cualquier enlace de YouTube. */
  src: string
}

export interface Situacion {
  id: string
  title: string
  category: SituacionCategory
  level: SituacionLevel
  /** Una línea de contexto que se muestra bajo el título. */
  context: string
  /** Etiqueta de duración opcional, p.ej. "2 min". */
  durationLabel?: string
  /** Emoji de portada (encima del vídeo en la tarjeta). */
  emoji?: string
  video: SituacionVideo
  /** Transcripción opcional (se muestra como desplegable bajo el vídeo). */
  transcriptNl?: string
  transcriptEs?: string
  exercises: ExerciseItem[]
}

export const CATEGORY_META: Record<SituacionCategory, { label: string; emoji: string }> = {
  noticia: { label: 'Noticia', emoji: '📰' },
  entrevista: { label: 'Entrevista', emoji: '🎙️' },
  situacion: { label: 'Situación cotidiana', emoji: '💬' },
}

/* ─────────────────────────────────────────────────────────────────────────────
   Catálogo
───────────────────────────────────────────────────────────────────────────── */

const SITUACIONES: Situacion[] = [
  {
    id: 'noticias-calor-verano',
    title: 'Noticias: la ola de calor del verano',
    category: 'noticia',
    level: 'A1',
    context:
      'Telediario en holandés fácil (NOS Journaal in makkelijke taal) sobre la ola de calor, el plan nacional contra el calor y los consejos para protegerte.',
    durationLabel: '15 min',
    emoji: '☀️',
    video: {
      provider: 'bunny',
      src: 'https://iframe.mediadelivery.net/embed/675650/830df70b-2217-4690-80b5-727396ddfa11',
    },
    transcriptNl: `Goedemiddag. Dit is het NOS Journaal in makkelijke taal en ik ben Jeroen Overbeek. In dit journaal gaat het over de hitte. Sinds vanochtend zijn er extra adviezen wat je wel en niet moet doen. We vertellen over nieuwbouwhuizen. Die houden de warmte extra goed vast en dat is met de hitte nu juist een probleem. En het gaat over een aantal nieuwe wetten en regels die morgen ingaan.

Het is vandaag erg warm buiten. Zo warm dat de overheid mensen waarschuwt. Het warme weer kan gevaarlijk zijn voor de gezondheid. Daarom is het vandaag in heel Nederland code geel. Als code geel ingaat, kan de hitte gevaarlijk worden voor ouderen en zieken. Vanaf dan geldt ook het Nationaal Hitteplan.

Dit zijn de belangrijkste adviezen in het Nationaal Hitteplan: Ga niet in de zon zitten. Drink voldoende water. Doe rustig aan, ga bijvoorbeeld niet sporten of hard werken. En let op kwetsbare mensen zoals zieken en ouderen. Ouderen moeten extra goed opletten dat ze genoeg drinken.

Morgen wordt het nog warmer en verandert code geel naar code oranje in de provincies Noord-Brabant, Gelderland en Limburg. Bij code oranje moet iedereen extra goed opletten en genoeg drinken.

Veel mensen hebben moeite om hun huis koel te houden. Dat is vooral zo bij nieuwbouwhuizen. In die huizen wordt het snel erg warm. Goede isolatie is fijn in de winter, maar in de zomer blijft de hitte ook binnen.

Morgen is het één juli. Op die dag gaan er nieuwe wetten en regels in. Het minimumloon gaat iets omhoog. Ook mensen met een uitkering krijgen iets meer geld. Mensen in een sociale huurwoning krijgen een huurverhoging. En websites en automaten moeten makkelijker te gebruiken zijn voor iedereen, ook voor mensen met een handicap.

En dan het weer. Vandaag was het al warm zomerweer. Morgen wordt het heet, zevenentwintig tot zevenendertig graden. De zon schijnt en dat maakt het voor het gevoel nog warmer.`,
    transcriptEs: `Buenas tardes. Este es el telediario de la NOS en holandés fácil y soy Jeroen Overbeek. En este telediario hablamos del calor. Desde esta mañana hay consejos extra sobre lo que debes y no debes hacer. Hablamos de los pisos de nueva construcción: retienen muy bien el calor, y con esta ola de calor eso es justo un problema. Y trata de varias leyes y normas nuevas que entran en vigor mañana.

Hoy hace mucho calor fuera. Tanto que el gobierno avisa a la gente. El tiempo caluroso puede ser peligroso para la salud. Por eso hoy hay código amarillo en toda Holanda. Cuando entra el código amarillo, el calor puede ser peligroso para mayores y enfermos. A partir de entonces también rige el Plan Nacional contra el Calor.

Estos son los consejos más importantes del Plan Nacional contra el Calor: No te sientes al sol. Bebe suficiente agua. Tómatelo con calma, por ejemplo no hagas deporte ni trabajes duro. Y cuida a las personas vulnerables como enfermos y mayores. Los mayores deben prestar especial atención a beber suficiente.

Mañana hará aún más calor y el código amarillo cambia a código naranja en las provincias de Noord-Brabant, Gelderland y Limburg. Con código naranja todos deben prestar mucha atención y beber suficiente.

Mucha gente tiene dificultades para mantener su casa fresca. Sobre todo en los pisos nuevos, donde hace calor enseguida. Un buen aislamiento es estupendo en invierno, pero en verano el calor también se queda dentro.

Mañana es uno de julio. Ese día entran en vigor nuevas leyes y normas. El salario mínimo sube un poco. También las personas con una prestación reciben algo más de dinero. Quienes viven en una vivienda social tendrán una subida del alquiler. Y las webs y las máquinas deben ser más fáciles de usar para todos, también para las personas con discapacidad.

Y ahora el tiempo. Hoy ya ha hecho calor veraniego. Mañana hará calor fuerte, de veintisiete a treinta y siete grados. El sol brilla y eso hace que se sienta aún más calor.`,
    // Ejercicios de comprensión (módulo 1): cubren todo el telediario —el calor y
    // sus consejos, las casas nuevas, y las leyes nuevas del 1 de julio—. Preguntas
    // de "¿entendiste el vídeo?", no solo vocabulario suelto.
    exercises: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: '¿De qué trata principalmente este telediario?',
        options: [
          'Del calor y cómo protegerse, y de unas leyes nuevas que entran mañana',
          'De un partido de fútbol importante',
          'De las vacaciones de verano en la playa',
          'Del tráfico en las carreteras',
        ],
        correctAnswer: 'Del calor y cómo protegerse, y de unas leyes nuevas que entran mañana',
        explanation: 'El presentador anuncia al principio: la hitte, las casas nuevas y las nuevas leyes y reglas.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Hoy hace tanto calor que el gobierno avisa a la gente. ¿Por qué avisa?',
        options: [
          'Porque el calor puede ser peligroso para la salud',
          'Porque va a llover mucho',
          'Porque de repente hace frío',
          'Porque no queda agua',
        ],
        correctAnswer: 'Porque el calor puede ser peligroso para la salud',
        explanation: '«Het warme weer kan gevaarlijk zijn voor de gezondheid.»',
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        prompt: 'Hoy hay «code geel» en toda Holanda. ¿Qué significa?',
        options: [
          'Un aviso de que el calor puede ser peligroso para mayores y enfermos',
          'Que está prohibido salir de casa',
          'Que va a nevar por la tarde',
          'Que el agua es gratis hoy',
        ],
        correctAnswer: 'Un aviso de que el calor puede ser peligroso para mayores y enfermos',
        explanation: 'Con código amarillo la hitte puede ser peligrosa para ouderen en zieken, y entra el Nationaal Hitteplan.',
      },
      {
        id: 'q4',
        type: 'multiple_choice',
        prompt: 'Según el Plan Nacional contra el Calor (Nationaal Hitteplan), ¿qué recomienda el gobierno?',
        options: [
          'No sentarse al sol, beber suficiente agua y tomárselo con calma',
          'Hacer mucho deporte al aire libre',
          'Trabajar más horas para acabar antes',
          'Cerrar las ventanas y no beber nada',
        ],
        correctAnswer: 'No sentarse al sol, beber suficiente agua y tomárselo con calma',
        explanation: 'Ga niet in de zon zitten · Drink voldoende water · Doe rustig aan · Let op kwetsbare mensen.',
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        prompt: '¿Por qué deben los mayores (ouderen) tener especial cuidado de beber suficiente?',
        options: [
          'Porque su cerebro les avisa más despacio de que tienen sed',
          'Porque no les gusta el agua',
          'Porque beben demasiado rápido',
          'Porque por la noche hace frío',
        ],
        correctAnswer: 'Porque su cerebro les avisa más despacio de que tienen sed',
        explanation: '«Ze krijgen minder snel een seintje vanuit de hersenen dat ze dorst hebben.»',
      },
      {
        id: 'q6',
        type: 'multiple_choice',
        prompt: 'Mañana hará aún más calor. ¿Qué pasa con el aviso en Noord-Brabant, Gelderland y Limburg?',
        options: [
          'Cambia de código amarillo a código naranja',
          'Desaparece el aviso',
          'Cambia a código verde',
          'No cambia nada',
        ],
        correctAnswer: 'Cambia de código amarillo a código naranja',
        explanation: '«Code geel verandert naar code oranje» en esas provincias.',
      },
      {
        id: 'q7',
        type: 'true_false',
        prompt: 'Con código naranja se toman medidas extra, como enfriar los puentes con agua para que sigan funcionando.',
        correctAnswer: 'verdadero',
        explanation: 'Sí: «Bruggen worden gekoeld met water zodat ze blijven werken.»',
      },
      {
        id: 'q8',
        type: 'multiple_choice',
        prompt: '¿Por qué los pisos de nueva construcción (nieuwbouwhuizen) son un problema con el calor?',
        options: [
          'Están tan bien aislados que el calor se queda dentro',
          'Son muy viejos y tienen goteras',
          'No tienen ventanas',
          'Están todos junto al mar',
        ],
        correctAnswer: 'Están tan bien aislados que el calor se queda dentro',
        explanation: 'Buena isolatie mantiene el calor dentro: genial en invierno, un problema en verano.',
      },
      {
        id: 'q9',
        type: 'multiple_choice',
        prompt: 'El buen aislamiento (isolatie), ¿cuándo ayuda y cuándo molesta?',
        options: [
          'Ayuda en invierno (deja el frío fuera) y molesta en verano (deja el calor dentro)',
          'Ayuda en verano y molesta en invierno',
          'Siempre molesta',
          'Siempre ayuda',
        ],
        correctAnswer: 'Ayuda en invierno (deja el frío fuera) y molesta en verano (deja el calor dentro)',
        explanation: '«In de winter blijft de kou buiten; in de zomer blijft de hitte juist binnen.»',
      },
      {
        id: 'q10',
        type: 'multiple_choice',
        prompt: 'Mañana es 1 de julio (één juli). ¿Qué pasa ese día?',
        options: [
          'Entran en vigor nuevas leyes y normas',
          'Empiezan las vacaciones de verano',
          'Cierra todo el país un día',
          'Sube el precio del agua',
        ],
        correctAnswer: 'Entran en vigor nuevas leyes y normas',
        explanation: '«Op die dag gaan er nieuwe wetten en regels in.» Cada 1 de enero y 1 de julio.',
      },
      {
        id: 'q11',
        type: 'multiple_choice',
        prompt: 'Una de las leyes nuevas es sobre el salario mínimo (minimumloon). ¿Qué cambia?',
        options: [
          'Sube un poco',
          'Baja un poco',
          'Desaparece',
          'Se queda igual',
        ],
        correctAnswer: 'Sube un poco',
        explanation: '«Het minimumloon gaat iets omhoog» (+0,34 € por hora).',
      },
      {
        id: 'q12',
        type: 'multiple_choice',
        prompt: 'Otra novedad del 1 de julio: las webs y las máquinas (automaten) deben ser…',
        options: [
          'Más fáciles de usar para todos, también para personas con discapacidad',
          'Más caras',
          'Solo en inglés',
          'Más rápidas para las empresas',
        ],
        correctAnswer: 'Más fáciles de usar para todos, también para personas con discapacidad',
        explanation: 'Deben ser usables por todos, p. ej. una web que lea en voz alta para personas ciegas.',
      },
      {
        id: 'q13',
        type: 'multiple_choice',
        prompt: 'Al final, el telediario da el tiempo. ¿Qué tiempo hará mañana?',
        options: [
          'Calor fuerte, de 27 a 37 grados, y sol',
          'Frío y lluvia',
          'Nieve por la mañana',
          'Viento fuerte y tormenta',
        ],
        correctAnswer: 'Calor fuerte, de 27 a 37 grados, y sol',
        explanation: '«Morgen wordt het heet, zevenentwintig tot zevenendertig graden. De zon schijnt.»',
      },
    ],
  },
]

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */

export function getSituaciones(): Situacion[] {
  return SITUACIONES
}

export function getSituacion(id: string): Situacion | null {
  return SITUACIONES.find((s) => s.id === id) ?? null
}

/** Normaliza el dato del vídeo a una URL incrustable (iframe src). */
export function toEmbedSrc(video: SituacionVideo): string | null {
  const raw = (video.src || '').trim()
  if (!raw) return null

  if (video.provider === 'bunny') {
    // Acepta player. o iframe. , con o sin query. Devuelve la forma canónica.
    const m = raw.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{8,})/)
    if (m) return `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}`
    // Si ya es un iframe.mediadelivery.net/embed/... lo dejamos pasar
    if (/^https?:\/\/iframe\.mediadelivery\.net\/embed\//.test(raw)) return raw
    return null
  }

  // YouTube: acepta ID pelado o cualquier enlace y saca el ID.
  const yt =
    raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) ||
    raw.match(/^([\w-]{11})$/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`
  return null
}
