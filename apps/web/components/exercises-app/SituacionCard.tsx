'use client'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { CATEGORY_META, type Situacion } from '@/lib/exercises-app/situaciones'

// Card for one "situación" (Echt Nederlands video). Uses the Bunny thumbnail when
// available; otherwise falls back to the Nawar blue background + emoji.
export default function SituacionCard({ situacion: s, orgslug }: { situacion: Situacion; orgslug: string }) {
  const cat = CATEGORY_META[s.category]
  return (
    <Link
      href={getUriWithOrg(orgslug, `/ejercicios/situaciones/${s.id}`)}
      className="flex flex-col rounded-2xl border border-[#DDE6F5] overflow-hidden bg-white transition-all duration-300 hover:border-[#1D0084]/20 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)]"
    >
      {s.thumbnail ? (
        <div className="relative w-full aspect-video bg-black overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.thumbnail} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
          {s.durationLabel && (
            <span className="absolute bottom-2 right-2 text-[11px] font-bold text-white bg-black/65 px-1.5 py-0.5 rounded">
              {s.durationLabel}
            </span>
          )}
        </div>
      ) : (
        <div
          className="relative flex items-center justify-center py-9 text-5xl overflow-hidden"
          style={{
            backgroundColor: '#1D0084',
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
              'radial-gradient(circle 280px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 70%)',
            backgroundSize: '24px 24px, auto',
            backgroundRepeat: 'repeat, no-repeat',
          }}
        >
          <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />
          <span className="relative select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
            {s.emoji || cat.emoji}
          </span>
        </div>
      )}

      <div className="p-5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2 py-0.5 rounded-full">
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </span>
          {!s.thumbnail && s.durationLabel && (
            <span className="text-[11px] font-medium text-[#9CA3AF]">{s.durationLabel}</span>
          )}
        </div>
        <h2
          className="text-[17px] font-bold text-gray-900 leading-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {s.title}
        </h2>
        {s.context && <p className="text-[13px] text-[#9CA3AF] leading-snug line-clamp-2">{s.context}</p>}
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#025dc7] pt-1">
          Ver y practicar
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
