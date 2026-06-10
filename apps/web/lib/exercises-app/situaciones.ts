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
      'Un resumen de noticias en holandés sobre el calor del verano y los consejos para protegerse.',
    durationLabel: '2 min',
    emoji: '☀️',
    video: {
      provider: 'bunny',
      src: 'https://iframe.mediadelivery.net/embed/675650/830df70b-2217-4690-80b5-727396ddfa11',
    },
    // Primer borrador de ejercicios: vocabulario y comprensión general del tema
    // (calor de verano + consejos). Cuando me pases la transcripción exacta,
    // afino las preguntas para que casen palabra por palabra con lo que se dice.
    exercises: [
      {
        id: 'calor-1',
        type: 'true_false',
        prompt: 'Este vídeo es un resumen de noticias (een nieuwsoverzicht).',
        correctAnswer: 'verdadero',
        explanation: 'Sí: es un boletín de noticias en holandés.',
      },
      {
        id: 'calor-2',
        type: 'multiple_choice',
        prompt: 'En el vídeo se habla del tiempo en verano. ¿Qué significa «warm»?',
        options: ['Caliente / cálido', 'Frío', 'Lluvioso', 'Nublado'],
        correctAnswer: 'Caliente / cálido',
        explanation: '«Warm» = caliente, cálido.',
      },
      {
        id: 'calor-3',
        type: 'multiple_choice',
        prompt: '¿Qué significa «de zon»?',
        options: ['El sol', 'La lluvia', 'El viento', 'La nieve'],
        correctAnswer: 'El sol',
        explanation: '«De zon» = el sol.',
      },
      {
        id: 'calor-4',
        type: 'multiple_choice',
        prompt: '«Het is warm vandaag» significa…',
        options: ['Hoy hace calor', 'Hoy hace frío', 'Hoy llueve', 'Hoy hace viento'],
        correctAnswer: 'Hoy hace calor',
        explanation: '«Het is warm vandaag» = Hoy hace calor.',
      },
      {
        id: 'calor-5',
        type: 'multiple_choice',
        prompt: 'Un consejo típico con el calor: «drink veel water». ¿Qué significa?',
        options: ['Bebe mucha agua', 'Come fruta', 'Duerme la siesta', 'Sal a correr'],
        correctAnswer: 'Bebe mucha agua',
        explanation: '«Drink veel water» = Bebe mucha agua.',
      },
      {
        id: 'calor-6',
        type: 'multiple_choice',
        prompt: '«Blijf in de schaduw» te aconseja…',
        options: ['Quédate a la sombra', 'Ponte al sol', 'Cierra la puerta', 'Abre la ventana'],
        correctAnswer: 'Quédate a la sombra',
        explanation: '«Blijf in de schaduw» = Quédate a la sombra.',
      },
      {
        id: 'calor-7',
        type: 'fill_blank',
        prompt: 'In de zomer is het vaak ___.',
        options: ['warm', 'koud', 'nat', 'donker'],
        correctAnswer: 'warm',
        hint: 'En verano a menudo hace… (calor)',
        explanation: '«In de zomer is het vaak warm» = En verano a menudo hace calor.',
      },
      {
        id: 'calor-8',
        type: 'order_sentence',
        prompt: 'Ordena la frase: «Hoy hace calor».',
        options: ['Het', 'is', 'warm', 'vandaag'],
        correctAnswer: 'Het is warm vandaag',
        explanation: 'Het is warm vandaag = Hoy hace calor.',
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
