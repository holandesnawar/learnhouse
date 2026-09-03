import React from 'react'
import YouTube from 'react-youtube'
import { getActivityVideoStreamUrl } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import LearnHousePlayer from './LearnHousePlayer'

interface VideoDetails {
  startTime?: number
  endTime?: number | null
  autoplay?: boolean
  muted?: boolean
}

interface VideoActivityProps {
  activity: {
    activity_sub_type: string
    activity_uuid: string
    content: {
      filename?: string
      uri?: string
      type?: string
    }
    details?: VideoDetails
  }
  course: {
    course_uuid: string
  }
  orgUuid?: string
  /** Se llama cuando el alumno le da PLAY (para el bloqueo por interacción). */
  onPlay?: () => void
  /** Progreso de reproducción 0..1 (para el bloqueo "ver casi todo el vídeo"). */
  onProgress?: (fraction: number) => void
}

function VideoActivity({ activity, course, orgUuid, onPlay, onProgress }: VideoActivityProps) {
  const org = useOrg() as any
  const resolvedOrgUuid = orgUuid || org?.org_uuid
  const [videoId, setVideoId] = React.useState('')
  const ytPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const bunnyIframeRef = React.useRef<HTMLIFrameElement>(null)

  // Bunny Stream (iframe): no podemos leer el <video> directamente, pero su
  // reproductor emite eventos por postMessage. Sacamos la posición real
  // (segundos / duración): así, saltar al ~90% también desbloquea. Guardamos la
  // última duración conocida por si algún evento no la trae.
  const lastDurRef = React.useRef(0)
  React.useEffect(() => {
    if (!onPlay && !onProgress) return
    function handler(e: MessageEvent) {
      if (typeof e.origin === 'string' && e.origin.includes('mediadelivery.net')) {
        const d: any = e.data
        let parsed: any = d
        if (typeof d === 'string') { try { parsed = JSON.parse(d) } catch { parsed = d } }
        const v = parsed?.value ?? parsed
        const event = parsed?.event || parsed?.type || ''
        // "ended" = visto entero, aunque no llegue posición.
        if (/ended|finish|complete/i.test(event)) { onProgress?.(1); return }
        const seconds = Number(v?.seconds ?? v?.currentTime ?? v?.time ?? v?.position)
        const durRaw = Number(v?.duration ?? v?.totalTime)
        if (isFinite(durRaw) && durRaw > 0) lastDurRef.current = durRaw
        const dur = isFinite(durRaw) && durRaw > 0 ? durRaw : lastDurRef.current
        if (isFinite(seconds) && dur > 0) {
          // timeupdate (al reproducir) Y seeked (al arrastrar la barra, aun en pausa).
          onProgress?.(seconds / dur)
        }
        const s = typeof d === 'string' ? d : (() => { try { return JSON.stringify(d) } catch { return '' } })()
        if (/play|timeupdate|playing|seek/i.test(s)) onPlay?.()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onPlay, onProgress])

  // YouTube: sondeamos el reproductor mientras está en marcha para reportar el
  // progreso real (la API de eventos no da "timeupdate" continuo).
  const startYtPoll = (player: any) => {
    if (ytPollRef.current) return
    ytPollRef.current = setInterval(() => {
      try {
        const cur = player?.getCurrentTime?.()
        const dur = player?.getDuration?.()
        if (isFinite(cur) && isFinite(dur) && dur > 0) onProgress?.(cur / dur)
      } catch { /* player not ready */ }
    }, 1000)
  }
  const stopYtPoll = () => {
    if (ytPollRef.current) { clearInterval(ytPollRef.current); ytPollRef.current = null }
  }
  React.useEffect(() => () => stopYtPoll(), [])

  // Bunny usa el protocolo Player.js: NO emite "timeupdate" hasta que te
  // suscribes con un handshake. Sin esto el progreso no llega y el 90% nunca
  // se detecta. Mandamos addEventListener al recibir "ready" y, por si acaso,
  // unas cuantas veces al cargar.
  React.useEffect(() => {
    const uri = activity.content?.uri || ''
    const bunny = activity.content?.type === 'bunny' || /mediadelivery\.net/.test(uri)
    if (!bunny) return
    const send = (method: string, value?: string) => {
      try {
        bunnyIframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ context: 'player.js', version: '1.0', method, value }),
          '*'
        )
      } catch { /* iframe no listo */ }
    }
    const subscribe = () => {
      send('addEventListener', 'timeupdate')
      send('addEventListener', 'play')
      send('addEventListener', 'seeked') // arrastrar la barra (aunque quede en pausa)
      send('addEventListener', 'ended')
    }
    const onReady = (e: MessageEvent) => {
      if (typeof e.origin === 'string' && e.origin.includes('mediadelivery.net')) {
        let d: any = e.data
        if (typeof d === 'string') { try { d = JSON.parse(d) } catch { /* texto plano */ } }
        if (d?.event === 'ready' || d?.context === 'player.js') subscribe()
      }
    }
    window.addEventListener('message', onReady)
    const timers = [400, 1200, 2500, 5000].map((ms) => setTimeout(subscribe, ms))
    return () => {
      window.removeEventListener('message', onReady)
      timers.forEach(clearTimeout)
    }
  }, [activity?.content?.uri, activity?.content?.type])

  React.useEffect(() => {
    if (activity?.content?.uri) {
      var getYouTubeID = require('get-youtube-id')
      setVideoId(getYouTubeID(activity.content.uri))
    }
  }, [activity, org])

  const getVideoSrc = () => {
    if (!activity.content?.filename) return ''
    return getActivityVideoStreamUrl(
      resolvedOrgUuid,
      course?.course_uuid,
      activity.activity_uuid,
      activity.content.filename
    )
  }

  // External videos are all stored under SUBTYPE_VIDEO_YOUTUBE and told apart
  // by content.type. Bunny Stream is an iframe embed (not a YouTube id), so it
  // gets its own render path inside the same video layout.
  const isBunny =
    activity.content?.type === 'bunny' ||
    /mediadelivery\.net/.test(activity.content?.uri || '')

  const getBunnySrc = () => {
    const uri = activity.content?.uri || ''
    const m = uri.match(/mediadelivery\.net\/embed\/(\d+)\/([0-9a-fA-F-]{8,})/)
    const base = m
      ? `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}`
      : uri
    const params = new URLSearchParams()
    // `responsive=true` viene en el código de inserción que da Bunny, y aquí
    // se perdía: la dirección se reconstruye desde cero con la biblioteca y el
    // id, así que todo lo demás se tiraba. Sin él el reproductor se dibuja al
    // tamaño que calculó al arrancar y no vuelve a ajustarse al marco: sale
    // **encogido y centrado** dentro del rectángulo negro los primeros
    // segundos, y deja una franja negra abajo aunque la caja sea 16:9.
    //
    // El mismo fallo estaba apuntado para el bloque de vídeo del editor, pero
    // este componente —que es el que pinta los vídeos de las clases— se quedó
    // sin arreglar. `preload=true` deja lista la primera parte antes del play.
    params.set('responsive', 'true')
    params.set('preload', 'true')
    if (activity.details?.autoplay) params.set('autoplay', 'true')
    if (activity.details?.muted) params.set('muted', 'true')
    return `${base}?${params.toString()}`
  }

  return (
    <div className="w-full max-w-full">
      {activity && (
        <>
          {activity.activity_sub_type === 'SUBTYPE_VIDEO_HOSTED' && (
            <div className="w-full">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                {(() => {
                  const src = getVideoSrc()
                  return src ? (
                    <LearnHousePlayer
                      key={activity.activity_uuid}
                      src={src}
                      details={activity.details}
                      onPlay={onPlay}
                      onProgress={onProgress}
                    />
                  ) : null
                })()}
              </div>
            </div>
          )}
          {activity.activity_sub_type === 'SUBTYPE_VIDEO_YOUTUBE' && isBunny && (
            <div className="w-full">
              {/* ⚠️ Confirmado ago/sept 2026: el vídeo en sí NO tiene franja
                  (comprobado a pantalla completa dentro del propio panel de
                  Bunny y en la escuela) — así que la franja no está grabada en
                  el archivo, y tampoco es "el reproductor de Bunny impone
                  16:9" a secas: si fuera eso, saldría también a pantalla
                  completa. Solo aparece en la caja pequeña, sin pantalla
                  completa.
                  La caja usaba `aspect-video` (la propiedad CSS moderna
                  `aspect-ratio`). El script de Bunny que activa
                  `responsive=true` está pensado para el truco clásico de
                  "padding-bottom: 56.25%" — que es literalmente lo que trae el
                  código de inserción oficial de Bunny — y mide el tamaño de la
                  caja con ese supuesto. Con `aspect-ratio` la altura puede
                  quedar unos píxeles descuadrada frente a lo que Bunny cree
                  que mide, y ese hueco se ve negro porque es el fondo del
                  documento de dentro del iframe. Cambiado al truco del
                  padding-bottom para que mida exactamente lo que Bunny espera. */}
              <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingTop: '56.25%' }}>
                <iframe
                  key={activity.activity_uuid}
                  ref={bunnyIframeRef}
                  src={getBunnySrc()}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 0 }}
                  allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
                  allowFullScreen
                />
              </div>
            </div>
          )}
          {activity.activity_sub_type === 'SUBTYPE_VIDEO_YOUTUBE' && !isBunny && (
            <div className="w-full">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                <YouTube
                  className="w-full h-full"
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: activity.details?.autoplay ? 1 : 0,
                      mute: activity.details?.muted ? 1 : 0,
                      start: activity.details?.startTime || 0,
                      end: activity.details?.endTime || undefined,
                      controls: 1,
                      modestbranding: 1,
                      rel: 0
                    },
                  }}
                  videoId={videoId}
                  onPlay={(event) => { onPlay?.(); startYtPoll(event.target) }}
                  onPause={() => stopYtPoll()}
                  onEnd={(event) => { onProgress?.(1); stopYtPoll() }}
                  onReady={(event) => {
                    if (activity.details?.startTime) {
                      event.target.seekTo(activity.details.startTime, true)
                    }
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default VideoActivity
