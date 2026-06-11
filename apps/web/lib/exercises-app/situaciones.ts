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
    // Ejercicios fáciles (módulo 1): vocabulario clave + idea general del telediario.
    exercises: [
      {
        id: 'calor-1',
        type: 'true_false',
        prompt: 'Este vídeo es un telediario en holandés fácil (NOS Journaal in makkelijke taal) y habla del calor.',
        correctAnswer: 'verdadero',
        explanation: 'Sí: es el NOS Journaal in makkelijke taal y trata sobre el calor (de hitte).',
      },
      {
        id: 'calor-2',
        type: 'listen_and_choose',
        prompt: 'Escucha la palabra y elige su significado: "warm"',
        options: ['Caliente / cálido', 'Frío', 'Mojado', 'Oscuro'],
        correctAnswer: 'Caliente / cálido',
        explanation: '«Warm» = caliente.',
      },
      {
        id: 'calor-3',
        type: 'multiple_choice',
        prompt: 'En el vídeo se repite la palabra «hitte». ¿Qué significa?',
        options: ['El calor (fuerte)', 'El frío', 'La lluvia', 'El viento'],
        correctAnswer: 'El calor (fuerte)',
        explanation: '«Hitte» = calor fuerte, ola de calor.',
      },
      {
        id: 'calor-4',
        type: 'multiple_choice',
        prompt: '¿Qué significa el consejo «Drink voldoende water»?',
        options: ['Bebe suficiente agua', 'Come fruta', 'Duerme más', 'Abre la ventana'],
        correctAnswer: 'Bebe suficiente agua',
        explanation: '«Drink voldoende water» = Bebe suficiente agua.',
      },
      {
        id: 'calor-5',
        type: 'multiple_choice',
        prompt: 'Otro consejo es «Ga niet in de zon zitten». Significa…',
        options: ['No te sientes al sol', 'Ponte al sol', 'Cierra la puerta', 'Sal a correr'],
        correctAnswer: 'No te sientes al sol',
        explanation: '«Ga niet in de zon zitten» = No te sientes al sol.',
      },
      {
        id: 'calor-6',
        type: 'true_false',
        prompt: 'El telediario dice que hay que cuidar a las personas vulnerables, como los enfermos (zieken) y los mayores (ouderen).',
        correctAnswer: 'verdadero',
        explanation: 'Sí: «let op kwetsbare mensen zoals zieken en ouderen».',
      },
      {
        id: 'calor-7',
        type: 'multiple_choice',
        prompt: 'Hoy en toda Holanda hay «code geel». ¿Qué color es «geel»?',
        options: ['Amarillo', 'Naranja', 'Rojo', 'Verde'],
        correctAnswer: 'Amarillo',
        explanation: '«Geel» = amarillo. Es un aviso por el calor.',
      },
      {
        id: 'calor-8',
        type: 'multiple_choice',
        prompt: 'Mañana el aviso sube a «code oranje» en algunas provincias. ¿Qué color es «oranje»?',
        options: ['Naranja', 'Amarillo', 'Azul', 'Verde'],
        correctAnswer: 'Naranja',
        explanation: '«Oranje» = naranja. Más calor = aviso más fuerte.',
      },
      {
        id: 'calor-9',
        type: 'fill_blank',
        prompt: 'Het is vandaag erg ___ buiten.',
        options: ['warm', 'koud', 'nat', 'donker'],
        correctAnswer: 'warm',
        hint: 'Hoy fuera hace mucho… (calor)',
        explanation: '«Het is vandaag erg warm buiten» = Hoy hace mucho calor fuera.',
      },
      {
        id: 'calor-10',
        type: 'order_sentence',
        prompt: 'Ordena el consejo: «Bebe suficiente agua».',
        options: ['Drink', 'voldoende', 'water'],
        correctAnswer: 'Drink voldoende water',
        explanation: '«Drink voldoende water» = Bebe suficiente agua.',
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
