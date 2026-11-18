'use client'
/**
 * El vídeo de una grabación de la sala en un <video> (18/11/2026): pregunta a
 * la escuela de dónde sale (Bunny mp4, Bunny HLS o Daily) y lo pone, con
 * hls.js si hace falta. Ver `lib/nawar/videoFuente.ts`.
 */
import { useEffect } from 'react'
import { urlFuenteSala, urlVideoSala } from '@services/grabaciones/grabaciones'
import { ponerFuente, type Fuente } from '@/lib/nawar/videoFuente'

export function useFuenteSala(
  video: React.MutableRefObject<HTMLVideoElement | null>,
  courseUuid: string,
  grabacionId: string | undefined,
  intento: number,
  alFallar: () => void,
  otroGrupo = false,
) {
  useEffect(() => {
    const v = video.current
    if (!v || !grabacionId) return
    let quitar: () => void = () => undefined
    let vivo = true
    ;(async () => {
      let fuente: Fuente | null = null
      try {
        const r = await fetch(urlFuenteSala(courseUuid, grabacionId, intento, otroGrupo), {
          credentials: 'include',
          cache: 'no-store',
        })
        if (r.ok) fuente = (await r.json()) as Fuente
      } catch {
        fuente = null
      }
      if (!vivo) return
      if (!fuente?.url) {
        // Como antes: la escuela redirige al vídeo que haya.
        v.src = urlVideoSala(courseUuid, grabacionId, intento, otroGrupo)
        return
      }
      try {
        const q = await ponerFuente(v, fuente, () => vivo && alFallar())
        if (vivo) quitar = q
        else q()
      } catch {
        if (vivo) v.src = urlVideoSala(courseUuid, grabacionId, intento, otroGrupo)
      }
    })()
    return () => {
      vivo = false
      quitar()
    }
    // alFallar cambia en cada render; con la fuente puesta, da igual cuál se llame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseUuid, grabacionId, intento, otroGrupo])
}
