import { NextRequest } from 'next/server'

/**
 * Text-to-Speech en NEERLANDÉS con ElevenLabs (voz de la cuenta del usuario).
 *
 * Clave del problema de los cognados ("water", "internet", "appel"...): el
 * modelo multilingüe AUTO-detecta el idioma y a veces los pronuncia en inglés.
 * La solución es usar un modelo que acepte `language_code` (eleven_flash_v2_5 /
 * eleven_turbo_v2_5) y FORZAR `language_code: "nl"`. Así siempre suena en
 * neerlandés, no en "inglés internacional".
 *
 * DOS modelos, según lo que se manda (sept 2026):
 *
 *   - Palabras sueltas y frases muy cortas (flashcards, vocabulario): Turbo
 *     v2.5 con `language_code: nl`. Es el único camino que garantiza que
 *     "water" suene a neerlandés y no a inglés. Suena algo más plano, pero en
 *     una palabra sola no se nota y lo que importa es que no se equivoque.
 *
 *   - Frases enteras (los diálogos del Luisteren, las frases de ejemplo): el
 *     modelo de `ELEVENLABS_MODEL_ID_SENTENCES`. Con una frase entera el
 *     modelo ya sabe que es neerlandés sin que se lo digan, así que aquí se
 *     puede usar uno más natural (eleven_multilingual_v2 o eleven_v3), que
 *     son los que dejan de sonar a robot. Por defecto sigue siendo Turbo:
 *     cambiar de modelo hay que ESCUCHARLO antes, y eso solo se puede hacer
 *     con la variable puesta en Railway.
 *
 * ⚠️ `language_code` SOLO lo aceptan Turbo v2.5 y Flash v2.5. Mandárselo a
 * multilingual_v2 devuelve un error 400 y se queda TODO el audio de la escuela
 * sin sonar. Por eso aquí se manda solo con esos dos. Y eleven_v3 solo admite
 * stability 0, 0.5 o 1: con 0.65 también da error. Las dos cosas se resuelven
 * abajo según el modelo, para que cambiar la variable no pueda romper nada.
 *
 * Config por variables de entorno (Railway, servicio web):
 *   ELEVENLABS_API_KEY              → la API key de tu cuenta de ElevenLabs
 *   ELEVENLABS_VOICE_ID             → el ID de la voz por defecto
 *   ELEVENLABS_MODEL_ID             → modelo para palabras sueltas (por defecto eleven_turbo_v2_5)
 *   ELEVENLABS_MODEL_ID_SENTENCES   → modelo para frases enteras (por defecto, el mismo)
 *
 * Cachea en memoria (por instancia) para no regenerar la misma palabra, y manda
 * cabeceras de cache para que el navegador la guarde entre sesiones.
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.LEARNHOUSE_ELEVENLABS_API_KEY || ''
// Voz por defecto = la voz de la cuenta del usuario (Holandés Nawar). Se puede
// sobreescribir con la env var ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || process.env.LEARNHOUSE_ELEVENLABS_VOICE_ID || 'yO6w2xlECAQRFP6pX7Hw'
const MODEL_WORDS = process.env.ELEVENLABS_MODEL_ID || process.env.LEARNHOUSE_ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'
const MODEL_SENTENCES = process.env.ELEVENLABS_MODEL_ID_SENTENCES || MODEL_WORDS

// A partir de cuántas palabras un texto cuenta como "frase" y va al modelo
// bueno. Tres: "Ik ben arts" ya es una frase; "de kat" o "goedemorgen" no.
const MIN_WORDS_FOR_SENTENCE = 3

const cache = new Map<string, ArrayBuffer>()
const MAX_CACHE = 600

function pickModel(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length
  return words >= MIN_WORDS_FOR_SENTENCE ? MODEL_SENTENCES : MODEL_WORDS
}

function supportsLanguageCode(model: string): boolean {
  return /turbo_v2_5|flash_v2_5/.test(model)
}

function voiceSettingsFor(model: string) {
  // eleven_v3 solo admite tres valores de stability (0 creativo, 0.5 natural,
  // 1 robusto). Cualquier otro número devuelve 400.
  if (/eleven_v3/.test(model)) {
    return { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true }
  }
  return { stability: 0.65, similarity_boost: 0.8, style: 0, use_speaker_boost: true }
}

export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get('text') || '').trim()
  if (!text) return new Response('missing text', { status: 400 })
  if (text.length > 800) return new Response('text too long', { status: 400 })
  if (!API_KEY) return new Response('tts not configured', { status: 503 })

  // Voz por petición (para diálogos con 2 voces); si no, la voz por defecto.
  const voice = (req.nextUrl.searchParams.get('voice') || '').trim() || VOICE_ID
  if (!voice) return new Response('tts not configured', { status: 503 })

  const model = pickModel(text)
  const cacheKey = `${voice}:${model}:${text.toLowerCase()}`
  let buf = cache.get(cacheKey)

  if (!buf) {
    try {
      const body: Record<string, unknown> = {
        text,
        model_id: model,
        voice_settings: voiceSettingsFor(model),
      }
      // FUERZA neerlandés (arregla los cognados), pero solo en los modelos que
      // lo entienden: a los demás les rompe la petición.
      if (supportsLanguageCode(model)) body.language_code = 'nl'

      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (!r.ok) {
        const detail = await r.text().catch(() => '')
        return new Response(`tts upstream error: ${detail.slice(0, 300)}`, { status: 502 })
      }
      buf = await r.arrayBuffer()
      if (cache.size > MAX_CACHE) cache.clear()
      cache.set(cacheKey, buf)
    } catch (e: any) {
      return new Response(`tts fetch failed: ${e?.message || e}`, { status: 502 })
    }
  }

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
