'use client'
import React from 'react'

interface VideoLessonSectionProps {
  url: string
  title?: string
  onComplete: () => void
}

// Returns a YouTube/Vimeo embed URL, or null if the link isn't one of those
// (in which case we treat it as a direct video file).
function getEmbedUrl(url: string): string | null {
  const u = url.trim()
  // YouTube: watch?v=, youtu.be/, /embed/, /shorts/
  const yt =
    u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`
  // Vimeo: vimeo.com/123456789
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

// The "Vídeo" step of an ejercicios lesson: plays the class video, then a
// "Continuar" button advances to the exercises. The URL is set per lesson by
// the teacher (Supabase `lessons.video_url`, or a local `video` block).
export default function VideoLessonSection({ url, title, onComplete }: VideoLessonSectionProps) {
  const embed = getEmbedUrl(url)
  const hasVideo = Boolean(url && url.trim())

  return (
    <div className="space-y-5">
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black nice-shadow">
        {!hasVideo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 px-6 bg-[#1D0084]">
            <span className="text-4xl" aria-hidden>🎬</span>
            <p className="text-white font-bold">El vídeo de esta clase irá aquí</p>
            <p className="text-white/70 text-sm">El profe lo añadirá muy pronto.</p>
          </div>
        ) : embed ? (
          <iframe
            src={embed}
            title={title || 'Vídeo de la clase'}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            src={url}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-white text-[16px] font-bold transition-all duration-150 brand-accent-line hover:brightness-110"
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        Continuar con los ejercicios
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
