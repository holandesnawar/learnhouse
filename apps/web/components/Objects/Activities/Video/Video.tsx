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
}

function VideoActivity({ activity, course, orgUuid }: VideoActivityProps) {
  const org = useOrg() as any
  const resolvedOrgUuid = orgUuid || org?.org_uuid
  const [videoId, setVideoId] = React.useState('')

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
