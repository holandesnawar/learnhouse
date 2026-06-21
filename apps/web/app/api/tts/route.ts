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
 * Config por variables de entorno (Railway, servicio web):
 *   ELEVENLABS_API_KEY   → la API key de tu cuenta de ElevenLabs
 *   ELEVENLABS_VOICE_ID  → el ID de la voz que quieres usar
 *   ELEVENLABS_MODEL_ID  → opcional (por defecto eleven_flash_v2_5)
 *
 * Cachea en memoria (por instancia) para no regenerar la misma palabra, y manda
 * cabeceras de cache para que el navegador la guarde entre sesiones.
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.LEARNHOUSE_ELEVENLABS_API_KEY || ''
// Voz por defecto = la voz de la cuenta del usuario (Holandés Nawar). Se puede
// sobreescribir con la env var ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || process.env.LEARNHOUSE_ELEVENLABS_VOICE_ID || 'LP0ZBLgGaLqbDU1l9PDX'
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || process.env.LEARNHOUSE_ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5'

const cache = new Map<string, ArrayBuffer>()
const MAX_CACHE = 600

export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get('text') || '').trim()
  if (!text) return new Response('missing text', { status: 400 })
  if (text.length > 300) return new Response('text too long', { status: 400 })
  if (!API_KEY || !VOICE_ID) return new Response('tts not configured', { status: 503 })

  const cacheKey = `${VOICE_ID}:${MODEL_ID}:${text.toLowerCase()}`
  let buf = cache.get(cacheKey)

  if (!buf) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            language_code: 'nl', // FUERZA neerlandés (arregla los cognados)
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.85,
              style: 0,
              use_speaker_boost: true,
            },
          }),
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
