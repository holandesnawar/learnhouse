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

  // Bunny Stream (iframe): no podemos leer el <video> directamente, pero su
  // reproductor emite eventos por postMessage. Intentamos sacar el progreso real
  // (segundos / duración); si no, al menos detectamos el PLAY.
  React.useEffect(() => {
    if (!onPlay && !onProgress) return
    function handler(e: MessageEvent) {
      if (typeof e.origin === 'string' && e.origin.includes('mediadelivery.net')) {
        const d: any = e.data
        let parsed: any = d
        if (typeof d === 'string') { try { parsed = JSON.parse(d) } catch { parsed = d } }
        // Player.js (Bunny) manda { event:'timeupdate', value:{ seconds, duration } }
        // o variantes con seconds/duration/currentTime en la raíz.
        const v = parsed?.value ?? parsed
        const seconds = Number(v?.seconds ?? v?.currentTime ?? v?.time)
        const dur = Number(v?.duration ?? v?.totalTime)
        if (isFinite(seconds) && isFinite(dur) && dur > 0) {
          onProgress?.(seconds / dur)
        }
        const s = typeof d === 'string' ? d : (() => { try { return JSON.stringify(d) } catch { return '' } })()
        if (/play|timeupdate|playing/i.test(s)) onPlay?.()
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
    if (activity.details?.autoplay) params.set('autoplay', 'true')
    if (activity.details?.muted) params.set('muted', 'true')
    const q = params.toString()
    return q ? `${base}?${q}` : base
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
              <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                <iframe
                  key={activity.activity_uuid}
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
