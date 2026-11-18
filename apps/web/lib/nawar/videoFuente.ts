/**
 * Poner en un <video> el vídeo de una grabación de la sala (18/11/2026).
 *
 * La escuela dice de dónde sale (`/grabaciones/fuente/{id}`): el mp4 de Bunny
 * (MP4 Fallback), su lista HLS (`playlist.m3u8`, la hace siempre) o el mp4 de
 * Daily. Las dos de Bunny se pueden saltar a cualquier minuto al momento; la
 * de Daily es un mp4 en trozos de varios gigas que se queda congelado.
 *
 * HLS: Safari (también el del iPhone) lo sabe reproducir solo; Chrome, Firefox
 * y Edge necesitan hls.js, que se carga solo cuando hace falta. Si algo falla
 * de verdad, se llama a `alFallar` (el reproductor pide otra vez, y a la
 * segunda va a Daily).
 */

export type Fuente = { tipo: 'mp4' | 'hls' | 'daily' | string; url: string }

/** Si el navegador sabe reproducir HLS sin ayuda (Safari). */
export function hlsNativo(video: Pick<HTMLVideoElement, 'canPlayType'>): boolean {
  try {
    return !!video.canPlayType('application/vnd.apple.mpegurl')
  } catch {
    return false
  }
}

/** Pone la fuente en el vídeo. Devuelve con qué quitarla al cambiar o salir. */
export async function ponerFuente(
  video: HTMLVideoElement,
  fuente: Fuente,
  alFallar: () => void,
): Promise<() => void> {
  if (fuente.tipo !== 'hls' || hlsNativo(video)) {
    video.src = fuente.url
    return () => undefined
  }
  const { default: Hls } = await import('hls.js')
  if (!Hls.isSupported()) {
    video.src = fuente.url
    return () => undefined
  }
  const hls = new Hls({ maxBufferLength: 30, backBufferLength: 30 })
  let rescates = 0
  hls.on(Hls.Events.ERROR, (_e: unknown, datos: { fatal?: boolean; type?: string }) => {
    if (!datos?.fatal) return
    // Un corte de red o un trozo mal leído se arregla sin salir; si se repite, fuera.
    if (rescates < 2 && datos.type === Hls.ErrorTypes.NETWORK_ERROR) {
      rescates += 1
      hls.startLoad()
      return
    }
    if (rescates < 2 && datos.type === Hls.ErrorTypes.MEDIA_ERROR) {
      rescates += 1
      hls.recoverMediaError()
      return
    }
    hls.destroy()
    alFallar()
  })
  hls.loadSource(fuente.url)
  hls.attachMedia(video)
  return () => hls.destroy()
}
